import Link from 'next/link';
import { getAvailableTests } from '../lib/githubFetcher';
import { BookOpen, ChevronRight, BarChart3, BrainCircuit, Sparkles, Activity } from 'lucide-react';

export default async function Home() {
  const tests = await getAvailableTests();

  return (
    <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full flex flex-col min-h-screen bg-slate-50 font-sans">
      <header className="mb-14 mt-6 flex flex-col md:flex-row items-center justify-between gap-8 bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-200/60 relative overflow-hidden">
        {/* Decorative Background Gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="text-center md:text-left z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-6">
            <Sparkles size={14} /> Next-Gen Testing
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4 justify-center md:justify-start">
            <BrainCircuit className="text-indigo-600 drop-shadow-sm" size={56} />
            VARC Engine
          </h1>
          <p className="text-slate-500 mt-6 text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
            Elevate your preparation with our high-performance testing environment. Featuring auto-evaluation, dynamic filtering, and localized analytics.
          </p>
        </div>
        <div className="z-10">
            <Link href="/dashboard" className="flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-200 transition-all duration-300 transform hover:-translate-y-1 w-full md:w-auto">
            <Activity size={24} /> My Dashboard
            </Link>
        </div>
      </header>

      <div className="flex items-center gap-3 mb-8 px-4">
         <div className="h-8 w-2 bg-indigo-600 rounded-full"></div>
         <h2 className="text-2xl font-extrabold text-slate-800">Available Modules</h2>
         <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-sm font-bold ml-2">{tests.length}</span>
      </div>

      {tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 text-slate-500">
          <div className="bg-slate-50 p-6 rounded-full mb-6 shadow-inner border border-slate-100">
            <BookOpen size={48} className="text-slate-300" />
          </div>
          <p className="text-2xl font-bold text-slate-700">No modules found</p>
          <p className="text-base mt-2">Please populate the GitHub repository with CSV datasets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 flex-1">
          {tests.map((test) => (
            <Link href={`/test/${encodeURIComponent(test.filename)}`} key={test.filename} className="group h-full">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200/60 hover:shadow-2xl hover:border-indigo-400/50 hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between h-full cursor-pointer relative overflow-hidden">
                <div className="absolute -right-10 -top-10 bg-gradient-to-br from-indigo-50 to-purple-50 w-32 h-32 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out z-0"></div>
                <div className="flex flex-col gap-5 z-10">
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl text-indigo-600 w-fit shadow-sm group-hover:shadow-md transition-all duration-300">
                    <BookOpen size={24} />
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-800 group-hover:text-indigo-900 transition-colors leading-tight">{test.name}</h2>
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5 z-10">
                   <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-wider">Launch Test</span>
                   <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-indigo-100 transition-colors">
                     <ChevronRight className="text-slate-400 group-hover:text-indigo-600" size={18} />
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