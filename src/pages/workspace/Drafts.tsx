import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Plus, Download, Copy, Edit3, Eye,
  Search, X, Clock, CheckCircle, AlertCircle, Send,
  MoreHorizontal, Sparkles, FileCheck, FilePlus, ArrowUpRight, Star
} from 'lucide-react';
import { subscribeToCases, CaseDocument } from '../../services/caseService';
import { subscribeDocuments, DocumentRecord } from '../../services/documentService';
import { auth } from '../../auth';

// ─── Types ────────────────────────────────────────────────────────────────────
type DraftStatus = 'draft' | 'review' | 'approved' | 'exported';

interface Draft {
  id: string;
  name: string;
  caseId: string;
  caseTitle: string;
  type: string;
  created: string;
  modified: string;
  status: DraftStatus;
  wordCount: number;
  preview: string;
  starred: boolean;
  downloadURL?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 't1', label: 'Bail Application',    icon: FileText,   count: 12 },
  { id: 't2', label: 'Legal Notice',        icon: Send,       count: 8  },
  { id: 't3', label: 'Affidavit',           icon: FileCheck,  count: 15 },
  { id: 't4', label: 'Petition',            icon: FilePlus,   count: 6  },
  { id: 't5', label: 'Written Statement',   icon: Edit3,      count: 9  },
  { id: 't6', label: 'Agreement',           icon: FileText,   count: 4  },
  { id: 't7', label: 'Reply',               icon: Send,       count: 11 },
  { id: 't8', label: 'Consumer Complaint',  icon: AlertCircle, count: 3 },
];

const STATUS_CONFIG: Record<DraftStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft:    { label: 'Draft',    bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF' },
  review:   { label: 'In Review', bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
  approved: { label: 'Approved', bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  exported: { label: 'Exported', bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
};

const fmt = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

const getDraftType = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('bail')) return 'Bail Application';
  if (n.includes('notice')) return 'Legal Notice';
  if (n.includes('affidavit')) return 'Affidavit';
  if (n.includes('petition')) return 'Petition';
  if (n.includes('statement')) return 'Written Statement';
  if (n.includes('agreement')) return 'Agreement';
  if (n.includes('reply')) return 'Reply';
  if (n.includes('complaint')) return 'Consumer Complaint';
  return 'Legal Draft';
};

const getDraftStatus = (name: string): DraftStatus => {
  const n = name.toLowerCase();
  if (n.includes('approved')) return 'approved';
  if (n.includes('review')) return 'review';
  if (n.includes('exported')) return 'exported';
  return 'draft';
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Drafts() {
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState<DraftStatus | 'all'>('all');
  const [selected, setSelected]         = useState<Draft | null>(null);
  const [generating, setGenerating]     = useState<string | null>(null);
  const [cases, setCases]               = useState<CaseDocument[]>([]);
  const [documents, setDocuments]       = useState<Record<string, DocumentRecord[]>>({});

  const [starredIds, setStarredIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('starred_drafts') || '[]');
    } catch {
      return [];
    }
  });

  // Subscribe to real cases
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const unsub = subscribeToCases(
      userId,
      (docs) => setCases(docs),
      (err) => console.error('Drafts cases error:', err)
    );
    return unsub;
  }, []);

  // Subscribe to documents for all cases
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    cases.forEach((c) => {
      const userId = auth.currentUser?.uid || 'anonymous';
      const unsub = subscribeDocuments(c.id, userId, (docs) => {
        setDocuments((prev) => ({
          ...prev,
          [c.id]: docs,
        }));
      });
      unsubs.push(unsub);
    });
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [cases]);

  // Construct drafts array from real documents
  const drafts = useMemo(() => {
    const list: Draft[] = [];
    Object.entries(documents).forEach(([caseId, docList]) => {
      const parentCase = cases.find((c) => c.id === caseId);
      const caseTitle = parentCase?.title || 'Unknown Case';
      const caseNumber = parentCase?.caseNumber || caseId;

      docList.forEach((d) => {
        let createdDate = new Date().toISOString().split('T')[0];
        if (d.uploadedAt) {
          const dt = (d.uploadedAt as any).toDate ? (d.uploadedAt as any).toDate() : new Date((d.uploadedAt as any).seconds * 1000);
          createdDate = dt.toISOString().split('T')[0];
        }

        const name = d.originalName || d.fileName || 'Untitled Draft';
        const type = getDraftType(name);
        const status = getDraftStatus(name);

        list.push({
          id: d.id,
          name,
          caseId: caseNumber,
          caseTitle,
          type,
          created: createdDate,
          modified: createdDate,
          status,
          wordCount: Math.max(100, Math.round((d.fileSize || 6000) / 6)),
          starred: starredIds.includes(d.id),
          preview: `IN THE MATTER OF DRAFT:\n\nDocument: ${name}\nCase: ${caseTitle}\nUploaded by: ${d.uploadedBy || 'Advocate'}\nSize: ${((d.fileSize || 0) / 1024).toFixed(1)} KB.\n\nThis document is stored securely in your Case Files. You can review and export the PDF version directly.`,
          downloadURL: d.downloadURL,
        });
      });
    });
    return list;
  }, [cases, documents, starredIds]);

  const filtered = useMemo(() => {
    return drafts.filter(d => {
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
                          d.caseTitle.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || d.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [drafts, search, filterStatus]);

  // Sync selection
  useEffect(() => {
    if (filtered.length > 0 && (!selected || !filtered.some(d => d.id === selected.id))) {
      setSelected(filtered[0]);
    } else if (filtered.length === 0) {
      setSelected(null);
    }
  }, [filtered, selected]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      total:     drafts.length,
      thisMonth: drafts.filter(d => d.created.startsWith(currentMonthPrefix)).length,
      pending:   drafts.filter(d => d.status === 'review').length,
      ready:     drafts.filter(d => d.status === 'approved').length,
    };
  }, [drafts]);

  const handleGenerate = (templateId: string) => {
    setGenerating(templateId);
    setTimeout(() => setGenerating(null), 1800);
  };

  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('starred_drafts', JSON.stringify(next));
      return next;
    });
  };

  const handleExport = (url?: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#FAFAFA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 space-y-7">

        {/* ── Hero Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                AI Drafts
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Draft Management</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Generate, review, and export AI-assisted legal documents
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: '#F97316' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
          >
            <Plus className="h-4 w-4" /> New Draft
          </button>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: 'Total Drafts',       value: stats.total,    icon: FileText,   color: '#111827' },
            { label: 'Generated This Month', value: stats.thisMonth, icon: Sparkles,   color: '#F97316' },
            { label: 'Pending Review',     value: stats.pending,  icon: Clock,      color: '#F59E0B' },
            { label: 'Ready to Export',    value: stats.ready,    icon: CheckCircle, color: '#22C55E' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 + i * 0.05 }}
              className="rounded-xl p-5 transition-all"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <s.icon className="h-4 w-4" style={{ color: s.color }} strokeWidth={2} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: '#9CA3AF' }}>
                  {s.label}
                </span>
              </div>
              <p className="text-3xl font-bold" style={{ color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                {String(s.value).padStart(2, '0')}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Template Generator Grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: '#F97316' }} />
              <h2 className="text-sm font-semibold text-gray-900">AI Template Generator</h2>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              Click any template to generate a draft instantly
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y" style={{ borderColor: '#E5E7EB' }}>
            {TEMPLATES.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.12 + i * 0.04 }}
                onClick={() => handleGenerate(t.id)}
                className="relative flex flex-col items-start gap-2 p-5 text-left transition-all group"
                style={{ background: generating === t.id ? '#FFF7ED' : 'transparent' }}
                onMouseEnter={e => {
                  if (generating !== t.id) (e.currentTarget as HTMLElement).style.background = '#FAFAFA';
                }}
                onMouseLeave={e => {
                  if (generating !== t.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: generating === t.id ? '#FED7AA' : '#F3F4F6',
                  }}
                >
                  {generating === t.id ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="h-4 w-4" style={{ color: '#F97316' }} />
                    </motion.div>
                  ) : (
                    <t.icon className="h-4 w-4" style={{ color: '#6B7280' }} strokeWidth={1.8} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">{t.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{t.count} generated</p>
                </div>
                <ArrowUpRight
                  className="h-3 w-3 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#9CA3AF' }}
                />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Drafts Table + Preview Drawer ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="flex gap-5"
        >
          {/* Table */}
          <div
            className="flex-1 min-w-0 rounded-xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
          >
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#F3F4F6' }}>
                <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Search drafts…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent outline-none text-sm flex-1 placeholder-gray-400 text-gray-900"
                />
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'draft', 'review', 'approved', 'exported'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                    style={filterStatus === s ? {
                      background: '#111827', color: '#FFFFFF',
                    } : {
                      background: 'transparent', color: '#6B7280',
                    }}
                    onMouseEnter={e => {
                      if (filterStatus !== s) (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                    }}
                    onMouseLeave={e => {
                      if (filterStatus !== s) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div
              className="grid gap-4 px-4 py-2.5"
              style={{
                gridTemplateColumns: '1fr 110px 100px 90px 80px',
                borderBottom: '1px solid #F3F4F6',
              }}
            >
              {['Draft Name', 'Case', 'Created', 'Status', 'Actions'].map(h => (
                <span key={h} className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: '#F9FAFB' }}>
              <AnimatePresence>
                {filtered.map((d, i) => {
                  const cfg = STATUS_CONFIG[d.status];
                  const isActive = selected?.id === d.id;
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelected(isActive ? null : d)}
                      className="grid gap-4 px-4 py-3.5 items-center cursor-pointer transition-all"
                      style={{
                        gridTemplateColumns: '1fr 110px 100px 90px 80px',
                        background: isActive ? '#FFFBF7' : 'transparent',
                        borderLeft: isActive ? '2px solid #F97316' : '2px solid transparent',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.background = '#FAFAFA';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      {/* Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={e => { e.stopPropagation(); toggleStar(d.id); }}
                          className="flex-shrink-0"
                        >
                          <Star
                            className="h-3.5 w-3.5 transition-colors"
                            style={{ color: d.starred ? '#F59E0B' : '#D1D5DB', fill: d.starred ? '#F59E0B' : 'none' }}
                          />
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
                            {d.type} · {d.wordCount.toLocaleString()} words
                          </p>
                        </div>
                      </div>
                      {/* Case */}
                      <span
                        className="text-[10px] font-mono font-semibold px-2 py-1 rounded w-fit"
                        style={{ background: '#F3F4F6', color: '#6B7280' }}
                      >
                        {d.caseId}
                      </span>
                      {/* Created */}
                      <span className="text-xs" style={{ color: '#6B7280' }}>{fmt(d.created)}</span>
                      {/* Status */}
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                        {cfg.label}
                      </span>
                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#9CA3AF' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                            (e.currentTarget as HTMLElement).style.color = '#111827';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#9CA3AF' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                            (e.currentTarget as HTMLElement).style.color = '#111827';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
                          }}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {filtered.length === 0 && (
                <div className="py-12 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                  <p className="text-sm font-medium text-gray-500">No drafts found</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Try adjusting your search or filter</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Preview Drawer ── */}
          <AnimatePresence>
            {selected && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 320 }}
                exit={{ opacity: 0, x: 20, width: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex-shrink-0 rounded-xl overflow-hidden flex flex-col"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  width: 320,
                  maxHeight: 600,
                }}
              >
                {/* Drawer header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
                    <span className="text-xs font-semibold text-gray-900">Preview</span>
                  </div>
                  <button onClick={() => setSelected(null)}>
                    <X className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                  </button>
                </div>

                {/* Meta */}
                <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <p className="text-xs font-semibold text-gray-900 leading-snug">{selected.name}</p>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: STATUS_CONFIG[selected.status].bg, color: STATUS_CONFIG[selected.status].text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG[selected.status].dot }} />
                      {STATUS_CONFIG[selected.status].label}
                    </span>
                    <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                      {selected.wordCount.toLocaleString()} words
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {[
                      { label: 'Case', value: selected.caseId },
                      { label: 'Type', value: selected.type },
                      { label: 'Created', value: fmt(selected.created) },
                      { label: 'Modified', value: fmt(selected.modified) },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{item.label}</p>
                        <p className="text-[11px] font-medium text-gray-700 mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview text */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <pre
                    className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono"
                    style={{ color: '#374151' }}
                  >
                    {selected.preview}
                  </pre>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid #E5E7EB' }}>
                  <button
                    onClick={() => handleExport(selected.downloadURL)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#F97316' }}
                    disabled={!selected.downloadURL}
                    onMouseEnter={e => { if (selected.downloadURL) (e.currentTarget as HTMLElement).style.background = '#EA580C'; }}
                    onMouseLeave={e => { if (selected.downloadURL) (e.currentTarget as HTMLElement).style.background = '#F97316'; }}
                  >
                    <Download className="h-4 w-4" /> Export PDF
                  </button>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: '#F3F4F6', color: '#374151' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: '#F3F4F6', color: '#374151' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}