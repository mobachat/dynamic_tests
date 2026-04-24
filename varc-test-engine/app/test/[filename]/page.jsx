"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getTestData } from '../../../lib/githubFetcher';
import { saveToDB, getFromDB } from '../../../lib/db';
import { Maximize, ArrowRight, ArrowLeft, CheckCircle, Home, Check, X, Loader2, BookOpen } from 'lucide-react';

export default function TestEngine({ params }) {
  const router = useRouter();
  const testId = params.filename.replace('.csv', '');
  
  const [data, setData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // States: nested to handle multiple questions per page index
  // answers[pageIndex] = { qIndex: 'value' }
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({}); 
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const testRef = useRef(null);

  useEffect(() => {
    async function initializeTest() {
      const testData = await getTestData(params.filename);
      setData(testData);

      const savedResult = await getFromDB('results', testId);
      if (savedResult) {
        setAnswers(savedResult.answers || {});
        setLocked(savedResult.locked || {});
        setIsSubmitted(true);
        setLoading(false);
        return;
      }

      const savedProgress = await getFromDB('progress', testId);
      if (savedProgress) {
        setAnswers(savedProgress.answers || {});
        setLocked(savedProgress.locked || {});
      }

      setLoading(false);
    }
    initializeTest();
  }, [params.filename, testId]);

  const persistProgress = async (newAnswers, newLocked) => {
    await saveToDB('progress', {
      testId: testId,
      answers: newAnswers || answers,
      locked: newLocked || locked,
      lastUpdated: new Date().toISOString()
    });
  };

  // Safe getter/setter for nested states (fortified to handle nulls cleanly)
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
    
    let newSelection = currentSelection.includes(opt) 
      ? currentSelection.filter(item => item !== opt) 
      : [...currentSelection, opt];

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

  const submitTest = async () => {
    if (confirm("Are you sure you want to finish the test?")) {
      await saveToDB('results', {
        testId: testId,
        answers: answers,
        locked: locked,
        completedAt: new Date().toISOString(),
        totalQuestions: data.length
      });
      
      setIsSubmitted(true);
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };

  const enforceFullscreen = async () => {
    try {
      if (document.fullscreenElement) return;
      if (testRef.current?.requestFullscreen) {
        await testRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock("landscape").catch(() => {});
      }
    } catch (err) {
      console.warn("Fullscreen/Orientation lock failed:", err);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4 text-slate-500">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <span className="font-semibold text-lg tracking-wide">Loading Engine...</span>
    </div>
  );
  
  if (data.length === 0) return <div className="flex min-h-screen items-center justify-center font-bold text-rose-500 text-xl">No data found for this test.</div>;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={80} className="text-emerald-500 mb-6 drop-shadow-sm" />
        <h1 className="text-4xl font-extrabold text-slate-800 mb-3">Test Completed!</h1>
        <p className="text-slate-500 mb-10 max-w-md text-lg">Your progress and answers have been securely saved to your local device.</p>
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 hover:shadow-lg transition-all transform hover:-translate-y-1"
        >
          <Home size={22} /> Return to Dashboard
        </button>
      </div>
    );
  }

  const currentItem = data[currentIndex] || [];
  
  // Safe string casting before calling .trim() to prevent numerical crashes
  const rawQuestionText = currentItem[5] ? String(currentItem[5]).trim() : "";
  const isSingleColumn = rawQuestionText === ""; 
  
  const passageText = currentItem[0] ? String(currentItem[0]).trim() : "";

  // Prepare questions payload
  let questionsData = [];

  if (isSingleColumn) {
    // Single column: Everything is in the passage column
    questionsData.push({
      text: passageText,
      correctAnswer: currentItem[1] ? String(currentItem[1]).trim() : "",
      flagsStr: currentItem[6] ? String(currentItem[6]).toLowerCase() : ""
    });
  } else {
    // Two column: Split Questions, Answers, and Flags by ***
    const qBlocks = rawQuestionText.split('***').map(s => s.trim());
    const ansBlocks = (currentItem[1] ? String(currentItem[1]) : "").split('***').map(s => s.trim());
    const flagBlocks = (currentItem[6] ? String(currentItem[6]).toLowerCase() : "").split('***').map(s => s.trim());

    questionsData = qBlocks.map((qText, i) => ({
      text: qText,
      correctAnswer: ansBlocks[i] || ansBlocks[0] || "",
      flagsStr: flagBlocks[i] || flagBlocks[0] || ""
    }));
  }

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
      if (parsed > 0 && parsed <= 10) maxOptions = parsed; // cap limit
    }

    const optionButtons = Array.from({length: maxOptions}, (_, i) => (i + 1).toString());
    
    const pageAnswers = getPageAnswers(currentIndex);
    const pageLocked = getPageLocked(currentIndex);
    
    const qAns = pageAnswers[qIndex];
    const qLocked = pageLocked[qIndex] || false;
    const hasAnswered = qAns !== undefined && qAns !== "" && (Array.isArray(qAns) ? qAns.length > 0 : true);

    return (
      <div key={`opts-${qIndex}`} className="mt-6 bg-slate-50/50 rounded-3xl p-6 border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs mb-5">
          Select Answer {questionsData.length > 1 ? `(Q${qIndex + 1})` : ''}
        </h3>
        
        {/* MCSA */}
        {questionType === 'mcsa' && (
          <div className="flex flex-wrap gap-4">
            {optionButtons.map(opt => {
              const isSelected = qAns === opt;
              const isCorrectAnswer = opt === correctAnswer;
              
              let btnColor = "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 bg-white";
              if (isSelected) btnColor = "border-indigo-600 bg-indigo-600 text-white shadow-lg transform scale-105";
              
              if (qLocked) {
                if (isCorrectAnswer) btnColor = "border-emerald-500 bg-emerald-500 text-white shadow-md ring-4 ring-emerald-50"; 
                else if (isSelected && !isCorrectAnswer) btnColor = "border-rose-500 bg-rose-500 text-white shadow-md ring-4 ring-rose-50"; 
                else btnColor = "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"; 
              }

              return (
                <button 
                  key={opt}
                  onClick={() => handleMcsaSelect(qIndex, opt)}
                  disabled={qLocked}
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 text-lg font-extrabold transition-all duration-200 flex items-center justify-center ${btnColor}`}
                >
                  {qLocked && isCorrectAnswer ? <Check size={26} strokeWidth={3} /> : (qLocked && isSelected ? <X size={26} strokeWidth={3}/> : opt)}
                </button>
              )
            })}
          </div>
        )}

        {/* MCMA */}
        {questionType === 'mcma' && (
          <div className="flex flex-wrap gap-4">
            {optionButtons.map(opt => {
              const isSelected = Array.isArray(qAns) && qAns.includes(opt);
              const isCorrectAnswer = correctAnswer.includes(opt);
              
              let btnColor = "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 bg-white";
              if (isSelected) btnColor = "border-indigo-600 bg-indigo-600 text-white shadow-lg transform scale-105";
              
              if (qLocked) {
                if (isCorrectAnswer) btnColor = "border-emerald-500 bg-emerald-500 text-white shadow-md ring-4 ring-emerald-50"; 
                else if (isSelected && !isCorrectAnswer) btnColor = "border-rose-500 bg-rose-500 text-white shadow-md ring-4 ring-rose-50"; 
                else btnColor = "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"; 
              }

              return (
                <button 
                  key={opt}
                  onClick={() => handleMcmaSelect(qIndex, opt)}
                  disabled={qLocked}
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl border-2 text-lg font-extrabold transition-all duration-200 flex items-center justify-center ${btnColor}`}
                >
                  {qLocked && isCorrectAnswer ? <Check size={26} strokeWidth={3} /> : (qLocked && isSelected ? <X size={26} strokeWidth={3}/> : opt)}
                </button>
              )
            })}
            <div className="w-full text-xs font-semibold text-indigo-400 mt-2 uppercase tracking-wide">Select all that apply</div>
          </div>
        )}

        {/* TextInput */}
        {questionType === 'textinput' && (
          <div className="flex flex-col gap-4">
            <textarea
              value={qAns || ""}
              onChange={(e) => handleTextInput(qIndex, e.target.value)}
              disabled={qLocked}
              placeholder="Type your answer here..."
              className={`w-full p-5 border-2 rounded-2xl focus:border-indigo-600 focus:ring-0 resize-none min-h-[120px] transition-colors ${qLocked ? 'bg-slate-100 border-slate-200 text-slate-500' : 'border-slate-200 shadow-inner text-slate-800'}`}
            />
            {qLocked && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-semibold shadow-sm flex items-center gap-3">
                <CheckCircle size={20} className="text-emerald-500" /> Correct Answer: {correctAnswer}
              </div>
            )}
          </div>
        )}

        {/* Check Answer Button */}
        {hasAnswered && !qLocked && (
          <button 
            onClick={() => handleCheckAnswer(qIndex)}
            className="mt-6 px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95"
          >
            Check Answer
          </button>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={testRef}
      onClick={() => { if (!isFullscreen) enforceFullscreen(); }}
      className="w-full h-screen bg-slate-100 flex flex-col overflow-hidden font-sans select-none text-slate-900"
    >
      <header className="bg-slate-900 text-white p-3 md:p-5 flex justify-between items-center shrink-0 shadow-lg z-10">
        <h1 className="font-bold md:text-lg tracking-wide truncate flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse hidden md:block"></div>
          {testId}
        </h1>
        <div className="flex items-center gap-4">
          <span className="bg-slate-800 px-4 py-1.5 rounded-full text-sm font-mono tracking-widest border border-slate-700">
            {currentIndex + 1} / {data.length}
          </span>
          {!isFullscreen && (
            <button onClick={enforceFullscreen} className="flex items-center gap-2 text-xs bg-indigo-600 px-4 py-2 rounded-full hover:bg-indigo-500 font-bold transition-colors">
              <Maximize size={14}/> Fullscreen
            </button>
          )}
        </div>
      </header>

      {/* Main Layout adjusts based on Single vs Two Column */}
      <main className={`flex-1 flex overflow-hidden p-3 md:p-6 gap-4 md:gap-6 ${isSingleColumn ? 'justify-center items-center' : 'flex-col lg:flex-row'}`}>
        
        {/* PASSAGE PANEL - Only visible if not single column */}
        {!isSingleColumn && (
          <div className="w-full lg:w-1/2 h-[40%] lg:h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-y-auto p-5 md:p-8 scrollbar-thin flex flex-col">
            <h2 className="font-bold text-slate-300 uppercase tracking-widest text-xs mb-6 shrink-0 flex items-center gap-2">
              <BookOpen size={16} /> Passage Context
            </h2>
            <div 
              className="text-base md:text-lg leading-relaxed text-slate-700 whitespace-pre-wrap flex-1" 
              dangerouslySetInnerHTML={{ __html: passageText.replace(/\n/g, '<br/>') }} 
            />
          </div>
        )}

        {/* QUESTIONS & OPTIONS PANEL */}
        <div className={`w-full ${isSingleColumn ? 'max-w-4xl h-full' : 'lg:w-1/2 h-[60%] lg:h-full'} flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-y-auto p-5 md:p-8 scrollbar-thin`}>
          <h2 className="font-bold text-slate-300 uppercase tracking-widest text-xs mb-6 shrink-0 flex items-center gap-2">
             <CheckCircle size={16} /> {isSingleColumn ? 'Question' : 'Questions'}
          </h2>
          
          <div className="flex-1 pb-4">
            {questionsData.map((q, idx) => (
              <div key={idx} className={`${idx !== 0 ? 'mt-10 pt-10 border-t-2 border-slate-100' : ''}`}>
                <div 
                  className="text-lg md:text-xl font-medium text-slate-800 mb-6 whitespace-pre-wrap leading-relaxed" 
                  dangerouslySetInnerHTML={{ __html: q.text.replace(/\n/g, '<br/>') }} 
                />
                {renderOptionsPane(q, idx)}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 p-4 md:p-5 flex justify-between shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-10">
        <button 
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(prev => prev - 1)}
          className="flex items-center gap-2 px-6 py-3 bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={20} /> Prev
        </button>

        {currentIndex === data.length - 1 ? (
          <button 
            onClick={submitTest}
            className="flex items-center gap-3 px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5"
          >
            Finish Test <CheckCircle size={20} />
          </button>
        ) : (
          <button 
            onClick={() => setCurrentIndex(prev => prev + 1)}
            className="flex items-center gap-3 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all transform hover:-translate-y-0.5"
          >
            Next <ArrowRight size={20} />
          </button>
        )}
      </footer>
    </div>
  );
}