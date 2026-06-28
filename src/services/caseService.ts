/**
 * caseService.ts
 *
 * Production-ready Firestore service for the Cases module.
 * Built with Firebase v9 modular SDK (tree-shakeable imports).
 *
 * Responsibilities:
 *  - CRUD operations against the `cases` Firestore collection
 *  - Real-time subscription helper
 *  - Automatic createdAt / updatedAt timestamp management
 *  - Strict TypeScript typing throughout
 *  - Consistent, structured error handling
 *
 * NOT in scope (intentionally deferred):
 *  - Document / file upload
 *  - AI integrations
 *  - Hearings sub-collection
 */

import {
  collection,
  doc,
  runTransaction,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  FirestoreError,
  QuerySnapshot,
  DocumentSnapshot,
  Unsubscribe,
  PartialWithFieldValue,
  where,
} from "firebase/firestore";

import { db, storage } from "../firebase"; // adjust path to match your Firebase initialisation file

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COLLECTION = "cases" as const;

/**
 * Top-level Firestore collection that holds atomic sequence counters.
 * Structure: counters/{CASES_COUNTER_DOC} → { lastNumber: number }
 */
const COUNTERS_COLLECTION = "counters" as const;

/**
 * Document ID within `counters` that owns the Cases sequence.
 * Intentionally named "cases" to mirror the main collection.
 */
const CASES_COUNTER_DOC = "cases" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

// ── Status / classification union types ───────────────────────────────────────

/** Lifecycle status of a legal case. */
export type CaseStatus =
  | "active"      // Case is open and being actively worked
  | "pending"     // Awaiting action (client, court, opposing party)
  | "closed"      // Case concluded
  | "on_hold"     // Temporarily paused
  | "archived";   // Retained for records; no active work

/** Urgency / priority level for workload triage. */
export type CasePriority = "low" | "medium" | "high" | "urgent";

/**
 * AI-derived risk level.
 * Populated automatically once AI analysis runs; do not set manually.
 */
export type CaseRiskLevel = "low" | "medium" | "high" | "critical";

/**
 * Lifecycle status of an AI summary generation job.
 *
 * - `none`        → AI has never been triggered for this case
 * - `pending`     → Job queued, not yet started
 * - `processing`  → AI is actively generating the summary
 * - `completed`   → Summary is available in `aiSummary`
 * - `failed`      → Generation failed; may be retried
 */
export type AIStatus = "none" | "pending" | "processing" | "completed" | "failed";

// ── Main document interface ───────────────────────────────────────────────────

/**
 * Canonical shape of a Case document stored in Firestore.
 *
 * Grouped into logical sections that mirror the legal workflow:
 *   1. Identity
 *   2. Client Details
 *   3. Case Details
 *   4. Status & Risk
 *   5. Important Dates
 *   6. AI Fields        (future — populated by AI service)
 *   7. Document Counts  (future — maintained by storage service)
 *   8. Audit Metadata
 *
 * All fields added after the initial release are marked optional (`?`) so
 * existing documents without those fields still deserialise cleanly.
 */
export interface CaseDocument {
  // ── 1. Identity ────────────────────────────────────────────────────────────

  /** Firestore auto-generated document ID. Populated on read; never written. */
  id: string;

  // ── 2. Client Details ──────────────────────────────────────────────────────

  /** Full legal name of the client. */
  clientName: string;

  /** Primary contact phone number (include country code, e.g. "+91 98765 43210"). */
  phone?: string;

  /**
   * WhatsApp-reachable number.
   * May differ from `phone`; omit if same as `phone`.
   */
  whatsapp?: string;

  /** Client e-mail address for correspondence. */
  email?: string;

  /** Street / building address of the client. */
  address?: string;

  /** City of the client's residence or registered address. */
  city?: string;

  /** State / province of the client's address. */
  state?: string;

  /** Postal / PIN code of the client's address. */
  pinCode?: string;

  /**
   * Internal cross-reference identifier for the client record.
   * Useful when a separate `clients` collection exists.
   */
  clientId?: string;

  // ── 3. Case Details ────────────────────────────────────────────────────────

  /**
   * Human-readable case reference number assigned by the practice
   * (e.g. "CASE-2024-001"). Must be unique within the practice.
   */
  caseNumber: string;

  /** Short, descriptive title of the case (e.g. "Smith v. State of Delhi"). */
  title: string;

  /**
   * Area or branch of law
   * (e.g. "Criminal", "Civil", "Family", "Corporate", "Labour").
   */
  caseType: string;

  /** Name of the court where the matter is currently listed. */
  courtName?: string;

  /** Name of the presiding judge or magistrate. */
  judgeName?: string;

  /**
   * Police station where the FIR was registered.
   * Relevant for criminal matters only.
   */
  policeStation?: string;

  /**
   * First Information Report number.
   * Relevant for criminal matters only.
   */
  firNumber?: string;

  /**
   * Applicable sections / acts charged or invoked
   * (e.g. ["IPC 302", "IPC 34", "Arms Act 25"]).
   * Stored as an array to support multiple sections.
   */
  sections?: string[];

  /**
   * Name(s) of the opposite party / respondent / accused.
   * Free-text to accommodate multiple names or entity names.
   */
  oppositeParty?: string;

  /**
   * Name of the advocate appearing on record for this case.
   * May differ from the internal `assignedTo` user.
   */
  advocateName?: string;

  /**
   * Free-form description or background notes about the case.
   * Not shown to clients.
   */
  description?: string;

  /**
   * UID of the internal user (attorney / staff) who owns this case.
   * Used for access control and workload dashboards.
   */
  assignedTo?: string;

  /** Arbitrary tags for search and filter (e.g. ["pro-bono", "urgent"]). */
  tags?: string[];

  /** Internal notes visible only to assigned team members. */
  notes?: string;

  // ── 4. Status & Risk ───────────────────────────────────────────────────────

  /** Current lifecycle status of the case. */
  status: CaseStatus;

  /** Manually assigned urgency / priority level. */
  priority: CasePriority;

  /**
   * AI-computed risk score from 0 (no risk) to 100 (critical risk).
   * Populated by the AI service; do not set manually.
   */
  riskScore?: number;

  /**
   * Categorical risk level derived from `riskScore`.
   * Populated by the AI service; do not set manually.
   */
  riskLevel?: CaseRiskLevel;

  // ── 5. Important Dates ─────────────────────────────────────────────────────

  /** ISO 8601 date the case was officially opened (e.g. "2024-03-15"). */
  openedDate: string;

  /**
   * ISO 8601 date the case was (or is expected to be) closed.
   * Set when `status` transitions to "closed".
   */
  closedDate?: string;

  /** ISO 8601 date of the next scheduled court hearing. */
  nextHearingDate?: string;

  /**
   * Time of the next hearing in 24-hour format (e.g. "10:30").
   * Stored as a string to avoid timezone ambiguity at the storage layer.
   */
  nextHearingTime?: string;

  /**
   * ISO 8601 date by which the case is expected to be concluded.
   * Used for workload planning and client communication.
   */
  expectedClosure?: string;

  // ── 6. AI Fields (future — do not populate manually) ──────────────────────

  /**
   * AI-generated plain-language summary of the case.
   * Populated by the AI summarisation service when `aiStatus === "completed"`.
   */
  aiSummary?: string;

  /**
   * Whether a valid AI summary currently exists for this case.
   * Toggled to `true` by the AI service on successful generation.
   */
  aiSummaryGenerated?: boolean;

  /**
   * Current state of the AI summary generation pipeline.
   * Defaults to `"none"` on new cases.
   */
  aiStatus?: AIStatus;

  // ── 7. Document Counts (future — maintained by storage service) ────────────

  /**
   * Total number of documents attached to this case.
   * Incremented / decremented by the document upload service.
   */
  documentCount?: number;

  /**
   * Number of items tagged as evidence within this case.
   * Subset of `documentCount`; maintained by the document service.
   */
  evidenceCount?: number;

  // ── 8. Audit Metadata ──────────────────────────────────────────────────────

  /**
   * Display name or UID of the user who created this case record.
   * Captured at creation time for audit trails.
   */
  createdBy?: string;

  /**
   * Firebase Auth UID of the user who created this case.
   * Use for security-rule scoped queries.
   */
  userId?: string;

  /** Server timestamp set once at document creation. Never updated. */
  createdAt: Timestamp | null;

  /** Server timestamp refreshed on every write by the service layer. */
  updatedAt: Timestamp | null;
}

// ── Payload types ─────────────────────────────────────────────────────────────

/**
 * Payload accepted by `createCase()`.
 *
 * `id`, `caseNumber`, `createdAt`, and `updatedAt` are injected automatically
 * by the service and must NOT be supplied by the caller.
 *
 * `caseNumber` is generated inside an atomic Firestore transaction that reads
 * and increments the `counters/cases` document, guaranteeing a unique,
 * gap-free sequence even under concurrent writes.
 */
export type CreateCasePayload = Omit<
  CaseDocument,
  "id" | "caseNumber" | "createdAt" | "updatedAt"
>;

/**
 * Payload accepted by `updateCase()`.
 *
 * Every field is optional — only the fields supplied are written to Firestore.
 * `id`, `createdAt`, and `updatedAt` are managed by the service.
 */
export type UpdateCasePayload = Partial<
  Omit<CaseDocument, "id" | "createdAt" | "updatedAt">
>;

// ─────────────────────────────────────────────────────────────────────────────
// Service-level response wrappers
// ─────────────────────────────────────────────────────────────────────────────

/** Uniform success wrapper. */
export interface ServiceSuccess<T> {
  success: true;
  data: T;
}

/** Uniform error wrapper — never throws; always returns a typed error shape. */
export interface ServiceError {
  success: false;
  error: string;
  /** Original Firestore error code when applicable (e.g. "permission-denied"). */
  code?: string;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceError;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a reference to the top-level `cases` collection. */
function casesRef() {
  return collection(db, COLLECTION);
}

/** Returns a reference to a single case document. */
function caseDocRef(id: string) {
  return doc(db, COLLECTION, id);
}

/**
 * Converts a raw Firestore `DocumentSnapshot` into a typed `CaseDocument`.
 * Returns `null` when the snapshot does not exist.
 */
function snapshotToCase(snapshot: DocumentSnapshot): CaseDocument | null {
  if (!snapshot.exists()) return null;

  const data = snapshot.data();

  return {
    id: snapshot.id,
    caseNumber: data.caseNumber ?? "",
    title: data.title ?? "",
    description: data.description ?? "",
    status: data.status ?? "active",
    priority: data.priority ?? "medium",
    caseType: data.caseType ?? "",
    assignedTo: data.assignedTo ?? "",
    clientName: data.clientName ?? "",
    clientId: data.clientId,
    openedDate: data.openedDate ?? "",
    closedDate: data.closedDate,
    nextHearingDate: data.nextHearingDate,
    tags: data.tags ?? [],
    notes: data.notes,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  } satisfies CaseDocument;
}

/**
 * Maps a Firestore `QuerySnapshot` into an array of typed `CaseDocument`s,
 * filtering out any snapshots that fail to deserialise.
 */
function querySnapshotToCases(snapshot: QuerySnapshot): CaseDocument[] {
  return snapshot.docs
    .map(snapshotToCase)
    .filter((c): c is CaseDocument => c !== null);
}

/**
 * Normalises any thrown value into a human-readable message + optional code.
 */
function normaliseError(err: unknown): { message: string; code?: string } {
  if (err instanceof Error) {
    const firestoreErr = err as FirestoreError;
    return {
      message: firestoreErr.message,
      code: firestoreErr.code,
    };
  }
  return { message: "An unexpected error occurred." };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new case document in Firestore with an auto-generated case number.
 *
 * The case number is produced inside a single Firestore transaction that:
 *   1. Reads  `counters/cases` → `lastNumber`
 *   2. Increments the counter   → `nextNumber`
 *   3. Formats the case number  → `PL-<YEAR>-<NNNNNN>`
 *   4. Writes the updated counter back to `counters/cases`
 *   5. Writes the new case document to `cases/<autoId>`
 *
 * Because steps 4 and 5 happen atomically, the sequence is guaranteed to be
 * unique and strictly monotonic — it never repeats and never resets, even
 * when cases are deleted.
 *
 * @param payload - All case fields except `id`, `caseNumber`, and timestamps.
 * @returns The newly created `CaseDocument` including the generated case number.
 *
 * @example
 * const result = await createCase({ title: "State v. Sharma", ... });
 * if (result.success) console.log(result.data.caseNumber); // "PL-2026-000001"
 */
export async function createCase(
  payload: CreateCasePayload
): Promise<ServiceResult<CaseDocument>> {
  try {
    // Pre-allocate the case document ref so we can reference it both inside
    // the transaction (for the write) and outside it (for the re-fetch).
    const newCaseRef  = doc(casesRef());
    const counterRef  = doc(db, COUNTERS_COLLECTION, CASES_COUNTER_DOC);

    // ── Atomic transaction ────────────────────────────────────────────────────
    const caseNumber = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);

      // Safely read lastNumber; treat a missing document as lastNumber = 0.
      const lastNumber: number = counterSnap.exists()
        ? ((counterSnap.data().lastNumber as number) ?? 0)
        : 0;

      const nextNumber  = lastNumber + 1;
      const year        = new Date().getFullYear();
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
      const generated   = `PL-${year}-${String(nextNumber).padStart(6, "0")}-${randomSuffix}`;

      // 1. Persist the incremented counter.
      //    `merge: true` creates the document if it does not exist yet.
      transaction.set(
        counterRef,
        { lastNumber: nextNumber },
        { merge: true }
      );

      // 2. Write the case document in the same atomic batch.
      transaction.set(newCaseRef, {
        ...payload,
        caseNumber: generated,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return generated;
    });
    // ─────────────────────────────────────────────────────────────────────────

    // Re-fetch to obtain the server-resolved Timestamp values for createdAt /
    // updatedAt — FieldValue sentinels are not readable until after the commit.
    const created  = await getDoc(newCaseRef);
    const caseDoc  = snapshotToCase(created);

    if (!caseDoc) {
      return {
        success: false,
        error: `Case ${caseNumber} was created but could not be retrieved immediately.`,
      };
    }

    return { success: true, data: caseDoc };
  } catch (err) {
    const { message, code } = normaliseError(err);
    return { success: false, error: `Failed to create case: ${message}`, code };
  }
}

/**
 * Fetches all cases from Firestore, ordered by `createdAt` descending
 * (newest first).
 *
 * @param userId - The Firebase Auth UID of the current user.
 * @returns An array of `CaseDocument`s (may be empty).
 *
 * @example
 * const result = await getCases("user123");
 * if (result.success) setCases(result.data);
 */
export async function getCases(userId: string): Promise<ServiceResult<CaseDocument[]>> {
  try {
    const q = query(
      casesRef(),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return { success: true, data: querySnapshotToCases(snapshot) };
  } catch (err) {
    const { message, code } = normaliseError(err);
    return { success: false, error: `Failed to fetch cases: ${message}`, code };
  }
}

/**
 * Fetches a single case by its Firestore document ID.
 *
 * @param id - The Firestore document ID.
 * @returns The matching `CaseDocument`, or an error if not found.
 *
 * @example
 * const result = await getCaseById("abc123");
 * if (result.success) setCase(result.data);
 */
export async function getCaseById(
  id: string
): Promise<ServiceResult<CaseDocument>> {
  try {
    if (!id?.trim()) {
      return { success: false, error: "A valid case ID is required." };
    }

    const snapshot = await getDoc(caseDocRef(id));
    const caseDoc = snapshotToCase(snapshot);

    if (!caseDoc) {
      return { success: false, error: `Case with ID "${id}" was not found.` };
    }

    return { success: true, data: caseDoc };
  } catch (err) {
    const { message, code } = normaliseError(err);
    return {
      success: false,
      error: `Failed to fetch case "${id}": ${message}`,
      code,
    };
  }
}

/**
 * Updates an existing case document.
 *
 * Only the supplied fields are written; unspecified fields are untouched.
 * `updatedAt` is refreshed automatically.
 *
 * @param id      - The Firestore document ID of the case to update.
 * @param payload - A partial object containing only the fields to change.
 * @returns The updated `CaseDocument`.
 *
 * @example
 * const result = await updateCase("abc123", { status: "closed" });
 * if (result.success) console.log("Updated:", result.data);
 */
export async function updateCase(
  id: string,
  payload: UpdateCasePayload
): Promise<ServiceResult<CaseDocument>> {
  try {
    if (!id?.trim()) {
      return { success: false, error: "A valid case ID is required." };
    }
    if (!payload || Object.keys(payload).length === 0) {
      return { success: false, error: "No update fields were provided." };
    }

    const firestorePayload: PartialWithFieldValue<CaseDocument> = {
      ...payload,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(caseDocRef(id), firestorePayload);

    // Re-fetch to return the authoritative server state (including new timestamps).
    const updated = await getDoc(caseDocRef(id));
    const caseDoc = snapshotToCase(updated);

    if (!caseDoc) {
      return {
        success: false,
        error: `Case "${id}" was updated but could not be retrieved.`,
      };
    }

    return { success: true, data: caseDoc };
  } catch (err) {
    const { message, code } = normaliseError(err);
    return {
      success: false,
      error: `Failed to update case "${id}": ${message}`,
      code,
    };
  }
}

/**
 * Permanently deletes a case document from Firestore.
 *
 * ⚠️  This is a hard delete. Implement soft-delete (status = "archived")
 * at the call-site if audit trails are required.
 *
 * @param id - The Firestore document ID of the case to delete.
 * @returns `{ success: true, data: id }` on success.
 *
 * @example
 * const result = await deleteCase("abc123");
 * if (result.success) removeCaseFromUI(result.data);
 */
export async function deleteCase(
  id: string
): Promise<ServiceResult<string>> {
  try {
    if (!id?.trim()) {
      return { success: false, error: "A valid case ID is required." };
    }

    // Verify existence before attempting deletion for a cleaner error message.
    const snapshot = await getDoc(caseDocRef(id));
    if (!snapshot.exists()) {
      return { success: false, error: `Case with ID "${id}" was not found.` };
    }

    await deleteDoc(caseDocRef(id));
    return { success: true, data: id };
  } catch (err) {
    const { message, code } = normaliseError(err);
    return {
      success: false,
      error: `Failed to delete case "${id}": ${message}`,
      code,
    };
  }
}

/**
 * Opens a real-time Firestore listener over the entire `cases` collection,
 * ordered by `createdAt` descending for a specific user.
 *
 * @param userId   - The Firebase Auth UID of the current user.
 * @param onUpdate - Called with the latest array of cases on every change.
 * @param onError  - Called if the listener encounters a Firestore error.
 * @returns An `Unsubscribe` function — call it to stop listening (e.g. in
 *          a React `useEffect` cleanup or a Vue `onUnmounted` hook).
 *
 * @example
 * const unsubscribe = subscribeToCases(
 *   "user123",
 *   (cases) => setCases(cases),
 *   (err)   => console.error(err),
 * );
 * // Later…
 * unsubscribe();
 */
export function subscribeToCases(
  userId: string,
  onUpdate: (cases: CaseDocument[]) => void,
  onError?: (error: ServiceError) => void
): Unsubscribe {
  const q = query(
    casesRef(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot: QuerySnapshot) => {
      onUpdate(querySnapshotToCases(snapshot));
    },
    (err: FirestoreError) => {
      const serviceError: ServiceError = {
        success: false,
        error: `Real-time case listener error: ${err.message}`,
        code: err.code,
      };
      onError?.(serviceError);
    }
  );

  return unsubscribe;
}