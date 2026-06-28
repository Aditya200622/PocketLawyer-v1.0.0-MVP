import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Gavel,
  HelpCircle,
  ArrowRight,
  Loader2,
  Shield,
  FileText,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  MessageSquare,
  PlusCircle,
  Scale,
  ListChecks,
  Info,
  Link as LinkIcon,
  Lightbulb,
  Sparkles,
  Camera,
  Paperclip,
  Globe,
  Phone,
  Lock,
  Zap,
  Check,
  CircleDot,
} from "lucide-react";
import {
  ShieldAlert,
  Landmark,
  HeartHandshake,
  Building2,
  Siren,
  CirclePlus,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { aiService } from "../services/aiService";

// ── Government portal links mapped to categories ──────────────────────────
const GOVERNMENT_LINKS: Record<string, { label: string; url: string }[]> = {
  cyber: [
    { label: "National Cyber Crime Portal", url: "https://cybercrime.gov.in/" },
    { label: "CERT-In", url: "https://www.cert-in.org.in/" },
  ],
  fraud: [
    { label: "Consumer Helpline", url: "https://consumerhelpline.gov.in/" },
    { label: "National PG Portal", url: "https://pgportal.gov.in/" },
  ],
  domestic: [
    { label: "National Commission for Women", url: "https://ncw.nic.in/" },
    { label: "Women Helpline (181)", url: "https://services.india.gov.in/" },
  ],
  property: [
    { label: "India Gov Services", url: "https://services.india.gov.in/" },
    { label: "RTI Online", url: "https://rtionline.gov.in/" },
  ],
  harassment: [
    { label: "National Commission for Women", url: "https://ncw.nic.in/" },
    { label: "Cyber Crime (Online Harassment)", url: "https://cybercrime.gov.in/" },
  ],
  other: [
    { label: "National PG Portal", url: "https://pgportal.gov.in/" },
    { label: "India Gov Services", url: "https://services.india.gov.in/" },
  ],
};

// ── AI preview simulation data per category (purely presentational) ───────
const AI_PREVIEW: Record<
  string,
  { topics: string[]; actions: string[] }
> = {
  cyber: {
    topics: ["Online Fraud", "Data Breach Risk", "Financial Loss"],
    actions: ["File FIR", "Cyber Crime Portal Complaint", "Bank Dispute Request"],
  },
  fraud: {
    topics: ["Financial Scam", "Breach of Trust", "Monetary Loss"],
    actions: ["Consumer Complaint", "Bank Chargeback", "Police Report"],
  },
  domestic: {
    topics: ["Domestic Violence", "Protection Rights", "Safety Concern"],
    actions: ["Protection Order", "Women Helpline", "Counselling Referral"],
  },
  property: {
    topics: ["Title Dispute", "Possession Issue", "Documentation Gap"],
    actions: ["Legal Notice Draft", "RTI Request", "Civil Suit Filing"],
  },
  harassment: {
    topics: ["Harassment Pattern", "Evidence Trail", "Personal Safety"],
    actions: ["Formal Complaint", "Cyber Portal Report", "Restraining Request"],
  },
  other: {
    topics: ["Issue Classification", "Applicable Law", "Next Steps"],
    actions: ["Document Collection", "Legal Consultation", "Formal Notice"],
  },
};

const LOADING_STEPS = [
  "Identifying issue type",
  "Searching legal resources",
  "Preparing recommendations",
  "Generating guidance",
];

const TRUST_ITEMS = [
  { icon: Lock, label: "Privacy Protected" },
  { icon: Zap, label: "AI Powered" },
  { icon: Scale, label: "Indian Legal Knowledge" },
  { icon: CircleDot, label: "24/7 Available" },
];

// ── Parsed section type for card-based rendering ───────────────────────────
interface ParsedSection {
  emoji: string;
  title: string;
  content: string;
}

function parseGuidanceSections(markdown: string): ParsedSection[] {
  const lines = markdown.split("\n");
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const line of lines) {
    const match =
      line.match(/^##\s+([\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]\uFE0F?\s+.+)$/u) ||
      line.match(/^##\s+([^\n]+)$/);

    if (match) {
      if (current) sections.push(current);
      const heading = match[1].trim();
      const emojiMatch = heading.match(
        /^([\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}🧾⚖️🪜🔗📄💡💬]\uFE0F?\s*)/u
      );
      const emoji = emojiMatch ? emojiMatch[1].trim() : "📌";
      const title = heading
        .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}🧾⚖️🪜🔗📄💡💬]\uFE0F?\s*/u, "")
        .trim();
      current = { emoji, title, content: "" };
    } else if (current) {
      current.content += line + "\n";
    }
  }

  if (current) sections.push(current);
  return sections;
}

function getSectionIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("summary") || t.includes("overview")) return Info;
  if (t.includes("legal") || t.includes("law") || t.includes("rights")) return Scale;
  if (t.includes("step") || t.includes("process") || t.includes("how")) return ListChecks;
  if (t.includes("document") || t.includes("proof") || t.includes("evidence")) return FileText;
  if (t.includes("tip") || t.includes("warning") || t.includes("important") || t.includes("caution"))
    return AlertTriangle;
  if (t.includes("portal") || t.includes("government") || t.includes("link") || t.includes("website"))
    return LinkIcon;
  if (t.includes("advice") || t.includes("suggestion")) return Lightbulb;
  return FileText;
}

const MAX_CHARS = 2000;

export const LegalGuidance = () => {
  const { t } = useTranslation();

  const [issueType, setIssueType] = useState("");
  const [issueTypeId, setIssueTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [otherDescription, setOtherDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [parsedSections, setParsedSections] = useState<ParsedSection[]>([]);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; kind: "evidence" | "screenshot" }[]>([]);
  const [inlineInput, setInlineInput] = useState<null | "website" | "phone">(null);
  const [inlineValue, setInlineValue] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const issueTypes = [
  {
    id: "cyber",
    name: "Cyber Crime",
    blurb: "Online fraud, hacking, identity theft",
    icon: ShieldAlert,
  },
  {
    id: "fraud",
    name: "Fraud / Scam",
    blurb: "Investment scams, UPI fraud, cheating",
    icon: Landmark,
  },
  {
    id: "domestic",
    name: "Domestic Violence",
    blurb: "Abuse, safety, protection orders",
    icon: HeartHandshake,
  },
  {
    id: "property",
    name: "Property Dispute",
    blurb: "Ownership, possession, title issues",
    icon: Building2,
  },
  {
    id: "harassment",
    name: "Harassment",
    blurb: "Workplace, online, or personal",
    icon: Siren,
  },
  {
    id: "other",
    name: "Other",
    blurb: "Anything else legal",
    icon: CirclePlus,
  },
];

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value.slice(0, MAX_CHARS));
    },
    []
  );

  const handleOtherDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setOtherDescription(e.target.value.slice(0, MAX_CHARS));
    },
    []
  );

  const handleCategorySelect = (id: string, name: string) => {
    setIssueTypeId(id);
    setIssueType(name);
    setOtherDescription("");
  };

  const appendToActiveDescription = (text: string) => {
    if (issueTypeId === "other") {
      setOtherDescription((prev) => (prev ? `${prev}\n${text}` : text).slice(0, MAX_CHARS));
    } else {
      setDescription((prev) => (prev ? `${prev}\n${text}` : text).slice(0, MAX_CHARS));
    }
  };

  const handleFilesSelected = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "evidence" | "screenshot"
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newOnes = Array.from(files).map((f) => ({ name: f.name, kind }));
    setAttachedFiles((prev) => [...prev, ...newOnes]);
    e.target.value = ""; // allow re-selecting the same file later
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openInlineInput = (type: "website" | "phone") => {
    setInlineInput(type);
    setInlineValue("");
  };

  const confirmInlineInput = () => {
    if (!inlineValue.trim()) {
      setInlineInput(null);
      return;
    }
    const prefix = inlineInput === "website" ? "Website: " : "Phone number: ";
    appendToActiveDescription(`${prefix}${inlineValue.trim()}`);
    setInlineInput(null);
    setInlineValue("");
  };

  const activeText = issueTypeId === "other" ? otherDescription : description;
  const charCount = activeText.length;

  // Simulated "AI preview" — purely presentational, derived from current selection.
  const preview = issueTypeId ? AI_PREVIEW[issueTypeId] ?? AI_PREVIEW.other : null;

  // Animate through loading steps while a request is in flight.
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((s) => (s < LOADING_STEPS.length - 1 ? s + 1 : s));
    }, 650);
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalDescription = issueTypeId === "other" ? otherDescription : description;

    if (!issueType || !finalDescription.trim()) {
      alert("Please select an issue type and describe your problem.");
      return;
    }

    setLoading(true);
    setGuidance(null);
    setParsedSections([]);

    try {
      const response = await aiService.getLegalGuidance({
        issueType: issueTypeId === "other" ? `Other: ${otherDescription.slice(0, 60)}` : issueType,
        description: finalDescription,
      });

      if (response?.content) {
        setGuidance(response.content);
        const sections = parseGuidanceSections(response.content);
        setParsedSections(sections.length > 0 ? sections : []);
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } else {
        throw new Error("Invalid AI response");
      }
    } catch (error) {
      console.error("AI Guidance Error:", error);
      alert("Failed to get legal guidance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const govLinks = GOVERNMENT_LINKS[issueTypeId] || GOVERNMENT_LINKS["other"];

  return (
    <div className="relative overflow-hidden bg-[#FBFAF7]">
      {/* ── Ambient background layers ───────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, #0B1E3D 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            opacity: 0.03,
          }}
        />
        {/* orange glow */}
        <div
          className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(249,115,22,0.16), transparent 70%)" }}
        />
        <div
          className="absolute top-[40%] left-[-12%] h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(11,30,61,0.07), transparent 70%)" }}
        />
        {/* faint scale-of-justice line motif */}
        <svg
          className="absolute right-[4%] top-[18%] hidden lg:block opacity-[0.05]"
          width="220"
          height="220"
          viewBox="0 0 220 220"
          fill="none"
        >
          <line x1="110" y1="10" x2="110" y2="190" stroke="#0B1E3D" strokeWidth="2" />
          <line x1="30" y1="40" x2="190" y2="40" stroke="#0B1E3D" strokeWidth="2" />
          <circle cx="30" cy="70" r="22" stroke="#0B1E3D" strokeWidth="2" />
          <circle cx="190" cy="70" r="22" stroke="#0B1E3D" strokeWidth="2" />
          <line x1="80" y1="190" x2="140" y2="190" stroke="#0B1E3D" strokeWidth="2" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="text-center mb-12 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-saffron/20 backdrop-blur-md"
            style={{
              background:
                "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(11,30,61,0.04))",
            }}
          >
            <Scale className="h-3.5 w-3.5 text-saffron" />
            <span className="text-xs font-bold tracking-wide text-navy uppercase">
              AI Legal Assistant
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-extrabold text-navy leading-[1.05] tracking-tight mb-5"
            style={{ fontSize: "clamp(36px, 5vw, 68px)", fontWeight: 900 }}
          >
            Get Instant Legal Guidance
            <br />
            <span className="text-saffron">Powered by AI</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-600 max-w-xl mx-auto text-base sm:text-lg px-2"
          >
            Describe your issue and receive clear legal explanations, recommended
            next steps, and relevant legal resources — in seconds.
          </motion.p>
        </div>

        {/* ── Two-column workspace ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 lg:gap-8 items-start">
          {/* LEFT: form */}
         <div
  className="rounded-3xl border border-gray-200 p-5 sm:p-8 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)]"
>
            <form onSubmit={handleSubmit} className="space-y-7">
              {/* Issue Type */}
              <div>
                <label className="block text-sm font-bold text-navy mb-4">
                  {t("guidance.form.issueType")}
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {issueTypes.map((type) => {
                    const Icon = type.icon;
                    const active = issueTypeId === type.id;
                    return (
                      <motion.button
                        key={type.id}
                        type="button"
                        onClick={() => handleCategorySelect(type.id, type.name)}
                        whileHover={{
  y: -8,
  scale: 1.03,
  boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
}}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={`relative flex flex-col items-start text-left p-4 rounded-2xl border-2 transition-colors touch-manipulation ${
                          active
                            ? "border-saffron bg-saffron/5 shadow-[0_0_0_4px_rgba(249,115,22,0.1)]"
                            : "border-gray-100 hover:border-gray-200 bg-white"
                        }`}
                      >
                        {active && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-saffron"
                          >
                            <Check className="h-3 w-3" />
                            Selected
                          </motion.span>
                        )}
                       <motion.div
  whileHover={{
    rotate: 5,
    scale: 1.08,
  }}
  className={`
    mb-3 flex h-12 w-12 items-center justify-center
    rounded-2xl transition-all duration-300
    ${
      active
        ? "bg-gradient-to-br from-orange-500 to-orange-400 text-white shadow-lg shadow-orange-200"
        : "bg-gray-100 text-slate-700 border border-gray-200"
    }
  `}
>
  <Icon className="h-5 w-5" />
</motion.div>
                        <span className="text-sm font-bold text-navy leading-tight">
                          {type.name}
                        </span>
                        <span className="text-[11px] text-gray-500 leading-snug mt-0.5">
                          {type.blurb}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* "Other" custom textarea */}
              <AnimatePresence>
                {issueTypeId === "other" && (
                  <motion.div
                    key="other-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-sm font-bold text-navy mb-2">
                      Describe Your Issue
                    </label>
                    <SmartTextarea
                      value={otherDescription}
                      onChange={handleOtherDescriptionChange}
                      onFocus={() => setTextareaFocused(true)}
                      onBlur={() => setTextareaFocused(false)}
                      focused={textareaFocused}
                      charCount={charCount}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Description */}
              {issueTypeId !== "other" && (
                <div>
                  <label className="block text-sm font-bold text-navy mb-2">
                    {t("guidance.form.description")}
                  </label>
                  <SmartTextarea
                    value={description}
                    onChange={handleDescriptionChange}
                    onFocus={() => setTextareaFocused(true)}
                    onBlur={() => setTextareaFocused(false)}
                    focused={textareaFocused}
                    charCount={charCount}
                  />
                </div>
              )}

              {/* AI assistance chips */}
              <div>
                <div className="flex flex-wrap gap-2">
                  <motion.button
                    type="button"
                    whileHover={{ y: -2, backgroundColor: "rgba(249,115,22,0.08)" }}
                    onClick={() => evidenceInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 transition-colors"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Upload Evidence
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ y: -2, backgroundColor: "rgba(249,115,22,0.08)" }}
                    onClick={() => screenshotInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Add Screenshot
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ y: -2, backgroundColor: "rgba(249,115,22,0.08)" }}
                    onClick={() => openInlineInput("website")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Add Website
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ y: -2, backgroundColor: "rgba(249,115,22,0.08)" }}
                    onClick={() => openInlineInput("phone")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Add Phone Number
                  </motion.button>
                </div>

                {/* hidden native file inputs */}
                <input
                  ref={evidenceInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e, "evidence")}
                />
                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e, "screenshot")}
                />

                {/* inline website / phone input */}
                <AnimatePresence>
                  {inlineInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type={inlineInput === "phone" ? "tel" : "text"}
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              confirmInlineInput();
                            }
                            if (e.key === "Escape") setInlineInput(null);
                          }}
                          placeholder={
                            inlineInput === "website"
                              ? "https://example.com"
                              : "+91 98765 43210"
                          }
                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-saffron outline-none"
                        />
                        <button
                          type="button"
                          onClick={confirmInlineInput}
                          className="text-xs font-bold px-3 py-2 rounded-lg bg-saffron text-white"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setInlineInput(null)}
                          className="text-xs font-semibold px-3 py-2 rounded-lg text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* attached files list */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {attachedFiles.map((file, idx) => (
                      <span
                        key={`${file.name}-${idx}`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-navy/5 text-navy"
                      >
                        {file.kind === "screenshot" ? (
                          <Camera className="h-3 w-3" />
                        ) : (
                          <Paperclip className="h-3 w-3" />
                        )}
                        <span className="max-w-[140px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(idx)}
                          className="text-navy/40 hover:text-navy ml-0.5"
                          aria-label={`Remove ${file.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick gov portal links */}
              {issueTypeId && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  <span className="text-xs font-semibold text-gray-400 w-full mb-0.5">
                    Quick portals for this issue:
                  </span>
                  {govLinks.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-saffron/8 border border-saffron/20 text-saffron font-medium hover:bg-saffron/15 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {link.label}
                    </a>
                  ))}
                </motion.div>
              )}

              {/* Submit */}

  <div className="relative"></div>
  {/* Orange Glow */}
  <div
    className="
      absolute
      inset-0
      -z-10
      rounded-[32px]
      blur-3xl
      bg-orange-400/40
      scale-110
    "
  />



              <motion.button
                type="submit"
                disabled={loading || !issueTypeId}
                whileHover={!loading && issueTypeId ? { scale: 1.02, y: -3 } : {}}
                whileTap={!loading && issueTypeId ? { scale: 0.98 } : {}}
                className="
                relative z-10
relative
w-full
overflow-hidden
bg-[#FF982F]
hover:bg-[#FF8A12]
text-white
py-5
rounded-2xl
font-extrabold
text-lg
tracking-tight
transition-all
duration-300
shadow-[0_12px_30px_rgba(255,152,47,0.20)]
hover:shadow-[0_18px_40px_rgba(255,152,47,0.30)]
flex
items-center
justify-center
group
"
              >
                {/* shine sweep */}
                <span
  className="
  absolute
  inset-y-0
  left-[-100%]
  w-[40%]
  bg-gradient-to-r
  from-transparent
  via-white/20
  to-transparent
  skew-x-12
  group-hover:left-[130%]
  transition-all
  duration-700
  "
/>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5 flex-shrink-0" />
                    {t("guidance.form.getting")}
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5 flex-shrink-0" />
                    <span className="relative z-10">
  Get AI Guidance
</span>
                    <ArrowRight className="ml-2 h-5 w-5 flex-shrink-0" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Trust elements */}
            <div className="flex flex-wrap gap-2 mt-7 pt-6 border-t border-gray-100">
              {TRUST_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-gray-100 text-gray-500"
                    style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(6px)" }}
                  >
                    <Icon className="h-3 w-3 text-saffron" />
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* RIGHT: AI preview panel */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <div
              className="rounded-3xl border border-gray-100 p-5 sm:p-6 shadow-[0_2px_30px_-10px_rgba(11,30,61,0.1)]"
             style={{
  background: "#ffffff",
}}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-navy/5">
                  <Sparkles className="h-4 w-4 text-saffron" />
                </div>
                <h3 className="font-bold text-navy text-sm">AI Preview</h3>
              </div>

              <AnimatePresence mode="wait">
                {!preview ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-10 px-3"
                  >
                    <Scale className="h-7 w-7 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 leading-relaxed">
                      Select an issue type to receive personalized guidance.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={issueTypeId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                        Issue
                      </p>
                      <p className="text-sm font-bold text-navy">{issueType}</p>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                        Detected Topics
                      </p>
                      <div className="space-y-1.5">
                        {preview.topics.map((topic, i) => (
                          <motion.div
                            key={topic}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="flex items-center gap-2 text-sm text-gray-700"
                          >
                            <Check className="h-3.5 w-3.5 text-green-india flex-shrink-0" />
                            {topic}
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                        Possible Actions
                      </p>
                      <div className="space-y-1.5">
                        {preview.actions.map((action, i) => (
                          <motion.div
                            key={action}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + i * 0.08 }}
                            className="flex items-center gap-2 text-sm text-gray-700"
                          >
                            <ChevronRight className="h-3.5 w-3.5 text-saffron flex-shrink-0" />
                            {action}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tip card */}
            <div
              className="rounded-2xl border border-gray-100 p-4 flex items-start gap-3"
              style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(6px)" }}
            >
              <Lightbulb className="h-4 w-4 text-saffron mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong className="text-navy">Tip:</strong> Include dates, people
                involved, and any evidence you already have for sharper guidance.
              </p>
            </div>
          </div>
        </div>

        {/* ── Loading experience ───────────────────────────────────────── */}
        <AnimatePresence>
          {loading && (
            <motion.div
              key="loader"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto mt-10 rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-5">
                <Loader2 className="h-4 w-4 text-saffron animate-spin" />
                <p className="text-sm font-bold text-navy">
                  Analyzing Legal Situation...
                </p>
              </div>
              <div className="space-y-3">
                {LOADING_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    {i < loadingStep ? (
                      <Check className="h-4 w-4 text-green-india flex-shrink-0" />
                    ) : i === loadingStep ? (
                      <Loader2 className="h-4 w-4 text-saffron animate-spin flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        i <= loadingStep ? "text-navy font-medium" : "text-gray-400"
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── AI Result ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {guidance && !loading && (
            <motion.div
              key="result"
              ref={resultRef}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-3xl mx-auto mt-12 space-y-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-green-india p-2 rounded-lg flex-shrink-0">
                  <Gavel className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-navy">
                  {t("guidance.result.title")}
                </h3>
              </div>

              {parsedSections.length > 0 ? (
                <div className="space-y-3">
                  {parsedSections.map((section, idx) => {
                    const Icon = getSectionIcon(section.title);
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.07, duration: 0.3 }}
                        className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 rounded-lg bg-saffron/10">
                            <Icon className="h-5 w-5 text-saffron" />
                          </div>
                          <h4 className="font-bold text-navy text-sm sm:text-base">
                            {section.title}
                          </h4>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-700 markdown-body">
                          <ReactMarkdown
                            components={{
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-saffron underline underline-offset-2 hover:text-orange-600 transition-colors break-all"
                                >
                                  {children}
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              ),
                            }}
                          >
                            {section.content.trim()}
                          </ReactMarkdown>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 markdown-body">
                  <ReactMarkdown>{guidance}</ReactMarkdown>
                </div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 p-4 bg-saffron/10 rounded-xl flex items-start gap-3"
              >
                <AlertTriangle className="h-5 w-5 text-saffron mt-0.5 flex-shrink-0" />
                <p className="text-xs sm:text-sm text-navy/80">
                  <strong>Note:</strong> This guidance is AI-generated. For serious
                  legal matters, please consult a qualified advocate.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="p-4 bg-white border border-gray-100 rounded-xl flex items-center gap-3 shadow-sm"
              >
                <MessageSquare className="h-5 w-5 text-green-india flex-shrink-0" />
                <p className="text-xs sm:text-sm text-gray-600 flex-1">
                  Have more details or follow-up questions? Update your description
                  above and submit again for refined guidance.
                </p>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="flex-shrink-0 text-saffron hover:text-orange-600 transition-colors"
                  aria-label="Scroll to top"
                >
                  <ChevronRight className="h-5 w-5 rotate-[-90deg]" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Reusable ChatGPT-style textarea with focus glow + char counter ────────
function SmartTextarea({
  value,
  onChange,
  onFocus,
  onBlur,
  focused,
  charCount,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  focused: boolean;
  charCount: number;
}) {
  return (
    <div className="relative">
      <motion.div
        animate={{
          boxShadow: focused
            ? "0 0 0 4px rgba(249,115,22,0.12)"
            : "0 0 0 0px rgba(249,115,22,0)",
        }}
        transition={{ duration: 0.2 }}
        className="rounded-xl"
      >
        <textarea
          rows={5}
          placeholder={
            "Example:\n\nI was contacted by a fake investment company and transferred ₹50,000 through UPI. Now they are not responding..."
          }
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-saffron outline-none transition-all resize-none text-sm sm:text-base bg-white"
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          maxLength={MAX_CHARS}
        />
      </motion.div>
      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <span className="text-[11px] text-gray-400">
          💡 Include dates, people involved, and available evidence.
        </span>
        <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2 tabular-nums">
          {charCount} / {MAX_CHARS}
        </span>
      </div>
    </div>
  );
}