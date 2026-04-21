"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getTestData } from '../../../lib/githubFetcher';
import { saveToDB, getFromDB } from '../../../lib/db';
import { Maximize, ArrowRight, ArrowLeft, CheckCircle, Home, Check, X } from 'lucide-react';

export default function TestEngine({ params }) {
  const router = useRouter();
  const testId = params.filename.replace('.csv', '');
  
  const [data, setData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // States for Persistence & Feedback
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

  const handleMcsaSelect = (opt) => {
    if (locked[currentIndex]) return;
    const newAnswers = { ...answers, [currentIndex]: opt };
    setAnswers(newAnswers);
    persistProgress(newAnswers, locked);
  };

  const handleMcmaSelect = (opt) => {
    if (locked[currentIndex]) return;
    let currentSelection = answers[currentIndex];
    if (!Array.isArray(currentSelection)) currentSelection = [];
    
    let newSelection = currentSelection.includes(opt) 
      ? currentSelection.filter(item => item !== opt) 
      : [...currentSelection, opt];

    const newAnswers = { ...answers, [currentIndex]: newSelection };
    setAnswers(newAnswers);
    persistProgress(newAnswers, locked);
  };

  const handleTextInput = (text) => {
    if (locked[currentIndex]) return;
    const newAnswers = { ...answers, [currentIndex]: text };
    setAnswers(newAnswers);
    persistProgress(newAnswers, locked);
  };

  const handleCheckAnswer = () => {
    const newLocked = { ...locked, [currentIndex]: true };
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

  if (loading) return <div className="flex min-h-screen items-center justify-center font-bold text-gray-500">Loading your test data...</div>;
  if (data.length === 0) return <div className="flex min-h-screen items-center justify-center font-bold text-red-500">No data found for this test.</div>;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={64} className="text-green-500 mb-6" />
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Test Completed!</h1>
        <p className="text-gray-600 mb-8 max-w-md">Your answers have been saved locally.</p>
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
        >
          <Home size={20} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const currentItem = data[currentIndex];
  
  // 1. Column A (Index 0): Passage
  const passageText = currentItem[0]?.trim();
  const hasPassage = !!passageText;
  
  // 2. Correct Answer: Column B (Index 1)
  const correctAnswer = currentItem[1] ? currentItem[1].toString().trim() : "";

  // 3. Question Text: ALWAYS Column F (Index 5)
  const rawQuestionText = currentItem[5];
  const questionBlocks = rawQuestionText ? rawQuestionText.split('***') : ["No question text found."];
  
  // 4. Flags: Column G (Index 6)
  const flagsStr = currentItem[6] ? currentItem[6].toLowerCase() : "";
  const flags = flagsStr.split(';').map(f => f.trim());
  
  // Parse Flags
  let questionType = 'mcsa'; 
  let maxOptions = 4;
  
  if (flags.includes('mcma')) questionType = 'mcma';
  else if (flags.includes('textinput')) questionType = 'textinput';
  
  const numFlag = flags.find(f => !isNaN(parseInt(f)));
  if (numFlag) maxOptions = parseInt(numFlag);

  const optionButtons = Array.from({length: maxOptions}, (_, i) => (i + 1).toString());
  const isQuestionLocked = locked[currentIndex];
  const hasAnswered = answers[currentIndex] !== undefined && answers[currentIndex] !== "" && answers[currentIndex]?.length !== 0;

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
          <div className="w-full md:w-1/2 h-[40%] md:h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-4 md:p-6 text-sm md:text-base leading-relaxed text-gray-800 whitespace-pre-wrap scrollbar-thin">
            <h2 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Passage</h2>
            <div dangerouslySetInnerHTML={{ __html: passageText.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        {/* QUESTION PANEL */}
        <div className={`w-full ${hasPassage ? 'md:w-1/2 h-[60%] md:h-full' : 'max-w-4xl h-full'} flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-4 md:p-6 scrollbar-thin`}>
          <h2 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Question {currentIndex + 1}</h2>
          
          <div className="text-lg font-medium text-gray-900 mb-8 whitespace-pre-wrap">
            {questionBlocks.map((block, idx) => (
              <div key={idx} className={`${idx !== 0 ? 'mt-6 pt-6 border-t border-gray-100' : ''}`}>
                {block.trim()}
              </div>
            ))}
          </div>
          
          <div className="mt-auto">
            <h3 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Your Answer</h3>
            
            {/* MCSA */}
            {questionType === 'mcsa' && (
              <div className="flex flex-wrap gap-4">
                {optionButtons.map(opt => {
                  const isSelected = answers[currentIndex] === opt;
                  const isCorrectAnswer = opt === correctAnswer;
                  
                  let btnColor = "border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700";
                  if (isSelected) btnColor = "border-blue-600 bg-blue-600 text-white shadow-md transform scale-105";
                  
                  if (isQuestionLocked) {
                    if (isCorrectAnswer) btnColor = "border-green-500 bg-green-500 text-white shadow-md"; 
                    else if (isSelected && !isCorrectAnswer) btnColor = "border-red-500 bg-red-500 text-white shadow-md"; 
                    else btnColor = "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"; 
                  }

                  return (
                    <button 
                      key={opt}
                      onClick={() => handleMcsaSelect(opt)}
                      disabled={isQuestionLocked}
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 text-lg font-bold transition-all flex items-center justify-center ${btnColor}`}
                    >
                      {isQuestionLocked && isCorrectAnswer ? <Check size={24} /> : (isQuestionLocked && isSelected ? <X size={24}/> : opt)}
                    </button>
                  )
                })}
              </div>
            )}

            {/* MCMA */}
            {questionType === 'mcma' && (
              <div className="flex flex-wrap gap-4">
                {optionButtons.map(opt => {
                  const isSelected = Array.isArray(answers[currentIndex]) && answers[currentIndex].includes(opt);
                  const isCorrectAnswer = correctAnswer.includes(opt);
                  
                  let btnColor = "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700";
                  if (isSelected) btnColor = "border-indigo-600 bg-indigo-600 text-white shadow-md transform scale-105";
                  
                  if (isQuestionLocked) {
                    if (isCorrectAnswer) btnColor = "border-green-500 bg-green-500 text-white shadow-md"; 
                    else if (isSelected && !isCorrectAnswer) btnColor = "border-red-500 bg-red-500 text-white shadow-md"; 
                    else btnColor = "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"; 
                  }

                  return (
                    <button 
                      key={opt}
                      onClick={() => handleMcmaSelect(opt)}
                      disabled={isQuestionLocked}
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 text-lg font-bold transition-all flex items-center justify-center ${btnColor}`}
                    >
                      {isQuestionLocked && isCorrectAnswer ? <Check size={24} /> : (isQuestionLocked && isSelected ? <X size={24}/> : opt)}
                    </button>
                  )
                })}
                <div className="w-full text-xs text-indigo-500 mt-1">Select all that apply</div>
              </div>
            )}

            {/* TextInput */}
            {questionType === 'textinput' && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={answers[currentIndex] || ""}
                  onChange={(e) => handleTextInput(e.target.value)}
                  disabled={isQuestionLocked}
                  placeholder="Type your answer here..."
                  className={`w-full p-4 border-2 rounded-xl focus:border-blue-600 focus:ring-0 resize-none min-h-[120px] transition-colors ${isQuestionLocked ? 'bg-gray-100 border-gray-300 text-gray-600' : 'border-gray-300'}`}
                />
                {isQuestionLocked && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg font-medium">
                    Correct Answer: {correctAnswer}
                  </div>
                )}
              </div>
            )}

            {/* Check Answer Button */}
            {hasAnswered && !isQuestionLocked && (
              <button 
                onClick={handleCheckAnswer}
                className="mt-6 px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg shadow transition transform hover:scale-105"
              >
                Check Answer
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 p-3 md:p-4 flex justify-between shrink-0 shadow-lg z-10">
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