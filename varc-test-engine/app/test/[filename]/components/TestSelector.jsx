import { useState } from 'react';
import { Search, Filter, Target, CheckCircle, BookOpen, ArrowRight, BrainCircuit, CheckSquare } from 'lucide-react';

export default function TestSelector({ data, testId, answers, setViewState, setCurrentIndex }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterDiff, setFilterDiff] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const previews = data.map((row, idx) => {
    const rawQ = row[5] ? String(row[5]).trim() : "";
    const isSingle = rawQ === "";
    let previewText = isSingle ? String(row[0]).trim() : String(row[0]).trim() || rawQ;
    previewText = previewText.replace(/<[^>]*>?/gm, ''); 
    
    const type = row[2] ? String(row[2]).trim() : "Mixed";
    const difficulty = row[3] ? String(row[3]).trim() : "Medium";

    return { 
      idx, 
      text: previewText.substring(0, 150) + '...', 
      hasAnswered: answers[idx] !== undefined && Object.keys(answers[idx] || {}).length > 0,
      type, difficulty
    };
  });

  const types = ['All', ...new Set(previews.map(p => p.type).filter(Boolean))];
  const difficulties = ['All', ...new Set(previews.map(p => p.difficulty).filter(Boolean))];

  const filtered = previews.filter(p => {
     if (searchQuery && !p.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
     if (filterType !== 'All' && p.type !== filterType) return false;
     if (filterDiff !== 'All' && p.difficulty !== filterDiff) return false;
     if (filterStatus === 'Attempted' && !p.hasAnswered) return false;
     if (filterStatus === 'Unattempted' && p.hasAnswered) return false;
     return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 flex flex-col font-sans">
      <header className="max-w-5xl mx-auto w-full mb-10">
         <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-200/60">
           <div>
             <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
               <BrainCircuit className="text-indigo-600" size={36}/> {testId}
             </h1>
             <p className="text-slate-500 font-medium mt-2 text-lg">Total sections: {data.length}</p>
           </div>
           <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-inner w-full md:w-auto min-w-[320px] transition-all focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
             <Search size={20} className="text-slate-400" />
             <input type="text" placeholder="Search passages..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="outline-none w-full bg-transparent text-slate-700 font-medium placeholder-slate-400" />
           </div>
         </div>
         
         <div className="mt-6 flex flex-wrap gap-4 px-2">
           <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <CheckSquare size={16} className="text-slate-400"/>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-600 cursor-pointer">
                <option value="All">All Statuses</option>
                <option value="Attempted">Attempted</option>
                <option value="Unattempted">Unattempted</option>
              </select>
           </div>
           <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <Filter size={16} className="text-slate-400"/>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-600 cursor-pointer">
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
           </div>
           <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <Target size={16} className="text-slate-400"/>
              <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-600 cursor-pointer">
                {difficulties.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
           </div>
         </div>
      </header>

      <div className="max-w-5xl mx-auto w-full grid gap-5 flex-1">
        {filtered.length === 0 && <div className="text-center text-slate-400 font-bold p-10 bg-white rounded-3xl border border-dashed border-slate-300">No passages match your filters.</div>}
        {filtered.map((item) => (
          <div 
            key={item.idx} 
            onClick={() => { setCurrentIndex(item.idx); setViewState('testing'); }}
            className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 cursor-pointer transition-all duration-300 flex flex-col md:flex-row md:items-center gap-5 group transform hover:-translate-y-1"
          >
            <div className={`p-4 rounded-2xl shrink-0 transition-colors ${item.hasAnswered ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
              {item.hasAnswered ? <CheckCircle size={24} /> : <BookOpen size={24} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Section {item.idx + 1}</div>
                {item.type !== "Mixed" && <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{item.type}</div>}
                {item.difficulty !== "Medium" && <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">{item.difficulty}</div>}
              </div>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-medium">{item.text}</p>
            </div>
            <ArrowRight className="text-slate-300 group-hover:text-indigo-500 self-end md:self-center shrink-0 transition-colors" size={28} />
          </div>
        ))}
      </div>
    </div>
  );
}