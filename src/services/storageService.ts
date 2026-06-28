/**
 * storageService.ts
 * PocketLawyer — Production Firebase Storage Layer
 *
 * Manages all document uploads for legal cases.
 * Every file belongs to a Case and is stored under:
 *   cases/{caseId}/documents/{documentId}/{fileName}
 *
 * Uses Firebase Storage v9 Modular SDK.
 * No UI. No React. No AI. No OCR. No Firestore CRUD.
 */

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getMetadata,
  updateMetadata,
  listAll,
  StorageReference,
  UploadTask,
  FullMetadata,
  SettableMetadata,
  FirebaseStorage,
} from "firebase/storage";
import type { FirebaseApp } from "firebase/app";
// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum allowed file size: 100 MB */
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** Allowed MIME types mapped to their canonical extensions */
const ALLOWED_MIME_TYPES: ReadonlyMap<string, string> = new Map([
  ['application/pdf',                                                      'pdf'],
  ['image/jpeg',                                                           'jpg'],
  ['image/jpg',                                                            'jpg'],
  ['image/png',                                                            'png'],
  ['image/webp',                                                           'webp'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/msword',                                                   'doc'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',   'xlsx'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  ['text/plain',                                                           'txt'],
]);

/** Allowed file extensions (lower-cased) */
const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx', 'doc', 'xlsx', 'pptx', 'txt',
]);

/** Default retry attempts for failed uploads */
const DEFAULT_RETRY_ATTEMPTS = 3;

/** Base delay (ms) between retry attempts — doubles on each retry */
const RETRY_BASE_DELAY_MS = 1000;

// ─── Custom Error Classes ─────────────────────────────────────────────────────

/**
 * Base storage error. All PocketLawyer storage errors extend this class.
 */
export class StorageError extends Error {
  public readonly code: string;
  public readonly originalError?: unknown;

  constructor(message: string, code: string, originalError?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.originalError = originalError;
    // Maintains proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a file fails MIME-type, extension, or size validation
 * before upload is attempted.
 */
export class ValidationError extends StorageError {
  public readonly field: 'mimeType' | 'extension' | 'size' | 'fileName' | 'path';

  constructor(
    message: string,
    field: ValidationError['field'],
    originalError?: unknown,
  ) {
    super(message, 'VALIDATION_ERROR', originalError);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Thrown when an in-progress upload is cancelled by the caller.
 */
export class UploadCancelledError extends StorageError {
  public readonly documentId: string;
  public readonly caseId: string;

  constructor(caseId: string, documentId: string) {
    super(
      `Upload cancelled for document "${documentId}" in case "${caseId}".`,
      'UPLOAD_CANCELLED',
    );
    this.name = 'UploadCancelledError';
    this.documentId = documentId;
    this.caseId = caseId;
  }
}

/**
 * Thrown when a requested file does not exist in Storage.
 */
export class FileNotFoundError extends StorageError {
  public readonly storagePath: string;

  constructor(storagePath: string, originalError?: unknown) {
    super(
      `File not found at storage path: "${storagePath}".`,
      'FILE_NOT_FOUND',
      originalError,
    );
    this.name = 'FileNotFoundError';
    this.storagePath = storagePath;
  }
}

/**
 * Thrown when the authenticated user lacks permission to perform
 * the requested storage operation.
 */
export class PermissionDeniedError extends StorageError {
  public readonly storagePath: string;

  constructor(storagePath: string, originalError?: unknown) {
    super(
      `Permission denied for storage path: "${storagePath}".`,
      'PERMISSION_DENIED',
      originalError,
    );
    this.name = 'PermissionDeniedError';
    this.storagePath = storagePath;
  }
}

// ─── Types & Interfaces ──────────────────────────────────────────────────────

/** Document categories recognised by PocketLawyer */
export type DocumentCategory =
  | 'FIR'
  | 'ChargeSheet'
  | 'CourtOrder'
  | 'Petition'
  | 'Affidavit'
  | 'Evidence'
  | 'MedicalReport'
  | 'IdentityProof'
  | 'FinancialRecord'
  | 'Contract'
  | 'Other';

/** Represents a file already persisted in Firebase Storage */
export interface StorageFile {
  /** Opaque document identifier (matches Firestore document ID) */
  documentId: string;
  /** Case this file belongs to */
  caseId: string;
  /** Original file name as provided by the uploader */
  fileName: string;
  /** Full Firebase Storage path, e.g. cases/abc/documents/doc1/FIR.pdf */
  storagePath: string;
  /** Firebase Storage download URL (time-limited) */
  downloadUrl: string;
  /** MIME type of the file */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** ISO 8601 timestamp of when the file was uploaded */
  uploadedAt: string;
  /** UID of the user who uploaded the file */
  uploadedBy: string;
  /** Human-readable display name (may differ from fileName after rename) */
  documentName: string;
  /** Legal category of the document */
  category: DocumentCategory;
  /** Free-form tags for search / filtering */
  tags: string[];
  /** Document version number (1-based) */
  version: number;
  /** Number of pages — populated by OCR layer later */
  pageCount: number | null;
}

/** Progress snapshot emitted during an upload */
export interface UploadProgress {
  /** Bytes transferred so far */
  bytesTransferred: number;
  /** Total bytes to transfer */
  totalBytes: number;
  /** Upload percentage [0–100] */
  percentage: number;
  /** Current upload state */
  state: 'running' | 'paused' | 'success' | 'cancelled' | 'error';
}

/**
 * Custom metadata stored alongside the Firebase Storage object.
 * All values must be strings (Firebase Storage requirement).
 */
export interface StorageMetadata {
  caseId: string;
  documentId: string;
  documentName: string;
  uploadedBy: string;
  uploadedAt: string;
  category: DocumentCategory;
  tags: string;          // JSON-serialised string[]
  version: string;       // stringified number
  pageCount: string;     // stringified number | "null"
}

/** Options that control upload behaviour */
export interface UploadOptions {
  /**
   * Called repeatedly during upload with progress information.
   * Useful for progress bars in the UI layer.
   */
  onProgress?: (progress: UploadProgress) => void;

  /**
   * An AbortController whose signal can be used to cancel the upload.
   * When aborted, the upload task is cancelled and an
   * UploadCancelledError is thrown.
   */
  abortSignal?: AbortSignal;

  /**
   * Number of times to retry a failed upload before throwing.
   * Defaults to DEFAULT_RETRY_ATTEMPTS (3).
   */
  retryAttempts?: number;

  /** Legal category to attach to the uploaded document */
  category?: DocumentCategory;

  /** Free-form tags */
  tags?: string[];

  /** Version number (defaults to 1) */
  version?: number;

  /** Number of pages (populated later by the OCR layer; defaults to null) */
  pageCount?: number | null;
}

/** Returned by uploadDocument() and uploadMultipleDocuments() on success */
export interface UploadResult {
  /** The fully hydrated StorageFile descriptor */
  file: StorageFile;
  /** The Firebase Storage download URL */
  downloadUrl: string;
  /** The storage path where the file resides */
  storagePath: string;
}

/** Validation result returned by validateFile() */
export interface ValidationResult {
  /** True if the file passes all validation rules */
  isValid: boolean;
  /** Populated when isValid is false */
  error?: ValidationError;
}

/** Options for moveDocument() */
export interface MoveOptions {
  /** If true the source file is deleted after a successful copy */
  deleteSource?: boolean;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Extracts the lower-cased extension from a file name.
 * Returns an empty string if no extension is found.
 */
function getExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Maps a Firebase Storage error code to the appropriate
 * PocketLawyer StorageError subclass.
 */
function mapFirebaseError(
  err: unknown,
  storagePath: string,
): StorageError {
  if (err instanceof StorageError) return err;

  const firebaseCode =
    (err as { code?: string })?.code ?? 'unknown';

  switch (firebaseCode) {
    case 'storage/object-not-found':
    case 'storage/bucket-not-found':
      return new FileNotFoundError(storagePath, err);

    case 'storage/unauthorized':
    case 'storage/unauthenticated':
      return new PermissionDeniedError(storagePath, err);

    case 'storage/canceled':
      return new UploadCancelledError('', '');

    default:
      return new StorageError(
        `Storage operation failed for path "${storagePath}": ${String(err)}`,
        firebaseCode,
        err,
      );
  }
}

/**
 * Waits for the given number of milliseconds before resolving.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Serialises StorageMetadata into the plain-string record that
 * Firebase Storage's SettableMetadata.customMetadata expects.
 */
function serialiseMetadata(meta: StorageMetadata): Record<string, string> {
  return {
    caseId:       meta.caseId,
    documentId:   meta.documentId,
    documentName: meta.documentName,
    uploadedBy:   meta.uploadedBy,
    uploadedAt:   meta.uploadedAt,
    category:     meta.category,
    tags:         meta.tags,
    version:      meta.version,
    pageCount:    meta.pageCount,
  };
}

/**
 * Deserialises a Firebase FullMetadata object back into a typed
 * StorageMetadata record.  Returns null when custom metadata is absent.
 */
function deserialiseMetadata(
  fullMeta: FullMetadata,
): StorageMetadata | null {
  const cm = fullMeta.customMetadata;
  if (!cm) return null;

  return {
    caseId:       cm['caseId']       ?? '',
    documentId:   cm['documentId']   ?? '',
    documentName: cm['documentName'] ?? '',
    uploadedBy:   cm['uploadedBy']   ?? '',
    uploadedAt:   cm['uploadedAt']   ?? '',
    category:     (cm['category'] as DocumentCategory) ?? 'Other',
    tags:         cm['tags']         ?? '[]',
    version:      cm['version']      ?? '1',
    pageCount:    cm['pageCount']    ?? 'null',
  };
}

/**
 * Builds a StorageFile from a FullMetadata snapshot and a download URL.
 */
function buildStorageFile(
  fullMeta: FullMetadata,
  downloadUrl: string,
): StorageFile {
  const custom = deserialiseMetadata(fullMeta);
  const now = new Date().toISOString();

  return {
    documentId:   custom?.documentId   ?? '',
    caseId:       custom?.caseId       ?? '',
    fileName:     fullMeta.name        ?? '',
    storagePath:  fullMeta.fullPath    ?? '',
    downloadUrl,
    mimeType:     fullMeta.contentType ?? '',
    size:         fullMeta.size        ?? 0,
    uploadedAt:   custom?.uploadedAt   ?? now,
    uploadedBy:   custom?.uploadedBy   ?? '',
    documentName: custom?.documentName ?? fullMeta.name ?? '',
    category:     (custom?.category as DocumentCategory) ?? 'Other',
    tags:         custom ? JSON.parse(custom.tags) : [],
    version:      custom ? parseInt(custom.version, 10) : 1,
    pageCount:    custom
      ? (custom.pageCount === 'null' ? null : parseInt(custom.pageCount, 10))
      : null,
  };
}

// ─── Service Class ────────────────────────────────────────────────────────────

/**
 * StorageService
 *
 * Singleton service responsible for all Firebase Storage operations
 * within PocketLawyer.  Initialise once with a FirebaseApp instance
 * and then reuse the singleton throughout the application.
 *
 * @example
 * ```ts
 * import { app } from '@/config/firebase';
 * import { StorageService } from '@/services/storageService';
 *
 * const storage = StorageService.getInstance(app);
 * const result = await storage.uploadDocument(file, 'case123', 'doc001', 'user456');
 * ```
 */
export class StorageService {
  private static instance: StorageService | null = null;
  private readonly storage: FirebaseStorage;

  private constructor(app: FirebaseApp) {
    this.storage = getStorage(app);
  }

  /**
   * Returns the singleton StorageService instance.
   * Creates it on first call; subsequent calls ignore the `app` argument.
   */
  public static getInstance(app: FirebaseApp): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(app);
    }
    return StorageService.instance;
  }

  // ─── Path Generation ────────────────────────────────────────────────────────

  /**
   * Generates the canonical Firebase Storage path for a document file.
   *
   * Pattern: `cases/{caseId}/documents/{documentId}/{fileName}`
   *
   * @param caseId      — Firestore case document ID
   * @param documentId  — Firestore document record ID
   * @param fileName    — original file name (including extension)
   * @returns           the full storage path string
   *
   * @throws {ValidationError} if any segment is empty or contains illegal chars
   */
  public generateStoragePath(
    caseId: string,
    documentId: string,
    fileName: string,
  ): string {
    if (!caseId.trim()) {
      throw new ValidationError('caseId must not be empty.', 'path');
    }
    if (!documentId.trim()) {
      throw new ValidationError('documentId must not be empty.', 'path');
    }
    if (!fileName.trim()) {
      throw new ValidationError('fileName must not be empty.', 'fileName');
    }

    // Guard against path traversal attempts
    const dangerousPattern = /[#\[\]*?]/;
    if (
      dangerousPattern.test(caseId) ||
      dangerousPattern.test(documentId) ||
      dangerousPattern.test(fileName)
    ) {
      throw new ValidationError(
        'Path segments must not contain characters: # [ ] * ?',
        'path',
      );
    }

    return `cases/${caseId}/documents/${documentId}/${fileName}`;
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validates a file against PocketLawyer's upload rules:
   *   • MIME type must be in the allow-list
   *   • Extension must match an allowed type
   *   • File size must not exceed MAX_FILE_SIZE_BYTES (100 MB)
   *
   * Returns a typed ValidationResult — does NOT throw.
   */
  public validateFile(file: File): ValidationResult {
    // 1. Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        error: new ValidationError(
          `File "${file.name}" exceeds the maximum allowed size of 100 MB `
          + `(actual: ${(file.size / 1024 / 1024).toFixed(2)} MB).`,
          'size',
        ),
      };
    }

    // 2. MIME type check
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return {
        isValid: false,
        error: new ValidationError(
          `File type "${file.type}" is not permitted. `
          + `Allowed types: ${[...ALLOWED_MIME_TYPES.keys()].join(', ')}.`,
          'mimeType',
        ),
      };
    }

    // 3. Extension check
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        isValid: false,
        error: new ValidationError(
          `File extension ".${ext}" is not permitted. `
          + `Allowed extensions: ${[...ALLOWED_EXTENSIONS].join(', ')}.`,
          'extension',
        ),
      };
    }

    return { isValid: true };
  }

  // ─── Core Upload ─────────────────────────────────────────────────────────────

  /**
   * Uploads a single document to Firebase Storage under the case's folder.
   *
   * Supports:
   *   - progress callbacks via `options.onProgress`
   *   - cancellation via `options.abortSignal`
   *   - automatic retry with exponential back-off
   *
   * @param file        — the browser File object to upload
   * @param caseId      — Firestore case document ID
   * @param documentId  — Firestore document record ID
   * @param uploadedBy  — UID of the authenticated user performing the upload
   * @param options     — optional upload configuration
   * @returns           an UploadResult containing the StorageFile and URLs
   *
   * @throws {ValidationError}       file fails validation
   * @throws {UploadCancelledError}  upload was cancelled via abortSignal
   * @throws {PermissionDeniedError} user lacks Storage write access
   * @throws {StorageError}          any other Storage failure
   */
  public async uploadDocument(
    file: File,
    caseId: string,
    documentId: string,
    uploadedBy: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // Validate before touching the network
    const validation = this.validateFile(file);
    if (!validation.isValid && validation.error) {
      throw validation.error;
    }

    const storagePath = this.generateStoragePath(caseId, documentId, file.name);
    const maxAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this._executeUpload(
          file,
          storagePath,
          caseId,
          documentId,
          uploadedBy,
          options,
        );
      } catch (err) {
        // Cancelled uploads should not be retried
        if (err instanceof UploadCancelledError) throw err;
        // Validation errors should not be retried
        if (err instanceof ValidationError) throw err;
        // Permission errors will not resolve on retry
        if (err instanceof PermissionDeniedError) throw err;

        lastError = err;

        if (attempt < maxAttempts) {
          const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await delay(backoff);
        }
      }
    }

    throw mapFirebaseError(lastError, storagePath);
  }

  /**
   * Internal: executes a single upload attempt via UploadTask.
   */
  private _executeUpload(
    file: File,
    storagePath: string,
    caseId: string,
    documentId: string,
    uploadedBy: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    return new Promise<UploadResult>((resolve, reject) => {
      const storageRef: StorageReference = ref(this.storage, storagePath);

      const customMeta: StorageMetadata = {
        caseId,
        documentId,
        documentName: options.category ? `${file.name}` : file.name,
        uploadedBy,
        uploadedAt:  new Date().toISOString(),
        category:    options.category   ?? 'Other',
        tags:        JSON.stringify(options.tags ?? []),
        version:     String(options.version ?? 1),
        pageCount:   String(options.pageCount ?? null),
      };

      const settable: SettableMetadata = {
        contentType:    file.type,
        customMetadata: serialiseMetadata(customMeta),
      };

      const uploadTask: UploadTask = uploadBytesResumable(storageRef, file, settable);

      // Wire up cancellation via AbortSignal
      const abortHandler = () => {
        uploadTask.cancel();
        reject(new UploadCancelledError(caseId, documentId));
      };

      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          uploadTask.cancel();
          reject(new UploadCancelledError(caseId, documentId));
          return;
        }
        options.abortSignal.addEventListener('abort', abortHandler, { once: true });
      }

      uploadTask.on(
        'state_changed',
        // Progress snapshot
        snapshot => {
          if (options.onProgress) {
            const pct =
              snapshot.totalBytes > 0
                ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                : 0;

            options.onProgress({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes:       snapshot.totalBytes,
              percentage:       pct,
              state:            snapshot.state as UploadProgress['state'],
            });
          }
        },
        // Error handler
        err => {
          options.abortSignal?.removeEventListener('abort', abortHandler);

          const code = (err as { code?: string })?.code ?? '';
          if (code === 'storage/canceled') {
            reject(new UploadCancelledError(caseId, documentId));
          } else {
            reject(mapFirebaseError(err, storagePath));
          }
        },
        // Completion handler
        async () => {
          options.abortSignal?.removeEventListener('abort', abortHandler);

          try {
            const [downloadUrl, fullMeta] = await Promise.all([
              getDownloadURL(uploadTask.snapshot.ref),
              getMetadata(uploadTask.snapshot.ref),
            ]);

            const storageFile = buildStorageFile(fullMeta, downloadUrl);

            resolve({
              file:        storageFile,
              downloadUrl,
              storagePath: fullMeta.fullPath,
            });
          } catch (postErr) {
            reject(mapFirebaseError(postErr, storagePath));
          }
        },
      );
    });
  }

  // ─── Multiple Uploads ────────────────────────────────────────────────────────

  /**
   * Uploads multiple files belonging to the same case concurrently.
   *
   * Each file is given its own `documentId` derived from the provided
   * `documentIds` array (positional match).  The arrays must have the
   * same length.
   *
   * Individual failures do NOT abort the other uploads; they are collected
   * and returned in the `failed` array.
   *
   * @param files        — array of File objects to upload
   * @param caseId       — Firestore case document ID
   * @param documentIds  — array of document IDs (same length as files)
   * @param uploadedBy   — UID of the authenticated user
   * @param options      — shared upload options applied to every upload
   * @returns            object with `succeeded` and `failed` arrays
   *
   * @throws {ValidationError} if `files` and `documentIds` lengths differ
   */
  public async uploadMultipleDocuments(
    files: File[],
    caseId: string,
    documentIds: string[],
    uploadedBy: string,
    options: UploadOptions = {},
  ): Promise<{
    succeeded: UploadResult[];
    failed: Array<{ file: File; error: StorageError }>;
  }> {
    if (files.length !== documentIds.length) {
      throw new ValidationError(
        `files (length ${files.length}) and documentIds (length ${documentIds.length}) `
        + 'must have the same length.',
        'path',
      );
    }

    const uploads = files.map((file, idx) =>
      this.uploadDocument(file, caseId, documentIds[idx], uploadedBy, options)
        .then(result => ({ ok: true as const, result }))
        .catch((err: unknown) => ({
          ok:    false as const,
          file,
          error: err instanceof StorageError
            ? err
            : new StorageError(String(err), 'UNKNOWN', err),
        })),
    );

    const outcomes = await Promise.all(uploads);

    const succeeded: UploadResult[] = [];
    const failed: Array<{ file: File; error: StorageError }> = [];

    for (const outcome of outcomes) {
      if ('file' in outcome) {
        failed.push({ file: outcome.file, error: outcome.error });
      } else {
        succeeded.push(outcome.result);
      }
    }

    return { succeeded, failed };
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  /**
   * Permanently deletes a document from Firebase Storage.
   *
   * @param storagePath — full Firebase Storage path of the file to delete
   *
   * @throws {FileNotFoundError}     file does not exist
   * @throws {PermissionDeniedError} caller lacks delete permission
   * @throws {StorageError}          any other Storage failure
   */
  public async deleteDocument(storagePath: string): Promise<void> {
    if (!storagePath.trim()) {
      throw new ValidationError('storagePath must not be empty.', 'path');
    }

    try {
      const storageRef = ref(this.storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      throw mapFirebaseError(err, storagePath);
    }
  }

  // ─── Download URL ─────────────────────────────────────────────────────────────

  /**
   * Retrieves a fresh, time-limited download URL for an existing file.
   *
   * @param storagePath — full Firebase Storage path of the file
   * @returns           the download URL string
   *
   * @throws {FileNotFoundError}     file does not exist
   * @throws {PermissionDeniedError} caller lacks read permission
   * @throws {StorageError}          any other Storage failure
   */
  public async getDownloadUrl(storagePath: string): Promise<string> {
    if (!storagePath.trim()) {
      throw new ValidationError('storagePath must not be empty.', 'path');
    }

    try {
      const storageRef = ref(this.storage, storagePath);
      return await getDownloadURL(storageRef);
    } catch (err) {
      throw mapFirebaseError(err, storagePath);
    }
  }

  /**
   * Retrieves a download URL and triggers a browser download
   * by opening it in a new tab.
   *
   * This is a convenience wrapper — the actual byte transfer happens
   * client-side via the browser; no bytes are routed through the app.
   *
   * @param storagePath — full Firebase Storage path of the file
   * @returns           the download URL string (also opens it)
   */
  public async downloadDocument(storagePath: string): Promise<string> {
    const url = await this.getDownloadUrl(storagePath);

    // Only open in browser environments
    if (typeof window !== 'undefined') {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return url;
  }

  // ─── File Metadata ────────────────────────────────────────────────────────────

  /**
   * Retrieves the full Firebase FullMetadata for a file and maps it
   * to a typed StorageFile.
   *
   * @param storagePath — full Firebase Storage path of the file
   * @returns           typed StorageFile descriptor
   *
   * @throws {FileNotFoundError}     file does not exist
   * @throws {PermissionDeniedError} caller lacks read permission
   * @throws {StorageError}          any other Storage failure
   */
  public async getFileMetadata(storagePath: string): Promise<StorageFile> {
    if (!storagePath.trim()) {
      throw new ValidationError('storagePath must not be empty.', 'path');
    }

    try {
      const storageRef = ref(this.storage, storagePath);
      const [fullMeta, downloadUrl] = await Promise.all([
        getMetadata(storageRef),
        getDownloadURL(storageRef),
      ]);
      return buildStorageFile(fullMeta, downloadUrl);
    } catch (err) {
      throw mapFirebaseError(err, storagePath);
    }
  }

  /**
   * Updates the custom metadata stored alongside a file.
   *
   * Only the fields provided in `patch` are modified; all other existing
   * metadata is preserved by Firebase Storage.
   *
   * @param storagePath — full Firebase Storage path of the file
   * @param patch       — partial StorageMetadata with only the fields to update
   *
   * @throws {FileNotFoundError}     file does not exist
   * @throws {PermissionDeniedError} caller lacks write permission
   * @throws {StorageError}          any other Storage failure
   */
  public async updateFileMetadata(
    storagePath: string,
    patch: Partial<StorageMetadata>,
  ): Promise<void> {
    if (!storagePath.trim()) {
      throw new ValidationError('storagePath must not be empty.', 'path');
    }

    try {
      const storageRef = ref(this.storage, storagePath);

      // Retrieve existing metadata so we merge, not overwrite
      const existingFull = await getMetadata(storageRef);
      const existing = deserialiseMetadata(existingFull) ?? ({} as StorageMetadata);

      const merged: StorageMetadata = {
        ...existing,
        ...patch,
        // Re-serialise tags if caller provided them as a raw array patch value
        tags:
          patch.tags !== undefined
            ? patch.tags  // already a string (caller must serialise)
            : existing.tags ?? '[]',
      };

      const settable: SettableMetadata = {
        customMetadata: serialiseMetadata(merged),
      };

      await updateMetadata(storageRef, settable);
    } catch (err) {
      throw mapFirebaseError(err, storagePath);
    }
  }

  // ─── List Case Documents ─────────────────────────────────────────────────────

  /**
   * Lists all document files stored under a given case.
   *
   * Walks `cases/{caseId}/documents/` and returns a flat list of
   * StorageFile objects.  Each file's metadata and download URL are
   * fetched concurrently.
   *
   * @param caseId — Firestore case document ID
   * @returns      array of StorageFile descriptors (may be empty)
   *
   * @throws {PermissionDeniedError} caller lacks list permission
   * @throws {StorageError}          any other Storage failure
   */
  public async listCaseDocuments(caseId: string): Promise<StorageFile[]> {
    if (!caseId.trim()) {
      throw new ValidationError('caseId must not be empty.', 'path');
    }

    const folderPath = `cases/${caseId}/documents`;

    try {
      const folderRef = ref(this.storage, folderPath);
      const listResult = await listAll(folderRef);

      // Each immediate child is a documentId subfolder — list its items
      const subListResults = await Promise.all(
        listResult.prefixes.map(prefixRef => listAll(prefixRef)),
      );

      const allItemRefs: StorageReference[] = [
        ...listResult.items,
        ...subListResults.flatMap(r => r.items),
      ];

      // Fetch metadata and download URL concurrently for all files
      const storageFiles = await Promise.all(
        allItemRefs.map(async itemRef => {
          const [fullMeta, downloadUrl] = await Promise.all([
            getMetadata(itemRef),
            getDownloadURL(itemRef),
          ]);
          return buildStorageFile(fullMeta, downloadUrl);
        }),
      );

      return storageFiles;
    } catch (err) {
      throw mapFirebaseError(err, folderPath);
    }
  }

  // ─── Rename ──────────────────────────────────────────────────────────────────

  /**
   * Renames a document file by copying it to a new path (same folder,
   * new name) and deleting the original.
   *
   * Firebase Storage has no native rename; this is implemented as
   * copy + delete, which is non-atomic.  The copy is performed first
   * so that if the delete fails, the data is not lost.
   *
   * @param storagePath — current full storage path
   * @param newFileName — new file name (must include extension)
   * @returns           new UploadResult reflecting the renamed file
   *
   * @throws {ValidationError}       newFileName is empty or has wrong extension
   * @throws {FileNotFoundError}     source file does not exist
   * @throws {PermissionDeniedError} caller lacks write permission
   * @throws {StorageError}          any other Storage failure
   */
  public async renameDocument(
    storagePath: string,
    newFileName: string,
  ): Promise<UploadResult> {
    if (!storagePath.trim()) {
      throw new ValidationError('storagePath must not be empty.', 'path');
    }
    if (!newFileName.trim()) {
      throw new ValidationError('newFileName must not be empty.', 'fileName');
    }

    const newExt = getExtension(newFileName);
    if (!ALLOWED_EXTENSIONS.has(newExt)) {
      throw new ValidationError(
        `New file name has a disallowed extension ".${newExt}".`,
        'extension',
      );
    }

    // Derive the new path by replacing the last segment
    const segments = storagePath.split('/');
    segments[segments.length - 1] = newFileName;
    const newPath = segments.join('/');

    // Copy then delete
    const result = await this.copyDocument(storagePath, newPath);
    await this.deleteDocument(storagePath);

    return result;
  }

  // ─── Move ────────────────────────────────────────────────────────────────────

  /**
   * Moves a document from one storage path to another.
   *
   * Like rename, this is implemented as copy + delete.
   * Pass `{ deleteSource: false }` to perform a copy without deletion.
   *
   * @param sourcePath      — current full storage path
   * @param destinationPath — target full storage path
   * @param options         — MoveOptions (default: deleteSource = true)
   * @returns               UploadResult for the file at the new location
   *
   * @throws {FileNotFoundError}     source file does not exist
   * @throws {PermissionDeniedError} caller lacks write permission
   * @throws {StorageError}          any other Storage failure
   */
  public async moveDocument(
    sourcePath: string,
    destinationPath: string,
    options: MoveOptions = {},
  ): Promise<UploadResult> {
    if (!sourcePath.trim()) {
      throw new ValidationError('sourcePath must not be empty.', 'path');
    }
    if (!destinationPath.trim()) {
      throw new ValidationError('destinationPath must not be empty.', 'path');
    }

    const deleteSource = options.deleteSource !== false;
    const result = await this.copyDocument(sourcePath, destinationPath);

    if (deleteSource) {
      await this.deleteDocument(sourcePath);
    }

    return result;
  }

  // ─── Copy ────────────────────────────────────────────────────────────────────

  /**
   * Copies a document to a new storage path while preserving all
   * custom metadata.
   *
   * Firebase Storage does not have a native copy operation.  This is
   * implemented by downloading the file as an ArrayBuffer, then
   * re-uploading it to the destination path.
   *
   * @param sourcePath      — full storage path of the source file
   * @param destinationPath — full storage path of the destination file
   * @returns               UploadResult for the copied file
   *
   * @throws {FileNotFoundError}     source file does not exist
   * @throws {PermissionDeniedError} caller lacks read or write permission
   * @throws {StorageError}          any other Storage failure
   */
  public async copyDocument(
    sourcePath: string,
    destinationPath: string,
  ): Promise<UploadResult> {
    if (!sourcePath.trim()) {
      throw new ValidationError('sourcePath must not be empty.', 'path');
    }
    if (!destinationPath.trim()) {
      throw new ValidationError('destinationPath must not be empty.', 'path');
    }

    try {
      const sourceRef   = ref(this.storage, sourcePath);
      const destRef     = ref(this.storage, destinationPath);

      // Fetch existing metadata to carry over custom fields
      const [fullMeta, downloadUrl] = await Promise.all([
        getMetadata(sourceRef),
        getDownloadURL(sourceRef),
      ]);

      // Fetch the raw bytes via the download URL
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new StorageError(
          `Failed to fetch source file bytes for copy (HTTP ${response.status}).`,
          'FETCH_ERROR',
        );
      }
      const buffer = await response.arrayBuffer();

      // Re-upload to destination, preserving content type and custom metadata
      const settable: SettableMetadata = {
        contentType:    fullMeta.contentType,
        customMetadata: fullMeta.customMetadata ?? undefined,
      };

      const uploadTask: UploadTask = uploadBytesResumable(destRef, buffer, settable);

      return await new Promise<UploadResult>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          () => { /* no progress tracking for internal copy */ },
          err => reject(mapFirebaseError(err, destinationPath)),
          async () => {
            try {
              const [newUrl, newMeta] = await Promise.all([
                getDownloadURL(uploadTask.snapshot.ref),
                getMetadata(uploadTask.snapshot.ref),
              ]);
              resolve({
                file:        buildStorageFile(newMeta, newUrl),
                downloadUrl: newUrl,
                storagePath: newMeta.fullPath,
              });
            } catch (postErr) {
              reject(mapFirebaseError(postErr, destinationPath));
            }
          },
        );
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw mapFirebaseError(err, sourcePath);
    }
  }
}

// ─── Convenience Factory ──────────────────────────────────────────────────────

/**
 * Factory that returns the StorageService singleton.
 * Sugar for `StorageService.getInstance(app)`.
 *
 * @example
 * ```ts
 * import { app } from '@/config/firebase';
 * import { getStorageService } from '@/services/storageService';
 *
 * const storage = getStorageService(app);
 * ```
 */
export function getStorageService(app: FirebaseApp): StorageService {
  return StorageService.getInstance(app);
}

// ─── Re-exports ───────────────────────────────────────────────────────────────
// Exporting the constants gives consuming code a single import point
// for validation limits without importing firebase directly.
export {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
};