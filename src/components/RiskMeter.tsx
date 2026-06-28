import React from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp, ShieldAlert, FileWarning, ShieldCheck,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type RiskLevel = 'low' | 'medium' | 'high';
type Trend = 'up' | 'down' | 'flat';

export interface RiskMetrics {
  successProbability: number;
  riskLevel: RiskLevel;
  riskScore: number;
  evidenceStrength: number;
  missingDocuments: number;
  trend?: Trend;
  trendDelta?: number;
}

interface RiskMeterProps {
  metrics?: RiskMetrics;
  caseTitle?: string;
  compact?: boolean;
}

// ─── Mock data ───────────────────────────────────────────────────────────────
const DEFAULT_METRICS: RiskMetrics = {
  successProbability: 72,
  riskLevel: 'medium',
  riskScore: 58,
  evidenceStrength: 81,
  missingDocuments: 3,
  trend: 'up',
  trendDelta: 4,
};

const riskLevelStyle: Record<RiskLevel, { text: string; bg: string; border: string; label: string }> = {
  low: { text: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', label: 'Low Risk' },
  medium: { text: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Medium Risk' },
  high: { text: '#EF4444', bg: '#FEF2F2', border: '#FECACA', label: 'High Risk' },
};

const barColor = (score: number) => {
  if (score >= 70) return '#22C55E';
  if (score >= 45) return '#F59E0B';
  return '#EF4444';
};

const TrendIcon: Record<Trend, React.ElementType> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

const trendColor: Record<Trend, string> = {
  up: '#22C55E',
  down: '#EF4444',
  flat: '#9CA3AF',
};

// ─── Component ───────────────────────────────────────────────────────────────
const RiskMeter: React.FC<RiskMeterProps> = ({ metrics = DEFAULT_METRICS, caseTitle, compact = false }) => {
  const m = metrics;
  const risk = riskLevelStyle[m.riskLevel];
  const Trend = TrendIcon[m.trend ?? 'flat'];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FFF7ED' }}>
            <ShieldAlert className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Risk Meter</h3>
            {caseTitle && <p className="text-[11px] truncate max-w-[180px]" style={{ color: '#9CA3AF' }}>{caseTitle}</p>}
          </div>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: risk.bg, color: risk.text, border: `1px solid ${risk.border}` }}
        >
          {risk.label}
        </span>
      </div>

      {/* Success probability — hero stat */}
      <div className="px-5 py-5 flex items-center gap-5" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="relative flex-shrink-0" style={{ width: compact ? 64 : 80, height: compact ? 64 : 80 }}>
          <svg viewBox="0 0 100 100" className="-rotate-90" style={{ width: '100%', height: '100%' }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="#F3F4F6" strokeWidth="9" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              stroke={barColor(m.successProbability)}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - m.successProbability / 100) }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-900">{m.successProbability}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Success Probability</p>
          <p className="text-sm font-medium text-gray-700 mt-1">AI-estimated outcome likelihood</p>
          {m.trend && m.trendDelta !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <Trend className="h-3 w-3" style={{ color: trendColor[m.trend] }} />
              <span className="text-xs font-bold" style={{ color: trendColor[m.trend] }}>
                {m.trendDelta}% vs last week
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="px-5 py-4" style={{ borderRight: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3 w-3" style={{ color: '#9CA3AF' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Risk Score</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{m.riskScore}<span className="text-xs font-medium" style={{ color: '#D1D5DB' }}>/100</span></p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="h-3 w-3" style={{ color: '#9CA3AF' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Evidence</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{m.evidenceStrength}<span className="text-xs font-medium" style={{ color: '#D1D5DB' }}>/100</span></p>
        </div>
      </div>

      {/* Evidence strength bar */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Evidence strength</span>
          <span className="text-xs font-bold text-gray-900">{m.evidenceStrength}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: barColor(m.evidenceStrength) }}
            initial={{ width: 0 }}
            animate={{ width: `${m.evidenceStrength}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Missing documents */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: m.missingDocuments > 0 ? '#FFFBEB' : '#F0FDF4' }}
        >
          <FileWarning className="h-4 w-4" style={{ color: m.missingDocuments > 0 ? '#F59E0B' : '#22C55E' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900">
            {m.missingDocuments > 0 ? `${m.missingDocuments} document${m.missingDocuments > 1 ? 's' : ''} missing` : 'All documents complete'}
          </p>
          <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
            {m.missingDocuments > 0 ? 'Resolve before next hearing' : 'No outstanding items'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RiskMeter;