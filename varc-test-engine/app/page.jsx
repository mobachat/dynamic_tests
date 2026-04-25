import Link from 'next/link';
import { getAvailableTests } from '../lib/githubFetcher';
import { BookOpen, ChevronRight, Activity, Database, Zap } from 'lucide-react';

export default async function Home() {
  const tests = await getAvailableTests();

  return (
    <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col min-h-screen bg-slate-50 font-sans">
      <header className="mb-10 mt-4 flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-6 md:p-10 rounded-[2rem] shadow-sm border border-slate-200/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="text-center md:text-left z-10 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-[10px] uppercase tracking-widest mb-4">
            <Zap size={12} /> Next-Gen Platform
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 justify-center md:justify-start">
            VARC Engine
          </h1>
          <p className="text-slate-500 mt-4 text-base md:text-lg max-w-xl font-medium leading-relaxed">
            High-performance testing environment with dynamic filtering, auto-evaluation, and realtime analytics.
          </p>
        </div>
        <div className="z-10 w-full md:w-auto flex flex-col gap-3">
            <Link href="/dashboard" className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-xl font-bold text-sm hover:bg-indigo-600 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
              <Activity size={18} /> View Analytics
            </Link>
        </div>
      </header>

      <div className="flex items-center justify-between mb-6 px-2">
         <div className="flex items-center gap-3">
           <div className="h-6 w-1.5 bg-indigo-600 rounded-full"></div>
           <h2 className="text-xl font-extrabold text-slate-800">Available Modules</h2>
           <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-xs font-bold ml-1">{tests.length}</span>
         </div>
      </div>

      {tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] shadow-sm border border-slate-200/60 text-slate-500">
          <Database size={32} className="text-slate-300 mb-4" />
          <p className="text-lg font-bold text-slate-700">No modules found</p>
          <p className="text-sm mt-1">Populate your GitHub repository with CSV datasets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 flex-1 pb-10">
          {tests.map((test) => (
            <Link href={`/test/${encodeURIComponent(test.filename)}`} key={test.filename} className="group h-full">
              <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-200/60 hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-full cursor-pointer relative overflow-hidden">
                <div className="absolute -right-8 -top-8 bg-gradient-to-br from-indigo-50 to-purple-50 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
                
                <div className="flex items-start gap-4 z-10">
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-indigo-500 shrink-0 shadow-sm group-hover:bg-indigo-50 transition-colors">
                    <BookOpen size={20} />
                  </div>
                  <h2 className="text-base font-bold text-slate-800 group-hover:text-indigo-900 transition-colors leading-snug mt-1">
                    {test.name}
                  </h2>
                </div>
                
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 z-10">
                   <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">Launch</span>
                   <div className="bg-slate-50 p-1.5 rounded-lg group-hover:bg-indigo-100 transition-colors">
                     <ChevronRight className="text-slate-400 group-hover:text-indigo-600" size={16} />
                   </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}