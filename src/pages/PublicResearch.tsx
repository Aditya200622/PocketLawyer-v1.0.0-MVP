import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { aiService } from "../services/aiService";
import { useTranslation } from 'react-i18next';
import { 
  Search, BookOpen, Clock, Printer, Download, Copy, AlertTriangle, 
  ChevronRight, ArrowLeft, RefreshCw, FileText, Scale
} from "lucide-react";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
  isStreaming?: boolean;
}

interface Filters {
  category?: string;
  purpose?: string;
  court?: string;
  keywords?: string;
  time?: string;
}

const STEPS = [
  {
    key: "category",
    question: "What type of legal case are you researching?",
    hint: "e.g. Criminal, Civil, Family, Property, Labour, Tax, Constitutional",
    icon: "⚖️",
    chips: ["Criminal", "Civil", "Family", "Property", "Labour", "Tax", "Constitutional", "Corporate"],
  },
  {
    key: "purpose",
    question: "What is your research purpose?",
    hint: "e.g. Legal advice, academic research, drafting petition, case preparation",
    icon: "🎯",
    chips: ["Legal advice", "Academic research", "Drafting a petition", "Case preparation"],
  },
  {
    key: "court",
    question: "Which court should I focus on?",
    hint: "e.g. Supreme Court, Delhi High Court, any High Court, District Court",
    icon: "🏛️",
    chips: ["Supreme Court", "Delhi High Court", "Bombay High Court", "Any High Court"],
  },
  {
    key: "keywords",
    question: "Any keywords, sections, or acts to include?",
    hint: "e.g. IPC 302, Article 21, POCSO, specific party names or facts",
    icon: "🔍",
    chips: ["IPC 302", "Article 21", "POCSO Act", "Bail matters"],
  },
  {
    key: "time",
    question: "Any time period preference?",
    hint: "e.g. Last 5 years, 2010–2020, landmark cases only, recent judgments",
    icon: "📅",
    chips: ["Last 5 years", "Last 10 years", "Landmark cases only", "Any time period"],
  },
];

const POPULAR_TOPICS = [
  "IPC 302 murder cases",
  "Article 21 judgments",
  "POCSO Act",
  "Bail matters",
  "Property disputes",
  "Constitutional law",
  "Tax litigation",
  "Family disputes",
];

export default function PublicResearch() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState<Filters>({});
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [done, setDone] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, streamingText]);

  const addMessage = useCallback((role: "user" | "ai", text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        role,
        text,
      },
    ]);
  }, []);

  const handleSend = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || loading) return;

    addMessage("user", cleanText);
    setInput("");
    setLoading(true);
    setStreamingText("");

    try {
      const result = await aiService.generateResearchResponse({
        prompt: cleanText,
        conversation: messages.map(m => ({ role: m.role, content: m.text, time: new Date().toISOString() })),
      });

      let built = "";
      for (let i = 0; i < result.response.length; i++) {
        built += result.response[i];
        setStreamingText(built);
        await new Promise((resolve) => setTimeout(resolve, 8));
      }

      addMessage("ai", result.response);
    } catch (err) {
      console.error(err);
      addMessage("ai", "⚠️ Research generation failed. Please try again.");
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  };

  const handleNextStep = async (value: string) => {
    const key = STEPS[step].key as keyof Filters;
    const updatedFilters = { ...filters, [key]: value };
    setFilters(updatedFilters);
    setInput("");

    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
    } else {
      setDone(true);
      setLoading(true);
      const combinedPrompt = [
        `Legal Category: ${updatedFilters.category || "—"}`,
        `Purpose: ${updatedFilters.purpose || "—"}`,
        `Court focus: ${updatedFilters.court || "—"}`,
        `Keywords/Acts: ${updatedFilters.keywords || "—"}`,
        `Time period: ${updatedFilters.time || "—"}`,
      ].join("\n");

      addMessage("user", `Initiated research for category: ${updatedFilters.category}`);

      try {
        const result = await aiService.generateResearchResponse({
          prompt: `Conduct legal research with these criteria:\n${combinedPrompt}`,
        });

        let built = "";
        for (let i = 0; i < result.response.length; i++) {
          built += result.response[i];
          setStreamingText(built);
          await new Promise((resolve) => setTimeout(resolve, 8));
        }

        addMessage("ai", result.response);
      } catch (err) {
        console.error(err);
        addMessage("ai", "⚠️ Research generation failed. Please try again.");
      } finally {
        setLoading(false);
        setStreamingText("");
      }
    }
  };

  const handleReset = () => {
    setStep(0);
    setFilters({});
    setInput("");
    setMessages([]);
    setDone(false);
    setStreamingText("");
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Research copied to clipboard!");
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = (text: string) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>PocketLawyer - Public Legal Research</title>
<style>body{font-family:Inter,sans-serif;padding:48px;line-height:1.6;color:#1A1A2E;}
h2{border-bottom:1px solid #E2E8F0;padding-bottom:8px;color:#1A1A2E;}</style></head>
<body><div>${text.replace(/\n/g, '<br/>')}</div>
<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    win.document.close();
  };

  const handleDownload = (text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pocketlawyer-research-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <span className="text-xs font-semibold text-orange-500 uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full">
            Public Legal Assistant
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">Public Legal Research</h1>
          <p className="text-sm text-slate-500 max-w-lg mx-auto mt-2">
            Search Indian acts, sections, judgments, and legal summaries instantly using AI.
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-3 text-xs text-orange-800">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Public Session Mode:</span> Research queries run instantly. To save research notes, link documents, or build persistent research vaults, please <span className="font-bold underline cursor-pointer">Log In</span> to access your dashboard.
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          
          {/* Scrollable conversation history */}
          <div ref={scrollContainerRef} className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[55vh]">
            
            {/* Step Wizard rendering */}
            {!done && messages.length === 0 && (
              <div className="space-y-6 py-6 max-w-xl mx-auto">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg">
                    {STEPS[step].icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{STEPS[step].question}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{STEPS[step].hint}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {STEPS[step].chips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleNextStep(chip)}
                      className="px-4 py-3 rounded-xl border border-slate-200 hover:border-orange-500 hover:bg-orange-50/10 text-left text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {step > 0 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold hover:text-slate-600 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to previous question
                  </button>
                )}
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs flex-shrink-0">
                    AI
                  </div>
                )}
                <div
                  className={`p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 border border-slate-100 text-slate-800"
                  }`}
                >
                  <div className="whitespace-pre-line prose prose-sm max-w-none">
                    {m.text}
                  </div>

                  {m.role === "ai" && (
                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200/60 justify-end">
                      <button
                        onClick={() => handleCopy(m.text)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                      <button
                        onClick={() => handlePrint(m.text)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <Printer className="h-3 w-3" /> Print
                      </button>
                      <button
                        onClick={() => handleDownload(m.text)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <Download className="h-3 w-3" /> Download
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming Message */}
            {streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs flex-shrink-0">
                  AI
                </div>
                <div className="p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed bg-slate-50 border border-slate-100 text-slate-800">
                  <div className="whitespace-pre-line prose prose-sm max-w-none">
                    {streamingText}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-500 hover:text-slate-700 transition-all text-xs font-semibold cursor-pointer flex items-center gap-1 flex-shrink-0"
              title="Reset search wizard"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </button>

            <div className="flex-1 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={done ? "Ask follow-up research questions here..." : "Type custom query or use wizard steps above..."}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (input.trim()) {
                      if (!done) setDone(true);
                      handleSend(input);
                    }
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-xs bg-white focus:border-orange-500"
              />
              <button
                onClick={() => {
                  if (input.trim()) {
                    if (!done) setDone(true);
                    handleSend(input);
                  }
                }}
                disabled={loading || !input.trim()}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 transition-all text-xs font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                Search <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Popular Topics Footer */}
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold text-slate-400">POPULAR PUBLIC SEARCH TOPICS</p>
          <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
            {POPULAR_TOPICS.map((topic) => (
              <button
                key={topic}
                onClick={() => {
                  setDone(true);
                  handleSend(topic);
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-semibold text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-all cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
