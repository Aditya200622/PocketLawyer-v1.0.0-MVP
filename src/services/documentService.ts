/**
 * documentService.ts
 *
 * Production-ready service for case document management.
 * Built with Firebase v9 modular SDK (tree-shakeable imports).
 *
 * Responsibilities:
 *  - Validate and upload files (PDF, DOCX, JPG, PNG) to Firebase Storage
 *  - Write and maintain document metadata in the `caseDocuments` Firestore collection
 *  - Delete documents from both Storage and Firestore atomically
 *  - List documents per case (one-time fetch and real-time subscription)
 *  - Keep `documentCount` on the parent case document in sync (best-effort)
 *
 * Storage layout:
 *   cases/{caseId}/documents/{docId}_{sanitisedFileName}
 *
 * Firestore layout:
 *   caseDocuments/{docId}
 *
 * NOT in scope (intentionally deferred):
 *  - OCR / text extraction
 *  - AI analysis or summarisation
 *  - PDF page-count parsing
 *  - Vector embedding creation
 *
 * Required Firestore composite index:
 *   Collection : caseDocuments
 *   Fields     : caseId ASC, uploadedAt DESC
 *   (Create via Firebase Console or firestore.indexes.json)
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  updateDoc,
  Timestamp,
  FirestoreError,
  QuerySnapshot,
  DocumentSnapshot,
  Unsubscribe,
} from "firebase/firestore";

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  StorageError,
} from "firebase/storage";

import { db, storage } from "../firebase";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Firestore collection holding document metadata records. */
const COLLECTION = "caseDocuments" as const;

/** Firestore collection for parent case documents (for count updates). */
const CASES_COLLECTION = "cases" as const;

/** Maximum permitted file size: 50 MB */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Maximum length of the sanitised portion of a storage filename. */
const MAX_SANITISED_NAME_LENGTH = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Allowed MIME types
// ─────────────────────────────────────────────────────────────────────────────

export type AllowedMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "image/jpeg"
  | "image/png";

/** Human-readable labels for allowed MIME types (used in error messages). */
const MIME_TYPE_LABELS: Record<AllowedMimeType, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

/** Set for O(1) validation lookup. */
const ALLOWED_MIME_SET = new Set<string>(Object.keys(MIME_TYPE_LABELS));

function isAllowedMimeType(type: string): type is AllowedMimeType {
  return ALLOWED_MIME_SET.has(type);
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a document record.
 *
 * - `uploading`  → File transfer in progress (record not yet written)
 * - `ready`      → File uploaded and accessible via `downloadURL`
 * - `error`      → Upload failed; record may be incomplete
 */
export type DocumentStatus = "uploading" | "ready" | "error";

/**
 * A document record as stored in the `caseDocuments` Firestore collection.
 *
 * Grouped into:
 *   1. Identity
 *   2. File Metadata
 *   3. Ownership & Audit
 *   4. Processing Status
 *   5. Future AI / Pipeline Fields
 */
export interface DocumentRecord {
  // ── 1. Identity ────────────────────────────────────────────────────────────

  /** Firestore auto-generated document ID. Populated on read; never written. */
  id: string;

  /** Firestore ID of the parent case in the `cases` collection. */
  caseId: string;

  /** Firebase Auth UID of the uploading user. */
  userId: string;

  // ── 2. File Metadata ───────────────────────────────────────────────────────

  /**
   * Storage-safe filename used as the leaf of the Storage path.
   * Format: `{docId}_{sanitisedOriginalName}` — guaranteed unique.
   */
  fileName: string;

  /**
   * Original filename exactly as supplied by the browser (e.g. "Contract Draft v3.pdf").
   * Preserved for display purposes; never used in storage paths.
   */
  originalName: string;

  /** MIME type of the uploaded file. */
  mimeType: AllowedMimeType;

  /** File size in bytes. */
  fileSize: number;

  /** Publicly accessible HTTPS URL returned by Firebase Storage. */
  downloadURL: string;

  /**
   * Full path within Firebase Storage.
   * Format: `cases/{caseId}/documents/{fileName}`
   * Stored here so that deletion does not require re-constructing the path.
   */
  storagePath: string;

  /**
   * Number of pages in the document.
   * Always `null` until the PDF-parsing service is implemented and run.
   */
  pageCount: number | null;

  // ── 3. Ownership & Audit ───────────────────────────────────────────────────

  /** Display name or e-mail of the user who performed the upload. */
  uploadedBy: string;

  /** Server timestamp set once at document creation. Never updated. */
  uploadedAt: Timestamp | null;

  /** Current processing status of this document record. */
  status: DocumentStatus;

  // ── 4. Future AI / Pipeline Fields (all false / null on creation) ──────────

  /**
   * Set to `true` by the OCR service once text has been extracted.
   * @future
   */
  ocrCompleted: boolean;

  /**
   * Set to `true` by the AI service once the document has been analysed.
   * @future
   */
  aiProcessed: boolean;

  /**
   * Set to `true` when an AI-generated summary exists for this document.
   * @future
   */
  summaryGenerated: boolean;

  /**
   * Set to `true` when a vector embedding has been created and stored in the
   * vector database.
   * @future
   */
  embeddingCreated: boolean;

  /**
   * Identifier of this document's vector in the external vector database.
   * `null` until `embeddingCreated` is `true`.
   * @future
   */
  vectorId: string | null;
}

// ── Payload types ─────────────────────────────────────────────────────────────

/**
 * Payload required by `uploadDocument()`.
 * The service derives all other `DocumentRecord` fields from the File object
 * and the upload result.
 */
export interface UploadDocumentPayload {
  /** Firestore ID of the case this document belongs to. */
  caseId: string;
  /** The browser File object to upload. */
  file: File;
  /** Firebase Auth UID of the uploading user. */
  userId: string;
  /** Human-readable name shown as the uploader (display name or e-mail). */
  uploadedBy: string;
}

// ── Service-level response wrappers (same contract as caseService) ─────────────

/** Uniform success wrapper. */
export interface ServiceSuccess<T> {
  success: true;
  data: T;
}

/** Uniform error wrapper — never throws; always returns a typed error shape. */
export interface ServiceError {
  success: false;
  error: string;
  /** Original Firestore / Storage error code when applicable. */
  code?: string;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceError;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Reference to the `caseDocuments` collection. */
function documentsRef() {
  return collection(db, COLLECTION);
}

/** Reference to a single document record in `caseDocuments`. */
function documentDocRef(id: string) {
  return doc(db, COLLECTION, id);
}

/** Reference to the parent case document in `cases` (used for count updates). */
function caseDocRef(caseId: string) {
  return doc(db, CASES_COLLECTION, caseId);
}

/**
 * Converts a raw Firestore `DocumentSnapshot` into a typed `DocumentRecord`.
 * Returns `null` when the snapshot does not exist.
 */
function snapshotToDocument(snapshot: DocumentSnapshot): DocumentRecord | null {
  if (!snapshot.exists()) return null;

  const data = snapshot.data();

  return {
    // Identity
    id:               snapshot.id,
    caseId:           data.caseId        ?? "",
    userId:           data.userId        ?? "",
    // File metadata
    fileName:         data.fileName      ?? "",
    originalName:     data.originalName  ?? "",
    mimeType:         data.mimeType      ?? "application/pdf",
    fileSize:         data.fileSize      ?? 0,
    downloadURL:      data.downloadURL   ?? "",
    storagePath:      data.storagePath   ?? "",
    pageCount:        data.pageCount     ?? null,
    // Ownership & audit
    uploadedBy:       data.uploadedBy    ?? "",
    uploadedAt:       data.uploadedAt    ?? null,
    status:           data.status        ?? "ready",
    // Future AI / pipeline flags
    ocrCompleted:     data.ocrCompleted      ?? false,
    aiProcessed:      data.aiProcessed       ?? false,
    summaryGenerated: data.summaryGenerated  ?? false,
    embeddingCreated: data.embeddingCreated  ?? false,
    vectorId:         data.vectorId          ?? null,
  } satisfies DocumentRecord;
}

/**
 * Maps a Firestore `QuerySnapshot` into an array of typed `DocumentRecord`s,
 * silently dropping any records that fail to deserialise.
 */
function querySnapshotToDocuments(snapshot: QuerySnapshot): DocumentRecord[] {
  return snapshot.docs
    .map(snapshotToDocument)
    .filter((d): d is DocumentRecord => d !== null);
}

/**
 * Normalises any thrown value into a human-readable message + optional code.
 * Handles both Firestore `FirestoreError` and Storage `StorageError` shapes.
 */
function normaliseError(err: unknown): { message: string; code?: string } {
  if (err instanceof Error) {
    const typed = err as FirestoreError | StorageError;
    return {
      message: typed.message,
      code:    (typed as { code?: string }).code,
    };
  }
  return { message: "An unexpected error occurred." };
}

/**
 * Produces a Storage-safe filename fragment from a user-supplied name.
 *
 * Rules applied:
 *  - Lowercased
 *  - Any character outside [a-z0-9._-] replaced with underscore
 *  - Consecutive underscores collapsed to one
 *  - Leading / trailing underscores trimmed
 *  - Capped at MAX_SANITISED_NAME_LENGTH characters
 *
 * @example
 * sanitiseFileName("Contract Draft (v3).PDF")
 * // → "contract_draft_v3_.pdf"  (extension preserved)
 */
function sanitiseFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, MAX_SANITISED_NAME_LENGTH);
}

/**
 * Atomically increments or decrements the `documentCount` field on the parent
 * case using Firestore's server-side `increment()` sentinel.
 *
 * This is a best-effort operation — failures are logged to the console but
 * never propagated to the caller. The main upload / delete result is unaffected.
 */
async function adjustCaseDocumentCount(
  caseId: string,
  delta: 1 | -1
): Promise<void> {
  try {
    await updateDoc(caseDocRef(caseId), {
      documentCount: increment(delta),
      updatedAt:     serverTimestamp(),
    });
  } catch (err) {
    // Non-fatal: log and continue. The document itself was handled correctly.
    console.warn(
      `[documentService] Could not update documentCount on case "${caseId}":`,
      err
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates, uploads, and registers a document for a case.
 *
 * Steps performed:
 *   1. Validate MIME type (PDF, DOCX, JPG, PNG only) and file size (≤ 50 MB)
 *   2. Pre-generate a Firestore doc ID — this becomes part of the storage filename,
 *      guaranteeing path uniqueness without `Math.random()` or timestamps
 *   3. Upload the file to Firebase Storage at
 *      `cases/{caseId}/documents/{docId}_{sanitisedName}`
 *   4. Retrieve the public download URL
 *   5. Write metadata to `caseDocuments/{docId}` in Firestore
 *   6. Increment `documentCount` on the parent case (best-effort)
 *   7. Re-fetch the Firestore record to return resolved server timestamps
 *
 * @param payload    - Upload parameters: caseId, file, userId, uploadedBy.
 * @param onProgress - Optional callback receiving upload progress (0 – 100).
 *                     Useful for progress bars in the UI.
 * @returns The newly created `DocumentRecord`.
 *
 * @example
 * const result = await uploadDocument(
 *   { caseId: "abc123", file, userId: "u1", uploadedBy: "Amit Sharma" },
 *   (pct) => setUploadProgress(pct),
 * );
 * if (result.success) console.log(result.data.downloadURL);
 */
export async function uploadDocument(
  payload: UploadDocumentPayload,
  onProgress?: (percent: number) => void
): Promise<ServiceResult<DocumentRecord>> {
  const { caseId, file, userId, uploadedBy } = payload;

  // ── 1. Input validation ───────────────────────────────────────────────────
  if (!caseId?.trim()) {
    return { success: false, error: "A valid case ID is required." };
  }
  if (!userId?.trim()) {
    return { success: false, error: "A valid user ID is required." };
  }
  if (!file) {
    return { success: false, error: "No file was provided." };
  }
  if (!isAllowedMimeType(file.type)) {
    const allowed = Object.values(MIME_TYPE_LABELS).join(", ");
    return {
      success: false,
      error: `File type "${file.type || "unknown"}" is not supported. Allowed: ${allowed}.`,
    };
  }
  if (file.size === 0) {
    return { success: false, error: "The provided file is empty (0 bytes)." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    return {
      success: false,
      error: `File size (${sizeMB} MB) exceeds the 50 MB maximum.`,
    };
  }

  try {
    // ── 2. Pre-generate Firestore document ID ─────────────────────────────────
    // Using the Firestore auto-ID as a filename prefix ensures the storage path
    // is unique — no Math.random() or timestamp-based suffix needed.
    const docRef  = doc(documentsRef());
    const docId   = docRef.id;

    // ── 3. Build Storage path ─────────────────────────────────────────────────
    const sanitised   = sanitiseFileName(file.name);
    const fileName    = `${docId}_${sanitised}`;
    const storagePath = `cases/${caseId}/documents/${fileName}`;
    const fileRef     = storageRef(storage, storagePath);

    // ── 4. Upload to Firebase Storage ─────────────────────────────────────────
    const downloadURL = await new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(fileRef, file, {
        contentType: file.type,
        // Custom metadata is visible in the Firebase Console and Storage rules.
        customMetadata: {
          docId,
          caseId,
          userId,
          originalName: file.name,
        },
      });

      task.on(
        "state_changed",
        (snapshot) => {
          // Emit progress as a 0–100 integer.
          if (onProgress) {
            const pct = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            onProgress(pct);
          }
        },
        // Upload error handler.
        (err: StorageError) => reject(err),
        // Upload complete handler.
        async () => {
          try {
            onProgress?.(100);
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });

    // ── 5. Write Firestore metadata ───────────────────────────────────────────
    // All future AI / processing fields are seeded as false / null.
    // The AI and OCR services will update them independently.
    await setDoc(docRef, {
      caseId,
      userId,
      fileName,
      originalName:     file.name,
      mimeType:         file.type as AllowedMimeType,
      fileSize:         file.size,
      downloadURL,
      storagePath,
      pageCount:        null,    // set by future PDF-parsing service
      uploadedBy,
      uploadedAt:       serverTimestamp(),
      status:           "ready" satisfies DocumentStatus,
      // Future AI / pipeline flags — always false at creation
      ocrCompleted:     false,
      aiProcessed:      false,
      summaryGenerated: false,
      embeddingCreated: false,
      vectorId:         null,
    });

    // ── 6. Increment documentCount on the parent case (best-effort) ───────────
    await adjustCaseDocumentCount(caseId, 1);

    // ── 7. Re-fetch to return resolved server timestamps ──────────────────────
    // FieldValue sentinels (serverTimestamp) are not readable from the local
    // write result; a round-trip is necessary to get the real Timestamp.
    const created      = await getDoc(docRef);
    const documentRecord = snapshotToDocument(created);

    if (!documentRecord) {
      return {
        success: false,
        error: "Document was uploaded but its metadata could not be retrieved.",
      };
    }

    return { success: true, data: documentRecord };
  } catch (err) {
    const { message, code } = normaliseError(err);
    return {
      success: false,
      error: `Failed to upload document: ${message}`,
      code,
    };
  }
}

/**
 * Permanently deletes a document from both Firebase Storage and Firestore.
 *
 * Deletion order (deliberate):
 *   1. Fetch Firestore metadata → obtain `storagePath` and `caseId`
 *   2. Delete file from Firebase Storage
 *      (if the file is already absent, this is treated as a no-op)
 *   3. Delete metadata document from Firestore
 *   4. Decrement `documentCount` on the parent case (best-effort)
 *
 * If the Storage deletion fails for any reason other than "file not found",
 * the Firestore record is preserved and the error is returned to the caller.
 *
 * @param documentId - The Firestore document ID in `caseDocuments`.
 * @returns `{ success: true, data: documentId }` on success.
 *
 * @example
 * const result = await deleteDocument("xyz789");
 * if (result.success) removeDocumentFromUI(result.data);
 */
export async function deleteDocument(
  documentId: string
): Promise<ServiceResult<string>> {
  if (!documentId?.trim()) {
    return { success: false, error: "A valid document ID is required." };
  }

  try {
    // ── 1. Fetch metadata ─────────────────────────────────────────────────────
    const snap = await getDoc(documentDocRef(documentId));
    if (!snap.exists()) {
      return {
        success: false,
        error: `Document with ID "${documentId}" was not found.`,
      };
    }

    const data        = snap.data();
    const storagePath = (data.storagePath ?? "") as string;
    const caseId      = (data.caseId      ?? "") as string;

    // ── 2. Delete from Firebase Storage ───────────────────────────────────────
    if (storagePath) {
      try {
        await deleteObject(storageRef(storage, storagePath));
      } catch (storageErr: unknown) {
        // "storage/object-not-found" means the file was already removed
        // (e.g. manual deletion via the Firebase Console).
        // Treat this as a non-fatal condition and continue with Firestore cleanup.
        const typed = storageErr as { code?: string };
        if (typed?.code !== "storage/object-not-found") {
          const { message, code } = normaliseError(storageErr);
          return {
            success: false,
            error: `Failed to delete file from storage: ${message}`,
            code,
          };
        }
      }
    }

    // ── 3. Delete Firestore metadata ──────────────────────────────────────────
    await deleteDoc(documentDocRef(documentId));

    // ── 4. Decrement documentCount on the parent case (best-effort) ───────────
    if (caseId) {
      await adjustCaseDocumentCount(caseId, -1);
    }

    return { success: true, data: documentId };
  } catch (err) {
    const { message, code } = normaliseError(err);
    return {
      success: false,
      error: `Failed to delete document "${documentId}": ${message}`,
      code,
    };
  }
}

/**
 * Fetches all documents belonging to a case as a one-time read,
 * ordered by `uploadedAt` descending (most recent first).
 *
 * For live updates, prefer `subscribeDocuments()` instead.
 *
 * @param caseId - The Firestore document ID of the parent case.
 * @returns An array of `DocumentRecord`s (may be empty).
 *
 * @example
 * const result = await getDocuments("abc123");
 * if (result.success) setDocuments(result.data);
 */
export async function getDocuments(
  caseId: string,
  userId: string
): Promise<ServiceResult<DocumentRecord[]>> {
  if (!caseId?.trim()) {
    return { success: false, error: "A valid case ID is required." };
  }

  try {
    const q = query(
      documentsRef(),
      where("caseId", "==", caseId),
      where("userId", "==", userId),
      orderBy("uploadedAt", "desc")
    );
    const snapshot = await getDocs(q);
    return { success: true, data: querySnapshotToDocuments(snapshot) };
  } catch (err) {
    const { message, code } = normaliseError(err);
    return {
      success: false,
      error: `Failed to fetch documents for case "${caseId}": ${message}`,
      code,
    };
  }
}

/**
 * Opens a real-time Firestore listener for all documents belonging to a case.
 *
 * The callback fires immediately with the current state, then again on every
 * subsequent change (upload, delete, metadata update).
 *
 * @param caseId   - The Firestore document ID of the parent case.
 * @param onUpdate - Called with the full, up-to-date document list on every change.
 * @param onError  - Called if the listener encounters a Firestore error.
 * @returns An `Unsubscribe` function — call it to stop listening.
 *          Always call this in a React `useEffect` cleanup or equivalent.
 *
 * @example
 * const unsubscribe = subscribeDocuments(
 *   caseId,
 *   (docs) => setDocuments(docs),
 *   (err)  => console.error(err.error),
 * );
 * // Stop listening (e.g. component unmount):
 * unsubscribe();
 */
export function subscribeDocuments(
  caseId: string,
  userId: string,
  onUpdate: (documents: DocumentRecord[]) => void,
  onError?: (error: ServiceError) => void
): Unsubscribe {
  const q = query(
    documentsRef(),
    where("caseId", "==", caseId),
    where("userId", "==", userId),
    orderBy("uploadedAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot) => {
      onUpdate(querySnapshotToDocuments(snapshot));
    },
    (err: FirestoreError) => {
      const serviceError: ServiceError = {
        success: false,
        error: `Real-time document listener error: ${err.message}`,
        code:  err.code,
      };
      onError?.(serviceError);
    }
  );
}