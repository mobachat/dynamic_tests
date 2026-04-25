"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getTestData } from '../../../lib/githubFetcher';
import { saveToDB, getFromDB } from '../../../lib/db';
import { 
  ArrowRight, ArrowLeft, CheckCircle, Home, Check, X, Loader2, BookOpen, 
  Clock, AArrowUp, AArrowDown, Search, List, Activity, Target, BrainCircuit, Filter
} from 'lucide-react';

export default function TestEngine({ params }) {
  const router = useRouter();
  const testId = decodeURIComponent(params.filename.replace('.csv', ''));
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState('selector');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16); 
  const [timeSpent, setTimeSpent] = useState(0);
  
  // Filters and States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterDiff, setFilterDiff] = useState('All');
  const [dictBox, setDictBox] = useState(null);
  
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({}); 
  
  const mainRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);

  useEffect(() => {
    async function initializeTest() {
      const testData = await getTestData(params.filename);
      setData(testData);

      const savedResult = await getFromDB('results', testId);
      if (savedResult) {
        setAnswers(savedResult.answers || {});
        setLocked(savedResult.locked || {});
        setTimeSpent(savedResult.timeSpent || 0);
        setViewState('submitted');
        setLoading(false);
        return;
      }

      const savedProgress = await getFromDB('progress', testId);
      if (savedProgress) {
        setAnswers(savedProgress.answers || {});
        setLocked(savedProgress.locked || {});
        setTimeSpent(savedProgress.timeSpent || 0);
      }
      setLoading(false);
    }
    initializeTest();
  }, [params.filename, testId]);

  useEffect(() => {
    let interval;
    if (viewState === 'testing') {
      interval = setInterval(() => setTimeSpent(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [viewState]);

  // Dictionary Lookup Listener
  useEffect(() => {
    if (viewState !== 'testing') return;
    const handleSelection = async () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const text = selection.toString().trim();
      
      if (text && text.length > 2 && text.length < 25 && !text.includes(' ')) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        try {
          const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
          if (res.ok) {
            const data = await res.json();
            const meaning = data[0]?.meanings[0]?.definitions[0]?.definition;
            if (meaning) {
              setDictBox({ word: text, meaning, x: rect.left + (rect.width / 2), y: rect.top });
            }
          }
        } catch (e) {}
      } else {
        setDictBox(null);
      }
    };

    document.addEventListener('touchend', handleSelection);
    document.addEventListener('mouseup', handleSelection);
    return () => {
      document.removeEventListener('touchend', handleSelection);
      document.removeEventListener('mouseup', handleSelection);
    };
  }, [viewState]);

  // Swipe Gestures
  const onTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };
  const onTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };
  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const dx = touchStartX.current - touchEndX.current;
    const dy = touchStartY.current - touchEndY.current;
    
    // Determine if it was a horizontal swipe avoiding vertical scrolls
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 75) {
      if (dx > 0 && currentIndex < data.length - 1) setCurrentIndex(prev => prev + 1);
      else if (dx < 0 && currentIndex > 0) setCurrentIndex(prev => prev - 1);
    }
    touchStartX.current = 0; touchEndX.current = 0;
    touchStartY.current = 0; touchEndY.current = 0;
  };

  const persistProgress = async (newAnswers, newLocked) => {
    await saveToDB('progress', {
      testId: testId,
      answers: newAnswers || answers,
      locked: newLocked || locked,
      timeSpent: timeSpent,
      lastUpdated: new Date().toISOString()
    });
  };

  const getPageAnswers = (idx) => (answers[idx] && typeof answers[idx] === 'object' && !Array.isArray(answers[idx])) ? answers[idx] : { 0: answers[idx] };
  const getPageLocked = (idx) => (locked[idx] && typeof locked[idx] === 'object') ? locked[idx] : { 0: locked[idx] };

  // Auto-evaluation logic inside selects
  const handleMcsaSelect = (qIndex, opt) => {
    const pageLocked = getPageLocked(currentIndex);
    if (pageLocked[qIndex]) return;
    const pageAnswers = getPageAnswers(currentIndex);
    const newAnswers = { ...answers, [currentIndex]: { ...pageAnswers, [qIndex]: opt } };
    
    // Automatically verify instantly upon clicking
    const newLocked = { ...locked, [currentIndex]: { ...pageLocked, [qIndex]: true } };
    
    setAnswers(newAnswers);
    setLocked(newLocked);
    persistProgress(newAnswers, newLocked);
  };

  const handleMcmaSelect = (qIndex, opt, correctAnswer) => {
    const pageLocked = getPageLocked(currentIndex);
    if (pageLocked[qIndex]) return;
    const pageAnswers = getPageAnswers(currentIndex);
    let currentSelection = pageAnswers[qIndex];
    if (!Array.isArray(currentSelection)) currentSelection = [];
    let newSelection = currentSelection.includes(opt) ? currentSelection.filter(item => item !== opt) : [...currentSelection, opt];
    
    const newAnswers = { ...answers, [currentIndex]: { ...pageAnswers, [qIndex]: newSelection } };
    let newLocked = locked;
    
    const correctCount = correctAnswer.replace(/[^1-9]/g,"").length;
    // Auto-verify if they selected enough options
    if (newSelection.length === correctCount) {
        newLocked = { ...locked, [currentIndex]: { ...pageLocked, [qIndex]: true } };
        setLocked(newLocked);
    }
    
    setAnswers(newAnswers);
    persistProgress(newAnswers, newLocked);
  };

  const handleTextInput = (qIndex, text) => {
    const pageLocked = getPageLocked(currentIndex);
    if (pageLocked[qIndex]) return;
    const pageAnswers = getPageAnswers(currentIndex);
    const newAnswers = { ...answers, [currentIndex]: { ...pageAnswers, [qIndex]: text } };
    setAnswers(newAnswers);
    persistProgress(newAnswers, locked);
  };

  const extractQuestionsFromRow = (row) => {
    const rawQuestionText = row[5] ? String(row[5]).trim() : "";
    const isSingleColumn = rawQuestionText === ""; 
    const passageText = row[0] ? String(row[0]).trim() : "";

    if (isSingleColumn) {
      return [{ text: passageText, correctAnswer: row[1] ? String(row[1]).trim() : "", flagsStr: row[6] ? String(row[6]).toLowerCase() : "" }];
    } else {
      const qBlocks = rawQuestionText.split('***').map(s => s.trim());
      const ansBlocks = (row[1] ? String(row[1]) : "").split('***').map(s => s.trim());
      const flagBlocks = (row[6] ? String(row[6]).toLowerCase() : "").split('***').map(s => s.trim());
      return qBlocks.map((qText, i) => ({
        text: qText,
        correctAnswer: ansBlocks[i] || ansBlocks[0] || "",
        flagsStr: flagBlocks[i] || flagBlocks[0] || ""
      }));
    }
  };

  const computeLiveStats = () => {
    let correct = 0;
    let totalChecked = 0;
    data.forEach((row, pIdx) => {
      const qs = extractQuestionsFromRow(row);
      const pAnswers = answers[pIdx] || {};
      const pLocked = locked[pIdx] || {};
      qs.forEach((q, qIdx) => {
        if (pLocked[qIdx]) {
          totalChecked++;
          const ans = pAnswers[qIdx];
          const flags = q.flagsStr.split(';').map(f => f.trim());
          if (flags.includes('mcma')) {
             if (Array.isArray(ans) && ans.every(a => q.correctAnswer.includes(a)) && ans.length === q.correctAnswer.replace(/[^1-9]/g,"").length) correct++;
          } else {
             if (String(ans).trim() === q.correctAnswer) correct++;
          }
        }
      });
    });
    return { correct, totalChecked };
  };

  const submitTest = async () => {
    if (confirm("Are you sure you want to finish and evaluate the test?")) {
      const { correct, totalChecked } = computeLiveStats();
      let totalQs = 0;
      data.forEach(row => totalQs += extractQuestionsFromRow(row).length);

      await saveToDB('results', {
        testId: testId,
        answers: answers,
        locked: locked,
        completedAt: new Date().toISOString(),
        totalQuestions: totalQs,
        correctCount: correct,
        timeSpent: timeSpent
      });
      
      setViewState('submitted');
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };

  const handleAggressiveFullscreen = async () => {
    if (viewState !== 'testing') return;
    try {
      if (!document.fullscreenElement && mainRef.current?.requestFullscreen) {
        await mainRef.current.requestFullscreen();
        if (window.screen?.orientation?.lock) {
          await window.screen.orientation.lock("landscape").catch(() => {});
        }
      }
    } catch (e) {} 
  };

  const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substring(11, 19);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4 text-slate-500 bg-slate-50">
      <Loader2 className="animate-spin text-indigo-600" size={56} strokeWidth={2.5}/>
      <span className="font-bold text-xl tracking-wide text-slate-700 animate-pulse">Initializing Engine...</span>
    </div>
  );
  
  if (data.length === 0) return <div className="flex min-h-screen items-center justify-center font-bold text-rose-500 text-xl">No data found.</div>;

  if (viewState === 'submitted') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-12 rounded-[2.5rem] shadow-xl border border-slate-200/60 max-w-lg w-full flex flex-col items-center">
          <Target size={90} className="text-emerald-500 mb-8 drop-shadow-md bg-emerald-50 p-4 rounded-full" />
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Evaluation Complete</h1>
          <p className="text-slate-500 mb-10 text-lg leading-relaxed">Your performance has been successfully evaluated and securely logged in the dashboard.</p>
          <div className="flex gap-4 w-full">
            <button onClick={() => router.push('/')} className="flex-1 flex justify-center items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 hover:shadow-lg transition-all transform hover:-translate-y-1">
              <Home size={22} /> Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'selector') {
    const previews = data.map((row, idx) => {
      const rawQ = row[5] ? String(row[5]).trim() : "";
      const isSingle = rawQ === "";
      let previewText = isSingle ? String(row[0]).trim() : String(row[0]).trim() || rawQ;
      previewText = previewText.replace(/<[^>]*>?/gm, ''); 
      
      const type = row[2] ? String(row[2]).trim() : "Mixed";
      const difficulty = row[3] ? String(row[3]).trim() : "Medium";
      const size = row[4] ? String(row[4]).trim() : "Standard";

      return { 
        idx, 
        text: previewText.substring(0, 150) + '...', 
        hasAnswered: answers[idx] !== undefined && Object.keys(answers[idx] || {}).length > 0,
        type, difficulty, size
      };
    });

    const types = ['All', ...new Set(previews.map(p => p.type).filter(Boolean))];
    const difficulties = ['All', ...new Set(previews.map(p => p.difficulty).filter(Boolean))];

    const filtered = previews.filter(p => {
       if (searchQuery && !p.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
       if (filterType !== 'All' && p.type !== filterType) return false;
       if (filterDiff !== 'All' && p.difficulty !== filterDiff) return false;
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
               <p className="text-slate-500 font-medium mt-2 text-lg">Select a section to begin. Total sections: {data.length}</p>
             </div>
             <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-inner w-full md:w-auto min-w-[320px] transition-all focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
               <Search size={20} className="text-slate-400" />
               <input type="text" placeholder="Search passages..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="outline-none w-full bg-transparent text-slate-700 font-medium placeholder-slate-400" />
             </div>
           </div>
           
           <div className="mt-6 flex gap-4 px-2">
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
          {filtered.length === 0 && <div className="text-center text-slate-400 font-bold p-10">No passages match your filters.</div>}
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
                  <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Passage {item.idx + 1}</div>
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

  const currentItem = data[currentIndex] || [];
  const rawQuestionText = currentItem[5] ? String(currentItem[5]).trim() : "";
  const isSingleColumn = rawQuestionText === ""; 
  const passageText = currentItem[0] ? String(currentItem[0]).trim() : "";
  const questionsData = extractQuestionsFromRow(currentItem);
  const liveStats = computeLiveStats();

  const renderOptionsPane = (qData, qIndex) => {
    const { correctAnswer, flagsStr } = qData;
    const flags = flagsStr.split(';').map(f => f.trim());
    
    let questionType = 'mcsa'; 
    let maxOptions = 4;
    
    if (flags.includes('mcma')) questionType = 'mcma';
    else if (flags.includes('textinput')) questionType = 'textinput';
    
    const numFlag = flags.find(f => !isNaN(parseInt(f)) && f.trim() !== "");
    if (numFlag) {
      const parsed = parseInt(numFlag);
      if (parsed > 0 && parsed <= 10) maxOptions = parsed; 
    }

    const optionButtons = Array.from({length: maxOptions}, (_, i) => (i + 1).toString());
    const pageAnswers = getPageAnswers(currentIndex);
    const pageLocked = getPageLocked(currentIndex);
    const qAns = pageAnswers[qIndex];
    const qLocked = pageLocked[qIndex] || false;

    return (
      <div key={`opts-${qIndex}`} className="mb-5 bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm backdrop-blur-md bg-opacity-90">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <span className="font-extrabold text-slate-400 uppercase tracking-widest text-xs">
                Options {questionsData.length > 1 ? `(Q${qIndex + 1})` : ''}
             </span>
             {questionType === 'mcma' && !qLocked && (
               <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">Multiple Select</span>
             )}
          </div>
          
          {questionType === 'mcsa' && (
            <div className="flex flex-wrap gap-3">
              {optionButtons.map(opt => {
                const isSelected = qAns === opt;
                const isCorrectAnswer = opt === correctAnswer;
                let btnColor = "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 bg-white";
                if (isSelected) btnColor = "border-indigo-600 bg-indigo-600 text-white shadow-lg transform scale-105";
                if (qLocked) {
                  if (isCorrectAnswer) btnColor = "border-emerald-500 bg-emerald-500 text-white shadow-lg scale-105 animate-in zoom-in duration-300"; 
                  else if (isSelected && !isCorrectAnswer) btnColor = "border-rose-500 bg-rose-500 text-white shadow-md animate-shake"; 
                  else btnColor = "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed opacity-50"; 
                }
                return (
                  <button 
                    key={opt} onClick={() => handleMcsaSelect(qIndex, opt)} disabled={qLocked}
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 text-sm md:text-lg font-extrabold transition-all duration-300 flex items-center justify-center ${btnColor}`}
                  >
                    {qLocked && isCorrectAnswer ? <Check size={20} strokeWidth={4} /> : (qLocked && isSelected ? <X size={20} strokeWidth={4}/> : opt)}
                  </button>
                )
              })}
            </div>
          )}

          {questionType === 'mcma' && (
            <div className="flex flex-wrap gap-3">
              {optionButtons.map(opt => {
                const isSelected = Array.isArray(qAns) && qAns.includes(opt);
                const isCorrectAnswer = correctAnswer.includes(opt);
                let btnColor = "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 bg-white";
                if (isSelected) btnColor = "border-indigo-600 bg-indigo-600 text-white shadow-md transform scale-105";
                if (qLocked) {
                  if (isCorrectAnswer) btnColor = "border-emerald-500 bg-emerald-500 text-white shadow-lg scale-105 animate-in zoom-in duration-300"; 
                  else if (isSelected && !isCorrectAnswer) btnColor = "border-rose-500 bg-rose-500 text-white shadow-md animate-shake"; 
                  else btnColor = "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed opacity-50"; 
                }
                return (
                  <button 
                    key={opt} onClick={() => handleMcmaSelect(qIndex, opt, correctAnswer)} disabled={qLocked}
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-xl border-2 text-sm md:text-lg font-extrabold transition-all duration-300 flex items-center justify-center ${btnColor}`}
                  >
                    {qLocked && isCorrectAnswer ? <Check size={20} strokeWidth={4} /> : (qLocked && isSelected ? <X size={20} strokeWidth={4}/> : opt)}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {questionType === 'textinput' && (
          <div className="flex flex-col gap-3 mt-4">
            <textarea
              value={qAns || ""} onChange={(e) => handleTextInput(qIndex, e.target.value)} disabled={qLocked}
              placeholder="Type answer and press Enter to submit..."
              onKeyDown={(e) => {
                 if(e.key === 'Enter') {
                   e.preventDefault();
                   const newLocked = { ...locked, [currentIndex]: { ...pageLocked, [qIndex]: true } };
                   setLocked(newLocked);
                   persistProgress(answers, newLocked);
                 }
              }}
              className={`w-full p-4 border-2 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 resize-none min-h-[80px] text-sm md:text-base transition-all ${qLocked ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-white shadow-inner'}`}
            />
            {qLocked && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <CheckCircle size={18} className="text-emerald-500"/> Correct Answer: {correctAnswer}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={mainRef}
      onClick={handleAggressiveFullscreen}
      className="w-full h-[100dvh] bg-slate-950 flex flex-col overflow-hidden font-sans select-none relative"
    >
      {/* Dictionary Popup overlay */}
      {dictBox && (
        <div 
          className="fixed z-50 bg-slate-900/90 backdrop-blur-xl text-white p-5 rounded-2xl shadow-2xl max-w-xs md:max-w-sm border border-slate-700/50 animate-in fade-in zoom-in duration-200 transform -translate-x-1/2"
          style={{ 
             left: Math.max(160, Math.min(dictBox.x, window.innerWidth - 160)), 
             top: Math.max(70, dictBox.y - 140) 
          }}
        >
           <button onClick={(e) => {e.stopPropagation(); setDictBox(null)}} className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 p-1 rounded-full transition-colors"><X size={14}/></button>
           <div className="font-extrabold text-indigo-400 mb-2 pb-2 mr-6 text-lg border-b border-slate-700/50">{dictBox.word}</div>
           <div className="text-slate-200 leading-relaxed max-h-40 overflow-y-auto scrollbar-thin text-sm pr-2">{dictBox.meaning}</div>
        </div>
      )}

      {/* Modern Header */}
      <header className="text-white p-2 md:p-3 flex justify-between items-center shrink-0 border-b border-slate-800/80 bg-slate-950 z-10 text-[11px] md:text-sm shadow-md">
        <div className="flex items-center gap-2 md:gap-4 ml-1">
          <button onClick={() => setViewState('selector')} className="hover:bg-slate-800 p-1.5 md:p-2 rounded-xl flex items-center gap-2 border border-slate-700 transition-colors font-bold text-slate-300">
            <List size={16} /> <span className="hidden md:inline">Index</span>
          </button>
          <div className="font-mono bg-slate-900 px-3 py-1.5 md:py-2 rounded-xl text-indigo-300 font-bold border border-indigo-500/20 flex items-center gap-2 shadow-inner">
            <Clock size={14} className="text-indigo-400 animate-pulse" /> {formatTime(timeSpent)}
          </div>
        </div>
        
        {/* Live Stats Pill */}
        {liveStats.totalChecked > 0 && (
          <div className="hidden md:flex items-center gap-2 bg-slate-900 text-emerald-400 px-4 py-1.5 rounded-xl border border-emerald-500/20 font-bold shadow-inner">
            <Activity size={16} /> Accuracy: {Math.round((liveStats.correct/liveStats.totalChecked)*100)}% ({liveStats.correct}/{liveStats.totalChecked})
          </div>
        )}

        <div className="flex items-center gap-2 md:gap-4 mr-1">
           <div className="flex items-center gap-1 bg-slate-900 rounded-xl border border-slate-800 p-1">
              <button onClick={(e) => {e.stopPropagation(); setFontSize(f => Math.max(12, f - 2))}} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><AArrowDown size={16} /></button>
              <div className="w-px h-4 bg-slate-700"></div>
              <button onClick={(e) => {e.stopPropagation(); setFontSize(f => Math.min(32, f + 2))}} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><AArrowUp size={16} /></button>
           </div>
           <span className="bg-indigo-600/10 text-indigo-400 px-3 py-1.5 rounded-xl font-mono font-extrabold tracking-widest border border-indigo-500/20 shadow-sm">
            {currentIndex + 1} <span className="text-slate-500">/</span> {data.length}
          </span>
        </div>
      </header>

      {/* Content Area with Landscape Side-by-Side and Swiping */}
      <main 
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        className={`flex-1 flex overflow-hidden p-1 md:p-3 gap-1 md:gap-3 ${isSingleColumn ? 'justify-center items-center' : 'flex-col landscape:flex-row lg:flex-row'}`}
      >
        
        {!isSingleColumn && (
          <div className="w-full lg:w-1/2 landscape:w-1/2 h-[45%] lg:h-full landscape:h-full bg-slate-50 md:rounded-2xl shadow-inner overflow-y-auto p-4 md:p-8 scrollbar-thin relative group">
            <div 
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
              className="text-slate-800 font-medium whitespace-pre-wrap select-text selection:bg-indigo-200" 
              dangerouslySetInnerHTML={{ __html: passageText.replace(/\n/g, '<br/>') }} 
            />
          </div>
        )}

        <div className={`w-full ${isSingleColumn ? 'max-w-5xl h-full' : 'lg:w-1/2 landscape:w-1/2 h-[55%] lg:h-full landscape:h-full'} flex flex-col bg-slate-100 md:rounded-2xl shadow-inner overflow-y-auto p-3 md:p-6 scrollbar-thin`}>
          <div className="flex-1 pb-4">
            {questionsData.map((q, idx) => (
              <div key={idx} className={`${idx !== 0 ? 'mt-8 pt-8 border-t-2 border-slate-200/60' : ''}`}>
                {renderOptionsPane(q, idx)}
                
                <div 
                  style={{ fontSize: `${fontSize}px`, lineHeight: '1.7' }}
                  className="font-bold text-slate-900 mb-3 whitespace-pre-wrap p-2" 
                  dangerouslySetInnerHTML={{ __html: q.text.replace(/\n/g, '<br/>') }} 
                />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="bg-slate-950 border-t border-slate-800/80 p-2 md:p-4 flex justify-between shrink-0 z-10 text-[11px] md:text-sm shadow-md">
        <button 
          disabled={currentIndex === 0}
          onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev - 1); }}
          className="flex items-center gap-2 md:gap-3 px-5 md:px-8 py-2 md:py-3 bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-slate-300 hover:bg-slate-800 border border-slate-700 transition-all shadow-sm"
        >
          <ArrowLeft size={16} /> <span className="hidden md:inline">Previous</span>
        </button>

        {currentIndex === data.length - 1 ? (
          <button 
            onClick={(e) => { e.stopPropagation(); submitTest(); }}
            className="flex items-center gap-2 md:gap-3 px-6 md:px-10 py-2 md:py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 shadow-lg transform transition-all hover:-translate-y-0.5"
          >
            Submit Test <CheckCircle size={18} />
          </button>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev + 1); }}
            className="flex items-center gap-2 md:gap-3 px-6 md:px-10 py-2 md:py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 shadow-lg transform transition-all hover:-translate-y-0.5"
          >
            Next Section <ArrowRight size={16} />
          </button>
        )}
      </footer>
    </div>
  );
}