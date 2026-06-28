import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Hash, Clock, Gavel, MoreHorizontal,
  LayoutGrid, FileText, ShieldCheck, Brain
} from 'lucide-react';
import type { Case } from '../Cases';
import Overview from './Overview';
import Files from './Files';
import Evidence from './Evidence';

// ─── Types ───────────────────────────────────────────────────────────────────
type WorkspaceTab = 'overview' | 'files' | 'evidence';

interface CaseWorkspaceProps {
  caseData?: Case;
  onBack?: () => void;
  onAskAI?: () => void;
}

// ─── Mock default ────────────────────────────────────────────────────────────


const statusColor: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  closed: 'bg-gray-100 text-gray-500',
  hearing: 'bg-orange-50 text-orange-600',
};

const statusDot: Record<string, string> = {
  active: '#22C55E',
  pending: '#F59E0B',
  closed: '#9CA3AF',
  hearing: '#F97316',
};

const TABS: Array<{ id: WorkspaceTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'evidence', label: 'Evidence', icon: ShieldCheck },
];

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

// ─── Component ───────────────────────────────────────────────────────────────
const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({
  
  caseData,
  onBack,
  onAskAI,
}) => {
  console.log("CaseWorkspace Data:", caseData);
  if (!caseData) {
  return (
    <div className="flex h-full items-center justify-center">
      No Case Selected
    </div>
  );
}


  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const c = caseData;

  return (
    <div className="space-y-5">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors"
        style={{ color: '#9CA3AF' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#6B7280')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA3AF')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to cases
      </button>

      {/* Case header */}
      <div className="rounded-xl p-5 sm:p-6" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded flex items-center gap-1"
                style={{ background: '#F3F4F6', color: '#9CA3AF' }}
              >
                <Hash className="h-2.5 w-2.5" />
                {c.id}
              </span>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 ${statusColor[c.status]}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot[c.status] }} />
                {c.status}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 leading-tight">{c.title}</h1>
            <div className="flex items-center gap-4 mt-2.5 flex-wrap">
              <span className="text-xs font-medium text-gray-600">{c.client}</span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#9CA3AF' }}>
                <Gavel className="h-3 w-3" />
                {c.court}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onAskAI}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]"
              style={{ background: '#F97316' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
            >
              <Brain className="h-3.5 w-3.5" />
              Ask AI
            </button>
            <button
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280' }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Next hearing strip */}
        {c.nextHearing && (
          <div
            className="flex items-center gap-2.5 mt-4 px-4 py-3 rounded-lg"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
          >
            <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#F97316' }} />
            <span className="text-xs font-semibold" style={{ color: '#C2410C' }}>
              Next hearing: {formatDate(c.nextHearing)}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: '#F3F4F6' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all"
            style={tab === t.id
              ? { background: '#FFFFFF', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
              : { background: 'transparent', color: '#6B7280' }}
          >
            <t.icon className="h-3.5 w-3.5" style={{ color: tab === t.id ? '#F97316' : 'inherit' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'overview' && <Overview activeCase={c} />}
          {tab === 'files' && <Files caseTitle={c.title} caseId={c.id} />}
          {tab === 'evidence' && <Evidence caseTitle={c.title} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CaseWorkspace;