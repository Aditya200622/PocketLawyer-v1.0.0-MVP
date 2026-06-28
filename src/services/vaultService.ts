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

export type VaultCategory =
  | "legal"
  | "financial"
  | "identity"
  | "correspondence"
  | "evidence"
  | "court_order"
  | "contract"
  | "other";

export type VaultItemType =
  | "document"
  | "image"
  | "pdf"
  | "spreadsheet"
  | "audio"
  | "video"
  | "link"
  | "note"
  | "other";

export interface VaultItem {
  // Identity
  vaultId: string;           // Firestore document ID

  // Case Reference
  caseId: string;
  caseNumber: string;

  // Item Details
  title: string;
  description: string;
  category: VaultCategory;
  type: VaultItemType;

  // File / Document References
  fileId: string;            // Reference to storage file (if applicable)
  documentId: string;        // Reference to a linked document (if applicable)

  // Organisation
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;

  // Audit
  userId: string;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type CreateVaultItemPayload = Omit<
  VaultItem,
  "vaultId" | "createdAt" | "updatedAt"
>;

export type UpdateVaultItemPayload = Partial<
  Omit<VaultItem, "vaultId" | "userId" | "createdAt" | "updatedAt">
>;

// ─────────────────────────────────────────────
// Collection Reference
// ─────────────────────────────────────────────

const COLLECTION = "vault";

const vaultCollection = () => collection(db, COLLECTION);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Maps a Firestore document snapshot to a typed VaultItem object.
 */
function mapDocToVaultItem(id: string, data: DocumentData): VaultItem {
  return {
    vaultId: id,
    caseId: data.caseId ?? "",
    caseNumber: data.caseNumber ?? "",
    title: data.title ?? "",
    description: data.description ?? "",
    category: data.category ?? "other",
    type: data.type ?? "other",
    fileId: data.fileId ?? "",
    documentId: data.documentId ?? "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    isPinned: data.isPinned ?? false,
    isFavorite: data.isFavorite ?? false,
    userId: data.userId ?? "",
    createdBy: data.createdBy ?? "",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/**
 * Maps a QuerySnapshot to an array of typed VaultItem objects.
 */
function mapSnapshotToVaultItems(
  snapshot: QuerySnapshot<DocumentData>
): VaultItem[] {
  return snapshot.docs.map((docSnap) =>
    mapDocToVaultItem(docSnap.id, docSnap.data())
  );
}

// ─────────────────────────────────────────────
// Service Functions
// ─────────────────────────────────────────────

/**
 * Creates a new vault item document in Firestore.
 * Returns the created VaultItem with its generated vaultId.
 */
export async function createVaultItem(
  payload: CreateVaultItemPayload
): Promise<VaultItem> {
  try {
    const docRef = await addDoc(vaultCollection(), {
      ...payload,
      tags: payload.tags ?? [],
      isPinned: payload.isPinned ?? false,
      isFavorite: payload.isFavorite ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const created = await getDoc(docRef);

    if (!created.exists()) {
      throw new Error("Failed to retrieve vault item after creation.");
    }

    return mapDocToVaultItem(created.id, created.data());
  } catch (error) {
    console.error("[vaultService] createVaultItem error:", error);
    throw error;
  }
}

/**
 * Fetches all vault items belonging to a specific user.
 * Pinned items naturally surface first when sorted client-side.
 * Results are ordered by createdAt descending.
 */
export async function getVaultItems(userId: string): Promise<VaultItem[]> {
  try {
    const q = query(
      vaultCollection(),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return mapSnapshotToVaultItems(snapshot);
  } catch (error) {
    console.error("[vaultService] getVaultItems error:", error);
    throw error;
  }
}

/**
 * Fetches all vault items linked to a specific case.
 * Results are ordered by createdAt descending.
 */
export async function getVaultItemsByCase(
  caseId: string
): Promise<VaultItem[]> {
  try {
    const q = query(
      vaultCollection(),
      where("caseId", "==", caseId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return mapSnapshotToVaultItems(snapshot);
  } catch (error) {
    console.error("[vaultService] getVaultItemsByCase error:", error);
    throw error;
  }
}

/**
 * Updates specified fields on an existing vault item document.
 * Always updates the updatedAt timestamp.
 */
export async function updateVaultItem(
  vaultId: string,
  payload: UpdateVaultItemPayload
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, vaultId);

    await updateDoc(docRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[vaultService] updateVaultItem error:", error);
    throw error;
  }
}

/**
 * Deletes a vault item document from Firestore.
 * Note: Does not delete associated storage files — handle separately.
 */
export async function deleteVaultItem(vaultId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, vaultId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("[vaultService] deleteVaultItem error:", error);
    throw error;
  }
}

/**
 * Subscribes to real-time updates for all vault items belonging to a user.
 * Calls onData with the updated list on every Firestore change.
 * Calls onError if the listener encounters an error.
 * Returns an Unsubscribe function to detach the listener.
 */
export function subscribeVaultItems(
  userId: string,
  onData: (items: VaultItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(
      vaultCollection(),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = mapSnapshotToVaultItems(snapshot);
        onData(items);
      },
      (error) => {
        console.error("[vaultService] subscribeVaultItems listener error:", error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error("[vaultService] subscribeVaultItems setup error:", error);
    throw error;
  }
}