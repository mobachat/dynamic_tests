"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getAllFromDB, restoreStore } from '../../lib/db';
import { Home, Download, Upload, Activity, CheckCircle, Clock, Target, BrainCircuit, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getAllFromDB('results');
    setResults(data.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))); // Ascending for charts
    setLoading(false);
  };

  const handleBackup = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `varc-performance-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (!Array.isArray(parsedData)) throw new Error("Invalid format");
        await restoreStore('results', parsedData);
        alert("Data restored successfully!");
        loadData();
      } catch (err) {
        alert("Failed to restore data. Please ensure it is a valid JSON backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  // Compute Aggregates
  const totalTests = results.length;
  const totalQuestions = results.reduce((acc, curr) => acc + (curr.totalQuestions || 0), 0);
  const totalCorrect = results.reduce((acc, curr) => acc + (curr.correctCount || 0), 0);
  const avgAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Chart Data Preparation
  const chartData = results.map((res, i) => {
    const totalQ = res.totalQuestions || 0;
    const correct = res.correctCount || 0;
    const wrong = totalQ - correct;
    const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
    return { name: `T${i + 1}`, testId: res.testId, accuracy, correct, wrong, totalQ };
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-slate-500 bg-slate-50">
      <Activity className="animate-pulse text-indigo-600" size={56} strokeWidth={2.5}/>
      <span className="font-bold text-xl tracking-wide text-slate-700 animate-pulse">Loading Analytics...</span>
    </div>
  );

  return (
    <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col font-sans bg-slate-50 min-h-screen">
      <header className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-6 md:p-10 rounded-[2rem] shadow-sm border border-slate-200/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="z-10 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-center justify-center md:justify-start gap-3 tracking-tight">
            <TrendingUp className="text-indigo-600 drop-shadow-sm" size={32} /> Analytics Dashboard
          </h1>
          <p className="text-slate-500 mt-2 text-base md:text-lg font-medium max-w-xl leading-relaxed">
            Realtime insights, visual trend analysis, and secure local data management.
          </p>
        </div>
        <div className="flex gap-3 z-10 w-full md:w-auto">
          <Link href="/" className="w-full md:w-auto px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-indigo-600 flex items-center justify-center gap-2 transition-all shadow-md transform hover:-translate-y-0.5">
            <Home size={18} /> Home
          </Link>
        </div>
      </header>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
         <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-indigo-50 p-4 rounded-full text-indigo-600"><CheckCircle size={28}/></div>
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tests Taken</p>
              <p className="text-3xl font-extrabold text-slate-800">{totalTests}</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-emerald-50 p-4 rounded-full text-emerald-600"><Target size={28}/></div>
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Questions Attempted</p>
              <p className="text-3xl font-extrabold text-slate-800">{totalQuestions}</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-amber-50 p-4 rounded-full text-amber-600"><Activity size={28}/></div>
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Avg Accuracy</p>
              <p className="text-3xl font-extrabold text-slate-800">{avgAccuracy}%</p>
            </div>
         </div>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Tailwind Native Bar Chart: Accuracy Trend */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-extrabold text-slate-800 mb-6 text-lg">Accuracy Trend</h3>
            <div className="flex-1 flex items-end gap-2 h-48 w-full border-b border-slate-100 pb-2 relative">
              {/* Y-Axis Guidelines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                 <div className="border-t border-slate-400 w-full"></div>
                 <div className="border-t border-slate-400 w-full"></div>
                 <div className="border-t border-slate-400 w-full"></div>
                 <div className="border-t border-slate-400 w-full"></div>
                 <div className="border-t border-slate-400 w-full"></div>
              </div>
              
              {chartData.slice(-15).map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group z-10 h-full justify-end">
                  <div className="w-full max-w-[2.5rem] bg-indigo-50 rounded-t-md relative flex items-end h-full">
                     {/* Tooltip */}
                     <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                       {d.accuracy}%
                     </div>
                     <div 
                       className={`w-full rounded-t-md transition-all duration-500 ${d.accuracy >= 70 ? 'bg-emerald-400' : d.accuracy >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} 
                       style={{ height: `${d.accuracy}%` }}
                     ></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tailwind Native Stacked Progress Bars: Questions Breakdown */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-slate-800 text-lg">Questions Breakdown</h3>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400 rounded-sm"></div> Correct</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-400 rounded-sm"></div> Incorrect</span>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col gap-3 w-full h-48 overflow-y-auto pr-2 scrollbar-thin">
              {chartData.slice().reverse().map((d, i) => (
                 <div key={i} className="flex items-center gap-3 group">
                    <span className="text-[10px] font-bold text-slate-400 w-6 shrink-0">{d.name}</span>
                    <div className="flex-1 h-5 flex rounded-full overflow-hidden bg-slate-100 shadow-inner">
                       <div 
                         className="bg-emerald-400 h-full flex items-center justify-center text-[10px] text-white font-bold transition-all duration-500" 
                         style={{ width: `${(d.correct / d.totalQ) * 100}%` }}
                       >
                         {d.correct > 0 && d.correct}
                       </div>
                       <div 
                         className="bg-rose-400 h-full flex items-center justify-center text-[10px] text-white font-bold transition-all duration-500" 
                         style={{ width: `${(d.wrong / d.totalQ) * 100}%` }}
                       >
                         {d.wrong > 0 && d.wrong}
                       </div>
                    </div>
                 </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data Management Section */}
      <div className="bg-indigo-900 border border-indigo-800 rounded-[2rem] p-6 md:p-8 mb-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
        <div className="text-center md:text-left z-10">
          <h3 className="font-extrabold text-white text-xl flex items-center justify-center md:justify-start gap-2 mb-1">
             <Database size={20} className="text-indigo-400"/> Data Management
          </h3>
          <p className="text-sm text-indigo-200 font-medium">Offline backups are essential for PWAs. Secure your metrics locally.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 w-full md:w-auto z-10">
          <button onClick={handleBackup} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-400 transition-all shadow-md">
            <Download size={18} /> Backup JSON
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleRestore} />
          <button onClick={() => fileInputRef.current.click()} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all shadow-sm">
            <Upload size={18} /> Restore
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 px-2">
         <div className="h-6 w-1.5 bg-slate-800 rounded-full"></div>
         <h2 className="text-xl font-extrabold text-slate-800">Recent Logs</h2>
      </div>

      {results.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-[2rem] shadow-sm border border-slate-200/60 text-slate-500 font-medium">
          <span className="text-lg font-bold text-slate-700 block mb-2">No historical data available.</span>
          <span className="text-sm text-slate-400">Complete a test module to generate analytics.</span>
        </div>
      ) : (
        <div className="grid gap-4">
          {[...results].reverse().map((res, i) => {
            const accuracy = res.totalQuestions > 0 ? Math.round((res.correctCount / res.totalQuestions) * 100) || 0 : 0;
            return (
              <div key={i} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-200/60 flex flex-col md:flex-row gap-5 items-center hover:border-indigo-200 transition-all">
                <div className="flex-1 w-full flex items-center gap-4">
                  <div className="bg-slate-50 text-slate-400 p-3 rounded-xl">
                    <BrainCircuit size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-800 leading-tight">{res.testId}</h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">Logged: {new Date(res.completedAt).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="w-full md:w-auto min-w-[200px] bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                     <Target size={16} className="text-slate-400"/> {res.correctCount || 0}/{res.totalQuestions || 0}
                  </span>
                  <span className={`text-sm font-extrabold px-3 py-1 rounded-md ${accuracy >= 70 ? 'bg-emerald-100 text-emerald-700' : accuracy >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                    {accuracy}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  );
}