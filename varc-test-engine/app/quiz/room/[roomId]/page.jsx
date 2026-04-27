"use client";

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { generateRandomQuiz } from '../../../../lib/quizGenerator';
import TestPassage from '../../../../components/TestPassage';
import TestSelector from '../../../../components/TestSelector';
import { ShieldCheck, Wifi, UserCheck, Copy, Home } from 'lucide-react';

export default function QuizRoom({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role'); 
  const roomId = params.roomId;

  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [quizData, setQuizData] = useState([]);
  
  const [roomState, setRoomState] = useState('waiting'); 
  const [viewState, setViewState] = useState('testing'); 
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [myAnswers, setMyAnswers] = useState({});
  const [myLocked, setMyLocked] = useState({});
  const [peerAnswers, setPeerAnswers] = useState({});
  const [peerLocked, setPeerLocked] = useState({});
  const [peerFinished, setPeerFinished] = useState(false);
  const [myFinished, setMyFinished] = useState(false);

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const dcRef = useRef(null);

  const extractQuestionsFromRow = (row) => {
    const rawQuestionText = row[5] ? String(row[5]).trim() : "";
    if (rawQuestionText === "") {
      return [{ text: String(row[0]).trim(), correctAnswer: row[1] ? String(row[1]).trim() : "", flagsStr: row[6] ? String(row[6]).toLowerCase() : "" }];
    } else {
      const qBlocks = rawQuestionText.split('***').map(s => s.trim());
      const ansBlocks = (row[1] ? String(row[1]) : "").split('***').map(s => s.trim());
      const flagBlocks = (row[6] ? String(row[6]).toLowerCase() : "").split('***').map(s => s.trim());
      return qBlocks.map((qText, i) => ({
        text: qText,
        correctAnswer: ansBlocks[i] || ansBlocks[0] || "",
        flagsStr: flagBlocks[i] || flagBlocks[0] || ""
      }));
    }
  };

  const computeLiveStats = (currentAnswers, currentLocked, currentData) => {
    let correct = 0;
    let totalChecked = 0;
    currentData.forEach((row, pIdx) => {
      const qs = extractQuestionsFromRow(row);
      const pAnswers = currentAnswers[pIdx] || {};
      const pLocked = currentLocked[pIdx] || {};
      qs.forEach((q, qIdx) => {
        if (pLocked[qIdx]) {
          totalChecked++;
          const ans = pAnswers[qIdx];
          const flags = q.flagsStr.split(';').map(f => f.trim());
          const cleanCorrect = String(q.correctAnswer).trim().toLowerCase();
          
          if (flags.includes('mcma')) {
             if (Array.isArray(ans) && ans.every(a => cleanCorrect.includes(String(a).trim().toLowerCase())) && ans.length === q.correctAnswer.replace(/[^1-9A-Za-z]/g,"").length) correct++;
          } else {
             if (String(ans).trim().toLowerCase() === cleanCorrect) correct++;
          }
        }
      });
    });
    return { correct, totalChecked };
  };

  useEffect(() => {
    let isMounted = true;
    
    const initRoom = async () => {
      let generatedQuiz = [];
      if (role === 'host') {
        generatedQuiz = await generateRandomQuiz(5);
        if (isMounted) setQuizData(generatedQuiz);
      }

      // STUN Server config to penetrate NAT networks securely P2P
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;
      
      const channel = supabase.channel(`room-${roomId}`, { config: { presence: { key: role } } });
      channelRef.current = channel;

      const setupDataChannel = (dc) => {
        dc.onopen = () => {
          if (isMounted) setConnectionStatus('connected');
          
          // CRITICAL: Supabase handshake is complete. DISCONNECT FROM SUPABASE entirely.
          // From this point on, all communication is 100% Peer-to-Peer directly over WebRTC.
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }

          if (role === 'host') {
            dc.send(JSON.stringify({ type: 'INIT', data: generatedQuiz }));
            if (isMounted) setRoomState('playing');
          }
        };
        
        dc.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (!isMounted) return;
          
          if (msg.type === 'INIT') {
            setQuizData(msg.data);
            setRoomState('playing');
          } else if (msg.type === 'PROGRESS') {
            setPeerAnswers(msg.answers);
            setPeerLocked(msg.locked);
          } else if (msg.type === 'FINISH') {
            setPeerFinished(true);
          }
        };
      };

      if (role === 'host') {
        setConnectionStatus('waiting');
        dcRef.current = pc.createDataChannel('quiz-engine');
        setupDataChannel(dcRef.current);
      } else {
        setConnectionStatus('connecting');
        pc.ondatachannel = (e) => {
          dcRef.current = e.channel;
          setupDataChannel(dcRef.current);
        };
      }

      // Handle the initial handshake to exchange connection data
      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!isMounted || payload.from === role) return;

        if (payload.type === 'join' && role === 'host') {
           setConnectionStatus('connecting');
           const offer = await pc.createOffer();
           await pc.setLocalDescription(offer);
           channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'offer', sdp: offer, from: role }});
        } 
        else if (payload.type === 'offer' && role === 'join') {
           await pc.setRemoteDescription(payload.sdp);
           const answer = await pc.createAnswer();
           await pc.setLocalDescription(answer);
           channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'answer', sdp: answer, from: role }});
        } 
        else if (payload.type === 'answer' && role === 'host') {
           await pc.setRemoteDescription(payload.sdp);
        } 
        else if (payload.type === 'ice') {
           await pc.addIceCandidate(payload.candidate).catch(e => console.error(e));
        }
      }).subscribe((status) => {
         if (status === 'SUBSCRIBED' && role === 'join') {
            channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'join', from: role } });
         }
      });

      pc.onicecandidate = (e) => {
         if (e.candidate && isMounted && channelRef.current) {
            channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { type: 'ice', candidate: e.candidate, from: role } });
         }
      };
    };

    initRoom();

    return () => {
      isMounted = false;
      pcRef.current?.close();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId, role]);

  const handlePersistProgress = (newAnswers, newLocked) => {
    // Send directly to the peer over the direct connection, no backend server
    if (dcRef.current?.readyState === 'open') {
       dcRef.current.send(JSON.stringify({
         type: 'PROGRESS', answers: newAnswers || myAnswers, locked: newLocked || myLocked
       }));
    }
  };

  const submitQuiz = () => {
    if (confirm("Submit quiz? Your peer will see your final results.")) {
      setMyFinished(true);
      setRoomState('finished');
      if (document.fullscreenElement) document.exitFullscreen();
      if (dcRef.current?.readyState === 'open') {
         dcRef.current.send(JSON.stringify({ type: 'FINISH' }));
      }
    }
  };

  if (roomState === 'waiting' || connectionStatus !== 'connected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-6 text-center px-4 relative">
        <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
          <Home size={18}/> Cancel
        </Link>

        <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-slate-200/60 max-w-sm w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-100"><div className="h-full bg-indigo-500 animate-pulse w-full"></div></div>
          {connectionStatus === 'waiting' ? <ShieldCheck size={56} className="mx-auto text-indigo-500 mb-6"/> : <Wifi size={56} className="mx-auto text-indigo-500 mb-6 animate-pulse"/>}
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Room: {roomId}</h2>
          
          <p className="text-sm text-slate-500 font-medium mb-8">
            {connectionStatus === 'initializing' ? 'Generating Random Subsets...' : 
             connectionStatus === 'waiting' ? 'Waiting for Peer to Join...' : 
             'Establishing WebRTC Tunnel...'}
          </p>

          {role === 'host' && connectionStatus === 'waiting' && (
            <button onClick={() => navigator.clipboard.writeText(roomId)} className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-600 font-bold py-3 rounded-xl border border-slate-200 transition-colors shadow-inner">
               <Copy size={16}/> Copy Code
            </button>
          )}
        </div>
      </div>
    );
  }

  if (roomState === 'finished') {
    const myStats = computeLiveStats(myAnswers, myLocked, quizData);
    const peerStats = computeLiveStats(peerAnswers, peerLocked, quizData);
    const totalQs = quizData.reduce((acc, curr) => acc + extractQuestionsFromRow(curr).length, 0);

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col p-6">
        <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-xl border border-slate-200/60 max-w-2xl w-full text-center relative">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Arena Results</h1>
          <p className="text-slate-500 mb-10 font-medium">{peerFinished ? 'Both peers have submitted their quiz.' : 'Waiting for peer to submit...'}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 shadow-sm relative">
               <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] uppercase font-extrabold tracking-widest px-3 py-1 rounded-full shadow-md">You</div>
               <div className="text-5xl font-black text-indigo-900 mt-4">{myStats.correct}<span className="text-xl text-indigo-400">/{totalQs}</span></div>
               <p className="text-sm font-bold text-indigo-500 mt-2">{Math.round((myStats.correct/(totalQs||1))*100)}% Accuracy</p>
            </div>
            
            <div className={`p-6 rounded-3xl border shadow-sm relative transition-all ${peerFinished ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
               <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-white text-[10px] uppercase font-extrabold tracking-widest px-3 py-1 rounded-full shadow-md ${peerFinished ? 'bg-emerald-600' : 'bg-slate-400'}`}>Peer</div>
               <div className={`text-5xl font-black mt-4 ${peerFinished ? 'text-emerald-900' : 'text-slate-400'}`}>{peerFinished ? peerStats.correct : '?'}<span className={`text-xl ${peerFinished ? 'text-emerald-400' : 'text-slate-300'}`}>/{totalQs}</span></div>
               <p className={`text-sm font-bold mt-2 ${peerFinished ? 'text-emerald-500' : 'text-slate-400'}`}>{peerFinished ? Math.round((peerStats.correct/(totalQs||1))*100) : 0}% Accuracy</p>
            </div>
          </div>
          
          <button onClick={() => router.push('/')} className="w-full md:w-auto bg-slate-900 text-white font-bold px-10 py-4 rounded-2xl hover:bg-indigo-600 shadow-md hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mx-auto">
             <Home size={20}/> Exit Arena
          </button>
        </div>
      </div>
    );
  }

  const myStats = computeLiveStats(myAnswers, myLocked, quizData);
  const peerStats = computeLiveStats(peerAnswers, peerLocked, quizData);

  return (
    <div className="relative h-screen w-full bg-slate-950">
      <div className="fixed top-16 md:top-4 right-4 z-[60] bg-slate-900/95 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 text-[10px] md:text-xs font-bold animate-in fade-in slide-in-from-top-4">
         <span className="flex items-center gap-1.5 text-indigo-400"><UserCheck size={14}/> You: {myStats.correct}/{myStats.totalChecked}</span>
         <div className="w-px h-4 bg-slate-700"></div>
         <span className="flex items-center gap-1.5 text-emerald-400"><Wifi size={14}/> Peer: {peerStats.correct}/{peerStats.totalChecked} {peerFinished && '(Done)'}</span>
      </div>

      {viewState === 'selector' ? (
        <TestSelector 
           data={quizData} testId={`P2P Arena - ${roomId}`} answers={myAnswers} 
           setViewState={setViewState} setCurrentIndex={setCurrentIndex}
        />
      ) : (
        <TestPassage 
          data={quizData}
          testId={`P2P-${roomId}`}
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