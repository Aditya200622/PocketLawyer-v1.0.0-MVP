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
import { db } from "../firebase";

// ─────────────────────────────────────────────
// TypeScript Model
// ─────────────────────────────────────────────

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface Client {
  // Identity
  clientId: string;         // Firestore document ID
  fullName: string;
  fatherName: string;
  motherName: string;
  dateOfBirth: string;      // ISO 8601 date string: "YYYY-MM-DD"
  gender: Gender;

  // Contact
  phone: string;
  whatsapp: string;
  alternatePhone: string;
  email: string;

  // Address
  address: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;

  // Government IDs
  aadhaar: string;
  pan: string;

  // Professional
  occupation: string;
  companyName: string;

  // Legal
  notes: string;
  linkedCaseCount: number;

  // Audit
  userId: string;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type CreateClientPayload = Omit<
  Client,
  "clientId" | "createdAt" | "updatedAt" | "linkedCaseCount"
>;

export type UpdateClientPayload = Partial<
  Omit<Client, "clientId" | "userId" | "createdAt" | "updatedAt">
>;

// ─────────────────────────────────────────────
// Collection Reference
// ─────────────────────────────────────────────

const COLLECTION = "clients";

const clientsCollection = () => collection(db, COLLECTION);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Maps a Firestore document snapshot to a typed Client object.
 */
function mapDocToClient(
  id: string,
  data: DocumentData
): Client {
  return {
    clientId: id,
    fullName: data.fullName ?? "",
    fatherName: data.fatherName ?? "",
    motherName: data.motherName ?? "",
    dateOfBirth: data.dateOfBirth ?? "",
    gender: data.gender ?? "prefer_not_to_say",
    phone: data.phone ?? "",
    whatsapp: data.whatsapp ?? "",
    alternatePhone: data.alternatePhone ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    pinCode: data.pinCode ?? "",
    country: data.country ?? "India",
    aadhaar: data.aadhaar ?? "",
    pan: data.pan ?? "",
    occupation: data.occupation ?? "",
    companyName: data.companyName ?? "",
    notes: data.notes ?? "",
    linkedCaseCount: data.linkedCaseCount ?? 0,
    userId: data.userId ?? "",
    createdBy: data.createdBy ?? "",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/**
 * Maps a QuerySnapshot to an array of typed Client objects.
 */
function mapSnapshotToClients(snapshot: QuerySnapshot<DocumentData>): Client[] {
  return snapshot.docs.map((docSnap) =>
    mapDocToClient(docSnap.id, docSnap.data())
  );
}

// ─────────────────────────────────────────────
// Service Functions
// ─────────────────────────────────────────────

/**
 * Creates a new client document in Firestore.
 * Returns the created Client with its generated clientId.
 */
export async function createClient(
  payload: CreateClientPayload
): Promise<Client> {
  try {
    const docRef = await addDoc(clientsCollection(), {
      ...payload,
      linkedCaseCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const created = await getDoc(docRef);

    if (!created.exists()) {
      throw new Error("Failed to retrieve client after creation.");
    }

    return mapDocToClient(created.id, created.data());
  } catch (error) {
    console.error("[clientService] createClient error:", error);
    throw error;
  }
}

/**
 * Fetches all clients belonging to a specific user.
 * Results are ordered by createdAt descending.
 */
export async function getClients(userId: string): Promise<Client[]> {
  try {
    const q = query(
      clientsCollection(),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return mapSnapshotToClients(snapshot);
  } catch (error) {
    console.error("[clientService] getClients error:", error);
    throw error;
  }
}

/**
 * Fetches a single client by its document ID.
 * Returns null if the document does not exist.
 */
export async function getClientById(clientId: string): Promise<Client | null> {
  try {
    const docRef = doc(db, COLLECTION, clientId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapDocToClient(docSnap.id, docSnap.data());
  } catch (error) {
    console.error("[clientService] getClientById error:", error);
    throw error;
  }
}

/**
 * Updates specified fields on an existing client document.
 * Always updates the updatedAt timestamp.
 */
export async function updateClient(
  clientId: string,
  payload: UpdateClientPayload
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, clientId);

    await updateDoc(docRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[clientService] updateClient error:", error);
    throw error;
  }
}

/**
 * Deletes a client document from Firestore.
 */
export async function deleteClient(clientId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, clientId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("[clientService] deleteClient error:", error);
    throw error;
  }
}

/**
 * Subscribes to real-time updates for all clients belonging to a user.
 * Calls onData with the updated client list on every change.
 * Calls onError if the listener encounters an error.
 * Returns an Unsubscribe function to detach the listener.
 */
export function subscribeToClients(
  userId: string,
  onData: (clients: Client[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const q = query(
      clientsCollection(),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const clients = mapSnapshotToClients(snapshot);
        onData(clients);
      },
      (error) => {
        console.error("[clientService] subscribeToClients error:", error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error("[clientService] subscribeToClients setup error:", error);
    throw error;
  }
}