import Link from 'next/link';
import { getAvailableTests } from '../lib/githubFetcher';
import { BookOpen, ChevronRight, LayoutDashboard, BarChart3, BrainCircuit } from 'lucide-react';

export default async function Home() {
  const tests = await getAvailableTests();

  return (
    <main className="flex-1 p-6 md:p-12 max-w-6xl mx-auto w-full flex flex-col min-h-screen bg-slate-50 font-sans">
      <header className="mb-12 mt-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-200/60">
        <div className="text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4 justify-center md:justify-start">
            <div className="bg-indigo-50 p-4 rounded-3xl">
              <BrainCircuit className="text-indigo-600" size={48} />
            </div>
            VARC Engine
          </h1>
          <p className="text-slate-500 mt-5 text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
            Select a testing module below. The system utilizes auto-evaluation, dynamic filtering, and live analytics to power your preparation.
          </p>
        </div>
        <Link href="/dashboard" className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-600 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <BarChart3 size={24} /> Dashboard
        </Link>
      </header>

      {tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 text-slate-500 transform hover:scale-[1.01] transition-transform">
          <div className="bg-slate-50 p-6 rounded-full mb-6 shadow-inner border border-slate-100">
            <BookOpen size={48} className="text-slate-300" />
          </div>
          <p className="text-2xl font-bold text-slate-700">No test modules found</p>
          <p className="text-base mt-2">Please populate the target GitHub folder with CSV datasets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
          {tests.map((test) => (
            <Link href={`/test/${encodeURIComponent(test.filename)}`} key={test.filename} className="group h-full">
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/60 hover:shadow-2xl hover:border-indigo-400/50 hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between h-full cursor-pointer overflow-hidden relative">
                <div className="absolute -right-6 -top-6 bg-indigo-50 w-24 h-24 rounded-full group-hover:bg-indigo-600 transition-colors duration-500 ease-out z-0"></div>
                <div className="flex flex-col gap-6 z-10">
                  <div className="bg-indigo-100 p-4 rounded-2xl text-indigo-600 w-fit group-hover:bg-white group-hover:shadow-md transition-all duration-300">
                    <BookOpen size={28} />
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-800 group-hover:text-indigo-900 transition-colors">{test.name}</h2>
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4 z-10">
                   <span className="text-sm font-bold text-slate-400 group-hover:text-indigo-500 transition-colors">Start Module</span>
                   <div className="bg-slate-50 p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
                     <ChevronRight className="text-slate-400 group-hover:text-indigo-600" size={20} />
                   </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      
      <footer className="mt-16 py-6 text-center text-sm text-slate-400 font-bold shrink-0 tracking-widest uppercase">
        Engineered by Arjan Chatterjee
      </footer>
    </main>
  );
}