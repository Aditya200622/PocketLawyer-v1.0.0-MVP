import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getDocuments, type DocumentRecord } from "../services/documentService";
import { aiService, type AiChatMessage } from "../services/aiService";
import { auth } from "../firebase";
import {
  Scale,
  Send,
  Paperclip,
  Search,
  Plus,
  FileText,
  Image as ImageIcon,
  Mic,
  Eye,
  ChevronDown,
  X,
  Sparkles,
  BookOpen,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  HelpCircle,
  Globe,
  Gavel,
  Upload,
  Loader2,
  FolderOpen,
  Pin,
  History,
  PenLine,
  Archive,
  Calendar as CalendarIcon,
  PanelRightOpen,
  PanelRightClose,
  FileSearch,
  ScrollText,
  FileSignature,
  ClipboardList,
  MessagesSquare,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface Case {
  id: string | number;
  title: string;
  status?: "Active" | "Pending" | "Closed";
  description?: string;
  type?: string;
  court?: string;
  date?: string;
  pinned?: boolean;
  nextHearing?: string;
}

interface Evidence {
  id?: string;
  name?: string;
  title?: string;
  type?: string;
  size?: number;
  url?: string;
  caseId?: string | number;
}

interface Message {
  role: "ai" | "user";
  content: string;
  time: string;
  lang?: string;
}

interface ResearchItem {
  id: string;
  query: string;
  time: string;
}

interface DraftItem {
  id: string;
  title: string;
  type: string;
  time: string;
}

interface AiAssistantProps {
  cases?: Case[];
  evidence?: Evidence[];
  selectedCase?: Case | null;
  recentResearch?: ResearchItem[];
  recentDrafts?: DraftItem[];
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const buildCaseSummary = (c: Case | null) => {
  if (!c) return "No case selected";
  return `
Case Title: ${c.title}
Type: ${c.type || "Unknown"}
Court: ${c.court || "Unknown"}
Status: ${c.status || "Unknown"}

Description:
${c.description || "Not provided"}
`;
};

const formatEvidence = (evidenceList: Evidence[]) => {
  if (!evidenceList || evidenceList.length === 0) return "No evidence uploaded";
  return evidenceList
    .map((e, i) => `Evidence ${i + 1}: ${e.name || e.title || "Document"} ${e.type ? `(${e.type})` : ""}`)
    .join("\n");
};

const getFileIcon = (type?: string) => {
  if (!type) return <FileText size={14} />;
  const t = type.toLowerCase();
  if (t.includes("image") || t.includes("jpg") || t.includes("png")) return <ImageIcon size={14} />;
  if (t.includes("audio") || t.includes("mp3")) return <Mic size={14} />;
  return <FileText size={14} />;
};

const getStatusStyle = (status?: string) => {
  switch (status) {
    case "Active":
      return { bg: "bg-[#ECFDF5]", text: "text-[#10B981]", dot: "bg-[#10B981]" };
    case "Pending":
      return { bg: "bg-[#FFF7ED]", text: "text-[#FF7A1A]", dot: "bg-[#FF7A1A]" };
    case "Closed":
      return { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" };
    default:
      return { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" };
  }
};

const ACTION_CARDS = [
  {
    label: "Research Case Law",
    desc: "Find precedents & citations",
    icon: <FileSearch size={18} />,
    prompt: "Help me research relevant case law for this matter.",
  },
  {
    label: "Draft Legal Notice",
    desc: "Formal notice in minutes",
    icon: <ScrollText size={18} />,
    prompt: "Please draft a formal legal notice for this case.",
  },
  {
    label: "Generate Petition",
    desc: "Court-ready petition draft",
    icon: <FileSignature size={18} />,
    prompt: "Help me draft a petition for this matter with all necessary details.",
  },
  {
    label: "Analyze Evidence",
    desc: "Surface gaps & contradictions",
    icon: <ClipboardList size={18} />,
    prompt: "Please analyze all the evidence uploaded for this case.",
  },
  {
    label: "Summarize Documents",
    desc: "Key facts, fast",
    icon: <BookOpen size={18} />,
    prompt: "Please summarize the key documents and facts for this case.",
  },
  {
    label: "Prepare Arguments",
    desc: "Build your strongest case",
    icon: <MessagesSquare size={18} />,
    prompt: "Help me prepare arguments and strategy for this case.",
  },
];

const SMART_SUGGESTIONS = [
  { label: "Draft Legal Notice", icon: <BookOpen size={13} /> },
  { label: "Generate FIR", icon: <AlertCircle size={13} /> },
  { label: "Summarize Evidence", icon: <Sparkles size={13} /> },
  { label: "Check IPC Sections", icon: <Scale size={13} /> },
];

const fmtTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─────────────────────────────────────────────────────────────────────────
// Signature element — "The Brief Seal"
// An animated wax-seal-inspired orb: the AI's mark on every brief.
// ─────────────────────────────────────────────────────────────────────────

const BriefSeal = ({ size = 88, pulse = true }: { size?: number; pulse?: boolean }) => {
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {pulse && (
        <div
          className="absolute inset-0 rounded-full animate-seal-ring"
          style={{
            background: "radial-gradient(circle, rgba(255,122,26,0.18) 0%, transparent 70%)",
          }}
        />
      )}
      <div
        className="absolute inset-0 rounded-full animate-seal-spin"
        style={{
          background:
            "conic-gradient(from 0deg, #FF7A1A, #FFB366, #8B5CF6, #FF7A1A)",
          padding: 2,
          maskImage: "radial-gradient(circle, transparent 62%, black 63%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 62%, black 63%)",
        }}
      />
      <div
        className="relative rounded-full flex items-center justify-center shadow-lg"
        style={{
          width: size * 0.78,
          height: size * 0.78,
          background: "linear-gradient(135deg, #1E2A44 0%, #15203A 100%)",
          boxShadow: "0 8px 32px rgba(255,122,26,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <Scale size={size * 0.34} className="text-[#FFB366]" strokeWidth={1.75} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Typing indicator
// ─────────────────────────────────────────────────────────────────────────

const TypingLoader = () => (
  <div className="flex items-start gap-3 mb-6 animate-rise-in">
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ background: "linear-gradient(135deg, #1E2A44, #15203A)" }}
    >
      <Gavel size={13} className="text-[#FFB366]" />
    </div>
    <div className="flex items-center gap-1.5 h-8 px-1">
      <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A1A]/70 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A1A]/70 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A1A]/70 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Message rendering — structured first-response cards, plain markdown after
// ─────────────────────────────────────────────────────────────────────────

const STRUCTURE_SECTIONS = [
  { emoji: "🔍", label: "Case Analysis", icon: <Search size={13} />, accent: "#8B5CF6" },
  { emoji: "⚖️", label: "Legal Issues & Risks", icon: <AlertCircle size={13} />, accent: "#EF4444" },
  { emoji: "📊", label: "Chances / Probability", icon: <TrendingUp size={13} />, accent: "#10B981" },
  { emoji: "🧠", label: "Suggested Strategy", icon: <Lightbulb size={13} />, accent: "#FF7A1A" },
  { emoji: "❓", label: "Questions for User", icon: <HelpCircle size={13} />, accent: "#8B5CF6" },
];

const renderInlineMarkdown = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#0F172A]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const AiContent = ({ content }: { content: string }) => {
  if (!content) return null;

  const codeBlockPattern = /```([\s\S]*?)```/g;
  const parts = content.split(codeBlockPattern);
  const hasStructure = STRUCTURE_SECTIONS.some((s) => content.includes(s.emoji));

  if (hasStructure) {
    return (
      <div className="space-y-3">
        {STRUCTURE_SECTIONS.map((sec) => {
          const pattern = new RegExp(
            `${sec.emoji}\\s*${sec.label}:\\s*([\\s\\S]*?)(?=${STRUCTURE_SECTIONS.map((s) => s.emoji).join("|")}|$)`,
            "i"
          );
          const match = content.match(pattern);
          if (!match || !match[1]?.trim()) return null;
          return (
            <div
              key={sec.label}
              className="rounded-xl border border-slate-200/80 bg-white p-4"
              style={{ borderLeftWidth: 3, borderLeftColor: sec.accent }}
            >
              <div className="flex items-center gap-2 font-semibold text-[11px] uppercase tracking-wide mb-2" style={{ color: sec.accent }}>
                {sec.icon}
                <span>{sec.label}</span>
              </div>
              <div className="text-[14px] text-slate-700 leading-[1.7] whitespace-pre-wrap">
                {renderInlineMarkdown(match[1].trim())}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="text-[15px] text-slate-700 leading-[1.7] space-y-3">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <pre key={index} className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-[12px] text-slate-100">
              <code>{part}</code>
            </pre>
          );
        }

        const lines = part.split(/(\n)/g);
        return (
          <div key={index} className="whitespace-pre-wrap">
            {lines.map((line, lineIndex) => {
              if (line === "\n") return <br key={lineIndex} />;
              if (line.startsWith("- ")) {
                return <div key={lineIndex} className="ml-3">• {renderInlineMarkdown(line.slice(2))}</div>;
              }
              return <div key={lineIndex}>{renderInlineMarkdown(line)}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
};

const MessageBubble = ({
  message,
  onCopy,
  onRegenerate,
}: {
  message: Message;
  onCopy?: () => void;
  onRegenerate?: () => void;
}) => {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-6 animate-rise-in">
        <div className="max-w-[78%]">
          <div
            className="text-white rounded-2xl rounded-br-md px-4 py-3 shadow-sm"
            style={{ background: "linear-gradient(135deg, #1E2A44, #2C3B5C)" }}
          >
            <p className="text-[15px] leading-relaxed">{message.content}</p>
          </div>
          <p className="text-[10px] text-slate-400 text-right mt-1.5 mr-1">{message.time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-6 max-w-full animate-rise-in">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, #1E2A44, #15203A)" }}
      >
        <Gavel size={13} className="text-[#FFB366]" />
      </div>
      <div className="max-w-[85%] min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={onCopy}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 hover:text-[#FF7A1A]"
          >
            Copy
          </button>
          <button
            onClick={onRegenerate}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 hover:text-[#FF7A1A]"
          >
            Regenerate
          </button>
        </div>
        <AiContent content={message.content} />
        <p className="text-[10px] text-slate-400 mt-2 ml-0.5">{message.time}</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Compact welcome strip — sits ABOVE the input, inside the scroll area.
// Not a full-screen takeover. Disappears once a conversation starts.
// ─────────────────────────────────────────────────────────────────────────

const WelcomeStrip = ({
  activeCase,
  onAction,
}: {
  activeCase: Case | null;
  onAction: (prompt: string) => void;
}) => {
  return (
    <div className="px-4 sm:px-6 pt-5 pb-2 animate-rise-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <BriefSeal size={40} pulse={false} />
          <div className="min-w-0">
            <h1
              className="text-[18px] font-semibold text-[#0F172A] leading-tight"
              style={{ fontFamily: "'Fraunces', 'Georgia', serif" }}
            >
              AI Legal Co-Counsel
            </h1>
            <p className="text-[12.5px] text-slate-500 leading-snug">
              Research case law, draft notices, analyze evidence and prepare arguments.
            </p>
          </div>
        </div>

        {!activeCase && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#FF7A1A] bg-[#FFF7ED] border border-[#FFE4C7] rounded-full px-2.5 py-1">
            <AlertCircle size={11} />
            Select a case for case-specific context, or ask a general question
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {ACTION_CARDS.map((card) => (
            <button
              key={card.label}
              onClick={() => onAction(card.prompt)}
              className="group flex items-center gap-1.5 text-left rounded-xl border border-slate-200 bg-white pl-2.5 pr-3 py-2 transition-all duration-150 hover:border-[#FFB366] hover:bg-[#FFF7ED]"
            >
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#FFF1E3", color: "#FF7A1A" }}
              >
                {React.cloneElement(card.icon, { size: 13 })}
              </span>
              <span className="text-[12.5px] font-medium text-slate-700">{card.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-4xl mx-auto border-b border-slate-100 mt-5" />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Chat input
// ─────────────────────────────────────────────────────────────────────────

const ChatInput = ({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  disabled,
  hasMessages,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  loading: boolean;
  disabled: boolean;
  hasMessages: boolean;
}) => {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) onSend();
    }
  };

  return (
    <div className="border-t border-slate-100 bg-white px-4 sm:px-6 py-3.5">
      <div className="max-w-4xl mx-auto">
        {!disabled && !hasMessages && (
          <div className="flex gap-2 overflow-x-auto pb-2.5 hide-scrollbar">
            {SMART_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => onChange(s.label)}
                className="flex items-center gap-1.5 text-[12px] text-slate-600 rounded-full px-3 py-1.5 whitespace-nowrap transition-all duration-200 flex-shrink-0 font-medium border border-slate-200 bg-slate-50 hover:border-[#FFB366] hover:text-[#FF7A1A] hover:bg-[#FFF7ED]"
              >
                <span className="text-[#FF7A1A]">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative group">
            <div
              className="absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none"
              style={{ boxShadow: "0 0 0 3px rgba(255,122,26,0.12)" }}
            />
            <textarea
              rows={1}
              value={value}
              disabled={disabled}
              onChange={(e) => {
                onChange(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={handleKey}
              placeholder="Apna case describe karein ya koi question poochhein..."
              className="relative w-full resize-none border border-slate-200 rounded-2xl pl-4 pr-20 py-3 text-[14.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF7A1A] transition-all bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed max-h-[160px] leading-relaxed"
              style={{ overflow: "hidden" }}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2.5">
              <button
                disabled={disabled}
                className="text-slate-400 hover:text-[#FF7A1A] transition-colors disabled:opacity-40"
                aria-label="Attach file"
              >
                <Paperclip size={16} />
              </button>
              <button
                disabled={disabled}
                className="text-slate-400 hover:text-[#FF7A1A] transition-colors disabled:opacity-40"
                aria-label="Voice input"
              >
                <Mic size={16} />
              </button>
            </div>
          </div>
          {loading ? (
            <button
              onClick={onStop}
              className="h-[46px] px-3 rounded-2xl text-white flex items-center justify-center shadow-sm transition-all duration-200 flex-shrink-0 hover:shadow-md active:scale-[0.95]"
              style={{ background: "linear-gradient(135deg, #DC2626, #F97316)" }}
              aria-label="Stop generation"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={loading || !value.trim() || disabled}
              className="h-[46px] w-[46px] rounded-2xl text-white flex items-center justify-center shadow-sm transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed flex-shrink-0 hover:shadow-md active:scale-[0.95]"
              style={{ background: "linear-gradient(135deg, #FF7A1A, #FF9A4D)" }}
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          )}
        </div>
        <p className="text-[10.5px] text-slate-300 text-center mt-2">
          AI can make mistakes. Verify critical legal information independently.
        </p>
      </div>
    </div>
  );
};

const CaseRow = ({ c, active, onSelect }: { c: Case; active: boolean; onSelect: () => void }) => {
  const s = getStatusStyle(c.status);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl px-3 py-2.5 transition-all duration-200 group ${
        active ? "shadow-sm" : "hover:bg-slate-50"
      }`}
      style={
        active
          ? { background: "linear-gradient(135deg, #FFF7ED, #FFF1E3)", border: "1px solid #FFD8A8" }
          : { border: "1px solid transparent" }
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[12.5px] font-semibold leading-tight line-clamp-2 ${active ? "text-[#B8520A]" : "text-slate-700"}`}>
          {c.pinned && <Pin size={10} className="inline mr-1 -mt-0.5 text-[#FF7A1A]" />}
          {c.title}
        </p>
        {c.status && (
          <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}>
            <span className={`w-1 h-1 rounded-full ${s.dot}`} />
            {c.status}
          </span>
        )}
      </div>
      {(c.type || c.court) && (
        <p className="text-[10.5px] text-slate-400 mt-1 font-medium truncate">
          {c.type}
          {c.court ? ` · ${c.court}` : ""}
        </p>
      )}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Right panel — Case Context & AI Tools
// ─────────────────────────────────────────────────────────────────────────

const ContextSection = ({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="px-4 py-3.5 border-b border-slate-100">
    <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">
      <span className="text-slate-400">{icon}</span>
      {label}
    </div>
    {children}
  </div>
);

const ContextPanel = ({
  activeCase,
  evidence,
  research,
  drafts,
}: {
  activeCase: Case | null;
  evidence: Evidence[];
  research: ResearchItem[];
  drafts: DraftItem[];
}) => {
  if (!activeCase) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#FFF1E3" }}
          >
            <FolderOpen size={15} className="text-[#FF7A1A]" />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-slate-600">No case selected</p>
            <p className="text-[11px] text-slate-400 leading-snug">Tap the case name above to pick one</p>
          </div>
        </div>

        <ContextSection label="Evidence" icon={<Archive size={13} />}>
          <p className="text-[11.5px] text-slate-400">—</p>
        </ContextSection>
        <ContextSection label="Upcoming Hearing" icon={<CalendarIcon size={13} />}>
          <p className="text-[11.5px] text-slate-400">—</p>
        </ContextSection>
        <ContextSection label="Research History" icon={<History size={13} />}>
          {research.length === 0 ? (
            <p className="text-[11.5px] text-slate-400">No research yet</p>
          ) : (
            <div className="space-y-1.5">
              {research.slice(0, 4).map((r) => (
                <p key={r.id} className="text-[11.5px] text-slate-500 truncate">
                  · {r.query}
                </p>
              ))}
            </div>
          )}
        </ContextSection>
        <ContextSection label="Recent Drafts" icon={<PenLine size={13} />}>
          {drafts.length === 0 ? (
            <p className="text-[11.5px] text-slate-400">No drafts yet</p>
          ) : (
            <div className="space-y-1.5">
              {drafts.slice(0, 4).map((d) => (
                <p key={d.id} className="text-[11.5px] text-slate-500 truncate">
                  · {d.title}
                </p>
              ))}
            </div>
          )}
        </ContextSection>
      </div>
    );
  }

  const s = getStatusStyle(activeCase.status);
  const pinnedDocs = evidence.filter((e: any) => (e as any).pinned);

  return (
    <div className="flex-1 overflow-y-auto">
      <ContextSection label="Selected Case" icon={<FolderOpen size={13} />}>
        <p className="text-[13px] font-semibold text-[#0F172A] leading-snug">{activeCase.title}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {activeCase.status && (
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {activeCase.status}
            </span>
          )}
          {activeCase.type && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
              {activeCase.type}
            </span>
          )}
        </div>
        {activeCase.court && <p className="text-[11.5px] text-slate-400 mt-2">{activeCase.court}</p>}
      </ContextSection>

      {/* Quick stats row — keeps density high, avoids dead space */}
      <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-slate-100">
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Evidence</p>
          <p className="text-[15px] font-bold text-[#0F172A] mt-0.5">{evidence.length}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Drafts</p>
          <p className="text-[15px] font-bold text-[#0F172A] mt-0.5">{drafts.length}</p>
        </div>
      </div>

      <ContextSection label="Evidence" icon={<Archive size={13} />}>
        {evidence.length === 0 ? (
          <button className="w-full flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-[#FF7A1A] border border-dashed border-[#FFB366] rounded-xl px-3 py-2 hover:bg-[#FFF7ED] transition-colors">
            <Upload size={12} />
            Upload Evidence
          </button>
        ) : (
          <div className="space-y-1.5">
            {evidence.map((e, i) => (
              <div
                key={e.id || i}
                className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100 group hover:border-[#FFB366] transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[#FF7A1A] flex-shrink-0">{getFileIcon(e.type)}</span>
                  <p className="text-[11.5px] font-medium text-slate-600 truncate">{e.name || e.title || "Document"}</p>
                </div>
                <Eye size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 flex-shrink-0" />
              </div>
            ))}
            <button className="w-full mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#FF7A1A] border border-dashed border-[#FFB366] rounded-lg py-2 hover:bg-[#FFF7ED] transition-colors">
              <Upload size={11} />
              Add more
            </button>
          </div>
        )}
      </ContextSection>

      <ContextSection label="Pinned Documents" icon={<Pin size={13} />}>
        {pinnedDocs.length === 0 ? (
          <p className="text-[11.5px] text-slate-400">No pinned documents</p>
        ) : (
          <div className="space-y-1.5">
            {pinnedDocs.map((e, i) => (
              <p key={e.id || i} className="text-[11.5px] text-slate-500 truncate">
                · {e.name || e.title}
              </p>
            ))}
          </div>
        )}
      </ContextSection>

      <ContextSection label="Upcoming Hearing" icon={<CalendarIcon size={13} />}>
        {activeCase.nextHearing ? (
          <div className="rounded-lg bg-[#FFF7ED] border border-[#FFE4C7] px-3 py-2.5">
            <p className="text-[12.5px] font-semibold text-[#B8520A]">{activeCase.nextHearing}</p>
          </div>
        ) : (
          <p className="text-[11.5px] text-slate-400">No hearing scheduled</p>
        )}
      </ContextSection>

      <ContextSection label="Research History" icon={<History size={13} />}>
        {research.length === 0 ? (
          <p className="text-[11.5px] text-slate-400">No research yet for this case</p>
        ) : (
          <div className="space-y-1.5">
            {research.slice(0, 4).map((r) => (
              <p key={r.id} className="text-[11.5px] text-slate-500 truncate">
                · {r.query}
              </p>
            ))}
          </div>
        )}
      </ContextSection>

      <ContextSection label="Recent Drafts" icon={<PenLine size={13} />}>
        {drafts.length === 0 ? (
          <p className="text-[11.5px] text-slate-400">No drafts yet for this case</p>
        ) : (
          <div className="space-y-1.5">
            {drafts.slice(0, 4).map((d) => (
              <p key={d.id} className="text-[11.5px] text-slate-500 truncate">
                · {d.title}
              </p>
            ))}
          </div>
        )}
      </ContextSection>

      <ContextSection label="AI Context" icon={<Sparkles size={13} />}>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          The assistant is using this case's details and {evidence.length} evidence item{evidence.length === 1 ? "" : "s"} to ground its answers.
        </p>
      </ContextSection>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Chat window (center panel, conversation in progress)
// ─────────────────────────────────────────────────────────────────────────

const ChatWindow = ({
  messages,
  loading,
  activeCase,
  onAction,
  onCopy,
  onRegenerate,
}: {
  messages: Message[];
  loading: boolean;
  activeCase: Case | null;
  onAction: (prompt: string) => void;
  onCopy: (index: number) => void;
  onRegenerate: (index: number) => void;
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <WelcomeStrip activeCase={activeCase} onAction={onAction} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
      <div className="max-w-4xl mx-auto">
        {messages.map((m, i) => (
          <MessageBubble
            key={`${m.role}-${i}`}
            message={m}
            onCopy={m.role === "ai" ? () => onCopy(i) : undefined}
            onRegenerate={m.role === "ai" ? () => onRegenerate(i) : undefined}
          />
        ))}
        {loading && <TypingLoader />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main page — AiAssistant
// ─────────────────────────────────────────────────────────────────────────

type Props = AiAssistantProps;

export const AiAssistant: React.FC<Props> = ({
  cases: propCases,
  evidence: propEvidence,
  selectedCase: propSelected,
  recentResearch,
  recentDrafts,
}) => {
  // No dummy data: render exactly what's passed in. Empty arrays => empty states.
  const cases = propCases || [];
  const allEvidence = propEvidence || [];
  const research = recentResearch || [];
  const drafts = recentDrafts || [];

  const [activeCase, setActiveCase] = useState<Case | null>(propSelected || null);
  const [caseDocuments, setCaseDocuments] = useState<DocumentRecord[]>([]);

  const evidence = activeCase ? allEvidence.filter((e) => e.caseId === activeCase.id) : [];

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [caseSwitcherOpen, setCaseSwitcherOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const [lang, setLang] = useState<"auto" | "en" | "hi">("auto");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!propSelected) {
      setActiveCase(null);
      setMessages([]);
      setCaseDocuments([]);
      return;
    }
    setActiveCase(propSelected);
  }, [propSelected]);

  useEffect(() => {
    const loadCaseData = async () => {
      if (!activeCase) {
        setMessages([]);
        setCaseDocuments([]);
        return;
      }

      const caseId = String(activeCase.id);
      const userId = auth.currentUser?.uid || 'anonymous';
      const docsResult = await getDocuments(caseId, userId);
      if (docsResult.success) {
        setCaseDocuments(docsResult.data ?? []);
      } else {
        setCaseDocuments([]);
      }

      const persisted = await aiService.loadChatMessages(caseId);
      setMessages(persisted.map((message: AiChatMessage) => ({ ...message, role: message.role as "ai" | "user" })));
    };

    void loadCaseData();
  }, [activeCase]);

  const selectCase = useCallback((c: Case) => {
    setActiveCase(c);
  }, []);

  const pushMessages = useCallback((updated: Message[]) => {
    setMessages(updated);
  }, []);

  const sendMessage = useCallback(
    async (text?: string, historyOverride?: Message[]) => {
      const content = (text || input).trim();
      if (!content || loading) return;

      const currentHistory = historyOverride ?? messages;
      const now = fmtTime();
      const userMsg: Message = { role: "user", content, time: now };
      const withUser = [...currentHistory, userMsg];
      pushMessages(withUser);
      setInput("");
      setLoading(true);

      const caseId = activeCase ? String(activeCase.id) : null;
      if (caseId) {
        await aiService.saveChatMessages(caseId, withUser.map((msg) => ({ role: msg.role, content: msg.content, time: msg.time, lang: msg.lang })));
      }

      const aiPlaceholder: Message = { role: "ai", content: "", time: fmtTime() };
      const streamingMessages = [...withUser, aiPlaceholder];
      pushMessages(streamingMessages);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await aiService.generateCaseAwareReply({
          prompt: content,
          caseTitle: activeCase?.title,
          caseSummary: buildCaseSummary(activeCase),
          documents: caseDocuments,
          conversation: withUser.map((msg) => ({ role: msg.role, content: msg.content, time: msg.time, lang: msg.lang })),
        });

        let built = "";
        for (let index = 0; index < response.length; index += 1) {
          if (controller.signal.aborted) break;
          built += response[index];
          pushMessages([...withUser, { ...aiPlaceholder, content: built, time: aiPlaceholder.time }]);
          await new Promise((resolve) => setTimeout(resolve, 12));
        }

        const aiMsg: Message = {
          role: "ai",
          content: controller.signal.aborted ? built || "Generation stopped." : response,
          time: fmtTime(),
        };
        const finalMessages = [...withUser, aiMsg];
        pushMessages(finalMessages);
        if (caseId) {
          await aiService.saveChatMessages(caseId, finalMessages.map((msg) => ({ role: msg.role, content: msg.content, time: msg.time, lang: msg.lang })));
        }
      } catch {
        const errMsg: Message = {
          role: "ai",
          content: "⚠️ Network error aaya. Please apna internet check karein aur dobara try karein.",
          time: fmtTime(),
        };
        const finalMessages = [...withUser, errMsg];
        pushMessages(finalMessages);
        if (caseId) {
          await aiService.saveChatMessages(caseId, finalMessages.map((msg) => ({ role: msg.role, content: msg.content, time: msg.time, lang: msg.lang })));
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [activeCase, caseDocuments, input, loading, messages, pushMessages]
  );

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setLoading(false);
  }, []);

  const copyMessage = useCallback(async (index: number) => {
    const target = messages[index];
    if (!target?.content) return;
    await navigator.clipboard.writeText(target.content);
  }, [messages]);

  const regenerateAnswer = useCallback(
    async (index: number) => {
      const previousMessages = messages.slice(0, index);
      const lastUserPrompt = [...previousMessages].reverse().find((msg) => msg.role === "user")?.content;
      if (!lastUserPrompt) return;
      const history = previousMessages.filter((msg) => msg.role !== "ai" || msg.content.trim() !== "");
      setMessages(history);
      await sendMessage(lastUserPrompt, history);
    },
    [messages, sendMessage]
  );

  const caseStatus = activeCase ? getStatusStyle(activeCase.status) : null;

  return (
    <div
      className="flex bg-[#F8FAFC] overflow-hidden"
      style={{ height: "calc(100vh - 73px)", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Center Panel: AI Conversation — now the dominant element ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#FCFCFD]">
        {/* Top bar */}
        <header className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-slate-100 bg-white flex-shrink-0">
          {/* Case switcher */}
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setCaseSwitcherOpen((o) => !o)}
              className="w-full flex items-center gap-2 text-left rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-slate-50 transition-colors"
            >
              {activeCase ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[13.5px] font-bold text-[#0F172A] truncate">{activeCase.title}</h1>
                    {activeCase.status && caseStatus && (
                      <span className={`hidden sm:flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${caseStatus.bg} ${caseStatus.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${caseStatus.dot}`} />
                        {activeCase.status}
                      </span>
                    )}
                  </div>
                  {activeCase.court && <p className="text-[10.5px] text-slate-400 font-medium">{activeCase.court}</p>}
                </div>
              ) : (
                <div>
                  <h1 className="text-[13.5px] font-bold text-[#0F172A]">AI Legal Co-Counsel</h1>
                  <p className="text-[10.5px] text-slate-400 font-medium">Select a case to begin</p>
                </div>
              )}
              <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${caseSwitcherOpen ? "rotate-180" : ""}`} />
            </button>

            {caseSwitcherOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCaseSwitcherOpen(false)} />
                <div className="absolute left-0 top-full mt-1.5 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-[70vh] overflow-y-auto">
                  <div className="p-2">
                    {cases.length === 0 ? (
                      <p className="text-[12px] text-slate-400 text-center py-4">No cases yet</p>
                    ) : (
                      cases.map((c) => (
                        <CaseRow
                          key={c.id}
                          c={c}
                          active={activeCase?.id === c.id}
                          onSelect={() => {
                            selectCase(c);
                            setCaseSwitcherOpen(false);
                          }}
                        />
                      ))
                    )}
                  </div>
                  <div className="border-t border-slate-100 p-2">
                    <button
                      onClick={() => setCaseSwitcherOpen(false)}
                      className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#FF7A1A] rounded-lg py-2 hover:bg-[#FFF7ED] transition-colors"
                    >
                      <Plus size={13} />
                      New Case
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Language toggle */}
          <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 rounded-xl p-1 flex-shrink-0">
            {(["auto", "en", "hi"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  lang === l ? "bg-white shadow-sm text-[#FF7A1A]" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {l === "auto" ? <Globe size={11} /> : l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Right panel toggle (desktop collapses, mobile opens drawer) */}
          <button
            onClick={() => (window.innerWidth >= 1024 ? setShowContext((s) => !s) : setRightOpen(true))}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
            aria-label="Toggle case context panel"
          >
            {showContext ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
        </header>

        {/* Body — ChatWindow always renders; shows compact welcome strip internally when empty */}
        <ChatWindow
          messages={messages}
          loading={loading}
          activeCase={activeCase}
          onAction={(p) => sendMessage(p)}
          onCopy={copyMessage}
          onRegenerate={regenerateAnswer}
        />

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => sendMessage()}
          onStop={stopGeneration}
          loading={loading}
          disabled={false}
          hasMessages={messages.length > 0}
        />
      </main>

      {/* ── Desktop Right Panel: Case Context & AI Tools (20%) ── */}
      {showContext && (
        <aside className="hidden lg:flex lg:w-[20%] lg:min-w-[240px] lg:max-w-[300px] flex-col bg-white border-l border-slate-100 flex-shrink-0">
          <ContextPanel activeCase={activeCase} evidence={evidence} research={research} drafts={drafts} />
        </aside>
      )}

      {/* ── Mobile Right Drawer ── */}
      {rightOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRightOpen(false)} />
          <div className="relative w-[84vw] max-w-[320px] bg-white flex flex-col shadow-2xl animate-slide-in-right">
            <button
              onClick={() => setRightOpen(false)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="Close case context panel"
            >
              <X size={16} />
            </button>
            <div className="pt-2">
              <ContextPanel activeCase={activeCase} evidence={evidence} research={research} drafts={drafts} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&display=swap');

        * { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 100px; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @keyframes seal-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-seal-spin { animation: seal-spin 8s linear infinite; }

        @keyframes seal-ring {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.4; }
        }
        .animate-seal-ring { animation: seal-ring 3s ease-in-out infinite; }

        @keyframes rise-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-rise-in { animation: rise-in 0.35s ease-out; }

        @keyframes slide-in-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-left { animation: slide-in-left 0.25s ease-out; }

        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right { animation: slide-in-right 0.25s ease-out; }

        @media (prefers-reduced-motion: reduce) {
          .animate-seal-spin, .animate-seal-ring, .animate-rise-in,
          .animate-slide-in-left, .animate-slide-in-right { animation: none !important; }
        }

        button:focus-visible, textarea:focus-visible, input:focus-visible {
          outline: 2px solid #FF7A1A;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
};

export default AiAssistant;