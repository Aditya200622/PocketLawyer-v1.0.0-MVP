import React from 'react';
import { motion } from 'motion/react';
import { FileText, Scale, BookOpen, Download, Eye, Calendar, Tag } from 'lucide-react';

export type VaultDocType = 'judgment' | 'research' | 'pdf';

export interface VaultDocument {
  id: string;
  title: string;
  type: VaultDocType;
  court?: string;
  citation?: string;
  tag: string;
  savedOn: string;
  size?: string;
}

const TYPE_META: Record<VaultDocType, { icon: React.ElementType; label: string; bg: string; fg: string }> = {
  judgment: { icon: Scale,    label: 'Judgment', bg: '#FFF7ED', fg: '#C2410C' },
  research: { icon: BookOpen, label: 'Research', bg: '#EFF6FF', fg: '#1D4ED8' },
  pdf:      { icon: FileText, label: 'PDF',      bg: '#F9FAFB', fg: '#6B7280' },
};

interface VaultCardProps {
  doc: VaultDocument;
  index?: number;
  onView?: () => void;
  onDownload?: () => void;
}

export const VaultCard: React.FC<VaultCardProps> = ({ doc, index = 0, onView, onDownload }) => {
  const meta = TYPE_META[doc.type];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl p-5 transition-all"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)')}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: meta.bg }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: meta.fg }} strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{doc.title}</h3>
          </div>
          {doc.citation && (
            <p className="text-xs mt-1 font-mono truncate" style={{ color: '#9CA3AF' }}>{doc.citation}</p>
          )}
          {doc.court && (
            <p className="text-xs mt-0.5 truncate" style={{ color: '#6B7280' }}>{doc.court}</p>
          )}

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: meta.bg, color: meta.fg }}
            >
              {meta.label}
            </span>
            <span
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#F3F4F6', color: '#6B7280' }}
            >
              <Tag className="h-2.5 w-2.5" />
              {doc.tag}
            </span>
            <span className="flex items-center gap-1 text-[11px]" style={{ color: '#9CA3AF' }}>
              <Calendar className="h-3 w-3" />
              {doc.savedOn}
            </span>
            {doc.size && (
              <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{doc.size}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: '#0A0A0A', color: '#FFFFFF' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1A1A1A')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#0A0A0A')}
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
        <button
          onClick={onDownload}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
          style={{ background: '#F3F4F6', color: '#6B7280' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#FFF7ED';
            (e.currentTarget as HTMLElement).style.color = '#F97316';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
            (e.currentTarget as HTMLElement).style.color = '#6B7280';
          }}
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

export default VaultCard;