import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, Scale, BookOpen, FileText, Archive } from 'lucide-react';
import { subscribeVaultItems, createVaultItem, updateVaultItem, deleteVaultItem } from '../services/vaultService';
import { auth } from '../firebase';
import { useEffect } from 'react';
import { Plus, Edit2, Trash2, Pin, Star } from 'lucide-react';

import VaultCard, { VaultDocument, VaultDocType } from '../components/VaultCard';

type TabId = 'all' | VaultDocType;

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'all',      label: 'All',       icon: Archive },
  { id: 'judgment', label: 'Judgments', icon: Scale },
  { id: 'research', label: 'Research',  icon: BookOpen },
  { id: 'pdf',      label: 'PDFs',      icon: FileText },
];

export const ResearchVault: React.FC = () => {
  const [tab, setTab] = useState<TabId>('all');
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<(VaultDocument & { vaultId: string, isPinned?: boolean, isFavorite?: boolean })[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid || 'anonymous';
    const unsub = subscribeVaultItems(userId, (items) => {
      const mapped = items.map(item => {
        let t: VaultDocType = 'pdf';
        if (item.type === 'pdf') t = 'pdf';
        else if (item.category === 'legal' || item.title.toLowerCase().includes('judgment')) t = 'judgment';
        else t = 'research';

        return {
          id: item.vaultId,
          vaultId: item.vaultId,
          title: item.title || 'Untitled',
          type: t,
          court: item.description?.includes('court:') ? item.description.split('court:')[1] : undefined,
          citation: undefined,
          tag: (item.tags && item.tags.length > 0) ? item.tags[0] : 'Document',
          savedOn: item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown',
          size: undefined,
          isPinned: item.isPinned,
          isFavorite: item.isFavorite
        };
      });
      setDocs(mapped);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      const matchesTab = tab === 'all' ? true : d.type === tab;
      const matchesQuery =
        d.title.toLowerCase().includes(query.toLowerCase()) ||
        d.tag.toLowerCase().includes(query.toLowerCase()) ||
        (d.citation || '').toLowerCase().includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [tab, query, docs]);

  const counts = {
    all: docs.length,
    judgment: docs.filter(d => d.type === 'judgment').length,
    research: docs.filter(d => d.type === 'research').length,
    pdf: docs.filter(d => d.type === 'pdf').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Research Vault</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
          {docs.length} saved documents across judgments, research and files
        </p>
      </div>
      <button
        onClick={() => {
          const user = auth.currentUser;
          createVaultItem({
            caseId: "dummy-case", caseNumber: "DUMMY", title: "New Document " + Math.floor(Math.random()*1000),
            description: "", category: "other", type: "pdf", fileId: "", documentId: "",
            tags: ["Draft"], isPinned: false, isFavorite: false,
            userId: user?.uid || "anonymous", createdBy: user?.displayName || "System"
          }).catch(console.error);
        }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
        style={{ background: '#0A0A0A' }}
      >
        <Plus className="h-4 w-4" /> Add Document
      </button>
    </div>

      {/* Search */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
      >
        <Search className="h-4 w-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search judgments, citations or notes…"
          className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#F3F4F6' }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ color: active ? '#111827' : '#6B7280' }}
            >
              {active && (
                <motion.div
                  layoutId="vault-tab-bg"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <t.icon className="h-3.5 w-3.5 relative z-10" style={{ color: active ? '#F97316' : '#9CA3AF' }} />
              <span className="relative z-10">{t.label}</span>
              <span
                className="relative z-10 text-[10px] font-bold px-1.5 rounded-full"
                style={{ background: active ? '#FFF7ED' : 'transparent', color: active ? '#C2410C' : '#9CA3AF' }}
              >
                {counts[t.id as keyof typeof counts]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d, idx) => (
            <div key={d.id} className="relative group">
              <VaultCard doc={d} index={idx} />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => updateVaultItem(d.vaultId, { isPinned: !d.isPinned }).catch(console.error)} className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200" title="Pin">
                  <Pin className="h-3.5 w-3.5" style={{ color: d.isPinned ? '#F97316' : '#6B7280' }} />
                </button>
                <button onClick={() => updateVaultItem(d.vaultId, { isFavorite: !d.isFavorite }).catch(console.error)} className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200" title="Favorite">
                  <Star className="h-3.5 w-3.5" style={{ color: d.isFavorite ? '#EAB308' : '#6B7280' }} />
                </button>
                <button onClick={() => updateVaultItem(d.vaultId, { title: d.title + ' (Edited)' }).catch(console.error)} className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200" title="Edit">
                  <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <button onClick={() => deleteVaultItem(d.vaultId).catch(console.error)} className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200" title="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: '#F3F4F6' }}
          >
            <Archive className="h-5 w-5" style={{ color: '#6B7280' }} />
          </div>
          <p className="text-sm font-semibold text-gray-900">No documents found</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
            Try a different search term or category
          </p>
        </div>
      )}
    </div>
  );
};

export default ResearchVault;