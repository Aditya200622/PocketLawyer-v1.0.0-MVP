import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../../auth';
import {
  deleteDocument,
  subscribeDocuments,
  uploadDocument,
  type DocumentRecord,
} from '../../services/documentService';
import {
  Upload, FileText, Image as ImageIcon, X, Sparkles,
  ChevronLeft, ChevronRight, Download, Trash2, File as FileIcon,
  CheckCircle2, Loader2, Search, Filter, ChevronDown,
  FolderOpen, Folder, Merge, Scissors, ScanText, MessageSquare,
  AlertCircle, Eye, Calendar, User, HardDrive, Hash, Tag,
  ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2, Minimize2,
  Printer, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  Star, Pin, Share2, Link2, Mail, Clock, Shield, FileCheck,
  Users, Gavel, Scale, BookOpen, AlertTriangle, CheckSquare,
  Square, Copy, ExternalLink, Lock, Unlock, Globe, EyeOff,
  Activity, BarChart2, Database, Layers, History, PlusCircle,
  Bookmark, Flag, PenLine, RefreshCw, TrendingUp, Info,
  ChevronUp, MoreHorizontal, Move, Cpu, Brain,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
type DocCategory =
  | 'FIR' | 'Charge Sheet' | 'Court Order' | 'Petition' | 'Affidavit'
  | 'Evidence' | 'Medical Report' | 'Identity Proof' | 'Financial Record' | 'Other';

type OcrStatus = 'processed' | 'processing' | 'pending' | 'failed';
type DocType = 'pdf' | 'image';

type DocumentTag =
  | 'Urgent' | 'Evidence' | 'Original' | 'Certified Copy' | 'Client Copy'
  | 'Court Copy' | 'Police' | 'Medical' | 'Financial' | 'Pinned' | 'Favorite';

type FolderName =
  | 'Documents' | 'Evidence' | 'Court Orders' | 'Petitions'
  | 'Affidavits' | 'Medical Reports' | 'Financial Records' | 'Identity' | 'Other';

interface DocPage {
  id: string;
  pageNumber: number;
  ocrStatus: OcrStatus;
  ocrProgress: number;
  size: string;
}

interface DocVersion {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  createdBy: string;
  changes: string;
  isCurrent: boolean;
}

interface DocActivity {
  id: string;
  action: 'Uploaded' | 'OCR Started' | 'OCR Completed' | 'AI Summary Generated'
        | 'Downloaded' | 'Shared' | 'Viewed' | 'Moved' | 'Tagged' | 'Noted';
  date: string;
  time: string;
  user: string;
}

interface DocNote {
  id: string;
  content: string;
  isPinned: boolean;
  savedAt: string;
  author: string;
}

interface LegalDocument {
  id: string;
  name: string;
  extension: string;
  category: DocCategory;
  folder: FolderName;
  type: DocType;
  totalPages: number;
  uploadDate: string;
  lastModified: string;
  uploadedBy: string;
  totalSize: string;
  status: OcrStatus;
  thumbnailColor: string;
  pages: DocPage[];
  versions: DocVersion[];
  activity: DocActivity[];
  note: DocNote;
  tags: DocumentTag[];
  isFavorite: boolean;
  isPinned: boolean;
  resolution: string;
  storagePath: string;
  hash: string;
  docId: string;
  aiCompleted: boolean;
  downloadURL?: string;
}

type FilterId = 'all' | 'pdf' | 'image' | 'evidence' | 'court_order' | 'pending_ocr' | 'processed';

interface FilesProps {
  caseTitle?: string;
  caseId?: string;
}

// MOCK_DOCUMENTS removed — data loaded from Firestore via subscribeDocuments.

const FOLDER_NAMES: FolderName[] = [
  'Documents', 'Evidence', 'Court Orders', 'Petitions',
  'Affidavits', 'Medical Reports', 'Financial Records', 'Identity', 'Other',
];

const CATEGORIES: DocCategory[] = [
  'FIR', 'Charge Sheet', 'Court Order', 'Petition', 'Affidavit',
  'Evidence', 'Medical Report', 'Identity Proof', 'Financial Record', 'Other',
];

const ALL_TAGS: DocumentTag[] = [
  'Urgent', 'Evidence', 'Original', 'Certified Copy', 'Client Copy',
  'Court Copy', 'Police', 'Medical', 'Financial', 'Pinned', 'Favorite',
];

const FILTER_TABS: Array<{ id: FilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Images' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'court_order', label: 'Court Orders' },
  { id: 'pending_ocr', label: 'Pending OCR' },
  { id: 'processed', label: 'Processed' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const toDisplayDate = (value: unknown) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return new Date(value as string | number | Date).toISOString().slice(0, 10);
};

const mapDocumentRecordToLegalDocument = (record: DocumentRecord): LegalDocument => {
  const extension = record.originalName.split('.').pop()?.toLowerCase() ?? 'pdf';
  const inferredType: DocType = record.mimeType.startsWith('image') ? 'image' : 'pdf';
  const isProcessed = record.status === 'ready';
  const date = toDisplayDate(record.uploadedAt);
  return {
    id: record.id,
    name: record.originalName.replace(/\.[^.]+$/, ''),
    extension,
    category: 'Other',
    folder: 'Other',
    type: inferredType,
    totalPages: record.pageCount ?? 1,
    uploadDate: date,
    lastModified: date,
    uploadedBy: record.uploadedBy || 'Current User',
    totalSize: formatBytes(record.fileSize),
    status: isProcessed ? 'processed' : 'processing',
    thumbnailColor: inferredType === 'pdf' ? '#FEF3E7' : '#F0FDF4',
    resolution: inferredType === 'image' ? '300 DPI' : '300 DPI',
    storagePath: record.storagePath,
    hash: record.id,
    docId: record.id,
    aiCompleted: false,
    downloadURL: record.downloadURL,
    tags: [],
    isFavorite: false,
    isPinned: false,
    pages: [{
      id: `${record.id}-p1`,
      pageNumber: 1,
      ocrStatus: isProcessed ? 'processed' : 'processing',
      ocrProgress: isProcessed ? 100 : 0,
      size: formatBytes(record.fileSize),
    }],
    versions: [{
      id: `v-${record.id}`,
      version: 1,
      label: 'v1.0 (Latest)',
      createdAt: date,
      createdBy: record.uploadedBy || 'Current User',
      changes: 'Initial upload',
      isCurrent: true,
    }],
    activity: [{
      id: `a-${record.id}`,
      action: 'Uploaded',
      date,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      user: record.uploadedBy || 'Current User',
    }],
    note: { id: `n-${record.id}`, content: '', isPinned: false, savedAt: '', author: record.uploadedBy || 'Current User' },
  };
};

const createPendingDocument = (file: File, id: string): LegalDocument => {
  const isPdf = file.type.includes('pdf');
  const now = new Date().toISOString().slice(0, 10);
  return {
    id,
    name: file.name.replace(/\.[^.]+$/, ''),
    extension: isPdf ? 'pdf' : 'jpg',
    category: 'Other',
    folder: 'Other',
    type: isPdf ? 'pdf' : 'image',
    totalPages: 1,
    uploadDate: now,
    lastModified: now,
    uploadedBy: 'Current User',
    totalSize: formatBytes(file.size),
    status: 'processing',
    thumbnailColor: isPdf ? '#FEF3E7' : '#F0FDF4',
    resolution: '300 DPI',
    storagePath: `/uploads/${file.name}`,
    hash: id,
    docId: id,
    aiCompleted: false,
    tags: [],
    isFavorite: false,
    isPinned: false,
    pages: [{ id: `${id}-p1`, pageNumber: 1, ocrStatus: 'processing', ocrProgress: 0, size: formatBytes(file.size) }],
    versions: [{ id: `v-${id}`, version: 1, label: 'v1.0 (Latest)', createdAt: now, createdBy: 'Current User', changes: 'Initial upload', isCurrent: true }],
    activity: [{ id: `a-${id}`, action: 'Uploaded', date: now, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), user: 'Current User' }],
    note: { id: `n-${id}`, content: '', isPinned: false, savedAt: '', author: 'Current User' },
  };
};

const ocrBadge: Record<OcrStatus, { label: string; color: string; bg: string }> = {
  processed: { label: 'OCR Done', color: '#15803D', bg: '#F0FDF4' },
  processing: { label: 'Processing…', color: '#C2410C', bg: '#FFF7ED' },
  pending: { label: 'OCR Pending', color: '#9CA3AF', bg: '#F3F4F6' },
  failed: { label: 'OCR Failed', color: '#DC2626', bg: '#FEF2F2' },
};

const categoryColor: Record<DocCategory, string> = {
  'FIR': '#F97316', 'Charge Sheet': '#EF4444', 'Court Order': '#8B5CF6',
  'Petition': '#3B82F6', 'Affidavit': '#06B6D4', 'Evidence': '#F59E0B',
  'Medical Report': '#10B981', 'Identity Proof': '#6366F1',
  'Financial Record': '#EC4899', 'Other': '#9CA3AF',
};

const tagColor: Record<DocumentTag, { bg: string; color: string }> = {
  'Urgent': { bg: '#FEF2F2', color: '#DC2626' },
  'Evidence': { bg: '#FFFBEB', color: '#D97706' },
  'Original': { bg: '#F0FDF4', color: '#15803D' },
  'Certified Copy': { bg: '#EFF6FF', color: '#1D4ED8' },
  'Client Copy': { bg: '#F5F3FF', color: '#7C3AED' },
  'Court Copy': { bg: '#FDF4FF', color: '#9333EA' },
  'Police': { bg: '#F0F9FF', color: '#0369A1' },
  'Medical': { bg: '#ECFDF5', color: '#059669' },
  'Financial': { bg: '#FFF1F2', color: '#BE123C' },
  'Pinned': { bg: '#FFF7ED', color: '#C2410C' },
  'Favorite': { bg: '#FEF3C7', color: '#B45309' },
};

const activityIcon: Record<DocActivity['action'], React.ReactNode> = {
  'Uploaded': <Upload className="h-3 w-3" />,
  'OCR Started': <Cpu className="h-3 w-3" />,
  'OCR Completed': <CheckCircle2 className="h-3 w-3" />,
  'AI Summary Generated': <Sparkles className="h-3 w-3" />,
  'Downloaded': <Download className="h-3 w-3" />,
  'Shared': <Share2 className="h-3 w-3" />,
  'Viewed': <Eye className="h-3 w-3" />,
  'Moved': <Move className="h-3 w-3" />,
  'Tagged': <Tag className="h-3 w-3" />,
  'Noted': <PenLine className="h-3 w-3" />,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
}
const ActionBtn: React.FC<ActionBtnProps> = ({ icon, label, primary, danger, onClick, disabled = false, small }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-1.5 rounded-lg font-semibold transition-all"
    style={{
      padding: small ? '6px 10px' : '8px 12px',
      fontSize: '11px',
      background: disabled ? '#F3F4F6' : primary ? '#F97316' : danger ? '#FEF2F2' : '#FFFFFF',
      color: disabled ? '#D1D5DB' : primary ? '#FFFFFF' : danger ? '#DC2626' : '#374151',
      border: disabled || primary || danger ? 'none' : '1px solid #E5E7EB',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
    onMouseEnter={e => {
      if (disabled) return;
      if (primary) (e.currentTarget as HTMLElement).style.background = '#EA580C';
      else if (danger) (e.currentTarget as HTMLElement).style.background = '#FEE2E2';
      else (e.currentTarget as HTMLElement).style.background = '#F9FAFB';
    }}
    onMouseLeave={e => {
      if (disabled) return;
      if (primary) (e.currentTarget as HTMLElement).style.background = '#F97316';
      else if (danger) (e.currentTarget as HTMLElement).style.background = '#FEF2F2';
      else (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
    }}
  >
    {icon}{label}
  </button>
);

// ─── 1. Statistics Cards ─────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bg: string;
  delay?: number;
}
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, sub, color, bg, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    className="rounded-xl p-4 flex items-start gap-3"
    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
  >
    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
      <span style={{ color }}>{icon}</span>
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9CA3AF' }}>{label}</p>
      <p className="text-xl font-bold leading-none text-gray-900">{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>{sub}</p>}
    </div>
  </motion.div>
);

// ─── 7. Page Thumbnail ───────────────────────────────────────────────────────
interface PageThumbnailProps {
  page: DocPage;
  doc: LegalDocument;
  isSelected: boolean;
  onClick: () => void;
}
const PageThumbnail: React.FC<PageThumbnailProps> = ({ page, doc, isSelected, onClick }) => {
  const ocr = ocrBadge[page.ocrStatus];
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex-shrink-0 cursor-pointer rounded-lg overflow-hidden transition-all"
      style={{
        width: 56,
        border: isSelected ? '2px solid #F97316' : '2px solid transparent',
        background: isSelected ? '#FFF7ED' : '#F3F4F6',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ height: 64, background: doc.thumbnailColor }}
      >
        {doc.type === 'pdf'
          ? <FileText className="h-5 w-5" style={{ color: '#C2410C', opacity: 0.5 }} />
          : <ImageIcon className="h-5 w-5" style={{ color: '#15803D', opacity: 0.5 }} />}
      </div>
      <div className="px-1 py-1 text-center">
        <p className="text-[9px] font-semibold" style={{ color: isSelected ? '#C2410C' : '#6B7280' }}>
          p{page.pageNumber}
        </p>
        {page.ocrStatus === 'processing' && (
          <div className="w-full h-0.5 rounded-full mt-0.5 overflow-hidden" style={{ background: '#E5E7EB' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#F97316', width: `${page.ocrProgress}%` }}
              initial={{ width: '0%' }}
              animate={{ width: `${page.ocrProgress}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        )}
        {page.ocrStatus === 'processed' && (
          <CheckCircle2 className="h-2.5 w-2.5 mx-auto mt-0.5" style={{ color: '#22C55E' }} />
        )}
        {page.ocrStatus === 'pending' && (
          <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: '#D1D5DB' }} />
        )}
      </div>
    </motion.div>
  );
};

// ─── 10. Notes Panel ────────────────────────────────────────────────────────
interface NotesPanelProps {
  doc: LegalDocument;
  onUpdate: (content: string) => void;
}
const NotesPanel: React.FC<NotesPanelProps> = ({ doc, onUpdate }) => {
  const [draft, setDraft] = useState(doc.note.content);
  const [autoSaved, setAutoSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX = 500;

  useEffect(() => { setDraft(doc.note.content); }, [doc.id]);

  const handleChange = (v: string) => {
    if (v.length > MAX) return;
    setDraft(v);
    setAutoSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { onUpdate(v); setAutoSaved(true); }, 1200);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="flex items-center gap-2">
          <PenLine className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
          <p className="text-xs font-semibold text-gray-700">Private Notes</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>Advocate Only</span>
        </div>
        <div className="flex items-center gap-2">
          {doc.note.isPinned && <Pin className="h-3 w-3" style={{ color: '#F97316' }} />}
          {autoSaved && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] font-medium flex items-center gap-1"
              style={{ color: '#15803D' }}
            >
              <CheckCircle2 className="h-3 w-3" /> Saved
            </motion.span>
          )}
        </div>
      </div>
      <div className="p-4">
        <textarea
          value={draft}
          onChange={e => handleChange(e.target.value)}
          placeholder="Add a private note about this document…"
          rows={4}
          className="w-full resize-none text-xs text-gray-800 outline-none placeholder-gray-300 rounded-lg p-3"
          style={{ background: '#FAFAFA', border: '1px solid #F3F4F6', lineHeight: 1.6 }}
          onFocus={e => (e.currentTarget.style.borderColor = '#F97316')}
          onBlur={e => (e.currentTarget.style.borderColor = '#F3F4F6')}
        />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px]" style={{ color: '#D1D5DB' }}>
            {doc.note.savedAt ? `Last saved ${doc.note.savedAt}` : 'Not yet saved'}
          </p>
          <p className="text-[10px]" style={{ color: draft.length > MAX * 0.85 ? '#EF4444' : '#D1D5DB' }}>
            {draft.length}/{MAX}
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── 11. Tag System ─────────────────────────────────────────────────────────
interface TagPanelProps {
  doc: LegalDocument;
  onToggleTag: (tag: DocumentTag) => void;
}
const TagPanel: React.FC<TagPanelProps> = ({ doc, onToggleTag }) => (
  <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <Tag className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
      <p className="text-xs font-semibold text-gray-700">Tags</p>
    </div>
    <div className="px-4 py-3 flex flex-wrap gap-1.5">
      {ALL_TAGS.map(t => {
        const active = doc.tags.includes(t);
        const tc = tagColor[t];
        return (
          <motion.button
            key={t}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggleTag(t)}
            className="text-[10px] font-bold px-2 py-1 rounded-full transition-all"
            style={{
              background: active ? tc.bg : '#F9FAFB',
              color: active ? tc.color : '#D1D5DB',
              border: active ? `1px solid ${tc.color}30` : '1px solid #F3F4F6',
            }}
          >
            {t}
          </motion.button>
        );
      })}
    </div>
  </div>
);

// ─── 4. Timeline Panel ──────────────────────────────────────────────────────
const activityColor: Record<DocActivity['action'], string> = {
  'Uploaded': '#3B82F6', 'OCR Started': '#F97316', 'OCR Completed': '#22C55E',
  'AI Summary Generated': '#8B5CF6', 'Downloaded': '#0EA5E9', 'Shared': '#EC4899',
  'Viewed': '#9CA3AF', 'Moved': '#F59E0B', 'Tagged': '#06B6D4', 'Noted': '#6366F1',
};

interface TimelinePanelProps { doc: LegalDocument }
const TimelinePanel: React.FC<TimelinePanelProps> = ({ doc }) => (
  <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <Activity className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
      <p className="text-xs font-semibold text-gray-700">Document Timeline</p>
    </div>
    <div className="px-4 py-3 space-y-0">
      {doc.activity.map((ev, i) => {
        const color = activityColor[ev.action];
        const isLast = i === doc.activity.length - 1;
        return (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex gap-3"
          >
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, color }}>
                {activityIcon[ev.action]}
              </div>
              {!isLast && <div className="w-px flex-1 my-1" style={{ background: '#F3F4F6', minHeight: 16 }} />}
            </div>
            <div className="pb-3 min-w-0">
              <p className="text-[11px] font-semibold text-gray-800">{ev.action}</p>
              <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{ev.date} · {ev.time}</p>
              <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{ev.user}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  </div>
);

// ─── 5. Version History ─────────────────────────────────────────────────────
interface VersionPanelProps {
  doc: LegalDocument;
  selectedVersion: string;
  onSelectVersion: (id: string) => void;
}
const VersionPanel: React.FC<VersionPanelProps> = ({ doc, selectedVersion, onSelectVersion }) => (
  <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <History className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
      <p className="text-xs font-semibold text-gray-700">Version History</p>
      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
        {doc.versions.length} version{doc.versions.length !== 1 ? 's' : ''}
      </span>
    </div>
    <div className="px-4 py-3 space-y-2">
      {doc.versions.map(v => {
        const isSelected = selectedVersion === v.id;
        return (
          <motion.div
            key={v.id}
            whileHover={{ scale: 1.01 }}
            onClick={() => onSelectVersion(v.id)}
            className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all"
            style={{
              background: isSelected ? '#FFF7ED' : '#FAFAFA',
              border: isSelected ? '1px solid #F97316' : '1px solid transparent',
            }}
          >
            <div
              className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
              style={{ background: isSelected ? '#F97316' : '#E5E7EB', color: isSelected ? '#FFFFFF' : '#9CA3AF' }}
            >
              {v.version}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold text-gray-800">{v.label}</p>
                {v.isCurrent && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#15803D' }}>Current</span>
                )}
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{formatDate(v.createdAt)} · {v.createdBy}</p>
              <p className="text-[10px] mt-0.5 text-gray-500">{v.changes}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  </div>
);

// ─── 12. Document Properties ─────────────────────────────────────────────────
interface DocPropertiesProps { doc: LegalDocument }
const DocProperties: React.FC<DocPropertiesProps> = ({ doc }) => {
  const catColor = categoryColor[doc.category];
  const ocr = ocrBadge[doc.status];
  const rows = [
    { label: 'File Name', value: `${doc.name}.${doc.extension}` },
    { label: 'Extension', value: `.${doc.extension.toUpperCase()}` },
    { label: 'Pages', value: `${doc.totalPages}` },
    { label: 'Resolution', value: doc.resolution },
    { label: 'Size', value: doc.totalSize },
    { label: 'Upload Date', value: formatDate(doc.uploadDate) },
    { label: 'Last Modified', value: formatDate(doc.lastModified) },
    { label: 'Created By', value: doc.uploadedBy },
    { label: 'Storage Path', value: doc.storagePath },
    { label: 'Hash', value: doc.hash },
    { label: 'Category', value: doc.category },
    { label: 'Type', value: doc.type.toUpperCase() },
    { label: 'Document ID', value: doc.docId },
  ];
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
          <p className="text-xs font-semibold text-gray-700">Document Properties</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${catColor}18`, color: catColor }}>{doc.category}</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: '#9CA3AF' }}>{row.label}</span>
            <span className="text-[10px] font-semibold text-gray-700 text-right truncate max-w-[160px]" title={row.value}>{row.value}</span>
          </div>
        ))}
        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: ocr.bg, color: ocr.color }}>{ocr.label}</span>
          {doc.aiCompleted && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F5F3FF', color: '#7C3AED' }}>AI Done</span>
          )}
          {doc.isFavorite && <Star className="h-3 w-3" style={{ color: '#F59E0B' }} />}
          {doc.isPinned && <Pin className="h-3 w-3" style={{ color: '#F97316' }} />}
        </div>
      </div>
    </div>
  );
};

// ─── 9. AI Panel ─────────────────────────────────────────────────────────────
interface AIPanelProps { doc: LegalDocument }
const AIPanel: React.FC<AIPanelProps> = ({ doc }) => {
  const aiCards = [
    { icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Summary', desc: 'Key facts and context' },
    { icon: <Users className="h-3.5 w-3.5" />, label: 'People', desc: 'Parties, witnesses, officers' },
    { icon: <Gavel className="h-3.5 w-3.5" />, label: 'Court', desc: 'Court name and case number' },
    { icon: <User className="h-3.5 w-3.5" />, label: 'Judge', desc: 'Presiding judge details' },
    { icon: <FileText className="h-3.5 w-3.5" />, label: 'Sections', desc: 'IPC / CrPC sections cited' },
    { icon: <Scale className="h-3.5 w-3.5" />, label: 'Acts', desc: 'Acts and statutes referenced' },
    { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Important Dates', desc: 'Hearings, deadlines, events' },
    { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Risk Score', desc: 'Legal risk assessment' },
    { icon: <Clock className="h-3.5 w-3.5" />, label: 'Deadlines', desc: 'Filing and compliance dates' },
    { icon: <Shield className="h-3.5 w-3.5" />, label: 'Evidence', desc: 'Evidence items extracted' },
    { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Contradictions', desc: 'Conflicting statements' },
    { icon: <CheckSquare className="h-3.5 w-3.5" />, label: 'Recommendations', desc: 'AI-suggested actions' },
  ];
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}>
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1A1A1A' }}>
          <Brain className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">AI Analysis</p>
          <p className="text-[11px] truncate" style={{ color: '#525252' }}>{doc.name}.{doc.extension}</p>
        </div>
        {doc.aiCompleted && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#1F1F1F', color: '#8B5CF6' }}>AI Done</span>
        )}
      </div>
      <div className="px-5 py-4 space-y-3">
        <div
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
          style={{ background: '#141414', border: '1px solid #1F1F1F' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#525252' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#A3A3A3' }}>AI Status</p>
            <p className="text-xs font-bold mt-0.5" style={{ color: '#525252' }}>
              {doc.aiCompleted ? 'Analysis Complete' : 'Waiting for Analysis'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {aiCards.map(card => (
            <div
              key={card.label}
              className="rounded-lg px-3 py-2.5 flex items-start gap-2"
              style={{ background: '#141414', border: '1px solid #1F1F1F', opacity: doc.aiCompleted ? 0.9 : 0.4 }}
            >
              <span style={{ color: '#525252', flexShrink: 0, marginTop: 1 }}>{card.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold" style={{ color: '#737373' }}>{card.label}</p>
                <p className="text-[9px]" style={{ color: '#404040' }}>{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold"
          style={{ background: '#1A1A1A', color: '#404040', cursor: 'not-allowed', border: '1px solid #1F1F1F' }}
        >
          <Sparkles className="h-3.5 w-3.5" /> Generate AI Summary
        </button>
      </div>
      <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderTop: '1px solid #1A1A1A' }}>
        <button disabled className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: '#141414', color: '#404040', cursor: 'not-allowed' }}>
          <Eye className="h-3.5 w-3.5" /> View OCR
        </button>
        <button disabled className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: '#1A1A1A', color: '#404040', cursor: 'not-allowed' }}>
          <MessageSquare className="h-3.5 w-3.5" /> Ask AI
        </button>
      </div>
    </div>
  );
};

// ─── 13. Share Panel ────────────────────────────────────────────────────────
const SharePanel: React.FC = () => (
  <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <Share2 className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
      <p className="text-xs font-semibold text-gray-700">Share Document</p>
    </div>
    <div className="px-4 py-3 space-y-2">
      {[
        { icon: <Link2 className="h-3.5 w-3.5" />, label: 'Generate Link', desc: 'Create shareable link' },
        { icon: <Globe className="h-3.5 w-3.5" />, label: 'Client Portal', desc: 'Share via portal' },
        { icon: <Mail className="h-3.5 w-3.5" />, label: 'Email', desc: 'Send via email' },
        { icon: <MessageSquare className="h-3.5 w-3.5" />, label: 'WhatsApp', desc: 'Send via WhatsApp' },
      ].map(item => (
        <button
          key={item.label}
          disabled
          className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all"
          style={{ background: '#FAFAFA', border: '1px solid #F3F4F6', cursor: 'not-allowed', opacity: 0.6 }}
        >
          <span style={{ color: '#9CA3AF' }}>{item.icon}</span>
          <div>
            <p className="text-[11px] font-semibold text-gray-700">{item.label}</p>
            <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{item.desc}</p>
          </div>
        </button>
      ))}
      <div className="pt-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>Link Type</span>
          <div className="flex gap-1">
            {['Private', 'Public'].map(t => (
              <button key={t} disabled className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: t === 'Private' ? '#F97316' : '#F3F4F6', color: t === 'Private' ? '#FFF' : '#9CA3AF', cursor: 'not-allowed' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>Expiry</span>
          <span className="text-[10px] font-semibold text-gray-500">7 days</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>Password</span>
          <Lock className="h-3 w-3" style={{ color: '#D1D5DB' }} />
        </div>
      </div>
    </div>
  </div>
);

// ─── 15. Storage Info ────────────────────────────────────────────────────────
interface StorageBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  unit: string;
}
const StorageBar: React.FC<StorageBarProps> = ({ label, value, max, color, unit }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>{label}</span>
      <span className="text-[10px] font-bold text-gray-700">{value} {unit}</span>
    </div>
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  </div>
);

// ─── 16. Empty State ────────────────────────────────────────────────────────
interface EmptyStateProps { onUpload: () => void }
const EmptyState: React.FC<EmptyStateProps> = ({ onUpload }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 text-center px-8"
    style={{ background: '#FAFAFA', borderRadius: 16, border: '1.5px dashed #E5E7EB' }}
  >
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: '#FFF7ED' }}>
      <FolderOpen className="h-8 w-8" style={{ color: '#F97316', opacity: 0.7 }} />
    </div>
    <h3 className="text-base font-bold text-gray-800 mb-1.5">No documents yet</h3>
    <p className="text-sm text-gray-400 max-w-xs mb-6">
      Upload PDFs, images, and scanned documents to get started. All files are organised by category automatically.
    </p>
    <button
      onClick={onUpload}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
      style={{ background: '#F97316' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
    >
      <Upload className="h-4 w-4" /> Upload Your First Document
    </button>
    <div className="mt-6 grid grid-cols-3 gap-3 text-[11px] text-gray-400">
      {['Supports PDF & images', 'Automatic OCR processing', 'AI-powered analysis'].map(tip => (
        <div key={tip} className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: '#22C55E' }} /> {tip}
        </div>
      ))}
    </div>
  </motion.div>
);

// ─── 17. Skeleton Loading ────────────────────────────────────────────────────
const SkeletonLine: React.FC<{ w?: string; h?: string }> = ({ w = '100%', h = '10px' }) => (
  <motion.div
    className="rounded"
    style={{ width: w, height: h, background: '#F3F4F6' }}
    animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 1.4, repeat: Infinity }}
  />
);

const SkeletonCard: React.FC = () => (
  <div className="rounded-xl p-4 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg" style={{ background: '#F3F4F6' }} />
      <div className="flex-1 space-y-1.5">
        <SkeletonLine w="60%" />
        <SkeletonLine w="40%" />
      </div>
    </div>
    <SkeletonLine />
    <SkeletonLine w="70%" />
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const Files: React.FC<FilesProps> = ({ caseTitle = 'Sharma vs. State of UP', caseId }) => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<FolderName>>(new Set(['Documents', 'Evidence', 'Petitions', 'Affidavits']));
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const [selectedPage, setSelectedPage] = useState<DocPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [dragActive, setDragActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [rightTab, setRightTab] = useState<'ai' | 'timeline' | 'versions' | 'notes' | 'tags' | 'properties' | 'share'>('ai');
  const [isLoading, setIsLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!caseId?.trim()) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const userId = auth.currentUser?.uid || 'anonymous';
    const unsubscribe = subscribeDocuments(
      caseId,
      userId,
      (records) => {
        const mappedDocs = records.map(mapDocumentRecordToLegalDocument);
        setDocuments(mappedDocs);
        setIsLoading(false);
        if (mappedDocs.length > 0) {
          setSelectedDoc(prev => (prev && mappedDocs.some(doc => doc.id === prev.id) ? prev : mappedDocs[0]));
          setSelectedPage(prev => {
            const currentDocId = prev ? documents.find(doc => doc.pages.some(p => p.id === prev.id))?.id : undefined;
            const currentDoc = mappedDocs.find(doc => doc.id === currentDocId) ?? mappedDocs[0];
            return prev && currentDoc.pages.some(page => page.id === prev.id) ? prev : currentDoc.pages[0];
          });
        } else {
          setSelectedDoc(null);
          setSelectedPage(null);
        }
      },
      (error) => {
        setUploadError(error.error || 'Unable to load documents right now.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [caseId]);

  // Stats
  const totalDocs = documents.length;
  const totalPages = useMemo(() => documents.reduce((s, d) => s + d.totalPages, 0), [documents]);
  const totalStorageMB = useMemo(() => {
    return documents.reduce((s, d) => {
      const n = parseFloat(d.totalSize);
      const u = d.totalSize.includes('MB') ? 1 : 0.001;
      return s + n * u;
    }, 0);
  }, [documents]);
  const ocrCompleted = useMemo(() => documents.filter(d => d.status === 'processed').length, [documents]);
  const aiCompleted = useMemo(() => documents.filter(d => d.aiCompleted).length, [documents]);
  const favoriteCount = useMemo(() => documents.filter(d => d.isFavorite).length, [documents]);
  const pinnedCount = useMemo(() => documents.filter(d => d.isPinned).length, [documents]);
  const recentUpload = useMemo(() => {
    const sorted = [...documents].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    return sorted[0]?.uploadDate ?? '';
  }, [documents]);

  // Folder grouping
  const docsByFolder = useMemo(() => {
    const map: Record<FolderName, LegalDocument[]> = {} as Record<FolderName, LegalDocument[]>;
    FOLDER_NAMES.forEach(f => { map[f] = []; });
    documents.forEach(d => { if (map[d.folder]) map[d.folder].push(d); });
    return map;
  }, [documents]);

  // Filter + search
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (activeFilter === 'pdf' && doc.type !== 'pdf') return false;
      if (activeFilter === 'image' && doc.type !== 'image') return false;
      if (activeFilter === 'evidence' && doc.category !== 'Evidence') return false;
      if (activeFilter === 'court_order' && doc.category !== 'Court Order') return false;
      if (activeFilter === 'pending_ocr' && doc.status !== 'pending' && doc.status !== 'processing') return false;
      if (activeFilter === 'processed' && doc.status !== 'processed') return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return doc.name.toLowerCase().includes(q)
        || doc.category.toLowerCase().includes(q)
        || doc.folder.toLowerCase().includes(q)
        || doc.tags.some(t => t.toLowerCase().includes(q));
    });
  }, [documents, activeFilter, searchQuery]);

  const filteredByFolder = useMemo(() => {
    const map: Record<FolderName, LegalDocument[]> = {} as Record<FolderName, LegalDocument[]>;
    FOLDER_NAMES.forEach(f => { map[f] = []; });
    filteredDocs.forEach(d => { if (map[d.folder]) map[d.folder].push(d); });
    return map;
  }, [filteredDocs]);

  const toggleExpand = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };

  const toggleFolder = (f: FolderName) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  };

  const selectPage = (doc: LegalDocument, page: DocPage) => {
    setSelectedDoc(doc);
    setSelectedPage(page);
    setSelectedVersionId(doc.versions.find(v => v.isCurrent)?.id ?? '');
    if (!expandedDocs.has(doc.id)) setExpandedDocs(prev => new Set([...prev, doc.id]));
  };

  const selectDoc = (doc: LegalDocument) => {
    setSelectedDoc(doc);
    setSelectedPage(doc.pages[0]);
    setSelectedVersionId(doc.versions.find(v => v.isCurrent)?.id ?? '');
  };

  // Bulk selection
  const toggleSelectDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredDocs.map(d => d.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setUploadError(null);
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map(id => deleteDocument(id)));
    const failed = results.find(result => !result.success);
    if (failed && 'error' in failed) {
      setUploadError(failed.error);
      return;
    }
    setDocuments(prev => prev.filter(doc => !selectedIds.has(doc.id)));
    setSelectedIds(new Set());
    const remaining = documents.filter(doc => !selectedIds.has(doc.id));
    if (remaining.length > 0) selectDoc(remaining[0]);
    else { setSelectedDoc(null); setSelectedPage(null); }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    if (!caseId?.trim()) {
      setUploadError('Select a case before uploading documents.');
      return;
    }

    const files = Array.from(fileList);
    const maxDocs = 15;
    const remainingSlots = maxDocs - documents.length;
    if (remainingSlots <= 0) {
      setUploadError('This case already has 15 documents. Delete one before uploading another.');
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    if (filesToUpload.length < files.length) {
      setUploadError(`Only ${filesToUpload.length} file${filesToUpload.length === 1 ? '' : 's'} were uploaded because the limit is 15 documents.`);
    }

    if (filesToUpload.length === 0) return;

    const currentUser = auth.currentUser;
    const userId = currentUser?.uid ?? 'anonymous';
    const uploadedBy = currentUser?.displayName || currentUser?.email || 'Current User';

    const pendingDocs = filesToUpload.map(file => {
      const tempId = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return { tempId, file, pendingDoc: createPendingDocument(file, tempId) };
    });

    setDocuments(prev => [...prev, ...pendingDocs.map(item => item.pendingDoc)]);
    setSelectedDoc(pendingDocs[0].pendingDoc);
    setSelectedPage(pendingDocs[0].pendingDoc.pages[0]);
    setUploadError(null);

    for (const { tempId, file, pendingDoc } of pendingDocs) {
      const result = await uploadDocument(
        { caseId, file, userId, uploadedBy },
        (percent) => {
          setDocuments(prev => prev.map(doc => doc.id === tempId ? {
            ...doc,
            pages: [{ ...doc.pages[0], ocrStatus: 'processing', ocrProgress: percent, size: formatBytes(file.size) }],
            status: percent === 100 ? 'processed' : 'processing',
          } : doc));
        }
      );

      if ('error' in result) {
        setDocuments(prev => prev.map(doc => doc.id === tempId ? { ...doc, status: 'failed', pages: [{ ...doc.pages[0], ocrStatus: 'failed', ocrProgress: 0 }] } : doc));
        setUploadError(result.error);
      } else {
        const uploadedDoc = mapDocumentRecordToLegalDocument(result.data);
        setDocuments(prev => prev.filter(doc => doc.id !== tempId).concat(uploadedDoc));
        setSelectedDoc(uploadedDoc);
        setSelectedPage(uploadedDoc.pages[0]);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadError(null);
    const result = await deleteDocument(docId);
    if ('error' in result) {
      setUploadError(result.error);
      return;
    }

    setDocuments(prev => prev.filter(d => d.id !== docId));
    if (selectedDoc?.id === docId) {
      const remaining = documents.filter(d => d.id !== docId);
      if (remaining.length > 0) selectDoc(remaining[0]);
      else { setSelectedDoc(null); setSelectedPage(null); }
    }
  };

  const handleDownload = (doc: LegalDocument) => {
    if (!doc.downloadURL) return;
    const link = document.createElement('a');
    link.href = doc.downloadURL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const updateNote = (content: string) => {
    if (!selectedDoc) return;
    setDocuments(prev => prev.map(d =>
      d.id === selectedDoc.id
        ? { ...d, note: { ...d.note, content, savedAt: new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) } }
        : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, note: { ...prev.note, content } } : prev);
  };

  const toggleTag = (tag: DocumentTag) => {
    if (!selectedDoc) return;
    const updatedTags = selectedDoc.tags.includes(tag)
      ? selectedDoc.tags.filter(t => t !== tag)
      : [...selectedDoc.tags, tag];
    const updated = { ...selectedDoc, tags: updatedTags };
    setSelectedDoc(updated);
    setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? updated : d));
  };

  const toggleFavorite = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, isFavorite: !d.isFavorite } : d));
    if (selectedDoc.id === docId) setSelectedDoc(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
  };

  // Page navigation
  const currentPageIndex = selectedDoc && selectedPage ? selectedDoc.pages.findIndex(p => p.id === selectedPage.id) : -1;
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = selectedDoc ? currentPageIndex < selectedDoc.pages.length - 1 : false;

  const rightTabs: Array<{ id: typeof rightTab; label: string; icon: React.ReactNode }> = [
    { id: 'ai', label: 'AI', icon: <Brain className="h-3 w-3" /> },
    { id: 'timeline', label: 'Timeline', icon: <Activity className="h-3 w-3" /> },
    { id: 'versions', label: 'Versions', icon: <History className="h-3 w-3" /> },
    { id: 'notes', label: 'Notes', icon: <PenLine className="h-3 w-3" /> },
    { id: 'tags', label: 'Tags', icon: <Tag className="h-3 w-3" /> },
    { id: 'properties', label: 'Info', icon: <Info className="h-3 w-3" /> },
    { id: 'share', label: 'Share', icon: <Share2 className="h-3 w-3" /> },
  ];

  // Guard: only render 3-panel and preview if a document is selected
  const hasSelection = selectedDoc !== null && selectedPage !== null;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_300px] gap-4">
          <SkeletonCard />
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── 1. Statistics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard icon={<FileIcon className="h-4 w-4" />} label="Documents" value={totalDocs} color="#3B82F6" bg="#EFF6FF" delay={0} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Pages" value={totalPages} color="#8B5CF6" bg="#F5F3FF" delay={0.05} />
        <StatCard icon={<Database className="h-4 w-4" />} label="Storage Used" value={`${totalStorageMB.toFixed(1)} MB`} color="#0EA5E9" bg="#F0F9FF" delay={0.1} />
        <StatCard icon={<ScanText className="h-4 w-4" />} label="OCR Completed" value={`${ocrCompleted}/${totalDocs}`} color="#15803D" bg="#F0FDF4" delay={0.15} />
        <StatCard icon={<Brain className="h-4 w-4" />} label="AI Completed" value={`${aiCompleted}/${totalDocs}`} color="#7C3AED" bg="#F5F3FF" delay={0.2} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Recent Upload" value={recentUpload ? formatDate(recentUpload) : '—'} color="#C2410C" bg="#FFF7ED" delay={0.25} />
        <StatCard icon={<Pin className="h-4 w-4" />} label="Pinned" value={pinnedCount} color="#F97316" bg="#FFF7ED" delay={0.3} />
        <StatCard icon={<Star className="h-4 w-4" />} label="Favorites" value={favoriteCount} color="#B45309" bg="#FEF3C7" delay={0.35} />
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Document Center</h1>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
            {caseTitle} · {totalDocs} document{totalDocs !== 1 ? 's' : ''} · {totalPages} page{totalPages !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ActionBtn icon={<Merge className="h-3 w-3" />} label="Merge PDFs" disabled />
          <ActionBtn icon={<Scissors className="h-3 w-3" />} label="Split PDF" disabled />
          <ActionBtn icon={<ScanText className="h-3 w-3" />} label="Run OCR" disabled />
          <ActionBtn icon={<Upload className="h-3 w-3" />} label="Upload More" primary onClick={() => fileInputRef.current?.click()} />
          <input ref={fileInputRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
        </div>
      </div>

      {uploadError && (
        <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
          {uploadError}
        </div>
      )}

      {/* ── 2. Bulk Selection Toolbar ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
          >
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: '#F97316' }}>
                {selectedIds.size}
              </div>
              <p className="text-xs font-semibold text-gray-800">selected</p>
            </div>
            <div className="h-4 w-px" style={{ background: '#FED7AA' }} />
            <div className="flex items-center gap-1.5 flex-wrap">
              <ActionBtn icon={<Trash2 className="h-3 w-3" />} label="Delete" danger onClick={bulkDelete} small />
              <ActionBtn icon={<Move className="h-3 w-3" />} label="Move" disabled small />
              <ActionBtn icon={<Merge className="h-3 w-3" />} label="Merge" disabled small />
              <ActionBtn icon={<Download className="h-3 w-3" />} label="Download" disabled small />
              <ActionBtn icon={<Share2 className="h-3 w-3" />} label="Share" disabled small />
              <ActionBtn icon={<ScanText className="h-3 w-3" />} label="Run OCR" disabled small />
              <ActionBtn icon={<Brain className="h-3 w-3" />} label="AI Summary" disabled small />
            </div>
            <button
              onClick={clearSelection}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
            >
              <X className="h-3 w-3" /> Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search + Filters ── */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, category, folder, or tag…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 placeholder-gray-400 outline-none"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
              onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
              onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
            />
          </div>
          <button
            onClick={selectAll}
            className="flex-shrink-0 text-xs font-semibold px-3 py-2.5 rounded-lg"
            style={{ background: '#F3F4F6', color: '#6B7280' }}
          >
            Select All
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={activeFilter === f.id ? { background: '#F97316', color: '#FFFFFF' } : { background: '#F3F4F6', color: '#6B7280' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Drop Zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        className="rounded-xl px-5 py-4 flex items-center gap-4 transition-all"
        style={{ background: dragActive ? '#FFF7ED' : '#FAFAFA', border: `1.5px dashed ${dragActive ? '#F97316' : '#E5E7EB'}` }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FFF7ED' }}>
          <Upload className="h-4 w-4" style={{ color: '#F97316' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Drop files to upload</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>PDF, JPG, PNG · up to 25 MB per file · multi-page supported</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 flex items-center gap-1.5 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: '#F97316' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
        >
          <Upload className="h-3 w-3" /> Choose Files
        </button>
      </div>

      {/* ── Empty State ── */}
      {filteredDocs.length === 0 && documents.length === 0 && (
        <EmptyState onUpload={() => fileInputRef.current?.click()} />
      )}

      {/* ── Main 3-panel layout ── */}
      {documents.length > 0 && hasSelection && selectedDoc && selectedPage && (
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_300px] gap-4 items-start">

          {/* ── LEFT: Folder Explorer ── */}
          <div
            className="rounded-xl overflow-hidden xl:sticky xl:top-5"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <p className="text-xs font-semibold text-gray-700">Folder Explorer</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                {filteredDocs.length}
              </span>
            </div>

            <div className="py-1 max-h-[70vh] overflow-y-auto">
              {FOLDER_NAMES.map(folderName => {
                const folderDocs = filteredByFolder[folderName];
                if (folderDocs.length === 0) return null;
                const isOpen = expandedFolders.has(folderName);
                return (
                  <div key={folderName}>
                    {/* Folder row */}
                    <motion.div
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer group"
                      onClick={() => toggleFolder(folderName)}
                      whileHover={{ background: '#F9FAFB' }}
                    >
                      <ChevronRight
                        className="h-3.5 w-3.5 transition-transform flex-shrink-0"
                        style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      />
                      {isOpen
                        ? <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: '#F97316' }} />
                        : <Folder className="h-4 w-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />}
                      <p className="text-[11px] font-bold text-gray-700 flex-1">{folderName}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                        {folderDocs.length}
                      </span>
                    </motion.div>

                    {/* Documents inside folder */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          {folderDocs.map(doc => {
                            const isExpanded = expandedDocs.has(doc.id);
                            const isDocSelected = selectedDoc.id === doc.id;
                            const catColor = categoryColor[doc.category];
                            const isChecked = selectedIds.has(doc.id);
                            return (
                              <div key={doc.id}>
                                <div
                                  className="flex items-center gap-2 pl-6 pr-3 py-2 group transition-colors cursor-pointer"
                                  style={{ background: isDocSelected && !isExpanded ? '#FFF7ED' : 'transparent' }}
                                  onClick={() => { selectDoc(doc); if (isDocSelected) toggleExpand(doc.id); else { setExpandedDocs(prev => new Set([...prev, doc.id])); } }}
                                >
                                  {/* Checkbox */}
                                  <div onClick={e => toggleSelectDoc(doc.id, e)} className="flex-shrink-0">
                                    {isChecked
                                      ? <CheckSquare className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
                                      : <Square className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#D1D5DB' }} />}
                                  </div>
                                  <button
                                    onClick={e => { e.stopPropagation(); toggleExpand(doc.id); }}
                                    className="w-4 h-4 flex items-center justify-center flex-shrink-0"
                                  >
                                    <ChevronRight
                                      className="h-3 w-3 transition-transform"
                                      style={{ color: '#9CA3AF', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                    />
                                  </button>
                                  {doc.type === 'pdf'
                                    ? <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#C2410C' }} />
                                    : <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#15803D' }} />}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <p className="text-[11px] font-semibold text-gray-800 truncate">{doc.name}</p>
                                      {doc.isPinned && <Pin className="h-2.5 w-2.5 flex-shrink-0" style={{ color: '#F97316' }} />}
                                      {doc.isFavorite && <Star className="h-2.5 w-2.5 flex-shrink-0" style={{ color: '#F59E0B' }} />}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${catColor}18`, color: catColor }}>
                                        {doc.category}
                                      </span>
                                      <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{doc.totalPages}p</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button onClick={e => toggleFavorite(doc.id, e)}>
                                      <Star className="h-3 w-3" style={{ color: doc.isFavorite ? '#F59E0B' : '#D1D5DB' }} />
                                    </button>
                                    <button onClick={e => removeDocument(doc.id, e)}>
                                      <X className="h-3 w-3" style={{ color: '#9CA3AF' }} />
                                    </button>
                                  </div>
                                </div>

                                {/* Pages under document */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.12 }}
                                      className="overflow-hidden"
                                    >
                                      {doc.pages.map(page => {
                                        const isPageSel = selectedPage.id === page.id && selectedDoc.id === doc.id;
                                        return (
                                          <div
                                            key={page.id}
                                            onClick={() => selectPage(doc, page)}
                                            className="flex items-center gap-2 pl-14 pr-3 py-1.5 cursor-pointer transition-colors"
                                            style={{ background: isPageSel ? '#FFF7ED' : 'transparent' }}
                                            onMouseEnter={e => { if (!isPageSel) (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; }}
                                            onMouseLeave={e => { if (!isPageSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                          >
                                            <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: isPageSel ? '#F97316' : '#D1D5DB' }} />
                                            <span className="text-[10px] font-medium flex-1" style={{ color: isPageSel ? '#C2410C' : '#6B7280' }}>
                                              Page {page.pageNumber}
                                            </span>
                                            {page.ocrStatus === 'processing' && (
                                              <div className="flex items-center gap-1">
                                                <Loader2 className="h-2.5 w-2.5 animate-spin" style={{ color: '#F97316' }} />
                                                <span className="text-[9px]" style={{ color: '#F97316' }}>{page.ocrProgress}%</span>
                                              </div>
                                            )}
                                            {page.ocrStatus === 'processed' && <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: '#22C55E' }} />}
                                            {page.ocrStatus === 'pending' && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#D1D5DB' }} />}
                                            {page.ocrStatus === 'failed' && <AlertCircle className="h-3 w-3 flex-shrink-0" style={{ color: '#DC2626' }} />}
                                          </div>
                                        );
                                      })}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {filteredDocs.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <FileIcon className="h-6 w-6 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                  <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>No documents match</p>
                </div>
              )}
            </div>
          </div>

          {/* ── CENTRE: Preview Area ── */}
          <div className="space-y-3 min-w-0">
            {/* 6. Advanced PDF Toolbar */}
            <div className="rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mr-1" style={{ color: '#9CA3AF' }}>View</p>
              {[
                { icon: <ZoomIn className="h-3.5 w-3.5" />, label: 'Zoom In' },
                { icon: <ZoomOut className="h-3.5 w-3.5" />, label: 'Zoom Out' },
                { icon: <RotateCcw className="h-3.5 w-3.5" />, label: 'Rotate Left' },
                { icon: <RotateCw className="h-3.5 w-3.5" />, label: 'Rotate Right' },
                { icon: <AlignHorizontalJustifyCenter className="h-3.5 w-3.5" />, label: 'Fit Width' },
                { icon: <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />, label: 'Fit Page' },
                { icon: <Maximize2 className="h-3.5 w-3.5" />, label: 'Fullscreen' },
                { icon: <Minimize2 className="h-3.5 w-3.5" />, label: 'Actual Size' },
              ].map(btn => (
                <button
                  key={btn.label}
                  disabled
                  title={btn.label}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: '#F9FAFB', color: '#D1D5DB', cursor: 'not-allowed' }}
                >
                  {btn.icon}
                </button>
              ))}
              <div className="h-5 w-px mx-1" style={{ background: '#F3F4F6' }} />
              {[
                { icon: <Download className="h-3.5 w-3.5" />, label: 'Download' },
                { icon: <Printer className="h-3.5 w-3.5" />, label: 'Print' },
              ].map(btn => (
                <button
                  key={btn.label}
                  disabled
                  title={btn.label}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: '#F9FAFB', color: '#D1D5DB', cursor: 'not-allowed' }}
                >
                  {btn.icon}
                </button>
              ))}
            </div>

            {/* Preview card */}
            <div
              className="rounded-xl overflow-hidden flex flex-col"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', minHeight: '420px' }}
            >
              {/* Preview toolbar */}
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <div className="flex items-center gap-2 min-w-0">
                  {selectedDoc.type === 'pdf'
                    ? <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#C2410C' }} />
                    : <ImageIcon className="h-4 w-4 flex-shrink-0" style={{ color: '#15803D' }} />}
                  <p className="text-sm font-semibold text-gray-900 truncate">{selectedDoc.name}.{selectedDoc.extension}</p>
                  <span className="text-xs flex-shrink-0" style={{ color: '#9CA3AF' }}>· Page {selectedPage.pageNumber}</span>
                  {selectedDoc.tags.slice(0, 2).map(t => (
                    <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full hidden sm:inline" style={{ background: tagColor[t].bg, color: tagColor[t].color }}>{t}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={e => toggleFavorite(selectedDoc.id, e)}>
                    <Star className="h-4 w-4" style={{ color: selectedDoc.isFavorite ? '#F59E0B' : '#E5E7EB' }} />
                  </button>
                  <ActionBtn icon={<Download className="h-3 w-3" />} label="Download" onClick={() => handleDownload(selectedDoc)} disabled={!selectedDoc.downloadURL} />
                  <ActionBtn icon={<Trash2 className="h-3 w-3" />} label="Delete" onClick={() => removeDocument(selectedDoc.id, { preventDefault: () => undefined, stopPropagation: () => undefined } as unknown as React.MouseEvent)} />
                </div>
              </div>

              {/* Preview area */}
              <div
                className="flex-1 flex flex-col items-center justify-center p-8 relative"
                style={{ background: selectedDoc.thumbnailColor, minHeight: '300px' }}
              >
                {selectedDoc.downloadURL ? (
                  <div className="w-full h-full min-h-[280px] rounded-xl overflow-hidden border border-white/70 bg-white">
                    {selectedDoc.type === 'image' ? (
                      <img src={selectedDoc.downloadURL} alt={selectedDoc.name} className="w-full h-full object-contain" />
                    ) : (
                      <iframe src={selectedDoc.downloadURL} title={selectedDoc.name} className="w-full h-full min-h-[280px] border-0" />
                    )}
                  </div>
                ) : (
                  <div
                    className="w-44 h-56 rounded-xl shadow-md flex flex-col items-center justify-center gap-3 relative"
                    style={{ background: '#FFFFFF' }}
                  >
                    {selectedDoc.type === 'pdf'
                      ? <FileText className="h-12 w-12" style={{ color: '#C2410C', opacity: 0.35 }} />
                      : <ImageIcon className="h-12 w-12" style={{ color: '#15803D', opacity: 0.35 }} />}
                    <p className="text-[11px] font-semibold text-center px-3" style={{ color: '#D1D5DB' }}>Preview unavailable</p>
                    <p className="text-[10px] text-center px-3" style={{ color: '#E5E7EB' }}>Upload a file to preview it here</p>
                    {selectedPage.ocrStatus === 'processing' && (
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" style={{ color: '#F97316' }} />
                      </div>
                    )}
                  </div>
                )}
                {/* 8. OCR Status per page */}
                <div className="mt-4 flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: ocrBadge[selectedPage.ocrStatus].bg, color: ocrBadge[selectedPage.ocrStatus].color }}
                  >
                    {ocrBadge[selectedPage.ocrStatus].label}
                  </span>
                  {selectedPage.ocrStatus === 'processing' && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: '#F97316' }}
                          initial={{ width: '0%' }}
                          animate={{ width: `${selectedPage.ocrProgress}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold" style={{ color: '#F97316' }}>{selectedPage.ocrProgress}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 7. Page Thumbnails */}
              {selectedDoc.pages.length > 1 && (
                <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {selectedDoc.pages.map(page => (
                      <PageThumbnail
                        key={page.id}
                        page={page}
                        doc={selectedDoc}
                        isSelected={selectedPage.id === page.id}
                        onClick={() => selectPage(selectedDoc, page)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Page navigation */}
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
                <button
                  onClick={() => canGoPrev && selectPage(selectedDoc, selectedDoc.pages[currentPageIndex - 1])}
                  disabled={!canGoPrev}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: canGoPrev ? '#F3F4F6' : 'transparent', color: canGoPrev ? '#374151' : '#D1D5DB', cursor: canGoPrev ? 'pointer' : 'not-allowed' }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium text-gray-700">
                  Page {selectedPage.pageNumber} of {selectedDoc.totalPages}
                </span>
                <button
                  onClick={() => canGoNext && selectPage(selectedDoc, selectedDoc.pages[currentPageIndex + 1])}
                  disabled={!canGoNext}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: canGoNext ? '#F3F4F6' : 'transparent', color: canGoNext ? '#374151' : '#D1D5DB', cursor: canGoNext ? 'pointer' : 'not-allowed' }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Bottom Info Bar */}
            <div className="rounded-xl px-5 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              {[
                { label: 'Document', value: `${selectedDoc.name}.${selectedDoc.extension}` },
                { label: 'Page', value: `${selectedPage.pageNumber} / ${selectedDoc.totalPages}` },
                { label: 'OCR Status', value: ocrBadge[selectedPage.ocrStatus].label, color: ocrBadge[selectedPage.ocrStatus].color },
                { label: 'File Size', value: selectedPage.size },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9CA3AF' }}>{item.label}</p>
                  <p className="text-[11px] font-bold truncate" style={{ color: item.color ?? '#111827' }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* 14. Document Activity */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <BarChart2 className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-semibold text-gray-700">Recent Activity</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                {selectedDoc.activity.slice(0, 4).map((ev, i) => {
                  const color = activityColor[ev.action];
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, color }}>
                        {activityIcon[ev.action]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-700">{ev.action}</p>
                        <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{ev.user}</p>
                      </div>
                      <p className="text-[10px] flex-shrink-0" style={{ color: '#9CA3AF' }}>{ev.date}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* 15. Storage Info */}
            <div className="rounded-xl px-5 py-4 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-semibold text-gray-700">Storage Overview</p>
              </div>
              <StorageBar label="Storage Used" value={parseFloat(totalStorageMB.toFixed(1))} max={50} color="#F97316" unit="MB" />
              <StorageBar label="Documents" value={totalDocs} max={100} color="#3B82F6" unit="files" />
              <StorageBar label="Processed Pages" value={documents.reduce((s, d) => s + d.pages.filter(p => p.ocrStatus === 'processed').length, 0)} max={totalPages} color="#22C55E" unit="pages" />
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { label: 'Upload Limit', value: '50 MB' },
                  { label: 'Largest File', value: '1.2 MB' },
                  { label: 'Avg File Size', value: `${(totalStorageMB / Math.max(totalDocs, 1)).toFixed(1)} MB` },
                ].map(item => (
                  <div key={item.label} className="rounded-lg p-2.5 text-center" style={{ background: '#FAFAFA', border: '1px solid #F3F4F6' }}>
                    <p className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>{item.label}</p>
                    <p className="text-[11px] font-bold text-gray-700 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Tabbed Panel ── */}
          <div className="space-y-4 xl:sticky xl:top-5">
            {/* Right Panel Tabs */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="px-3 py-2 flex items-center gap-1 overflow-x-auto" style={{ borderBottom: '1px solid #F3F4F6' }}>
                {rightTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRightTab(tab.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex-shrink-0"
                    style={rightTab === tab.id
                      ? { background: '#FFF7ED', color: '#C2410C' }
                      : { background: 'transparent', color: '#9CA3AF' }}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
              <div className="p-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={rightTab + selectedDoc.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {rightTab === 'timeline' && (
                      <div className="rounded-b-xl overflow-hidden">
                        <TimelinePanel doc={selectedDoc} />
                      </div>
                    )}
                    {rightTab === 'versions' && (
                      <div className="rounded-b-xl overflow-hidden">
                        <VersionPanel doc={selectedDoc} selectedVersion={selectedVersionId} onSelectVersion={setSelectedVersionId} />
                      </div>
                    )}
                    {rightTab === 'notes' && (
                      <div className="p-4">
                        <NotesPanel doc={selectedDoc} onUpdate={updateNote} />
                      </div>
                    )}
                    {rightTab === 'tags' && (
                      <div className="rounded-b-xl overflow-hidden">
                        <TagPanel doc={selectedDoc} onToggleTag={toggleTag} />
                      </div>
                    )}
                    {rightTab === 'properties' && (
                      <div className="rounded-b-xl overflow-hidden">
                        <DocProperties doc={selectedDoc} />
                      </div>
                    )}
                    {rightTab === 'share' && (
                      <div className="rounded-b-xl overflow-hidden">
                        <SharePanel />
                      </div>
                    )}
                    {rightTab === 'ai' && <div />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* AI Panel always rendered if ai tab active */}
            {rightTab === 'ai' && <AIPanel doc={selectedDoc} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default Files;