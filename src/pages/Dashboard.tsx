import { storage } from "../firebase";
import { uploadBytesResumable } from "firebase/storage";
import AiAssistant from "./AiAssistant";
import { deleteObject, ref as storageRef } from "firebase/storage";
import { deleteDoc } from "firebase/firestore";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { getAuth } from "firebase/auth";
import { signOut, onAuthStateChanged } from "firebase/auth";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Cases from "./Cases";
import type { Case } from "./Cases";
import Files from "./workspace/Files";
import { motion, AnimatePresence } from 'motion/react';
import {
  Scale, FileText, Brain,
  Plus, Upload, User,
  Briefcase, Shield, Clock, CheckCircle, AlertCircle,
  Trash2, FolderOpen, Hash, X, Eye, TrendingUp,
  CheckCircle2, Sparkles, FilePlus, ArrowRight, MessageSquareText
} from 'lucide-react';

import { Sidebar } from "../components/sidebar";
import { Topbar } from "../components/Topbar";
import { DailyBriefing } from "../components/DailyBriefing";
import { HearingCalendar } from "../components/HearingCalendar";
import Drafts from './workspace/Drafts';
import Hearings from './workspace/Hearings';
import Timeline from './workspace/Timeline';
import CaseWorkspace from './workspace/CaseWorkspace';
import Research from "./Research";
import ResearchVault from "./ResearchVault";
import Settings from "./Settings";
import Calendar from "./Calendar";
import MootCourt from "./workspace/MootCourt";
// ─── Types ───────────────────────────────────────────────────────────────────
type DashTab = string;


interface Evidence {
  id: string; caseId: string; name: string; type: string;
  size: string; uploaded: string; tag: string; url?: string; path?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  active:  { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  pending: { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
  closed:  { bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF' },
  hearing: { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
};

const PRIORITY_DOT: Record<string, string> = {
  high: '#EF4444', medium: '#F59E0B', low: '#9CA3AF',
};

const ACCENT = '#FF7A1A';


const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const firstName = (full: string) => {
  if (!full) return 'Advocate';
  const cleaned = full.replace(/^Adv\.?\s*/i, '').trim();
  return cleaned.split(' ')[0] || 'Advocate';
};

// Lightweight count-up used by the stat cards — no extra dependency required.
const AnimatedCounter: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame: number;
    const startVal = display;
    const startTime = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (value - startVal) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{String(display).padStart(2, '0')}</>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Dashboard = () => {
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
      const [dashTab, setDashTab]               = useState<DashTab>('overview');
  const [lawyer, setLawyer]                 = useState({ name: 'Adv. Priya Kapoor', email: '' });
      const [cases, setCases]                   = useState<Case[]>([]);
  const [evidence, setEvidence]             = useState<Evidence[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [filterType, setFilterType]         = useState('all');
  const [preview, setPreview]               = useState<{ url: string; type: string } | null>(null);
  const [sidebarOpen, setSidebarOpen]       = useState(window.innerWidth >= 768);
  const [showNewCase, setShowNewCase]       = useState(false);
  const [nc, setNc]                         = useState({ title: '', client: '', type: '', court: '' });
;
  const loadUserData = async (user: any) => {
    try {
      const docRef = doc(db, 'users', user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setLawyer({ name: data.name || 'User', email: data.email || user.email || '' });
      } else {
        setLawyer({ name: user.email || 'User', email: user.email || '' });
      }
    } catch (_) {}
    try {
      const evSnap = await getDocs(query(collection(db, 'evidence'), where('userId', '==', user.uid)));
      setEvidence(evSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Evidence[]);
    } catch (_) {}
    try {
      const snapshot = await getDocs(query(collection(db, 'cases'), where('userId', '==', user.uid)));
      setCases(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Case[]);
    } catch (_) {}
  };

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadUserData(user);
      } else {
        navigate('/auth');
      }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      setLawyer({ name: '', email: '' });
      navigate('/auth');
    } catch (err) { alert((err as any).message); }
  };


  const saveEvidence = async (caseId: string, file: File) => {
    try {
      const user = getAuth().currentUser;
      if (!user) return;
      const sRef = ref(storage, `evidence/${user.uid}/${file.name}`);
      const uploadTask = uploadBytesResumable(sRef, file);
      uploadTask.on('state_changed',
        (snapshot) => { setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)); },
        (error) => { console.error(error); alert('Upload failed'); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadProgress(null);
          const evData = {
            caseId, name: file.name, type: file.type,
            size: (file.size / 1024).toFixed(1) + ' KB',
            tag: file.type.includes('image') ? 'Photo Evidence'
               : file.type.includes('pdf')   ? 'Legal Document'
               : file.type.includes('audio') ? 'Audio Proof'
               : file.type.includes('video') ? 'Video Evidence' : 'File',
            uploaded: new Date().toISOString().slice(0, 10),
            url, path: uploadTask.snapshot.ref.fullPath, userId: user.uid,
          };
          const docRef = await addDoc(collection(db, 'evidence'), evData);
          setEvidence(prev => [{ id: docRef.id, ...evData }, ...prev]);
        }
      );
    } catch (err) { alert((err as any).message); }
  };

  const deleteEvidence = async (ev: any) => {
    try {
      if (ev.path) {
        const fileRef = storageRef(storage, ev.path);
        await deleteObject(fileRef).catch(() => {});
      }
      await deleteDoc(doc(db, 'evidence', ev.id)).catch(() => {});
      setEvidence(prev => prev.filter(e => e.id !== ev.id));
    } catch (err) { console.error(err); alert('Delete failed'); }
  };

  const addCase = async () => {
    if (!nc.title) return;
    try {
      const user = getAuth().currentUser;
      if (!user) { alert('Not logged in'); return; }
      const caseData = {
        title: nc.title, client: nc.client, type: nc.type || 'Civil',
        court: nc.court, status: 'pending',
        date: new Date().toISOString().slice(0, 10), priority: 'medium', userId: user.uid,
      };
      const docRef = await addDoc(collection(db, 'cases'), caseData);
      setCases(p => [{ id: docRef.id, ...caseData } as any, ...p]);
      setNc({ title: '', client: '', type: '', court: '' });
      setShowNewCase(false);
    } catch (err) { alert((err as any).message); }
  };

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const activeCases  = cases.filter(c => c.status === 'active' || c.status === 'hearing').length;
  const pendingCases = cases.filter(c => c.status === 'pending').length;

  const STAT_CARDS = [
    { label: 'Total Cases',       value: cases.length,    icon: Briefcase,   accent: '#111827', subColor: '#6B7280'  },
    { label: 'Active / Hearing',  value: activeCases,     icon: TrendingUp,  accent: '#15803D', subColor: '#22C55E'  },
    { label: 'Pending',           value: pendingCases,    icon: Clock,       accent: '#B45309', subColor: '#F59E0B'  },
    { label: 'Evidence Files',    value: evidence.length, icon: Shield,      accent: '#C2410C', subColor: '#F97316'  },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex overflow-hidden"
      style={{ background: '#FAFAFA', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={dashTab}
        onTabChange={setDashTab}
        lawyer={lawyer}
        onLogout={handleLogout}
        caseCount={cases.length}
      />

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginLeft: sidebarOpen && window.innerWidth >= 768 ? '256px' : '0' }}
      >
        {/* Topbar */}
        <Topbar
          onMenuToggle={() => setSidebarOpen(p => !p)}
          activeTab={dashTab}
          onTabChange={setDashTab}
          lawyerName={lawyer.name}
          cases={cases}
          sidebarOpen={sidebarOpen}
        />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pt-16">
          <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8">
            <AnimatePresence mode="wait">

              {/* ════ OVERVIEW ════ */}
              {dashTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                >
                  {/* Greeting */}
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>
                        {getGreeting()}, {firstName(lawyer.name)}
                      </h1>
                      <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                        Your legal workspace is ready.
                      </p>
                    </div>
                    {/* Quick actions */}
                    <div className="flex flex-wrap gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setDashTab('ai-assistant')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                        style={{ background: `linear-gradient(135deg, ${ACCENT}, #FF9A3C)`, boxShadow: '0 6px 18px rgba(255,122,26,0.25)' }}
                      >
                        <Sparkles className="h-4 w-4" /> Ask AI Assistant
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setDashTab('my-cases'); setShowNewCase(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: '#FFFFFF', color: '#111827', border: '1px solid #E5E7EB' }}
                      >
                        <Plus className="h-4 w-4" /> Create Case
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setDashTab('drafts')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: '#FFFFFF', color: '#111827', border: '1px solid #E5E7EB' }}
                      >
                        <FilePlus className="h-4 w-4" /> New Draft
                      </motion.button>
                    </div>
                  </div>

                  {/* Daily Briefing */}
                  <DailyBriefing
                    cases={cases}
                    lawyerName={lawyer.name}
                    onNavigate={setDashTab}
                  />

                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {STAT_CARDS.map((s, idx) => (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                        transition={{ delay: idx * 0.06 }}
                        className="rounded-xl p-5 cursor-default"
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E5E7EB',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(255,122,26,0.10)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)')}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <s.icon className="h-4 w-4" style={{ color: s.subColor }} strokeWidth={2} />
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: '#9CA3AF' }}
                          >
                            {s.label}
                          </span>
                        </div>
                        <p
                          className="text-3xl font-bold"
                          style={{ color: '#111827', fontVariantNumeric: 'tabular-nums' }}
                        >
                          <AnimatedCounter value={s.value} />
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Two-col grid: recent cases + calendar */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Recent Cases */}
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
                    >
                      <div
                        className="flex items-center justify-between px-5 py-4"
                        style={{ borderBottom: '1px solid #E5E7EB' }}
                      >
                        <h2 className="text-sm font-semibold text-gray-900">Recent Cases</h2>
                        <button
                          onClick={() => setDashTab('my-cases')}
                          className="text-xs font-medium transition-colors"
                          style={{ color: '#F97316' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#C2410C')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#F97316')}
                        >
                          View all →
                        </button>
                      </div>
                      <div className="divide-y" style={{ borderColor: '#F9FAFB' }}>
                        {cases.slice(0, 5).map(c => {
                          const badge = STATUS_BADGE[c.status];
                          return (
                            <div
                              key={c.id}
                              className="flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors"
                              onClick={() => { setSelectedCase(c); setDashTab('my-cases'); }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#FAFAFA')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                            >
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: PRIORITY_DOT[c.priority] }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                                <p className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>
                                  {c.client} · {c.court}
                                </p>
                              </div>
                              <span
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                                style={{ background: badge.bg, color: badge.text }}
                              >
                                {c.status}
                              </span>
                            </div>
                          );
                        })}
                        {cases.length === 0 && (
                          <div className="px-5 py-12 flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 border border-slate-100">
                              <Briefcase className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
                            </div>
                            <p className="text-sm font-medium text-slate-900">No cases yet</p>
                            <p className="text-xs text-slate-500 mt-1 mb-3 max-w-[200px]">Get started by registering your first case to organize your legal workspace.</p>
                            <button
                              onClick={() => { setDashTab('my-cases'); setShowNewCase(true); }}
                              className="text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:bg-[#FFEDD5]"
                              style={{ background: '#FFF7ED', color: '#EA580C' }}
                            >
                              Register first case →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hearing Calendar */}
                    <HearingCalendar
                      cases={cases}
                      onCaseClick={c => { setSelectedCase(c); setDashTab('my-cases'); }}
                    />
                  </div>
                </motion.div>
              )}

              {/* ════ MY CASES ════ */}
              
{dashTab === "my-cases" && (
<Cases
  cases={cases}
  onOpenCase={(c) => {
    console.log("CASE CLICKED:", c);

    setSelectedCase(c);

    console.log("AFTER SET:", c);

    setDashTab("case-workspace");
  }}
/>
)}
              {/* ════ EVIDENCE (Removed) ════ */}
{dashTab === "files" && (
  <Files />
)}
              {/* ════ AI ASSISTANT ════ */}
              {dashTab === 'ai-assistant' && (
          <motion.div
                  key="ai"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <AiAssistant cases={cases as any} evidence={evidence as any} selectedCase={selectedCase as any} />
                </motion.div>
              )}
                              {dashTab === 'drafts' && (
  <Drafts />
)}

{dashTab === 'hearings' && (
  <Hearings />
)}

{dashTab === 'timeline' && (
  <Timeline />
)}
{dashTab === 'research' && (
  <Research />
)}

{dashTab === 'research-vault' && (
  <ResearchVault />
)}
{dashTab === 'calendar' && (
  <Calendar />
)}

{dashTab === 'settings' && (
  <Settings
    initialSettings={{
      name: lawyer.name,
      email: lawyer.email,
      firmName: 'PocketLawyer Legal Associates',
      role: 'Advocate',
      notifications: {
        email: true,
        sms: false,
        hearingReminders: true,
      },
      theme: 'light',
      twoFactorEnabled: false,
    }}
    onSave={(settings) => {
      console.log('Saved Settings:', settings);
      alert('Settings Saved Successfully');
    }}
  />
)}

{dashTab === 'moot-court' && (
  <MootCourt caseTitle={selectedCase?.title} />
)}
{dashTab === 'case-workspace' && (
  <CaseWorkspace
    caseData={selectedCase ?? undefined}
    onBack={() => setDashTab('my-cases')}
    onAskAI={() => setDashTab('ai-assistant')}
  />
)}
      

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative w-full max-w-3xl rounded-2xl overflow-hidden"
              style={{ background: '#FFFFFF', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: '1px solid #E5E7EB' }}
              >
                <p className="text-sm font-semibold text-gray-900">Preview</p>
                <button
                  onClick={() => setPreview(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: '#F3F4F6', color: '#6B7280' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {preview.type.includes('image') && (
                <img src={preview.url} className="w-full max-h-[80vh] object-contain" />
              )}
              {preview.type.includes('pdf') && (
                <iframe src={preview.url} className="w-full h-[80vh]" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 100px; }
        ::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
      `}</style>
    </div>
  );
};