"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getAllFromDB, restoreStore } from '../../lib/db';
import { Home, Download, Upload, BarChart2, Trash2, CheckCircle } from 'lucide-react';

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
    e.target.value = ''; // Reset input
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Loading Dashboard...</div>;

  return (
    <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full flex flex-col font-sans">
      <header className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 flex items-center gap-3">
            <BarChart2 className="text-indigo-600" size={36} /> Performance Dashboard
          </h1>
          <p className="text-slate-500 mt-2">Track your progress and manage your local data.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 flex items-center gap-2 transition-all">
            <Home size={18} /> Home
          </Link>
        </div>
      </header>

      {/* Backup & Restore Controls */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-indigo-900 text-lg">Data Management</h3>
          <p className="text-sm text-indigo-700">Backup your performance to prevent data loss on device wipe.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleBackup} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-sm">
            <Download size={18} /> Backup JSON
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleRestore} />
          <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-100 transition-all shadow-sm">
            <Upload size={18} /> Restore JSON
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-3xl shadow-sm border border-slate-200 text-slate-500 font-medium">
          No completed tests yet.
        </div>
      ) : (
        <div className="grid gap-6">
          {results.map((res, i) => {
            // Calculate accuracy dynamically based on total Questions vs saved correct count
            const accuracy = res.totalQuestions > 0 ? Math.round((res.correctCount / res.totalQuestions) * 100) || 0 : 0;
            
            return (
              <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 w-full text-center md:text-left">
                  <h2 className="text-xl font-bold text-slate-800">{res.testId}</h2>
                  <p className="text-sm text-slate-400 mt-1">Completed on: {new Date(res.completedAt).toLocaleString()}</p>
                  {res.timeSpent && <p className="text-sm font-mono text-slate-500 mt-2">Time: {new Date(res.timeSpent * 1000).toISOString().substring(11, 19)}</p>}
                </div>
                
                <div className="w-full md:w-1/2">
                  <div className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                    <span>Score: {res.correctCount || 0} / {res.totalQuestions || 0}</span>
                    <span className={accuracy >= 70 ? 'text-emerald-600' : accuracy >= 40 ? 'text-amber-500' : 'text-rose-500'}>
                      {accuracy}% Accuracy
                    </span>
                  </div>
                  {/* CSS Based Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                    <div 
                      className={`h-3 rounded-full ${accuracy >= 70 ? 'bg-emerald-500' : accuracy >= 40 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${accuracy}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  );
}