"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getAllFromDB, restoreStore } from '../../lib/db';
import { Home, Download, Upload, Activity, CheckCircle, Clock, Target, BrainCircuit } from 'lucide-react';

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
    setResults(data.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-slate-500 bg-slate-50">
      <Activity className="animate-pulse text-indigo-600" size={56} strokeWidth={2.5}/>
      <span className="font-bold text-xl tracking-wide text-slate-700 animate-pulse">Loading Dashboard...</span>
    </div>
  );

  return (
    <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full flex flex-col font-sans bg-slate-50 min-h-screen">
      <header className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-200/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="z-10 text-center md:text-left">
          <h1 className="text-4xl font-extrabold text-slate-900 flex items-center justify-center md:justify-start gap-4 tracking-tight">
            <Activity className="text-indigo-600 drop-shadow-sm" size={40} /> My Performance
          </h1>
          <p className="text-slate-500 mt-3 text-lg font-medium max-w-xl leading-relaxed">
            Track your progress, view recent test evaluations, and manage your local offline data securely.
          </p>
        </div>
        <div className="flex gap-3 z-10 w-full md:w-auto">
          <Link href="/" className="w-full md:w-auto px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 flex items-center justify-center gap-2 transition-all shadow-md transform hover:-translate-y-1">
            <Home size={18} /> Home
          </Link>
        </div>
      </header>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100/60 rounded-[2rem] p-6 md:p-8 mb-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="text-center md:text-left">
          <h3 className="font-extrabold text-indigo-900 text-xl flex items-center justify-center md:justify-start gap-2 mb-1">
             <Download size={20} className="text-indigo-600"/> Data Management
          </h3>
          <p className="text-sm text-indigo-700 font-medium">Backup your performance records to prevent data loss on device wipe.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 w-full md:w-auto">
          <button onClick={handleBackup} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
            <Download size={18} /> Backup
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleRestore} />
          <button onClick={() => fileInputRef.current.click()} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-6 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-all shadow-sm">
            <Upload size={18} /> Restore
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 px-4">
         <div className="h-8 w-2 bg-emerald-500 rounded-full"></div>
         <h2 className="text-2xl font-extrabold text-slate-800">Recent Evaluations</h2>
      </div>

      {results.length === 0 ? (
        <div className="text-center p-16 bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 text-slate-500 font-medium flex flex-col items-center">
          <div className="bg-slate-50 p-5 rounded-full mb-4">
            <CheckCircle size={40} className="text-slate-300"/>
          </div>
          <span className="text-xl font-bold text-slate-700">No completed tests yet.</span>
          <span className="text-sm mt-2 text-slate-500">Go to the home page and launch a module to get started.</span>
        </div>
      ) : (
        <div className="grid gap-6">
          {results.map((res, i) => {
            const accuracy = res.totalQuestions > 0 ? Math.round((res.correctCount / res.totalQuestions) * 100) || 0 : 0;
            return (
              <div key={i} className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-