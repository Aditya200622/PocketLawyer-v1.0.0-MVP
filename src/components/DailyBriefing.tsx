import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, Clock, AlertCircle, CheckCircle2,
  ChevronRight, Zap, Scale, TrendingUp
} from 'lucide-react';

type CaseStatus = 'active' | 'pending' | 'closed' | 'hearing';
type CasePriority = 'high' | 'medium' | 'low';

interface Case {
  id: string;
  title: string;
  client: string;
  type: string;
  court: string;
  status: CaseStatus;
  date: string;
  nextHearing?: string;
  priority: CasePriority;
}

interface DailyBriefingProps {
  cases: Case[];
  lawyerName: string;
  onNavigate: (tab: 'overview' | 'my-cases' | 'evidence' | 'ai-assistant') => void;
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

const daysUntil = (dateStr: string) => {
  const diff = Math.ceil(
    (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff}d`;
};

export const DailyBriefing: React.FC<DailyBriefingProps> = ({ cases, lawyerName, onNavigate }) => {
  const [dismissed, setDismissed] = useState(false);

  const upcomingHearings = cases
    .filter(c => c.nextHearing)
    .sort((a, b) => new Date(a.nextHearing!).getTime() - new Date(b.nextHearing!).getTime())
    .slice(0, 3);

  const highPriority = cases.filter(c => c.priority === 'high' && c.status !== 'closed');
  const activeCases = cases.filter(c => c.status === 'active' || c.status === 'hearing');

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl overflow-hidden"
      style={{
        background: '#0A0A0A',
        border: '1px solid #1A1A1A',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid #1A1A1A' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#1A1A1A' }}
          >
            <Zap className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Daily Briefing</p>
            <p className="text-[11px]" style={{ color: '#525252' }}>{today}</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[11px] font-medium transition-colors"
          style={{ color: '#525252' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#737373')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#525252')}
        >
          Dismiss
        </button>
      </div>

      {/* Greeting */}
      <div className="px-6 py-5">
        <h2 className="text-lg font-semibold text-white mb-0.5">
          {getGreeting()}, {lawyerName.replace(/^Adv\.\s*/i, '')}
        </h2>
        <p className="text-sm" style={{ color: '#525252' }}>
          {activeCases.length > 0
            ? `You have ${activeCases.length} active case${activeCases.length > 1 ? 's' : ''} and ${upcomingHearings.length} upcoming hearing${upcomingHearings.length !== 1 ? 's' : ''} on the docket.`
            : 'Your workspace is clear. A good day to file.'}
        </p>
      </div>

      {/* Metrics row */}
      <div
        className="grid grid-cols-3 divide-x"
        style={{ borderTop: '1px solid #1A1A1A', borderBottom: '1px solid #1A1A1A', borderColor: '#1A1A1A' }}
      >
        {[
          { label: 'Active', value: activeCases.length, icon: TrendingUp, color: '#22C55E' },
          { label: 'Hearings', value: upcomingHearings.length, icon: Calendar, color: '#F97316' },
          { label: 'High Priority', value: highPriority.length, icon: AlertCircle, color: '#F59E0B' },
        ].map(stat => (
          <div key={stat.label} className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <stat.icon className="h-3 w-3 flex-shrink-0" style={{ color: stat.color }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#525252' }}>
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {String(stat.value).padStart(2, '0')}
            </p>
          </div>
        ))}
      </div>

      {/* Upcoming hearings */}
      {upcomingHearings.length > 0 && (
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#525252' }}>
            Next Hearings
          </p>
          <div className="space-y-2">
            {upcomingHearings.map((c, idx) => {
              const label = daysUntil(c.nextHearing!);
              const isUrgent = label === 'Today' || label === 'Tomorrow';
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="flex items-center gap-3 rounded-lg px-3.5 py-3 cursor-pointer transition-all"
                  style={{ background: '#111111' }}
                  onClick={() => onNavigate('my-cases')}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#161616')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#111111')}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isUrgent ? '#1C1207' : '#1A1A1A' }}
                  >
                    <Clock
                      className="h-3.5 w-3.5"
                      style={{ color: isUrgent ? '#F97316' : '#525252' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{c.title}</p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: '#525252' }}>
                      {c.court}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded"
                      style={{
                        background: isUrgent ? '#1C1207' : '#1A1A1A',
                        color: isUrgent ? '#F97316' : '#737373',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => onNavigate('ai-assistant')}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          style={{ background: '#F97316', color: '#FFFFFF' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.9')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
        >
          <Scale className="h-3.5 w-3.5" />
          Ask AI Assistant
        </button>
        <button
          onClick={() => onNavigate('my-cases')}
          className="flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all"
          style={{ background: '#1A1A1A', color: '#A3A3A3', border: '1px solid #262626' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#222222';
            (e.currentTarget as HTMLElement).style.color = '#D4D4D4';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = '#1A1A1A';
            (e.currentTarget as HTMLElement).style.color = '#A3A3A3';
          }}
        >
          View all cases
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
};