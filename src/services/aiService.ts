/**
 * AI Service for PocketLawyer
 * Handles all AI-related API calls
 */

import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../auth";
import type { DocumentRecord } from "./documentService";

// PRODUCTION RULE: All AI requests go through Express backend only.
// API key is in .env (server-side only). Never call AI providers directly from frontend.
// Previously pointed to render.com remote backend — now uses local Express server (OpenRouter).
const API_BASE = "/api/ai";
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
  const { prompt, caseTitle, caseSummary, documents = [], conversation = [] } = options;
  const cleanedPrompt = (prompt || "").trim();

  // Build case context string for the backend
  const caseContext = [
    caseTitle ? `Case Title: ${caseTitle}` : "",
    caseSummary ? `Case Summary: ${caseSummary}` : "",
    documents.length > 0
      ? `Uploaded Documents (${documents.length}):\n` +
        documents
          .slice(0, 10)
          .map((d, i) => `  ${i + 1}. ${d.originalName || d.fileName || "Document"} (${formatBytes(d.fileSize || 0)})`)
          .join("\n")
      : "No documents uploaded yet.",
  ]
    .filter(Boolean)
    .join("\n");

  // Build history for the backend (convert AiChatMessage[] to {role, content}[])
  const history = conversation.slice(-10).map((m) => ({
    role: m.role === "ai" ? "assistant" : "user",
    content: m.content,
  }));

  try {
    const res = await fetch(`${API_BASE}/chat-case`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: cleanedPrompt, caseContext, history }),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json() as { reply?: string };
    return data.reply || "No response from AI. Please try again.";
  } catch (error) {
    console.error("generateCaseAwareReply error:", error);
    return "AI counsel is temporarily unavailable. Please retry in a moment.";
  }
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
  const { prompt, caseTitle, documents = [], conversation = [] } = options;
  const cleanedPrompt = (prompt || "").trim();

  // Build history for the backend
  const history = (conversation || []).slice(-8).map((m) => ({
    role: m.role === "ai" ? "assistant" : "user",
    content: m.content,
  }));

  try {
    const res = await fetch(`${API_BASE}/research-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: cleanedPrompt, caseTitle, history }),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json() as { content?: string };
    const response = data.content || "No research response. Please try again.";

    // Extract references from document list for citation display
    const references = documents.slice(0, 6).map((doc, index) =>
      `[${index + 1}] ${doc.originalName || doc.fileName || "Document"}`
    );

    return { response, references };
  } catch (error) {
    console.error("generateResearchResponse error:", error);
    return {
      response: "Research AI is temporarily unavailable. Please retry in a moment.",
      references: [],
    };
  }
}

// ─── New helper: analyze full case context (used by AI Assistant) ──────────────
export async function analyzeCaseContext(params: {
  caseTitle?: string;
  caseType?: string;
  caseSummary?: string;
  documents?: DocumentRecord[];
  hearings?: unknown[];
  researchSessions?: unknown[];
}): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/analyze-case`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json() as { analysis?: string };
    return data.analysis || "Case analysis unavailable.";
  } catch (error) {
    console.error("analyzeCaseContext error:", error);
    return "Case analysis temporarily unavailable. Please retry.";
  }
}

// ─── New helper: generate missing information section ─────────────────────────
export async function generateMissingInfo(params: {
  category: string;
  description: string;
  formData?: unknown;
}): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/missing-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json() as { content?: string };
    return data.content || "Unable to generate missing information section.";
  } catch (error) {
    console.error("generateMissingInfo error:", error);
    return "Missing information analysis temporarily unavailable.";
  }
}

// ─── New helper: legal guidance chat (continuous conversation) ─────────────────
export async function sendLegalGuidanceChat(params: {
  message: string;
  issueType?: string;
  history?: { role: string; content: string }[];
}): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/legal-guidance-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json() as { content?: string };
    return data.content || "No response. Please try again.";
  } catch (error) {
    console.error("sendLegalGuidanceChat error:", error);
    return "Legal guidance AI is temporarily unavailable. Please retry.";
  }
}

// ─── New helper: moot court API ──────────────────────────────────────────────
export async function callMootCourt(params: {
  role: "judge" | "opposing_counsel" | "final_order";
  caseTitle?: string;
  caseType?: string;
  userArgument?: string;
  exchangeHistory?: unknown[];
  roundNumber?: number;
}): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${API_BASE}/moot-court`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return await res.json() as Record<string, unknown>;
  } catch (error) {
    console.error("callMootCourt error:", error);
    return { error: "Moot court AI temporarily unavailable." };
  }
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
  sendLegalGuidanceChat,
  analyzeCaseContext,
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
