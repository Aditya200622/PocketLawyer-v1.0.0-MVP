import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scale, Hash, Briefcase, FolderOpen, Brain,
  LogOut, User, ChevronRight, Settings, HelpCircle,
  X, CalendarDays
} from 'lucide-react';

type DashTab = string;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeTab: DashTab;
  onTabChange: (tab: DashTab) => void;
  lawyer: { name: string; email: string };
  onLogout: () => void;
  caseCount: number;
}

const NAV_ITEMS = [
  { id: 'overview',      icon: Hash,       label: 'Overview',        badge: null },
  { id: 'research',      icon: Brain,      label: 'Research',        badge: null },
  { id: 'research-vault',icon: FolderOpen, label: 'Research Vault',  badge: null },
  { id: 'case-workspace',icon: Briefcase,  label: 'Case Workspace',  badge: null },
  { id: 'drafts',        icon: FolderOpen, label: 'Drafting Center', badge: null },
  { id: 'hearings',      icon: FolderOpen, label: 'Hearings',        badge: null },
  { id: 'calendar',      icon: CalendarDays,label: 'Calendar',       badge: null },
  { id: 'timeline',      icon: FolderOpen, label: 'Timeline',        badge: null },
  { id: 'my-cases',      icon: Briefcase,  label: 'Cases',           badge: null },
  { id: 'files',         icon: FolderOpen, label: 'Files',           badge: null },
  { id: 'ai-assistant',  icon: Brain,      label: 'AI Assistant',    badge: 'AI' },
  { id: 'moot-court',    icon: Scale,      label: 'Moot Court',      badge: null },
] as const;
const SECONDARY_ITEMS = [
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings'
  },
  {
    id: 'help',
    icon: HelpCircle,
    label: 'Help & Support'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({
  open, onClose, activeTab, onTabChange, lawyer, onLogout, caseCount
}) => {
  const initials = lawyer.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

  const SidebarContent = () => (
    <div
      className="flex flex-col h-full w-64 select-none"
      style={{ background: '#fff6f6', borderRight: '1px solid #1A1A1A' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 flex-shrink-0"
        style={{ borderBottom: '1px solid #fff7f7' }}>
    <div className="flex items-center gap-3">
  <img
    src="/hero3.png"
    alt="PocketLawyer"
    className="w-10 h-10 object-contain rounded-lg"
  />

  <div>
    <span className="font-semibold text-black text-sm tracking-tight">
      PocketLawyer
    </span>

    <div className="flex items-center gap-1.5 mt-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span
        className="text-[10px] font-medium"
        style={{ color: '#737373' }}
      >
        OS Pro
      </span>
    </div>
  </div>
</div>
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="md:hidden w-7 h-7 rounded-md flex items-center justify-center transition-colors"
          style={{ color: '#525252' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#A3A3A3')}
          onMouseLeave={e => (e.currentTarget.style.color = '#525252')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-3"
          style={{ color: '#3A3A3A' }}>
          Workspace
        </p>
        {NAV_ITEMS.map(item => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onTabChange(item.id as DashTab); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative"
              style={{
                background: active ? '#1A1A1A' : 'transparent',
                color: active ? '#FFFFFF' : '#737373',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = '#111111';
                  (e.currentTarget as HTMLElement).style.color = '#D4D4D4';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#737373';
                }
              }}
            >
              {/* Active indicator */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: '#F97316' }}
                />
              )}
              <item.icon
                className="h-4 w-4 flex-shrink-0 transition-colors"
                style={{ color: active ? '#F97316' : 'inherit' }}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: active ? '#2A2A2A' : '#1A1A1A', color: '#F97316' }}
                >
                  {item.badge}
                </span>
              )}
              {active && (
                <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: '#F97316' }} />
              )}
            </button>
          );
        })}

        <div className="my-4" style={{ borderTop: '1px solid #1A1A1A' }} />

        <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-3"
          style={{ color: '#3A3A3A' }}>
          System
        </p>
        {SECONDARY_ITEMS.map(item => (
          <button
  key={item.label}
  onClick={() => {
    if (item.id === 'settings') {
      onTabChange('settings');
      onClose();
    }
  }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: '#525252' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#111111';
              (e.currentTarget as HTMLElement).style.color = '#A3A3A3';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#525252';
            }}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer – User */}
      <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: '1px solid #1A1A1A' }}>
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 group transition-all cursor-default"
          style={{ background: '#111111' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
            style={{ background: '#F97316' }}
          >
            {initials || <User className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{lawyer.name}</p>
            <p className="text-[10px] truncate" style={{ color: '#525252' }}>
              {lawyer.email || 'Advocate · Pro Plan'}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ color: '#525252' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#1A0505';
            (e.currentTarget as HTMLElement).style.color = '#EF4444';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#525252';
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 h-full z-40">
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="sidebar"
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <SidebarContent />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Mobile: drawer + overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
            />
            <motion.div
              key="drawer"
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed left-0 top-0 h-full z-50 md:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};