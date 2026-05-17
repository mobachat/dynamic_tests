"use client";
import { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { generateRandomQuiz } from '../../../../lib/quizGenerator';
import TestPassage from '../../../../components/TestPassage';
import TestSelector from '../../../../components/TestSelector';
import { Users, Copy, Home, Loader2, Star, Trophy, Activity, Medal, Target, ChevronRight } from 'lucide-react';

function MultiRoomEngine({ roomId }) {
  const router = useRouter();
  // Unique identifiers
  const myUuid = useMemo(() => Math.random().toString(36).substring(2, 15), []);
  const myAvatarName = useMemo(() => `Player_${Math.floor(Math.random() * 1000)}`, []);
  
  const [peers, setPeers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [quizData, setQuizData] = useState([]);
  const [roomState, setRoomState] = useState('waiting');
  const [viewState, setViewState] = useState('testing');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [myAnswers, setMyAnswers] = useState({});
  const [myLocked, setMyLocked] = useState({});
  
  // Distributed state via Supabase Presence (highly scalable)
  const [leaderboard, setLeaderboard] = useState([]); 
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

    // Presence efficiently handles 100+ concurrent connections without manual broadcasting
    channel.on('presence', { event: 'sync' }, () => {
      if (!isMounted) return;
      const state = channel.presenceState();
      const userIds = Object.keys(state).sort(); 
      setPeers(userIds);
      
      // Automatic Host Election: Oldest UUID is responsible for data payload
      if (userIds.length > 0 && userIds[0] === myUuid) {
        setIsHost(true);
      }

      // Build Leaderboard from Presence State
      const currentLeaderboard = [];
      Object.entries(state).forEach(([uuid, presences]) => {
        const latestPresence = presences[presences.length - 1]; // Get most recent state
        currentLeaderboard.push({
          id: uuid,
          name: latestPresence.name || 'Unknown',
          correct: latestPresence.correct || 0,
          totalChecked: latestPresence.totalChecked || 0,
          isMe: uuid === myUuid
        });
      });
      
      // Sort by correct answers, then by highest attempted
      currentLeaderboard.sort((a, b) => b.correct - a.correct || b.totalChecked - a.totalChecked);
      setLeaderboard(currentLeaderboard);
    });

    channel.on('broadcast', { event: 'sync_state' }, ({ payload }) => {
      if (!isMounted) return;
      if (payload.quizData && quizData.length === 0) {
        setQuizData(payload.quizData);
        setRoomState('playing');
      }
    });

    channel.on('broadcast', { event: 'request_quiz' }, () => {
      // If someone new asks for the quiz, only the Host responds to save bandwidth
      if (isHost && quizData.length > 0) {
        channel.send({ type: 'broadcast', event: 'sync_state', payload: { quizData } });
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
         await channel.track({ online_at: new Date().toISOString(), name: myAvatarName, correct: 0, totalChecked: 0 });
         // Immediately request quiz data if we are late to the party
         if (quizData.length === 0) {
             channel.send({ type: 'broadcast', event: 'request_quiz' });
         }
      }
    });

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [roomId, myUuid, myAvatarName, quizData, isHost]);

  // Host Initialization
  useEffect(() => {
    if (isHost && quizData.length === 0) {
      generateRandomQuiz(5).then(data => {
         setQuizData(data);
         setRoomState('playing');
         if (channelRef.current) {
            channelRef.current.send({ type: 'broadcast', event: 'sync_state', payload: { quizData: data } });
         }
      });
    }
  }, [isHost, quizData.length]);

  const handlePersistProgress = async (newAnswers, newLocked) => {
    const stats = computeLiveStats(newAnswers || myAnswers, newLocked || myLocked, quizData);
    if (channelRef.current) {
       // Using track() means Supabase handles the efficient distribution to all 100+ peers
      await channelRef.current.track({
        online_at: new Date().toISOString(),
        name: myAvatarName,
        correct: stats.correct,
        totalChecked: stats.totalChecked
      });
    }
  };

  const submitQuiz = () => {
    if (confirm("Submit quiz? Your score will be locked on the multiplayer board.")) {
      setRoomState('finished');
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };

  const totalQs = quizData.reduce((acc, curr) => acc + extractQuestionsFromRow(curr).length, 0);

  if (roomState === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex-col gap-6 text-center px-4 relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        
        <button onClick={() => router.push('/')} className="absolute top-6 left-6 z-10 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm border border-slate-200 shadow-sm">
          <Home size={18}/> Leave Arena
        </button>

        <div className="bg-white/80 backdrop-blur-md p-10 md:p-12 rounded-[2rem] shadow-2xl border border-white max-w-md w-full relative z-10">
          <div className="mb-8 relative">
             <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg rotate-3">
                <Target size={40} className="text-white -rotate-3" />
             </div>
             <div className="absolute top-0 right-[25%] bg-rose-500 w-4 h-4 rounded-full animate-ping"></div>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Arena: {roomId}</h2>
          <p className="text-slate-500 font-medium mb-8 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-indigo-500"/>
            {isHost ? 'Initializing Game Server...' : 'Syncing with Server Host...'}
          </p>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 text-left">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Connected Peers</div>
            <div className="flex flex-wrap gap-2">
              {peers.map((p, i) => (
                <div key={p} className="bg-white border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                  {p === myUuid ? 'You' : `Player ${i+1}`} {p === peers[0] && '(Host)'}
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => navigator.clipboard.writeText(roomId)} className="w-full group flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold py-4 rounded-xl transition-all shadow-sm">
             <Copy size={18} className="group-hover:scale-110 transition-transform"/> Copy Room Code
          </button>
        </div>
      </div>
    );
  }

  if (roomState === 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col p-6">
        <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-xl border border-slate-200/60 max-w-2xl w-full text-center relative">
          <Trophy size={60} className="mx-auto text-yellow-400 mb-6 drop-shadow-md"/>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Match Results</h1>
          <p className="text-slate-500 mb-10 font-medium">Global synchronization complete.</p>
          
          <div className="flex flex-col gap-3 mb-10">
            {leaderboard.map((player, idx) => (
              <div key={player.id} className={`p-5 rounded-2xl border flex justify-between items-center transition-all ${player.isMe ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-4">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${idx === 0 ? 'bg-yellow-100 text-yellow-600' : idx === 1 ? 'bg-slate-100 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>
                     {idx + 1}
                   </div>
                   <span className={`font-bold ${player.isMe ? 'text-indigo-900' : 'text-slate-700'}`}>
                     {player.name} {player.isMe && '(You)'}
                   </span>
                </div>
                <div className="text-right">
                  <div className={`font-extrabold text-xl ${player.isMe ? 'text-indigo-600' : 'text-slate-800'}`}>
                    {player.correct} <span className="text-sm text-slate-400 font-medium">/ {totalQs}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-semibold">{Math.round((player.correct/totalQs)*100 || 0)}% Accuracy</div>
                </div>
              </div>
            ))}
          </div>
          
          <button onClick={() => router.push('/')} className="w-full md:w-auto bg-slate-900 text-white font-bold px-10 py-4 rounded-2xl hover:bg-indigo-600 shadow-md hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mx-auto">
             <Home size={20}/> Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Active Game State
  const myStats = computeLiveStats(myAnswers, myLocked, quizData);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      
      {/* Main Testing Area */}
      <main className="flex-1 relative overflow-y-auto pr-0 lg:pr-[320px] transition-all">
        {viewState === 'selector' ? (
          <TestSelector 
            data={quizData} 
            testId={`Arena Match - ${roomId}`} 
            answers={myAnswers} 
            setViewState={setViewState} 
            setCurrentIndex={setCurrentIndex} 
          />
        ) : (
          <div className="pb-24 lg:pb-0"> {/* padding for mobile leaderboard */}
            <TestPassage 
              data={quizData} 
              testId={`Arena-${roomId}`}
              currentIndex={currentIndex} 
              setCurrentIndex={setCurrentIndex}
              answers={myAnswers} 
              setAnswers={setMyAnswers}
              locked={myLocked} 
              setLocked={setMyLocked}
              setViewState={setViewState} 
              persistProgress={handlePersistProgress}
              submitTest={submitQuiz} 
              extractQuestionsFromRow={extractQuestionsFromRow}
              liveStats={myStats}
            />
          </div>
        )}
      </main>

      {/* Comprehensive Non-Blocking Leaderboard Sidebar */}
      <aside className="hidden lg:flex fixed top-0 right-0 h-screen w-[320px] bg-white border-l border-slate-200 shadow-2xl flex-col z-40">
         <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 mb-1">
              <Activity className="text-indigo-500 animate-pulse" size={24} />
              <h3 className="font-extrabold text-slate-800 text-lg">Live Network</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">Room ID: <span className="text-slate-800 bg-slate-200 px-1.5 py-0.5 rounded">{roomId}</span></p>
         </div>
         
         <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {leaderboard.map((player, idx) => {
               const progressPercent = totalQs > 0 ? (player.totalChecked / totalQs) * 100 : 0;
               return (
                 <div key={player.id} className={`p-4 rounded-2xl border transition-all ${player.isMe ? 'bg-white border-indigo-200 shadow-md ring-2 ring-indigo-500/10' : 'bg-white border-slate-100 shadow-sm'}`}>
                   <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <Medal size={16} className="text-yellow-500"/>}
                        <span className={`font-bold text-sm ${player.isMe ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {player.name} {player.isMe && '(You)'}
                        </span>
                      </div>
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full">
                        {player.correct} pts
                      </span>
                   </div>
                   {/* Progress Indicator */}
                   <div className="w-full bg-slate-100 rounded-full h-2 mb-1 overflow-hidden">
                     <div 
                       className={`h-2 rounded-full transition-all duration-500 ${player.isMe ? 'bg-indigo-500' : 'bg-slate-400'}`} 
                       style={{ width: `${progressPercent}%` }}
                     ></div>
                   </div>
                   <div className="text-[10px] text-slate-400 font-semibold text-right">
                     Completed {player.totalChecked}/{totalQs}
                   </div>
                 </div>
               );
            })}
         </div>

         <div className="p-4 border-t border-slate-100 bg-white">
            <button onClick={submitQuiz} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2">
              Finish Match <ChevronRight size={18}/>
            </button>
         </div>
      </aside>

      {/* Mobile Sticky Top Ribbon (replaces floating widget so it doesn't block text) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 p-3 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-lg"><Trophy size={18} className="text-indigo-600"/></div>
            <div>
              <div className="text-xs font-extrabold text-slate-800">Rank: #{leaderboard.findIndex(p => p.isMe) + 1} of {peers.length}</div>
              <div className="text-[10px] font-semibold text-slate-500">{myStats.correct} Correct / {myStats.totalChecked} Attempted</div>
            </div>
         </div>
         <button onClick={submitQuiz} className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg">
           Finish
         </button>
      </div>

    </div>
  );
}

export default function MultiRoomWrapper({ params }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>}>
      <MultiRoomEngine roomId={params.roomId} />
    </Suspense>
  );
}