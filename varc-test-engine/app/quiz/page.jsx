"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, ArrowRight, Home, Users, Globe, Play, Server, Loader2, Activity } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

export default function QuizLobby() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [activeRooms, setActiveRooms] = useState([]);
  const [isFetchingIp, setIsFetchingIp] = useState(true);

  // Fetch Public IP
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
          setIpAddress(data.ip);
          setIsFetchingIp(false);
      })
      .catch(() => {
          setIpAddress(`0.0.0.0-${Math.floor(Math.random() * 1000)}`);
          setIsFetchingIp(false);
      });
  }, []);

  // Listen to Global Directory of Rooms
  useEffect(() => {
    const channel = supabase.channel('global-directory');
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const rooms = [];
      for (const id in state) {
        // Look for presences that have identified as hosts
        const presenceData = state[id][0];
        if (presenceData && presenceData.isHost) {
           rooms.push(presenceData);
        }
      }
      setActiveRooms(rooms);
    }).subscribe();

    return () => {
       supabase.removeChannel(channel);
    };
  }, []);

  const handleHostMulti = async () => {
    if (!hostName.trim()) return alert("Please enter your name to host a quiz.");
    
    // Create an immutable code bound to their Name and IP
    const sanitizedName = hostName.trim().replace(/[^a-zA-Z0-9]/g, '');
    const sanitizedIp = ipAddress.replace(/[^a-zA-Z0-9]/g, '-');
    const roomId = `${sanitizedName}-${sanitizedIp}`.toUpperCase();
    
    // Temporarily broadcast intent so it instantly appears in the directory for others
    const intentChannel = supabase.channel('global-directory');
    await intentChannel.subscribe(async (status) => {
       if(status === 'SUBSCRIBED') {
           await intentChannel.track({
               isHost: true,
               hostName: hostName.trim(),
               ip: ipAddress,
               roomId: roomId,
               createdAt: new Date().toISOString()
           });
       }
    });

    // Send user to their room
    router.push(`/quiz/multi/${roomId}`);
  };

  const handleJoinMulti = (roomId) => {
    router.push(`/quiz/multi/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 items-center justify-center relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
        <Home size={18}/> Back to Home
      </Link>
      
      <div className="max-w-6xl w-full bg-white rounded-[3rem] p-10 md:p-12 shadow-xl border border-slate-200/60 text-center relative overflow-hidden flex flex-col lg:flex-row gap-12">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-50/50 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2"></div>
        
        {/* Left Side: Host Setup */}
        <div className="flex-1 text-left z-10 border-b lg:border-b-0 lg:border-r border-slate-200/60 pb-10 lg:pb-0 lg:pr-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 mb-6">
            <Server size={32} />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">Quiz Protocol</h1>
          <p className="text-slate-500 font-medium text-lg mb-10 leading-relaxed">
            Host a new arena or join an active session. Hosting bounds the room instance to your current network IP.
          </p>

          <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl shadow-inner">
             <h3 className="text-xl font-extrabold text-slate-800 mb-2">Initialize Local Host</h3>
             <p className="text-sm text-slate-500 font-medium mb-6">Your room ID will be securely generated from your connection data.</p>
             
             <div className="space-y-4">
                <div className="relative">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Your Name / Alias</label>
                  <input 
                    type="text" 
                    placeholder="E.g., JohnDoe" 
                    value={hostName} 
                    onChange={e => setHostName(e.target.value)} 
                    className="w-full px-4 py-4 rounded-xl border border-slate-200 bg-white shadow-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all" 
                  />
                </div>

                <div className="relative">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2 block"><Globe size={12}/> Network IP Bound</label>
                  <div className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-mono text-sm flex items-center">
                    {isFetchingIp ? <Loader2 size={16} className="animate-spin text-indigo-500" /> : ipAddress}
                  </div>
                </div>

                <button 
                  onClick={handleHostMulti} 
                  disabled={!hostName.trim() || isFetchingIp}
                  className="w-full mt-4 bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Users size={18}/> Broadcast Server <ArrowRight size={18}/>
                </button>
             </div>
          </div>
        </div>

        {/* Right Side: Active Directory */}
        <div className="flex-[1.2] text-left z-10 flex flex-col h-full min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
             <div>
               <h2 className="text-2xl font-extrabold text-slate-900">Active Directory</h2>
               <p className="text-sm font-medium text-slate-500">Live network hosts currently accepting peers.</p>
             </div>
             <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse">
               <Activity size={12}/> {activeRooms.length} Live
             </span>
          </div>

          <div className="flex-1 bg-slate-50 border border-slate-200/60 rounded-3xl p-4 overflow-y-auto shadow-inner space-y-3">
             {activeRooms.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                 <Globe size={48} className="mb-4 opacity-20" />
                 <p className="font-bold text-lg text-slate-500">No signals detected</p>
                 <p className="text-sm">Wait for a host to broadcast their server, or start your own on the left.</p>
               </div>
             ) : (
               activeRooms.map((room, idx) => (
                 <div key={room.roomId || idx} className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                   <div className="flex items-center gap-4">
                     <div className="bg-indigo-50 p-3 rounded-xl text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                       <Server size={24} />
                     </div>
                     <div>
                       <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                         {room.hostName}'s Arena
                       </h3>
                       <p className="text-xs font-mono text-slate-400 mt-1">Host IP: {room.ip}</p>
                     </div>
                   </div>
                   <button 
                     onClick={() => handleJoinMulti(room.roomId)}
                     className="bg-slate-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-indigo-600 transition-colors flex items-center gap-2 shadow-sm"
                   >
                     Join <Play size={16} fill="currentColor"/>
                   </button>
                 </div>
               ))
             )}
          </div>
        </div>
        
      </div>
    </div>
  );
}