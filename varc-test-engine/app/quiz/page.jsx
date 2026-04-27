"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, LogIn, ArrowRight, Home } from 'lucide-react';
import Link from 'next/link';

export default function QuizLobby() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  const handleHost = () => {
    // Generate a random 6 character room code
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/quiz/room/${roomId}?role=host`);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim().length > 0) {
      router.push(`/quiz/room/${joinCode.toUpperCase().trim()}?role=join`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 items-center justify-center relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
        <Home size={18}/> Back to Home
      </Link>
      
      <div className="max-w-4xl w-full bg-white rounded-[3rem] p-10 md:p-16 shadow-xl border border-slate-200/60 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-50/50 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2"></div>

        <Swords size={64} className="mx-auto text-indigo-600 mb-6" />
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">P2P Quiz Arena</h1>
        <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto mb-16">
          Challenge a peer to a synchronized test. Data flows directly between your browsers using WebRTC.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
          <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-3xl flex flex-col items-center justify-between shadow-inner transform hover:-translate-y-1 transition-all group">
             <div className="bg-white p-4 rounded-full shadow-sm text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
               <Swords size={32} />
             </div>
             <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Host Quiz</h2>
             <p className="text-sm text-slate-500 font-medium mb-8">Generate a randomized test and invite a peer via Room Code.</p>
             <button onClick={handleHost} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-indigo-500 hover:shadow-xl transition-all flex items-center justify-center gap-2">
               Create Room <ArrowRight size={18}/>
             </button>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-3xl flex flex-col items-center justify-between shadow-inner transform hover:-translate-y-1 transition-all group">
             <div className="bg-white p-4 rounded-full shadow-sm text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
               <LogIn size={32} />
             </div>
             <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Join Quiz</h2>
             <p className="text-sm text-slate-500 font-medium mb-8">Enter a room code provided by a host to connect directly via WebRTC.</p>
             <form onSubmit={handleJoin} className="w-full relative">
               <input 
                 type="text" 
                 placeholder="Enter Room Code" 
                 value={joinCode}
                 onChange={e => setJoinCode(e.target.value.toUpperCase())}
                 className="w-full px-4 py-4 rounded-xl border border-emerald-200 bg-white shadow-sm font-extrabold text-center text-slate-800 tracking-widest uppercase focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                 maxLength={6}
               />
               <button type="submit" disabled={joinCode.length < 3} className="absolute right-2 top-2 bottom-2 bg-emerald-600 text-white px-4 rounded-lg font-bold disabled:opacity-50 hover:bg-emerald-500 transition-colors flex items-center justify-center">
                  Join
               </button>
             </form>
          </div>
        </div>
      </div>
    </div>
  );
}