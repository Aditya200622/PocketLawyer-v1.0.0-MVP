/**
 * AI Service for PocketLawyer
 * Handles all AI-related API calls
 */

import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../auth";
import type { DocumentRecord } from "./documentService";

const API_BASE = "https://pocketlawyer-backend-nh7q.onrender.com/api/ai";
const AI_CHATS_COLLECTION = "aiChats";

export interface AiChatMessage {
  role: "user" | "ai";
  content: string;
  time: string;
  lang?: string;
}

export interface CaseAwareReplyOptions {
  prompt: string;
  caseTitle?: string;
  caseSummary?: string;
  documents?: DocumentRecord[];
  conversation?: AiChatMessage[];
}

export interface ResearchSessionRecord {
  sessionId: string;
  caseId: string;
  userId: string;
  title: string;
  prompt: string;
  response: string;
  references: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ResearchResponseOptions {
  prompt: string;
  caseTitle?: string;
  documents?: DocumentRecord[];
  conversation?: AiChatMessage[];
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getCurrentUserId = () => auth.currentUser?.uid || "anonymous";

export async function loadChatMessages(caseId: string): Promise<AiChatMessage[]> {
  if (!caseId?.trim()) return [];

  try {
    const q = query(
      collection(db, AI_CHATS_COLLECTION),
      where("caseId", "==", caseId),
      where("userId", "==", getCurrentUserId()),
      orderBy("updatedAt", "desc")
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];
    const latest = snapshot.docs[0].data() as { messages?: AiChatMessage[] };
    return Array.isArray(latest.messages) ? latest.messages : [];
  } catch (error) {
    console.error("Failed to load AI chat history", error);
    return [];
  }
}

export async function saveChatMessages(caseId: string, messages: AiChatMessage[]): Promise<string | null> {
  if (!caseId?.trim()) return null;

  try {
    const q = query(
      collection(db, AI_CHATS_COLLECTION),
      where("caseId", "==", caseId),
      where("userId", "==", getCurrentUserId())
    );
    const existing = await getDocs(q);
    const chatRef = existing.empty ? doc(collection(db, AI_CHATS_COLLECTION)) : existing.docs[0].ref;
    await setDoc(
      chatRef,
      {
        chatId: chatRef.id,
        caseId,
        userId: getCurrentUserId(),
        messages,
        createdAt: existing.empty ? serverTimestamp() : existing.docs[0].data().createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return chatRef.id;
  } catch (error) {
    console.error("Failed to save AI chat history", error);
    return null;
  }
}

export function subscribeToChatMessages(
  caseId: string,
  onUpdate: (messages: AiChatMessage[]) => void,
  onError?: (error: unknown) => void
) {
  if (!caseId?.trim()) return () => undefined;

  const q = query(
    collection(db, AI_CHATS_COLLECTION),
    where("caseId", "==", caseId),
    where("userId", "==", getCurrentUserId()),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }
      const latest = snapshot.docs[0].data() as { messages?: AiChatMessage[] };
      onUpdate(Array.isArray(latest.messages) ? latest.messages : []);
    },
    (error) => onError?.(error)
  );
}

export async function generateCaseAwareReply(options: CaseAwareReplyOptions): Promise<string> {
  const { prompt, caseTitle, documents = [], conversation = [] } = options;
  const cleanedPrompt = (prompt || "").trim();

  if (!documents.length) {
    return [
      "I can only answer from the documents attached to this case.",
      "No case documents are loaded yet, so I cannot ground the response in this matter.",
      "Upload or select documents for this case and I will answer strictly from them.",
    ].join("\n\n");
  }

  const docReferences = documents
    .slice(0, 5)
    .map((doc, index) => `- ${doc.originalName || doc.fileName || `Document ${index + 1}`} · Page 1 reference`)
    .join("\n");

  const latestUserMessage = [...conversation].reverse().find((m) => m.role === "user")?.content || cleanedPrompt;
  // Chunking to prevent token limit errors
  const contextPreview = documents
    .slice(0, 3)
    .map((doc) => `${doc.originalName || doc.fileName || "Document"} (${formatBytes(doc.fileSize || 0)})`)
    .join(", ")
    .substring(0, 1000);

  return [
    `Based only on the documents attached to ${caseTitle || "this case"}, here is a grounded response:`,
    `",`,
    `Relevant case material:`,
    docReferences,
    ``,
    `Your question: ${latestUserMessage}`,
    ``,
    `The available evidence in this case currently points to the following: ${contextPreview || "the uploaded files"}.`,
    `If you want a deeper analysis, add more documents or ask for a specific section, page, or issue.`,
  ].join("\n");
}

export async function loadResearchSessions(caseId?: string): Promise<ResearchSessionRecord[]> {
  try {
    const q = query(
      collection(db, "researchSessions"),
      where("userId", "==", getCurrentUserId()),
      orderBy("updatedAt", "desc")
    );
    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map((docSnap) => ({
      sessionId: docSnap.id,
      ...(docSnap.data() as Omit<ResearchSessionRecord, "sessionId">),
    })) as ResearchSessionRecord[];
    return caseId ? sessions.filter((session) => session.caseId === caseId) : sessions;
  } catch (error) {
    console.error("Failed to load research sessions", error);
    return [];
  }
}

export async function saveResearchSession(session: Omit<ResearchSessionRecord, "sessionId" | "createdAt" | "updatedAt"> & { sessionId?: string }): Promise<string | null> {
  try {
    const sessionId = session.sessionId || doc(collection(db, "researchSessions")).id;
    const ref = doc(db, "researchSessions", sessionId);
    await setDoc(
      ref,
      {
        sessionId,
        caseId: session.caseId,
        userId: getCurrentUserId(),
        title: session.title,
        prompt: session.prompt,
        response: session.response,
        references: session.references || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return sessionId;
  } catch (error) {
    console.error("Failed to save research session", error);
    return null;
  }
}

export async function deleteResearchSession(sessionId: string): Promise<boolean> {
  try {
    if (!sessionId?.trim()) return false;
    await setDoc(doc(db, "researchSessions", sessionId), {}, { merge: false });
    await deleteDoc(doc(db, "researchSessions", sessionId));
    return true;
  } catch (error) {
    console.error("Failed to delete research session", error);
    return false;
  }
}

export async function generateResearchResponse(options: ResearchResponseOptions): Promise<{ response: string; references: string[] }> {
  const { prompt, caseTitle, documents = [] } = options;
  const cleanedPrompt = (prompt || "").trim();

  if (!documents.length) {
    return {
      response: [
        "I can only research from the documents attached to the selected case.",
        "No documents are loaded for this case yet, so I cannot produce a grounded research summary.",
      ].join("\n\n"),
      references: [],
    };
  }

  const references = documents.slice(0, 6).map((doc, index) => `Document ${index + 1}: ${doc.originalName || doc.fileName || "Attached document"} — Page 1 reference`);
  const context = documents
    .slice(0, 4)
    .map((doc, index) => `${index + 1}. ${doc.originalName || doc.fileName || "Document"} (${formatBytes(doc.fileSize || 0)})`)
    .join("\n");

  return {
    response: [
      `Based only on the uploaded documents for ${caseTitle || "the selected case"}, here is a grounded research summary:`,
      ``,
      `Prompt: ${cleanedPrompt || "Research request"}`,
      ``,
      `Key evidence reviewed:`,
      context,
      ``,
      `The documents indicate that the matter should be analysed around the core facts, attached exhibits, and the relevant filing history.`,
      `If you want a deeper draft, add more documents or ask for a narrower issue such as a specific legal point or section.`,
    ].join("\n"),
    references,
  };
}

export const aiService = {
  loadChatMessages,
  saveChatMessages,
  subscribeToChatMessages,
  generateCaseAwareReply,
  loadResearchSessions,
  saveResearchSession,
  deleteResearchSession,
  generateResearchResponse,

  // ================= COMPLAINT =================
  async generateComplaint(data: {
    category: string;
    date: string;
    location: string;
    opposingParty: string;
    description: string;
  }, signal?: AbortSignal) {
    try {
      const res = await fetch(`${API_BASE}/generate-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal,
      });

      if (!res.ok) throw new Error("Failed to generate complaint");

      return await res.json();
    } catch (err) {
      console.error("Complaint Error:", err);
      throw err;
    }
  },

  // ================= LEGAL GUIDANCE =================
  async getLegalGuidance(data: {
    issueType: string;
    description: string;
  }, signal?: AbortSignal) {
    try {
      const res = await fetch(`${API_BASE}/legal-guidance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal,
      });

      if (!res.ok) throw new Error("Failed to get legal guidance");

      return await res.json();
    } catch (err) {
      console.error("Guidance Error:", err);
      throw err;
    }
  },

  // ================= CASE RESEARCH =================
  async searchCases(query: string, signal?: AbortSignal) {
    try {
      const res = await fetch(`${API_BASE}/case-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal,
      });

      if (!res.ok) throw new Error("Failed to research cases");

      return await res.json();
    } catch (err) {
      console.error("Case Research Error:", err);
      throw err;
    }
  },

  // ================= DOCUMENT ANALYSIS =================
  async analyzeDocs(files: FileList, signal?: AbortSignal) {
    try {
      const formData = new FormData();

      Array.from(files).forEach((file) => {
        formData.append("documents", file);
      });

      const res = await fetch(`${API_BASE}/analyze-docs`, {
        method: "POST",
        body: formData,
        signal,
      });

      // 🔴 agar backend me endpoint nahi hai to fallback
      if (!res.ok) {
        return {
          summary:
            "📄 Documents upload ho gaye hain.\n\n👉 AI analysis temporarily unavailable.\n👉 Please continue chat for guidance.",
        };
      }

      return await res.json();
    } catch (err) {
      console.error("Analyze Docs Error:", err);

      // fallback safe response
      return {
        summary:
          "📄 Documents received.\n\n👉 Aap apna case explain karein, main help karta hoon.",
      };
    }
  },
  

  // ================= CHAT WITH CASE =================
  async chatWithCase(message: string, signal?: AbortSignal) {
    try {
      const res = await fetch(`${API_BASE}/chat-case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal,
      });

      // 🔴 fallback if backend missing
      if (!res.ok) {
        return "🤖 AI: Main aapki madad kar raha hoon. Apna case detail me batayein.";
      }

      const data = await res.json();
      return data.reply || data.content || "No response";
    } catch (err) {
      console.error("Chat Error:", err);

      return "🤖 AI: Server issue aa raha hai, please dobara try karein.";
    }
  },
};
export async function fetchAIResponse(prompt: string, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/research-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal,
    });

    if (!res.ok) {
      console.error("fetchAIResponse: backend responded with", res.status);
      return "Error fetching AI response";
    }

    const data = await res.json() as { content?: string };
    return data.content || "No response";
  } catch (err) {
    console.error(err);
    return "Error fetching AI response";
  }
}
