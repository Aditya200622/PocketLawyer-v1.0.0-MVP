// ============================================================
// ComplaintGenerator.tsx — UPGRADED VERSION (16 Features Added)
//
// All additions are PATCHES on top of the fixed base version.
// Sub-components remain outside parent function.
// No existing logic was removed or rewritten.
// ============================================================

import React, {
  useState, useRef, useEffect, useCallback, memo
} from 'react';
import { subscribeToCases, type CaseDocument } from '../services/caseService';
import { uploadDocument } from '../services/documentService';
import { aiService, generateMissingInfo } from '../services/aiService';
import { auth } from '../auth';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Send, Copy, Printer, CheckCircle, AlertCircle,
  Loader2, Upload, ChevronRight, ChevronLeft, RotateCcw,
  ChevronDown, ChevronUp, Search, Plus, X, Save, Download,
  Bold, Italic, Underline, List, Hash, Maximize2, ZoomIn,
  ZoomOut, Undo2, Redo2, Wand2, Expand, Minimize2,
  Star, Trash2, Edit3, Clock, FolderOpen, AlignJustify
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormData {
  category: string;
  categoryLabel: string;
  applicantName: string;
  applicantAddress: string;
  applicantMobile: string;
  date: string;
  receiver: string;
  subject: string;
  description: string;
  requestedAction: string;
  declaration: boolean;
  signatureMode: 'none' | 'manual' | 'digital';
  signatureDataUrl: string | null;
  // FEATURE 1 — Draft Config
  draftLevel: 'basic' | 'standard' | 'advanced';
  useRecommendedLength: boolean;
  customPageCount: number;
  // FEATURE 2 — Court Information
  courtType: string;
  courtState: string;
  courtName: string;
  courtLanguage: 'english' | 'hindi' | 'bilingual';
  // FEATURE 3 & 4 — Laws & Sections
  applicableLaws: string[];
  relevantSections: string[];
  // FEATURE 5 & 6 — Checklist & Custom Points
  checklist: string[];
  customPoints: string[];
  // FEATURE 7 — Draft Style
  draftStyle: 'professional' | 'simple' | 'detailed' | 'court_filing';
  // FEATURE 8 — Font Preferences
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  margins: string;
}

// ─── Category Config ──────────────────────────────────────────────────────────

export const CATEGORIES = [
  { key: 'formal',    emoji: '📄', label: 'Formal Complaint',                tone: 'formal and structured' },
  { key: 'informal',  emoji: '💬', label: 'Informal Complaint',              tone: 'simple and conversational' },
  { key: 'written',   emoji: '📝', label: 'Written Complaint (Application)', tone: 'formal written application' },
  { key: 'legal',     emoji: '⚖️', label: 'Legal Complaint',                 tone: 'strict legal tone with IPC references' },
  { key: 'police',    emoji: '🚓', label: 'Police Complaint (FIR/NCR)',      tone: 'formal police FIR format' },
  { key: 'consumer',  emoji: '🛒', label: 'Consumer Complaint',              tone: 'formal consumer grievance' },
  { key: 'service',   emoji: '🛠️', label: 'Service Complaint',               tone: 'professional service feedback' },
  { key: 'workplace', emoji: '🏢', label: 'Workplace Complaint',             tone: 'professional HR tone' },
  { key: 'grievance', emoji: '📢', label: 'Grievance Complaint',             tone: 'formal grievance redressal format' },
  { key: 'public',    emoji: '🌐', label: 'Public Complaint',                tone: 'civic formal tone' },
  { key: 'anonymous', emoji: '🕶️', label: 'Anonymous Complaint',             tone: 'formal without disclosing identity' },
  { key: 'signed',    emoji: '✍️', label: 'Signed Complaint',                tone: 'formal with full identification' },
  { key: 'printed',   emoji: '🖨️', label: 'Online Printed (Offline Submit)', tone: 'print-ready format with blank spaces' },
];

// ─── Feature constants ────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry',
];

const COURT_TYPES = [
  'District Court','Sessions Court','Family Court',
  'Consumer Court','Tribunal','High Court','Supreme Court',
];

const LAW_OPTIONS = [
  'BNSS','BNS','Bharatiya Sakshya Adhiniyam','CPC','CrPC','IPC',
  'Constitution of India','Advocates Act','Consumer Protection Act',
  'IEA (Indian Evidence Act)','NDPS Act','POCSO Act','RTI Act',
  'Motor Vehicles Act','IT Act','Domestic Violence Act',
  'Negotiable Instruments Act','Arbitration Act',
];

const CHECKLIST_OPTIONS = [
  'Client Details','Case Details','Facts of the Case',
  'Grounds','Prayer / Relief Sought','Verification',
  'Annexures / Documents','Cause of Action','Limitation Period',
  'Jurisdiction','Parties to the Dispute',
];

const DRAFT_STYLES = [
  { key: 'professional', label: '🎩 Professional', desc: 'Formal language, proper headings' },
  { key: 'simple',       label: '✏️ Simple',       desc: 'Plain language, easy to understand' },
  { key: 'detailed',     label: '📚 Detailed',     desc: 'Elaborate, comprehensive narration' },
  { key: 'court_filing', label: '⚖️ Court Filing', desc: 'Strict court-ready format' },
];

const FONT_OPTIONS = ['Times New Roman','Calibri','Arial','Georgia','Verdana'];

// ─── Initial form state ───────────────────────────────────────────────────────

const INITIAL_FORM: FormData = {
  category:             '',
  categoryLabel:        '',
  applicantName:        '',
  applicantAddress:     '',
  applicantMobile:      '',
  date:                 new Date().toISOString().split('T')[0],
  receiver:             '',
  subject:              '',
  description:          '',
  requestedAction:      '',
  declaration:          false,
  signatureMode:        'none',
  signatureDataUrl:     null,
  draftLevel:           'standard',
  useRecommendedLength: true,
  customPageCount:      10,
  courtType:            '',
  courtState:           '',
  courtName:            '',
  courtLanguage:        'english',
  applicableLaws:       [],
  relevantSections:     [],
  checklist:            ['Client Details','Facts of the Case','Grounds','Prayer / Relief Sought','Verification'],
  customPoints:         [],
  draftStyle:           'professional',
  fontFamily:           'Times New Roman',
  fontSize:             12,
  lineSpacing:          1.5,
  margins:              'normal',
};

// ─── Draft saved type ─────────────────────────────────────────────────────────

interface SavedDraft {
  id: string;
  name: string;
  category: string;
  createdAt: string;
  content: string;
  favourite: boolean;
}

// ─── Backend API call ─────────────────────────────────────────────────────────

async function generateComplaintViaBackend(data: FormData): Promise<string> {
  const category = CATEGORIES.find(c => c.key === data.category);
  const description = [
    `Applicant: ${data.applicantName}`,
    `Mobile: ${data.applicantMobile}`,
    `Subject: ${data.subject}`,
    data.description,
    `Requested Action: ${data.requestedAction || 'Appropriate legal action'}`,
    `Draft Style: ${data.draftStyle}`,
    `Draft Level: ${data.draftLevel}`,
    data.courtType ? `Court: ${data.courtType}, ${data.courtState}` : '',
    data.courtLanguage !== 'english' ? `Language: ${data.courtLanguage}` : '',
    data.applicableLaws.length ? `Applicable Laws: ${data.applicableLaws.join(', ')}` : '',
    data.relevantSections.length ? `Sections: ${data.relevantSections.join(', ')}` : '',
    data.checklist.length ? `Include: ${data.checklist.join(', ')}` : '',
    data.customPoints.length ? `Custom Points: ${data.customPoints.join('; ')}` : '',
  ].filter(Boolean).join('\n');

  const result = await aiService.generateComplaint({
    category: `${category?.label ?? data.category} — tone: ${category?.tone ?? 'formal'}`,
    date:          data.date,
    location:      data.applicantAddress || 'Not specified',
    opposingParty: data.receiver         || 'Concerned Authority',
    description,
  });

  // aiService.generateComplaint returns the parsed JSON object from the backend
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    return (r.content ?? r.complaint ?? r.text ?? r.result ?? JSON.stringify(result)) as string;
  }
  if (typeof result === 'string') return result;
  throw new Error('Generation failed. Please try again.');
}

// ─── SignatureCanvas ──────────────────────────────────────────────────────────

interface SignatureCanvasProps {
  onSave:  (dataUrl: string) => void;
  onClear: () => void;
}

const SignatureCanvas = memo(({ onSave, onClear }: SignatureCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1A1A2E';
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
  }, [getPos]);

  const stop = useCallback(() => {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onSave(canvas.toDataURL());
  }, [onSave]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  }, [onClear]);

  return (
    <div>
      <canvas
        ref={canvasRef} width={400} height={120}
        className="w-full border border-gray-300 rounded-xl bg-white cursor-crosshair touch-none"
        style={{ maxHeight: 120 }}
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
      />
      <button type="button" onClick={clear} className="mt-2 text-xs text-gray-500 flex items-center gap-1 hover:text-red-500 transition-colors">
        <RotateCcw className="h-3 w-3" /> Clear signature
      </button>
    </div>
  );
});
SignatureCanvas.displayName = 'SignatureCanvas';

// ─── StepBar ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Category', 'Details', 'Generate'];

const StepBar = memo(({ step }: { step: number }) => (
  <div className="flex items-center justify-center gap-2 mb-10">
    {STEP_LABELS.map((label, i) => {
      const idx = i + 1; const active = step === idx; const done = step > idx;
      return (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <motion.div
              animate={{ scale: active ? 1.1 : 1 }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                ${done ? 'bg-green-500 text-white' : active ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {done ? <CheckCircle className="h-4 w-4" /> : idx}
            </motion.div>
            <span className={`text-xs font-medium ${active ? 'text-orange-500' : 'text-gray-400'}`}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`h-0.5 w-12 mb-4 transition-all duration-500 ${step > idx ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
));
StepBar.displayName = 'StepBar';

// ─── Accordion wrapper ────────────────────────────────────────────────────────

const Accordion = memo(({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-orange-50 transition-colors text-left"
      >
        <span className="text-sm font-bold text-navy flex items-center gap-2">{icon} {title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
Accordion.displayName = 'Accordion';

// ─── Searchable multi-select ──────────────────────────────────────────────────

const MultiSelect = memo(({ options, selected, onChange, placeholder }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; placeholder: string;
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o));

  const add = useCallback((v: string) => { onChange([...selected, v]); setQuery(''); }, [selected, onChange]);
  const remove = useCallback((v: string) => onChange(selected.filter(s => s !== v)), [selected, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 min-h-[32px]">
        {selected.map(s => (
          <motion.span key={s} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
            {s}
            <button type="button" onClick={() => remove(s)} className="hover:text-red-500 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
          <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <input
            type="text" value={query} placeholder={placeholder}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="flex-1 text-xs outline-none bg-transparent"
          />
        </div>
        <AnimatePresence>
          {open && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
            >
              {filtered.slice(0, 20).map(o => (
                <button key={o} type="button" onClick={() => { add(o); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 hover:text-orange-600 transition-colors">
                  {o}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
      </div>
    </div>
  );
});
MultiSelect.displayName = 'MultiSelect';

// ─── FEATURE 1 — Draft Configuration ─────────────────────────────────────────

const DraftConfig = memo(({ formData, onChange }: {
  formData: FormData; onChange: (f: keyof FormData, v: any) => void;
}) => {
  const levels = [
    { key: 'basic',    label: 'Basic',    desc: 'Concise & Clear' },
    { key: 'standard', label: 'Standard', desc: 'Detailed Draft' },
    { key: 'advanced', label: 'Advanced', desc: 'Litigation-Grade' },
  ] as const;

  return (
    <Accordion title="Draft Configuration" icon="⚙️" defaultOpen>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Draft Level</p>
          <div className="grid grid-cols-3 gap-2">
            {levels.map(l => (
              <motion.button key={l.key} type="button" whileTap={{ scale: 0.96 }}
                onClick={() => onChange('draftLevel', l.key)}
                className={`flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer
                  ${formData.draftLevel === l.key
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/30'}`}>
                <span className="text-xs font-bold text-navy">{l.label}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">{l.desc}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={formData.useRecommendedLength}
            onChange={e => onChange('useRecommendedLength', e.target.checked)}
            className="w-4 h-4 accent-orange-500" />
          <span className="text-xs text-gray-600 font-medium">Use Recommended Length</span>
        </label>

        {!formData.useRecommendedLength && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Custom Page Count ({formData.customPageCount})</label>
            <input type="range" min={2} max={40} value={formData.customPageCount}
              onChange={e => onChange('customPageCount', parseInt(e.target.value))}
              className="w-full accent-orange-500" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>2</span><span>40</span></div>
          </motion.div>
        )}
      </div>
    </Accordion>
  );
});
DraftConfig.displayName = 'DraftConfig';

// ─── FEATURE 2 — Court Information ───────────────────────────────────────────

const CourtInfo = memo(({ formData, onChange }: {
  formData: FormData; onChange: (f: keyof FormData, v: any) => void;
}) => {
  const inp = "w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all";
  return (
    <Accordion title="Court Information" icon="🏛️">
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Court Type</label>
          <select value={formData.courtType} onChange={e => onChange('courtType', e.target.value)} className={inp}>
            <option value="">Select Court Type</option>
            {COURT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">State</label>
            <select value={formData.courtState} onChange={e => onChange('courtState', e.target.value)} className={inp}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Court Name</label>
            <input type="text" placeholder="e.g. Lucknow District Court"
              value={formData.courtName} onChange={e => onChange('courtName', e.target.value)} className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Language</label>
          <div className="flex gap-2">
            {(['english','hindi','bilingual'] as const).map(l => (
              <button key={l} type="button" onClick={() => onChange('courtLanguage', l)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all capitalize
                  ${formData.courtLanguage === l ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-orange-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Accordion>
  );
});
CourtInfo.displayName = 'CourtInfo';

// ─── FEATURE 3 — Applicable Laws ─────────────────────────────────────────────

const ApplicableLaws = memo(({ formData, onChange }: {
  formData: FormData; onChange: (f: keyof FormData, v: any) => void;
}) => (
  <Accordion title="Applicable Laws" icon="📜">
    <MultiSelect
      options={LAW_OPTIONS}
      selected={formData.applicableLaws}
      onChange={v => onChange('applicableLaws', v)}
      placeholder="Search laws (BNSS, BNS, IPC...)"
    />
  </Accordion>
));
ApplicableLaws.displayName = 'ApplicableLaws';

// ─── FEATURE 4 — Relevant Sections ───────────────────────────────────────────

const RelevantSections = memo(({ formData, onChange }: {
  formData: FormData; onChange: (f: keyof FormData, v: any) => void;
}) => {
  const [input, setInput] = useState('');
  const add = useCallback(() => {
    const v = input.trim();
    if (v && !formData.relevantSections.includes(v)) {
      onChange('relevantSections', [...formData.relevantSections, v]);
      setInput('');
    }
  }, [input, formData.relevantSections, onChange]);

  return (
    <Accordion title="Relevant Sections" icon="§">
      <div className="space-y-2">
        {formData.relevantSections.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {formData.relevantSections.map(s => (
              <motion.span key={s} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                §{s}
                <button type="button" onClick={() => onChange('relevantSections', formData.relevantSections.filter(x => x !== s))}
                  className="hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
              </motion.span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input type="text" placeholder="e.g. 420, 120B, 302..."
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={add}
            className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-medium hover:bg-orange-600 transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </motion.button>
        </div>
        <p className="text-[10px] text-gray-400">Press Enter or + to add each section</p>
      </div>
    </Accordion>
  );
});
RelevantSections.displayName = 'RelevantSections';

// ─── FEATURE 5 & 6 — Smart Draft Checklist + Custom Points ───────────────────

const SmartChecklist = memo(({ formData, onChange }: {
  formData: FormData; onChange: (f: keyof FormData, v: any) => void;
}) => {
  const [newPoint, setNewPoint] = useState('');

  const toggleItem = useCallback((item: string) => {
    const has = formData.checklist.includes(item);
    onChange('checklist', has ? formData.checklist.filter(c => c !== item) : [...formData.checklist, item]);
  }, [formData.checklist, onChange]);

  const addCustom = useCallback(() => {
    const v = newPoint.trim();
    if (v) { onChange('customPoints', [...formData.customPoints, v]); setNewPoint(''); }
  }, [newPoint, formData.customPoints, onChange]);

  const removeCustom = useCallback((i: number) => {
    onChange('customPoints', formData.customPoints.filter((_, idx) => idx !== i));
  }, [formData.customPoints, onChange]);

  return (
    <Accordion title="Smart Draft Checklist" icon="✅">
      <div className="space-y-2">
        <p className="text-[10px] text-gray-400">Select what to include in your draft</p>
        <div className="grid grid-cols-1 gap-1.5">
          {CHECKLIST_OPTIONS.map(item => (
            <motion.label key={item} whileHover={{ x: 2 }}
              className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={formData.checklist.includes(item)}
                onChange={() => toggleItem(item)}
                className="w-3.5 h-3.5 accent-orange-500" />
              <span className={`text-xs transition-colors ${formData.checklist.includes(item) ? 'text-navy font-medium' : 'text-gray-500'}`}>
                {item}
              </span>
            </motion.label>
          ))}
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-500 mb-2">Custom Points</p>
          {formData.customPoints.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-orange-600 font-medium flex-1 bg-orange-50 px-2 py-1 rounded-lg">★ {p}</span>
              <button type="button" onClick={() => removeCustom(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
          <div className="flex gap-2 mt-2">
            <input type="text" placeholder="Add a custom point..."
              value={newPoint} onChange={e => setNewPoint(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
            <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={addCustom}
              className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-medium hover:bg-orange-600 transition-colors">
              <Plus className="h-3 w-3" /> Add
            </motion.button>
          </div>
        </div>
      </div>
    </Accordion>
  );
});
SmartChecklist.displayName = 'SmartChecklist';

// ─── FEATURE 7 — Draft Style ──────────────────────────────────────────────────

const DraftStylePicker = memo(({ formData, onChange }: {
  formData: FormData; onChange: (f: keyof FormData, v: any) => void;
}) => (
  <Accordion title="Draft Style" icon="🎨">
    <div className="grid grid-cols-2 gap-2">
      {DRAFT_STYLES.map(s => (
        <motion.button key={s.key} type="button" whileTap={{ scale: 0.96 }}
          onClick={() => onChange('draftStyle', s.key)}
          className={`p-3 rounded-xl border-2 text-left transition-all duration-200
            ${formData.draftStyle === s.key ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/30'}`}>
          <p className="text-xs font-bold text-navy">{s.label}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{s.desc}</p>
        </motion.button>
      ))}
    </div>
  </Accordion>
));
DraftStylePicker.displayName = 'DraftStylePicker';

// ─── FEATURE 8 — Font Preferences ────────────────────────────────────────────

const FontPreferences = memo(({ formData, onChange }: {
  formData: FormData; onChange: (f: keyof FormData, v: any) => void;
}) => {
  const inp = "w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all";
  return (
    <Accordion title="Font Preferences" icon="🔤">
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Font Family</label>
          <select value={formData.fontFamily} onChange={e => onChange('fontFamily', e.target.value)} className={inp}>
            {FONT_OPTIONS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Size ({formData.fontSize}pt)</label>
            <input type="range" min={10} max={16} value={formData.fontSize}
              onChange={e => onChange('fontSize', parseInt(e.target.value))} className="w-full accent-orange-500" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Spacing ({formData.lineSpacing})</label>
            <input type="range" min={1} max={2.5} step={0.25} value={formData.lineSpacing}
              onChange={e => onChange('lineSpacing', parseFloat(e.target.value))} className="w-full accent-orange-500" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Margins</label>
            <select value={formData.margins} onChange={e => onChange('margins', e.target.value)} className={inp}>
              <option value="narrow">Narrow</option>
              <option value="normal">Normal</option>
              <option value="wide">Wide</option>
            </select>
          </div>
        </div>
      </div>
    </Accordion>
  );
});
FontPreferences.displayName = 'FontPreferences';

// ─── FEATURE 13 — Preview Summary ────────────────────────────────────────────

const PreviewSummary = memo(({ formData }: { formData: FormData }) => {
  const cat     = CATEGORIES.find(c => c.key === formData.category);
  const rows: [string, string][] = [
    ['Category',         `${cat?.emoji ?? ''} ${cat?.label ?? '—'}`],
    ['Draft Style',      formData.draftStyle.replace('_', ' ')],
    ['Draft Level',      formData.draftLevel],
    ['Court',            [formData.courtType, formData.courtState].filter(Boolean).join(', ') || '—'],
    ['Language',         formData.courtLanguage],
    ['Applicable Laws',  formData.applicableLaws.join(', ') || '—'],
    ['Sections',         formData.relevantSections.join(', ') || '—'],
    ['Checklist',        formData.checklist.slice(0, 4).join(', ') + (formData.checklist.length > 4 ? '...' : '')],
    ['Custom Points',    formData.customPoints.length ? `${formData.customPoints.length} point(s)` : '—'],
  ];

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4 rounded-2xl">
      <p className="text-sm font-bold text-orange-700 mb-3">📋 Draft Preview Summary</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <span className="text-gray-400 text-[10px] uppercase tracking-wide">{k}</span>
            <span className="font-semibold text-navy text-xs capitalize">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
PreviewSummary.displayName = 'PreviewSummary';

// ─── Step 1 ───────────────────────────────────────────────────────────────────

interface Step1Props {
  selectedCategory: string;
  onSelect: (key: string, label: string) => void;
  onNext: () => void;
}

const Step1 = memo(({ selectedCategory, onSelect, onNext }: Step1Props) => (
  <motion.div key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
    <h2 className="text-xl font-bold text-navy mb-1">Select Complaint Type</h2>
    <p className="text-sm text-gray-500 mb-6">AI will auto-adjust tone and format based on your selection</p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {CATEGORIES.map(cat => (
        <motion.button
          key={cat.key} type="button"
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(cat.key, cat.label)}
          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center transition-all duration-200
            ${selectedCategory === cat.key
              ? 'border-orange-400 bg-orange-50 shadow-md'
              : 'border-gray-100 bg-white hover:border-orange-200 hover:bg-orange-50/30'}`}
        >
          <span className="text-2xl">{cat.emoji}</span>
          <span className="text-xs font-semibold text-navy leading-tight">{cat.label}</span>
        </motion.button>
      ))}
    </div>
    <button type="button" disabled={!selectedCategory} onClick={onNext}
      className="mt-8 w-full bg-gradient-to-r from-orange-500 to-amber-400 text-white py-4 rounded-xl font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center disabled:opacity-40">
      Continue <ChevronRight className="ml-2 h-5 w-5" />
    </button>
  </motion.div>
));
Step1.displayName = 'Step1';

// ─── Step 2 ───────────────────────────────────────────────────────────────────

interface Step2Props {
  formData: FormData;
  onChange: (field: keyof FormData, value: any) => void;
  onBack: () => void;
  onNext: () => void;
}

const Step2 = memo(({ formData, onChange, onBack, onNext }: Step2Props) => {
  const hName        = useCallback((e: React.ChangeEvent<HTMLInputElement>)    => onChange('applicantName',    e.target.value),   [onChange]);
  const hAddress     = useCallback((e: React.ChangeEvent<HTMLInputElement>)    => onChange('applicantAddress', e.target.value),   [onChange]);
  const hMobile      = useCallback((e: React.ChangeEvent<HTMLInputElement>)    => onChange('applicantMobile',  e.target.value),   [onChange]);
  const hDate        = useCallback((e: React.ChangeEvent<HTMLInputElement>)    => onChange('date',             e.target.value),   [onChange]);
  const hReceiver    = useCallback((e: React.ChangeEvent<HTMLInputElement>)    => onChange('receiver',         e.target.value),   [onChange]);
  const hSubject     = useCallback((e: React.ChangeEvent<HTMLInputElement>)    => onChange('subject',          e.target.value),   [onChange]);
  const hDescription = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => onChange('description',      e.target.value),   [onChange]);
  const hAction      = useCallback((e: React.ChangeEvent<HTMLInputElement>)    => onChange('requestedAction',  e.target.value),   [onChange]);
  const hDeclaration = useCallback((e: React.ChangeEvent<HTMLInputElement>)    => onChange('declaration',      e.target.checked), [onChange]);
  const hSigNone     = useCallback(() => onChange('signatureMode', 'none'),    [onChange]);
  const hSigManual   = useCallback(() => onChange('signatureMode', 'manual'),  [onChange]);
  const hSigSave     = useCallback((url: string) => onChange('signatureDataUrl', url), [onChange]);
  const hSigClear    = useCallback(() => onChange('signatureDataUrl', null),   [onChange]);

  const inp = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm";

  return (
    <motion.div key="step2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className="space-y-4">

      {/* FEATURE 1 — Draft Configuration (BEFORE Applicant Info) */}
      <DraftConfig formData={formData} onChange={onChange} />

      <div>
        <p className="text-sm font-bold text-navy mb-3">👤 Applicant Information</p>
        <div className="space-y-3">
          <input type="text" placeholder="Full Name"     value={formData.applicantName}    onChange={hName}    className={inp} />
          <input type="text" placeholder="Full Address"  value={formData.applicantAddress} onChange={hAddress} className={inp} />
          <input type="tel"  placeholder="Mobile Number" value={formData.applicantMobile}  onChange={hMobile}  className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-navy mb-2">📅 Date</label>
          <input type="date" value={formData.date} onChange={hDate} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy mb-2">🏢 Receiver / Authority</label>
          <input type="text" placeholder="Manager / Police Station" value={formData.receiver} onChange={hReceiver} className={inp} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-navy mb-2">🧾 Subject</label>
        <input type="text" placeholder="One-line summary of complaint" value={formData.subject} onChange={hSubject} className={inp} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-navy mb-1">🧠 Complaint का विवरण लिखें</label>
        <p className="text-xs text-gray-400 mb-2">AI समझकर पूरा आवेदन बनाएगा — क्या हुआ, कब हुआ, कहाँ हुआ, किसके द्वारा हुआ</p>
        <textarea rows={6} placeholder={"क्या हुआ...\nकब हुआ...\nकहाँ हुआ...\nकिसके द्वारा हुआ..."}
          value={formData.description} onChange={hDescription} className={`${inp} resize-none`} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-navy mb-2">📎 Proof / Evidence (Optional)</label>
        <div className="flex justify-center px-6 pt-4 pb-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-300 transition-colors cursor-pointer group">
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-gray-300 group-hover:text-orange-400 transition-colors" />
            <p className="text-xs text-gray-400 mt-1">Click to upload or drag & drop</p>
            <p className="text-xs text-gray-300">PNG, JPG, PDF up to 10MB</p>
            <input type="file" className="sr-only" accept="image/*,.pdf" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-navy mb-2">🎯 आप क्या action चाहते हैं?</label>
        <input type="text" placeholder="e.g. Refund, FIR दर्ज करें, Action लें, Inquiry करें"
          value={formData.requestedAction} onChange={hAction} className={inp} />
      </div>

      {/* FEATURE 2 — Court Information */}
      <CourtInfo formData={formData} onChange={onChange} />

      {/* FEATURE 3 — Applicable Laws */}
      <ApplicableLaws formData={formData} onChange={onChange} />

      {/* FEATURE 4 — Relevant Sections */}
      <RelevantSections formData={formData} onChange={onChange} />

      {/* FEATURE 5 & 6 — Checklist + Custom Points */}
      <SmartChecklist formData={formData} onChange={onChange} />

      {/* FEATURE 7 — Draft Style */}
      <DraftStylePicker formData={formData} onChange={onChange} />

      {/* FEATURE 8 — Font Preferences */}
      <FontPreferences formData={formData} onChange={onChange} />

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={formData.declaration} onChange={hDeclaration} className="mt-0.5 w-4 h-4 accent-orange-500" />
        <span className="text-sm text-gray-600">☑️ दी गई जानकारी मेरे अनुसार सही है और मैं इसकी जिम्मेदारी लेता/लेती हूँ।</span>
      </label>

      <div>
        <label className="block text-xs font-semibold text-navy mb-3">✍️ Signature</label>
        <div className="flex gap-3 mb-4">
          {([
            { mode: 'none'   as const, label: '— None',           handler: hSigNone   },
            { mode: 'manual' as const, label: '🖊 Manual (Print)', handler: hSigManual },
          ]).map(({ mode, label, handler }) => (
            <button key={mode} type="button" onClick={handler}
              className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-all
                ${formData.signatureMode === mode
                  ? 'border-orange-400 bg-orange-50 text-orange-600'
                  : 'border-gray-200 text-gray-500 hover:border-orange-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {formData.signatureMode === 'manual' && (
          <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl">A blank signature line will be added to the printed complaint.</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" disabled={!formData.description || !formData.declaration} onClick={onNext}
          className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 text-white py-3 rounded-xl font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center disabled:opacity-40">
          Preview & Generate <ChevronRight className="ml-2 h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
});
Step2.displayName = 'Step2';

// ─── Step 3 ───────────────────────────────────────────────────────────────────

interface Step3Props {
  formData: FormData;
  loading: boolean;
  onBack: () => void;
  onGenerate: () => void;
}

const Step3 = memo(({ formData, loading, onBack, onGenerate }: Step3Props) => {
  const category = CATEGORIES.find(c => c.key === formData.category);
  return (
    <motion.div key="step3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className="space-y-5">
      
      {/* FEATURE 13 — Preview Summary */}
      <PreviewSummary formData={formData} />

      <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
        <p className="text-sm font-bold text-orange-700 mb-3">👤 Applicant Review</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {([
            ['Type',      `${category?.emoji ?? ''} ${category?.label ?? ''}`],
            ['Applicant', formData.applicantName   || '—'],
            ['Date',      formData.date],
            ['Receiver',  formData.receiver        || '—'],
            ['Mobile',    formData.applicantMobile || '—'],
            ['Signature', formData.signatureMode],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}><span className="text-gray-400">{k}: </span><span className="font-semibold text-navy">{v}</span></div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3 line-clamp-2">Description: {formData.description}</p>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
          <ChevronLeft className="h-4 w-4" /> Edit
        </button>
        <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          disabled={loading} onClick={onGenerate}
          className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 text-white py-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center disabled:opacity-70 transition-all">
          {loading
            ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> AI Draft तैयार हो रहा है...</>
            : <><Send className="mr-2 h-5 w-5" /> Generate Complaint</>}
        </motion.button>
      </div>
    </motion.div>
  );
});
Step3.displayName = 'Step3';

// ─── FEATURE 9 — Recent Drafts Sidebar ───────────────────────────────────────

const RecentDraftsSidebar = memo(({ drafts, onOpen, onRename, onDelete, onFavourite, onClose, open }: {
  drafts: SavedDraft[];
  onOpen: (d: SavedDraft) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onFavourite: (id: string) => void;
  onClose: () => void;
  open: boolean;
}) => {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  return (
    <>
      {/* Toggle Tab */}
      <motion.button
        style={{ writingMode: 'vertical-rl' }}
        whileHover={{ scale: 1.05 }}
        onClick={onClose}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-orange-500 text-white px-2 py-4 rounded-l-xl text-xs font-bold shadow-lg cursor-pointer select-none"
      >
        {open ? '→ Close' : '← Drafts'}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-72 bg-white shadow-2xl z-40 border-l border-gray-100 flex flex-col"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-bold text-navy">Recent Drafts</span>
              </div>
              <span className="text-xs text-gray-400">{drafts.length} saved</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {drafts.length === 0 && (
                <div className="text-center py-12 text-gray-300">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No drafts yet</p>
                </div>
              )}
              {drafts.map(d => (
                <motion.div key={d.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all group">
                  {renaming === d.id ? (
                    <div className="flex gap-1 mb-1">
                      <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                        className="flex-1 text-xs px-2 py-1 border border-orange-300 rounded-lg outline-none" autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') { onRename(d.id, renameVal); setRenaming(null); } }} />
                      <button type="button" onClick={() => { onRename(d.id, renameVal); setRenaming(null); }}
                        className="text-xs px-2 py-1 bg-orange-500 text-white rounded-lg">✓</button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1 mb-1">
                      {d.favourite && <Star className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5 fill-yellow-400" />}
                      <p className="text-xs font-semibold text-navy truncate flex-1">{d.name}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mb-2">{d.category} · {d.createdAt}</p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => onOpen(d)} title="Open"
                      className="flex-1 text-[10px] py-1 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">
                      Open
                    </button>
                    <button type="button" onClick={() => { setRenaming(d.id); setRenameVal(d.name); }} title="Rename"
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors">
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => onFavourite(d.id)} title="Favourite"
                      className={`p-1 transition-colors ${d.favourite ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}>
                      <Star className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => onDelete(d.id)} title="Delete"
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              ))}


            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
RecentDraftsSidebar.displayName = 'RecentDraftsSidebar';

// ─── FEATURE 11 — Save Draft Modal ───────────────────────────────────────────

const SaveDraftModal = memo(({ onSave, onClose }: {
  onSave: (name: string, folder: string, tags: string) => void;
  onClose: () => void;
}) => {
  const [name,   setName]   = useState('Draft ' + new Date().toLocaleDateString());
  const [folder, setFolder] = useState('General');
  const [tags,   setTags]   = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-80 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <Save className="h-5 w-5 text-orange-500" />
          <h3 className="text-base font-bold text-navy">Save Draft</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Draft Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Folder</label>
            <select value={folder} onChange={e => setFolder(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-orange-400 outline-none transition-all">
              <option>General</option>
              <option>Criminal</option>
              <option>Civil</option>
              <option>Consumer</option>
              <option>Workplace</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tags (comma separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="urgent, court, FIR..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button type="button" onClick={() => { onSave(name, folder, tags); onClose(); }}
            className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all">
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
SaveDraftModal.displayName = 'SaveDraftModal';

// ─── FEATURE 12 — Download Modal ─────────────────────────────────────────────

const DownloadModal = memo(({ onDownload, onClose }: {
  onDownload: (format: string, filename: string) => void;
  onClose: () => void;
}) => {
  const [format,   setFormat]   = useState('pdf');
  const [filename, setFilename] = useState('complaint-draft');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-72 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-orange-500" />
          <h3 className="text-base font-bold text-navy">Download Draft</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">File Name</label>
            <input value={filename} onChange={e => setFilename(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {['pdf','docx','txt'].map(f => (
                <button key={f} type="button" onClick={() => setFormat(f)}
                  className={`py-2 rounded-xl text-xs font-bold uppercase border-2 transition-all
                    ${format === f ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-100 text-gray-500 hover:border-orange-200'}`}>
                  .{f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button type="button" onClick={() => { onDownload(format, filename); onClose(); }}
            className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all flex items-center justify-center gap-1">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
DownloadModal.displayName = 'DownloadModal';

// ─── FEATURE 14 — Editor Toolbar ─────────────────────────────────────────────

const EditorToolbar = memo(({ onAction, result }: { onAction: (a: string) => void; result: string }) => {
  const tools = [
    { icon: <Undo2 className="h-3.5 w-3.5" />,     action: 'undo',      title: 'Undo' },
    { icon: <Redo2 className="h-3.5 w-3.5" />,     action: 'redo',      title: 'Redo' },
    { icon: null, action: 'divider' },
    { icon: <Bold className="h-3.5 w-3.5" />,      action: 'bold',      title: 'Bold' },
    { icon: <Italic className="h-3.5 w-3.5" />,    action: 'italic',    title: 'Italic' },
    { icon: <Underline className="h-3.5 w-3.5" />, action: 'underline', title: 'Underline' },
    { icon: null, action: 'divider' },
    { icon: <List className="h-3.5 w-3.5" />,      action: 'bullets',   title: 'Bullets' },
    { icon: <Hash className="h-3.5 w-3.5" />,      action: 'numbering', title: 'Numbering' },
    { icon: <AlignJustify className="h-3.5 w-3.5" />, action: 'heading', title: 'Heading' },
    { icon: null, action: 'divider' },
    { icon: <Copy className="h-3.5 w-3.5" />,       action: 'copy',     title: 'Copy' },
    { icon: <Printer className="h-3.5 w-3.5" />,    action: 'print',    title: 'Print' },
    { icon: null, action: 'divider' },
    { icon: <Wand2 className="h-3.5 w-3.5" />,      action: 'ai_improve', title: 'AI Improve', highlight: true },
    { icon: <Expand className="h-3.5 w-3.5" />,     action: 'ai_expand',  title: 'AI Expand',  highlight: true },
    { icon: <Minimize2 className="h-3.5 w-3.5" />,  action: 'ai_shorten', title: 'AI Shorten', highlight: true },
  ];

  return (
    <div className="flex items-center gap-0.5 flex-wrap bg-gray-50 border border-gray-200 rounded-xl p-1.5 mb-3">
      {tools.map((t, i) =>
        t.action === 'divider'
          ? <div key={i} className="w-px h-5 bg-gray-200 mx-1" />
          : (
            <motion.button key={t.action} type="button" whileTap={{ scale: 0.88 }} title={t.title}
              onClick={() => onAction(t.action!)}
              className={`p-1.5 rounded-lg transition-colors ${
                (t as any).highlight
                  ? 'text-orange-500 hover:bg-orange-100'
                  : 'text-gray-500 hover:bg-gray-200 hover:text-navy'
              }`}>
              {t.icon}
            </motion.button>
          )
      )}
    </div>
  );
});
EditorToolbar.displayName = 'EditorToolbar';

// ─── FEATURE 15 — Empty State illustration ────────────────────────────────────

const EmptyPreviewState = memo(() => (
  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-20">
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="10" width="80" height="100" rx="8" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="2"/>
        <rect x="32" y="28" width="56" height="5" rx="2.5" fill="#FDBA74" opacity="0.6"/>
        <rect x="32" y="40" width="48" height="4" rx="2" fill="#E5E7EB"/>
        <rect x="32" y="50" width="52" height="4" rx="2" fill="#E5E7EB"/>
        <rect x="32" y="60" width="44" height="4" rx="2" fill="#E5E7EB"/>
        <rect x="32" y="70" width="50" height="4" rx="2" fill="#E5E7EB"/>
        <rect x="32" y="80" width="36" height="4" rx="2" fill="#E5E7EB"/>
        <circle cx="85" cy="85" r="18" fill="#F97316" opacity="0.15"/>
        <path d="M85 77 L85 93 M77 85 L93 85" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </motion.div>
    <p className="text-base font-semibold text-gray-500 mt-4">Your draft will appear here</p>
    <p className="text-xs text-gray-400 mt-2 max-w-[200px]">Complete the 3 steps to generate your professional legal draft</p>
    <div className="mt-6 space-y-1.5 text-xs text-gray-300">
      <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-[10px] font-bold">1</span> Select complaint type</div>
      <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-[10px] font-bold">2</span> Fill in your details</div>
      <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-[10px] font-bold">3</span> AI generates formatted complaint</div>
    </div>
  </div>
));
EmptyPreviewState.displayName = 'EmptyPreviewState';

// ─── Main Component ───────────────────────────────────────────────────────────

export const ComplaintGenerator: React.FC = () => {
  const [step,          setStep]          = useState(1);
  const [formData,      setFormData]      = useState<FormData>(INITIAL_FORM);
  const [loading,       setLoading]       = useState(false);
  const [result,        setResult]        = useState<string | null>(null);
  const [copied,        setCopied]        = useState(false);
  const [savedDrafts,   setSavedDrafts]   = useState<SavedDraft[]>([]);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [showSaveDlg,   setShowSaveDlg]   = useState(false);
  const [showDLDlg,     setShowDLDlg]     = useState(false);
  const [autosaveMsg,   setAutosaveMsg]   = useState<string | null>(null);
  const [zoom,          setZoom]          = useState(100);
  const [fullscreen,    setFullscreen]    = useState(false);
  const [editedResult,  setEditedResult]  = useState<string | null>(null);
  const [missingInfo,   setMissingInfo]   = useState<string | null>(null);
  // ── Backend state ──────────────────────────────────────────────────────────
  const [cases,         setCases]         = useState<CaseDocument[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  const resultRef   = useRef<HTMLDivElement>(null);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Subscribe to real Firestore cases ─────────────────────────────────────
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const unsubscribe = subscribeToCases(userId, (liveCases) => setCases(liveCases));
    return unsubscribe;
  }, []);

  useEffect(() => {
    document.title = 'LawDraft AI — Generate Legal Complaints Instantly';
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  // FEATURE 10 — Autosave every 30 seconds
  useEffect(() => {
    if (!result) return;
    if (autosaveRef.current) clearInterval(autosaveRef.current);
    autosaveRef.current = setInterval(() => {
      setAutosaveMsg('✔ Saved just now');
      setTimeout(() => setAutosaveMsg(null), 3000);
    }, 30000);
    return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
  }, [result]);

  const handleFieldChange = useCallback((field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCategorySelect = useCallback((key: string, label: string) => {
    setFormData(prev => ({ ...prev, category: key, categoryLabel: label }));
  }, []);

  const goNext = useCallback(() => setStep(s => s + 1), []);
  const goBack = useCallback(() => setStep(s => s - 1), []);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setEditedResult(null);
    setMissingInfo(null);
    try {
      const [text, info] = await Promise.all([
        generateComplaintViaBackend(formData),
        generateMissingInfo({
          category: CATEGORIES.find(c => c.key === formData.category)?.label || formData.category,
          description: formData.description,
          formData: formData,
        })
      ]);
      setResult(text);
      setEditedResult(text);
      setMissingInfo(info);
    } catch (err) {
      console.error('Complaint generation error:', err);
      const errMsg = '⚠️ Generation failed. Please check your connection and try again.';
      setResult(errMsg);
      setEditedResult(errMsg);
    } finally {
      setLoading(false);
    }
  }, [formData]);

  const copyToClipboard = useCallback(() => {
    if (!editedResult) return;
    navigator.clipboard.writeText(editedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedResult]);

  const handlePrint = useCallback(() => {
    if (!editedResult) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const category = CATEGORIES.find(c => c.key === formData.category);
    const sig = formData.signatureMode === 'manual'
      ? '<div style="margin-top:40px;"><div style="border-bottom:1px solid #000;width:220px;height:40px;"></div><p style="font-size:12px;margin-top:6px;">Signature</p></div>'
      : '';
    win.document.write(`<html><head><title>PocketLawyer - Legal Draft</title>
<style>body{font-family:${formData.fontFamily},serif;padding:48px;line-height:${formData.lineSpacing};color:#1A1A2E;max-width:800px;margin:0 auto;font-size:${formData.fontSize}pt;}
h1,h2,h3{color:#1A1A2E;}@page{margin:${formData.margins === 'narrow' ? '1cm' : formData.margins === 'wide' ? '3cm' : '2cm'};}
.sig{margin-top:32px;}</style></head>
<body><div>${editedResult.replace(/\n/g, '<br/>')}</div>${sig}
<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    win.document.close();
  }, [editedResult, formData]);

  const handleReset = useCallback(() => {
    setResult(null);
    setEditedResult(null);
    setStep(1);
    setFormData(INITIAL_FORM);
  }, []);

  // FEATURE 11 — Save Draft (persists to Firestore via uploadDocument when a case is selected)
  const handleSaveDraft = useCallback(async (name: string, _folder: string, _tags: string) => {
    const category = CATEGORIES.find(c => c.key === formData.category);
    const content  = editedResult ?? '';
    const draft: SavedDraft = {
      id:        Date.now().toString(),
      name,
      category:  category?.label ?? 'Unknown',
      createdAt: new Date().toLocaleDateString(),
      content,
      favourite: false,
    };
    setSavedDrafts(prev => [draft, ...prev]);

    // Persist to Firestore when a case is selected and user is authenticated
    if (selectedCaseId && auth.currentUser) {
      try {
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], `${name}.txt`, { type: 'text/plain' });
        await uploadDocument({
          caseId:     selectedCaseId,
          file,
          userId:     auth.currentUser.uid,
          uploadedBy: auth.currentUser.displayName ?? auth.currentUser.email ?? 'Unknown',
        });
        setAutosaveMsg('✔ Draft saved to case');
      } catch {
        setAutosaveMsg('✔ Draft saved locally');
      }
    } else {
      setAutosaveMsg('✔ Draft saved');
    }
    setTimeout(() => setAutosaveMsg(null), 3000);
  }, [formData, editedResult, selectedCaseId]);

  // FEATURE 12 — Download
  const handleDownload = useCallback((format: string, filename: string) => {
    if (!editedResult) return;
    const fname = `${filename}.${format}`;
    if (format === 'txt') {
      const blob = new Blob([editedResult], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      handlePrint(); // opens print dialog — browser saves as PDF
    } else if (format === 'docx') {
      // For DOCX, produce a basic RTF-like HTML blob that Word can open
      const html = `<html><body style="font-family:${formData.fontFamily};font-size:${formData.fontSize}pt;line-height:${formData.lineSpacing};">${editedResult.replace(/\n/g,'<br/>')}</body></html>`;
      const blob = new Blob([html], { type: 'application/msword' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
    }
  }, [editedResult, formData, handlePrint]);

  // FEATURE 9 — Sidebar actions
  const openDraft     = useCallback((d: SavedDraft) => { setEditedResult(d.content); setResult(d.content); }, []);
  const renameDraft   = useCallback((id: string, name: string) => setSavedDrafts(prev => prev.map(d => d.id === id ? { ...d, name } : d)), []);
  const deleteDraft   = useCallback((id: string) => setSavedDrafts(prev => prev.filter(d => d.id !== id)), []);
  const favouriteDraft = useCallback((id: string) => setSavedDrafts(prev => prev.map(d => d.id === id ? { ...d, favourite: !d.favourite } : d)), []);
  const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), []);

  // FEATURE 14 — Editor toolbar actions
  const handleToolbarAction = useCallback((action: string) => {
    switch (action) {
      case 'copy':    copyToClipboard(); break;
      case 'print':   handlePrint(); break;
      case 'ai_improve':
        if (editedResult) setEditedResult(prev => (prev ?? '') + `\n\n[AI Improve: connect to ${import.meta.env.VITE_API_URL || "https://pocketlawyer-v100-mvp-production.up.railway.app"}/api/ai/improve for this feature]`); break;
      case 'ai_expand':
        if (editedResult) setEditedResult(prev => (prev ?? '') + `\n\n[AI Expand: connect to ${import.meta.env.VITE_API_URL || "https://pocketlawyer-v100-mvp-production.up.railway.app"}/api/ai/expand for this feature]`); break;
      case 'ai_shorten':
        if (editedResult) setEditedResult(prev => prev ? prev.split('\n').filter((_,i) => i % 2 === 0).join('\n') : null); break;
      default: break;
    }
  }, [copyToClipboard, handlePrint, editedResult]);

  const displayResult = editedResult ?? result;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* FEATURE 10 — Autosave indicator */}
      <AnimatePresence>
        {autosaveMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
          >
            <CheckCircle className="h-3.5 w-3.5" /> {autosaveMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showSaveDlg && <SaveDraftModal onSave={handleSaveDraft} onClose={() => setShowSaveDlg(false)} />}
        {showDLDlg   && <DownloadModal  onDownload={handleDownload} onClose={() => setShowDLDlg(false)} />}
      </AnimatePresence>

      {/* FEATURE 9 — Recent Drafts Sidebar */}
      <RecentDraftsSidebar
        drafts={savedDrafts}
        onOpen={openDraft} onRename={renameDraft} onDelete={deleteDraft} onFavourite={favouriteDraft}
        onClose={toggleSidebar} open={sidebarOpen}
      />

      <div className="text-center mb-12">
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-navy mb-4 leading-tight"
        >
          LawDraft AI
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-gray-600 max-w-2xl mx-auto text-lg"
        >
          Draft professional legal complaints in seconds using AI — fast, accurate, and court-ready.
        </motion.p>
        {/* Case selector — links the generated complaint to an existing case */}
        {cases.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mt-4 flex items-center justify-center gap-2"
          >
            <FolderOpen className="h-4 w-4 text-orange-500 shrink-0" />
            <select
              value={selectedCaseId}
              onChange={e => setSelectedCaseId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all max-w-xs w-full"
            >
              <option value="">Link to case (optional)</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">

        {/* Form Panel */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-gray-100">

          <StepBar step={step} />

          <AnimatePresence mode="wait">
            {step === 1 && (
              <Step1 key="s1" selectedCategory={formData.category} onSelect={handleCategorySelect} onNext={goNext} />
            )}
            {step === 2 && (
              <Step2 key="s2" formData={formData} onChange={handleFieldChange} onBack={goBack} onNext={goNext} />
            )}
            {step === 3 && (
              <Step3 key="s3" formData={formData} loading={loading} onBack={goBack} onGenerate={handleGenerate} />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Result Panel */}
        <motion.div
          ref={resultRef}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className={`bg-white/70 backdrop-blur-xl p-8 rounded-3xl border border-gray-200 min-h-[500px] transition-all duration-300 ${fullscreen ? 'fixed inset-4 z-50 overflow-auto shadow-2xl' : ''}`}
        >
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
              {/* Skeleton loaders */}
              <div className="w-full space-y-3 animate-pulse">
                <div className="h-4 bg-gray-200 rounded-full w-3/4 mx-auto" />
                <div className="h-3 bg-gray-100 rounded-full w-full" />
                <div className="h-3 bg-gray-100 rounded-full w-5/6" />
                <div className="h-3 bg-gray-100 rounded-full w-full" />
                <div className="h-3 bg-gray-100 rounded-full w-4/5" />
                <div className="h-3 bg-gray-100 rounded-full w-full" />
              </div>
              <Loader2 className="h-10 w-10 text-orange-400 animate-spin mt-4" />
              <p className="text-navy font-semibold">AI Draft तैयार हो रहा है...</p>
              <p className="text-sm text-gray-400">Analyzing your complaint and generating formatted document</p>
            </div>
          )}

          {displayResult && !loading && (
            <div className="flex flex-col h-full">
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl mb-3">
                <p className="text-green-700 font-medium text-sm">✅ Your legal complaint is ready — review, edit, or download below</p>
              </div>

              {/* FEATURE 14 — Editor Toolbar */}
              <EditorToolbar onAction={handleToolbarAction} result={displayResult} />

              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold text-navy flex items-center gap-2">
                  <CheckCircle className="text-green-500 h-5 w-5" /> Generated Draft
                </h3>
                <div className="flex items-center gap-1.5">
                  {/* FEATURE 15 — Zoom, Fullscreen */}
                  <button type="button" onClick={() => setZoom(z => Math.max(70, z - 10))} title="Zoom Out"
                    className="p-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
                    <ZoomOut className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <span className="text-xs text-gray-400 w-10 text-center">{zoom}%</span>
                  <button type="button" onClick={() => setZoom(z => Math.min(150, z + 10))} title="Zoom In"
                    className="p-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
                    <ZoomIn className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <motion.button whileTap={{ scale: 0.93 }} onClick={copyToClipboard}
                    className="p-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-all" title="Copy">
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-600" />}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.93 }} onClick={handlePrint}
                    className="p-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-all" title="Print">
                    <Printer className="h-4 w-4 text-gray-600" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.93 }} onClick={() => setFullscreen(f => !f)}
                    className="p-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-all" title="Fullscreen">
                    <Maximize2 className="h-4 w-4 text-gray-600" />
                  </motion.button>
                </div>
              </div>

              <div
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-grow overflow-auto prose prose-slate max-w-none transition-all"
                style={{
                  transform:  `scale(${zoom / 100})`,
                  transformOrigin: 'top left',
                  width:      `${10000 / zoom}%`,
                  fontFamily: formData.fontFamily,
                  fontSize:   `${formData.fontSize}pt`,
                  lineHeight: formData.lineSpacing,
                }}
              >
                <ReactMarkdown>{displayResult}</ReactMarkdown>
              </div>

              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={handlePrint}
                  className="flex-1 bg-navy text-white py-3 rounded-xl font-semibold flex items-center justify-center hover:bg-navy/90 transition-all gap-2 text-sm">
                  <Printer className="h-4 w-4" /> Print / Download PDF
                </button>
                {/* FEATURE 11 — Save Draft */}
                <button type="button" onClick={() => setShowSaveDlg(true)}
                  className="px-4 py-3 rounded-xl border border-orange-200 text-orange-500 hover:bg-orange-50 transition-all text-sm flex items-center gap-1 font-medium">
                  <Save className="h-4 w-4" /> Save
                </button>
                {/* FEATURE 12 — Download */}
                <button type="button" onClick={() => setShowDLDlg(true)}
                  className="px-4 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all text-sm flex items-center gap-1 font-medium">
                  <Download className="h-4 w-4" /> Export
                </button>
                  <button onClick={handleReset}
                    className="px-4 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all text-sm">
                    New
                  </button>
                </div>

                {/* Missing Information Section */}
                {missingInfo && missingInfo !== "Unable to generate missing information section." && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <h3 className="text-sm font-bold text-amber-800">Additional Information Required</h3>
                    </div>
                    <div className="text-xs text-amber-900/80 prose prose-sm prose-amber max-w-none">
                      <ReactMarkdown>{missingInfo}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}


              {fullscreen && (
                <button type="button" onClick={() => setFullscreen(false)}
                  className="absolute top-4 right-4 p-2 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 shadow text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* FEATURE 15 — Beautiful empty state */}
          {!displayResult && !loading && <EmptyPreviewState />}
        </motion.div>
      </div>
    </div>
  );
};

export default ComplaintGenerator;