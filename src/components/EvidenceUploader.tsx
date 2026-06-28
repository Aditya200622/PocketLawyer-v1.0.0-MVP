import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
} from 'lucide-react';
import FileUploader from './FileUploader';

/**
 * EvidenceUpload.tsx
 * Domain-specific evidence upload experience for Evidence.tsx.
 * Composes FileUploader internally; owns its own upload-queue state locally.
 */

export interface EvidenceFile {
  id: string;
  file: File;
  category: string;
  progress: number; // 0–100
  status: 'queued' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export interface EvidenceUploadProps {
  caseId: string;
  categories?: string[];
  onUploadComplete?: (file: EvidenceFile) => void;
  onDelete?: (fileId: string) => void;
  maxSizeMB?: number;
  className?: string;
}

const DEFAULT_CATEGORIES = ['Contract', 'Correspondence', 'Photo', 'Witness Statement', 'Other'];

function genId() {
  return `ev_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) return ImageIcon;
  if (file.type === 'application/pdf' || file.type.includes('document')) return FileText;
  return FileIcon;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-gray-50/50 px-6 py-10 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
      >
        <FileText className="h-5 w-5 text-[#6B7280]" aria-hidden="true" />
      </motion.div>
      <p className="mt-3 text-[14px] font-medium text-[#111827]">No evidence uploaded yet</p>
      <p className="mt-1 max-w-xs text-[12px] text-[#6B7280]">
        Upload documents, photos, or statements related to this case. They&apos;ll appear here once added.
      </p>
    </motion.div>
  );
}

export default function EvidenceUpload({
  caseId,
  categories = DEFAULT_CATEGORIES,
  onUploadComplete,
  onDelete,
  maxSizeMB = 25,
  className = '',
}: EvidenceUploadProps) {
  const [queue, setQueue] = useState<EvidenceFile[]>([]);
  const [uploaderError, setUploaderError] = useState<string | null>(null);

  const simulateUpload = useCallback(
    (entry: EvidenceFile) => {
      setQueue((prev) =>
        prev.map((f) => (f.id === entry.id ? { ...f, status: 'uploading' } : f))
      );

      const interval = setInterval(() => {
        setQueue((prev) =>
          prev.map((f) => {
            if (f.id !== entry.id || f.status !== 'uploading') return f;
            const next = Math.min(f.progress + Math.random() * 22 + 8, 100);
            return { ...f, progress: next };
          })
        );
      }, 220);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setQueue((prev) =>
          prev.map((f) => {
            if (f.id !== entry.id) return f;
            const completed: EvidenceFile = { ...f, progress: 100, status: 'success' };
            onUploadComplete?.(completed);
            return completed;
          })
        );
      }, 1800);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    },
    [onUploadComplete]
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      setUploaderError(null);
      const newEntries: EvidenceFile[] = files.map((file) => ({
        id: genId(),
        file,
        category: categories[0] ?? 'Other',
        progress: 0,
        status: 'queued',
      }));

      setQueue((prev) => [...newEntries, ...prev]);
      newEntries.forEach((entry) => simulateUpload(entry));
    },
    [categories, simulateUpload]
  );

  const handleCategoryChange = useCallback((id: string, category: string) => {
    setQueue((prev) => prev.map((f) => (f.id === id ? { ...f, category } : f)));
  }, []);

  const handleDeleteEntry = useCallback(
    (id: string) => {
      setQueue((prev) => prev.filter((f) => f.id !== id));
      onDelete?.(id);
    },
    [onDelete]
  );

  return (
    <div className={className} aria-label={`Evidence upload for case ${caseId}`}>
      <FileUploader
        onFilesSelected={handleFilesSelected}
        multiple
        maxSizeMB={maxSizeMB}
        error={uploaderError}
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.heic"
      />

      <div className="mt-5">
        {queue.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2" aria-label="Upload queue">
            <AnimatePresence initial={false}>
              {queue.map((entry) => {
                const Icon = getFileIcon(entry.file);
                return (
                  <motion.li
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                        <Icon className="h-4 w-4 text-[#6B7280]" aria-hidden="true" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-[#111827]">
                              {entry.file.name}
                            </p>
                            <p className="text-[12px] text-[#6B7280]">
                              {formatBytes(entry.file.size)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {entry.status === 'success' && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                            )}
                            {entry.status === 'error' && (
                              <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              aria-label={`Remove ${entry.file.name}`}
                              className="rounded-md p-1 text-[#6B7280] transition-colors hover:bg-gray-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {/* Progress bar */}
                        {(entry.status === 'uploading' || entry.status === 'queued') && (
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <motion.div
                              className="h-full rounded-full bg-[#F97316]"
                              initial={{ width: 0 }}
                              animate={{ width: `${entry.progress}%` }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                            />
                          </div>
                        )}

                        {entry.status === 'error' && entry.errorMessage && (
                          <p className="mt-1.5 text-[12px] font-medium text-red-600">
                            {entry.errorMessage}
                          </p>
                        )}

                        {/* Category tag selector */}
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <Tag className="h-3 w-3 text-[#6B7280]" aria-hidden="true" />
                          <label className="sr-only" htmlFor={`category-${entry.id}`}>
                            Category for {entry.file.name}
                          </label>
                          <select
                            id={`category-${entry.id}`}
                            value={entry.category}
                            onChange={(e) => handleCategoryChange(entry.id, e.target.value)}
                            className="rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-[12px] text-[#374151] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#F97316]"
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * USAGE EXAMPLE — src/pages/workspace/Evidence.tsx
 *
 * import EvidenceUpload, { EvidenceFile } from '@/components/EvidenceUpload';
 *
 * <EvidenceUpload
 *   caseId="case-1021"
 *   categories={['Contract', 'Photo', 'Witness Statement', 'Other']}
 *   maxSizeMB={25}
 *   onUploadComplete={(file: EvidenceFile) => persistEvidenceRecord(file)}
 *   onDelete={(id) => removeEvidenceRecord(id)}
 * />
 */