"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getTestData } from '@/lib/githubFetcher';
import { saveToDB, getFromDB } from '@/lib/db';
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
        const firstUnanswered = testData.findIndex((_, idx) => !savedProgress.answers[idx]);
        if (firstUnanswered !== -1) setCurrentIndex(firstUnanswered);
      }

      setLoading(false);
    }
    initializeTest();
  }, [params.filename, testId]);

  const handleAnswerSelect = async (opt) => {
    const newAnswers = { ...answers, [currentIndex]: opt };
    setAnswers(newAnswers);
    
    await saveToDB('progress', {
      testId: testId,
      answers: newAnswers,
      lastUpdated: new Date().toISOString()
    });
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
          {data.map((item, idx) => (
            <div key={idx} className="mb-3 flex justify-between border-b border-gray-100 pb-2">
              <span className="font-medium text-gray-700">Q{idx + 1}.</span>
              <span className="text-blue-700 font-semibold">{answers[idx] || 'Skipped'}</span>
            </div>
          ))}
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

  const currentItem = data[currentIndex];
  const passageText = currentItem[0]?.trim();
  const hasPassage = !!passageText;
  const questionText = hasPassage ? currentItem[1] : currentItem[5];
  const optionsStart = hasPassage ? 2 : 6;
  const options = [
    currentItem[optionsStart],
    currentItem[optionsStart + 1],
    currentItem[optionsStart + 2],
    currentItem[optionsStart + 3]
  ].filter(Boolean);

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
        {hasPassage && (
          <div className="w-full md:w-1/2 h-[40%] md:h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-4 md:p-6 text-sm md:text-base leading-relaxed text-gray-800">
            <h2 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Passage</h2>
            <div dangerouslySetInnerHTML={{ __html: passageText.replace(/\n/g, '<br/>') }} />
          </div>
        )}

        <div className={`w-full ${hasPassage ? 'md:w-1/2 h-[60%] md:h-full' : 'max-w-4xl h-full'} flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-4 md:p-6`}>
          <h2 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Question {currentIndex + 1}</h2>
          <p className="text-lg md:text-xl font-medium text-gray-900 mb-6">{questionText}</p>
          
          <div className="flex flex-col gap-3 mt-auto md:mt-0">
            {options.map((opt, idx) => {
              const isSelected = answers[currentIndex] === opt;
              return (
                <button 
                  key={idx}
                  onClick={() => handleAnswerSelect(opt)}
                  className={`p-3 md:p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected 
                      ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold shadow-sm scale-[1.01]' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2 font-bold text-gray-400">{String.fromCharCode(65 + idx)}.</span> {opt}
                </button>
              )
            })}
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