"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getTestData } from '../../../lib/githubFetcher';
import { saveToDB, getFromDB } from '../../../lib/db';
import { ArrowRight, ArrowLeft, CheckCircle, Home, Check, X, Loader2, BookOpen, Clock, AArrowUp, AArrowDown, Search, List } from 'lucide-react';

export default function TestEngine({ params }) {
  const router = useRouter();
  const testId = params.filename.replace('.csv', '');
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // App Modes: 'selector' | 'testing' | 'submitted'
  const [viewState, setViewState] = useState('selector');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Feature States
  const [fontSize, setFontSize] = useState(16); // Base text size in px
  const [timeSpent, setTimeSpent] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Storage States
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({}); 
  
  const mainRef = useRef(null);

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

  // Timer Hook
  useEffect(() => {
    let interval;
    if (viewState === 'testing') {
      interval = setInterval(() => setTimeSpent(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [viewState]);

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

  const handleMcsaSelect = (qIndex, opt) => {
    const pageLocked = getPageLocked(currentIndex);
    if (pageLocked[qIndex]) return;
    const pageAnswers = getPageAnswers(currentIndex);
    const newAnswers = { ...answers, [currentIndex]: { ...pageAnswers, [qIndex]: opt } };
    setAnswers(newAnswers);
    persistProgress(newAnswers, locked);
  };

  const handleMcmaSelect = (qIndex, opt) => {
    const pageLocked = getPageLocked(currentIndex);
    if (pageLocked[qIndex]) return;
    const pageAnswers = getPageAnswers(currentIndex);
    let currentSelection = pageAnswers[qIndex];
    if (!Array.isArray(currentSelection)) currentSelection = [];
    let newSelection = currentSelection.includes(opt) ? currentSelection.filter(item => item !== opt) : [...currentSelection, opt];
    const newAnswers = { ...answers, [currentIndex]: { ...pageAnswers, [qIndex]: newSelection } };
    setAnswers(newAnswers);
    persistProgress(newAnswers, locked);
  };

  const handleTextInput = (qIndex, text) => {
    const pageLocked = getPageLocked(currentIndex);
    if (pageLocked[qIndex]) return;
    const pageAnswers = getPageAnswers(currentIndex);
    const newAnswers = { ...answers, [currentIndex]: { ...pageAnswers, [qIndex]: text } };
    setAnswers(newAnswers);
    persistProgress(newAnswers, locked);
  };

  const handleCheckAnswer = (qIndex) => {
    const pageLocked = getPageLocked(currentIndex);
    const newLocked = { ...locked, [currentIndex]: { ...pageLocked, [qIndex]: true } };
    setLocked(newLocked);
    persistProgress(answers, newLocked);
  };

  // Helper to extract questions accurately from a data row
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

  const submitTest = async () => {
    if (confirm("Are you sure you want to finish and evaluate the test?")) {
      // Calculate correctness for Dashboard automatically
      let totalQs = 0;
      let correctCount = 0;

      data.forEach((row, pageIdx) => {
        const qs = extractQuestionsFromRow(row);
        const pAnswers = getPageAnswers(pageIdx);
        
        qs.forEach((q, qIdx) => {
          totalQs++;
          const ans = pAnswers[qIdx];
          if (!ans) return;

          const flags = q.flagsStr.split(';').map(f => f.trim());
          if (flags.includes('mcma')) {
            // MCMA strict array check
            const correctArr = q.correctAnswer.split(',').map(s => s.trim()); // Assume comma separated correct answer for mcma? Adjust if exact string match is used.
            if (Array.isArray(ans) && ans.length > 0) {
                const isCorrect = ans.every(a => q.correctAnswer.includes(a)) && ans.length === q.correctAnswer.replace(/[^1-9]/g,"").length;
                if(isCorrect) correctCount++;
            }
          } else {
             // MCSA and text input exact match
            if (String(ans).trim() === q.correctAnswer) correctCount++;
          }
        });
      });

      await saveToDB('results', {
        testId: testId,
        answers: answers,
        locked: locked,
        completedAt: new Date().toISOString(),
        totalQuestions: totalQs,
        correctCount: correctCount,
        timeSpent: timeSpent
      });
      
      setViewState('submitted');
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };

  // Aggressive Fullscreen handler
  const handleAggressiveFullscreen = async () => {
    if (viewState !== 'testing') return;
    try {
      if (!document.fullscreenElement && mainRef.current?.requestFullscreen) {
        await mainRef.current.requestFullscreen();
        if (window.screen?.orientation?.lock) {
          await window.screen.orientation.lock("landscape").catch(() => {});
        }
      }
    } catch (e) {} // Silent catch
  };

  const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substring(11, 19);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4 text-slate-500">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <span className="font-semibold text-lg tracking-wide">Initializing Engine...</span>
    </div>
  );
  if (data.length === 0) return <div className="flex min-h-screen items-center justify-center font-bold text-rose-500 text-xl">No data found.</div>;

  // VIEW: SUBMITTED
  if (viewState === 'submitted') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={80} className="text-emerald-500 mb-6 drop-shadow-sm" />
        <h1 className="text-4xl font-extrabold text-slate-800 mb-3">Test Evaluated!</h1>
        <p className="text-slate-500 mb-10 max-w-md text-lg">Your performance has been evaluated and logged in the dashboard.</p>
        <div className="flex gap-4">
          <button onClick={() => router.push('/')} className="flex items-center gap-3 px-8 py-4 bg-slate-200 text-slate-800 rounded-2xl font-bold hover:bg-slate-300 transition-all">
            <Home size={22} /> Dashboard
          </button>
        </div>
      </div>
    );
  }

  // VIEW: SELECTOR
  if (viewState === 'selector') {
    // Generate preview list
    const previews = data.map((row, idx) => {
      const rawQ = row[5] ? String(row[5]).trim() : "";
      const isSingle = rawQ === "";
      let previewText = isSingle ? String(row[0]).trim() : String(row[0]).trim() || rawQ;
      previewText = previewText.replace(/<[^>]*>?/gm, ''); // strip html
      return { idx, text: previewText.substring(0, 150) + '...', hasAnswered: answers[idx] !== undefined && Object.keys(answers[idx] || {}).length > 0 };
    });

    const filtered = previews.filter(p => p.text.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12 flex flex-col font-sans">
        <header className="max-w-4xl mx-auto w-full mb-10 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
           <div>
             <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{testId}</h1>
             <p className="text-slate-500 font-medium mt-1">Select a section to begin. Total sections: {data.length}</p>
           </div>
           <div className="bg-white border border-slate-200 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm w-full md:w-auto min-w-[300px]">
             <Search size={18} className="text-slate-400" />
             <input type="text" placeholder="Search passages..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="outline-none w-full bg-transparent text-sm font-medium" />
           </div>
        </header>

        <div className="max-w-4xl mx-auto w-full grid gap-4">
          {filtered.map((item) => (
            <div 
              key={item.idx} 
              onClick={() => { setCurrentIndex(item.idx); setViewState('testing'); }}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-400 cursor-pointer transition-all flex items-start gap-4 group"
            >
              <div className={`p-3 rounded-xl shrink-0 transition-colors ${item.hasAnswered ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                {item.hasAnswered ? <CheckCircle size={20} /> : <BookOpen size={20} />}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Passage Index {item.idx + 1}</div>
                <p className="text-slate-700 text-sm leading-relaxed">{item.text}</p>
              </div>
              <ArrowRight className="text-slate-300 group-hover:text-indigo-500 self-center shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // VIEW: TESTING
  const currentItem = data[currentIndex] || [];
  const rawQuestionText = currentItem[5] ? String(currentItem[5]).trim() : "";
  const isSingleColumn = rawQuestionText === ""; 
  const passageText = currentItem[0] ? String(currentItem[0]).trim() : "";
  const questionsData = extractQuestionsFromRow(currentItem);

  // Helper to render an individual Option Pane for a specific question
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
    const hasAnswered = qAns !== undefined && qAns !== "" && (Array.isArray(qAns) ? qAns.length > 0 : true);

    return (
      <div key={`opts-${qIndex}`} className="mt-4 bg-slate-50/70 rounded-2xl p-4 md:p-5 border border-slate-100">
        <h3 className="font-bold text-slate-400 uppercase tracking-widest text-[10px] md:text-xs mb-3">
          Select Answer {questionsData.length > 1 ? `(Q${qIndex + 1})` : ''}
        </h3>
        
        {questionType === 'mcsa' && (
          <div className="flex flex-wrap gap-3">
            {optionButtons.map(opt => {
              const isSelected = qAns === opt;
              const isCorrectAnswer = opt === correctAnswer;
              let btnColor = "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 bg-white";
              if (isSelected) btnColor = "border-indigo-600 bg-indigo-600 text-white shadow-md transform scale-105";
              if (qLocked) {
                if (isCorrectAnswer) btnColor = "border-emerald-500 bg-emerald-500 text-white shadow-md"; 
                else if (isSelected && !isCorrectAnswer) btnColor = "border-rose-500 bg-rose-500 text-white shadow-md"; 
                else btnColor = "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"; 
              }
              return (
                <button 
                  key={opt} onClick={() => handleMcsaSelect(qIndex, opt)} disabled={qLocked}
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-2 text-base md:text-lg font-extrabold transition-all duration-200 flex items-center justify-center ${btnColor}`}
                >
                  {qLocked && isCorrectAnswer ? <Check size={22} strokeWidth={3} /> : (qLocked && isSelected ? <X size={22} strokeWidth={3}/> : opt)}
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
                if (isCorrectAnswer) btnColor = "border-emerald-500 bg-emerald-500 text-white shadow-md"; 
                else if (isSelected && !isCorrectAnswer) btnColor = "border-rose-500 bg-rose-500 text-white shadow-md"; 
                else btnColor = "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"; 
              }
              return (
                <button 
                  key={opt} onClick={() => handleMcmaSelect(qIndex, opt)} disabled={qLocked}
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl border-2 text-base md:text-lg font-extrabold transition-all duration-200 flex items-center justify-center ${btnColor}`}
                >
                  {qLocked && isCorrectAnswer ? <Check size={22} strokeWidth={3} /> : (qLocked && isSelected ? <X size={22} strokeWidth={3}/> : opt)}
                </button>
              )
            })}
          </div>
        )}

        {questionType === 'textinput' && (
          <div className="flex flex-col gap-3">
            <textarea
              value={qAns || ""} onChange={(e) => handleTextInput(qIndex, e.target.value)} disabled={qLocked}
              placeholder="Type answer..."
              className={`w-full p-4 border-2 rounded-xl focus:border-indigo-600 resize-none min-h-[80px] text-sm md:text-base ${qLocked ? 'bg-slate-100 text-slate-500' : 'bg-white shadow-inner'}`}
            />
            {qLocked && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold text-sm flex items-center gap-2">
                <CheckCircle size={16} /> Correct: {correctAnswer}
              </div>
            )}
          </div>
        )}

        {hasAnswered && !qLocked && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleCheckAnswer(qIndex); }}
            className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow transition-all active:scale-95 text-sm md:text-base"
          >
            Check Answer
          </button>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={mainRef}
      onClick={handleAggressiveFullscreen}
      className="w-full h-screen bg-slate-900 flex flex-col overflow-hidden font-sans select-none"
    >
      {/* MINIMALIST HEADER */}
      <header className="text-white p-1 md:p-2 flex justify-between items-center shrink-0 border-b border-slate-800 bg-slate-900 z-10 text-xs md:text-sm">
        <div className="flex items-center gap-2 md:gap-4 ml-1 md:ml-2">
          <button onClick={() => setViewState('selector')} className="hover:bg-slate-800 p-1.5 md:p-2 rounded-lg flex items-center gap-2 transition-colors border border-slate-700">
            <List size={16} /> <span className="hidden md:inline font-semibold">Selector</span>
          </button>
          <div className="font-mono bg-slate-800 px-3 py-1 rounded-md text-slate-300 font-bold border border-slate-700 flex items-center gap-2">
            <Clock size={14} className="text-indigo-400" /> {formatTime(timeSpent)}
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 mr-1 md:mr-2">
           {/* FONT CONTROLS */}
           <div className="flex items-center gap-1 bg-slate-800 rounded-md border border-slate-700 p-0.5">
              <button onClick={(e) => {e.stopPropagation(); setFontSize(f => Math.max(12, f - 2))}} className="p-1 hover:bg-slate-700 rounded text-slate-300 transition-colors"><AArrowDown size={18} /></button>
              <div className="w-px h-4 bg-slate-700"></div>
              <button onClick={(e) => {e.stopPropagation(); setFontSize(f => Math.min(32, f + 2))}} className="p-1 hover:bg-slate-700 rounded text-slate-300 transition-colors"><AArrowUp size={18} /></button>
           </div>
           <span className="bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded-md font-mono font-bold tracking-widest border border-indigo-500/30">
            {currentIndex + 1}/{data.length}
          </span>
        </div>
      </header>

      {/* MAXIMIZED MAIN CONTENT - Almost no outer margins */}
      <main className={`flex-1 flex overflow-hidden p-1 md:p-2 gap-1 md:gap-2 ${isSingleColumn ? 'justify-center items-center' : 'flex-col lg:flex-row'}`}>
        
        {!isSingleColumn && (
          <div className="w-full lg:w-1/2 h-[45%] lg:h-full bg-white rounded-lg md:rounded-xl shadow-inner overflow-y-auto p-3 md:p-6 scrollbar-thin">
            <div 
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.7' }}
              className="text-slate-800 whitespace-pre-wrap" 
              dangerouslySetInnerHTML={{ __html: passageText.replace(/\n/g, '<br/>') }} 
            />
          </div>
        )}

        <div className={`w-full ${isSingleColumn ? 'max-w-5xl h-full' : 'lg:w-1/2 h-[55%] lg:h-full'} flex flex-col bg-slate-50 rounded-lg md:rounded-xl shadow-inner overflow-y-auto p-3 md:p-6 scrollbar-thin`}>
          <div className="flex-1 pb-4">
            {questionsData.map((q, idx) => (
              <div key={idx} className={`${idx !== 0 ? 'mt-8 pt-8 border-t-2 border-slate-200' : ''}`}>
                <div 
                  style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
                  className="font-medium text-slate-900 mb-4 whitespace-pre-wrap" 
                  dangerouslySetInnerHTML={{ __html: q.text.replace(/\n/g, '<br/>') }} 
                />
                {renderOptionsPane(q, idx)}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* MINIMALIST FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 p-2 md:p-3 flex justify-between shrink-0 z-10">
        <button 
          disabled={currentIndex === 0}
          onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev - 1); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
        >
          <ArrowLeft size={18} /> Prev
        </button>

        {currentIndex === data.length - 1 ? (
          <button 
            onClick={(e) => { e.stopPropagation(); submitTest(); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/50 transition-all active:scale-95"
          >
            Submit <CheckCircle size={18} />
          </button>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev + 1); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 transition-all active:scale-95"
          >
            Next <ArrowRight size={18} />
          </button>
        )}
      </footer>
    </div>
  );
}