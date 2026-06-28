import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock } from 'lucide-react';

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

interface HearingCalendarProps {
  cases: Case[];
  onCaseClick?: (c: Case) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PRIORITY_DOT: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#6B7280',
};

export const HearingCalendar: React.FC<HearingCalendarProps> = ({ cases, onCaseClick }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build hearing map: date-string → Case[]
  const hearingMap: Record<string, Case[]> = {};
  cases.forEach(c => {
    if (c.nextHearing) {
      hearingMap[c.nextHearing] = hearingMap[c.nextHearing] || [];
      hearingMap[c.nextHearing].push(c);
    }
  });

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dateStr, day: d });
  }

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  const selectedCases = selectedDate ? (hearingMap[selectedDate] || []) : [];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid #E5E7EB' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#FFF7ED' }}
          >
            <Calendar className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Hearing Calendar</h3>
            <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
              {Object.keys(hearingMap).length} scheduled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[110px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-2 pt-3">
        {DAYS.map(d => (
          <div key={d} className="text-center pb-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: '#9CA3AF' }}
            >
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 px-2 pb-3">
        {cells.map((cell, idx) => {
          if (!cell.date || !cell.day) {
            return <div key={`empty-${idx}`} />;
          }

          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          const hearings = hearingMap[cell.date] || [];
          const hasHearing = hearings.length > 0;

          return (
            <button
              key={cell.date}
              onClick={() => {
                if (hasHearing) setSelectedDate(isSelected ? null : cell.date);
              }}
              className="relative flex flex-col items-center py-2 rounded-lg transition-all"
              style={{
                background: isSelected
                  ? '#FFF7ED'
                  : isToday
                  ? '#F3F4F6'
                  : 'transparent',
                cursor: hasHearing ? 'pointer' : 'default',
                border: isSelected ? '1px solid #FED7AA' : '1px solid transparent',
              }}
              onMouseEnter={e => {
                if (hasHearing && !isSelected) {
                  (e.currentTarget as HTMLElement).style.background = '#FAFAFA';
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.background = isToday ? '#F3F4F6' : 'transparent';
                }
              }}
            >
              <span
                className="text-xs font-medium w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  color: isToday
                    ? '#FFFFFF'
                    : isSelected
                    ? '#F97316'
                    : hasHearing
                    ? '#111827'
                    : '#6B7280',
                  background: isToday ? '#F97316' : 'transparent',
                  fontWeight: isToday || hasHearing ? 700 : 500,
                }}
              >
                {cell.day}
              </span>

              {/* Hearing dots */}
              {hasHearing && (
                <div className="flex items-center gap-0.5 mt-1">
                  {hearings.slice(0, 3).map((c, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: PRIORITY_DOT[c.priority] }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date hearings */}
      <AnimatePresence>
        {selectedDate && selectedCases.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="mx-3 mb-3 rounded-xl overflow-hidden"
              style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}
            >
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid #E5E7EB' }}
              >
                <p className="text-xs font-semibold text-gray-900">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long'
                  })}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
                  {selectedCases.length} hearing{selectedCases.length > 1 ? 's' : ''} scheduled
                </p>
              </div>

              <div className="divide-y" style={{ borderColor: '#E5E7EB' }}>
                {selectedCases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onCaseClick?.(c)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: PRIORITY_DOT[c.priority] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{c.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: '#6B7280' }}>
                          <MapPin className="h-2.5 w-2.5" />
                          {c.court}
                        </span>
                      </div>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}
                    >
                      {c.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div
        className="flex items-center gap-4 px-5 py-3"
        style={{ borderTop: '1px solid #E5E7EB' }}
      >
        {[
          { label: 'High', color: '#EF4444' },
          { label: 'Medium', color: '#F59E0B' },
          { label: 'Standard', color: '#6B7280' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
            <span className="text-[10px] font-medium" style={{ color: '#9CA3AF' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};