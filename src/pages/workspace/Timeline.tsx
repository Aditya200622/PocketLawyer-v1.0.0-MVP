import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History, Filter, FileText, Shield, BookOpen, Brain, FileSignature,
  CalendarDays, Gavel, UserCog, X, Paperclip, ClipboardList,
  Activity, Sparkles, ChevronRight,
} from 'lucide-react';
import { subscribeToCases, CaseDocument } from '../../services/caseService';
import { subscribeHearings, Hearing } from '../../services/hearingService';
import { subscribeToEvidenceByUser, EvidenceRecord } from '../../services/evidenceService';
import { db } from '../../firebase';
import { auth } from '../../auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

// ── Types ────────────────────────────────────────────────────────────────
type EventType = 'case' | 'evidence' | 'research' | 'ai' | 'draft' | 'hearing' | 'order' | 'client';
type FilterId = 'all' | 'documents' | 'evidence' | 'research' | 'hearings' | 'ai';

interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  relatedFiles?: string[];
  relatedEvidence?: string[];
  notes?: string;
  rawDate: Date;
}

const TYPE_META: Record<EventType, { icon: React.ElementType; bg: string; fg: string; label: string }> = {
  case:     { icon: ClipboardList,  bg: '#F3F4F6', fg: '#374151', label: 'Case' },
  evidence: { icon: Shield,         bg: '#EFF6FF', fg: '#1D4ED8', label: 'Evidence' },
  research: { icon: BookOpen,       bg: '#F5F3FF', fg: '#7C3AED', label: 'Research' },
  ai:       { icon: Brain,          bg: '#FFF7ED', fg: '#F97316', label: 'AI Activity' },
  draft:    { icon: FileSignature,  bg: '#FDF2F8', fg: '#DB2777', label: 'Draft' },
  hearing:  { icon: Gavel,          bg: '#FFFBEB', fg: '#B45309', label: 'Hearing' },
  order:    { icon: FileText,       bg: '#F0FDF4', fg: '#15803D', label: 'Order' },
  client:   { icon: UserCog,        bg: '#F9FAFB', fg: '#6B7280', label: 'Client' },
};

const FILTER_MAP: Record<FilterId, EventType[] | 'all'> = {
  all: 'all',
  documents: ['draft', 'order'],
  evidence: ['evidence'],
  research: ['research'],
  hearings: ['hearing', 'case'],
  ai: ['ai'],
};

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'research', label: 'Research' },
  { id: 'hearings', label: 'Hearings' },
  { id: 'ai', label: 'AI Activity' },
];

const formatEventTimestamp = (timestamp: any): string => {
  if (!timestamp) return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · 12:00 AM';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
  
  const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  
  return `${dateStr} · ${timeStr}`;
};

const getRawDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  return timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
};

// ── Component ────────────────────────────────────────────────────────────
export const Timeline: React.FC = () => {
  const [filter, setFilter] = useState<FilterId>('all');
  const [selected, setSelected] = useState<TimelineEvent | null>(null);

  const [cases, setCases] = useState<CaseDocument[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [researchSessions, setResearchSessions] = useState<any[]>([]);
  const [aiChats, setAiChats] = useState<any[]>([]);

  // 1. Subscribe to cases
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const unsub = subscribeToCases(
      userId,
      (docs) => setCases(docs),
      (err) => console.error('Timeline cases error:', err)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // 2. Subscribe to hearings
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const unsub = subscribeHearings(
      userId,
      (data) => setHearings(data),
      (err) => console.error('Timeline hearings error:', err)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // 3. Subscribe to evidence
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const unsub = subscribeToEvidenceByUser(
      userId,
      (data) => setEvidence(data),
      (err) => console.error('Timeline evidence error:', err)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // 4. Subscribe to documents
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const q = query(
      collection(db, 'documents'),
      where('userId', '==', userId),
      orderBy('uploadedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setDocuments(docs);
      },
      (err) => console.error('Timeline documents error:', err)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // 5. Subscribe to research sessions
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const q = query(
      collection(db, 'researchSessions'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setResearchSessions(sessions);
      },
      (err) => console.error('Timeline research error:', err)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // 6. Subscribe to AI Chats
  useEffect(() => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const q = query(
      collection(db, 'aiChats'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const chats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAiChats(chats);
      },
      (err) => console.error('Timeline AI chats error:', err)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Construct consolidated events list
  const EVENTS = useMemo(() => {
    const list: TimelineEvent[] = [];

    // Cases
    cases.forEach((c) => {
      list.push({
        id: `case-${c.id}`,
        type: 'case',
        title: 'Case Created',
        description: `New case "${c.title}" registered under ${c.caseType || 'General Law'}.`,
        timestamp: formatEventTimestamp(c.createdAt),
        actor: c.createdBy || 'Advocate',
        rawDate: getRawDate(c.createdAt),
        notes: c.description || undefined,
      });

      if (c.updatedAt && c.createdAt && getRawDate(c.updatedAt).getTime() - getRawDate(c.createdAt).getTime() > 2000) {
        list.push({
          id: `case-update-${c.id}`,
          type: 'case',
          title: 'Case Updated',
          description: `Case "${c.title}" details updated.`,
          timestamp: formatEventTimestamp(c.updatedAt),
          actor: c.createdBy || 'Advocate',
          rawDate: getRawDate(c.updatedAt),
        });
      }
    });

    // Hearings
    hearings.forEach((h) => {
      list.push({
        id: `hearing-${h.hearingId}`,
        type: 'hearing',
        title: 'Hearing Scheduled',
        description: `Bail hearing scheduled at ${h.courtName} room ${h.courtRoom} before Judge ${h.judgeName}. Purpose: ${h.purpose}.`,
        timestamp: formatEventTimestamp(h.createdAt),
        actor: h.createdBy || 'Court Official',
        rawDate: getRawDate(h.createdAt),
        notes: h.remarks || undefined,
      });
    });

    // Evidence
    evidence.forEach((ev) => {
      list.push({
        id: `evidence-${ev.evidenceId}`,
        type: 'evidence',
        title: 'Evidence Uploaded',
        description: `Evidence document "${ev.name}.${ev.extension}" uploaded under folder ${ev.folder}.`,
        timestamp: formatEventTimestamp(ev.createdAt),
        actor: ev.uploadedBy || 'Advocate',
        rawDate: getRawDate(ev.createdAt),
        relatedEvidence: [`${ev.name}.${ev.extension}`],
      });
    });

    // Documents
    documents.forEach((doc) => {
      const type = doc.originalName?.toLowerCase().includes('order') ? 'order' : 'draft';
      list.push({
        id: `doc-${doc.id}`,
        type,
        title: type === 'order' ? 'Court Order Uploaded' : 'Draft Created',
        description: `${type === 'order' ? 'Court order' : 'Legal draft'} "${doc.originalName || doc.fileName}" uploaded to case files.`,
        timestamp: formatEventTimestamp(doc.uploadedAt),
        actor: doc.uploadedBy || 'System',
        rawDate: getRawDate(doc.uploadedAt),
        relatedFiles: [doc.originalName || doc.fileName],
      });
    });

    // Research
    researchSessions.forEach((r) => {
      list.push({
        id: `research-${r.id}`,
        type: 'research',
        title: 'Research Saved',
        description: `Saved precedent research: "${r.title || r.prompt}" to Research Vault.`,
        timestamp: formatEventTimestamp(r.createdAt),
        actor: 'Research Copilot',
        rawDate: getRawDate(r.createdAt),
        notes: r.response ? 'Research response generated successfully.' : undefined,
      });
    });

    // AI summary events from Case Summaries
    cases.forEach((c) => {
      if (c.aiSummaryGenerated || c.aiStatus === 'completed') {
        list.push({
          id: `ai-summary-${c.id}`,
          type: 'ai',
          title: 'AI Summary Generated',
          description: `Case summary and risk factors updated for "${c.title}".`,
          timestamp: formatEventTimestamp(c.updatedAt),
          actor: 'AI Lawyer',
          rawDate: getRawDate(c.updatedAt),
          notes: c.aiSummary || undefined,
        });
      }
    });

    // Sort chronologically descending
    return list.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [cases, hearings, evidence, documents, researchSessions]);

  const filtered = useMemo(() => {
    const allowed = FILTER_MAP[filter];
    return allowed === 'all' ? EVENTS : EVENTS.filter(e => allowed.includes(e.type));
  }, [EVENTS, filter]);

  // Sync default selection
  useEffect(() => {
    if (filtered.length > 0 && (!selected || !filtered.some(e => e.id === selected.id))) {
      setSelected(filtered[0]);
    } else if (filtered.length === 0) {
      setSelected(null);
    }
  }, [filtered, selected]);

  const analytics = useMemo(() => {
    return {
      total: EVENTS.length,
      documents: EVENTS.filter(e => e.type === 'draft' || e.type === 'order').length,
      evidence: EVENTS.filter(e => e.type === 'evidence').length,
      ai: EVENTS.filter(e => e.type === 'ai').length,
    };
  }, [EVENTS]);

  const ANALYTICS_CARDS = [
    { label: 'Total Activities', value: analytics.total, icon: Activity, color: '#111827' },
    { label: 'Documents Added', value: analytics.documents, icon: FileText, color: '#DB2777' },
    { label: 'Evidence Added', value: analytics.evidence, icon: Shield, color: '#1D4ED8' },
    { label: 'AI Actions', value: analytics.ai, icon: Sparkles, color: '#F97316' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl p-6 sm:p-8"
        style={{ background: '#0A0A0A' }}
      >
        <div
          className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[11px] font-semibold mb-3"
          style={{ background: '#1A1A1A', color: '#F97316', border: '1px solid #2A2A2A' }}
        >
          <History className="h-3 w-3" /> Case Activity Timeline
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Activity Timeline</h1>
        <p className="text-sm mt-1.5 max-w-md" style={{ color: '#737373' }}>
          A complete chronological record of every action across your case files.
        </p>
      </motion.div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ANALYTICS_CARDS.map((s, idx) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="rounded-xl p-5"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <s.icon className="h-4 w-4" style={{ color: s.color }} strokeWidth={2} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{s.label}</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
              {String(s.value).padStart(2, '0')}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <Filter className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all"
            style={filter === f.id ? { background: '#0A0A0A', color: '#FFFFFF' } : { background: '#FFFFFF', color: '#6B7280', border: '1px solid #E5E7EB' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">
        {/* Vertical Timeline */}
        <div
          className="rounded-xl p-6 sm:p-8"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
        >
          <div className="relative">
            {/* Growth line */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: '100%' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-[19px] top-2 w-px"
              style={{ background: '#E5E7EB' }}
            />

            <div className="space-y-6">
              {filtered.map((e, idx) => {
                const meta = TYPE_META[e.type];
                const active = selected?.id === e.id;
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.07, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setSelected(e)}
                    className="relative flex items-start gap-4 cursor-pointer group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10 transition-all"
                      style={{
                        background: active ? meta.fg : meta.bg,
                        boxShadow: active ? `0 0 0 4px ${meta.fg}22` : 'none',
                      }}
                    >
                      <meta.icon className="h-4.5 w-4.5" style={{ color: active ? '#FFFFFF' : meta.fg }} />
                    </div>

                    <div
                      className="flex-1 min-w-0 rounded-xl p-4 transition-all"
                      style={{
                        background: active ? '#FFF7ED' : 'transparent',
                        border: active ? '1px solid #FED7AA' : '1px solid transparent',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{e.title}</h3>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: meta.bg, color: meta.fg }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#6B7280' }}>{e.description}</p>
                      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                        <span className="text-[11px] font-medium" style={{ color: '#9CA3AF' }}>{e.timestamp}</span>
                        <span className="text-[11px]" style={{ color: '#D1D5DB' }}>•</span>
                        <span className="text-[11px] font-medium" style={{ color: '#6B7280' }}>{e.actor}</span>
                      </div>
                    </div>

                    <ChevronRight
                      className="h-4 w-4 flex-shrink-0 mt-3 transition-transform group-hover:translate-x-0.5"
                      style={{ color: '#D1D5DB' }}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No activity in this category</p>
            </div>
          )}
        </div>

        {/* Activity Inspector */}
        <div className="xl:sticky xl:top-4">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl overflow-hidden"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
              >
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <h3 className="text-sm font-semibold text-gray-900">Activity Inspector</h3>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: '#9CA3AF', background: '#F3F4F6' }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: TYPE_META[selected.type].bg }}
                    >
                      {React.createElement(TYPE_META[selected.type].icon, { className: 'h-4.5 w-4.5', style: { color: TYPE_META[selected.type].fg } })}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selected.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{selected.timestamp}</p>
                    </div>
                  </div>

                  <div className="rounded-lg p-3" style={{ background: '#FAFAFA', border: '1px solid #F3F4F6' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>Full Details</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{selected.description}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>Actor</p>
                    <p className="text-sm text-gray-900">{selected.actor}</p>
                  </div>

                  {selected.relatedFiles && selected.relatedFiles.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Related Files</p>
                      <div className="space-y-1.5">
                        {selected.relatedFiles.map(f => (
                          <div key={f} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#FAFAFA' }}>
                            <FileText className="h-3 w-3 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                            <span className="text-xs text-gray-700 truncate">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.relatedEvidence && selected.relatedEvidence.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Related Evidence</p>
                      <div className="space-y-1.5">
                        {selected.relatedEvidence.map(f => (
                          <div key={f} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#FAFAFA' }}>
                            <Paperclip className="h-3 w-3 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                            <span className="text-xs text-gray-700 truncate">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.notes && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>Notes</p>
                      <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{selected.notes}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="rounded-xl p-8 text-center" style={{ background: '#FFFFFF', border: '1px dashed #E5E7EB' }}>
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Select an activity to inspect</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Timeline;