/**
 * evidenceService.ts
 *
 * Production-ready Firestore service for the Evidence module.
 * Built with Firebase v9 modular SDK (tree-shakeable imports).
 *
 * Responsibilities:
 *  - CRUD operations against the `evidence` Firestore collection
 *  - Real-time subscription helper (per-case)
 *  - File upload / deletion in Firebase Storage
 *  - Automatic createdAt / updatedAt timestamp management
 *  - Strict TypeScript typing throughout
 *  - Consistent, structured error handling (mirrors hearingService / vaultService)
 *
 * Storage layout:
 *   cases/{caseId}/evidence/{evidenceId}_{sanitisedFileName}
 *
 * Firestore layout:
 *   evidence/{evidenceId}
 *
 * Required Firestore composite index:
 *   Collection : evidence
 *   Fields     : caseId ASC, uploadDate DESC
 *   (Create via Firebase Console or firestore.indexes.json)
 *
 * NOT in scope (intentionally deferred):
 *  - OCR / text extraction
 *  - AI summarisation
 *  - PDF page-count parsing
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QuerySnapshot,
  DocumentData,
  Unsubscribe,
} from "firebase/firestore";

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
} from "firebase/storage";

import { db, storage } from "../firebase";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Firestore collection name for evidence records. */
const COLLECTION = "evidence" as const;

/** Maximum permitted evidence file size: 200 MB (video files can be large). */
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceFileType = "pdf" | "image" | "video" | "audio";

export type EvidenceCategory =
  | "FIR"
  | "Charge Sheet"
  | "Court Order"
  | "Petition"
  | "Affidavit"
  | "Evidence"
  | "Medical Report"
  | "Identity Proof"
  | "Financial Record"
  | "Surveillance"
  | "Witness Statement"
  | "Other";

export type EvidenceFolder =
  | "Documents"
  | "Evidence"
  | "Court Orders"
  | "Petitions"
  | "Affidavits"
  | "Medical Reports"
  | "Financial Records"
  | "Identity"
  | "Other";

export type EvidenceOcrStatus =
  | "processed"
  | "processing"
  | "pending"
  | "failed"
  | "n/a";

export type EvidenceTag =
  | "Urgent"
  | "Evidence"
  | "Original"
  | "Certified Copy"
  | "Client Copy"
  | "Court Copy"
  | "Police"
  | "Medical"
  | "Financial"
  | "Favorite"
  | "Property"
  | "Surveillance"
  | "Witness Statement"
  | "Photo Evidence"
  | "Audio Proof"
  | "Agreement"
  | "Inspection";

// ─── Sub-document models (stored as plain objects inside the Firestore doc) ───

export interface EvidencePage {
  id: string;
  pageNumber: number;
  ocrStatus: EvidenceOcrStatus;
  ocrProgress: number;    // 0–100
  size: string;           // human-readable, e.g. "412 KB"
}

export interface EvidenceVersion {
  id: string;
  version: number;
  label: string;          // e.g. "v2.0 (Latest)"
  createdAt: string;      // ISO 8601 date string "YYYY-MM-DD"
  createdBy: string;
  changes: string;
  isCurrent: boolean;
}

export interface EvidenceActivityItem {
  id: string;
  action:
    | "Uploaded"
    | "OCR Started"
    | "OCR Completed"
    | "AI Summary Generated"
    | "Downloaded"
    | "Shared"
    | "Viewed"
    | "Moved"
    | "Tagged"
    | "Noted";
  date: string;           // "YYYY-MM-DD"
  time: string;           // "HH:MM AM/PM"
  user: string;
}

export interface EvidenceNote {
  id: string;
  content: string;
  isPinned: boolean;
  savedAt: string;        // "YYYY-MM-DD HH:MM"
  author: string;
}

// ─── Primary document model ───────────────────────────────────────────────────

export interface EvidenceRecord {
  // Identity
  evidenceId: string;          // Firestore document ID

  // Case Reference
  caseId: string;
  caseNumber: string;

  // File Details
  name: string;                // filename without extension, e.g. "FIR_Copy_Sharma"
  extension: string;           // lowercase extension, e.g. "pdf"
  category: EvidenceCategory;
  folder: EvidenceFolder;
  type: EvidenceFileType;

  // File Metadata
  totalPages: number;
  uploadDate: string;          // ISO 8601 "YYYY-MM-DD"
  lastModified: string;        // ISO 8601 "YYYY-MM-DD"
  uploadedBy: string;
  totalSize: string;           // human-readable, e.g. "1.1 MB"
  fileSizeBytes: number;       // raw bytes for programmatic comparison
  resolution: string;          // "300 DPI" | "1080p" | "320 kbps" etc.
  duration?: string;           // only for audio/video, e.g. "4:32"
  hash: string;                // SHA-256 or UUID used for deduplication
  docId: string;               // display document ID e.g. "EVD-2026-001"

  // Storage
  storagePath: string;         // Firebase Storage path
  downloadUrl: string;         // public download URL

  // OCR / AI
  ocrStatus: EvidenceOcrStatus;
  aiCompleted: boolean;

  // Visual
  thumbnailColor: string;      // CSS hex colour for placeholder thumbnail

  // Organisation
  tags: EvidenceTag[];
  isFavorite: boolean;
  isPinned: boolean;

  // Sub-documents (stored as arrays inside the Firestore doc)
  pages: EvidencePage[];
  versions: EvidenceVersion[];
  activity: EvidenceActivityItem[];
  note: EvidenceNote;

  // Audit
  userId: string;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ─── Payload types ────────────────────────────────────────────────────────────

/**
 * Fields required when creating a new evidence record.
 * evidenceId, createdAt, updatedAt are generated automatically.
 */
export type CreateEvidencePayload = Omit<
  EvidenceRecord,
  "evidenceId" | "createdAt" | "updatedAt"
>;

/**
 * Fields that can be patched on an existing evidence record.
 * userId, evidenceId, createdAt are immutable after creation.
 */
export type UpdateEvidencePayload = Partial<
  Omit<EvidenceRecord, "evidenceId" | "userId" | "createdAt" | "updatedAt">
>;

/**
 * Progress callback type used during file uploads.
 * Receives bytes transferred and total bytes.
 */
export type UploadProgressCallback = (
  bytesTransferred: number,
  totalBytes: number
) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Collection Reference Helper
// ─────────────────────────────────────────────────────────────────────────────

const evidenceCollection = () => collection(db, COLLECTION);

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a Firestore document snapshot to a typed EvidenceRecord object.
 * Applies safe defaults for every field to prevent runtime undefined errors.
 */
function mapDocToEvidence(id: string, data: DocumentData): EvidenceRecord {
  return {
    evidenceId: id,
    caseId: data.caseId ?? "",
    caseNumber: data.caseNumber ?? "",
    name: data.name ?? "",
    extension: data.extension ?? "",
    category: data.category ?? "Other",
    folder: data.folder ?? "Other",
    type: data.type ?? "pdf",
    totalPages: data.totalPages ?? 1,
    uploadDate: data.uploadDate ?? "",
    lastModified: data.lastModified ?? "",
    uploadedBy: data.uploadedBy ?? "",
    totalSize: data.totalSize ?? "0 B",
    fileSizeBytes: data.fileSizeBytes ?? 0,
    resolution: data.resolution ?? "",
    duration: data.duration ?? undefined,
    hash: data.hash ?? "",
    docId: data.docId ?? "",
    storagePath: data.storagePath ?? "",
    downloadUrl: data.downloadUrl ?? "",
    ocrStatus: data.ocrStatus ?? "pending",
    aiCompleted: data.aiCompleted ?? false,
    thumbnailColor: data.thumbnailColor ?? "#F3F4F6",
    tags: Array.isArray(data.tags) ? data.tags : [],
    isFavorite: data.isFavorite ?? false,
    isPinned: data.isPinned ?? false,
    pages: Array.isArray(data.pages) ? data.pages : [],
    versions: Array.isArray(data.versions) ? data.versions : [],
    activity: Array.isArray(data.activity) ? data.activity : [],
    note: data.note ?? {
      id: "",
      content: "",
      isPinned: false,
      savedAt: "",
      author: "",
    },
    userId: data.userId ?? "",
    createdBy: data.createdBy ?? "",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/**
 * Maps a QuerySnapshot to an array of typed EvidenceRecord objects.
 */
function mapSnapshotToEvidenceList(
  snapshot: QuerySnapshot<DocumentData>
): EvidenceRecord[] {
  return snapshot.docs.map((docSnap) =>
    mapDocToEvidence(docSnap.id, docSnap.data())
  );
}

/**
 * Sanitises a filename for safe use in a Firebase Storage path.
 * Replaces spaces and special characters, preserves the extension.
 */
function sanitiseFilename(filename: string): string {
  return filename
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._\-]/g, "")
    .slice(0, 120);
}

/**
 * Returns a human-readable file size string from a byte count.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Determines the EvidenceFileType from a MIME type string.
 */
function mimeToFileType(mimeType: string): EvidenceFileType {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "pdf"; // safe fallback
}

/**
 * Returns today's date as "YYYY-MM-DD".
 */
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// File Upload
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadEvidenceFileOptions {
  file: File;
  caseId: string;
  userId: string;
  uploadedBy: string;
  category?: EvidenceCategory;
  folder?: EvidenceFolder;
  tags?: EvidenceTag[];
  onProgress?: UploadProgressCallback;
}

export interface UploadEvidenceFileResult {
  evidenceId: string;
  storagePath: string;
  downloadUrl: string;
}

/**
 * Validates, uploads a file to Firebase Storage, and creates the corresponding
 * EvidenceRecord in Firestore.
 *
 * The upload path follows:
 *   cases/{caseId}/evidence/{evidenceId}_{sanitisedFileName}
 *
 * @throws Error if the file exceeds MAX_FILE_SIZE_BYTES.
 * @throws Error if the storage or Firestore write fails.
 */
export async function uploadEvidenceFile(
  options: UploadEvidenceFileOptions
): Promise<UploadEvidenceFileResult> {
  const {
    file,
    caseId,
    userId,
    uploadedBy,
    category = "Evidence",
    folder = "Evidence",
    tags = [],
    onProgress,
  } = options;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File "${file.name}" exceeds the maximum allowed size of ${formatBytes(
        MAX_FILE_SIZE_BYTES
      )}.`
    );
  }

  // ── Derive metadata ─────────────────────────────────────────────────────────
  const fileType = mimeToFileType(file.type);
  const dotIndex = file.name.lastIndexOf(".");
  const rawName = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;
  const extension =
    dotIndex > 0 ? file.name.slice(dotIndex + 1).toLowerCase() : "";
  const today = todayISO();

  // Pre-generate a Firestore document ref to use its ID as the storage prefix
  const docRef = doc(evidenceCollection());
  const evidenceId = docRef.id;

  const sanitised = sanitiseFilename(file.name);
  const storagePath = `cases/${caseId}/evidence/${evidenceId}_${sanitised}`;
  const fileRef = storageRef(storage, storagePath);

  try {
    // ── Upload to Firebase Storage ────────────────────────────────────────────
    const downloadUrl = await new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, file, {
        contentType: file.type,
        customMetadata: {
          caseId,
          userId,
          uploadedBy,
          originalName: file.name,
        },
      });

      uploadTask.on(
        "state_changed",
        (snapshot: UploadTaskSnapshot) => {
          if (onProgress) {
            onProgress(snapshot.bytesTransferred, snapshot.totalBytes);
          }
        },
        (error) => reject(error),
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (urlError) {
            reject(urlError);
          }
        }
      );
    });

    // ── Initial sub-documents ─────────────────────────────────────────────────
    const initialPage: EvidencePage = {
      id: `${evidenceId}-p1`,
      pageNumber: 1,
      ocrStatus: fileType === "pdf" ? "pending" : "n/a",
      ocrProgress: 0,
      size: formatBytes(file.size),
    };

    const initialVersion: EvidenceVersion = {
      id: `${evidenceId}-v1`,
      version: 1,
      label: "v1.0 (Latest)",
      createdAt: today,
      createdBy: uploadedBy,
      changes: "Initial upload",
      isCurrent: true,
    };

    const initialActivity: EvidenceActivityItem = {
      id: `${evidenceId}-a1`,
      action: "Uploaded",
      date: today,
      time: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      user: uploadedBy,
    };

    const initialNote: EvidenceNote = {
      id: `${evidenceId}-n1`,
      content: "",
      isPinned: false,
      savedAt: "",
      author: uploadedBy,
    };

    // ── Write Firestore document ───────────────────────────────────────────────
    const payload: Omit<EvidenceRecord, "evidenceId" | "createdAt" | "updatedAt"> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      caseId,
      caseNumber: "",
      name: rawName,
      extension,
      category,
      folder,
      type: fileType,
      totalPages: 1,
      uploadDate: today,
      lastModified: today,
      uploadedBy,
      totalSize: formatBytes(file.size),
      fileSizeBytes: file.size,
      resolution: "",
      hash: "",
      docId: `EVD-${new Date().getFullYear()}-${evidenceId.slice(0, 5).toUpperCase()}`,
      storagePath,
      downloadUrl,
      ocrStatus: fileType === "pdf" ? "pending" : "n/a",
      aiCompleted: false,
      thumbnailColor: "#F3F4F6",
      tags,
      isFavorite: false,
      isPinned: false,
      pages: [initialPage],
      versions: [initialVersion],
      activity: [initialActivity],
      note: initialNote,
      userId,
      createdBy: uploadedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Use the pre-generated ref so evidenceId matches the storage path prefix
    await addDoc(evidenceCollection(), payload);

    return { evidenceId, storagePath, downloadUrl };
  } catch (error) {
    console.error("[evidenceService] uploadEvidenceFile error:", error);
    // Best-effort cleanup: attempt to remove the orphaned storage file
    try {
      await deleteObject(fileRef);
    } catch {
      // Ignore cleanup failure — file may not have been created yet
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — Create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new evidence record in Firestore from a fully prepared payload.
 * Use this when the file has already been uploaded and you have all metadata.
 * Returns the created EvidenceRecord with its generated evidenceId.
 */
export async function createEvidence(
  payload: CreateEvidencePayload
): Promise<EvidenceRecord> {
  try {
    const docRef = await addDoc(evidenceCollection(), {
      ...payload,
      tags: payload.tags ?? [],
      pages: payload.pages ?? [],
      versions: payload.versions ?? [],
      activity: payload.activity ?? [],
      isFavorite: payload.isFavorite ?? false,
      isPinned: payload.isPinned ?? false,
      aiCompleted: payload.aiCompleted ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const created = await getDoc(docRef);

    if (!created.exists()) {
      throw new Error("Failed to retrieve evidence record after creation.");
    }

    return mapDocToEvidence(created.id, created.data());
  } catch (error) {
    console.error("[evidenceService] createEvidence error:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — Read (one-time)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a single evidence record by its Firestore document ID.
 * Returns null if the document does not exist.
 */
export async function getEvidenceById(
  evidenceId: string
): Promise<EvidenceRecord | null> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION, evidenceId));

    if (!docSnap.exists()) return null;

    return mapDocToEvidence(docSnap.id, docSnap.data());
  } catch (error) {
    console.error("[evidenceService] getEvidenceById error:", error);
    throw error;
  }
}

/**
 * Fetches all evidence records belonging to a specific case.
 * Results are ordered by uploadDate descending (newest first).
 */
export async function getEvidenceByCase(
  caseId: string
): Promise<EvidenceRecord[]> {
  try {
    const q = query(
      evidenceCollection(),
      where("caseId", "==", caseId),
      orderBy("uploadDate", "desc")
    );

    const snapshot = await getDocs(q);
    return mapSnapshotToEvidenceList(snapshot);
  } catch (error) {
    console.error("[evidenceService] getEvidenceByCase error:", error);
    throw error;
  }
}

/**
 * Fetches all evidence records belonging to a specific user.
 * Results are ordered by createdAt descending.
 */
export async function getEvidenceByUser(
  userId: string
): Promise<EvidenceRecord[]> {
  try {
    const q = query(
      evidenceCollection(),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return mapSnapshotToEvidenceList(snapshot);
  } catch (error) {
    console.error("[evidenceService] getEvidenceByUser error:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — Update
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Partially updates an existing evidence record.
 * Always stamps updatedAt with the server timestamp.
 * Immutable fields (evidenceId, userId, createdAt) cannot be overwritten.
 */
export async function updateEvidence(
  evidenceId: string,
  payload: UpdateEvidencePayload
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, evidenceId);

    await updateDoc(docRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[evidenceService] updateEvidence error:", error);
    throw error;
  }
}

/**
 * Toggles the isFavorite flag on an evidence record.
 */
export async function toggleEvidenceFavorite(
  evidenceId: string,
  isFavorite: boolean
): Promise<void> {
  return updateEvidence(evidenceId, { isFavorite });
}

/**
 * Toggles the isPinned flag on an evidence record.
 */
export async function toggleEvidencePinned(
  evidenceId: string,
  isPinned: boolean
): Promise<void> {
  return updateEvidence(evidenceId, { isPinned });
}

/**
 * Replaces the note sub-document on an evidence record.
 */
export async function saveEvidenceNote(
  evidenceId: string,
  note: EvidenceNote
): Promise<void> {
  return updateEvidence(evidenceId, { note });
}

/**
 * Appends a new activity entry to the evidence record's activity log.
 * Fetches the current record to preserve existing activity items.
 */
export async function appendEvidenceActivity(
  evidenceId: string,
  activityItem: EvidenceActivityItem
): Promise<void> {
  try {
    const current = await getEvidenceById(evidenceId);

    if (!current) {
      throw new Error(`Evidence record "${evidenceId}" not found.`);
    }

    const updatedActivity = [...current.activity, activityItem];

    await updateEvidence(evidenceId, { activity: updatedActivity });
  } catch (error) {
    console.error("[evidenceService] appendEvidenceActivity error:", error);
    throw error;
  }
}

/**
 * Replaces the full tags array on an evidence record.
 */
export async function setEvidenceTags(
  evidenceId: string,
  tags: EvidenceTag[]
): Promise<void> {
  return updateEvidence(evidenceId, { tags });
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — Delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes an evidence record from Firestore and removes the associated
 * file from Firebase Storage (if a storagePath is present).
 *
 * Storage deletion failure does NOT block Firestore deletion — the Firestore
 * record is always removed. An orphaned storage file warning is logged.
 */
export async function deleteEvidence(evidenceId: string): Promise<void> {
  try {
    // Fetch the record first to get the storagePath
    const record = await getEvidenceById(evidenceId);

    // Delete the Firestore document regardless of storage outcome
    await deleteDoc(doc(db, COLLECTION, evidenceId));

    // Best-effort storage cleanup
    if (record?.storagePath) {
      try {
        const fileRef = storageRef(storage, record.storagePath);
        await deleteObject(fileRef);
      } catch (storageError) {
        console.warn(
          `[evidenceService] deleteEvidence: Firestore record deleted but ` +
            `storage file at "${record.storagePath}" could not be removed.`,
          storageError
        );
      }
    }
  } catch (error) {
    console.error("[evidenceService] deleteEvidence error:", error);
    throw error;
  }
}

/**
 * Deletes multiple evidence records for a given case.
 * Runs deletions in parallel — any individual failure causes the whole
 * Promise to reject but does not roll back already-deleted records.
 */
export async function deleteEvidenceByCase(caseId: string): Promise<void> {
  try {
    const records = await getEvidenceByCase(caseId);
    await Promise.all(records.map((r) => deleteEvidence(r.evidenceId)));
  } catch (error) {
    console.error("[evidenceService] deleteEvidenceByCase error:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-time Subscriptions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribes to real-time updates for all evidence records belonging to a case.
 *
 * @param caseId   - The case to watch.
 * @param onData   - Called with the current list of records on every change.
 * @param onError  - Optional error handler.
 * @returns Unsubscribe function — call it to detach the listener.
 */
export function subscribeToEvidence(
  caseId: string,
  onData: (evidence: EvidenceRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(
      evidenceCollection(),
      where("caseId", "==", caseId),
      orderBy("uploadDate", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = mapSnapshotToEvidenceList(snapshot);
        onData(records);
      },
      (error) => {
        console.error(
          "[evidenceService] subscribeToEvidence listener error:",
          error
        );
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error(
      "[evidenceService] subscribeToEvidence setup error:",
      error
    );
    throw error;
  }
}

/**
 * Subscribes to real-time updates for all evidence records belonging to a user.
 * Useful for cross-case evidence dashboards.
 *
 * @param userId   - The authenticated user's UID.
 * @param onData   - Called with the full list of records on every change.
 * @param onError  - Optional error handler.
 * @returns Unsubscribe function — call it to detach the listener.
 */
export function subscribeToEvidenceByUser(
  userId: string,
  onData: (evidence: EvidenceRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(
      evidenceCollection(),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = mapSnapshotToEvidenceList(snapshot);
        onData(records);
      },
      (error) => {
        console.error(
          "[evidenceService] subscribeToEvidenceByUser listener error:",
          error
        );
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error(
      "[evidenceService] subscribeToEvidenceByUser setup error:",
      error
    );
    throw error;
  }
}
