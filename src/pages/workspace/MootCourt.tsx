import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gavel, Mic, Send, RotateCcw, Sparkles,
  CheckCircle2, AlertCircle, ChevronRight, Award,
  Users, Scale, MessageSquare, ListChecks, Landmark, Loader2, Play
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiService } from '../../services/aiService';
import { subscribeToCases, type CaseDocument } from '../../services/caseService';
import { getDocuments, type DocumentRecord } from '../../services/documentService';
import { auth } from '../../auth';

// ─── Types ───────────────────────────────────────────────────────────────────
type CourtStage = 'opening' | 'presentation' | 'cross_exam' | 'objections' | 'verdict';

interface CourtMessage {
  id: string;
  sender: 'judge' | 'opposing' | 'user';
  content: string;
  timestamp: string;
  score?: number;
  etiquette?: number;
  reasoning?: number;
  evidenceScore?: number;
  suggestions?: string[];
}

interface PerformanceReport {
  overallScore: number;
  verdict: string;
  judgeRating: string;
  advocateRating: string;
  strengths: string[];
  weaknesses: string[];
  missedOpportunities: string[];
  courtroomBehaviour: string[];
  improvements: string[];
  readinessScore: number;
  practiceScore: number;
}

const scoreColor = (score: number) => {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
};

interface MootCourtProps {
  caseTitle?: string;
}

export const MootCourt: React.FC<MootCourtProps> = ({ caseTitle }) => {
  const [cases, setCases] = useState<CaseDocument[]>([]);
  const [activeCase, setActiveCase] = useState<CaseDocument | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [caseSwitcherOpen, setCaseSwitcherOpen] = useState(false);
  
  // Courtroom state
  const [stage, setStage] = useState<CourtStage>('opening');
  const [messages, setMessages] = useState<CourtMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [round, setRound] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to cases
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const unsub = subscribeToCases(
      userId,
      (loadedCases) => {
        setCases(loadedCases);
        if (loadedCases.length > 0) {
          const found = caseTitle ? loadedCases.find(c => c.title === caseTitle) : null;
          setActiveCase(found || loadedCases[0]);
        }
      },
      (err) => console.error('Error loading cases for Moot Court', err)
    );
    return () => unsub();
  }, [caseTitle]);

  // Load documents for active case
  useEffect(() => {
    if (!activeCase) return;
    const userId = auth.currentUser?.uid || 'anonymous';
    getDocuments(activeCase.id, userId).then((res) => {
      if (res.success && res.data) {
        setDocuments(res.data);
      }
    });
  }, [activeCase]);

  // Scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const startSession = async () => {
    if (!activeCase) return;
    setLoading(true);
    setLoadingStep('Assembling the bench & calling opposing counsel...');
    setMessages([]);
    setReport(null);
    setStage('opening');
    setRound(1);

    try {
      const docList = documents.map(d => d.originalName || d.fileName).join(', ');
      const caseContext = `Case Title: ${activeCase.title}\nType: ${activeCase.caseType || 'Civil'}\nSummary: ${activeCase.description || 'No summary'}\nFiles: ${docList || 'None'}`;
      
      const judgePrompt = `Start a Moot Court Session for this case:\n${caseContext}\n\nYou are the Presiding Judge. Welcome the advocate, read the brief case facts, and declare the proceedings open. Ask the advocate for their opening contention.`;
      
      const reply = await aiService.sendLegalGuidanceChat({
        message: judgePrompt,
        issueType: activeCase.caseType,
      });

      setMessages([
        {
          id: `msg-${Date.now()}`,
          sender: 'judge',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const cleanText = inputText.trim();
    if (!cleanText || loading || !activeCase) return;

    setInputText('');
    const userMsg: CourtMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      content: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    setLoadingStep('Judge is evaluating your argument...');

    try {
      // 1. Ask Judge to evaluate response and reply
      const judgePrompt = `
You are the Presiding Judge in a Moot Court.
Case context: ${activeCase.title}.
Counsel has responded: "${cleanText}"

Evaluate the counsel's argument. Provide:
1. Score out of 100
2. Mini scores out of 100 for: Etiquette, Legal Reasoning, Evidence Citation
3. Key suggestions for improvement
4. Your follow-up question or observation.

Format your response as a JSON block:
{
  "score": 85,
  "etiquette": 90,
  "reasoning": 80,
  "evidenceScore": 85,
  "suggestions": ["Cite concrete acts", "Maintain formal pitch"],
  "reply": "Judge response here..."
}
`;
      const judgeResText = await aiService.sendLegalGuidanceChat({
        message: judgePrompt,
        issueType: activeCase.caseType,
        history: updated.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content })).slice(-6)
      });

      let judgeData = { score: 70, etiquette: 70, reasoning: 70, evidenceScore: 70, suggestions: [] as string[], reply: judgeResText };
      try {
        const jsonMatch = judgeResText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          judgeData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("JSON parsing error for judge response:", e);
      }

      const judgeMsg: CourtMessage = {
        id: `msg-judge-${Date.now()}`,
        sender: 'judge',
        content: judgeData.reply || judgeResText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        score: judgeData.score,
        etiquette: judgeData.etiquette,
        reasoning: judgeData.reasoning,
        evidenceScore: judgeData.evidenceScore,
        suggestions: judgeData.suggestions,
      };

      setMessages(prev => [...prev, judgeMsg]);

      // Determine next stage
      let nextStage = stage;
      if (round === 1) {
        nextStage = 'presentation';
      } else if (round === 2) {
        nextStage = 'cross_exam';
      } else if (round === 3) {
        nextStage = 'objections';
      }

      setStage(nextStage);

      // 2. Query Opposing Counsel to raise objection or cross argument
      setLoadingStep('Opposing counsel is presenting counter-arguments...');
      const opposingPrompt = `
You are the Opposing Counsel in a Moot Court.
The Judge just observed: "${judgeData.reply || judgeResText}"
And the advocate argued: "${cleanText}"

Deliver your rebuttal, challenge their evidence, raise objections where appropriate, or request clarifications. Cite counter-precedents. Keep it sharp and professional.
`;
      const opposingRes = await aiService.sendLegalGuidanceChat({
        message: opposingPrompt,
        issueType: activeCase.caseType,
      });

      const opposingMsg: CourtMessage = {
        id: `msg-opp-${Date.now()}`,
        sender: 'opposing',
        content: opposingRes,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, opposingMsg]);
      setRound(prev => prev + 1);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deliverVerdict = async () => {
    if (!activeCase) return;
    setLoading(true);
    setLoadingStep('The bench is deliberating on the final order...');

    try {
      const prompt = `
You are the Presiding Judge in a Moot Court. The hearing has concluded. Based on this exchange history:
${JSON.stringify(messages)}

Pronounce your final order/verdict, and provide a comprehensive performance report.
Format your response as a JSON block:
{
  "verdict": "Verdict for the Petitioner/Respondent...",
  "overallScore": 82,
  "judgeRating": "Excellent courtroom presence",
  "advocateRating": "Senior Advocate Grade",
  "strengths": ["Strong evidence citation", "Clear structural opening"],
  "weaknesses": ["Defensive on objections", "Omitted BNSS procedure"],
  "missedOpportunities": ["Could have cited Section 482 CrPC"],
  "courtroomBehaviour": ["Excellent etiquette", "Respected the bench"],
  "improvements": ["Work on rapid rebuttals", "Study procedural BNSS rules"],
  "readinessScore": 85,
  "practiceScore": 80,
  "order": "The final reasoned judgment contents here..."
}
`;
      const reply = await aiService.sendLegalGuidanceChat({
        message: prompt,
        issueType: activeCase.caseType,
      });

      let reportData = {
        overallScore: 75,
        verdict: "Bench Order delivered",
        judgeRating: "Strong performance",
        advocateRating: "Junior Counsel",
        strengths: ["Clear arguments"],
        weaknesses: ["Omitted procedural details"],
        missedOpportunities: ["Precedent citation missed"],
        courtroomBehaviour: ["Good mannerism"],
        improvements: ["Focus on acts"],
        readinessScore: 70,
        practiceScore: 75,
        order: reply,
      };

      try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          reportData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error(e);
      }

      setReport(reportData);
      setStage('verdict');

      setMessages(prev => [
        ...prev,
        {
          id: `msg-verdict-${Date.now()}`,
          sender: 'judge',
          content: `### 🏛️ COURT BENCH VERDICT & ORDER\n\n${reportData.order || reply}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Compute live scores based on latest evaluated judge message
  const scoreStats = useMemo(() => {
    const scoredMsgs = messages.filter(m => m.score !== undefined);
    if (scoredMsgs.length === 0) return { overall: 0, etiquette: 0, reasoning: 0, evidence: 0 };
    const latest = scoredMsgs[scoredMsgs.length - 1];
    return {
      overall: latest.score || 0,
      etiquette: latest.etiquette || 0,
      reasoning: latest.reasoning || 0,
      evidence: latest.evidenceScore || 0,
    };
  }, [messages]);

  return (
    <div className="min-h-screen pb-12" style={{ background: '#FAFAFA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 space-y-7">
        
        {/* ── Header & Case Picker ── */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900">
              <Gavel className="h-5 w-5 text-orange-500 animate-pulse" />
            </div>
            <div>
              <div className="relative">
                <button
                  onClick={() => setCaseSwitcherOpen(!caseSwitcherOpen)}
                  className="flex items-center gap-1.5 text-sm font-bold text-gray-900 hover:text-orange-500 transition-colors cursor-pointer"
                >
                  {activeCase ? activeCase.title : 'Select Case'}
                  <ChevronRight className="h-4 w-4 rotate-90 text-slate-400" />
                </button>

                {caseSwitcherOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setCaseSwitcherOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 max-h-60 overflow-y-auto">
                      {cases.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setActiveCase(c);
                            setCaseSwitcherOpen(false);
                            setMessages([]);
                            setReport(null);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors ${activeCase?.id === c.id ? 'text-orange-500 bg-orange-50' : 'text-slate-700'}`}
                        >
                          {c.title}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5"> litigation simulator · {documents.length} evidence items loaded</p>
            </div>
          </div>

          <div className="flex gap-2">
            {messages.length > 0 && (
              <button
                onClick={startSession}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restart Session
              </button>
            )}
            {messages.length === 0 && activeCase && (
              <button
                onClick={startSession}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" /> Open Court proceedings
              </button>
            )}
          </div>
        </div>

        {/* Court Progress Timeline */}
        {messages.length > 0 && (
          <div className="bg-white border border-gray-150 rounded-2xl p-4 flex justify-between items-center text-xs font-bold text-slate-400 overflow-x-auto gap-4">
            {[
              { key: 'opening', label: '1. Opening' },
              { key: 'presentation', label: '2. Arguments' },
              { key: 'cross_exam', label: '3. Cross-Exam' },
              { key: 'objections', label: '4. Objections' },
              { key: 'verdict', label: '5. Verdict' },
            ].map(step => (
              <span
                key={step.key}
                className={`transition-all whitespace-nowrap ${stage === step.key ? 'text-orange-500 scale-105 font-extrabold' : messages.length > 0 && step.key !== 'verdict' ? 'text-slate-800' : ''}`}
              >
                {step.label}
              </span>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
            
            {/* ── Courtroom Chat Window ── */}
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[500px]">
              <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Court Bench Proceedings Live</span>
              </div>

              {/* Chat Thread */}
              <div ref={scrollRef} className="flex-1 p-5 space-y-6 max-h-[55vh] overflow-y-auto hide-scrollbar">
                {messages.map((m) => {
                  const isUser = m.sender === 'user';
                  const isJudge = m.sender === 'judge';
                  return (
                    <div key={m.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && (
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-extrabold text-[11px] ${isJudge ? 'bg-slate-900 text-orange-500' : 'bg-orange-50 text-orange-600'}`}>
                          {isJudge ? 'JD' : 'OC'}
                        </div>
                      )}
                      <div className={`p-4 rounded-2xl max-w-[80%] text-xs leading-relaxed ${isUser ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 border border-slate-100 text-slate-800'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {isUser ? 'You (Advocate)' : isJudge ? '🏛️ Presiding Judge' : '⚖️ Opposing Counsel'}
                        </p>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>

                        {/* Evaluated scores block inside Judge message bubble */}
                        {isJudge && m.score !== undefined && (
                          <div className="mt-4 pt-3 border-t border-slate-200/50 space-y-2">
                            <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                              <span>Round Score: <strong className="text-slate-800">{m.score}/100</strong></span>
                              <span style={{ color: scoreColor(m.score) }}>{m.score >= 75 ? 'Excellent' : m.score >= 50 ? 'Adequate' : 'Weak'}</span>
                            </div>
                            {m.suggestions && m.suggestions.length > 0 && (
                              <div className="bg-white border border-slate-100 rounded-lg p-2.5 mt-2 space-y-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Bench Recommendations</span>
                                {m.suggestions.map((s, idx) => (
                                  <p key={idx} className="text-[10px] text-slate-600 flex items-start gap-1">
                                    <Sparkles className="h-3 w-3 mt-0.5 text-orange-500 flex-shrink-0" />
                                    {s}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 justify-center py-4 bg-slate-50/50 rounded-xl border border-slate-100 animate-pulse">
                    <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                    {loadingStep}
                  </div>
                )}
              </div>

              {/* Input block */}
              {stage !== 'verdict' && (
                <div className="px-5 py-4 border-t border-slate-100 bg-white">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder="Enter your argument or answer opposing counsel..."
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl outline-none text-xs"
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleSend();
                      }}
                      disabled={loading}
                    />
                    <button
                      onClick={handleSend}
                      disabled={loading || !inputText.trim()}
                      className="px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Present
                    </button>
                    {round >= 3 && !loading && (
                      <button
                        onClick={deliverVerdict}
                        className="px-4 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Scale className="h-3.5 w-3.5 text-orange-500" /> Deliver Verdict
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right Dashboard Panel: Evaluation Score & Report ── */}
            <div className="space-y-4">
              
              {/* Scorecard panel */}
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Bench Evaluation</h3>
                
                <div className="text-center py-2">
                  <div className="text-3xl font-extrabold" style={{ color: scoreColor(scoreStats.overall) }}>{scoreStats.overall}/100</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Overall Presentation Score</div>
                </div>

                <div className="space-y-3.5 pt-2 border-t border-slate-100">
                  {[
                    { label: 'Court Etiquette', val: scoreStats.etiquette },
                    { label: 'Legal Reasoning', val: scoreStats.reasoning },
                    { label: 'Evidence Citation', val: scoreStats.evidence },
                  ].map(stat => (
                    <div key={stat.label} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>{stat.label}</span>
                        <span>{stat.val}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stat.val}%`, backgroundColor: scoreColor(stat.val) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verdict Final Report card */}
              {report && (
                <div className="bg-white border border-orange-200 rounded-3xl p-5 shadow-sm space-y-4 border-t-4 border-t-orange-500">
                  <div className="flex items-center gap-1.5">
                    <Award className="h-5 w-5 text-orange-500" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Performance Scorecard</h3>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400 font-medium">Verdict:</span> <span className="font-bold text-slate-900">{report.verdict}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium">Judge Rating:</span> <span className="font-bold text-slate-900">{report.judgeRating}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium">Advocate Grade:</span> <span className="font-bold text-slate-900">{report.advocateRating}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium">Readiness Score:</span> <span className="font-bold text-emerald-600">{report.readinessScore}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium">Practice Score:</span> <span className="font-bold text-orange-600">{report.practiceScore}%</span></div>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Key Strengths</span>
                    {report.strengths.map((str, idx) => (
                      <p key={idx} className="text-[11px] text-slate-700 flex items-start gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {str}
                      </p>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Weaknesses & Gaps</span>
                    {report.weaknesses.map((weak, idx) => (
                      <p key={idx} className="text-[11px] text-slate-700 flex items-start gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                        {weak}
                      </p>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Recommended Improvements</span>
                    {report.improvements.map((imp, idx) => (
                      <p key={idx} className="text-[11px] text-slate-700 flex items-start gap-1">
                        <ListChecks className="h-3.5 w-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                        {imp}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {messages.length === 0 && activeCase && (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 max-w-xl mx-auto text-center space-y-5 shadow-sm">
            <Landmark className="h-10 w-10 text-orange-500 mx-auto" />
            <h2 className="text-base font-bold text-gray-900">Moot Court Courtroom Simulator</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Argue the selected case before a strict presiding Judge and a skilled Opposing Counsel. The Judge will score your legal reasoning, citations, and court etiquette in real-time.
            </p>
            <button
              onClick={startSession}
              className="bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Open Court Proceedings
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MootCourt;