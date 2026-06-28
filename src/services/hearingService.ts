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
import { db, storage } from "../firebase";

// ─────────────────────────────────────────────
// TypeScript Model
// ─────────────────────────────────────────────

export type HearingStatus =
  | "scheduled"
  | "adjourned"
  | "completed"
  | "cancelled"
  | "pending";

export interface Hearing {
  // Identity
  hearingId: string;           // Firestore document ID

  // Case Reference
  caseId: string;
  caseNumber: string;

  // Court Details
  courtName: string;
  judgeName: string;
  courtRoom: string;

  // Schedule
  hearingDate: string;         // ISO 8601 date string: "YYYY-MM-DD"
  hearingTime: string;         // "HH:mm" (24-hour)
  nextHearingDate: string;     // ISO 8601 date string: "YYYY-MM-DD"
  nextHearingTime: string;     // "HH:mm" (24-hour)

  // Details
  purpose: string;
  status: HearingStatus;
  remarks: string;

  // Attachments
  attachmentsCount: number;

  // Audit
  createdBy: string;
  userId: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type CreateHearingPayload = Omit<
  Hearing,
  "hearingId" | "createdAt" | "updatedAt" | "attachmentsCount"
>;

export type UpdateHearingPayload = Partial<
  Omit<Hearing, "hearingId" | "userId" | "createdAt" | "updatedAt">
>;

// ─────────────────────────────────────────────
// Collection Reference
// ─────────────────────────────────────────────

const COLLECTION = "hearings";

const hearingsCollection = () => collection(db, COLLECTION);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Maps a Firestore document snapshot to a typed Hearing object.
 */
function mapDocToHearing(id: string, data: DocumentData): Hearing {
  return {
    hearingId: id,
    caseId: data.caseId ?? "",
    caseNumber: data.caseNumber ?? "",
    courtName: data.courtName ?? "",
    judgeName: data.judgeName ?? "",
    courtRoom: data.courtRoom ?? "",
    hearingDate: data.hearingDate ?? "",
    hearingTime: data.hearingTime ?? "",
    nextHearingDate: data.nextHearingDate ?? "",
    nextHearingTime: data.nextHearingTime ?? "",
    purpose: data.purpose ?? "",
    status: data.status ?? "scheduled",
    remarks: data.remarks ?? "",
    attachmentsCount: data.attachmentsCount ?? 0,
    createdBy: data.createdBy ?? "",
    userId: data.userId ?? "",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/**
 * Maps a QuerySnapshot to an array of typed Hearing objects.
 */
function mapSnapshotToHearings(
  snapshot: QuerySnapshot<DocumentData>
): Hearing[] {
  return snapshot.docs.map((docSnap) =>
    mapDocToHearing(docSnap.id, docSnap.data())
  );
}

// ─────────────────────────────────────────────
// Service Functions
// ─────────────────────────────────────────────

/**
 * Creates a new hearing document in Firestore.
 * Returns the created Hearing with its generated hearingId.
 */
export async function createHearing(
  payload: CreateHearingPayload
): Promise<Hearing> {
  try {
    const docRef = await addDoc(hearingsCollection(), {
      ...payload,
      attachmentsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const created = await getDoc(docRef);

    if (!created.exists()) {
      throw new Error("Failed to retrieve hearing after creation.");
    }

    return mapDocToHearing(created.id, created.data());
  } catch (error) {
    console.error("[hearingService] createHearing error:", error);
    throw error;
  }
}

/**
 * Fetches all hearings belonging to a specific user.
 * Results are ordered by hearingDate descending.
 */
export async function getHearings(userId: string): Promise<Hearing[]> {
  try {
    const q = query(
      hearingsCollection(),
      where("userId", "==", userId),
      orderBy("hearingDate", "desc")
    );

    const snapshot = await getDocs(q);
    return mapSnapshotToHearings(snapshot);
  } catch (error) {
    console.error("[hearingService] getHearings error:", error);
    throw error;
  }
}

/**
 * Fetches all hearings linked to a specific case.
 * Results are ordered by hearingDate descending.
 */
export async function getHearingsByCase(caseId: string): Promise<Hearing[]> {
  try {
    const q = query(
      hearingsCollection(),
      where("caseId", "==", caseId),
      orderBy("hearingDate", "desc")
    );

    const snapshot = await getDocs(q);
    return mapSnapshotToHearings(snapshot);
  } catch (error) {
    console.error("[hearingService] getHearingsByCase error:", error);
    throw error;
  }
}

/**
 * Updates specified fields on an existing hearing document.
 * Always updates the updatedAt timestamp.
 */
export async function updateHearing(
  hearingId: string,
  payload: UpdateHearingPayload
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, hearingId);

    await updateDoc(docRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[hearingService] updateHearing error:", error);
    throw error;
  }
}

/**
 * Deletes a hearing document from Firestore.
 */
export async function deleteHearing(hearingId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, hearingId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("[hearingService] deleteHearing error:", error);
    throw error;
  }
}

/**
 * Subscribes to real-time updates for all hearings belonging to a user.
 * Calls onData with the updated hearing list on every change.
 * Calls onError if the listener encounters an error.
 * Returns an Unsubscribe function to detach the listener.
 */
export function subscribeHearings(
  userId: string,
  onData: (hearings: Hearing[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(
      hearingsCollection(),
      where("userId", "==", userId),
      orderBy("hearingDate", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const hearings = mapSnapshotToHearings(snapshot);
        onData(hearings);
      },
      (error) => {
        console.error("[hearingService] subscribeHearings listener error:", error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error("[hearingService] subscribeHearings setup error:", error);
    throw error;
  }
}