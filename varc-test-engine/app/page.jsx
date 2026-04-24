import Link from 'next/link';
import { getAvailableTests } from '../lib/githubFetcher';
import { BookOpen, ChevronRight, LayoutDashboard, BarChart3 } from 'lucide-react';

export default async function Home() {
  const tests = await getAvailableTests();

  return (
    <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full flex flex-col">
      <header className="mb-10 mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 justify-center md:justify-start">
            <LayoutDashboard className="text-indigo-600" size={40} />
            VARC Engine
          </h1>
          <p className="text-slate-500 mt-3 text-lg max-w-xl">
            Select a test module below to begin. The engine will automatically optimize your display.
          </p>
        </div>
        <Link href="/dashboard" className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-600 hover:shadow-lg transition-all transform hover:-translate-y-1">
          <BarChart3 size={20} /> My Performance
        </Link>
      </header>

      {tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-sm border border-slate-200/60 text-slate-500">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <BookOpen size={32} className="text-slate-400" />
          </div>
          <p className="text-lg font-medium">No tests found</p>
          <p className="text-sm mt-1">Please check the GitHub "testdata" folder.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
          {tests.map((test) => (
            <Link href={`/test/${test.filename}`} key={test.filename} className="group h-full">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 hover:shadow-xl hover:border-indigo-500/30 hover:-translate-y-1 transition-all duration-300 flex items-center justify-between h-full cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-50 p-3.5 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                    <BookOpen size={24} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 group-hover:text-indigo-900 transition-colors">{test.name}</h2>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" size={20} />
              </div>
            </Link>
          ))}
        </div>
      )}
      
      {/* Subtle Credits */}
      <footer className="mt-12 py-4 text-center text-xs text-slate-400 font-medium shrink-0 tracking-wide">
        created by - Arjan Chatterjee
      </footer>
    </main>
  );
}