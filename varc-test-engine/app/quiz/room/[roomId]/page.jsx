"use client";
import { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { generateRandomQuiz } from '../../../../lib/quizGenerator';
import TestPassage from '../../../../components/TestPassage';
import TestSelector from '../../../../components/TestSelector';
import { ShieldCheck, Wifi, Users, Copy, Home, Loader2, Star } from 'lucide-react';

function MultiRoomEngine({ roomId }) {
  const router = useRouter();
  const myUuid = useMemo(() => Math.random().toString(36).substring(2, 15), []);
  
  const [peers, setPeers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [quizData, setQuizData] = useState([]);
  const [roomState, setRoomState] = useState('waiting');
  const [viewState, setViewState] = useState('testing');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [myAnswers, setMyAnswers] = useState({});
  const [myLocked, setMyLocked] = useState({});
  
  // Track everyone's progress in a star topology
  const [globalStats, setGlobalStats] = useState({}); 
  const channelRef = useRef(null);

  const extractQuestionsFromRow = (row) => {
    if (!row || row.length === 0) return [];
    const rawQuestionText = row[5] ? String(row[5]).trim() : "";
    if (rawQuestionText === "") {
      return [{ text: String(row[0] || "").trim(), correctAnswer: row[1] ? String(row[1]).trim() : "", flagsStr: row[6] ? String(row[6]).toLowerCase() : "" }];
    } else {
      const qBlocks = rawQuestionText.split('***').map(s => s.trim());
      const ansBlocks = (row[1] ? String(row[1]) : "").split(/\*\*\*|\r?\n/).map(s => s.trim()).filter(s => s !== "");
      const flagBlocks = (row[6] ? String(row[6]).toLowerCase() : "").split('***').map(s => s.trim());
      return qBlocks.map((qText, i) => ({ text: qText, correctAnswer: ansBlocks[i] || ansBlocks[0] || "", flagsStr: flagBlocks[i] || flagBlocks[0] || "" }));
    }
  };

  const computeLiveStats = (currentAnswers, currentLocked, currentData) => {
    let correct = 0, totalChecked = 0;
    if (!currentData || currentData.length === 0) return { correct, totalChecked };
    currentData.forEach((row, pIdx) => {
      const qs = extractQuestionsFromRow(row);
      const pAnswers = currentAnswers[pIdx] || {};
      const pLocked = currentLocked[pIdx] || {};
      qs.forEach((q, qIdx) => {
        if (pLocked[qIdx]) {
          totalChecked++;
          const ans = pAnswers[qIdx];
          const isMcma = String(q.correctAnswer).includes(',');
          const cleanCorrectArr = String(q.correctAnswer).split(',').map(s => s.trim().toLowerCase());
          if (isMcma) {
             if (Array.isArray(ans) && ans.length === cleanCorrectArr.length && ans.every(a => cleanCorrectArr.includes(String(a).trim().toLowerCase()))) correct++;
          } else {
             if (String(ans).trim().toLowerCase() === cleanCorrectArr[0]) correct++;
          }
        }
      });
    });
    return { correct, totalChecked };
  };

  useEffect(() => {
    let isMounted = true;
    const channel = supabase.channel(`multi-${roomId}`, { config: { presence: { key: myUuid } } });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      if (!isMounted) return;
      const state = channel.presenceState();
      const userIds = Object.keys(state).sort(); 
      setPeers(userIds);
      
      // Automatic Host Election (Star Topology root node mapping)
      // If the current host drops, the next oldest UUID takes over generating/syncing quiz.
      if (userIds.length > 0 && userIds[0] === myUuid) {
        setIsHost(true);
      }
    });

    channel.on('broadcast', { event: 'sync_state' }, ({ payload }) => {
      if (!isMounted) return;
      if (payload.quizData && quizData.length === 0) {
        setQuizData(payload.quizData);
        setRoomState('playing');
      }
      if (payload.progress) {
        setGlobalStats(prev => ({ ...prev, [payload.from]: payload.progress }));
      }
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
         await channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [roomId, myUuid, quizData.length]);

  // Host exclusively generates and broadcasts quiz
  useEffect(() => {
    if (isHost && quizData.length === 0) {
      generateRandomQuiz(5).then(data => {
         setQuizData(data);
         setRoomState('playing');
         if (channelRef.current) {
            channelRef.current.send({ type: 'broadcast', event: 'sync_state', payload: { quizData: data, from: myUuid } });
         }
      });
    } else if (isHost && quizData.length > 0 && roomState === 'playing') {
       // Regularly broadcast to ensure late joiners or migrated clients sync
       const syncInterval = setInterval(() => {
         if (channelRef.current) {
           channelRef.current.send({ type: 'broadcast', event: 'sync_state', payload: { quizData, from: myUuid } });
         }
       }, 5000);
       return () => clearInterval(syncInterval);
    }
  }, [isHost, quizData, roomState, myUuid]);

  const handlePersistProgress = (newAnswers, newLocked) => {
    const stats = computeLiveStats(newAnswers || myAnswers, newLocked || myLocked, quizData);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast', event: 'sync_state', 
        payload: { from: myUuid, progress: stats }
      });
    }
  };

  const submitQuiz = () => {
    if (confirm("Submit quiz? Your score will be locked on the multiplayer board.")) {
      setRoomState('finished');
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };

  if (roomState === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-6 text-center px-4 relative">
        <button onClick={() => router.push('/')} className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
          <Home size={18}/> Cancel
        </button>
        <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-slate-200/60 max-w-sm w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-100"><div className="h-full bg-purple-500 animate-pulse w-full"></div></div>
          <Users size={56} className="mx-auto text-purple-500 mb-6 animate-pulse"/>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Room: {roomId}</h2>
          <p className="text-sm text-slate-500 font-medium mb-8">
            {isHost ? 'Generating Topology & Data...' : 'Waiting for Server Host Sync...'}
          </p>
          <button onClick={() => navigator.clipboard.writeText(roomId)} className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 text-slate-600 font-bold py-3 rounded-xl border border-slate-200 transition-colors shadow-inner">
             <Copy size={16}/> Copy Room Code
          </button>
        </div>
      </div>
    );
  }

  const myStats = computeLiveStats(myAnswers, myLocked, quizData);
  const totalQs = quizData.reduce((acc, curr) => acc + extractQuestionsFromRow(curr).length, 0);

  if (roomState === 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col p-6">
        <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-xl border border-slate-200/60 max-w-2xl w-full text-center relative">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Multiplayer Leaderboard</h1>
          <p className="text-slate-500 mb-10 font-medium">Star topology ensures all metrics are synchronized directly.</p>
          <div className="grid grid-cols-1 gap-4 mb-10">
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex justify-between items-center shadow-sm">
               <span className="font-extrabold text-purple-900 flex items-center gap-2"><Star size={16}/> You {isHost && '(Host)'}</span>
               <span className="font-bold text-purple-600">{myStats.correct} / {totalQs} Correct</span>
            </div>
            {Object.entries(globalStats).map(([id, stats], idx) => (
              <div key={id} className="p-4 rounded-xl border bg-slate-50 border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-600 text-sm">Peer #{idx + 1} {peers[0] === id && '(Host)'}</span>
                <span className="font-bold text-slate-500">{stats.correct} / {totalQs} Correct</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/')} className="w-full md:w-auto bg-slate-900 text-white font-bold px-10 py-4 rounded-2xl hover:bg-purple-600 shadow-md hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mx-auto">
             <Home size={20}/> Exit Arena
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-slate-950">
      <div className="fixed top-16 md:top-4 right-4 z-[60] bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col gap-2 text-[10px] md:text-xs font-bold animate-in fade-in slide-in-from-top-4 min-w-[150px]">
         <div className="flex justify-between items-center border-b border-slate-700 pb-1 mb-1">
           <span className="text-purple-400">Multi Network</span>
           <span className="bg-slate-800 px-2 rounded-full text-[9px]">{peers.length} Peers</span>
         </div>
         <span className="flex items-center gap-1.5 text-indigo-300"><Users size={12}/> You: {myStats.correct}/{myStats.totalChecked}</span>
         {Object.entries(globalStats).slice(0, 3).map(([id, stats], i) => (
           <span key={id} className="flex items-center gap-1.5 text-slate-400"><Wifi size={12}/> Peer {i+1}: {stats.correct}/{stats.totalChecked}</span>
         ))}
      </div>
      
      {viewState === 'selector' ? (
        <TestSelector data={quizData} testId={`Star Arena - ${roomId}`} answers={myAnswers} setViewState={setViewState} setCurrentIndex={setCurrentIndex} />
      ) : (
        <TestPassage 
          data={quizData} testId={`Multi-${roomId}`}
          currentIndex={currentIndex} setCurrentIndex={setCurrentIndex}
          answers={myAnswers} setAnswers={setMyAnswers}
          locked={myLocked} setLocked={setMyLocked}
          setViewState={setViewState} persistProgress={handlePersistProgress}
          submitTest={submitQuiz} extractQuestionsFromRow={extractQuestionsFromRow}
          liveStats={myStats}
        />
      )}
    </div>
  );
}

export default function MultiRoomWrapper({ params }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" size={48}/></div>}>
      <MultiRoomEngine roomId={params.roomId} />
    </Suspense>
  );
}