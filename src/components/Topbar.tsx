import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, Search, Bell, X, Command, Clock, Briefcase, Brain, FolderOpen } from 'lucide-react';

type DashTab = string;
interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'hearing' | 'ai' | 'case';
}

interface TopbarProps {
  onMenuToggle: () => void;
  activeTab: DashTab;
  onTabChange: (tab: DashTab) => void;
  lawyerName: string;
  cases: Array<{ id: string; title: string; client: string; nextHearing?: string }>;
  sidebarOpen: boolean;
}

const TAB_LABELS: Record<DashTab, string> = {
   'case-workspace': 'Case Workspace',
'overview': 'Overview',
'my-cases': 'Cases',
'files': 'Files',
'evidence': 'Evidence Vault',
'ai-assistant': 'AI Assistant',
'drafts': 'Drafting Center',
'hearings': 'Hearings',
'timeline': 'Timeline',
'research': 'Research Center',
'research-vault': 'Research Vault',
'calendar': 'Calendar',
'settings': 'Settings',
'moot-court': 'Moot Court',
};

const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1', type: 'hearing',
    title: 'Hearing Tomorrow',
    body: 'Sharma vs. State of UP — Allahabad HC, 10:00 AM',
    time: '2h ago', read: false,
  },
  {
    id: 'n2', type: 'ai',
    title: 'AI Summary Ready',
    body: 'Bail application draft generated for C001',
    time: '5h ago', read: false,
  },
  {
    id: 'n3', type: 'case',
    title: 'New Evidence Uploaded',
    body: 'Sale_Agreement_1998.pdf added to Mehta Property',
    time: '1d ago', read: true,
  },
];

const NOTIFICATION_ICON: Record<string, React.ReactNode> = {
  hearing: <Clock className="h-4 w-4" style={{ color: '#F59E0B' }} />,
  ai:      <Brain className="h-4 w-4" style={{ color: '#F97316' }} />,
  case:    <Briefcase className="h-4 w-4" style={{ color: '#6B7280' }} />,
};

export const Topbar: React.FC<TopbarProps> = ({
  onMenuToggle, activeTab, onTabChange, lawyerName, cases, sidebarOpen
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(DEFAULT_NOTIFICATIONS);
  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  // Filter cases by search query
  const searchResults = searchQuery.trim().length > 1
    ? cases.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const markAllRead = () => setNotifications(n => n.map(x => ({ ...x, read: true })));

  return (
    <>
      <header
        className="fixed top-0 right-0 z-30 h-16 flex items-center px-4 gap-3"
        style={{
          left: sidebarOpen ? '256px' : '0',
          transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
          background: '#FAFAFA',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        {/* Menu toggle */}
        <button
          onClick={onMenuToggle}
          className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors"
          style={{ color: '#6B7280' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
            (e.currentTarget as HTMLElement).style.color = '#111827';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#6B7280';
          }}
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>PocketLawyer</span>
          <span className="text-xs" style={{ color: '#D1D5DB' }}>/</span>
          <span className="text-sm font-semibold text-gray-900">{TAB_LABELS[activeTab]}</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium transition-all"
            style={{
              background: '#F3F4F6',
              color: '#9CA3AF',
              border: '1px solid #E5E7EB',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#EFEFEF';
              (e.currentTarget as HTMLElement).style.color = '#6B7280';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
              (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
            }}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search cases…</span>
            <span
              className="ml-2 flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded"
              style={{ background: '#E5E7EB', color: '#9CA3AF' }}
            >
              <Command className="h-2.5 w-2.5" />K
            </span>
          </button>

          {/* Mobile search icon */}
          <button
            onClick={() => setSearchOpen(true)}
            className="sm:hidden w-8 h-8 rounded-md flex items-center justify-center transition-colors"
            style={{ color: '#6B7280' }}
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(p => !p)}
              className="relative w-8 h-8 rounded-md flex items-center justify-center transition-colors"
              style={{ color: '#6B7280' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                (e.currentTarget as HTMLElement).style.color = '#111827';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = '#6B7280';
              }}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ background: '#F97316' }}
                />
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-10 w-80 rounded-xl overflow-hidden z-50"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.10)',
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">Notifications</span>
                      {unread > 0 && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: '#F97316' }}
                        >
                          {unread}
                        </span>
                      )}
                    </div>
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-medium transition-colors"
                        style={{ color: '#F97316' }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 px-4 py-3 transition-colors cursor-default"
                        style={{ background: n.read ? '#FFFFFF' : '#FFFBF7' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                        onMouseLeave={e => (e.currentTarget.style.background = n.read ? '#FFFFFF' : '#FFFBF7')}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: '#F3F4F6' }}
                        >
                          {NOTIFICATION_ICON[n.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F97316' }} />
                            )}
                          </div>
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#6B7280' }}>{n.body}</p>
                          <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI status pill */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-semibold"
            style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            AI Active
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              key="search-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              key="search-modal"
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 rounded-2xl overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
              }}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <Search className="h-4 w-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search cases, clients, or courts…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm font-medium text-gray-900 placeholder-gray-400"
                />
                <button
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                  className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                  style={{ background: '#F3F4F6', color: '#9CA3AF' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Results */}
              {searchQuery.length > 1 && (
                <div>
                  {searchResults.length > 0 ? (
                    <div className="py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider px-4 py-1.5" style={{ color: '#9CA3AF' }}>
                        Cases
                      </p>
                      {searchResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            onTabChange('my-cases');
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                          onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: '#F3F4F6' }}
                          >
                            <Briefcase className="h-4 w-4" style={{ color: '#6B7280' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.title}</p>
                            <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{c.client}</p>
                          </div>
                          <span
                            className="text-[10px] font-mono px-2 py-1 rounded"
                            style={{ background: '#F3F4F6', color: '#9CA3AF' }}
                          >
                            {c.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No results for "{searchQuery}"</p>
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Try searching by client name or case ID</p>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {searchQuery.length <= 1 && (
                <div className="py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider px-4 py-1.5" style={{ color: '#9CA3AF' }}>
                    Quick Nav
                  </p>
                  {[
                    { label: 'My Cases', icon: Briefcase, tab: 'my-cases' as DashTab },
                    { label: 'Evidence Vault', icon: FolderOpen, tab: 'evidence' as DashTab },
                    { label: 'AI Assistant', icon: Brain, tab: 'ai-assistant' as DashTab },
                  ].map(item => (
                    <button
                      key={item.tab}
                      onClick={() => { onTabChange(item.tab); setSearchOpen(false); setSearchQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: '#F3F4F6' }}
                      >
                        <item.icon className="h-3.5 w-3.5" style={{ color: '#6B7280' }} />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div
                className="flex items-center gap-3 px-4 py-2.5 text-[10px] font-medium"
                style={{ borderTop: '1px solid #F3F4F6', color: '#9CA3AF' }}
              >
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>esc close</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};