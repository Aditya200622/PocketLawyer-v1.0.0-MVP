import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "../auth";
import { getCases, type CaseDocument } from "../services/caseService";
import { getDocuments, type DocumentRecord } from "../services/documentService";
import { aiService, type ResearchSessionRecord } from "../services/aiService";

/* ============================================================================
   TYPES
   ========================================================================== */

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
  references?: string[];
  sessionId?: string;
  isStreaming?: boolean;
}

interface CaseResult {
  title: string;
  court: string;
  year: string;
  category: string;
  summary: string;
  link: string;
  relevance?: string;
}

interface Filters {
  category?: string;
  purpose?: string;
  court?: string;
  keywords?: string;
  time?: string;
}

interface RecentSearch {
  id: string;
  filters: Filters;
  resultCount: number;
  timestamp: number;
}

interface ClientFilters {
  court: string;
  year: string;
  category: string;
  relevance: string;
  landmarkOnly: boolean;
  recentOnly: boolean;
  highRelevanceOnly: boolean;
}

/* ============================================================================
   CONSTANTS  (API_URL, STEPS, and the filtering flow are unchanged)
   ========================================================================== */

const API_URL = "http://localhost:5000/api/cases";

const STEPS = [
  {
    key: "category",
    question: "What **type of legal case** are you researching?",
    hint: "e.g. Criminal, Civil, Family, Property, Labour, Tax, Constitutional",
    icon: "⚖️",
    chips: ["Criminal", "Civil", "Family", "Property", "Labour", "Tax", "Constitutional", "Corporate"],
  },
  {
    key: "purpose",
    question: "What is your **research purpose**?",
    hint: "e.g. Legal advice, academic research, drafting petition, case preparation",
    icon: "🎯",
    chips: ["Legal advice", "Academic research", "Drafting a petition", "Case preparation"],
  },
  {
    key: "court",
    question: "Which **court** should I focus on?",
    hint: "e.g. Supreme Court, Delhi High Court, any High Court, District Court",
    icon: "🏛️",
    chips: ["Supreme Court", "Delhi High Court", "Bombay High Court", "Any High Court"],
  },
  {
    key: "keywords",
    question: "Any **keywords, sections, or acts** to include?",
    hint: "e.g. IPC 302, Article 21, POCSO, specific party names or facts",
    icon: "🔍",
    chips: ["IPC 302", "Article 21", "POCSO Act", "Bail matters"],
  },
  {
    key: "time",
    question: "Any **time period** preference?",
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

const CATEGORY_COLORS: Record<string, string> = {
  Constitutional: "bg-violet-50 text-violet-700 border-violet-200",
  Criminal: "bg-rose-50 text-rose-700 border-rose-200",
  Civil: "bg-blue-50 text-blue-700 border-blue-200",
  Family: "bg-pink-50 text-pink-700 border-pink-200",
  Property: "bg-amber-50 text-amber-800 border-amber-200",
  Labour: "bg-orange-50 text-orange-700 border-orange-200",
  Tax: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Corporate: "bg-cyan-50 text-cyan-700 border-cyan-200",
  Consumer: "bg-teal-50 text-teal-700 border-teal-200",
  Environmental: "bg-green-50 text-green-700 border-green-200",
  "—": "bg-slate-50 text-slate-600 border-slate-200",
};

const RELEVANCE_BADGE: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-slate-50 text-slate-600 border-slate-200",
};

const RELEVANCE_SCORE: Record<string, number> = { High: 92, Medium: 74, Low: 55 };

const SAVE_KEY = "legalResearchSavedCases";
const RECENT_KEY = "legalResearchRecentSearches";

/* ============================================================================
   HELPERS
   ========================================================================== */

function renderInline(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<span class='font-semibold text-[#0F172A]'>$1</span>")
    .replace(/\*(.*?)\*/g, "<span style='color:#94a3b8;font-style:italic'>$1</span>");
}

function extractCitations(text: string) {
  const articles = Array.from(new Set((text.match(/Article\s+\d+[A-Za-z]?/gi) || []).map((s) => s.trim())));
  const sections = Array.from(
    new Set((text.match(/Section\s+\d+[A-Za-z]?(?:\s*(?:of|IPC|CrPC|CPC))?/gi) || []).map((s) => s.trim()))
  );
  const acts = Array.from(new Set((text.match(/[A-Z][A-Za-z,()&\s]{2,40}\sAct,?\s*\d{4}/g) || []).map((s) => s.trim())));
  return { articles, sections, acts };
}

function estimateReadingTime(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200));
}

function relevanceToScore(rel?: string) {
  return RELEVANCE_SCORE[rel || "Medium"] ?? 70;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "case";
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function citationLine(c: CaseResult) {
  return `${c.title} — ${c.court}${c.year !== "—" ? `, ${c.year}` : ""}${c.link && c.link !== "#" ? ` (${c.link})` : ""}`;
}

function buildResearchSummary(filters: Filters, results: CaseResult[]) {
  const lines: string[] = [];
  lines.push("LEGAL RESEARCH SUMMARY");
  lines.push("=======================");
  lines.push(`Case type: ${filters.category || "—"}`);
  lines.push(`Purpose: ${filters.purpose || "—"}`);
  lines.push(`Court: ${filters.court || "—"}`);
  lines.push(`Keywords: ${filters.keywords || "—"}`);
  lines.push(`Time range: ${filters.time || "—"}`);
  lines.push("");
  lines.push(`${results.length} case(s) found:`);
  results.forEach((c, i) => lines.push(`${i + 1}. ${citationLine(c)}`));
  return lines.join("\n");
}

function buildCaseBrief(c: CaseResult) {
  return [
    `CASE BRIEF`,
    `==========`,
    `Title: ${c.title}`,
    `Court: ${c.court}`,
    `Year: ${c.year}`,
    `Category: ${c.category}`,
    `Relevance: ${c.relevance || "—"}`,
    ``,
    `Summary:`,
    c.summary || "—",
    ``,
    `Judgment link: ${c.link && c.link !== "#" ? c.link : "Not available"}`,
  ].join("\n");
}

/* ============================================================================
   SMALL UI PRIMITIVES
   ========================================================================== */

function IconButton({
  onClick,
  title,
  disabled,
  children,
  active,
}: {
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
        disabled
          ? "opacity-40 cursor-not-allowed border-slate-200 text-slate-400 bg-white"
          : active
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-medium shadow-xl flex items-center gap-2"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </motion.div>
  );
}

function StreamingText({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i += 3;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 10);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = shown.length >= text.length;
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: renderInline(shown) + (!done ? "<span class='typing-cursor'>▍</span>" : ""),
      }}
    />
  );
}

function MessageContent({ text, references }: { text: string; references?: string[] }) {
  const segments = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        if (segment.startsWith("```") && segment.endsWith("```")) {
          const code = segment.slice(3, -3).trim();
          return (
            <pre key={index} className="overflow-x-auto rounded-xl bg-slate-950 px-3 py-2 text-[11px] leading-5 text-slate-100">
              <code>{code}</code>
            </pre>
          );
        }

        const lines = segment.split("\n");
        return (
          <div key={index} className="space-y-1">
            {lines.map((line, lineIndex) => {
              if (!line.trim()) return <div key={`${index}-${lineIndex}`} />;
              if (line.startsWith("- ")) {
                return (
                  <div key={`${index}-${lineIndex}`} className="ml-3">
                    • {line.slice(2)}
                  </div>
                );
              }
              return (
                <div key={`${index}-${lineIndex}`} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
              );
            })}
          </div>
        );
      })}
      {references && references.length > 0 && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">References</p>
          <ul className="mt-1 space-y-1">
            {references.map((reference, index) => (
              <li key={`${reference}-${index}`} className="text-[11px] text-slate-600">
                • {reference}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2"
    >
      <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[11px] flex-shrink-0">
        ⚖
      </div>
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ============================================================================
   HEADER
   ========================================================================== */

function Header({
  onNewResearch,
  onExportPDF,
  onClearChat,
  onToggleHistory,
  historyOpen,
  savedCount,
  hasResults,
}: {
  onNewResearch: () => void;
  onExportPDF: () => void;
  onClearChat: () => void;
  onToggleHistory: () => void;
  historyOpen: boolean;
  savedCount: number;
  hasResults: boolean;
}) {
  return (
    <header className="no-print flex-shrink-0 border-b border-[#E2E8F0] bg-[#FAF8F4]/95 backdrop-blur-sm z-20">
      <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center text-amber-400 text-sm flex-shrink-0">
            ⚖
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-[#0F172A] tracking-tight">Legal Research AI</p>
            <p className="text-[10px] text-slate-500 -mt-0.5">Indian case law intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <IconButton onClick={onToggleHistory} title="Recent &amp; saved research" active={historyOpen}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5M12 7v5l4 2" />
              </svg>
              History
              {savedCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-bold">
                  {savedCount}
                </span>
              )}
            </IconButton>
          </div>

          <div className="h-5 w-px bg-[#E2E8F0]" />

          <IconButton onClick={onExportPDF} title="Export research as PDF" disabled={!hasResults}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            Export PDF
          </IconButton>

          <IconButton onClick={onClearChat} title="Clear current conversation">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
            Clear Chat
          </IconButton>

          <button
            onClick={onNewResearch}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all duration-150"
            style={{ background: "linear-gradient(135deg, #D97706, #B45309)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
            New Research
          </button>
        </div>
      </div>
    </header>
  );
}

/* ============================================================================
   HISTORY PANEL (Recent Searches + Saved Cases)
   ========================================================================== */

function HistoryPanel({
  recentSearches,
  savedCases,
  onRerun,
  onOpenSaved,
  onRemoveSaved,
  onClose,
}: {
  recentSearches: RecentSearch[];
  savedCases: CaseResult[];
  onRerun: (f: Filters) => void;
  onOpenSaved: (c: CaseResult) => void;
  onRemoveSaved: (c: CaseResult) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"recent" | "saved">("recent");

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.16 }}
        className="absolute right-6 top-[64px] z-40 w-[340px] bg-white border border-[#E2E8F0] rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex border-b border-[#E2E8F0]">
          {(["recent", "saved"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
                tab === t ? "text-[#0F172A] border-b-2 border-amber-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t === "recent" ? `Recent Searches (${recentSearches.length})` : `Saved Cases (${savedCases.length})`}
            </button>
          ))}
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2">
          {tab === "recent" &&
            (recentSearches.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No searches yet.</p>
            ) : (
              recentSearches
                .slice()
                .reverse()
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onRerun(r.filters)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <p className="text-xs font-semibold text-[#0F172A] truncate">
                      {r.filters.category || "Research"} · {r.filters.court || "Any court"}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{r.filters.keywords || "No keywords"}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {r.resultCount} result{r.resultCount !== 1 ? "s" : ""} ·{" "}
                      {new Date(r.timestamp).toLocaleDateString()}
                    </p>
                  </button>
                ))
            ))}

          {tab === "saved" &&
            (savedCases.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No saved cases yet.</p>
            ) : (
              savedCases.map((c, i) => (
                <div key={`${c.title}-${i}`} className="px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
                  <p className="text-xs font-semibold text-[#0F172A] line-clamp-1">{c.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {c.court} · {c.year}
                  </p>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={() => onOpenSaved(c)}
                      className="text-[10px] font-semibold text-amber-700 hover:text-amber-800"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => onRemoveSaved(c)}
                      className="text-[10px] font-semibold text-slate-400 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ))}
        </div>
      </motion.div>
    </>
  );
}

/* ============================================================================
   HERO EMPTY STATE
   ========================================================================== */

function HeroState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center text-center pt-12 pb-8"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 16 }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-sm"
        style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", border: "1px solid #FCD34D" }}
      >
        ⚖️
      </motion.div>

      <h1
        className="text-[32px] leading-tight font-bold text-[#0F172A] mb-3 max-w-lg"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        Research Indian Case Laws Instantly
      </h1>
      <p className="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
        Search Supreme Court, High Courts, Tribunals, Statutes and Legal Precedents using AI.
      </p>

      <div className="flex flex-wrap justify-center gap-2 max-w-xl">
        {POPULAR_TOPICS.map((topic, i) => (
          <motion.button
            key={topic}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.04 }}
            whileHover={{ y: -2 }}
            onClick={() => onPick(topic)}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-[#E2E8F0] text-slate-600 hover:border-amber-300 hover:text-amber-800 hover:bg-amber-50 transition-colors shadow-sm"
          >
            {topic}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ============================================================================
   SUGGESTED PROMPTS / QUICK REPLY CHIPS (mid-flow)
   ========================================================================== */

function QuickReplyChips({ chips, onPick }: { chips: string[]; onPick: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-1.5 mb-5 pl-8"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onPick(chip)}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-[#E2E8F0] text-slate-500 hover:border-amber-300 hover:text-amber-800 hover:bg-amber-50 transition-colors"
        >
          {chip}
        </button>
      ))}
    </motion.div>
  );
}

/* ============================================================================
   RESEARCH PROGRESS TIMELINE
   ========================================================================== */

function ProgressTimeline({
  step,
  filters,
  loading,
  done,
}: {
  step: number;
  filters: Filters;
  loading: boolean;
  done: boolean;
  hasResults: boolean;
}) {
  const items = [
    ...STEPS.map((s) => ({ key: s.key, label: s.key[0].toUpperCase() + s.key.slice(1), icon: s.icon })),
    { key: "searching", label: "Searching", icon: "🔍" },
    { key: "results", label: "Results Ready", icon: "✅" },
  ];

  function status(key: string, idx: number): "done" | "active" | "pending" {
    if (idx < STEPS.length) {
      if ((filters as any)[key]) return "done";
      if (idx === step && !done) return "active";
      return "pending";
    }
    if (key === "searching") {
      if (done && !loading) return "done";
      if (loading) return "active";
      return "pending";
    }
    // results
    if (done && !loading) return "done";
    return "pending";
  }

  return (
    <div className="no-print flex-shrink-0 border-t border-[#E2E8F0] bg-white/60">
      <div className="max-w-[1100px] mx-auto px-6 py-2.5 flex items-center gap-1 overflow-x-auto">
        {items.map((it, idx) => {
          const s = status(it.key, idx);
          return (
            <div key={it.key} className="flex items-center flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <motion.div
                  animate={s === "active" ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ duration: 1.2, repeat: s === "active" ? Infinity : 0 }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                    s === "done"
                      ? "bg-emerald-500 text-white"
                      : s === "active"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s === "done" ? "✓" : it.icon}
                </motion.div>
                <span
                  className={`text-[10.5px] font-medium whitespace-nowrap ${
                    s === "pending" ? "text-slate-400" : "text-slate-700"
                  }`}
                >
                  {it.label}
                </span>
              </div>
              {idx < items.length - 1 && (
                <div
                  className={`h-px w-5 mx-1.5 ${
                    status(items[idx + 1].key, idx + 1) !== "pending" || s === "done" ? "bg-emerald-300" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   FILTER PANEL
   ========================================================================== */

function FilterPanel({
  results,
  filters,
  onChange,
}: {
  results: CaseResult[];
  filters: ClientFilters;
  onChange: (f: ClientFilters) => void;
}) {
  const courts = useMemo(() => Array.from(new Set(results.map((r) => r.court).filter((v) => v && v !== "—"))), [results]);
  const years = useMemo(
    () =>
      Array.from(new Set(results.map((r) => r.year).filter((v) => v && v !== "—"))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [results]
  );
  const categories = useMemo(
    () => Array.from(new Set(results.map((r) => r.category).filter((v) => v && v !== "—"))),
    [results]
  );

  const Select = ({
    label,
    value,
    options,
    onSelect,
  }: {
    label: string;
    value: string;
    options: string[];
    onSelect: (v: string) => void;
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-slate-700 focus:outline-none focus:border-amber-400"
      >
        <option value="All">All {label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );

  const Toggle = ({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
        active ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-slate-600 border-[#E2E8F0] hover:border-slate-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden mb-4"
    >
      <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex flex-wrap items-end gap-4">
        <Select label="Court" value={filters.court} options={courts} onSelect={(v) => onChange({ ...filters, court: v })} />
        <Select label="Year" value={filters.year} options={years} onSelect={(v) => onChange({ ...filters, year: v })} />
        <Select
          label="Category"
          value={filters.category}
          options={categories}
          onSelect={(v) => onChange({ ...filters, category: v })}
        />
        <Select
          label="Relevance"
          value={filters.relevance}
          options={["High", "Medium", "Low"]}
          onSelect={(v) => onChange({ ...filters, relevance: v })}
        />
        <div className="flex gap-1.5 ml-auto">
          <Toggle
            label="Landmark Only"
            active={filters.landmarkOnly}
            onToggle={() => onChange({ ...filters, landmarkOnly: !filters.landmarkOnly })}
          />
          <Toggle
            label="Recent Only"
            active={filters.recentOnly}
            onToggle={() => onChange({ ...filters, recentOnly: !filters.recentOnly })}
          />
          <Toggle
            label="High Relevance"
            active={filters.highRelevanceOnly}
            onToggle={() => onChange({ ...filters, highRelevanceOnly: !filters.highRelevanceOnly })}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
   AI RESEARCH INSIGHTS
   ========================================================================== */

function InsightsPanel({ results }: { results: CaseResult[] }) {
  const insights = useMemo(() => {
    if (results.length === 0) return null;
    const byCategory: Record<string, number> = {};
    const byCourt: Record<string, number> = {};
    let scoreSum = 0;
    const allCitations = { articles: new Set<string>(), sections: new Set<string>(), acts: new Set<string>() };

    results.forEach((c) => {
      if (c.category && c.category !== "—") byCategory[c.category] = (byCategory[c.category] || 0) + 1;
      if (c.court && c.court !== "—") byCourt[c.court] = (byCourt[c.court] || 0) + 1;
      scoreSum += relevanceToScore(c.relevance);
      const cit = extractCitations(`${c.title} ${c.summary}`);
      cit.articles.forEach((a) => allCitations.articles.add(a));
      cit.sections.forEach((s) => allCitations.sections.add(s));
      cit.acts.forEach((a) => allCitations.acts.add(a));
    });

    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const topCourt = Object.entries(byCourt).sort((a, b) => b[1] - a[1])[0];
    const highCount = results.filter((c) => c.relevance === "High").length;
    const avgScore = Math.round(scoreSum / results.length);
    const sections = [...allCitations.articles, ...allCitations.sections, ...allCitations.acts];

    return { topCategory, topCourt, highCount, avgScore, sections };
  }, [results]);

  if (!insights) return null;

  const cards = [
    {
      title: "Key Legal Principles",
      icon: "📚",
      body: insights.topCategory
        ? `Most retrieved cases fall under ${insights.topCategory[0]} law (${insights.topCategory[1]} of ${results.length}), suggesting that's the dominant principle area for this query.`
        : "Results span a mix of legal categories.",
    },
    {
      title: "Important Sections",
      icon: "🔖",
      chips: insights.sections.slice(0, 8),
    },
    {
      title: "Common Judicial View",
      icon: "🧭",
      body:
        insights.highCount > results.length / 2
          ? `${insights.highCount} of ${results.length} cases are High relevance, indicating fairly consistent reasoning across courts on this point.`
          : `Judicial views appear mixed — only ${insights.highCount} of ${results.length} cases scored High relevance. Worth reading multiple judgments before relying on one line of reasoning.`,
    },
    {
      title: "Practical Relevance",
      icon: "💼",
      body: insights.topCourt
        ? `${insights.topCourt[1]} judgment(s) originate from ${insights.topCourt[0]} — useful precedent weight if you're filing or arguing there. Overall research confidence: ${insights.avgScore}/100.`
        : `Overall research confidence: ${insights.avgScore}/100.`,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 p-5 rounded-2xl border border-amber-200/60"
      style={{ background: "linear-gradient(135deg, #FFFBEB, #FFFFFF)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">✨</span>
        <h3 className="text-sm font-bold text-[#0F172A]">Research Insights</h3>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          {insights.avgScore}% confidence
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.title} className="p-3.5 rounded-xl bg-white border border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
              <span>{card.icon}</span> {card.title}
            </p>
            {card.body && <p className="text-xs text-slate-700 leading-relaxed">{card.body}</p>}
            {card.chips && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {card.chips.length > 0 ? (
                  card.chips.map((c) => (
                    <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No explicit sections detected.</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ============================================================================
   CITATIONS PANEL — Authorities Referenced
   ========================================================================== */

function CitationsPanel({ results, onCopy }: { results: CaseResult[]; onCopy: (text: string) => void }) {
  const data = useMemo(() => {
    const articles = new Set<string>();
    const sections = new Set<string>();
    const acts = new Set<string>();
    results.forEach((c) => {
      const cit = extractCitations(`${c.title} ${c.summary}`);
      cit.articles.forEach((a) => articles.add(a));
      cit.sections.forEach((s) => sections.add(s));
      cit.acts.forEach((a) => acts.add(a));
    });
    return {
      cases: results.map((r) => r.title),
      articles: Array.from(articles),
      sections: Array.from(sections),
      acts: Array.from(acts),
    };
  }, [results]);

  const groups: { label: string; items: string[] }[] = [
    { label: "Cases", items: data.cases },
    { label: "Constitution Articles", items: data.articles },
    { label: "Sections", items: data.sections },
    { label: "Acts", items: data.acts },
  ].filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 p-5 rounded-2xl bg-white border border-[#E2E8F0]"
    >
      <h3 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
        <span>📑</span> Authorities Referenced
      </h3>
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.slice(0, 12).map((item) => (
                <button
                  key={item}
                  onClick={() => onCopy(item)}
                  title="Copy"
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-[#E2E8F0] hover:border-amber-300 hover:text-amber-800 hover:bg-amber-50 transition-colors max-w-[260px] truncate"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ============================================================================
   CASE CARD
   ========================================================================== */

function CaseCard({
  c,
  index,
  saved,
  onToggleSave,
  onCopyCitation,
  onGenerateBrief,
}: {
  c: CaseResult;
  index: number;
  saved: boolean;
  onToggleSave: () => void;
  onCopyCitation: () => void;
  onGenerateBrief: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[c.category] || CATEGORY_COLORS["—"];
  const relColor = RELEVANCE_BADGE[c.relevance || "Medium"] || RELEVANCE_BADGE["Medium"];
  const readingTime = estimateReadingTime(c.summary);
  const citationCount = useMemo(() => {
    const cit = extractCitations(`${c.title} ${c.summary}`);
    return cit.articles.length + cit.sections.length + cit.acts.length;
  }, [c]);
  const score = relevanceToScore(c.relevance);

  const sentences = c.summary ? c.summary.split(/(?<=\.)\s+/) : [];
  const keyHolding = sentences[0] || "";
  const rest = sentences.slice(1).join(" ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      className="group relative rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {c.category !== "—" && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catColor}`}>{c.category}</span>
          )}
          {c.court !== "—" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#E2E8F0] bg-slate-50 text-slate-600">
              🏛 {c.court}
            </span>
          )}
          {c.year !== "—" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#E2E8F0] bg-slate-50 text-slate-600">
              📅 {c.year}
            </span>
          )}
          {c.relevance && c.relevance !== "—" && (
            <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${relColor}`}>
              {c.relevance} · {score}/100
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-[#0F172A] leading-snug mb-1.5">{c.title}</h3>

        {keyHolding && (
          <p className="text-xs font-semibold text-amber-800 mb-1.5">
            Key holding: <span className="font-normal text-slate-700">{keyHolding}</span>
          </p>
        )}

        {rest && (
          <div className="mb-2">
            <p className={`text-sm text-slate-600 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>{rest}</p>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 mt-1"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 text-[10.5px] text-slate-400 mb-4 mt-3">
          <span>📖 {readingTime} min read</span>
          <span>🔗 {citationCount} citation{citationCount !== 1 ? "s" : ""}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E2E8F0]">
          {c.link && c.link !== "#" ? (
            <a
              href={c.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "#0F172A" }}
            >
              Read Judgment
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          ) : (
            <span className="text-[11px] text-slate-400 italic px-1">Link unavailable</span>
          )}

          <button
            onClick={onToggleSave}
            title={saved ? "Remove from saved" : "Save case"}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
              saved ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[#E2E8F0] text-slate-500 hover:border-slate-300"
            }`}
          >
            {saved ? "★ Saved" : "☆ Save"}
          </button>

          <button
            onClick={onCopyCitation}
            title="Copy citation"
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-slate-500 hover:border-slate-300 transition-colors"
          >
            ⧉ Cite
          </button>

          <button
            onClick={onGenerateBrief}
            title="Download case brief"
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-slate-500 hover:border-slate-300 transition-colors ml-auto"
          >
            ↓ Brief
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 rounded-full bg-slate-100" />
        <div className="h-5 w-12 rounded-full bg-slate-100" />
      </div>
      <div className="h-4 w-3/4 rounded bg-slate-100 mb-2" />
      <div className="h-3 w-full rounded bg-slate-100 mb-1" />
      <div className="h-3 w-5/6 rounded bg-slate-100 mb-1" />
      <div className="h-3 w-2/3 rounded bg-slate-100 mb-4" />
      <div className="h-3 w-24 rounded bg-amber-100" />
    </div>
  );
}

function ResultsEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-[#E2E8F0] flex items-center justify-center text-2xl mb-4">
        🔎
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">No cases match these filters</h3>
      <p className="text-xs text-slate-400 max-w-[260px]">
        Try clearing a filter or broadening your court, year, or relevance selection.
      </p>
    </motion.div>
  );
}

/* ============================================================================
   MAIN COMPONENT
   ========================================================================== */

export default function Research() {
useEffect(() => {
  // browser scroll restore band
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  // page force top
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 0);
}, []);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "ai",
      text: `Namaste! I'm your **Legal Research Assistant**.\n\nI'll help you find relevant Indian case laws from the Supreme Court, High Courts, and more.\n\n${STEPS[0].icon} ${STEPS[0].question}`,
    },
  ]);

  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [results, setResults] = useState<CaseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedCase, setSelectedCase] = useState<CaseDocument | null>(null);
  const [caseDocuments, setCaseDocuments] = useState<DocumentRecord[]>([]);
  const [researchSessions, setResearchSessions] = useState<ResearchSessionRecord[]>([]);
  const [cases, setCases] = useState<CaseDocument[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [showCitations, setShowCitations] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [clientFilters, setClientFilters] = useState<ClientFilters>({
    court: "All",
    year: "All",
    category: "All",
    relevance: "All",
    landmarkOnly: false,
    recentOnly: false,
    highRelevanceOnly: false,
  });

  const [savedCases, setSavedCases] = useState<CaseResult[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(savedCases));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [savedCases]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [recentSearches]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseTranscriptRef = useRef("");
  const recognitionRef = useRef<any>(null);

  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    const loadCases = async () => {
      const userId = auth.currentUser?.uid || 'anonymous';
      const result = await getCases(userId);
      if (result.success) {
        setCases(result.data);
        if (!selectedCaseId && result.data[0]) {
          setSelectedCaseId(String(result.data[0].id));
        }
      }
    };
    void loadCases();
  }, [selectedCaseId]);

  useEffect(() => {
    const loadCaseDetails = async () => {
      if (!selectedCaseId) {
        setSelectedCase(null);
        setCaseDocuments([]);
        return;
      }

      const userId = auth.currentUser?.uid || 'anonymous';
      const caseResult = await getCases(userId);
      if (caseResult.success) {
        const foundCase = caseResult.data.find((item) => String(item.id) === selectedCaseId) || null;
        setSelectedCase(foundCase);
      }

      const docsUserId = auth.currentUser?.uid || 'anonymous';
      const docsResult = await getDocuments(selectedCaseId, docsUserId);
      if (docsResult.success) {
        setCaseDocuments(docsResult.data || []);
      } else {
        setCaseDocuments([]);
      }

      const sessions = await aiService.loadResearchSessions(selectedCaseId);
      setResearchSessions(sessions);
    };

    void loadCaseDetails();
  }, [selectedCaseId]);

  /* ---- scroll to bottom ---- */
const scrollContainerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const container = scrollContainerRef.current;

  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }
}, [messages, results, loading, isTyping]);

  /* ---- focus input ---- */
  useEffect(() => {
    if (!done) textareaRef.current?.focus();
  }, [step, done]);

  /* ---- auto-expand textarea ---- */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  /* ---- toast auto-dismiss ---- */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---- voice recognition setup ---- */
  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceSupported(false);
      return;
    }
    const recog = new SpeechRecognitionCtor();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-IN";

    recog.onresult = (e: any) => {
      let finalTranscript = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t;
        else interim += t;
      }
      if (finalTranscript) baseTranscriptRef.current += finalTranscript;
      setInput((baseTranscriptRef.current + interim).trim());
    };
    recog.onerror = (e: any) => {
      setVoiceError(
        e?.error === "not-allowed" ? "Microphone access denied. Enable it in your browser settings." : "Voice input error. Please try again."
      );
      setIsListening(false);
    };
    recog.onend = () => setIsListening(false);

    recognitionRef.current = recog;
    return () => {
      recog.onresult = null;
      recog.onerror = null;
      recog.onend = null;
    };
  }, []);

  const toggleListening = () => {
    if (!voiceSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    baseTranscriptRef.current = input ? input + " " : "";
    setVoiceError(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setVoiceError("Could not start microphone.");
    }
  };

  const showToast = (msg: string) => setToast(msg);

  const addMessage = useCallback((role: "user" | "ai", text: string, references?: string[], sessionId?: string) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text, references, sessionId }]);
  }, []);

  /* ============================================================
     SEARCH LOGIC — unchanged: same API_URL, same fetch call,
     same request body, same response parsing/fallbacks.
     ============================================================ */
  const runSearch = useCallback(async (filtersToUse: Filters) => {
    setLoading(true);
    setStreamingText("");
    setError(null);

    setTimeout(() => {
      addMessage(
        "ai",
        "🔍 Searching across **Indian Kanoon**, **SCC Online**, **Law Insider India** and more...\n\nThis may take a few seconds."
      );
    }, 300);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filtersToUse),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const safe: CaseResult[] = Array.isArray(data) ? data : [data];

      const mapped = safe.map((item: any) => ({
        title: item.title || "Untitled Case",
        court: item.court || "—",
        year: String(item.year || "—"),
        category: item.category || "—",
        summary: item.summary || "",
        link: item.link || "#",
        relevance: item.relevance || "Medium",
      }));

      setResults(mapped);

      const count = safe.filter((c) => c.title !== "No cases found").length;

      setRecentSearches((prev) =>
        [...prev, { id: `${Date.now()}`, filters: filtersToUse, resultCount: count, timestamp: Date.now() }].slice(-10)
      );

      setTimeout(() => {
        addMessage(
          "ai",
          count > 0
            ? `✅ Found **${count} relevant case${count !== 1 ? "s" : ""}** matching your criteria. Scroll down to review the judgments.`
            : "⚠️ No cases matched your exact query. Try broadening your search with different keywords."
        );
      }, 500);
    } catch (err: any) {
      console.error("❌ Frontend error:", err);
      setError(err.message || "Something went wrong");
      addMessage(
        "ai",
        "❌ **Unable to fetch results** at this time.\n\nPlease check your connection or try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  }, [addMessage]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selectedCaseId) {
      if (!selectedCaseId) showToast("Select a case before starting research");
      return;
    }

    addMessage("user", text);
    setInput("");
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const updated = { ...filters, [STEPS[step].key]: text };
    setFilters(updated);

    const nextStep = step + 1;

    if (nextStep < STEPS.length) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addMessage("ai", `${STEPS[nextStep].icon} ${STEPS[nextStep].question}\n\n*${STEPS[nextStep].hint}*`);
        setStep(nextStep);
      }, 400);
      return;
    }

    setDone(true);
    setLoading(true);
    setStreamingText("");
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage = text;
    const promptTitle = `${selectedCase?.title || "Case"} — ${userMessage.slice(0, 40)}`;

    try {
      const result = await aiService.generateResearchResponse({
        prompt: userMessage,
        caseTitle: selectedCase?.title,
        documents: caseDocuments,
      });

      let built = "";
      for (let index = 0; index < result.response.length; index += 1) {
        if (controller.signal.aborted) break;
        built += result.response[index];
        setStreamingText(built);
        await new Promise((resolve) => setTimeout(resolve, 12));
      }

      const finalText = controller.signal.aborted ? built || "Generation stopped." : result.response;
      const sessionId = await aiService.saveResearchSession({
        sessionId: `${Date.now()}`,
        caseId: selectedCaseId,
        userId: auth.currentUser?.uid || "anonymous",
        title: promptTitle,
        prompt: userMessage,
        response: finalText,
        references: result.references,
      });

      addMessage("ai", finalText, result.references, sessionId || undefined);
      const sessions = await aiService.loadResearchSessions(selectedCaseId);
      setResearchSessions(sessions);
    } catch {
      addMessage("ai", "⚠️ Research generation failed. Please try again.");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      setStreamingText("");
    }
  };

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setLoading(false);
    setStreamingText("");
  }, []);

  const regenerateLastAnswer = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text;
    if (!lastUserMessage || !selectedCaseId) return;
    const trimmed = messages.filter((message) => message.role !== "ai" || Boolean(message.text));
    setMessages(trimmed);
    await handleSendWithPrompt(lastUserMessage);
  }, [handleSend, messages, selectedCaseId]);

  const handleSendWithPrompt = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text || !selectedCaseId) return;
    addMessage("user", text);
    setInput("");
    setDone(true);
    setLoading(true);
    setStreamingText("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await aiService.generateResearchResponse({
        prompt: text,
        caseTitle: selectedCase?.title,
        documents: caseDocuments,
      });

      let built = "";
      for (let index = 0; index < result.response.length; index += 1) {
        if (controller.signal.aborted) break;
        built += result.response[index];
        setStreamingText(built);
        await new Promise((resolve) => setTimeout(resolve, 12));
      }

      const finalText = controller.signal.aborted ? built || "Generation stopped." : result.response;
      const sessionId = await aiService.saveResearchSession({
        sessionId: `${Date.now()}`,
        caseId: selectedCaseId,
        userId: auth.currentUser?.uid || "anonymous",
        title: `${selectedCase?.title || "Case"} — ${text.slice(0, 40)}`,
        prompt: text,
        response: finalText,
        references: result.references,
      });
      addMessage("ai", finalText, result.references, sessionId || undefined);
      const sessions = await aiService.loadResearchSessions(selectedCaseId);
      setResearchSessions(sessions);
    } catch {
      addMessage("ai", "⚠️ Research generation failed. Please try again.");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      setStreamingText("");
    }
  }, [addMessage, caseDocuments, selectedCase?.title, selectedCaseId]);

  const handleChipPick = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const handleReset = () => window.location.reload();

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now(),
        role: "ai",
        text: `Namaste! I'm your **Legal Research Assistant**.\n\nI'll help you find relevant Indian case laws from the Supreme Court, High Courts, and more.\n\n${STEPS[0].icon} ${STEPS[0].question}`,
      },
    ]);
    setStep(0);
    setInput("");
    setFilters({});
    setResults([]);
    setDone(false);
    setError(null);
    setShowFilterPanel(false);
    setShowCitations(false);
    showToast("Chat cleared");
  };

  const handleRerun = (f: Filters) => {
    setHistoryOpen(false);
    setFilters(f);
    setDone(true);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "ai",
        text: `🔁 Re-running research for **${f.category || "your saved query"}**...`,
      },
    ]);
    runSearch(f);
  };

  const handleExportPDF = () => window.print();

  const handleCopySummary = async () => {
    const ok = await copyText(buildResearchSummary(filters, validResults));
    showToast(ok ? "Research summary copied" : "Could not copy summary");
  };

  const handleShare = async () => {
    const text = buildResearchSummary(filters, validResults);
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Legal Research Summary", text });
        return;
      } catch {
        /* user cancelled or share failed — fall back to clipboard */
      }
    }
    const ok = await copyText(text);
    showToast(ok ? "Summary copied — paste it anywhere to share" : "Sharing isn't supported on this browser");
  };

  const handleDownloadCitations = () => {
    const lines: string[] = ["AUTHORITIES REFERENCED", "======================="];
    validResults.forEach((c) => {
      const cit = extractCitations(`${c.title} ${c.summary}`);
      [...cit.articles, ...cit.sections, ...cit.acts].forEach((x) => lines.push(`• ${x}`));
    });
    downloadTextFile("citations.txt", lines.join("\n"));
    showToast("Citations downloaded");
  };

  const handleGenerateBrief = (c: CaseResult) => {
    downloadTextFile(`${slugify(c.title)}-brief.txt`, buildCaseBrief(c));
    showToast("Case brief downloaded");
  };

  const handleCopyCitation = (c: CaseResult) => {
    copyText(citationLine(c)).then((ok) => showToast(ok ? "Citation copied" : "Could not copy"));
  };

  const isSaved = (c: CaseResult) => savedCases.some((s) => s.title === c.title && s.link === c.link);
  const toggleSave = (c: CaseResult) => {
    const already = isSaved(c);
    setSavedCases((prev) => (already ? prev.filter((s) => !(s.title === c.title && s.link === c.link)) : [...prev, c]));
    showToast(already ? "Removed from saved" : "Case saved");
  };
  const removeSaved = (c: CaseResult) => {
    setSavedCases((prev) => prev.filter((s) => !(s.title === c.title && s.link === c.link)));
  };
  const openSaved = (c: CaseResult) => {
    if (c.link && c.link !== "#") window.open(c.link, "_blank", "noopener,noreferrer");
  };

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const deleted = await aiService.deleteResearchSession(sessionId);
    if (deleted) {
      setResearchSessions((prev) => prev.filter((session) => session.sessionId !== sessionId));
      showToast("Research session deleted");
    }
  }, []);

  const validResults = results.filter((c) => c.title !== "No cases found" && c.title !== "Error");

  const displayedResults = useMemo(() => {
    return validResults.filter((c) => {
      if (clientFilters.court !== "All" && c.court !== clientFilters.court) return false;
      if (clientFilters.year !== "All" && c.year !== clientFilters.year) return false;
      if (clientFilters.category !== "All" && c.category !== clientFilters.category) return false;
      if (clientFilters.relevance !== "All" && c.relevance !== clientFilters.relevance) return false;
      if (clientFilters.highRelevanceOnly && c.relevance !== "High") return false;
      if (clientFilters.landmarkOnly && c.relevance !== "High") return false;
      if (clientFilters.recentOnly) {
        const yr = parseInt(c.year, 10);
        if (!isNaN(yr) && yr < new Date().getFullYear() - 5) return false;
      }
      return true;
    });
  }, [validResults, clientFilters]);

  const showHero = step === 0 && messages.length === 1 && !done;
  const currentChips = !done && !showHero ? STEPS[step]?.chips : showHero ? POPULAR_TOPICS : undefined;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

        #research-root * { box-sizing: border-box; }
        #research-root ::-webkit-scrollbar { width: 5px; }
        #research-root ::-webkit-scrollbar-track { background: transparent; }
        #research-root ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
        #research-root ::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }

        .chat-bubble-ai {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          box-shadow: 0 2px 10px rgba(15,23,42,0.04);
          border-radius: 4px 16px 16px 16px;
        }
        .chat-bubble-user {
          background: linear-gradient(135deg, #D97706, #B45309);
          box-shadow: 0 6px 18px rgba(217,119,6,0.25);
          border-radius: 16px 4px 16px 16px;
        }
        .glass-input {
          background: #FFFFFF;
          border: 1.5px solid #E2E8F0;
          font-weight: 500;
          resize: none;
        }
        .glass-input::placeholder { color: #94A3B8; }
        .glass-input:focus { border-color: #D97706; outline: none; box-shadow: 0 0 0 3px rgba(217,119,6,0.12); }

        .typing-cursor { display:inline-block; width:2px; margin-left:1px; animation: blink 0.9s step-end infinite; color:#D97706; }
        @keyframes blink { 50% { opacity: 0; } }

        @media print {
          .no-print { display: none !important; }
          #research-root { background: #fff !important; height: auto !important; }
        }
      `}</style>

   <div
  id="research-root"
  style={{
    fontFamily: "'DM Sans', sans-serif",
    background: "#FAF8F4"
  }}
  className="relative w-full h-[calc(100vh-80px)] flex flex-col overflow-hidden"
>
        <Header
          onNewResearch={handleReset}
          onExportPDF={handleExportPDF}
          onClearChat={handleClearChat}
          onToggleHistory={() => setHistoryOpen((v) => !v)}
          historyOpen={historyOpen}
          savedCount={savedCases.length}
          hasResults={validResults.length > 0}
        />

        <AnimatePresence>
          {historyOpen && (
            <HistoryPanel
              recentSearches={recentSearches}
              savedCases={savedCases}
              onRerun={handleRerun}
              onOpenSaved={openSaved}
              onRemoveSaved={removeSaved}
              onClose={() => setHistoryOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── SCROLLABLE CONVERSATION AREA ── */}
        <div
   ref={scrollContainerRef}
   className="flex-1 min-h-0 overflow-y-auto"
>
          <div className="max-w-[1100px] mx-auto px-6 pb-32">
            {showHero && <HeroState onPick={handleChipPick} />}

            <div className="flex flex-col gap-4 py-6">
              {!showHero && currentChips && currentChips.length > 0 && (
                <QuickReplyChips chips={currentChips} onPick={handleChipPick} />
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={`flex ${msg.role === "ai" ? "justify-start" : "justify-end"}`}
                  >
                    {msg.role === "ai" && (
                      <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[11px] mr-2 flex-shrink-0 mt-1">
                        ⚖
                      </div>
                    )}
                    <div
                      className={msg.role === "ai" ? "chat-bubble-ai" : "chat-bubble-user"}
                      style={{
                        maxWidth: "82%",
                        padding: "10px 14px",
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: msg.role === "ai" ? "#0F172A" : "#FFFFFF",
                        fontWeight: 500,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.role === "ai" ? (
                        <StreamingText text={msg.text} />
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: renderInline(msg.text) }} />
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>{isTyping && <ThinkingBubble />}</AnimatePresence>

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
                  <p className="text-[11px] text-slate-400 text-center mb-4 tracking-wide">
                    Searching legal databases...
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {[1, 2, 3].map((i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                </motion.div>
              )}

              {!loading && results.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="mt-2">
                  {validResults.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700">
                          {validResults.length} case{validResults.length !== 1 ? "s" : ""} found
                        </span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-[11px] text-slate-400">
                          showing {displayedResults.length}
                        </span>

                        <div className="ml-auto flex flex-wrap gap-1.5">
                          <IconButton onClick={() => setShowFilterPanel((v) => !v)} title="Filter results" active={showFilterPanel}>
                            ⚗ Filters
                          </IconButton>
                          <IconButton onClick={() => setShowInsights((v) => !v)} title="Toggle insights" active={showInsights}>
                            ✨ Insights
                          </IconButton>
                          <IconButton onClick={() => setShowCitations((v) => !v)} title="Toggle authorities" active={showCitations}>
                            📑 Citations
                          </IconButton>
                          <IconButton onClick={handleCopySummary} title="Copy research summary">
                            ⧉ Copy
                          </IconButton>
                          <IconButton onClick={handleShare} title="Share research">
                            ↗ Share
                          </IconButton>
                          <IconButton onClick={handleDownloadCitations} title="Download citations">
                            ↓ Citations
                          </IconButton>
                        </div>
                      </div>

                      {showInsights && <InsightsPanel results={validResults} />}

                      <AnimatePresence>
                        {showFilterPanel && (
                          <FilterPanel results={validResults} filters={clientFilters} onChange={setClientFilters} />
                        )}
                      </AnimatePresence>

                      {showCitations && (
                        <CitationsPanel
                          results={validResults}
                          onCopy={(text) => copyText(text).then((ok) => showToast(ok ? `Copied: ${text}` : "Could not copy"))}
                        />
                      )}

                      <div className="flex flex-col gap-2.5">
                        {displayedResults.length === 0 ? (
                          <ResultsEmptyState />
                        ) : (
                          displayedResults.map((c, i) => (
                            <CaseCard
                              key={`${c.title}-${i}`}
                              c={c}
                              index={i}
                              saved={isSaved(c)}
                              onToggleSave={() => toggleSave(c)}
                              onCopyCitation={() => handleCopyCitation(c)}
                              onGenerateBrief={() => handleGenerateBrief(c)}
                            />
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center py-16 text-center"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-[#E2E8F0] flex items-center justify-center text-2xl mb-4">
                        🔎
                      </div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-1">No Cases Found</h3>
                      <p className="text-xs text-slate-400 max-w-[240px]">
                        Try different keywords, broaden your court selection, or adjust the time range.
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {error && !loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-2 p-4 rounded-2xl text-center bg-rose-50 border border-rose-200"
                >
                  <p className="text-xs text-rose-600 mb-1">⚠️ Request Failed</p>
                  <p className="text-[11px] text-slate-600">{error}</p>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>
        </div>

        {/* ── PROGRESS TIMELINE ── */}
        {!showHero && <ProgressTimeline step={step} filters={filters} loading={loading} done={done} hasResults={validResults.length > 0} />}

        {/* ── AI INPUT BAR ── */}
        <div className="no-print flex-shrink-0 border-t border-[#E2E8F0] bg-white/80 backdrop-blur-sm">
          <div className="max-w-[1100px] mx-auto px-6 py-3">
            {!done ? (
              <>
                <div
                  className="glass-input flex items-end gap-2 px-3 py-2"
                  style={{ borderRadius: 24 }}
                >
                  <button
                    onClick={toggleListening}
                    title={voiceSupported ? (isListening ? "Stop listening" : "Start voice input") : "Voice input not supported in this browser"}
                    disabled={!voiceSupported}
                    className={`relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                      !voiceSupported
                        ? "text-slate-300 cursor-not-allowed"
                        : isListening
                        ? "bg-rose-500 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {isListening && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-rose-400"
                        animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    )}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="relative">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
                    </svg>
                  </button>

                  <button
                    onClick={() => showToast("Attachments aren't available in this research workspace yet")}
                    title="Attach a file"
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    maxLength={600}
                    placeholder={STEPS[step]?.hint || "Type your answer..."}
                    className="flex-1 resize-none bg-transparent outline-none text-[13px] py-1.5 leading-relaxed"
                    style={{ maxHeight: 160 }}
                  />

                  <span className="flex-shrink-0 text-[10px] text-slate-300 self-end mb-2 tabular-nums">
                    {input.length}/600
                  </span>

                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: input.trim() ? "linear-gradient(135deg, #D97706, #B45309)" : "#F1F5F9",
                      color: input.trim() ? "#fff" : "#94A3B8",
                      cursor: input.trim() ? "pointer" : "not-allowed",
                      boxShadow: input.trim() ? "0 4px 14px rgba(217,119,6,0.3)" : "none",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="m22 2-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>

                {voiceError && <p className="text-[10.5px] text-rose-500 mt-1.5 pl-2">{voiceError}</p>}
                {isListening && (
                  <p className="text-[10.5px] text-amber-700 mt-1.5 pl-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Listening — speak now
                  </p>
                )}

                <p className="text-center mt-2.5 text-[9.5px] text-slate-400 tracking-wide">
                  Enter to send · Shift+Enter for new line · AI-assisted research, not legal advice
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleClearChat}
                    className="flex-1 min-w-[160px] py-2.5 rounded-2xl border border-[#E2E8F0] bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16M8 16H3v5" />
                    </svg>
                    Start New Research
                  </button>
                  <button
                    onClick={() => textareaRef.current?.focus()}
                    disabled
                    className="hidden"
                  />
                </div>
                <p className="text-center mt-2.5 text-[9.5px] text-slate-400 tracking-wide">
                  AI-assisted research · Not legal advice · Always verify with a qualified advocate
                </p>
              </>
            )}
          </div>
        </div>

        <AnimatePresence>{toast && <Toast message={toast} />}</AnimatePresence>
      </div>
    </>
  );
}