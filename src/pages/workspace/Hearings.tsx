import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeHearings, Hearing as ServiceHearing, createHearing, updateHearing, deleteHearing } from '../../services/hearingService';
import { auth } from '../../firebase';
import { useEffect } from 'react';

import {
  Calendar, Clock, Plus, Download, Filter,
  MapPin, User, Scale, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, Hash, Paperclip,
  X, Gavel, UserCheck, FileText, Bell, Search
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Hearing {
  id: string;
  caseId: string;
  caseTitle: string;
  client: string;
  court: string;
  judge: string;
  date: string;
  time: string;
  type: string;
  notes: string;
  attachments: string[];
  status: 'upcoming' | 'today' | 'completed' | 'adjourned';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const daysUntil = (dateStr: string): number => {
  const todayStr = new Date().toISOString().split('T')[0];
  const diff = Math.ceil((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000);
  return diff;
};

const urgencyConfig = (dateStr: string, status: string) => {
  if (status === 'completed') return { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#D1FAE5', badge: 'Completed' };
  if (status === 'adjourned') return { bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF', border: '#E5E7EB', badge: 'Adjourned' };
  const d = daysUntil(dateStr);
  if (d === 0) return { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316', border: '#FED7AA', badge: 'Today' };
  if (d <= 3)  return { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444', border: '#FECACA', badge: `${d}d` };
  if (d <= 7)  return { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B', border: '#FDE68A', badge: `${d}d` };
  return         { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0', badge: `${d}d` };
};

const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric'
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Hearings() {
  const [hearings, setHearings]                 = useState<Hearing[]>([]);
  const [selected, setSelected]                 = useState<Hearing | null>(null);
  const [filterStatus, setFilterStatus]         = useState<string>('all');
  const [search, setSearch]                     = useState('');
  const [calYear,  setCalYear]                  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]                 = useState(new Date().getMonth());

  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid || 'anonymous';
    const unsub = subscribeHearings(userId, (serviceHearings) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const mapped: Hearing[] = serviceHearings.map(h => {
        let st: 'upcoming' | 'today' | 'completed' | 'adjourned' = 'upcoming';
        if (h.status === 'completed') st = 'completed';
        else if (h.status === 'adjourned') st = 'adjourned';
        else if (h.hearingDate === todayStr) st = 'today';

        return {
          id: h.hearingId,
          caseId: h.caseId || 'UNKNOWN',
          caseTitle: h.caseNumber || 'Unknown Case',
          client: 'Unknown Client',
          court: h.courtName || 'Unknown Court',
          judge: h.judgeName || 'Unknown Judge',
          date: h.hearingDate,
          time: h.hearingTime || '00:00',
          type: h.purpose || 'Hearing',
          notes: h.remarks || '',
          attachments: [],
          status: st,
        };
      });
      setHearings(mapped);
      if (mapped.length > 0 && !selected) setSelected(mapped[0]);
    });
    return () => unsub();
  }, []);

  const filtered = hearings.filter(h => {
    const matchSearch = h.caseTitle.toLowerCase().includes(search.toLowerCase()) ||
                        h.client.toLowerCase().includes(search.toLowerCase()) ||
                        h.court.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || h.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const todayHearings  = hearings.filter(h => h.date === new Date().toISOString().split('T')[0]).length;
  const weekHearings   = hearings.filter(h => { const d = daysUntil(h.date); return d >= 0 && d <= 7; }).length;
  const urgentHearings = hearings.filter(h => { const d = daysUntil(h.date); return d >= 0 && d <= 3; }).length;
  const completed      = hearings.filter(h => h.status === 'completed').length;

  // Calendar grid
  const firstDay     = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
  const hearingDates = new Set(hearings.map(h => h.date));

  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: ds, day: d });
  }

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };

  return (
    <div className="min-h-screen" style={{ background: '#FAFAFA', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 space-y-7">

        {/* ── Hero Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
              Court Management
            </span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">Hearings</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Track and manage all court dates across your active cases
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#374151' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F9FAFB')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#FFFFFF')}
            >
              <Download className="h-4 w-4" /> Export Calendar
            </button>
            <button
              onClick={() => {
                const user = auth.currentUser;
                createHearing({
                  caseId: "C00" + Math.floor(Math.random() * 10), caseNumber: "DUMMY/123", courtName: "High Court",
                  judgeName: "Hon'ble Judge", courtRoom: "Room 1", hearingDate: new Date().toISOString().split('T')[0],
                  hearingTime: "10:00", nextHearingDate: "", nextHearingTime: "", purpose: "New Hearing",
                  status: "scheduled", remarks: "Dummy", createdBy: user?.displayName || "System", userId: user?.uid || "anonymous"
                }).catch(console.error);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: '#F97316' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
            >
              <Plus className="h-4 w-4" /> Schedule Hearing
            </button>
          </div>
        </motion.div>

        {/* ── Summary Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: 'Today',     value: todayHearings,  icon: Clock,        color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
            { label: 'This Week', value: weekHearings,   icon: Calendar,     color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
            { label: 'Urgent',    value: urgentHearings, icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
            { label: 'Completed', value: completed,      icon: CheckCircle,  color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.05 }}
              className="rounded-xl p-5 transition-all"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <s.icon className="h-4 w-4" style={{ color: s.color }} strokeWidth={2} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                  {s.label}
                </span>
              </div>
              <p className="text-3xl font-bold" style={{ color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                {String(s.value).padStart(2, '0')}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Main Content ── */}
        <div className="flex gap-5">

          {/* ── Left: Hearings List + Calendar ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Search + Filter */}
            <div className="flex items-center gap-3">
              <div
                className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
              >
                <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Search hearings…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent outline-none text-sm flex-1 placeholder-gray-400 text-gray-900"
                />
              </div>
              <div
                className="flex items-center gap-1 p-1 rounded-xl"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
              >
                {[
                  { key: 'all',       label: 'All'       },
                  { key: 'upcoming',  label: 'Upcoming'  },
                  { key: 'today',     label: 'Today'     },
                  { key: 'completed', label: 'Completed' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilterStatus(f.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={filterStatus === f.key ? {
                      background: '#111827', color: '#FFFFFF'
                    } : { color: '#6B7280' }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hearing Cards */}
            <div className="space-y-3">
              <AnimatePresence>
                {filtered.map((h, i) => {
                  const urg = urgencyConfig(h.date, h.status);
                  const isActive = selected?.id === h.id;
                  return (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelected(isActive ? null : h)}
                      className="rounded-xl p-5 cursor-pointer transition-all"
                      style={{
                        background: '#FFFFFF',
                        border: isActive ? `1px solid ${urg.border}` : '1px solid #E5E7EB',
                        boxShadow: isActive ? `0 4px 16px ${urg.dot}22` : '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                      }}
                    >
                      <div className="flex items-start gap-4">
                        {/* Date block */}
                        <div
                          className="flex-shrink-0 w-14 rounded-xl overflow-hidden text-center"
                          style={{ border: `1px solid ${urg.border}` }}
                        >
                          <div className="py-1" style={{ background: urg.bg }}>
                            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: urg.text }}>
                              {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}
                            </p>
                          </div>
                          <div className="py-1.5" style={{ background: '#FFFFFF' }}>
                            <p className="text-xl font-bold" style={{ color: '#111827', lineHeight: 1 }}>
                              {new Date(h.date + 'T00:00:00').getDate()}
                            </p>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span
                                  className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: '#F3F4F6', color: '#6B7280' }}
                                >
                                  {h.caseId}
                                </span>
                                <h3 className="text-sm font-semibold text-gray-900 truncate">{h.caseTitle}</h3>
                              </div>
                              <p className="text-xs" style={{ color: '#6B7280' }}>{h.client}</p>
                            </div>
                            <span
                              className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                              style={{ background: urg.bg, color: urg.text }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: urg.dot }} />
                              {urg.badge}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                            <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                              <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                              {h.court}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                              <Clock className="h-3 w-3 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                              {h.time}
                            </span>
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded"
                              style={{ background: '#F3F4F6', color: '#6B7280' }}
                            >
                              {h.type}
                            </span>
                          </div>

                          <p className="text-xs mt-2 line-clamp-2" style={{ color: '#9CA3AF' }}>
                            <span className="font-medium" style={{ color: '#6B7280' }}>Judge: </span>
                            {h.judge}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filtered.length === 0 && (
                <div
                  className="rounded-xl py-12 text-center"
                  style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
                >
                  <Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                  <p className="text-sm font-medium text-gray-500">No hearings found</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Schedule one with the button above</p>
                </div>
              )}
            </div>

            {/* Calendar */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid #E5E7EB' }}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" style={{ color: '#F97316' }} />
                  <h2 className="text-sm font-semibold text-gray-900">Monthly View</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={prevMonth}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <ChevronLeft className="h-4 w-4" style={{ color: '#6B7280' }} />
                  </button>
                  <span className="text-sm font-semibold text-gray-900 min-w-[130px] text-center">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </span>
                  <button
                    onClick={nextMonth}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <ChevronRight className="h-4 w-4" style={{ color: '#6B7280' }} />
                  </button>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="grid grid-cols-7 mb-2">
                  {DAYS_SHORT.map(d => (
                    <div key={d} className="text-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{d}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell, idx) => {
                    if (!cell.date || !cell.day) return <div key={`e-${idx}`} />;
                    const isToday   = cell.date === new Date().toISOString().split('T')[0];
                    const hasHearing = hearingDates.has(cell.date);
                    const hearingsOnDay = hearings.filter(h => h.date === cell.date);
                    const mostUrgent = hearingsOnDay.length > 0
                      ? urgencyConfig(hearingsOnDay[0].date, hearingsOnDay[0].status)
                      : null;
                    return (
                      <button
                        key={cell.date}
                        className="flex flex-col items-center py-2 rounded-lg transition-all"
                        style={{
                          background: isToday ? '#F97316' : 'transparent',
                          cursor: hasHearing ? 'pointer' : 'default',
                        }}
                        onMouseEnter={e => {
                          if (!isToday) (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                        }}
                        onMouseLeave={e => {
                          if (!isToday) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: isToday ? '#FFFFFF' : hasHearing ? '#111827' : '#6B7280',
                            fontWeight: isToday || hasHearing ? 700 : 500,
                          }}
                        >
                          {cell.day}
                        </span>
                        {hasHearing && !isToday && (
                          <span
                            className="w-1.5 h-1.5 rounded-full mt-0.5"
                            style={{ background: mostUrgent?.dot || '#9CA3AF' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div
                className="flex items-center gap-4 px-5 py-3"
                style={{ borderTop: '1px solid #E5E7EB' }}
              >
                {[
                  { label: '0–3 days', color: '#EF4444' },
                  { label: '4–7 days', color: '#F59E0B' },
                  { label: '8+ days',  color: '#22C55E' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span className="text-[10px] font-medium" style={{ color: '#9CA3AF' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Detail Panel ── */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-8">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-xl overflow-hidden"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
                  >
                    {/* Panel header */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <span className="text-xs font-semibold text-gray-900">Hearing Details</span>
                      <button onClick={() => setSelected(null)}>
                        <X className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                      </button>
                    </div>

                    {/* Status pill */}
                    <div className="px-4 pt-4 pb-2">
                      {(() => {
                        const urg = urgencyConfig(selected.date, selected.status);
                        return (
                          <span
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                            style={{ background: urg.bg, color: urg.text }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: urg.dot }} />
                            {urg.badge === 'Today' ? 'Today' : urg.badge === 'Completed' ? 'Completed' : `In ${urg.badge}`}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Case title */}
                    <div className="px-4 pb-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug">{selected.caseTitle}</h3>
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{selected.type}</p>
                    </div>

                    {/* Fields */}
                    <div className="px-4 py-3 space-y-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                      {[
                        { icon: User,      label: 'Client',  value: selected.client  },
                        { icon: MapPin,    label: 'Court',   value: selected.court   },
                        { icon: Gavel,     label: 'Judge',   value: selected.judge   },
                        { icon: Calendar,  label: 'Date',    value: fmt(selected.date) },
                        { icon: Clock,     label: 'Time',    value: selected.time    },
                      ].map(f => (
                        <div key={f.label} className="flex items-start gap-2.5">
                          <f.icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#9CA3AF' }} />
                          <div className="min-w-0">
                            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{f.label}</p>
                            <p className="text-xs font-medium text-gray-900 mt-0.5 leading-snug">{f.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Notes</p>
                      <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>{selected.notes}</p>
                    </div>

                    {/* Attachments */}
                    {selected.attachments.length > 0 && (
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>
                          Attachments
                        </p>
                        <div className="space-y-1.5">
                          {selected.attachments.map(a => (
                            <div
                              key={a}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                            >
                              <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#F97316' }} />
                              <span className="text-xs truncate text-gray-700">{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-4 py-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (selected) updateHearing(selected.id, { purpose: selected.type + " (Updated)" }).catch(console.error);
                          }}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                          style={{ background: '#F3F4F6', color: '#374151' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (selected) {
                              deleteHearing(selected.id).catch(console.error);
                              setSelected(null);
                            }
                          }}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-all"
                          style={{ background: '#EF4444' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#DC2626')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#EF4444')}
                        >
                          Delete
                        </button>
                      </div>
                      <button
                        className="w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-all"
                        style={{ background: '#F97316' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
                      >
                        Set Reminder
                      </button>
                      <button
                        className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: '#F3F4F6', color: '#374151' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                      >
                        Export Details
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl p-8 text-center"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
                  >
                    <Gavel className="h-8 w-8 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                    <p className="text-sm font-medium text-gray-500">Select a hearing</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>to view full details</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}