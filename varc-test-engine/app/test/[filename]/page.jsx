"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTestData } from '../../../lib/githubFetcher';
import { saveToDB, getFromDB } from '../../../lib/db';
import { Target, Home, Loader2 } from 'lucide-react';

// We will create these two components in the next steps
import TestSelector from '../../../components/TestSelector';
import TestPassage from '../../../components/TestPassage';

export default function TestEngine({ params }) {
  const router = useRouter();
  const testId = decodeURIComponent(params.filename.replace('.csv', ''));
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState('selector');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({}); 

  useEffect(() => {
    async function initializeTest() {
      const testData = await getTestData(params.filename);
      setData(testData);

      const savedResult = await getFromDB('results', testId);
      if (savedResult) {
        setAnswers(savedResult.answers || {});
        setLocked(savedResult.locked || {});
        setViewState('submitted');
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

  const extractQuestionsFromRow = (row) => {
    const rawQuestionText = row[5] ? String(row[5]).trim() : "";
    if (rawQuestionText === "") {
      return [{ text: String(row[0]).trim(), correctAnswer: row[1] ? String(row[1]).trim() : "", flagsStr: row[6] ? String(row[6]).toLowerCase() : "" }];
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
             if (Array.isArray(ans) && ans.every(a => q.correctAnswer.includes(a)) && ans.length === q.correctAnswer.replace(/[^1-9A-Za-z]/g,"").length) correct++;
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
      });
      
      setViewState('submitted');
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };

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
    return (
      <TestSelector 
         data={data}
         testId={testId}
         answers={answers}
         setViewState={setViewState}
         setCurrentIndex={setCurrentIndex}
      />
    );
  }

  return (
    <TestPassage 
      data={data}
      testId={testId}
      currentIndex={currentIndex}
      setCurrentIndex={setCurrentIndex}
      answers={answers}
      setAnswers={setAnswers}
      locked={locked}
      setLocked={setLocked}
      setViewState={setViewState}
      persistProgress={persistProgress}
      submitTest={submitTest}
      extractQuestionsFromRow={extractQuestionsFromRow}
      liveStats={computeLiveStats()}
    />
  );
}