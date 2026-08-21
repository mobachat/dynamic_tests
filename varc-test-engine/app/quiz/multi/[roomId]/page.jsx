"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { getAvailableTests, getTestData } from '../../../../lib/githubFetcher';
import TestPassage from '../../../../components/TestPassage';
import TestSelector from '../../../../components/TestSelector';
import { ShieldCheck, Wifi, Users, Copy, Home, Loader2, Star, Settings, Play } from 'lucide-react';

function MultiRoomEngine({ roomId }) {
  const router = useRouter();
  
  // Unique session ID for this peer
  const myUuid = useMemo(() => Math.random().toString(36).substring(2, 15), []);
  
  const [peers, setPeers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [roomState, setRoomState] = useState('waiting'); // waiting, setup, playing, finished
  const [viewState, setViewState] = useState('testing');
  
  // Quiz & Progress State
  const [quizData, setQuizData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [myAnswers, setMyAnswers] = useState({});
  const [myLocked, setMyLocked] = useState({});
  const [globalStats, setGlobalStats] = useState({});

  // Host Setup State
  const [availableModules, setAvailableModules] = useState([]);
  const [setupConfig, setSetupConfig] = useState({
    passageCount: 5,
    module: 'Random',
    type: 'All',
    difficulty: 'All'
  });

  const channelRef = useRef(null);
  const dirChannelRef = useRef(null);

  // --- 1. Prevent Reconnections using State Refs ---
  const stateRef = useRef({ isHost, roomState, quizData });
  useEffect(() => {
    stateRef.current = { isHost, roomState, quizData };
  }, [isHost, roomState, quizData]);

  // --- 2. Helper Functions ---
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

  // --- 3. Supabase Synchronization & Topology ---
  useEffect(() => {
    let isMounted = true;
    const channel = supabase.channel(`multi-${roomId}`, { config: { presence: { key: myUuid } } });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      if (!isMounted) return;
      const state = channel.presenceState();
      const userIds = Object.keys(state).sort();
      setPeers(userIds);
      
      // Host Election: Oldest UUID in the room becomes the Host
      if (userIds.length > 0 && userIds[0] === myUuid && !stateRef.current.isHost) {
        setIsHost(true);
        if (stateRef.current.roomState === 'waiting') setRoomState('setup');
      }
    });

    channel.on('broadcast', { event: 'sync_state' }, ({ payload }) => {
      if (!isMounted) return;
      
      // Receive quiz data from host
      if (payload.quizData && payload.quizData.length > 0 && stateRef.current.quizData.length === 0) {
        setQuizData(payload.quizData);
        setRoomState('playing');
      }
      
      // Receive peer progress
      if (payload.progress) {
        setGlobalStats(prev => ({ ...prev, [payload.from]: payload.progress }));
      }
    });

    // Handle sync requests from late-joining clients
    channel.on('broadcast', { event: 'request_sync' }, () => {
      const { isHost: refHost, roomState: refState, quizData: refData } = stateRef.current;
      if (refHost && refState === 'playing' && refData.length > 0) {
        channel.send({ type: 'broadcast', event: 'sync_state', payload: { quizData: refData, from: myUuid } });
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
         await channel.track({ online_at: new Date().toISOString() });
         // Ask the host for the current state just in case we joined after the game started
         channel.send({ type: 'broadcast', event: 'request_sync' });
      }
    });

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [roomId, myUuid]);

  // --- 4. Global Directory Broadcast (Active Arenas) ---
  useEffect(() => {
    if (!isHost) {
      if (dirChannelRef.current) {
        dirChannelRef.current.unsubscribe();
        dirChannelRef.current = null;
      }
      return;
    }

    // Initialize the directory channel if it doesn't exist
    if (!dirChannelRef.current) {
      dirChannelRef.current = supabase.channel('global-directory', { 
        config: { presence: { key: roomId } } 
      });
      
      dirChannelRef.current.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await dirChannelRef.current.track({ 
            roomId, 
            state: roomState, 
            peers: peers.length 
          });
        }
      });
    } else if (dirChannelRef.current.state === 'JOINED') {
      // If already joined, just update the tracked presence data to reflect changes
      dirChannelRef.current.track({ 
        roomId, 
        state: roomState, 
        peers: peers.length 
      });
    }
  }, [isHost, roomId, roomState, peers.length]);

  // Clean up directory broadcast entirely if we leave the page
  useEffect(() => {
    return () => {
      if (dirChannelRef.current) {
        dirChannelRef.current.unsubscribe();
      }
    };
  }, []);

  // --- 5. Host Setup Logic ---
  useEffect(() => {
    if (isHost && roomState === 'setup') {
      getAvailableTests().then(tests => {
        setAvailableModules(tests || []);
      });
    }
  }, [isHost, roomState]);

  const handleStartArena = async () => {
    if (!isHost) return;

    let rawData = [];
    if (setupConfig.module === 'Random') {
      const tests = await getAvailableTests();
      for (const t of tests) {
        const d = await getTestData(t.filename);
        if (d) rawData = rawData.concat(d);
      }
    } else {
      rawData = await getTestData(setupConfig.module);
    }

    // Apply strict filters before shuffling
    let filtered = rawData.filter(row => {
      const type = row[2] ? String(row[2]).trim() : "Mixed";
      const diff = row[3] ? String(row[3]).trim() : "Medium";
      
      if (setupConfig.type !== 'All' && type !== setupConfig.type) return false;
      if (setupConfig.difficulty !== 'All' && diff !== setupConfig.difficulty) return false;
      return true;
    });

    // Shuffle and slice to exact requested count
    const finalData = filtered.sort(() => 0.5 - Math.random()).slice(0, setupConfig.passageCount);

    if (finalData.length === 0) {
      alert("No questions found matching these filters. Please adjust the settings.");
      return;
    }

    setQuizData(finalData);
    setRoomState('playing');
    
    // Broadcast the generated arena to all peers immediately
    channelRef.current.send({ 
      type: 'broadcast', 
      event: 'sync_state', 
      payload: { quizData: finalData, from: myUuid } 
    });
  };

  // Host interval sync to catch clients who joined but missed the 'request_sync' message
  useEffect(() => {
    if (isHost && quizData.length > 0 && roomState === 'playing') {
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

  // --- 6. Render Functions ---
  if (roomState === 'waiting' || roomState === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-6 p-4 relative">
        <button onClick={() => router.push('/')} className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
          <Home size={18}/> Cancel
        </button>

        <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-slate-200/60 max-w-lg w-full relative overflow-hidden">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
             <div>
               <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Arena: {roomId}</h2>
               <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1 flex items-center gap-1"><Users size={14}/> {peers.length} Connected</p>
             </div>
             <button onClick={() => navigator.clipboard.writeText(roomId)} className="p-3 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors">
               <Copy size={20}/>
             </button>
          </div>

          {isHost ? (
            <div className="flex flex-col gap-5 animate-in fade-in">
              <div className="flex items-center gap-2 text-slate-700 font-extrabold mb-2">
                <Settings size={20} className="text-indigo-500"/> Arena Configuration
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Module</label>
                <select value={setupConfig.module} onChange={e => setSetupConfig({...setupConfig, module: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100">
                  <option value="Random">All Modules (Randomized)</option>
                  {availableModules.map(m => (
                    <option key={m.filename} value={m.filename}>{m.folder} - {m.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Length</label>
                  <select value={setupConfig.passageCount} onChange={e => setSetupConfig({...setupConfig, passageCount: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none">
                    <option value={1}>1 Passage</option>
                    <option value={3}>3 Passages</option>
                    <option value={5}>5 Passages</option>
                    <option value={10}>10 Passages</option>
                    <option value={25}>25 Passages</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Difficulty</label>
                  <select value={setupConfig.difficulty} onChange={e => setSetupConfig({...setupConfig, difficulty: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none">
                    <option value="All">Mixed</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <button onClick={handleStartArena} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                 <Play size={18} fill="currentColor"/> Deploy Arena
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in-95">
              <Loader2 size={48} className="text-indigo-400 animate-spin mb-6" />
              <h3 className="text-lg font-extrabold text-slate-800">Awaiting Host Protocol</h3>
              <p className="text-sm text-slate-500 font-medium mt-2">The room host is currently configuring the parameters for this arena. The test will begin automatically.</p>
            </div>
          )}
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
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center shadow-sm">
               <span className="font-extrabold text-indigo-900 flex items-center gap-2"><Star size={16}/> You {isHost && '(Host)'}</span>
               <span className="font-bold text-indigo-600">{myStats.correct} / {totalQs} Correct</span>
            </div>
            {Object.entries(globalStats).map(([id, stats], idx) => (
              <div key={id} className="p-4 rounded-xl border bg-slate-50 border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-600 text-sm">Peer #{idx + 1} {peers[0] === id && '(Host)'}</span>
                <span className="font-bold text-slate-500">{stats.correct} / {totalQs} Correct</span>
              </div>
            ))}
          </div>
          
          <button onClick={() => router.push('/')} className="w-full md:w-auto bg-slate-900 text-white font-bold px-10 py-4 rounded-2xl hover:bg-indigo-600 shadow-md hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mx-auto">
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
           <span className="text-indigo-400">Multi Network</span>
           <span className="bg-slate-800 px-2 rounded-full text-[9px]">{peers.length} Peers</span>
         </div>
         <span className="flex items-center gap-1.5 text-indigo-100"><Users size={12}/> You: {myStats.correct}/{myStats.totalChecked}</span>
         {Object.entries(globalStats).slice(0, 3).map(([id, stats], i) => (
           <span key={id} className="flex items-center gap-1.5 text-slate-400"><Wifi size={12}/> Peer {i+1}: {stats.correct}/{stats.totalChecked}</span>
         ))}
      </div>
      
      {viewState === 'selector' ? (
        <TestSelector 
           data={quizData} 
           testId={`Star Arena - ${roomId}`} 
           answers={myAnswers} 
           setViewState={setViewState} 
           setCurrentIndex={setCurrentIndex} 
         />
      ) : (
        <TestPassage 
           data={quizData} 
           testId={`Multi-${roomId}`}
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
      )}
    </div>
  );
}

export default function MultiRoomWrapper({ params }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48}/></div>}>
      <MultiRoomEngine roomId={params.roomId} />
    </Suspense>
  );
}