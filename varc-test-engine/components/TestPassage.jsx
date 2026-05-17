import { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle, Check, X, Clock, AArrowUp, AArrowDown, List, Activity, Loader2 } from 'lucide-react';

export default function TestPassage({ data, testId, currentIndex, setCurrentIndex, answers, setAnswers, locked, setLocked, setViewState, persistProgress, submitTest, extractQuestionsFromRow, liveStats }) {
  const [fontSize, setFontSize] = useState(18); // Increased default size
  const [passageTimeSpent, setPassageTimeSpent] = useState(0);
  const [questionTimeSpent, setQuestionTimeSpent] = useState({});
  const [splitSize, setSplitSize] = useState(50);
  const [dictBox, setDictBox] = useState(null);
  const [activeQ, setActiveQ] = useState(0);
  const mainRef = useRef(null);
  const leftPaneRef = useRef(null);
  const rightPaneRef = useRef(null);
  const questionRefs = useRef([]);
  const isDragging = useRef(false);

  const currentItem = data[currentIndex] || [];
  const rawQuestionText = currentItem[5] ? String(currentItem[5]).trim() : "";
  const isSingleColumn = rawQuestionText === "";
  const passageText = currentItem[0] ? String(currentItem[0]).trim() : "";
  const questionsData = extractQuestionsFromRow(currentItem);

  const formatText = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  useEffect(() => {
    setPassageTimeSpent(0);
    setActiveQ(0);
    setTimeout(() => {
      if (leftPaneRef.current) leftPaneRef.current.scrollTop = 0;
      if (rightPaneRef.current) rightPaneRef.current.scrollTop = 0;
    }, 10);
  }, [currentIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPassageTimeSpent(prev => prev + 1);
      if (!isSingleColumn && questionsData.length > 0) {
        setQuestionTimeSpent(prev => ({
          ...prev,
          [activeQ]: (prev[activeQ] || 0) + 1
        }));
      } else if (isSingleColumn && questionsData.length > 0) {
        setQuestionTimeSpent(prev => ({
          ...prev,
          [0]: (prev[0] || 0) + 1
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, activeQ, isSingleColumn, questionsData.length]);

  useEffect(() => {
    const enforceFullscreen = async () => {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); } catch (e) {}
      }
    };
    const interactionEvents = ['click', 'touchstart', 'scroll', 'keydown'];
    interactionEvents.forEach(e => document.addEventListener(e, enforceFullscreen, { passive: true }));
    enforceFullscreen();
    return () => {
      interactionEvents.forEach(e => document.removeEventListener(e, enforceFullscreen));
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' && currentIndex < data.length - 1) setCurrentIndex(prev => prev + 1);
      if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };
    let touchStartX = 0;
    const handleTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX; };
    const handleTouchEnd = (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50 && currentIndex < data.length - 1) setCurrentIndex(prev => prev + 1);
      if (touchEndX - touchStartX > 50 && currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentIndex, data.length, setCurrentIndex]);

  useEffect(() => {
    if (isSingleColumn || questionsData.length === 0) return;
    const visibilities = {};
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = Number(entry.target.dataset.index);
        visibilities[idx] = entry.intersectionRatio;
      });
      let maxVisible = -1;
      let bestIndex = activeQ;
      for (const [idx, ratio] of Object.entries(visibilities)) {
        if (ratio > maxVisible && ratio > 0.05) {
          maxVisible = ratio;
          bestIndex = Number(idx);
        }
      }
      if (bestIndex !== activeQ) setActiveQ(bestIndex);
    }, { root: rightPaneRef.current, threshold: [0, 0.25, 0.5, 0.75, 1] });
    
    const timer = setTimeout(() => {
      questionRefs.current.forEach(ref => { if(ref) observer.observe(ref) });
    }, 50);
    return () => { clearTimeout(timer); observer.disconnect(); }
  }, [currentIndex, questionsData.length, isSingleColumn, activeQ]);

  // Dictionary text selection logic (robust cross-device implementation)
  useEffect(() => {
    let timeoutId;
    const handleSelection = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          setDictBox(null);
          return;
        }
        const text = selection.toString().trim();
        if (text && text.length > 2 && text.length < 25 && !text.includes(' ')) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setDictBox(prev => prev && prev.word === text ? prev : { loading: true, word: text, x: rect.left + (rect.width / 2), y: rect.top });
          try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
            if (res.ok) {
              const resData = await res.json();
              const meaning = resData[0]?.meanings[0]?.definitions[0]?.definition;
              if (meaning) setDictBox({ word: text, meaning, x: rect.left + (rect.width / 2), y: rect.top });
              else setDictBox(null);
            } else setDictBox(null);
          } catch (e) { setDictBox(null); }
        } else {
          setDictBox(null);
        }
      }, 400); // 400ms debounce ensures mobile context menus have time to settle
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      clearTimeout(timeoutId);
    };
  }, []);

  const startResize = (e) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onTouchDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  };

  const calculateSplit = (clientX, clientY) => {
    const isDesktop = window.innerWidth >= 1024;
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if (isDesktop || isLandscape) {
      setSplitSize(Math.max(20, Math.min(80, (clientX / window.innerWidth) * 100)));
    } else {
      const usableHeight = window.innerHeight - 60;
      const relativeY = clientY - 60;
      setSplitSize(Math.max(20, Math.min(80, (relativeY / usableHeight) * 100)));
    }
  };

  const onDragMove = (e) => { if (!isDragging.current) return; calculateSplit(e.clientX, e.clientY); };
  const onTouchDragMove = (e) => { if (!isDragging.current) return; e.preventDefault(); calculateSplit(e.touches[0].clientX, e.touches[0].clientY); };
  const onDragEnd = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onTouchDragMove);
    document.removeEventListener('touchend', onDragEnd);
  };

  const getPageAnswers = (idx) => (answers[idx] && typeof answers[idx] === 'object' && !Array.isArray(answers[idx])) ? answers[idx] : { 0: answers[idx] };
  const getPageLocked = (idx) => (locked[idx] && typeof locked[idx] === 'object') ? locked[idx] : { 0: locked[idx] };

  const handleMcsaSelect = (qIndex, opt) => {
    const pageLocked = getPageLocked(currentIndex);
    if (pageLocked[qIndex]) return;
    const pageAnswers = getPageAnswers(currentIndex);
    const newAnswers = { ...answers, [currentIndex]: { ...pageAnswers, [qIndex]: opt } };
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
    const correctCount = String(correctAnswer).split(',').length;
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

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderOptionsPane = (qData, qIndex) => {
    if (!qData) return null;
    const { correctAnswer, flagsStr } = qData;
    
    const flags = flagsStr.split(/[,;]/).map(f => f.trim().toLowerCase());
    const isMcma = String(correctAnswer).includes(',');
    let questionType = isMcma ? 'mcma' : 'mcsa';
    
    if (flags.includes('textinput') || flags.includes('tita')) {
        questionType = 'textinput';
    }
    
    let maxOptions = 4;
    const numFlag = flags.find(f => !isNaN(parseInt(f)) && f.trim() !== "");
    if (numFlag) {
      const parsed = parseInt(numFlag);
      if (parsed > 0 && parsed <= 10) maxOptions = parsed;
    }
    
    let optFormat = 'number';
    const cleanCorrectString = String(correctAnswer).replace(/[^A-Za-z0-9]/g, '');
    if (/[A-Z]/.test(cleanCorrectString)) optFormat = 'upper';
    else if (/[a-z]/.test(cleanCorrectString)) optFormat = 'lower';
    
    const optionButtons = Array.from({length: maxOptions}, (_, i) => {
      if (optFormat === 'upper') return String.fromCharCode(65 + i);
      if (optFormat === 'lower') return String.fromCharCode(97 + i);
      return (i + 1).toString();
    });

    const pageAnswers = getPageAnswers(currentIndex);
    const pageLocked = getPageLocked(currentIndex);
    const qAns = pageAnswers[qIndex];
    const qLocked = pageLocked[qIndex] || false;
    const cleanCorrectArr = String(correctAnswer).split(',').map(s => s.trim().toLowerCase());

    return (
      <div className="w-full bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm p-2 md:p-3 flex items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-indigo-500 uppercase tracking-widest text-[10px] md:text-xs bg-indigo-50 px-2 py-1 rounded-md whitespace-nowrap flex items-center gap-1.5">
            {questionsData.length > 1 ? `Q ${qIndex + 1}` : 'Opts'}
            <span className="bg-white/80 text-slate-500 px-1 rounded flex items-center gap-0.5">
              <Clock size={10} className={questionTimeSpent[qIndex] > 0 ? "animate-pulse" : ""} />
              {formatTime(questionTimeSpent[qIndex] || 0)}
            </span>
          </span>
          {questionType === 'mcma' && !qLocked && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold whitespace-nowrap hidden sm:inline-block">Select Multiple</span>
          )}
        </div>
        
        {(questionType === 'mcsa' || questionType === 'mcma') && (
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 justify-end">
            {optionButtons.map(opt => {
              const cleanOpt = String(opt).trim().toLowerCase();
              const isSelected = questionType === 'mcma'
                ? (Array.isArray(qAns) && qAns.some(a => String(a).trim().toLowerCase() === cleanOpt))
                : String(qAns).trim().toLowerCase() === cleanOpt;
              
              const isCorrectAnswer = questionType === 'mcma'
                ? cleanCorrectArr.includes(cleanOpt)
                : cleanOpt === cleanCorrectArr[0];
              
              let btnColor = "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 bg-white";
              if (isSelected) btnColor = "border-indigo-600 bg-indigo-600 text-white shadow-md transform scale-105";
              
              if (qLocked) {
                if (isCorrectAnswer) btnColor = "border-emerald-500 bg-emerald-500 text-white shadow-md z-10 relative";
                else if (isSelected && !isCorrectAnswer) btnColor = "border-rose-500 bg-rose-500 text-white shadow-sm opacity-80";
                else btnColor = "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed opacity-50";
              }
              
              return (
                <button
                  key={opt}
                  onClick={() => questionType === 'mcma' ? handleMcmaSelect(qIndex, opt, correctAnswer) : handleMcsaSelect(qIndex, opt)}
                  disabled={qLocked}
                  className={`w-8 h-8 md:w-10 md:h-10 ${questionType === 'mcma' ? 'rounded-md' : 'rounded-full'} border md:border-2 text-xs md:text-sm font-extrabold transition-all duration-200 flex items-center justify-center shrink-0 ${btnColor}`}
                >
                  {qLocked && isCorrectAnswer ? <Check size={16} strokeWidth={4} /> : (qLocked && isSelected ? <X size={16} strokeWidth={4}/> : opt)}
                </button>
              )
            })}
          </div>
        )}

        {questionType === 'textinput' && (
          <div className="flex-1 flex flex-col gap-1 ml-2 max-w-sm">
            <div className="relative flex items-center">
              <input
                type="text"
                value={qAns || ""} 
                onChange={(e) => handleTextInput(qIndex, e.target.value)} 
                disabled={qLocked}
                placeholder="Type answer..."
                onKeyDown={(e) => {
                  if(e.key === 'Enter' && qAns && String(qAns).trim() !== '') {
                    e.preventDefault();
                    const newLocked = { ...locked, [currentIndex]: { ...pageLocked, [qIndex]: true } };
                    setLocked(newLocked);
                    persistProgress(answers, newLocked);
                  }
                }}
                className={`w-full p-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-xs md:text-sm transition-all ${
                  qLocked 
                    ? (cleanCorrectArr.includes(String(qAns).trim().toLowerCase()) 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-400 shadow-sm' 
                        : 'bg-rose-50 text-rose-700 border-rose-400 shadow-sm')
                    : 'bg-white shadow-inner focus:border-indigo-500'
                }`}
              />
              
              {/* Submit Button (Only shows when typing and unlocked) */}
              {!qLocked && qAns && String(qAns).trim() !== '' && (
                <button
                  onClick={() => {
                    const newLocked = { ...locked, [currentIndex]: { ...pageLocked, [qIndex]: true } };
                    setLocked(newLocked);
                    persistProgress(answers, newLocked);
                  }}
                  className="absolute right-1.5 p-1 bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-md transition-colors"
                >
                  <Check size={14} strokeWidth={3} />
                </button>
              )}

              {/* Feedback Icons (Only shows when locked) */}
              {qLocked && (
                <div className="absolute right-2">
                  {cleanCorrectArr.includes(String(qAns).trim().toLowerCase()) 
                    ? <CheckCircle size={16} className="text-emerald-500" /> 
                    : <X size={16} className="text-rose-500" />
                  }
                </div>
              )}
            </div>

            {/* Display correct answer if they got it wrong */}
            {qLocked && !cleanCorrectArr.includes(String(qAns).trim().toLowerCase()) && (
               <div className="text-[10px] text-emerald-600 font-extrabold ml-1">
                 Answer: {correctAnswer}
               </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    {/* Removed global select-none to allow deep selection events */}
    <div ref={mainRef} className="w-full h-[100dvh] bg-slate-950 flex flex-col overflow-hidden font-sans relative">
      
      {dictBox && (
        <div 
          className="fixed z-50 bg-slate-900/95 backdrop-blur-xl text-white p-4 rounded-xl shadow-2xl max-w-[250px] md:max-w-sm border border-slate-700/50 animate-in fade-in zoom-in duration-200 transform -translate-x-1/2"
          style={{ left: Math.max(130, Math.min(dictBox.x, window.innerWidth - 130)), top: Math.max(60, dictBox.y - 120) }}
        >
          <button onClick={(e) => { e.stopPropagation(); window.getSelection()?.removeAllRanges(); setDictBox(null); }} className="absolute top-2 right-2 text-slate-400 hover:text-white bg-slate-800 p-1 rounded-full"><X size={12}/></button>
          {dictBox.loading ? (
            <div className="flex justify-center items-center py-4 px-8"><Loader2 className="animate-spin text-indigo-400" size={24} /></div>
          ) : (
            <>
              <div className="font-extrabold text-indigo-400 mb-1 pb-1 mr-4 text-sm md:text-lg border-b border-slate-700/50">{dictBox.word}</div>
              <div className="text-slate-200 leading-snug max-h-32 overflow-y-auto scrollbar-thin text-xs md:text-sm pr-1">{dictBox.meaning}</div>
            </>
          )}
        </div>
      )}

      <header className="text-slate-300 p-2 flex justify-between items-center shrink-0 border-b border-slate-800/80 bg-slate-950 z-40 shadow-md select-none">
        <div className="flex items-center gap-1.5 md:gap-3">
          <button onClick={() => setViewState('selector')} className="hover:bg-slate-800 p-2 rounded-xl border border-slate-700/50 flex items-center gap-1.5 transition-colors">
            <List size={16} /> <span className="hidden md:inline font-bold text-xs">Index</span>
          </button>
          <div className="font-mono bg-slate-900 px-2 py-1.5 rounded-xl text-indigo-400 border border-indigo-500/20 text-[10px] md:text-xs font-bold shadow-inner flex items-center gap-1.5">
            <Clock size={12} className={passageTimeSpent > 0 ? "animate-pulse" : ""} /> {formatTime(passageTimeSpent)}
          </div>
        </div>

        <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700/50 p-0.5 md:p-1">
          <button disabled={currentIndex === 0} onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev - 1); }} className="p-1 md:p-1.5 disabled:opacity-30 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="px-2 md:px-3 font-mono font-bold text-slate-400 tracking-widest text-[10px] md:text-xs">
            {currentIndex + 1}/{data.length}
          </span>
          {currentIndex === data.length - 1 ? (
            <button onClick={(e) => { e.stopPropagation(); submitTest(); }} className="p-1 md:p-1.5 text-emerald-400 hover:bg-emerald-900/30 rounded-lg transition-colors flex items-center gap-1">
              <span className="hidden md:inline text-xs font-bold">Submit</span><CheckCircle size={16} />
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev + 1); }} className="p-1 md:p-1.5 hover:bg-slate-800 rounded-lg text-indigo-400 transition-colors flex items-center gap-1">
              <span className="hidden md:inline text-xs font-bold">Next</span><ArrowRight size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-3">
          {liveStats.totalChecked > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/20 font-bold text-xs shadow-inner">
              <Activity size={14} /> {Math.round((liveStats.correct/liveStats.totalChecked)*100)}%
            </div>
          )}
          <div className="flex items-center gap-1 bg-slate-900 rounded-xl border border-slate-800 p-0.5 md:p-1 shadow-inner">
            <button onClick={(e) => {e.stopPropagation(); setFontSize(f => Math.max(12, f - 2))}} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"><AArrowDown size={14} /></button>
            <div className="w-px h-3 bg-slate-700"></div>
            <button onClick={(e) => {e.stopPropagation(); setFontSize(f => Math.min(36, f + 2))}} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"><AArrowUp size={14} /></button>
          </div>
        </div>
      </header>

      <main 
        style={{ '--split-size': `${splitSize}%` }}
        className={`flex-1 flex overflow-hidden min-h-0 ${isSingleColumn ? 'justify-center items-center p-2' : 'flex-col landscape:flex-row lg:flex-row'}`}
      >
        {!isSingleColumn && (
          <div 
            ref={leftPaneRef}
            className="w-full h-[var(--split-size)] lg:w-[var(--split-size)] landscape:w-[var(--split-size)] landscape:h-full lg:h-full shrink-0 bg-[#FDFCF8] md:m-2 md:rounded-2xl shadow-inner overflow-y-auto p-6 md:p-10 scrollbar-thin relative z-0 select-text"
          >
            {/* Added reading-mode styling: font-serif, relaxed lines, soft colors */}
            <div 
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }}
              className="text-[#2D3748] font-serif tracking-wide whitespace-pre-wrap selection:bg-indigo-200 selection:text-indigo-900 pb-20" 
              dangerouslySetInnerHTML={{ __html: formatText(passageText) }} 
            />
          </div>
        )}

        {!isSingleColumn && (
          <div 
            onMouseDown={startResize} onTouchStart={startResize}
            className="flex w-full h-3 cursor-row-resize lg:w-3 landscape:w-3 landscape:h-full landscape:cursor-col-resize lg:h-full lg:cursor-col-resize hover:bg-indigo-300 active:bg-indigo-400 items-center justify-center shrink-0 z-20 transition-colors bg-slate-200 lg:bg-transparent landscape:bg-transparent"
          >
            <div className="lg:hidden landscape:hidden flex items-center justify-center w-8 h-1 bg-slate-400 rounded-full"></div>
            <div className="hidden lg:flex landscape:flex w-1 h-12 bg-slate-400 rounded-full"></div>
          </div>
        )}

        <div 
          className={`flex-1 bg-white flex flex-col relative min-h-0 ${isSingleColumn ? 'max-w-5xl h-full md:rounded-2xl shadow-inner m-2' : 'w-full h-full md:mr-2 md:my-2 md:rounded-2xl shadow-inner overflow-hidden'}`}
        >
          {!isSingleColumn && questionsData.length > 0 && (
            <div className="sticky top-0 z-30 w-full shrink-0">
              {renderOptionsPane(questionsData[activeQ], activeQ)}
            </div>
          )}

          <div ref={rightPaneRef} className="flex-1 overflow-y-auto p-5 md:p-8 scrollbar-thin scroll-smooth relative select-text">
            {isSingleColumn && questionsData.length > 0 && (
              <div className="sticky top-0 z-30 mb-6 shrink-0 rounded-xl overflow-hidden shadow-sm border border-slate-200">
                {renderOptionsPane(questionsData[activeQ], activeQ)}
              </div>
            )}
            
            {questionsData.map((q, idx) => (
              <div 
                key={idx}
                data-index={idx}
                ref={el => questionRefs.current[idx] = el}
                className={`relative transition-opacity duration-300 ${activeQ === idx ? 'opacity-100' : 'opacity-40'} ${idx !== 0 ? 'mt-12 pt-12 border-t border-slate-100' : ''}`}
              >
                {/* Questions have high-contrast sans-serif styling */}
                <div 
                  style={{ fontSize: `${fontSize}px`, lineHeight: '1.7' }}
                  className="font-medium text-slate-800 whitespace-pre-wrap selection:bg-indigo-200 selection:text-indigo-900" 
                  dangerouslySetInnerHTML={{ __html: formatText(q.text) }} 
                />
              </div>
            ))}
            <div className="h-48 md:h-64 w-full shrink-0"></div>
          </div>
        </div>
      </main>
    </div>
  );
}