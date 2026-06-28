import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gavel, Mic, Send, Square, RotateCcw, Sparkles,
  CheckCircle2, AlertCircle, ChevronRight, Award, Square as StopIcon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiService, fetchAIResponse } from '../../services/aiService';
import { subscribeToCases, type CaseDocument } from '../../services/caseService';
import { auth } from '../../auth';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Exchange {
  id: string;
  judgeQuestion: string;
  lawyerResponse?: string;
  score?: number;
  suggestions?: string[];
  status: 'awaiting-response' | 'evaluated';
}

interface MootCourtProps {
  caseTitle?: string;
}

// Removed mock data, handling dynamically via AI service

const scoreColor = (score: number) => {
  if (score >= 75) return '#22C55E';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
};

const scoreLabel = (score: number) => {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Adequate';
  return 'Needs work';
};

// ─── Component ───────────────────────────────────────────────────────────────
const MootCourt: React.FC<MootCourtProps> = ({ caseTitle = 'Sharma vs. State of UP' }) => {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [response, setResponse] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [activeCase, setActiveCase] = useState<CaseDocument | null>(null);

  // 1. Subscribe to cases to get the active case
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const unsub = subscribeToCases(
      userId,
      (cases) => {
        const found = cases.find(c => c.title === caseTitle) || cases[0];
        if (found) setActiveCase(found);
      },
      (err) => console.error('Error loading cases for Moot Court', err)
    );
    return () => unsub();
  }, [caseTitle]);

  // 2. Load previous exchanges from AI chat if supported
  useEffect(() => {
    if (!activeCase) return;
    const unsub = aiService.subscribeToChatMessages(`${activeCase.id}_moot`, (msgs) => {
      if (msgs.length > 0 && exchanges.length === 0) {
        try {
          const loadedExchanges = msgs.map(m => JSON.parse(m.content) as Exchange);
          setExchanges(loadedExchanges);
        } catch(e) {}
      }
    });
    return () => unsub();
  }, [activeCase, exchanges.length]);

  // 3. Generate initial question if starting fresh
  useEffect(() => {
    if (activeCase && exchanges.length === 0 && !currentQuestion && !isEvaluating) {
      setIsEvaluating(true);
      fetchAIResponse(`You are a strict Moot Court Judge.
Start a moot court session for the case: "${caseTitle}".
Generate your FIRST question to the counsel.
Return ONLY valid JSON in this exact format:
{ "nextQuestion": "Counsel, what is your primary contention regarding..." }`)
      .then(res => {
         try {
           const clean = res.replace(/```json/g, '').replace(/```/g, '').trim();
           const data = JSON.parse(clean);
           setCurrentQuestion(data.nextQuestion || "Counsel, please begin your arguments.");
         } catch(e) {
           setCurrentQuestion("Counsel, please begin your arguments.");
         }
      })
      .finally(() => setIsEvaluating(false));
    }
  }, [activeCase, exchanges, currentQuestion, caseTitle, isEvaluating]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [exchanges, isEvaluating]);

  const submitResponse = async () => {
    const trimmed = response.trim();
    if (!trimmed) return;
    setIsEvaluating(true);
    setResponse('');
    
    try {
      const prompt = `You are a strict Moot Court Judge.
Case Context: ${caseTitle}
My previous question: "${currentQuestion}"
Counsel's response: "${trimmed}"

Evaluate the response. Give a score (0-100) and 1 to 2 brief suggestions for improvement.
Then, generate the NEXT question you want to ask the counsel.
Return ONLY valid JSON in this exact format:
{
  "score": 85,
  "suggestions": ["Cite relevant case law", "Be more concise"],
  "nextQuestion": "But counsel, how do you explain the discrepancy in the timeline?"
}`;
      
      const res = await fetchAIResponse(prompt);
      const clean = res.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(clean);
      
      const newExchange: Exchange = {
        id: `ex-${Date.now()}`,
        judgeQuestion: currentQuestion,
        lawyerResponse: trimmed,
        score: data.score || 70,
        suggestions: data.suggestions || [],
        status: 'evaluated',
      };
      
      setExchanges(prev => {
        const updated = [...prev, newExchange];
        if (activeCase) {
           const msgs = updated.map(ex => ({
               role: 'ai' as const,
               content: JSON.stringify(ex),
               time: new Date().toISOString()
           }));
           aiService.saveChatMessages(`${activeCase.id}_moot`, msgs);
        }
        return updated;
      });
      setCurrentQuestion(data.nextQuestion || "Do you have any further submissions?");
    } catch(e) {
      const fallbackEx: Exchange = {
        id: `ex-${Date.now()}`,
        judgeQuestion: currentQuestion,
        lawyerResponse: trimmed,
        score: 65,
        suggestions: ["Could not reach AI judge for evaluation."],
        status: 'evaluated'
      };
      setExchanges(prev => [...prev, fallbackEx]);
      setCurrentQuestion("Please continue with your arguments.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const avgScore = exchanges.filter(e => e.score).length > 0
    ? Math.round(exchanges.reduce((sum, e) => sum + (e.score || 0), 0) / exchanges.filter(e => e.score).length)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0A0A0A' }}>
            <Gavel className="h-5 w-5" style={{ color: '#F97316' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Moot Court</h1>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>AI Judge session · {caseTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {avgScore > 0 && (
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
            >
              <Award className="h-3.5 w-3.5" style={{ color: scoreColor(avgScore) }} />
              <span className="text-xs font-bold" style={{ color: '#111827' }}>{avgScore}</span>
              <span className="text-xs" style={{ color: '#9CA3AF' }}>avg score</span>
            </div>
          )}
          <button
            onClick={() => { setExchanges([]); setCurrentQuestion(''); setIsEvaluating(false); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151' }}
          >
            <RotateCcw className="h-3 w-3" />
            Restart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
        {/* Main session column */}
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', minHeight: 520 }}>
          {/* Bench header */}
          <div className="flex items-center gap-2.5 px-5 py-4" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <p className="text-xs font-semibold text-white">Session live</p>
            <span className="text-[11px] ml-auto" style={{ color: '#525252' }}>{exchanges.length} exchange{exchanges.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Exchange history */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {exchanges.map((ex, idx) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* Judge question */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#0A0A0A' }}>
                    <Gavel className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>AI Judge</p>
                    <div className="text-sm font-medium text-gray-900 leading-relaxed markdown-content">
                      <ReactMarkdown>{ex.judgeQuestion}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Lawyer response */}
                {ex.lawyerResponse && (
                  <div className="flex gap-3 pl-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FFF7ED' }}>
                      <span className="text-xs font-bold" style={{ color: '#F97316' }}>You</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Your response</p>
                      <div className="text-sm leading-relaxed text-gray-700 markdown-content">
                        <ReactMarkdown>{ex.lawyerResponse}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                {/* Score + suggestions */}
                {ex.score !== undefined && (
                  <div className="ml-11 rounded-xl p-4" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold" style={{ color: scoreColor(ex.score) }}>{ex.score}</span>
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>/ 100</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
                          style={{ background: `${scoreColor(ex.score)}1A`, color: scoreColor(ex.score) }}
                        >
                          {scoreLabel(ex.score)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: '#E5E7EB' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: scoreColor(ex.score) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${ex.score}%` }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    {ex.suggestions && ex.suggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Suggestions</p>
                        {ex.suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: '#F97316' }} />
                            <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{s}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            {/* Current question (awaiting response) */}
            {sessionActive && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#0A0A0A' }}>
                  <Gavel className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>AI Judge</p>
                  <div className="text-sm font-medium text-gray-900 leading-relaxed markdown-content">
                    <ReactMarkdown>{currentQuestion}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            )}

            {isEvaluating && (
              <div className="ml-11 flex items-center gap-2">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#D1D5DB' }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
                <span className="text-xs" style={{ color: '#9CA3AF' }}>Evaluating response…</span>
              </div>
            )}
          </div>

          {/* Response composer */}
          <div className="px-5 py-4" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div className="flex items-end gap-2">
              <div className="flex-1 flex items-end gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <textarea
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitResponse(); } }}
                  placeholder="Respond to the bench…"
                  rows={1}
                  disabled={isEvaluating}
                  className="flex-1 bg-transparent outline-none text-sm font-medium text-gray-900 placeholder-gray-400 resize-none py-1 max-h-28"
                />
                <button
                  onClick={() => setRecording(p => !p)}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={recording ? { background: '#FEF2F2', color: '#EF4444' } : { background: 'transparent', color: '#9CA3AF' }}
                >
                  {recording ? <StopIcon className="h-3.5 w-3.5" fill="currentColor" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={submitResponse}
                disabled={!response.trim() || isEvaluating}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:cursor-not-allowed"
                style={response.trim() && !isEvaluating ? { background: '#F97316', color: '#FFFFFF' } : { background: '#F3F4F6', color: '#D1D5DB' }}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Side panel: session stats */}
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <h3 className="text-sm font-semibold text-gray-900">Session Performance</h3>
            </div>
            <div className="px-5 py-4 space-y-3.5">
              {exchanges.filter(e => e.score).map((ex, idx) => (
                <div key={ex.id} className="flex items-center gap-3">
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#9CA3AF' }}>Q{idx + 1}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                    <div className="h-full rounded-full" style={{ width: `${ex.score}%`, background: scoreColor(ex.score!) }} />
                  </div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: scoreColor(ex.score!) }}>{ex.score}</span>
                </div>
              ))}
              {exchanges.filter(e => e.score).length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>Respond to begin scoring</p>
              )}
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4" style={{ color: '#22C55E' }} />
              <p className="text-xs font-semibold text-white">Tips for the bench</p>
            </div>
            <ul className="space-y-2">
              {['Lead with the strongest precedent first', 'Anticipate the rebuttal before it\'s raised', 'Keep responses under 90 seconds'].map(tip => (
                <li key={tip} className="flex items-start gap-2 text-xs" style={{ color: '#A3A3A3' }}>
                  <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: '#525252' }} />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MootCourt;