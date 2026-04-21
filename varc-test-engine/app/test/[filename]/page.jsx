"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getTestData } from '../../../lib/githubFetcher';
import { saveToDB, getFromDB } from '../../../lib/db';
import { Maximize, ArrowRight, ArrowLeft, CheckCircle, Home } from 'lucide-react';

export default function TestEngine({ params }) {
  const router = useRouter();
  const testId = params.filename.replace('.csv', '');
  
  const [data, setData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const testRef = useRef(null);

  useEffect(() => {
    async function initializeTest() {
      const testData = await getTestData(params.filename);
      setData(testData);

      const savedResult = await getFromDB('results', testId);
      if (savedResult) {
        setAnswers(savedResult.answers);
        setIsSubmitted(true);
        setLoading(false);
        return;
      }

      const savedProgress = await getFromDB('progress', testId);
      if (savedProgress) {
        setAnswers(savedProgress.answers);
        // Optional: jump to first unanswered
        // const firstUnanswered = testData.findIndex((_, idx) => !savedProgress.answers[idx]);
        // if (firstUnanswered !== -1) setCurrentIndex(firstUnanswered);
      }

      setLoading(false);
    }
    initializeTest();
  }, [params.filename, testId]);

  // Unified save function
  const persistProgress = async (newAnswers) => {
    await saveToDB('progress', {
      testId: testId,
      answers: newAnswers,
      lastUpdated: new Date().toISOString()
    });
  };

  // MCSA (Single Answer)
  const handleMcsaSelect = (opt) => {
    const newAnswers = { ...answers, [currentIndex]: opt };
    setAnswers(newAnswers);
    persistProgress(newAnswers);
  };

  // MCMA (Multiple Answer - toggles selections)
  const handleMcmaSelect = (opt) => {
    let currentSelection = answers[currentIndex];
    if (!Array.isArray(currentSelection)) currentSelection = [];
    
    let newSelection;
    if (currentSelection.includes(opt)) {
      newSelection = currentSelection.filter(item => item !== opt); // Remove if already selected
    } else {
      newSelection = [...currentSelection, opt]; // Add if not selected
    }

    const newAnswers = { ...answers, [currentIndex]: newSelection };
    setAnswers(newAnswers);
    persistProgress(newAnswers);
  };

  // Text Input
  const handleTextInput = (text) => {
    const newAnswers = { ...answers, [currentIndex]: text };
    setAnswers(newAnswers);
    persistProgress(newAnswers);
  };

  const submitTest = async () => {
    if (confirm("Are you sure you want to finish the test?")) {
      await saveToDB('results', {
        testId: testId,
        answers: answers,
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

  if (loading) return <div className="flex min-h-screen items-center justify-center font-bold text-gray-500">Loading your test data...</div>;
  if (data.length === 0) return <div className="flex min-h-screen items-center justify-center font-bold text-red-500">No data found for this test.</div>;

  // --- RESULTS SCREEN ---
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={64} className="text-green-500 mb-6" />
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Test Completed!</h1>
        <p className="text-gray-600 mb-8 max-w-md">
          Your answers for <strong>{testId}</strong> have been saved securely on your device.
        </p>
        
        <div className="w-full max-w-2xl bg-white shadow rounded-lg p-6 text-left mb-8 max-h-96 overflow-y-auto">
          <h2 className="font-bold text-lg border-b pb-2 mb-4">Your Responses</h2>
          {data.map((item, idx) => {
            let ans = answers[idx];
            if (Array.isArray(ans)) ans = ans.join(', '); // Format array for MCMA
            return (
              <div key={idx} className="mb-3 flex justify-between border-b border-gray-100 pb-2">
                <span className="font-medium text-gray-700">Q{idx + 1}.</span>
                <span className="text-blue-700 font-semibold">{ans || 'Skipped'}</span>
              </div>
            );
          })}
        </div>

        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
        >
          <Home size={20} /> Back to Dashboard
        </button>
      </div>
    );
  }

  // --- DATA PARSING ---
  const currentItem = data[currentIndex];
  
  // Col A (0): Passage
  const passageText = currentItem[0]?.trim();
  const hasPassage = !!passageText;
  
  // Col B (1): Question & Options Text
  const questionText = currentItem[1];
  
  // Col G (6): Flags
  const flagsStr = currentItem[6] ? currentItem[6].toLowerCase() : "";
  const flags = flagsStr.split(';').map(f => f.trim());
  
  // Default values
  let questionType = 'mcsa'; // mcsa, mcma, textinput
  let maxOptions = 4;
  
  // Parse Flags
  if (flags.includes('mcma')) questionType = 'mcma';
  else if (flags.includes('textinput')) questionType = 'textinput';
  
  const numFlag = flags.find(f => !isNaN(parseInt(f)));
  if (numFlag) maxOptions = parseInt(numFlag);

  // Generate Array for Option Buttons (e.g., ["1", "2", "3", "4"])
  const optionButtons = Array.from({length: maxOptions}, (_, i) => (i + 1).toString());

  return (
    <div 
      ref={testRef}
      onClick={() => { if (!isFullscreen) enforceFullscreen(); }}
      className="w-full h-screen bg-gray-100 flex flex-col overflow-hidden font-sans select-none"
    >
      <header className="bg-blue-800 text-white p-3 md:p-4 flex justify-between items-center shrink-0 shadow-md z-10">
        <h1 className="font-bold md:text-lg truncate">{testId}</h1>
        <div className="flex items-center gap-4">
          <span className="bg-blue-900 px-3 py-1 rounded-full text-sm font-mono tracking-widest shadow-inner">
            {currentIndex + 1} / {data.length}
          </span>
          {!isFullscreen && (
            <button onClick={enforceFullscreen} className="flex items-center gap-2 text-xs bg-blue-700 px-3 py-1 rounded hover:bg-blue-600">
              <Maximize size={14}/> Fullscreen
            </button>
          )}
        </div>
      </header>

      <main className={`flex-1 flex overflow-hidden p-2 md:p-4 gap-2 md:gap-4 ${hasPassage ? 'flex-col md:flex-row' : 'flex-col items-center justify-center'}`}>
        
        {/* PASSAGE PANEL */}
        {hasPassage && (
          <div className="w-full md:w-1/2 h-[40%] md:h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-4 md:p-6 text-sm md:text-base leading-relaxed text-gray-800 whitespace-pre-wrap">
            <h2 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Passage</h2>
            <div dangerouslySetInnerHTML={{ __html: passageText.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {/* QUESTION PANEL */}
        <div className={`w-full ${hasPassage ? 'md:w-1/2 h-[60%] md:h-full' : 'max-w-4xl h-full'} flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-4 md:p-6`}>
          <h2 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Question {currentIndex + 1}</h2>
          
          {/* Question Text (whitespace-pre-wrap preserves your newlines for options) */}
          <div className="text-lg font-medium text-gray-900 mb-8 whitespace-pre-wrap">
            {questionText}
          </div>
          
          {/* DYNAMIC ANSWER PAD */}
          <div className="mt-auto">
            <h3 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Your Answer</h3>
            
            {/* 1. MCSA (Single Choice) */}
            {questionType === 'mcsa' && (
              <div className="flex flex-wrap gap-4">
                {optionButtons.map(opt => {
                  const isSelected = answers[currentIndex] === opt;
                  return (
                    <button 
                      key={opt}
                      onClick={() => handleMcsaSelect(opt)}
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 text-lg font-bold transition-all ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-600 text-white shadow-md transform scale-105' 
                          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {/* 2. MCMA (Multiple Choice) */}
            {questionType === 'mcma' && (
              <div className="flex flex-wrap gap-4">
                {optionButtons.map(opt => {
                  const isSelected = Array.isArray(answers[currentIndex]) && answers[currentIndex].includes(opt);
                  return (
                    <button 
                      key={opt}
                      onClick={() => handleMcmaSelect(opt)}
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 text-lg font-bold transition-all ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-md transform scale-105' 
                          : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
                <div className="w-full text-xs text-indigo-500 mt-1">Select all that apply</div>
              </div>
            )}

            {/* 3. Text Input */}
            {questionType === 'textinput' && (
              <textarea
                value={answers[currentIndex] || ""}
                onChange={(e) => handleTextInput(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-0 resize-none min-h-[120px] transition-colors"
              />
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 p-3 md:p-4 flex justify-between shrink-0">
        <button 
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(prev => prev - 1)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 disabled:opacity-50 rounded font-medium hover:bg-gray-200 transition"
        >
          <ArrowLeft size={18} /> Prev
        </button>

        {currentIndex === data.length - 1 ? (
          <button 
            onClick={submitTest}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow-md transition transform hover:scale-105"
          >
            Finish Test <CheckCircle size={18} />
          </button>
        ) : (
          <button 
            onClick={() => setCurrentIndex(prev => prev + 1)}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-md transition"
          >
            Next <ArrowRight size={18} />
          </button>
        )}
      </footer>
    </div>
  );
}