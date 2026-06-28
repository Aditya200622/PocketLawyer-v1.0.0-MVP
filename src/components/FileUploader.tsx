import { useCallback, useId, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, AlertTriangle } from 'lucide-react';

/**
 * FileUploader.tsx
 * Generic, reusable drag-and-drop file input.
 * No domain knowledge (no "evidence", no categories) — pure file mechanics.
 * EvidenceUpload.tsx composes this and adds domain logic on top.
 */

export interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}

function FileUploaderSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex h-40 w-full animate-pulse items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-gray-50 ${className}`}
      aria-hidden="true"
    >
      <div className="h-8 w-8 rounded-full bg-gray-200" />
    </div>
  );
}

export default function FileUploader({
  onFilesSelected,
  accept,
  multiple = true,
  maxSizeMB,
  isLoading = false,
  disabled = false,
  error = null,
  className = '',
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const displayError = error ?? localError;

  const validateAndEmit = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setLocalError(null);

      const files = Array.from(fileList);

      if (maxSizeMB) {
        const oversized = files.find((f) => f.size > maxSizeMB * 1024 * 1024);
        if (oversized) {
          setLocalError(`"${oversized.name}" exceeds the ${maxSizeMB}MB limit.`);
          return;
        }
      }

      onFilesSelected(multiple ? files : [files[0]]);
    },
    [maxSizeMB, multiple, onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled || isLoading) return;
      validateAndEmit(e.dataTransfer.files);
    },
    [disabled, isLoading, validateAndEmit]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isLoading) return;
      setIsDragging(true);
    },
    [disabled, isLoading]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      validateAndEmit(e.target.files);
      e.target.value = '';
    },
    [validateAndEmit]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  if (isLoading) return <FileUploaderSkeleton className={className} />;

  return (
    <div className={className}>
      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={displayError ? `${inputId}-error` : undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        animate={{
          borderColor: displayError ? '#FCA5A5' : isDragging ? '#F97316' : '#E5E7EB',
          backgroundColor: isDragging ? '#FFF7ED' : '#FFFFFF',
        }}
        transition={{ duration: 0.15 }}
        whileHover={disabled ? undefined : { scale: 1.005 }}
        className={`flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2 ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInputChange}
          className="sr-only"
          aria-label="Upload files"
        />

        <motion.div
          animate={{ y: isDragging ? -2 : 0 }}
          transition={{ duration: 0.15 }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50"
        >
          <UploadCloud className="h-5 w-5 text-[#F97316]" aria-hidden="true" />
        </motion.div>

        <p className="mt-3 text-[14px] font-medium text-[#111827]">
          {isDragging ? 'Drop files to upload' : 'Drag & drop files here'}
        </p>
        <p className="mt-1 text-[12px] text-[#6B7280]">
          or <span className="font-medium text-[#F97316]">browse</span> from your device
          {maxSizeMB ? ` · Max ${maxSizeMB}MB per file` : ''}
        </p>
      </motion.div>

      {displayError && (
        <motion.div
          id={`${inputId}-error`}
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-red-600"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {displayError}
        </motion.div>
      )}
    </div>
  );
}

/**
 * USAGE EXAMPLE
 *
 * import FileUploader from '@/components/FileUploader';
 *
 * <FileUploader
 *   accept=".pdf,.docx,.png,.jpg"
 *   maxSizeMB={25}
 *   onFilesSelected={(files) => console.log(files)}
 * />
 */