import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  User,
  Calendar,
  ChevronDown,
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  PauseCircle,
} from 'lucide-react';

/**
 * CaseCard.tsx
 * Reusable case card — used across Overview, Timeline, and anywhere
 * a case needs to be rendered in a list or grid.
 *
 * Pure presentational component: no data fetching, no routing.
 * Local UI state only (expand/collapse).
 */

export interface Case {
  id: string;
  title: string;
  caseNumber: string;
  client: string;
  court: string;
  status: 'active' | 'pending' | 'closed' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  nextHearingDate?: string; // ISO date string
  summary?: string;
  tags?: string[];
}

export interface CaseCardProps {
  caseData: Case;
  onOpen?: (id: string) => void;
  onAskAI?: (id: string) => void;
  expanded?: boolean;
  isLoading?: boolean;
  className?: string;
}

const statusConfig: Record<
  Case['status'],
  { label: string; dot: string; text: string; bg: string; icon: typeof CheckCircle2 }
> = {
  active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  pending: { label: 'Pending', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', icon: Clock },
  closed: { label: 'Closed', dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100', icon: CheckCircle2 },
  'on-hold': { label: 'On Hold', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100', icon: PauseCircle },
};

const priorityConfig: Record<Case['priority'], { label: string; text: string; bg: string; border: string }> = {
  low: { label: 'Low', text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
  medium: { label: 'Medium', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  high: { label: 'High', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  urgent: { label: 'Urgent', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function formatHearingDate(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CaseCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[#E5E7EB] bg-white p-5 ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="mt-5 flex gap-2">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}

export default function CaseCard({
  caseData,
  onOpen,
  onAskAI,
  expanded: expandedProp,
  isLoading = false,
  className = '',
}: CaseCardProps) {
  const [expandedState, setExpandedState] = useState(expandedProp ?? false);
  const isExpanded = expandedProp ?? expandedState;

  if (isLoading) return <CaseCardSkeleton className={className} />;

  const status = statusConfig[caseData.status];
  const priority = priorityConfig[caseData.priority];
  const hearingDate = formatHearingDate(caseData.nextHearingDate);
  const StatusIcon = status.icon;

  const toggleExpanded = () => {
    if (expandedProp === undefined) setExpandedState((prev) => !prev);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={`group rounded-xl border border-[#E5E7EB] bg-white transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(17,24,39,0.06)] ${className}`}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium tracking-wide text-[#6B7280]">
              {caseData.caseNumber}
            </p>
            <h3 className="mt-0.5 truncate text-[18px] font-semibold text-[#111827]">
              {caseData.title}
            </h3>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${status.bg} ${status.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-[#6B7280]">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">{caseData.client}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">{caseData.court}</span>
          </div>
          {hearingDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{hearingDate}</span>
            </div>
          )}
        </div>

        {/* Priority + tags */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-medium ${priority.bg} ${priority.text} ${priority.border}`}
          >
            {(caseData.priority === 'high' || caseData.priority === 'urgent') && (
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
            )}
            {priority.label} priority
          </span>
          {caseData.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-gray-50 px-2 py-0.5 text-[12px] text-[#6B7280]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Expandable summary */}
        {caseData.summary && (
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="summary"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <p className="mt-4 text-[14px] leading-relaxed text-[#374151]">
                  {caseData.summary}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onOpen?.(caseData.id)}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-[13px] font-medium text-[#111827] transition-colors duration-150 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-1"
            >
              Open case
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onAskAI?.(caseData.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F97316] px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#EA6A0C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-1"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Ask AI
            </motion.button>
          </div>

          {caseData.summary && (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse case summary' : 'Expand case summary'}
              className="rounded-md p-1.5 text-[#6B7280] transition-colors duration-150 hover:bg-gray-50 hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
            >
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="block"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </motion.span>
            </button>
          )}
        </div>
      </div>

      {/* Subtle status icon hint, hidden by default, used only as a visual cue */}
      <StatusIcon className="hidden" aria-hidden="true" />
    </motion.div>
  );
}

/**
 * USAGE EXAMPLE — src/pages/workspace/Overview.tsx
 *
 * import CaseCard, { Case } from '@/components/CaseCard';
 *
 * const cases: Case[] = [
 *   {
 *     id: 'case-1021',
 *     title: 'Sharma vs. Northbridge Textiles',
 *     caseNumber: 'CASE-1021',
 *     client: 'R. Sharma',
 *     court: 'Lucknow District Court',
 *     status: 'active',
 *     priority: 'high',
 *     nextHearingDate: '2026-07-02',
 *     summary: 'Breach of contract dispute regarding delayed delivery of textile goods...',
 *     tags: ['Civil', 'Contract'],
 *   },
 * ];
 *
 * <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
 *   {cases.map((c) => (
 *     <CaseCard
 *       key={c.id}
 *       caseData={c}
 *       onOpen={(id) => navigateToCase(id)}
 *       onAskAI={(id) => openAiLawyerWithCase(id)}
 *     />
 *   ))}
 * </div>
 */