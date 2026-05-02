"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, LogIn, ArrowRight, Home, Users } from 'lucide-react';
import Link from 'next/link';

export default function QuizLobby() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joinMultiCode, setJoinMultiCode] = useState("");

  const handleHost = () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/quiz/room/${roomId}?role=host`);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim().length > 0) {
      router.push(`/quiz/room/${joinCode.toUpperCase().trim()}?role=join`);
    }
  };

  const handleHostMulti = () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/quiz/multi/${roomId}`);
  };

  const handleJoinMulti = (e) => {
    e.preventDefault();
    if (joinMultiCode.trim().length > 0) {
      router.push(`/quiz/multi/${joinMultiCode.toUpperCase().trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 items-center justify-center relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
        <Home size={18}/> Back to Home
      </Link>
      
      <div className="max-w-5xl w-full bg-white rounded-[3rem] p-10 md:p-12 shadow-xl border border-slate-200/60 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-50/50 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2"></div>
        
        <Swords size={64} className="mx-auto text-indigo-600 mb-4" />
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-2">Quiz Arenas</h1>
        <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto mb-10">
          Challenge peers in real-time environments. Select an arena format below.
        </p>

        <div className="flex flex-col gap-12 z-10 w-full relative">
          
          <div className="w-full">
            <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-6">1v1 WebRTC Arena</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-indigo-50/80 border border-indigo-100 p-6 rounded-3xl flex flex-col items-center shadow-inner group">
                <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Host 1v1</h3>
                <p className="text-sm text-slate-500 font-medium mb-6">Invite one peer via direct WebRTC tunnel.</p>
                <button onClick={handleHost} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-indigo-500 hover:shadow-xl transition-all flex items-center justify-center gap-2">
                  Create Room <ArrowRight size={18}/>
                </button>
              </div>
              <div className="bg-emerald-50/80 border border-emerald-100 p-6 rounded-3xl flex flex-col items-center shadow-inner group">
                <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Join 1v1</h3>
                <p className="text-sm text-slate-500 font-medium mb-6">Enter code provided by the 1v1 host.</p>
                <form onSubmit={handleJoin} className="w-full relative">
                  <input type="text" placeholder="Enter Code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} className="w-full px-4 py-4 rounded-xl border border-emerald-200 bg-white shadow-sm font-extrabold text-center text-slate-800 tracking-widest uppercase focus:ring-4 focus:ring-emerald-100 outline-none transition-all" maxLength={6} />
                  <button type="submit" disabled={joinCode.length < 3} className="absolute right-2 top-2 bottom-2 bg-emerald-600 text-white px-4 rounded-lg font-bold disabled:opacity-50 hover:bg-emerald-500 transition-colors">Join</button>
                </form>
              </div>
            </div>
          </div>

          <div className="w-full border-t border-slate-200/60 pt-10">
            <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-6 flex justify-center items-center gap-2"><Users size={20}/> Multiplayer (Star Topology)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-purple-50/80 border border-purple-100 p-6 rounded-3xl flex flex-col items-center shadow-inner group">
                <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Host Multi</h3>
                <p className="text-sm text-slate-500 font-medium mb-6">Automatic Host Migration & Synchronization.</p>
                <button onClick={handleHostMulti} className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-purple-500 hover:shadow-xl transition-all flex items-center justify-center gap-2">
                  Create Star Room <ArrowRight size={18}/>
                </button>
              </div>
              <div className="bg-amber-50/80 border border-amber-100 p-6 rounded-3xl flex flex-col items-center shadow-inner group">
                <h3 className="text-2xl font-extrabold text-slate-800 mb-2">Join Multi</h3>
                <p className="text-sm text-slate-500 font-medium mb-6">Enter code to join a multiplayer star network.</p>
                <form onSubmit={handleJoinMulti} className="w-full relative">
                  <input type="text" placeholder="Enter Code" value={joinMultiCode} onChange={e => setJoinMultiCode(e.target.value.toUpperCase())} className="w-full px-4 py-4 rounded-xl border border-amber-200 bg-white shadow-sm font-extrabold text-center text-slate-800 tracking-widest uppercase focus:ring-4 focus:ring-amber-100 outline-none transition-all" maxLength={6} />
                  <button type="submit" disabled={joinMultiCode.length < 3} className="absolute right-2 top-2 bottom-2 bg-amber-500 text-white px-4 rounded-lg font-bold disabled:opacity-50 hover:bg-amber-400 transition-colors">Join</button>
                </form>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}