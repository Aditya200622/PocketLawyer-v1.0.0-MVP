import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeHearings, Hearing as ServiceHearing, createHearing, updateHearing, deleteHearing } from '../services/hearingService';
import { fetchAIResponse } from '../services/aiService';
import { auth } from '../firebase';

import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  Plus, 
  Gavel, 
  Clock, 
  Users, 
  AlertTriangle, 
  FileText, 
  BrainCircuit, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  MapPin, 
  User, 
  Layers,
  ArrowUpRight,
  Briefcase,
  TrendingUp,
  History,
  FilePlus,
  Scale,
  CalendarDays
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface LegalEvent {
  id: string;
  title: string;
  caseName: string;
  caseNumber: string;
  court: string;
  judge: string;
  client: string;
  location: string;
  type: 'hearing' | 'deadline' | 'meeting' | 'drafting' | 'research' | 'moot';
  date: string; // YYYY-MM-DD
  time: string;
  priority: 'high' | 'medium' | 'low';
  status: 'Pending' | 'Completed' | 'Adjourned';
  description?: string;
}

interface AICounselRecommendation {
  id: string;
  title: string;
  description: string;
  targetCase: string;
  urgency: 'high' | 'medium';
  actionLabel: string;
}

// ============================================================================
// AI RECOMMENDATIONS (DYNAMICALLY LOADED)
// ============================================================================

// ============================================================================
// COLOR CONFIGURATIONS BY EVENT TYPE
// ============================================================================

const TYPE_CONFIG = {
  hearing: { label: 'Hearings', dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', hex: '#F97316' },
  deadline: { label: 'Deadlines', dot: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', hex: '#EF4444' },
  meeting: { label: 'Meetings', dot: 'bg-sky-500', text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', hex: '#0EA5E9' },
  drafting: { label: 'Draftings', dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', hex: '#A855F7' },
  research: { label: 'Research', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', hex: '#10B981' },
  moot: { label: 'Moot Court', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', hex: '#F59E0B' },
};

export default function CalendarCommandCenter() {
  // States
  const [events, setEvents] = useState<LegalEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LegalEvent | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['hearing', 'deadline', 'meeting', 'drafting', 'research', 'moot']);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate] = useState<Date>(new Date());
  
  // AI Dynamic States
  const [aiRecommendations, setAiRecommendations] = useState<AICounselRecommendation[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const aiFetchedRef = useRef(false);

  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid || 'anonymous';
    const unsub = subscribeHearings(userId, (hearings) => {
      const mapped: LegalEvent[] = hearings.map(h => ({
        id: h.hearingId,
        title: h.purpose || 'Hearing',
        caseName: `Case: ${h.caseId}`,
        caseNumber: h.caseNumber,
        court: h.courtName,
        judge: h.judgeName,
        client: 'Unknown Client',
        location: h.courtRoom,
        type: 'hearing',
        date: h.hearingDate,
        time: h.hearingTime,
        priority: 'high',
        status: h.status === 'completed' ? 'Completed' : h.status === 'adjourned' ? 'Adjourned' : 'Pending',
        description: h.remarks
      }));
      setEvents(mapped);
      if (mapped.length > 0 && !selectedEvent) {
        setSelectedEvent(mapped[0]);
      }
    });
    return () => unsub();
  }, []); // Remove selectedEvent from dependencies to avoid loop

  // Fetch AI Recommendations based on events
  useEffect(() => {
    if (events.length === 0 || aiFetchedRef.current) return;
    
    let isMounted = true;
    aiFetchedRef.current = true;
    
    const fetchRecs = async () => {
      setLoadingAi(true);
      try {
        const eventsContext = events.slice(0, 5).map(e => ({
          title: e.title,
          caseName: e.caseName,
          date: e.date,
          type: e.type,
          priority: e.priority
        }));
        
        const prompt = `Based on the following legal events for the user:\n${JSON.stringify(eventsContext)}\nGenerate 3 AI counsel recommendations. Return ONLY a valid JSON array of objects with the exact following properties: id (string), title (string), description (string, max 100 chars), targetCase (string, caseName), urgency ('high' or 'medium'), actionLabel (string, short 2 word action). Do not include any markdown formatting. Return just the raw JSON array string.`;
        
        const response = await fetchAIResponse(prompt);
        let cleaned = response.trim();
        if (cleaned.startsWith('\`\`\`json')) cleaned = cleaned.replace(/^\`\`\`json/, '');
        if (cleaned.startsWith('\`\`\`')) cleaned = cleaned.replace(/^\`\`\`/, '');
        if (cleaned.endsWith('\`\`\`')) cleaned = cleaned.replace(/\`\`\`$/, '');
        
        const parsed = JSON.parse(cleaned.trim()) as AICounselRecommendation[];
        if (isMounted) setAiRecommendations(parsed);
      } catch (err) {
        console.error("Failed to generate AI recommendations:", err);
        aiFetchedRef.current = false; // allow retry if failed
      } finally {
        if (isMounted) setLoadingAi(false);
      }
    };

    fetchRecs();

    return () => { isMounted = false; };
  }, [events]);

  const toggleFilter = (type: string) => {
    setActiveFilters(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Filtered Events
  const filteredEvents = events.filter(event => activeFilters.includes(event.type));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-orange-100 selection:text-orange-900">
      
      {/* GLOBAL HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-8 py-4 backdrop-blur-md bg-white/95">
        <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Top Left Branding & Section Info */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-orange-50 border border-orange-100 text-[#F97316]">
                <Scale className="w-3 h-3 mr-1" /> Legal Operations Suite
              </span>
              <span className="text-xs text-[#64748B]">• Enterprise Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Calendar Command Center</h1>
            <p className="text-sm text-[#64748B] mt-0.5 max-w-xl">
              Track hearings, filing deadlines, client meetings, limitation dates, and legal workflows.
            </p>
          </div>

          {/* Top Right Operational Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input 
                type="text" 
                placeholder="Search cases, dockets, or judges..." 
                className="w-64 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition-all placeholder:text-[#64748B]/60"
              />
            </div>

            {/* View Switching Segmented Toggle */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-0.5 rounded-lg flex items-center">
              {(['month', 'week', 'day'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize rounded-md transition-all ${
                    viewMode === mode 
                      ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]' 
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors">
              <Filter className="w-4 h-4 text-[#64748B]" /> Filters
            </button>

            <button className="px-3 py-2 text-sm font-medium text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors">
              Today
            </button>

            <motion.button 
              onClick={() => {
                const user = auth.currentUser;
                createHearing({
                  caseId: "dummy-case", caseNumber: "DUMMY/123", courtName: "High Court",
                  judgeName: "Hon'ble Judge", courtRoom: "Room 1", hearingDate: new Date().toISOString().split('T')[0],
                  hearingTime: "10:00", nextHearingDate: "", nextHearingTime: "", purpose: "New Hearing",
                  status: "scheduled", remarks: "Dummy", createdBy: user?.displayName || "System", userId: user?.uid || "anonymous"
                }).catch(console.error);
              }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#F97316] rounded-lg shadow-sm hover:bg-[#F97316]/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Schedule Event
            </motion.button>
          </div>

        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-[1700px] mx-auto px-8 py-6 space-y-6">
        
        {/* ============================================================================
            ROW 1: LEGAL INSIGHT CARDS (METRICS)
           ============================================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* Card 1: Hearings */}
          <motion.div 
            whileHover={{ y: -2, boxShadow: '0 10px 20px -5px rgba(15,23,42,0.04)' }}
            className="bg-white border border-[#E2E8F0] p-5 rounded-xl transition-all relative overflow-hidden group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-orange-50 rounded-lg text-[#F97316]">
                <Gavel className="w-5 h-5" />
              </div>
              <span className="flex items-center text-xs font-medium text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <TrendingUp className="w-3 h-3 mr-0.5" /> High Priority
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-[#64748B]">Today's Hearings</h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold tracking-tight text-[#0F172A]">02</span>
                <span className="text-xs text-[#64748B]">Active Lists</span>
              </div>
            </div>
            {/* Minimalist Micro Sparkline */}
            <div className="mt-4 h-1 w-full bg-[#F8FAFC] rounded-full overflow-hidden">
              <div className="h-full bg-[#F97316] rounded-full" style={{ width: '65%' }}></div>
            </div>
          </motion.div>

          {/* Card 2: Deadlines */}
          <motion.div 
            whileHover={{ y: -2, boxShadow: '0 10px 20px -5px rgba(15,23,42,0.04)' }}
            className="bg-white border border-[#E2E8F0] p-5 rounded-xl transition-all relative overflow-hidden group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-rose-50 rounded-lg text-[#EF4444]">
                <Clock className="w-5 h-5" />
              </div>
              <span className="flex items-center text-xs font-medium text-[#EF4444] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                Critical 4h
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-[#64748B]">Upcoming Deadlines</h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold tracking-tight text-[#0F172A]">04</span>
                <span className="text-xs text-[#64748B]">Before Registry Close</span>
              </div>
            </div>
            <div className="mt-4 h-1 w-full bg-[#F8FAFC] rounded-full overflow-hidden">
              <div className="h-full bg-[#EF4444] rounded-full" style={{ width: '85%' }}></div>
            </div>
          </motion.div>

          {/* Card 3: Client Meetings */}
          <motion.div 
            whileHover={{ y: -2, boxShadow: '0 10px 20px -5px rgba(15,23,42,0.04)' }}
            className="bg-white border border-[#E2E8F0] p-5 rounded-xl transition-all relative overflow-hidden group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-sky-50 rounded-lg text-[#0EA5E9]">
                <Users className="w-5 h-5" />
              </div>
              <span className="flex items-center text-xs font-medium text-[#64748B] bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                Next at 2 PM
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-[#64748B]">Client Meetings</h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold tracking-tight text-[#0F172A]">06</span>
                <span className="text-xs text-[#64748B]">Scheduled Today</span>
              </div>
            </div>
            <div className="mt-4 h-1 w-full bg-[#F8FAFC] rounded-full overflow-hidden">
              <div className="h-full bg-[#0EA5E9] rounded-full" style={{ width: '40%' }}></div>
            </div>
          </motion.div>

          {/* Card 4: Urgent Legal Tasks */}
          <motion.div 
            whileHover={{ y: -2, boxShadow: '0 10px 20px -5px rgba(15,23,42,0.04)' }}
            className="bg-white border border-[#E2E8F0] p-5 rounded-xl transition-all relative overflow-hidden group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-purple-50 rounded-lg text-[#A855F7]">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <span className="flex items-center text-xs font-medium text-[#F59E0B] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                AI Flagged
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-[#64748B]">Urgent Legal Tasks</h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold tracking-tight text-[#0F172A]">09</span>
                <span className="text-xs text-[#64748B]">Action Recommended</span>
              </div>
            </div>
            <div className="mt-4 h-1 w-full bg-[#F8FAFC] rounded-full overflow-hidden">
              <div className="h-full bg-[#A855F7] rounded-full" style={{ width: '55%' }}></div>
            </div>
          </motion.div>

        </div>

        {/* ============================================================================
            MAIN OPERATIONAL CORE LAYOUT (3 COLUMN)
           ============================================================================ */}
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_420px] gap-6 items-start">
          
          {/* ------------------------------------------------------------------------
              LEFT PANEL: MATTER FILTERS & NEXT 48 HOURS
             ------------------------------------------------------------------------ */}
          <div className="space-y-6">
            
            {/* Matter Calendars Checkbox Component */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Matter Subsystems
              </h4>
              <div className="space-y-2.5">
                {Object.entries(TYPE_CONFIG).map(([key, value]) => {
                  const isChecked = activeFilters.includes(key);
                  return (
                    <label 
                      key={key} 
                      className="flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFilter(key)}
                          className="rounded border-[#E2E8F0] text-[#F97316] focus:ring-[#F97316]/20 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-[#0F172A]/90 group-hover:text-[#0F172A] transition-colors">
                          {value.label}
                        </span>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full ${value.dot}`} />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Next 48 Hours Scrollable Stream */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-2">
                <History className="w-3.5 h-3.5" /> Chronological Stream (48h)
              </h4>
              <div className="space-y-3 max-h-[390px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredEvents.map((event) => (
                  <div 
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer text-left ${
                      selectedEvent?.id === event.id 
                        ? 'border-[#F97316] bg-orange-50/20 shadow-xs' 
                        : 'border-[#E2E8F0] hover:border-[#64748B]/30 bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_CONFIG[event.type].bg} ${TYPE_CONFIG[event.type].text}`}>
                        {event.type}
                      </span>
                      <span className="text-[11px] font-medium text-[#64748B]">{event.time}</span>
                    </div>
                    <h5 className="text-xs font-semibold text-[#0F172A] line-clamp-1">{event.title}</h5>
                    <p className="text-[11px] text-[#64748B] mt-0.5 line-clamp-1">{event.caseName}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ------------------------------------------------------------------------
              CENTER PANEL: PREMIUM INTERACTION CALENDAR GRID
             ------------------------------------------------------------------------ */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
            
            {/* Month Header Banner */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4 bg-white">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-lg font-bold text-[#0F172A]">June 2026</h2>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 hover:bg-[#F8FAFC] border border-[#E2E8F0] rounded-md transition-colors text-[#64748B]">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="p-1.5 hover:bg-[#F8FAFC] border border-[#E2E8F0] rounded-md transition-colors text-[#64748B]">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid Matrix */}
            <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-[#F8FAFC] text-center text-xs font-bold text-[#64748B] uppercase tracking-wider py-2.5">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
            </div>

            <div className="grid grid-cols-7 grid-rows-5 bg-[#E2E8F0] gap-[1px]">
              {/* Dummy Blank Days for June 2026 (Starts on Monday) */}
              {Array.from({ length: 30 }).map((_, index) => {
                const dayNumber = index + 1;
                // Format matching pattern for mock data execution
                const currentDayString = `2026-06-${dayNumber.toString().padStart(2, '0')}`;
                const dayEvents = filteredEvents.filter(e => e.date === currentDayString);
                const isTargetToday = dayNumber === 23; // June 23, 2026 Context

                return (
                  <div 
                    key={index} 
                    className={`min-h-[110px] bg-white p-2 transition-all flex flex-col justify-between relative group hover:bg-[#F8FAFC]/60 ${
                      isTargetToday ? 'bg-orange-50/10 ring-1 ring-inset ring-[#F97316]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                        isTargetToday ? 'bg-[#F97316] text-white shadow-xs' : 'text-[#0F172A]'
                      }`}>
                        {dayNumber}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-semibold text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.2 rounded">
                          {dayEvents.length} Tasks
                        </span>
                      )}
                    </div>

                    {/* Event Stack inside Calendar Cell */}
                    <div className="space-y-1 mt-2 flex-grow overflow-hidden">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div 
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }}
                          className={`text-[11px] font-medium px-2 py-1 rounded border truncate transition-all cursor-pointer ${
                            selectedEvent?.id === ev.id 
                              ? 'shadow-xs border-slate-400 bg-white scale-[1.01]' 
                              : `${TYPE_CONFIG[ev.type].bg} ${TYPE_CONFIG[ev.type].text} ${TYPE_CONFIG[ev.type].border}`
                          }`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${TYPE_CONFIG[ev.type].dot}`} />
                            <span className="truncate font-semibold">{ev.caseName.split(' ')[0] || ev.title}</span>
                          </div>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] font-bold text-[#64748B] pl-1.5">
                          + {dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* ------------------------------------------------------------------------
              RIGHT PANEL: SELECTED EVENT DETAILED INSIGHT (STICKY)
             ------------------------------------------------------------------------ */}
          <div className="sticky top-[100px]">
            <AnimatePresence mode="wait">
              {selectedEvent && (
              <motion.div 
                key={selectedEvent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-5"
              >
                
                {/* Header Profile */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_CONFIG[selectedEvent.type].bg} ${TYPE_CONFIG[selectedEvent.type].text}`}>
                      {selectedEvent.type} Reference
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      selectedEvent.priority === 'high' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-50 text-slate-700'
                    }`}>
                      {selectedEvent.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#0F172A] leading-snug">{selectedEvent.title}</h3>
                  <p className="text-sm font-semibold text-[#F97316] mt-0.5">{selectedEvent.caseName}</p>
                </div>

                <hr className="border-[#E2E8F0]" />

                {/* Subsystem Technical Attributes */}
                <div className="space-y-3.5 text-sm">
                  <div className="grid grid-cols-[80px_1fr] items-start">
                    <span className="text-[#64748B] font-medium text-xs pt-0.5">Docket:</span>
                    <span className="font-mono text-xs font-bold text-[#0F172A]">{selectedEvent.caseNumber}</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] items-start">
                    <span className="text-[#64748B] font-medium text-xs pt-0.5">Forum:</span>
                    <span className="text-xs font-semibold text-[#0F172A]">{selectedEvent.court}</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] items-start">
                    <span className="text-[#64748B] font-medium text-xs pt-0.5">Bench:</span>
                    <span className="text-xs font-medium text-[#0F172A]">{selectedEvent.judge}</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] items-start">
                    <span className="text-[#64748B] font-medium text-xs pt-0.5">Client:</span>
                    <div className="flex items-center gap-1 text-xs font-semibold text-[#0F172A]">
                      <User className="w-3 h-3 text-[#64748B]" /> {selectedEvent.client}
                    </div>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] items-start">
                    <span className="text-[#64748B] font-medium text-xs pt-0.5">Location:</span>
                    <div className="flex items-center gap-1 text-xs font-medium text-[#64748B]">
                      <MapPin className="w-3 h-3 text-[#EF4444]" /> {selectedEvent.location}
                    </div>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] items-start">
                    <span className="text-[#64748B] font-medium text-xs pt-0.5">Timeline:</span>
                    <span className="text-xs font-bold text-[#0F172A]">{selectedEvent.date} @ {selectedEvent.time}</span>
                  </div>
                </div>

                {selectedEvent.description && (
                  <>
                    <hr className="border-[#E2E8F0]" />
                    <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                      <span className="text-[10px] font-bold tracking-wide text-[#64748B] uppercase block mb-1">Scope & Objectives</span>
                      <p className="text-xs text-[#0F172A] leading-relaxed font-medium">{selectedEvent.description}</p>
                    </div>
                  </>
                )}

                {/* Operations Action Panel Buttons */}
                <div className="space-y-2 pt-2">
                  <button className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors shadow-xs">
                    Open Legal Case File <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-[#F97316] bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100/60 transition-colors">
                      <BrainCircuit className="w-3.5 h-3.5" /> Ask AI Counsel
                    </button>
                    <button onClick={() => {
                      if (selectedEvent) {
                        updateHearing(selectedEvent.id, { purpose: selectedEvent.title + " (Edited)" }).catch(console.error);
                      }
                    }} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors">
                      Edit Matrix
                    </button>
<button onClick={() => {
                      if (selectedEvent) {
                        deleteHearing(selectedEvent.id).then(() => setSelectedEvent(null)).catch(console.error);
                      }
                    }} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100/60 transition-colors">
                      Delete
                    </button>
                  </div>
                  
                  <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg hover:bg-[#E2E8F0]/50 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Download Digital Briefing Bundle
                  </button>
                </div>

              </motion.div>
            )}
            </AnimatePresence>
          </div>

        </div>

        {/* ============================================================================
            SECTION BELOW CALENDAR: TIMELINE & AI INSIGHT RECON
           ============================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          
          {/* Today's Timeline (Apple Quality) */}
          <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#F97316]" /> Operational Timeline — Today (June 23)
            </h3>
            
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[#E2E8F0]">
              
              {/* Realtime Marker */}
              <div className="relative group">
                <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-[#F97316] ring-4 ring-orange-100" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-mono text-xs font-bold text-[#F97316]">08:30 AM</span>
                  <span className="text-[11px] font-bold bg-orange-100 text-[#F97316] px-2 py-0.2 rounded-full">Current Position</span>
                </div>
                <p className="text-xs font-semibold text-[#0F172A] mt-0.5">Pre-Court Strategy Conference (Chamber Audit)</p>
              </div>

              {/* Matrix Node 1 */}
              <div className="relative group opacity-85">
                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#64748B] group-hover:bg-[#F97316] transition-colors" />
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-xs font-semibold text-[#64748B]">10:30 AM</span>
                  <span className="text-[11px] text-[#64748B]">Allahabad HC</span>
                </div>
                <h4 className="text-xs font-bold text-[#0F172A] mt-0.5">Agarwal vs State of UP (Bail Arguments)</h4>
              </div>

              {/* Matrix Node 2 */}
              <div className="relative group opacity-85">
                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#64748B] group-hover:bg-[#F97316] transition-colors" />
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-xs font-semibold text-[#64748B]">02:00 PM</span>
                  <span className="text-[11px] text-[#64748B]">Chamber Office</span>
                </div>
                <h4 className="text-xs font-bold text-[#0F172A] mt-0.5">Mehta Property Consultation Strategy Briefing</h4>
              </div>

              {/* Matrix Node 3 */}
              <div className="relative group opacity-85">
                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#64748B] group-hover:bg-[#F97316] transition-colors" />
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-xs font-semibold text-[#64748B]">04:00 PM</span>
                  <span className="text-[11px] text-[#EF4444] font-medium">Filing Registry Close Cutoff</span>
                </div>
                <h4 className="text-xs font-bold text-[#0F172A] mt-0.5">Sharma vs State of UP Rejoinder Mandatory Upload</h4>
              </div>

            </div>
          </div>

          {/* AI Recommendations (Harvey Quality) */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4 text-[#F97316]" /> AI Counsel Recommendation Engine
                </h3>
                <span className="text-[11px] font-medium text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded">
                  Autonomous Watch
                </span>
              </div>

              <div className="space-y-3">
                {loadingAi ? (
                  <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] animate-pulse flex items-center justify-center">
                    <span className="text-xs font-semibold text-[#64748B]">Analyzing docket for recommendations...</span>
                  </div>
                ) : aiRecommendations.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center">
                    <span className="text-xs font-semibold text-[#64748B]">No actionable recommendations at this time.</span>
                  </div>
                ) : (
                  aiRecommendations.map((rec) => (
                    <div 
                      key={rec.id}
                      className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-orange-200 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${rec.urgency === 'high' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]'}`} />
                          <h4 className="text-xs font-bold text-[#0F172A]">{rec.title}</h4>
                        </div>
                        <p className="text-[11px] text-[#64748B] leading-relaxed max-w-sm">{rec.description}</p>
                      </div>
                      <button className="shrink-0 text-[11px] font-bold text-white bg-[#0F172A] hover:bg-slate-800 px-3 py-1.5 rounded shadow-xs transition-colors">
                        {rec.actionLabel}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] mt-4 flex items-center justify-between text-xs text-[#64748B]">
              <span>Realtime processing linked to Supreme Court & High Court Daily Orders.</span>
            </div>
          </div>

        </div>

        {/* ============================================================================
            NEXT SECTION: UPCOMING HEARINGS DATA TABLE
           ============================================================================ */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white">
            <h3 className="text-sm font-bold text-[#0F172A]">Upcoming Strategic Hearings Registry</h3>
            <span className="text-xs text-[#64748B] font-medium">Showing top priority cross-referenced lists</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase tracking-wider">
                  <th className="p-4">Case Identity</th>
                  <th className="p-4">Jurisdiction Forum</th>
                  <th className="p-4">Presiding Judge</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Time slot</th>
                  <th className="p-4">Docket Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {events.filter(e => e.type === 'hearing').map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-[#0F172A]">{item.caseName}</div>
                      <div className="text-[11px] text-[#64748B] font-mono mt-0.5">{item.caseNumber}</div>
                    </td>
                    <td className="p-4 font-medium text-[#0F172A]">{item.court}</td>
                    <td className="p-4 text-[#64748B] font-medium">{item.judge}</td>
                    <td className="p-4 font-semibold text-[#0F172A]">{item.date}</td>
                    <td className="p-4 font-medium text-[#64748B]">{item.time}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                        <span className="w-1 h-1 rounded-full bg-amber-500" /> {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedEvent(item)}
                        className="text-xs font-bold text-[#F97316] hover:text-orange-700 transition-colors"
                      >
                        Map View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================================
            BOTTOM SECTION: QUICK ACTION WORKFLOW GRID
           ============================================================================ */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5" /> High-Velocity Workflow Accelerators
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            
            {[
              { label: 'New Hearing', icon: Gavel },
              { label: 'Schedule Meeting', icon: Users },
              { label: 'Create Reminder', icon: Clock },
              { label: 'Set Deadline', icon: AlertTriangle },
              { label: 'Generate AI Summary', icon: BrainCircuit },
              { label: 'Upload Evidence', icon: FilePlus },
              { label: 'Open Research Vault', icon: FileText },
              { label: 'Create Case Timeline', icon: CalendarIcon },
            ].map((action, idx) => (
              <motion.button
                key={idx}
                whileHover={{ y: -1, boxShadow: '0 4px 12px -2px rgba(15,23,42,0.03)' }}
                whileTap={{ scale: 0.98 }}
                className="p-3 bg-white border border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center text-center gap-2 text-left hover:border-[#F97316]/40 transition-all group"
              >
                <div className="p-2 bg-[#F8FAFC] group-hover:bg-orange-50 rounded-lg text-[#64748B] group-hover:text-[#F97316] transition-colors">
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-[#0F172A] tracking-tight">{action.label}</span>
              </motion.button>
            ))}

          </div>
        </div>

      </main>
    </div>
  );
}