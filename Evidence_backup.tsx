import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, Image as ImageIcon, X, Sparkles,
  ChevronLeft, ChevronRight, Download, Trash2, File as FileIcon,
  CheckCircle2, Loader2, Search,
  FolderOpen, Folder, Merge, Scissors, ScanText, MessageSquare,
  AlertCircle, Eye, Calendar, Tag,
  ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2, Minimize2,
  Printer, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  Star, Pin, Share2, Link2, Mail, Clock,
  Users, Gavel, Scale, BookOpen, AlertTriangle, CheckSquare,
  Square, Lock, Globe,
  Activity, BarChart2, Database, Layers, History,
  PenLine, Info, Move, Cpu, Brain,
  Video, Music, Grid3x3, Play, ShieldCheck, List,
  Headphones, Film, Pause, Volume2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type FileType = 'pdf' | 'image' | 'video' | 'audio';

type FileCategory =
  | 'FIR' | 'Charge Sheet' | 'Court Order' | 'Petition' | 'Affidavit'
  | 'Evidence' | 'Medical Report' | 'Identity Proof' | 'Financial Record'
  | 'Surveillance' | 'Witness Statement' | 'Other';

type FolderName =
  | 'Documents' | 'Evidence' | 'Court Orders' | 'Petitions'
  | 'Affidavits' | 'Medical Reports' | 'Financial Records' | 'Identity' | 'Other';

type OcrStatus = 'processed' | 'processing' | 'pending' | 'failed' | 'n/a';

type FileTag =
  | 'Urgent' | 'Evidence' | 'Original' | 'Certified Copy' | 'Client Copy'
  | 'Court Copy' | 'Police' | 'Medical' | 'Financial' | 'Favorite'
  | 'Property' | 'Surveillance' | 'Witness Statement' | 'Photo Evidence'
  | 'Audio Proof' | 'Agreement' | 'Inspection';

type FilterId =
  | 'all' | 'pdf' | 'image' | 'video' | 'audio'
  | 'evidence' | 'court_order' | 'pending_ocr' | 'processed';

type ViewMode = 'explorer' | 'grid';

interface FilePage {
  id: string;
  pageNumber: number;
  ocrStatus: OcrStatus;
  ocrProgress: number;
  size: string;
}

interface FileVersion {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  createdBy: string;
  changes: string;
  isCurrent: boolean;
}

interface FileActivityItem {
  id: string;
  action:
    | 'Uploaded' | 'OCR Started' | 'OCR Completed' | 'AI Summary Generated'
    | 'Downloaded' | 'Shared' | 'Viewed' | 'Moved' | 'Tagged' | 'Noted';
  date: string;
  time: string;
  user: string;
}

interface FileNote {
  id: string;
  content: string;
  isPinned: boolean;
  savedAt: string;
  author: string;
}

interface CaseFile {
  id: string;
  name: string;
  extension: string;
  category: FileCategory;
  folder: FolderName;
  type: FileType;
  totalPages: number;
  uploadDate: string;
  lastModified: string;
  uploadedBy: string;
  totalSize: string;
  status: OcrStatus;
  thumbnailColor: string;
  duration?: string;
  pages: FilePage[];
  versions: FileVersion[];
  activity: FileActivityItem[];
  note: FileNote;
  tags: FileTag[];
  isFavorite: boolean;
  isPinned: boolean;
  resolution: string;
  storagePath: string;
  hash: string;
  docId: string;
  aiCompleted: boolean;
}

interface EvidenceProps {
  caseTitle?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FOLDER_NAMES: FolderName[] = [
  'Documents', 'Evidence', 'Court Orders', 'Petitions',
  'Affidavits', 'Medical Reports', 'Financial Records', 'Identity', 'Other',
];

const ALL_TAGS: FileTag[] = [
  'Urgent', 'Evidence', 'Original', 'Certified Copy', 'Client Copy',
  'Court Copy', 'Police', 'Medical', 'Financial', 'Favorite',
  'Property', 'Surveillance', 'Witness Statement', 'Photo Evidence',
  'Audio Proof', 'Agreement', 'Inspection',
];

const FILTER_TABS: Array<{ id: FilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'court_order', label: 'Court Orders' },
  { id: 'pending_ocr', label: 'Pending OCR' },
  { id: 'processed', label: 'Processed' },
];

const typeIcon: Record<FileType, React.ElementType> = {
  pdf: FileText,
  image: ImageIcon,
  video: Video,
  audio: Music,
};

const typeIconColor: Record<FileType, string> = {
  pdf: '#C2410C',
  image: '#15803D',
  video: '#1D4ED8',
  audio: '#A21CAF',
};

const ocrBadge: Record<OcrStatus, { label: string; color: string; bg: string }> = {
  processed: { label: 'OCR Done', color: '#15803D', bg: '#F0FDF4' },
  processing: { label: 'Processing…', color: '#C2410C', bg: '#FFF7ED' },
  pending: { label: 'OCR Pending', color: '#9CA3AF', bg: '#F3F4F6' },
  failed: { label: 'OCR Failed', color: '#DC2626', bg: '#FEF2F2' },
  'n/a': { label: 'N/A', color: '#9CA3AF', bg: '#F3F4F6' },
};

const categoryColor: Record<FileCategory, string> = {
  'FIR': '#F97316', 'Charge Sheet': '#EF4444', 'Court Order': '#8B5CF6',
  'Petition': '#3B82F6', 'Affidavit': '#06B6D4', 'Evidence': '#F59E0B',
  'Medical Report': '#10B981', 'Identity Proof': '#6366F1',
  'Financial Record': '#EC4899', 'Surveillance': '#1D4ED8',
  'Witness Statement': '#A21CAF', 'Other': '#9CA3AF',
};

const tagColor: Record<FileTag, { bg: string; color: string }> = {
  'Urgent':           { bg: '#FEF2F2', color: '#DC2626' },
  'Evidence':         { bg: '#FFFBEB', color: '#D97706' },
  'Original':         { bg: '#F0FDF4', color: '#15803D' },
  'Certified Copy':   { bg: '#EFF6FF', color: '#1D4ED8' },
  'Client Copy':      { bg: '#F5F3FF', color: '#7C3AED' },
  'Court Copy':       { bg: '#FDF4FF', color: '#9333EA' },
  'Police':           { bg: '#F0F9FF', color: '#0369A1' },
  'Medical':          { bg: '#ECFDF5', color: '#059669' },
  'Financial':        { bg: '#FFF1F2', color: '#BE123C' },
  'Favorite':         { bg: '#FEF3C7', color: '#B45309' },
  'Property':         { bg: '#F0FDF4', color: '#15803D' },
  'Surveillance':     { bg: '#EFF6FF', color: '#1D4ED8' },
  'Witness Statement':{ bg: '#FDF4FF', color: '#9333EA' },
  'Photo Evidence':   { bg: '#FFFBEB', color: '#D97706' },
  'Audio Proof':      { bg: '#FDF4FF', color: '#A21CAF' },
  'Agreement':        { bg: '#FEF3E7', color: '#C2410C' },
  'Inspection':       { bg: '#F0F9FF', color: '#0369A1' },
};

const activityColor: Record<FileActivityItem['action'], string> = {
  'Uploaded':              '#3B82F6',
  'OCR Started':           '#F97316',
  'OCR Completed':         '#22C55E',
  'AI Summary Generated':  '#8B5CF6',
  'Downloaded':            '#0EA5E9',
  'Shared':                '#EC4899',
  'Viewed':                '#9CA3AF',
  'Moved':                 '#F59E0B',
  'Tagged':                '#06B6D4',
  'Noted':                 '#6366F1',
};

const activityIcon: Record<FileActivityItem['action'], React.ReactNode> = {
  'Uploaded':              <Upload className="h-3 w-3" />,
  'OCR Started':           <Cpu className="h-3 w-3" />,
  'OCR Completed':         <CheckCircle2 className="h-3 w-3" />,
  'AI Summary Generated':  <Sparkles className="h-3 w-3" />,
  'Downloaded':            <Download className="h-3 w-3" />,
  'Shared':                <Share2 className="h-3 w-3" />,
  'Viewed':                <Eye className="h-3 w-3" />,
  'Moved':                 <Move className="h-3 w-3" />,
  'Tagged':                <Tag className="h-3 w-3" />,
  'Noted':                 <PenLine className="h-3 w-3" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_FILES: CaseFile[] = [
  {
    id: 'doc1', name: 'FIR_Copy_Sharma', extension: 'pdf', category: 'FIR', folder: 'Documents',
    type: 'pdf', totalPages: 3, uploadDate: '2026-06-10', lastModified: '2026-06-11',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '1.1 MB', status: 'processed',
    thumbnailColor: '#FEF3E7', resolution: '300 DPI', storagePath: '/cases/sharma-vs-up/documents/FIR_Copy_Sharma.pdf',
    hash: 'a3f9d12c8b4e7f01', docId: 'DOC-2026-001', isFavorite: true, isPinned: true, aiCompleted: true,
    tags: ['Original', 'Evidence', 'Police'],
    pages: [
      { id: 'doc1-p1', pageNumber: 1, ocrStatus: 'processed', ocrProgress: 100, size: '412 KB' },
      { id: 'doc1-p2', pageNumber: 2, ocrStatus: 'processed', ocrProgress: 100, size: '398 KB' },
      { id: 'doc1-p3', pageNumber: 3, ocrStatus: 'processed', ocrProgress: 100, size: '312 KB' },
    ],
    versions: [
      { id: 'v1', version: 1, label: 'v1.0', createdAt: '2026-06-10', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: false },
      { id: 'v2', version: 2, label: 'v2.0 (Latest)', createdAt: '2026-06-11', createdBy: 'Adv. Suresh Kumar', changes: 'Page 3 re-scanned at 300 DPI', isCurrent: true },
    ],
    activity: [
      { id: 'a1', action: 'Uploaded', date: '2026-06-10', time: '09:14 AM', user: 'Adv. Suresh Kumar' },
      { id: 'a2', action: 'OCR Started', date: '2026-06-10', time: '09:15 AM', user: 'System' },
      { id: 'a3', action: 'OCR Completed', date: '2026-06-10', time: '09:18 AM', user: 'System' },
      { id: 'a4', action: 'AI Summary Generated', date: '2026-06-11', time: '10:02 AM', user: 'System' },
      { id: 'a5', action: 'Viewed', date: '2026-06-12', time: '02:30 PM', user: 'Adv. Suresh Kumar' },
    ],
    note: { id: 'n1', content: 'FIR registered at Hazratganj PS on 08-June-2026. Cross-verify witness names on page 2 with charge sheet.', isPinned: true, savedAt: '2026-06-12 14:35', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'doc2', name: 'Charge_Sheet_2024', extension: 'pdf', category: 'Charge Sheet', folder: 'Documents',
    type: 'pdf', totalPages: 2, uploadDate: '2026-06-12', lastModified: '2026-06-12',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '680 KB', status: 'processed',
    thumbnailColor: '#EFF6FF', resolution: '300 DPI', storagePath: '/cases/sharma-vs-up/documents/Charge_Sheet_2024.pdf',
    hash: 'b7c3e91f042d6a8e', docId: 'DOC-2026-002', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Court Copy', 'Certified Copy'],
    pages: [
      { id: 'doc2-p1', pageNumber: 1, ocrStatus: 'processed', ocrProgress: 100, size: '340 KB' },
      { id: 'doc2-p2', pageNumber: 2, ocrStatus: 'processed', ocrProgress: 100, size: '340 KB' },
    ],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-12', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [
      { id: 'a1', action: 'Uploaded', date: '2026-06-12', time: '11:00 AM', user: 'Adv. Suresh Kumar' },
      { id: 'a2', action: 'OCR Started', date: '2026-06-12', time: '11:01 AM', user: 'System' },
      { id: 'a3', action: 'OCR Completed', date: '2026-06-12', time: '11:04 AM', user: 'System' },
    ],
    note: { id: 'n2', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'doc4', name: 'Bail_Application_Draft', extension: 'pdf', category: 'Petition', folder: 'Petitions',
    type: 'pdf', totalPages: 4, uploadDate: '2026-06-17', lastModified: '2026-06-18',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '920 KB', status: 'processing',
    thumbnailColor: '#FFF7ED', resolution: '300 DPI', storagePath: '/cases/sharma-vs-up/petitions/Bail_Application_Draft.pdf',
    hash: 'd8e2a61c5f3b9d04', docId: 'DOC-2026-004', isFavorite: true, isPinned: false, aiCompleted: false,
    tags: ['Urgent', 'Client Copy'],
    pages: [
      { id: 'doc4-p1', pageNumber: 1, ocrStatus: 'processed', ocrProgress: 100, size: '230 KB' },
      { id: 'doc4-p2', pageNumber: 2, ocrStatus: 'processing', ocrProgress: 62, size: '230 KB' },
      { id: 'doc4-p3', pageNumber: 3, ocrStatus: 'pending', ocrProgress: 0, size: '230 KB' },
      { id: 'doc4-p4', pageNumber: 4, ocrStatus: 'pending', ocrProgress: 0, size: '230 KB' },
    ],
    versions: [
      { id: 'v1', version: 1, label: 'v1.0', createdAt: '2026-06-17', createdBy: 'Adv. Suresh Kumar', changes: 'Initial draft', isCurrent: false },
      { id: 'v2', version: 2, label: 'v2.0 (Latest)', createdAt: '2026-06-18', createdBy: 'Adv. Suresh Kumar', changes: 'Added supporting grounds on pages 3–4', isCurrent: true },
    ],
    activity: [
      { id: 'a1', action: 'Uploaded', date: '2026-06-17', time: '04:45 PM', user: 'Adv. Suresh Kumar' },
      { id: 'a2', action: 'OCR Started', date: '2026-06-18', time: '08:00 AM', user: 'System' },
    ],
    note: { id: 'n4', content: 'File before Lucknow Bench. Hearing tentatively 25-June-2026. Ensure surety documents are attached.', isPinned: true, savedAt: '2026-06-18 09:00', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'doc5', name: 'Witness_Affidavit_Sharma', extension: 'pdf', category: 'Affidavit', folder: 'Affidavits',
    type: 'pdf', totalPages: 2, uploadDate: '2026-06-19', lastModified: '2026-06-19',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '480 KB', status: 'pending',
    thumbnailColor: '#FDF4FF', resolution: '300 DPI', storagePath: '/cases/sharma-vs-up/affidavits/Witness_Affidavit_Sharma.pdf',
    hash: 'e5b7f29d3c1a8e62', docId: 'DOC-2026-005', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Original', 'Certified Copy'],
    pages: [
      { id: 'doc5-p1', pageNumber: 1, ocrStatus: 'pending', ocrProgress: 0, size: '240 KB' },
      { id: 'doc5-p2', pageNumber: 2, ocrStatus: 'pending', ocrProgress: 0, size: '240 KB' },
    ],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-19', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [{ id: 'a1', action: 'Uploaded', date: '2026-06-19', time: '01:15 PM', user: 'Adv. Suresh Kumar' }],
    note: { id: 'n5', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  // ── Evidence / Media files ──
  {
    id: 'e1', name: 'Land_Registry_Doc', extension: 'jpg', category: 'Evidence', folder: 'Evidence',
    type: 'image', totalPages: 1, uploadDate: '2026-06-15', lastModified: '2026-06-15',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '3.7 MB', status: 'processed',
    thumbnailColor: '#F0FDF4', resolution: '72 DPI', storagePath: '/cases/sharma-vs-up/evidence/Land_Registry_Doc.jpg',
    hash: 'f1a2b3c4d5e6f7a8', docId: 'EVD-2026-001', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Property', 'Evidence', 'Photo Evidence'],
    pages: [{ id: 'e1-p1', pageNumber: 1, ocrStatus: 'processed', ocrProgress: 100, size: '3.7 MB' }],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-15', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [
      { id: 'a1', action: 'Uploaded', date: '2026-06-15', time: '10:30 AM', user: 'Adv. Suresh Kumar' },
      { id: 'a2', action: 'Viewed', date: '2026-06-15', time: '11:00 AM', user: 'Adv. Suresh Kumar' },
    ],
    note: { id: 'n6', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'e2', name: 'Crime_Scene_Photo_1', extension: 'jpg', category: 'Evidence', folder: 'Evidence',
    type: 'image', totalPages: 1, uploadDate: '2026-06-12', lastModified: '2026-06-12',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '4.1 MB', status: 'n/a',
    thumbnailColor: '#F0FDF4', resolution: '72 DPI', storagePath: '/cases/sharma-vs-up/evidence/Crime_Scene_Photo_1.jpg',
    hash: 'a2b3c4d5e6f7a8b9', docId: 'EVD-2026-002', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Photo Evidence', 'Evidence', 'Original'],
    pages: [{ id: 'e2-p1', pageNumber: 1, ocrStatus: 'n/a', ocrProgress: 0, size: '4.1 MB' }],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-12', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [{ id: 'a1', action: 'Uploaded', date: '2026-06-12', time: '03:00 PM', user: 'Adv. Suresh Kumar' }],
    note: { id: 'n7', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'e3', name: 'CCTV_Footage_MainGate', extension: 'mp4', category: 'Surveillance', folder: 'Evidence',
    type: 'video', totalPages: 1, uploadDate: '2026-06-10', lastModified: '2026-06-10', duration: '4:32',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '128 MB', status: 'n/a',
    thumbnailColor: '#EFF6FF', resolution: '1080p', storagePath: '/cases/sharma-vs-up/evidence/CCTV_Footage_MainGate.mp4',
    hash: 'b2c3d4e5f6a7b8c9', docId: 'EVD-2026-003', isFavorite: false, isPinned: true, aiCompleted: false,
    tags: ['Surveillance', 'Evidence'],
    pages: [{ id: 'e3-p1', pageNumber: 1, ocrStatus: 'n/a', ocrProgress: 0, size: '128 MB' }],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-10', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [{ id: 'a1', action: 'Uploaded', date: '2026-06-10', time: '02:15 PM', user: 'Adv. Suresh Kumar' }],
    note: { id: 'n8', content: 'CCTV footage from main gate. Timestamps 22:14–22:48 show suspect entering.', isPinned: false, savedAt: '2026-06-11 09:00', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'e4', name: 'Witness_Call_Recording', extension: 'mp3', category: 'Witness Statement', folder: 'Evidence',
    type: 'audio', totalPages: 1, uploadDate: '2026-06-09', lastModified: '2026-06-09', duration: '12:08',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '8.2 MB', status: 'n/a',
    thumbnailColor: '#FDF4FF', resolution: '320 kbps', storagePath: '/cases/sharma-vs-up/evidence/Witness_Call_Recording.mp3',
    hash: 'c3d4e5f6a7b8c9d0', docId: 'EVD-2026-004', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Witness Statement', 'Evidence', 'Audio Proof'],
    pages: [{ id: 'e4-p1', pageNumber: 1, ocrStatus: 'n/a', ocrProgress: 0, size: '8.2 MB' }],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-09', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [{ id: 'a1', action: 'Uploaded', date: '2026-06-09', time: '11:30 AM', user: 'Adv. Suresh Kumar' }],
    note: { id: 'n9', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'e5', name: 'Sale_Agreement_1998', extension: 'pdf', category: 'Evidence', folder: 'Evidence',
    type: 'pdf', totalPages: 5, uploadDate: '2026-06-07', lastModified: '2026-06-07',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '0.9 MB', status: 'processed',
    thumbnailColor: '#FEF3E7', resolution: '300 DPI', storagePath: '/cases/sharma-vs-up/evidence/Sale_Agreement_1998.pdf',
    hash: 'd4e5f6a7b8c9d0e1', docId: 'EVD-2026-005', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Agreement', 'Evidence', 'Original'],
    pages: [
      { id: 'e5-p1', pageNumber: 1, ocrStatus: 'processed', ocrProgress: 100, size: '180 KB' },
      { id: 'e5-p2', pageNumber: 2, ocrStatus: 'processed', ocrProgress: 100, size: '180 KB' },
      { id: 'e5-p3', pageNumber: 3, ocrStatus: 'processed', ocrProgress: 100, size: '180 KB' },
      { id: 'e5-p4', pageNumber: 4, ocrStatus: 'processed', ocrProgress: 100, size: '180 KB' },
      { id: 'e5-p5', pageNumber: 5, ocrStatus: 'processed', ocrProgress: 100, size: '180 KB' },
    ],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-07', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [
      { id: 'a1', action: 'Uploaded', date: '2026-06-07', time: '09:00 AM', user: 'Adv. Suresh Kumar' },
      { id: 'a2', action: 'OCR Completed', date: '2026-06-07', time: '09:05 AM', user: 'System' },
    ],
    note: { id: 'n10', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'e6', name: 'Site_Inspection_Video', extension: 'mp4', category: 'Evidence', folder: 'Evidence',
    type: 'video', totalPages: 1, uploadDate: '2026-06-05', lastModified: '2026-06-05', duration: '2:15',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '64 MB', status: 'n/a',
    thumbnailColor: '#EFF6FF', resolution: '1080p', storagePath: '/cases/sharma-vs-up/evidence/Site_Inspection_Video.mp4',
    hash: 'e5f6a7b8c9d0e1f2', docId: 'EVD-2026-006', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Inspection', 'Evidence'],
    pages: [{ id: 'e6-p1', pageNumber: 1, ocrStatus: 'n/a', ocrProgress: 0, size: '64 MB' }],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-05', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [{ id: 'a1', action: 'Uploaded', date: '2026-06-05', time: '04:30 PM', user: 'Adv. Suresh Kumar' }],
    note: { id: 'n11', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'e7', name: 'Bank_Statement_Q1', extension: 'pdf', category: 'Financial Record', folder: 'Financial Records',
    type: 'pdf', totalPages: 3, uploadDate: '2026-06-03', lastModified: '2026-06-03',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '1.4 MB', status: 'processed',
    thumbnailColor: '#FEF3E7', resolution: '300 DPI', storagePath: '/cases/sharma-vs-up/financial/Bank_Statement_Q1.pdf',
    hash: 'f6a7b8c9d0e1f2a3', docId: 'DOC-2026-007', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Financial', 'Evidence'],
    pages: [
      { id: 'e7-p1', pageNumber: 1, ocrStatus: 'processed', ocrProgress: 100, size: '466 KB' },
      { id: 'e7-p2', pageNumber: 2, ocrStatus: 'processed', ocrProgress: 100, size: '466 KB' },
      { id: 'e7-p3', pageNumber: 3, ocrStatus: 'processed', ocrProgress: 100, size: '466 KB' },
    ],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-03', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [{ id: 'a1', action: 'Uploaded', date: '2026-06-03', time: '10:00 AM', user: 'Adv. Suresh Kumar' }],
    note: { id: 'n12', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'e8', name: 'Phone_Call_Evidence', extension: 'mp3', category: 'Evidence', folder: 'Evidence',
    type: 'audio', totalPages: 1, uploadDate: '2026-05-30', lastModified: '2026-05-30', duration: '6:44',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '5.6 MB', status: 'n/a',
    thumbnailColor: '#FDF4FF', resolution: '320 kbps', storagePath: '/cases/sharma-vs-up/evidence/Phone_Call_Evidence.mp3',
    hash: 'a7b8c9d0e1f2a3b4', docId: 'EVD-2026-008', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Audio Proof', 'Evidence'],
    pages: [{ id: 'e8-p1', pageNumber: 1, ocrStatus: 'n/a', ocrProgress: 0, size: '5.6 MB' }],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-05-30', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [{ id: 'a1', action: 'Uploaded', date: '2026-05-30', time: '02:00 PM', user: 'Adv. Suresh Kumar' }],
    note: { id: 'n13', content: '', isPinned: false, savedAt: '', author: 'Adv. Suresh Kumar' },
  },
  {
    id: 'doc3', name: 'Property_Photo_Evidence', extension: 'jpg', category: 'Evidence', folder: 'Evidence',
    type: 'image', totalPages: 1, uploadDate: '2026-06-14', lastModified: '2026-06-14',
    uploadedBy: 'Adv. Suresh Kumar', totalSize: '1.2 MB', status: 'processed',
    thumbnailColor: '#F0FDF4', resolution: '72 DPI', storagePath: '/cases/sharma-vs-up/evidence/Property_Photo_Evidence.jpg',
    hash: 'c1d4f83b7a2e5c90', docId: 'DOC-2026-003', isFavorite: false, isPinned: false, aiCompleted: false,
    tags: ['Evidence', 'Original', 'Photo Evidence'],
    pages: [{ id: 'doc3-p1', pageNumber: 1, ocrStatus: 'processed', ocrProgress: 100, size: '1.2 MB' }],
    versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: '2026-06-14', createdBy: 'Adv. Suresh Kumar', changes: 'Initial upload', isCurrent: true }],
    activity: [
      { id: 'a1', action: 'Uploaded', date: '2026-06-14', time: '03:22 PM', user: 'Adv. Suresh Kumar' },
      { id: 'a2', action: 'Viewed', date: '2026-06-15', time: '09:10 AM', user: 'Adv. Suresh Kumar' },
    ],
    note: { id: 'n14', content: 'Photo taken from north-east corner. Timestamp visible at bottom-right.', isPinned: false, savedAt: '2026-06-15 09:11', author: 'Adv. Suresh Kumar' },
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ActionBtnProps {
  icon: React.ReactNode; label: string; primary?: boolean;
  danger?: boolean; onClick?: () => void; disabled?: boolean; small?: boolean;
}
const ActionBtn: React.FC<ActionBtnProps> = ({ icon, label, primary, danger, onClick, disabled = false, small }) => (
  <button
    onClick={onClick} disabled={disabled}
    className="flex items-center gap-1.5 rounded-lg font-semibold transition-all"
    style={{
      padding: small ? '6px 10px' : '8px 12px', fontSize: '11px',
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

interface StatCardProps {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; bg: string; delay?: number;
}
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, sub, color, bg, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
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

interface PageThumbnailProps { page: FilePage; file: CaseFile; isSelected: boolean; onClick: () => void; }
const PageThumbnail: React.FC<PageThumbnailProps> = ({ page, file, isSelected, onClick }) => (
  <motion.div
    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="flex-shrink-0 cursor-pointer rounded-lg overflow-hidden"
    style={{ width: 56, border: isSelected ? '2px solid #F97316' : '2px solid transparent', background: isSelected ? '#FFF7ED' : '#F3F4F6' }}
  >
    <div className="flex items-center justify-center" style={{ height: 64, background: file.thumbnailColor }}>
      {React.createElement(typeIcon[file.type], {
        className: 'h-5 w-5', style: { color: typeIconColor[file.type], opacity: 0.5 },
      })}
    </div>
    <div className="px-1 py-1 text-center">
      <p className="text-[9px] font-semibold" style={{ color: isSelected ? '#C2410C' : '#6B7280' }}>p{page.pageNumber}</p>
      {page.ocrStatus === 'processing' && (
        <div className="w-full h-0.5 rounded-full mt-0.5 overflow-hidden" style={{ background: '#E5E7EB' }}>
          <motion.div className="h-full rounded-full" style={{ background: '#F97316', width: `${page.ocrProgress}%` }}
            initial={{ width: '0%' }} animate={{ width: `${page.ocrProgress}%` }} transition={{ duration: 0.6 }} />
        </div>
      )}
      {page.ocrStatus === 'processed' && <CheckCircle2 className="h-2.5 w-2.5 mx-auto mt-0.5" style={{ color: '#22C55E' }} />}
      {(page.ocrStatus === 'pending' || page.ocrStatus === 'n/a') && (
        <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: '#D1D5DB' }} />
      )}
    </div>
  </motion.div>
);

// Media-type-aware center preview
interface MediaPreviewProps { file: CaseFile; page: FilePage; }
const MediaPreview: React.FC<MediaPreviewProps> = ({ file, page }) => {
  const [playing, setPlaying] = useState(false);
  const Icon = typeIcon[file.type];

  if (file.type === 'video') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative" style={{ background: file.thumbnailColor, minHeight: '300px' }}>
        <div className="w-52 rounded-xl overflow-hidden shadow-lg" style={{ background: '#0F172A' }}>
          <div className="relative flex items-center justify-center" style={{ height: 140, background: '#1E293B' }}>
            <Film className="h-10 w-10 absolute opacity-10" style={{ color: '#FFFFFF' }} />
            <button
              onClick={() => setPlaying(p => !p)}
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(255,255,255,0.2)' }}
            >
              {playing
                ? <Pause className="h-6 w-6 text-white" />
                : <Play className="h-6 w-6 text-white ml-0.5" fill="white" />}
            </button>
            {file.duration && (
              <span className="absolute bottom-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)', color: '#FFF' }}>
                {file.duration}
              </span>
            )}
          </div>
          <div className="px-3 py-2.5 space-y-2">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full w-1/3 rounded-full" style={{ background: '#F97316' }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>0:52</span>
              <Volume2 className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{file.duration ?? '—'}</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-[10px] font-semibold" style={{ color: 'rgba(0,0,0,0.3)' }}>Video preview unavailable · {file.resolution}</p>
      </div>
    );
  }

  if (file.type === 'audio') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative" style={{ background: file.thumbnailColor, minHeight: '300px' }}>
        <div className="w-52 rounded-xl overflow-hidden shadow-lg" style={{ background: '#1E1B4B' }}>
          <div className="px-4 py-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.2)' }}>
                <Headphones className="h-5 w-5" style={{ color: '#A78BFA' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate" style={{ color: '#F1F5F9' }}>{file.name}</p>
                <p className="text-[9px]" style={{ color: 'rgba(241,245,249,0.4)' }}>{file.duration ?? '—'} · {file.resolution}</p>
              </div>
            </div>
            {/* Waveform visualization */}
            <div className="flex items-end justify-center gap-0.5 h-10">
              {Array.from({ length: 32 }).map((_, i) => {
                const h = Math.sin(i * 0.7) * 0.4 + Math.sin(i * 1.3) * 0.3 + 0.3;
                const active = i < 12;
                return (
                  <div key={i} className="rounded-full flex-shrink-0" style={{
                    width: 3, height: `${Math.max(15, h * 100)}%`,
                    background: active ? '#A78BFA' : 'rgba(167,139,250,0.2)',
                  }} />
                );
              })}
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full" style={{ background: '#A78BFA', width: '37%' }} />
            </div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setPlaying(p => !p)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: '#7C3AED' }}>
                {playing ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white ml-0.5" fill="white" />}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-4 text-[10px] font-semibold" style={{ color: 'rgba(0,0,0,0.3)' }}>Audio preview unavailable in this environment</p>
      </div>
    );
  }

  if (file.type === 'image') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: file.thumbnailColor, minHeight: '300px' }}>
        <div
          className="rounded-xl shadow-md flex items-center justify-center relative overflow-hidden"
          style={{ width: 200, height: 160, background: '#FFFFFF' }}
        >
          <ImageIcon className="h-12 w-12" style={{ color: typeIconColor.image, opacity: 0.25 }} />
          <div className="absolute bottom-2 left-2 right-2 text-center">
            <p className="text-[9px] font-medium" style={{ color: '#D1D5DB' }}>Image preview unavailable</p>
          </div>
        </div>
        <p className="mt-3 text-[10px] font-semibold" style={{ color: 'rgba(0,0,0,0.3)' }}>{file.resolution} · {file.totalSize}</p>
        <div className="mt-3">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: ocrBadge[page.ocrStatus].bg, color: ocrBadge[page.ocrStatus].color }}>
            {ocrBadge[page.ocrStatus].label}
          </span>
        </div>
      </div>
    );
  }

  // PDF / document
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative" style={{ background: file.thumbnailColor, minHeight: '300px' }}>
      <div className="w-44 h-56 rounded-xl shadow-md flex flex-col items-center justify-center gap-3 relative" style={{ background: '#FFFFFF' }}>
        <FileText className="h-12 w-12" style={{ color: '#C2410C', opacity: 0.35 }} />
        <p className="text-[11px] font-semibold text-center px-3" style={{ color: '#D1D5DB' }}>Preview unavailable</p>
        <p className="text-[10px] text-center px-3" style={{ color: '#E5E7EB' }}>PDF rendering coming soon</p>
        {page.ocrStatus === 'processing' && (
          <div className="absolute top-2 right-2">
            <Loader2 className="h-3 w-3 animate-spin" style={{ color: '#F97316' }} />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: ocrBadge[page.ocrStatus].bg, color: ocrBadge[page.ocrStatus].color }}>
          {ocrBadge[page.ocrStatus].label}
        </span>
        {page.ocrStatus === 'processing' && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
              <motion.div className="h-full rounded-full" style={{ background: '#F97316' }}
                initial={{ width: '0%' }} animate={{ width: `${page.ocrProgress}%` }} transition={{ duration: 0.6 }} />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: '#F97316' }}>{page.ocrProgress}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Grid card for gallery/grid view
interface FileCardProps { file: CaseFile; isSelected: boolean; onClick: () => void; onFavorite: (e: React.MouseEvent) => void; }
const FileCard: React.FC<FileCardProps> = ({ file, isSelected, onClick, onFavorite }) => {
  const Icon = typeIcon[file.type];
  return (
    <motion.button
      key={file.id}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClick}
      className="text-left rounded-xl overflow-hidden transition-all group relative"
      style={{
        background: '#FFFFFF',
        border: isSelected ? '2px solid #F97316' : '1px solid #E5E7EB',
        boxShadow: isSelected ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }
      }}
    >
      {/* Thumbnail */}
      <div className="aspect-video flex items-center justify-center relative" style={{ background: file.thumbnailColor }}>
        <Icon className="h-7 w-7" style={{ color: typeIconColor[file.type], opacity: 0.5 }} />
        {file.type === 'video' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-9 h-9 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <Play className="h-3.5 w-3.5 text-white ml-0.5" fill="white" />
            </span>
          </span>
        )}
        {file.duration && (
          <span className="absolute bottom-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.65)', color: '#FFF' }}>{file.duration}</span>
        )}
        {(file.isPinned || file.isFavorite) && (
          <div className="absolute top-1.5 left-1.5 flex gap-1">
            {file.isPinned && <span className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.9)' }}><Pin className="h-2.5 w-2.5" style={{ color: '#F97316' }} /></span>}
            {file.isFavorite && <span className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.9)' }}><Star className="h-2.5 w-2.5" style={{ color: '#F59E0B' }} /></span>}
          </div>
        )}
        <button onClick={onFavorite} className="absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.9)' }}>
          <Star className="h-3 w-3" style={{ color: file.isFavorite ? '#F59E0B' : '#D1D5DB' }} />
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-gray-900 truncate">{file.name}.{file.extension}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${categoryColor[file.category]}18`, color: categoryColor[file.category] }}>
            {file.category}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: ocrBadge[file.status].bg, color: ocrBadge[file.status].color }}>
            {ocrBadge[file.status].label}
          </span>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: '#D1D5DB' }}>{file.totalSize} · {formatDate(file.uploadDate)}</p>
      </div>
    </motion.button>
  );
};

interface NotesPanelProps { file: CaseFile; onUpdate: (content: string) => void; }
const NotesPanel: React.FC<NotesPanelProps> = ({ file, onUpdate }) => {
  const [draft, setDraft] = useState(file.note.content);
  const [autoSaved, setAutoSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX = 500;

  useEffect(() => { setDraft(file.note.content); }, [file.id]);

  const handleChange = (v: string) => {
    if (v.length > MAX) return;
    setDraft(v); setAutoSaved(false);
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
          {file.note.isPinned && <Pin className="h-3 w-3" style={{ color: '#F97316' }} />}
          <AnimatePresence>
            {autoSaved && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[10px] font-medium flex items-center gap-1" style={{ color: '#15803D' }}>
                <CheckCircle2 className="h-3 w-3" /> Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="p-4">
        <textarea value={draft} onChange={e => handleChange(e.target.value)}
          placeholder="Add a private note about this file…" rows={4}
          className="w-full resize-none text-xs text-gray-800 outline-none placeholder-gray-300 rounded-lg p-3"
          style={{ background: '#FAFAFA', border: '1px solid #F3F4F6', lineHeight: 1.6 }}
          onFocus={e => (e.currentTarget.style.borderColor = '#F97316')}
          onBlur={e => (e.currentTarget.style.borderColor = '#F3F4F6')} />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px]" style={{ color: '#D1D5DB' }}>
            {file.note.savedAt ? `Last saved ${file.note.savedAt}` : 'Not yet saved'}
          </p>
          <p className="text-[10px]" style={{ color: draft.length > MAX * 0.85 ? '#EF4444' : '#D1D5DB' }}>
            {draft.length}/{MAX}
          </p>
        </div>
      </div>
    </div>
  );
};

interface TagPanelProps { file: CaseFile; onToggleTag: (tag: FileTag) => void; }
const TagPanel: React.FC<TagPanelProps> = ({ file, onToggleTag }) => (
  <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <Tag className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
      <p className="text-xs font-semibold text-gray-700">Tags</p>
    </div>
    <div className="px-4 py-3 flex flex-wrap gap-1.5">
      {ALL_TAGS.map(t => {
        const active = file.tags.includes(t);
        const tc = tagColor[t];
        return (
          <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => onToggleTag(t)}
            className="text-[10px] font-bold px-2 py-1 rounded-full transition-all"
            style={{ background: active ? tc.bg : '#F9FAFB', color: active ? tc.color : '#D1D5DB', border: active ? `1px solid ${tc.color}30` : '1px solid #F3F4F6' }}>
            {t}
          </motion.button>
        );
      })}
    </div>
  </div>
);

interface TimelinePanelProps { file: CaseFile; }
const TimelinePanel: React.FC<TimelinePanelProps> = ({ file }) => (
  <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <Activity className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
      <p className="text-xs font-semibold text-gray-700">Document Timeline</p>
    </div>
    <div className="px-4 py-3 space-y-0">
      {file.activity.map((ev, i) => {
        const color = activityColor[ev.action];
        const isLast = i === file.activity.length - 1;
        return (
          <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }} className="flex gap-3">
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

interface VersionPanelProps { file: CaseFile; selectedVersionId: string; onSelectVersion: (id: string) => void; }
const VersionPanel: React.FC<VersionPanelProps> = ({ file, selectedVersionId, onSelectVersion }) => (
  <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <History className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
      <p className="text-xs font-semibold text-gray-700">Version History</p>
      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
        {file.versions.length} version{file.versions.length !== 1 ? 's' : ''}
      </span>
    </div>
    <div className="px-4 py-3 space-y-2">
      {file.versions.map(v => {
        const isSel = selectedVersionId === v.id;
        return (
          <motion.div key={v.id} whileHover={{ scale: 1.01 }} onClick={() => onSelectVersion(v.id)}
            className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer"
            style={{ background: isSel ? '#FFF7ED' : '#FAFAFA', border: isSel ? '1px solid #F97316' : '1px solid transparent' }}>
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
              style={{ background: isSel ? '#F97316' : '#E5E7EB', color: isSel ? '#FFFFFF' : '#9CA3AF' }}>{v.version}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold text-gray-800">{v.label}</p>
                {v.isCurrent && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#15803D' }}>Current</span>}
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

interface DocPropertiesProps { file: CaseFile; }
const DocProperties: React.FC<DocPropertiesProps> = ({ file }) => {
  const catColor = categoryColor[file.category];
  const ocr = ocrBadge[file.status];
  const rows = [
    { label: 'File Name', value: `${file.name}.${file.extension}` },
    { label: 'Extension', value: `.${file.extension.toUpperCase()}` },
    { label: 'Pages', value: `${file.totalPages}` },
    { label: 'Resolution', value: file.resolution },
    { label: 'Size', value: file.totalSize },
    ...(file.duration ? [{ label: 'Duration', value: file.duration }] : []),
    { label: 'Upload Date', value: formatDate(file.uploadDate) },
    { label: 'Last Modified', value: formatDate(file.lastModified) },
    { label: 'Created By', value: file.uploadedBy },
    { label: 'Storage Path', value: file.storagePath },
    { label: 'Hash', value: file.hash },
    { label: 'Category', value: file.category },
    { label: 'Type', value: file.type.toUpperCase() },
    { label: 'Document ID', value: file.docId },
  ];
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
          <p className="text-xs font-semibold text-gray-700">Properties</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${catColor}18`, color: catColor }}>{file.category}</span>
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
          {file.aiCompleted && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F5F3FF', color: '#7C3AED' }}>AI Done</span>}
          {file.isFavorite && <Star className="h-3 w-3" style={{ color: '#F59E0B' }} />}
          {file.isPinned && <Pin className="h-3 w-3" style={{ color: '#F97316' }} />}
        </div>
      </div>
    </div>
  );
};

interface AIPanelProps { file: CaseFile; }
const AIPanel: React.FC<AIPanelProps> = ({ file }) => {
  const aiCards = [
    { icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Summary', desc: 'Key facts and context' },
    { icon: <Users className="h-3.5 w-3.5" />, label: 'People', desc: 'Parties & witnesses' },
    { icon: <Gavel className="h-3.5 w-3.5" />, label: 'Court', desc: 'Court name & case no.' },
    { icon: <FileText className="h-3.5 w-3.5" />, label: 'Sections', desc: 'IPC / CrPC sections' },
    { icon: <Scale className="h-3.5 w-3.5" />, label: 'Acts', desc: 'Acts and statutes' },
    { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Key Dates', desc: 'Hearings & deadlines' },
    { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Risk Score', desc: 'Legal risk assessment' },
    { icon: <Clock className="h-3.5 w-3.5" />, label: 'Deadlines', desc: 'Filing compliance dates' },
    { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Conflicts', desc: 'Contradictions found' },
    { icon: <CheckSquare className="h-3.5 w-3.5" />, label: 'Actions', desc: 'AI-suggested next steps' },
    { icon: <Eye className="h-3.5 w-3.5" />, label: 'Transcription', desc: 'Audio/video transcript' },
    { icon: <Brain className="h-3.5 w-3.5" />, label: 'Insights', desc: 'Cross-file correlations' },
  ];
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}>
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1A1A1A' }}>
          <Brain className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">AI Analysis</p>
          <p className="text-[11px] truncate" style={{ color: '#525252' }}>{file.name}.{file.extension}</p>
        </div>
        {file.aiCompleted && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#1F1F1F', color: '#8B5CF6' }}>AI Done</span>
        )}
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#525252' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#A3A3A3' }}>AI Status</p>
            <p className="text-xs font-bold mt-0.5" style={{ color: '#525252' }}>
              {file.aiCompleted ? 'Analysis Complete' : 'Waiting for Analysis'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {aiCards.map(card => (
            <div key={card.label} className="rounded-lg px-3 py-2.5 flex items-start gap-2"
              style={{ background: '#141414', border: '1px solid #1F1F1F', opacity: file.aiCompleted ? 0.9 : 0.4 }}>
              <span style={{ color: '#525252', flexShrink: 0, marginTop: 1 }}>{card.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold" style={{ color: '#737373' }}>{card.label}</p>
                <p className="text-[9px]" style={{ color: '#404040' }}>{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button disabled className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold"
          style={{ background: '#1A1A1A', color: '#404040', cursor: 'not-allowed', border: '1px solid #1F1F1F' }}>
          <Sparkles className="h-3.5 w-3.5" /> Generate AI Summary
        </button>
      </div>
      <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderTop: '1px solid #1A1A1A' }}>
        <button disabled className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
          style={{ background: '#141414', color: '#404040', cursor: 'not-allowed' }}>
          <Eye className="h-3.5 w-3.5" /> View OCR
        </button>
        <button disabled className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
          style={{ background: '#1A1A1A', color: '#404040', cursor: 'not-allowed' }}>
          <MessageSquare className="h-3.5 w-3.5" /> Ask AI
        </button>
      </div>
    </div>
  );
};

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
        <button key={item.label} disabled className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left"
          style={{ background: '#FAFAFA', border: '1px solid #F3F4F6', cursor: 'not-allowed', opacity: 0.6 }}>
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
              <button key={t} disabled className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ background: t === 'Private' ? '#F97316' : '#F3F4F6', color: t === 'Private' ? '#FFF' : '#9CA3AF', cursor: 'not-allowed' }}>{t}</button>
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

interface StorageBarProps { label: string; value: number; max: number; color: string; unit: string; }
const StorageBar: React.FC<StorageBarProps> = ({ label, value, max, color, unit }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>{label}</span>
      <span className="text-[10px] font-bold text-gray-700">{value} {unit}</span>
    </div>
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
      <motion.div className="h-full rounded-full" style={{ background: color }}
        initial={{ width: 0 }} animate={{ width: `${Math.min((value / max) * 100, 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
    </div>
  </div>
);

const SkeletonLine: React.FC<{ w?: string; h?: string }> = ({ w = '100%', h = '10px' }) => (
  <motion.div className="rounded" style={{ width: w, height: h, background: '#F3F4F6' }}
    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }} />
);
const SkeletonCard: React.FC = () => (
  <div className="rounded-xl p-4 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg" style={{ background: '#F3F4F6' }} />
      <div className="flex-1 space-y-1.5"><SkeletonLine w="60%" /><SkeletonLine w="40%" /></div>
    </div>
    <SkeletonLine /><SkeletonLine w="70%" />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Evidence: React.FC<EvidenceProps> = ({ caseTitle = 'Sharma vs. State of UP' }) => {
  const [files, setFiles] = useState<CaseFile[]>(MOCK_FILES);
  const [selectedFile, setSelectedFile] = useState<CaseFile>(MOCK_FILES[0]);
  const [selectedPage, setSelectedPage] = useState<FilePage>(MOCK_FILES[0].pages[0]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(['doc1']));
  const [expandedFolders, setExpandedFolders] = useState<Set<FolderName>>(
    new Set(['Documents', 'Evidence', 'Petitions', 'Affidavits'])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('explorer');
  const [dragActive, setDragActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    MOCK_FILES[0].versions.find(v => v.isCurrent)?.id ?? ''
  );
  const [rightTab, setRightTab] = useState<'ai' | 'timeline' | 'versions' | 'notes' | 'tags' | 'properties' | 'share'>('ai');
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  // ── Stats ──
  const totalFiles = files.length;
  const totalPages = useMemo(() => files.reduce((s, f) => s + f.totalPages, 0), [files]);
  const totalStorageMB = useMemo(() =>
    files.reduce((s, f) => {
      const n = parseFloat(f.totalSize);
      return s + n * (f.totalSize.includes('MB') ? 1 : f.totalSize.includes('KB') ? 0.001 : 0);
    }, 0), [files]);
  const ocrCompleted = useMemo(() => files.filter(f => f.status === 'processed').length, [files]);
  const favoriteCount = useMemo(() => files.filter(f => f.isFavorite).length, [files]);
  const videoCount = useMemo(() => files.filter(f => f.type === 'video').length, [files]);
  const audioCount = useMemo(() => files.filter(f => f.type === 'audio').length, [files]);
  const imageCount = useMemo(() => files.filter(f => f.type === 'image').length, [files]);
  const recentUpload = useMemo(() => {
    const sorted = [...files].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    return sorted[0]?.uploadDate ?? '';
  }, [files]);

  // ── Filtering ──
  const filteredFiles = useMemo(() =>
    files.filter(f => {
      if (activeFilter === 'pdf' && f.type !== 'pdf') return false;
      if (activeFilter === 'image' && f.type !== 'image') return false;
      if (activeFilter === 'video' && f.type !== 'video') return false;
      if (activeFilter === 'audio' && f.type !== 'audio') return false;
      if (activeFilter === 'evidence' && f.category !== 'Evidence') return false;
      if (activeFilter === 'court_order' && f.category !== 'Court Order') return false;
      if (activeFilter === 'pending_ocr' && f.status !== 'pending' && f.status !== 'processing') return false;
      if (activeFilter === 'processed' && f.status !== 'processed') return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
        || f.folder.toLowerCase().includes(q) || f.tags.some(t => t.toLowerCase().includes(q));
    }), [files, activeFilter, searchQuery]);

  const filteredByFolder = useMemo(() => {
    const map: Record<FolderName, CaseFile[]> = {} as Record<FolderName, CaseFile[]>;
    FOLDER_NAMES.forEach(f => { map[f] = []; });
    filteredFiles.forEach(f => { if (map[f.folder]) map[f.folder].push(f); });
    return map;
  }, [filteredFiles]);

  // ── Selection helpers ──
  const selectFile = (f: CaseFile) => {
    setSelectedFile(f);
    setSelectedPage(f.pages[0]);
    setSelectedVersionId(f.versions.find(v => v.isCurrent)?.id ?? '');
  };

  const selectPage = (f: CaseFile, page: FilePage) => {
    setSelectedFile(f); setSelectedPage(page);
    setSelectedVersionId(f.versions.find(v => v.isCurrent)?.id ?? '');
    if (!expandedFiles.has(f.id)) setExpandedFiles(prev => new Set([...prev, f.id]));
  };

  const toggleExpand = (id: string) => setExpandedFiles(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const toggleFolder = (f: FolderName) => setExpandedFolders(prev => {
    const next = new Set(prev); next.has(f) ? next.delete(f) : next.add(f); return next;
  });

  const toggleSelectFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const bulkDelete = () => {
    setFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
    const remaining = files.filter(f => !selectedIds.has(f.id));
    if (remaining.length > 0) selectFile(remaining[0]);
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isFavorite: !f.isFavorite } : f));
    if (selectedFile.id === id) setSelectedFile(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
  };

  const removeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFile.id === id) {
      const remaining = files.filter(f => f.id !== id);
      if (remaining.length > 0) selectFile(remaining[0]);
    }
  };

  // ── Upload handler ──
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: CaseFile[] = Array.from(fileList).map((f, idx) => {
      const isPdf = f.type.includes('pdf');
      const isVideo = f.type.includes('video');
      const isAudio = f.type.includes('audio');
      const isImage = f.type.includes('image');
      const type: FileType = isPdf ? 'pdf' : isVideo ? 'video' : isAudio ? 'audio' : 'image';
      const now = new Date().toISOString().split('T')[0];
      const id = `upload-${Date.now()}-${idx}`;
      const prog: Record<string, number> = {};
      prog[id] = 0;
      setUploadProgress(prev => ({ ...prev, [id]: 0 }));
      // Simulate upload progress
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 25;
        if (p >= 100) { p = 100; clearInterval(interval); }
        setUploadProgress(prev => ({ ...prev, [id]: Math.min(p, 100) }));
      }, 300);
      return {
        id, name: f.name.replace(/\.[^.]+$/, ''), extension: isPdf ? 'pdf' : isVideo ? 'mp4' : isAudio ? 'mp3' : 'jpg',
        category: 'Other', folder: 'Other', type, totalPages: 1, uploadDate: now, lastModified: now,
        uploadedBy: 'Current User', totalSize: formatBytes(f.size), status: 'processing' as OcrStatus,
        thumbnailColor: isPdf ? '#FEF3E7' : isVideo ? '#EFF6FF' : isAudio ? '#FDF4FF' : '#F0FDF4',
        resolution: isPdf ? '300 DPI' : isVideo ? '1080p' : isAudio ? '320 kbps' : '72 DPI',
        storagePath: `/uploads/${f.name}`, hash: Math.random().toString(16).slice(2, 18),
        docId: `DOC-${Date.now()}`, isFavorite: false, isPinned: false, aiCompleted: false, tags: [],
        pages: [{ id: `${id}-p1`, pageNumber: 1, ocrStatus: 'processing', ocrProgress: 0, size: formatBytes(f.size) }],
        versions: [{ id: 'v1', version: 1, label: 'v1.0 (Latest)', createdAt: now, createdBy: 'Current User', changes: 'Initial upload', isCurrent: true }],
        activity: [{ id: 'a1', action: 'Uploaded', date: now, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), user: 'Current User' }],
        note: { id: `n-${Date.now()}`, content: '', isPinned: false, savedAt: '', author: 'Current User' },
      };
    });
    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0) selectFile(newFiles[0]);
  };

  const updateNote = (content: string) => {
    const updated = { ...selectedFile, note: { ...selectedFile.note, content, savedAt: new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) } };
    setSelectedFile(updated);
    setFiles(prev => prev.map(f => f.id === selectedFile.id ? updated : f));
  };

  const toggleTag = (tag: FileTag) => {
    const updatedTags = selectedFile.tags.includes(tag) ? selectedFile.tags.filter(t => t !== tag) : [...selectedFile.tags, tag];
    const updated = { ...selectedFile, tags: updatedTags };
    setSelectedFile(updated);
    setFiles(prev => prev.map(f => f.id === selectedFile.id ? updated : f));
  };

  const currentPageIndex = selectedFile.pages.findIndex(p => p.id === selectedPage.id);
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = currentPageIndex < selectedFile.pages.length - 1;

  const rightTabs: Array<{ id: typeof rightTab; label: string; icon: React.ReactNode }> = [
    { id: 'ai', label: 'AI', icon: <Brain className="h-3 w-3" /> },
    { id: 'timeline', label: 'Timeline', icon: <Activity className="h-3 w-3" /> },
    { id: 'versions', label: 'Versions', icon: <History className="h-3 w-3" /> },
    { id: 'notes', label: 'Notes', icon: <PenLine className="h-3 w-3" /> },
    { id: 'tags', label: 'Tags', icon: <Tag className="h-3 w-3" /> },
    { id: 'properties', label: 'Info', icon: <Info className="h-3 w-3" /> },
    { id: 'share', label: 'Share', icon: <Share2 className="h-3 w-3" /> },
  ];

  if (isLoading) {
    return (
      <div className="space-y-5">
        <SkeletonCard />
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_300px] gap-4">
          <SkeletonCard />
          <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── 1. UPLOAD ZONE ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-gray-900">Evidence Vault</h1>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#22C55E' }}>
                <Lock className="h-2.5 w-2.5" /> Encrypted
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFF7ED', color: '#F97316' }}>
                <ShieldCheck className="h-2.5 w-2.5" /> Tamper-Proof
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              {totalFiles} files · {caseTitle} · All uploads are logged and version-controlled
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
              style={{ background: '#F97316' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}>
              <Upload className="h-4 w-4" /> Upload Files
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx" className="hidden"
              onChange={e => handleFiles(e.target.files)} />
          </div>
        </div>

        {/* Drag-and-drop area */}
        <div
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
          className="mx-6 my-4 rounded-xl flex items-center gap-6 transition-all cursor-pointer"
          style={{
            background: dragActive ? '#FFF7ED' : '#FAFAFA',
            border: `2px dashed ${dragActive ? '#F97316' : '#E5E7EB'}`,
            padding: '20px 24px',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: dragActive ? '#FFF7ED' : '#F3F4F6' }}>
            <Upload className="h-5 w-5" style={{ color: dragActive ? '#F97316' : '#9CA3AF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              {dragActive ? 'Release to upload…' : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              Supports PDF · Images · Videos · Audio · Documents · up to 500 MB per file
            </p>
          </div>
          {/* File type chips */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {[
              { Icon: FileText, label: 'PDF', color: '#C2410C', bg: '#FEF3E7' },
              { Icon: ImageIcon, label: 'Image', color: '#15803D', bg: '#F0FDF4' },
              { Icon: Video, label: 'Video', color: '#1D4ED8', bg: '#EFF6FF' },
              { Icon: Music, label: 'Audio', color: '#A21CAF', bg: '#FDF4FF' },
            ].map(({ Icon, label, color, bg }) => (
              <div key={label} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg" style={{ background: bg }}>
                <Icon className="h-4 w-4" style={{ color }} />
                <span className="text-[9px] font-bold" style={{ color }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active uploads */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="px-6 pb-4 space-y-2">
            {Object.entries(uploadProgress).filter(([, v]) => v < 100).map(([id, pct]) => {
              const file = files.find(f => f.id === id);
              if (!file) return null;
              return (
                <div key={id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" style={{ color: '#F97316' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-700 truncate">{file.name}.{file.extension}</p>
                    <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: '#FED7AA' }}>
                      <motion.div className="h-full rounded-full" style={{ background: '#F97316', width: `${pct}%` }}
                        animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold flex-shrink-0" style={{ color: '#F97316' }}>{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2. STATS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard icon={<FileIcon className="h-4 w-4" />} label="Total Files" value={totalFiles} color="#3B82F6" bg="#EFF6FF" delay={0} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Total Pages" value={totalPages} color="#8B5CF6" bg="#F5F3FF" delay={0.04} />
        <StatCard icon={<Database className="h-4 w-4" />} label="Storage" value={`${totalStorageMB.toFixed(0)} MB`} color="#0EA5E9" bg="#F0F9FF" delay={0.08} />
        <StatCard icon={<ScanText className="h-4 w-4" />} label="OCR Done" value={`${ocrCompleted}/${totalFiles}`} color="#15803D" bg="#F0FDF4" delay={0.12} />
        <StatCard icon={<Video className="h-4 w-4" />} label="Videos" value={videoCount} color="#1D4ED8" bg="#EFF6FF" delay={0.16} />
        <StatCard icon={<Music className="h-4 w-4" />} label="Audio" value={audioCount} color="#A21CAF" bg="#FDF4FF" delay={0.20} />
        <StatCard icon={<ImageIcon className="h-4 w-4" />} label="Images" value={imageCount} color="#15803D" bg="#F0FDF4" delay={0.24} />
        <StatCard icon={<Star className="h-4 w-4" />} label="Favorites" value={favoriteCount} color="#B45309" bg="#FEF3C7" delay={0.28} />
      </div>

      {/* ── 3. HEADER + ACTIONS ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Document & Evidence Centre</h2>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
            {caseTitle} · {totalFiles} file{totalFiles !== 1 ? 's' : ''} · {totalPages} page{totalPages !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <button onClick={() => setViewMode('explorer')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all"
              style={{ background: viewMode === 'explorer' ? '#F97316' : '#FFFFFF', color: viewMode === 'explorer' ? '#FFFFFF' : '#6B7280' }}>
              <List className="h-3.5 w-3.5" /> Explorer
            </button>
            <button onClick={() => setViewMode('grid')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all"
              style={{ background: viewMode === 'grid' ? '#F97316' : '#FFFFFF', color: viewMode === 'grid' ? '#FFFFFF' : '#6B7280' }}>
              <Grid3x3 className="h-3.5 w-3.5" /> Gallery
            </button>
          </div>
          <ActionBtn icon={<Merge className="h-3 w-3" />} label="Merge PDFs" disabled />
          <ActionBtn icon={<Scissors className="h-3 w-3" />} label="Split PDF" disabled />
          <ActionBtn icon={<ScanText className="h-3 w-3" />} label="Run OCR" disabled />
        </div>
      </div>

      {/* ── 4. BULK SELECTION BAR ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
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
              <ActionBtn icon={<Brain className="h-3 w-3" />} label="AI Summary" disabled small />
            </div>
            <button onClick={() => setSelectedIds(new Set())}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
              <X className="h-3 w-3" /> Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. SEARCH + FILTERS ── */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, category, folder, or tag…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 placeholder-gray-400 outline-none"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
              onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
              onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')} />
          </div>
          <button onClick={() => setSelectedIds(new Set(filteredFiles.map(f => f.id)))}
            className="flex-shrink-0 text-xs font-semibold px-3 py-2.5 rounded-lg"
            style={{ background: '#F3F4F6', color: '#6B7280' }}>
            Select All
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map(f => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={activeFilter === f.id ? { background: '#F97316', color: '#FFFFFF' } : { background: '#F3F4F6', color: '#6B7280' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 6. GALLERY VIEW ── */}
      {viewMode === 'grid' && (
        <AnimatePresence mode="wait">
          <motion.div key="grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {filteredFiles.length === 0 ? (
              <div className="rounded-xl p-12 text-center" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <ShieldCheck className="h-10 w-10 mx-auto mb-3" style={{ color: '#E5E7EB' }} />
                <p className="text-sm font-semibold text-gray-700">No files match your filter</p>
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Try a different search term or filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredFiles.map(f => (
                  <FileCard key={f.id} file={f} isSelected={selectedFile.id === f.id}
                    onClick={() => { selectFile(f); setViewMode('explorer'); }}
                    onFavorite={e => toggleFavorite(f.id, e)} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── 7. EXPLORER VIEW (3-panel) ── */}
      {viewMode === 'explorer' && files.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_300px] gap-4 items-start">

          {/* ── LEFT: Folder Explorer ── */}
          <div className="rounded-xl overflow-hidden xl:sticky xl:top-5"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <p className="text-xs font-semibold text-gray-700">Folder Explorer</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                {filteredFiles.length}
              </span>
            </div>
            <div className="py-1 max-h-[72vh] overflow-y-auto">
              {FOLDER_NAMES.map(folderName => {
                const folderFiles = filteredByFolder[folderName];
                if (folderFiles.length === 0) return null;
                const isOpen = expandedFolders.has(folderName);
                return (
                  <div key={folderName}>
                    <motion.div className="flex items-center gap-2 px-3 py-2 cursor-pointer group"
                      onClick={() => toggleFolder(folderName)} whileHover={{ background: '#F9FAFB' }}>
                      <ChevronRight className="h-3.5 w-3.5 transition-transform flex-shrink-0"
                        style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                      {isOpen
                        ? <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: '#F97316' }} />
                        : <Folder className="h-4 w-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />}
                      <p className="text-[11px] font-bold text-gray-700 flex-1">{folderName}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                        {folderFiles.length}
                      </span>
                    </motion.div>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                          {folderFiles.map(file => {
                            const isExpanded = expandedFiles.has(file.id);
                            const isFileSel = selectedFile.id === file.id;
                            const catColor = categoryColor[file.category];
                            const isChecked = selectedIds.has(file.id);
                            const FileTypeIcon = typeIcon[file.type];
                            return (
                              <div key={file.id}>
                                <div
                                  className="flex items-center gap-2 pl-6 pr-3 py-2 group cursor-pointer"
                                  style={{ background: isFileSel && !isExpanded ? '#FFF7ED' : 'transparent' }}
                                  onClick={() => {
                                    selectFile(file);
                                    if (isFileSel) toggleExpand(file.id);
                                    else setExpandedFiles(prev => new Set([...prev, file.id]));
                                  }}
                                >
                                  <div onClick={e => toggleSelectFile(file.id, e)} className="flex-shrink-0">
                                    {isChecked
                                      ? <CheckSquare className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
                                      : <Square className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100" style={{ color: '#D1D5DB' }} />}
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); toggleExpand(file.id); }}
                                    className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                    <ChevronRight className="h-3 w-3 transition-transform"
                                      style={{ color: '#9CA3AF', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                                  </button>
                                  <FileTypeIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: typeIconColor[file.type] }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <p className="text-[11px] font-semibold text-gray-800 truncate">{file.name}</p>
                                      {file.isPinned && <Pin className="h-2.5 w-2.5 flex-shrink-0" style={{ color: '#F97316' }} />}
                                      {file.isFavorite && <Star className="h-2.5 w-2.5 flex-shrink-0" style={{ color: '#F59E0B' }} />}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{ background: `${catColor}18`, color: catColor }}>{file.category}</span>
                                      <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                                        {file.type === 'video' || file.type === 'audio' ? file.duration : `${file.totalPages}p`}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button onClick={e => toggleFavorite(file.id, e)}>
                                      <Star className="h-3 w-3" style={{ color: file.isFavorite ? '#F59E0B' : '#D1D5DB' }} />
                                    </button>
                                    <button onClick={e => removeFile(file.id, e)}>
                                      <X className="h-3 w-3" style={{ color: '#9CA3AF' }} />
                                    </button>
                                  </div>
                                </div>

                                {/* Pages */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.12 }} className="overflow-hidden">
                                      {file.pages.map(page => {
                                        const isPageSel = selectedPage.id === page.id && selectedFile.id === file.id;
                                        return (
                                          <div key={page.id} onClick={() => selectPage(file, page)}
                                            className="flex items-center gap-2 pl-14 pr-3 py-1.5 cursor-pointer transition-colors"
                                            style={{ background: isPageSel ? '#FFF7ED' : 'transparent' }}
                                            onMouseEnter={e => { if (!isPageSel) (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; }}
                                            onMouseLeave={e => { if (!isPageSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                                            <div className="w-1 h-1 rounded-full flex-shrink-0"
                                              style={{ background: isPageSel ? '#F97316' : '#D1D5DB' }} />
                                            <span className="text-[10px] font-medium flex-1" style={{ color: isPageSel ? '#C2410C' : '#6B7280' }}>
                                              {file.totalPages > 1 ? `Page ${page.pageNumber}` : file.type === 'video' ? 'Video' : file.type === 'audio' ? 'Audio' : 'Image'}
                                            </span>
                                            {page.ocrStatus === 'processing' && (
                                              <div className="flex items-center gap-1">
                                                <Loader2 className="h-2.5 w-2.5 animate-spin" style={{ color: '#F97316' }} />
                                                <span className="text-[9px]" style={{ color: '#F97316' }}>{page.ocrProgress}%</span>
                                              </div>
                                            )}
                                            {page.ocrStatus === 'processed' && <CheckCircle2 className="h-3 w-3" style={{ color: '#22C55E' }} />}
                                            {(page.ocrStatus === 'pending' || page.ocrStatus === 'n/a') && (
                                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#D1D5DB' }} />
                                            )}
                                            {page.ocrStatus === 'failed' && <AlertCircle className="h-3 w-3" style={{ color: '#DC2626' }} />}
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
              {filteredFiles.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <FileIcon className="h-6 w-6 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                  <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>No files match</p>
                </div>
              )}
            </div>
          </div>

          {/* ── CENTRE: Preview ── */}
          <div className="space-y-3 min-w-0">
            {/* View toolbar */}
            <div className="rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mr-1" style={{ color: '#9CA3AF' }}>View</p>
              {[
                { icon: <ZoomIn className="h-3.5 w-3.5" />, label: 'Zoom In' },
                { icon: <ZoomOut className="h-3.5 w-3.5" />, label: 'Zoom Out' },
                { icon: <RotateCcw className="h-3.5 w-3.5" />, label: 'Rotate Left' },
                { icon: <RotateCw className="h-3.5 w-3.5" />, label: 'Rotate Right' },
                { icon: <AlignHorizontalJustifyCenter className="h-3.5 w-3.5" />, label: 'Fit Width' },
                { icon: <Maximize2 className="h-3.5 w-3.5" />, label: 'Fullscreen' },
              ].map(btn => (
                <button key={btn.label} disabled title={btn.label}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: '#F9FAFB', color: '#D1D5DB', cursor: 'not-allowed' }}>
                  {btn.icon}
                </button>
              ))}
              <div className="h-5 w-px mx-1" style={{ background: '#F3F4F6' }} />
              {[
                { icon: <Download className="h-3.5 w-3.5" />, label: 'Download' },
                { icon: <Printer className="h-3.5 w-3.5" />, label: 'Print' },
              ].map(btn => (
                <button key={btn.label} disabled title={btn.label}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: '#F9FAFB', color: '#D1D5DB', cursor: 'not-allowed' }}>
                  {btn.icon}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                {selectedFile.tags.slice(0, 3).map(t => (
                  <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full hidden sm:inline"
                    style={{ background: tagColor[t].bg, color: tagColor[t].color }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Main preview card */}
            <div className="rounded-xl overflow-hidden flex flex-col"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', minHeight: '420px' }}>
              {/* Preview header */}
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid #F3F4F6' }}>
                <div className="flex items-center gap-2 min-w-0">
                  {React.createElement(typeIcon[selectedFile.type], {
                    className: 'h-4 w-4 flex-shrink-0',
                    style: { color: typeIconColor[selectedFile.type] },
                  })}
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {selectedFile.name}.{selectedFile.extension}
                  </p>
                  {selectedFile.totalPages > 1 && (
                    <span className="text-xs flex-shrink-0" style={{ color: '#9CA3AF' }}>· Page {selectedPage.pageNumber}</span>
                  )}
                  {selectedFile.duration && (
                    <span className="text-xs flex-shrink-0" style={{ color: '#9CA3AF' }}>· {selectedFile.duration}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={e => toggleFavorite(selectedFile.id, e)}>
                    <Star className="h-4 w-4" style={{ color: selectedFile.isFavorite ? '#F59E0B' : '#E5E7EB' }} />
                  </button>
                  <ActionBtn icon={<Download className="h-3 w-3" />} label="Download" disabled />
                  <ActionBtn icon={<Trash2 className="h-3 w-3" />} label="Delete" disabled />
                </div>
              </div>

              {/* Media preview */}
              <AnimatePresence mode="wait">
                <motion.div key={selectedFile.id + selectedPage.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }} className="flex-1 flex flex-col">
                  <MediaPreview file={selectedFile} page={selectedPage} />
                </motion.div>
              </AnimatePresence>

              {/* Page thumbnails (multi-page docs) */}
              {selectedFile.pages.length > 1 && (
                <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {selectedFile.pages.map(page => (
                      <PageThumbnail key={page.id} page={page} file={selectedFile}
                        isSelected={selectedPage.id === page.id}
                        onClick={() => selectPage(selectedFile, page)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Page navigation */}
              {selectedFile.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                  style={{ borderTop: '1px solid #F3F4F6' }}>
                  <button onClick={() => canGoPrev && selectPage(selectedFile, selectedFile.pages[currentPageIndex - 1])}
                    disabled={!canGoPrev}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: canGoPrev ? '#F3F4F6' : 'transparent', color: canGoPrev ? '#374151' : '#D1D5DB', cursor: canGoPrev ? 'pointer' : 'not-allowed' }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-medium text-gray-700">
                    Page {selectedPage.pageNumber} of {selectedFile.totalPages}
                  </span>
                  <button onClick={() => canGoNext && selectPage(selectedFile, selectedFile.pages[currentPageIndex + 1])}
                    disabled={!canGoNext}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: canGoNext ? '#F3F4F6' : 'transparent', color: canGoNext ? '#374151' : '#D1D5DB', cursor: canGoNext ? 'pointer' : 'not-allowed' }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* File info bar */}
            <div className="rounded-xl px-5 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-4"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              {[
                { label: 'File', value: `${selectedFile.name}.${selectedFile.extension}` },
                { label: selectedFile.type === 'video' || selectedFile.type === 'audio' ? 'Duration' : 'Page', value: selectedFile.duration ?? `${selectedPage.pageNumber} / ${selectedFile.totalPages}` },
                { label: 'Status', value: ocrBadge[selectedPage.ocrStatus].label, color: ocrBadge[selectedPage.ocrStatus].color },
                { label: 'Size', value: selectedFile.totalSize },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9CA3AF' }}>{item.label}</p>
                  <p className="text-[11px] font-bold truncate" style={{ color: (item as { color?: string }).color ?? '#111827' }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Activity */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <BarChart2 className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-semibold text-gray-700">Recent Activity</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                {selectedFile.activity.slice(0, 4).map((ev, i) => {
                  const color = activityColor[ev.action];
                  return (
                    <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}18`, color }}>
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

            {/* Storage overview */}
            <div className="rounded-xl px-5 py-4 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-semibold text-gray-700">Storage Overview</p>
              </div>
              <StorageBar label="Storage Used" value={parseFloat(totalStorageMB.toFixed(1))} max={500} color="#F97316" unit="MB" />
              <StorageBar label="Total Files" value={totalFiles} max={200} color="#3B82F6" unit="files" />
              <StorageBar label="Processed Pages" value={files.reduce((s, f) => s + f.pages.filter(p => p.ocrStatus === 'processed').length, 0)} max={Math.max(totalPages, 1)} color="#22C55E" unit="pages" />
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { label: 'Upload Limit', value: '500 MB' },
                  { label: 'Largest File', value: '128 MB' },
                  { label: 'Avg Size', value: `${(totalStorageMB / Math.max(totalFiles, 1)).toFixed(1)} MB` },
                ].map(item => (
                  <div key={item.label} className="rounded-lg p-2.5 text-center" style={{ background: '#FAFAFA', border: '1px solid #F3F4F6' }}>
                    <p className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>{item.label}</p>
                    <p className="text-[11px] font-bold text-gray-700 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Tabbed details panel ── */}
          <div className="space-y-4 xl:sticky xl:top-5">
            <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="px-3 py-2 flex items-center gap-1 overflow-x-auto" style={{ borderBottom: '1px solid #F3F4F6' }}>
                {rightTabs.map(tab => (
                  <button key={tab.id} onClick={() => setRightTab(tab.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex-shrink-0"
                    style={rightTab === tab.id
                      ? { background: '#FFF7ED', color: '#C2410C' }
                      : { background: 'transparent', color: '#9CA3AF' }}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
              <div>
                <AnimatePresence mode="wait">
                  <motion.div key={rightTab + selectedFile.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                    {rightTab === 'timeline' && <TimelinePanel file={selectedFile} />}
                    {rightTab === 'versions' && (
                      <VersionPanel file={selectedFile} selectedVersionId={selectedVersionId} onSelectVersion={setSelectedVersionId} />
                    )}
                    {rightTab === 'notes' && (
                      <div className="p-4"><NotesPanel file={selectedFile} onUpdate={updateNote} /></div>
                    )}
                    {rightTab === 'tags' && <TagPanel file={selectedFile} onToggleTag={toggleTag} />}
                    {rightTab === 'properties' && <DocProperties file={selectedFile} />}
                    {rightTab === 'share' && <SharePanel />}
                    {rightTab === 'ai' && <div />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            {rightTab === 'ai' && <AIPanel file={selectedFile} />}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {viewMode === 'explorer' && files.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center px-8"
          style={{ background: '#FAFAFA', borderRadius: 16, border: '1.5px dashed #E5E7EB' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: '#FFF7ED' }}>
            <FolderOpen className="h-8 w-8" style={{ color: '#F97316', opacity: 0.7 }} />
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-1.5">No files yet</h3>
          <p className="text-sm text-gray-400 max-w-xs mb-6">
            Upload PDFs, images, videos, and audio files to get started. All files are organised automatically.
          </p>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: '#F97316' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}>
            <Upload className="h-4 w-4" /> Upload Your First File
          </button>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-gray-400">
            {['PDF & image support', 'Video & audio evidence', 'Automatic OCR', 'AI-powered analysis'].map(tip => (
              <div key={tip} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: '#22C55E' }} /> {tip}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Evidence;