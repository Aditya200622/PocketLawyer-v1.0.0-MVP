import React, { useState, useRef, useCallback, useEffect } from "react";
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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RefreshCw,
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

interface ParsedSection {
  emoji: string;
  title: string;
  content: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "ai";
  content: string;
  sections?: ParsedSection[];
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
  if (t.includes("legal") || t.includes("law") || t.includes("rights") || t.includes("explanation") || t.includes("section")) return Scale;
  if (t.includes("step") || t.includes("process") || t.includes("how") || t.includes("guidance") || t.includes("action")) return ListChecks;
  if (t.includes("document") || t.includes("proof") || t.includes("evidence")) return FileText;
  if (t.includes("tip") || t.includes("warning") || t.includes("important") || t.includes("caution") || t.includes("risk"))
    return AlertTriangle;
  if (t.includes("portal") || t.includes("government") || t.includes("link") || t.includes("website"))
    return LinkIcon;
  if (t.includes("advice") || t.includes("suggestion") || t.includes("next")) return Lightbulb;
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
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; kind: "evidence" | "screenshot" }[]>([]);
  const [inlineInput, setInlineInput] = useState<null | "website" | "phone">(null);
  const [inlineValue, setInlineValue] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // Upgrade state variables
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatInput, setChatInput] = useState("");
  
  // Location state
  const [locationPermissionRequested, setLocationPermissionRequested] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [recognition, setRecognition] = useState<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-IN';
      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text.trim()) {
          void handleSendMessage(text);
        }
      };
      rec.onend = () => {
        setIsListening(false);
      };
      setRecognition(rec);
    }
  }, [messages]);

  // Voice output function
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Speak the first main part or clean the text
      const cleanText = text.replace(/[#*`_]/g, '');
      const sections = cleanText.split('##');
      const intro = sections[0] || '';
      const summary = sections.find(s => s.toLowerCase().includes('summary') || s.toLowerCase().includes('explanation')) || '';
      
      const speechString = (intro + " " + summary).slice(0, 350) + "... Please read the remaining steps on your screen.";
      const utterance = new SpeechSynthesisUtterance(speechString);
      utterance.lang = 'en-IN';
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleSpeech = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const lastAiMsg = [...messages].reverse().find(m => m.role === 'ai');
        if (lastAiMsg) {
          speakText(lastAiMsg.content);
        }
      }
    }
  };

  const handleStartListening = () => {
    if (recognition) {
      setIsListening(true);
      recognition.start();
    } else {
      alert("Speech recognition is not supported in this browser.");
    }
  };

  const requestLocation = () => {
    setLocationPermissionRequested(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationGranted(true);
        setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (error) => {
        console.error("Location error:", error);
        setLocationGranted(true);
      }
    );
  };

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
    e.target.value = "";
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

  const preview = issueTypeId ? AI_PREVIEW[issueTypeId] ?? AI_PREVIEW.other : null;

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

  const handleFirstSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDescription = issueTypeId === "other" ? otherDescription : description;

    if (!issueType || !finalDescription.trim()) {
      alert("Please select an issue type and describe your problem.");
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    setLoading(true);
    setMessages([]);

    try {
      const response = await aiService.getLegalGuidance({
        issueType: issueTypeId === "other" ? `Other: ${otherDescription.slice(0, 60)}` : issueType,
        description: finalDescription,
      });

      if (response?.content) {
        const sections = parseGuidanceSections(response.content);
        const userMsg: ChatMessage = { 
          id: Date.now(), 
          role: "user", 
          content: `Issue Type: ${issueType}\nDescription: ${finalDescription}` 
        };
        const aiMsg: ChatMessage = { 
          id: Date.now() + 1, 
          role: "ai", 
          content: response.content, 
          sections: sections.length > 0 ? sections : [] 
        };
        setMessages([userMsg, aiMsg]);

        if (isVoiceMode) {
          speakText(response.content);
        }

        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch (error) {
      console.error("AI Guidance Error:", error);
      alert("Failed to get legal guidance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || loading) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    const userMsg: ChatMessage = { id: Date.now(), role: "user", content: cleanText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput("");
    setLoading(true);

    try {
      const historyPayload = updatedMessages.map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      const reply = await aiService.sendLegalGuidanceChat({
        message: cleanText,
        issueType: issueTypeId === "other" ? `Other: ${otherDescription.slice(0, 60)}` : issueType,
        history: historyPayload.slice(-8)
      });

      const sections = parseGuidanceSections(reply);
      const aiMsg: ChatMessage = { 
        id: Date.now() + 1, 
        role: "ai", 
        content: reply, 
        sections: sections.length > 0 ? sections : [] 
      };
      setMessages(prev => [...prev, aiMsg]);

      if (isVoiceMode) {
        speakText(reply);
      }

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now() + 2, role: "ai", content: "⚠️ Sorry, I could not process your reply. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetConversation = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setMessages([]);
    setDescription("");
    setOtherDescription("");
    setIssueType("");
    setIssueTypeId("");
    setAttachedFiles([]);
    setIsSpeaking(false);
  };

  const govLinks = GOVERNMENT_LINKS[issueTypeId] || GOVERNMENT_LINKS["other"];
  const lastAiMessage = [...messages].reverse().find(m => m.role === "ai");
  const guidance = lastAiMessage?.content || null;
  const parsedSections = lastAiMessage?.sections || [];

  return (
    <div className="relative overflow-hidden bg-[#FBFAF7]">
      {/* ── Ambient background layers ───────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #0B1E3D 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            opacity: 0.03,
          }}
        />
        <div
          className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(249,115,22,0.16), transparent 70%)" }}
        />
        <div
          className="absolute top-[40%] left-[-12%] h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(11,30,61,0.07), transparent 70%)" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        
        {/* Toggle Mode and Reset */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm text-xs font-semibold">
            <button
              onClick={() => setIsVoiceMode(false)}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${!isVoiceMode ? 'bg-gray-900 text-white shadow' : 'text-gray-500 hover:text-gray-750'}`}
            >
              Text Chat
            </button>
            <button
              onClick={() => setIsVoiceMode(true)}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${isVoiceMode ? 'bg-gray-900 text-white shadow' : 'text-gray-500 hover:text-gray-750'}`}
            >
              <Mic className="h-3.5 w-3.5" /> Voice Mode
            </button>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleResetConversation}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-600 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Start New
            </button>
          )}
        </div>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="text-center mb-12 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-orange-500/20 bg-orange-50/50"
          >
            <Scale className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-bold tracking-wide text-navy uppercase">
              AI Legal Consultant
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-extrabold text-navy leading-[1.05] tracking-tight mb-5 text-4xl sm:text-5xl"
          >
            Get Instant Legal Guidance
            <br />
            <span className="text-orange-500">Powered by AI</span>
          </motion.h1>

          <p className="text-gray-600 max-w-xl mx-auto text-base sm:text-lg px-2">
            Describe your situation in detail. Our AI provides acts/sections, action plans, risks, and next steps.
          </p>
        </div>

        {/* ── Main Workspace ── */}
        {messages.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 lg:gap-8 items-start">
            
            {/* Form Column */}
            <div className="rounded-3xl border border-gray-200 p-5 sm:p-8 bg-white shadow-sm">
              <form onSubmit={handleFirstSubmit} className="space-y-7">
                {/* Category Picker */}
                <div>
                  <label className="block text-sm font-bold text-navy mb-4">
                    Select Issue Type
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
                          whileHover={{ y: -4, scale: 1.01 }}
                          className={`relative flex flex-col items-start text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                            active
                              ? "border-orange-500 bg-orange-500/5"
                              : "border-gray-100 hover:border-gray-200 bg-white"
                          }`}
                        >
                          {active && (
                            <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-500">
                              <Check className="h-3 w-3" /> Selected
                            </span>
                          )}
                          <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${active ? "bg-orange-500 text-white" : "bg-gray-100 text-slate-700"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="text-sm font-bold text-navy leading-tight">{type.name}</span>
                          <span className="text-[11px] text-gray-505 mt-0.5">{type.blurb}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Textarea Description */}
                {issueTypeId === "other" ? (
                  <div>
                    <label className="block text-sm font-bold text-navy mb-2">Describe Your Issue</label>
                    <SmartTextarea
                      value={otherDescription}
                      onChange={handleOtherDescriptionChange}
                      onFocus={() => setTextareaFocused(true)}
                      onBlur={() => setTextareaFocused(false)}
                      focused={textareaFocused}
                      charCount={charCount}
                    />
                  </div>
                ) : (
                  issueTypeId && (
                    <div>
                      <label className="block text-sm font-bold text-navy mb-2">Describe Your Issue</label>
                      <SmartTextarea
                        value={description}
                        onChange={handleDescriptionChange}
                        onFocus={() => setTextareaFocused(true)}
                        onBlur={() => setTextareaFocused(false)}
                        focused={textareaFocused}
                        charCount={charCount}
                      />
                    </div>
                  )
                )}

                {/* Attachments & Inline Inputs */}
                {issueTypeId && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => evidenceInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-55 cursor-pointer"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Upload Evidence
                      </button>
                      <button
                        type="button"
                        onClick={() => screenshotInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-55 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" /> Add Screenshot
                      </button>
                      <button
                        type="button"
                        onClick={() => openInlineInput("website")}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-55 cursor-pointer"
                      >
                        <Globe className="h-3.5 w-3.5" /> Add Website
                      </button>
                      <button
                        type="button"
                        onClick={() => openInlineInput("phone")}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-55 cursor-pointer"
                      >
                        <Phone className="h-3.5 w-3.5" /> Add Phone Number
                      </button>
                    </div>

                    <input ref={evidenceInputRef} type="file" multiple className="hidden" onChange={(e) => handleFilesSelected(e, "evidence")} />
                    <input ref={screenshotInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFilesSelected(e, "screenshot")} />

                    {inlineInput && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          autoFocus
                          type={inlineInput === "phone" ? "tel" : "text"}
                          value={inlineValue}
                          onChange={(e) => setInlineValue(e.target.value)}
                          placeholder={inlineInput === "website" ? "https://example.com" : "+91 98765 43210"}
                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none"
                        />
                        <button type="button" onClick={confirmInlineInput} className="text-xs font-bold px-3 py-2 rounded-lg bg-orange-500 text-white cursor-pointer">Add</button>
                        <button type="button" onClick={() => setInlineInput(null)} className="text-xs font-semibold px-3 py-2 rounded-lg text-gray-500 hover:text-gray-700 cursor-pointer">Cancel</button>
                      </div>
                    )}

                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachedFiles.map((file, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-navy/5 text-navy">
                            {file.kind === "screenshot" ? <Camera className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
                            <span className="max-w-[140px] truncate">{file.name}</span>
                            <button type="button" onClick={() => removeAttachedFile(idx)} className="text-navy/40 hover:text-navy ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || !issueTypeId}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-extrabold text-sm tracking-tight transition-all shadow-md flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin mr-2 h-5 w-5" /> Getting AI Guidance...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" /> Get AI Guidance
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* AI Preview Panel */}
            <div className="space-y-4">
              <div className="bg-white rounded-3xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  <h3 className="font-bold text-navy text-sm">AI Preview</h3>
                </div>
                {!preview ? (
                  <div className="text-center py-10 px-3">
                    <Scale className="h-7 w-7 text-gray-300 mx-auto mb-3" />
                    <p className="text-xs text-gray-400">Select an issue type to receive preview data.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Issue</p>
                      <p className="text-xs font-bold text-navy">{issueType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Detected Topics</p>
                      <div className="space-y-1">
                        {preview.topics.map(t => (
                          <div key={t} className="flex items-center gap-2 text-xs text-gray-700">
                            <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Continuous Chat History */
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6 max-h-[60vh] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "ai" && (
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs flex-shrink-0">
                      AI
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed ${m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-50 border border-slate-100 text-slate-800"}`}>
                    
                    {/* Render standard layout sections if present */}
                    {m.sections && m.sections.length > 0 ? (
                      <div className="space-y-4">
                        {m.sections.map((sec, sIdx) => {
                          const SecIcon = getSectionIcon(sec.title);
                          return (
                            <div key={sIdx} className="border-b border-slate-200/60 pb-3 last:border-0 last:pb-0">
                              <div className="flex items-center gap-1.5 mb-2">
                                <SecIcon className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                <span className="font-bold text-navy text-xs">{sec.title}</span>
                              </div>
                              <div className="prose prose-sm max-w-none text-slate-700">
                                <ReactMarkdown>{sec.content.trim()}</ReactMarkdown>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* AI speaking controls */}
            {guidance && (
              <div className="flex gap-2 justify-end">
                <button
                  onClick={toggleSpeech}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-[11px] font-semibold text-gray-600 cursor-pointer shadow-sm"
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="h-3.5 w-3.5 text-red-500 animate-pulse" /> Mute AI Speech
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5 text-orange-500" /> Listen to AI Reply
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Location Suggestions Widget */}
            {guidance && (
              <div className="mt-4">
                {!locationPermissionRequested ? (
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                    <div className="flex gap-2">
                      <Landmark className="h-5 w-5 text-orange-600 flex-shrink-0" />
                      <div>
                        <span className="font-bold">Find Nearby Support:</span> Share your location to instantly find nearby police stations, courts, and legal aid centers.
                      </div>
                    </div>
                    <button
                      onClick={requestLocation}
                      className="bg-orange-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-orange-600 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Share Location
                    </button>
                  </div>
                ) : (
                  locationGranted && (
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Landmark className="h-5 w-5 text-orange-500" />
                        <h4 className="font-bold text-navy text-sm sm:text-base">Nearby Support Institutions</h4>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Based on your location, click below to find institutional support nearby:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: "Police Stations", query: "police+station" },
                          { label: "Courts", query: "court" },
                          { label: "Consumer Forums", query: "consumer+forum" },
                          { label: "Labour Offices", query: "labour+office" },
                          { label: "Legal Aid Centres", query: "legal+aid+centre" },
                          { label: "District Courts", query: "district+court" },
                        ].map((inst) => {
                          const mapUrl = userCoords
                            ? `https://www.google.com/maps/search/?api=1&query=${inst.query}+near+${userCoords.lat},${userCoords.lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${inst.query}+near+me`;
                          return (
                            <a
                              key={inst.label}
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-orange-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-700 hover:text-orange-600 transition-all"
                            >
                              <span>{inst.label}</span>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Chat Input Area */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex items-center gap-3">
              {isVoiceMode ? (
                <div className="flex-1 flex justify-center py-2">
                  <button
                    onClick={isListening ? () => recognition?.stop() : handleStartListening}
                    className={`h-16 w-16 rounded-full flex items-center justify-center transition-all cursor-pointer ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'}`}
                  >
                    {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </button>
                  <p className="text-xs text-slate-400 absolute mt-20 font-semibold">
                    {isListening ? "Listening... Speak your legal question." : "Tap to Speak your legal question."}
                  </p>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask follow-up questions or request clarifications here..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && chatInput.trim()) {
                        void handleSendMessage(chatInput);
                      }
                    }}
                  />
                  <button
                    onClick={() => void handleSendMessage(chatInput)}
                    disabled={loading || !chatInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    Send <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Loading overlay for follow-up message */}
        <AnimatePresence>
          {loading && messages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center gap-3 justify-center text-xs font-semibold text-navy"
            >
              <Loader2 className="h-4 w-4 text-orange-500 animate-spin" /> Analyzing Situation...
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

// ── Reusable SmartTextarea ────────────────────────────────────────
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
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 outline-none transition-all resize-none text-sm sm:text-base bg-white"
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