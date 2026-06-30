import cors from "cors";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// OpenRouter Gateway Manager (API Key Rotation, Fallbacks, Retry, Token Safety, Logging)
// ==========================================
class OpenRouterGatewayManager {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private models: string[] = [
    "google/gemini-2.5-flash",
    "openai/gpt-4.1-mini",
    "meta-llama/llama-3.3-70b-instruct",
  ];

  constructor() {
    this.apiKeys = [
      process.env.OPENROUTER_API_KEY_1 || process.env.OPENROUTER_API_KEY || "",
      process.env.OPENROUTER_API_KEY_2 || "",
      process.env.OPENROUTER_API_KEY_3 || "",
    ].filter(Boolean);

    if (this.apiKeys.length === 0) {
      this.apiKeys = [""];
    }
  }

  private getClient(keyIndex: number): OpenAI {
    return new OpenAI({
      apiKey: this.apiKeys[keyIndex],
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://pocketlawyer.app",
        "X-Title": "PocketLawyer",
      },
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async createChatCompletion(params: {
    messages: { role: string; content: string }[];
    temperature?: number;
    max_tokens: number;
    endpoint: string;
  }): Promise<string> {
    let keyIdx = this.currentKeyIndex;
    let modelIdx = 0;
    let attempts = 0;

    while (keyIdx < this.apiKeys.length) {
      const client = this.getClient(keyIdx);
      const model = this.models[modelIdx];

      try {
        console.log(`[GatewayLog] KeyIndex: ${keyIdx}, Model: ${model}, Endpoint: ${params.endpoint}, Attempt: ${attempts + 1}`);
        const start = Date.now();
        const response = await client.chat.completions.create({
          model,
          messages: params.messages as any,
          temperature: params.temperature ?? 0.4,
          max_tokens: params.max_tokens,
        });
        const latency = Date.now() - start;
        console.log(`[GatewayLog] Success! Latency: ${latency}ms`);
        return response.choices[0].message.content || "";
      } catch (error: any) {
        attempts++;
        const status = error.status || error.code || 500;
        console.error(`[GatewayLog] Failure on Key ${keyIdx}, Model ${model}. Status: ${status}. Error: ${error.message || error}`);

        const rotationCodes = [401, 402, 403, 408, 409, 425, 429, 500, 502, 503, 504];
        if (rotationCodes.includes(status)) {
          if ([429, 500, 502, 503, 504].includes(status) && attempts < 2) {
            const backoff = attempts === 1 ? 2000 : 5000;
            console.log(`[GatewayLog] Temporary failure. Retrying in ${backoff}ms...`);
            await this.delay(backoff);
            continue;
          }

          attempts = 0;

          if (modelIdx < this.models.length - 1) {
            modelIdx++;
            console.log(`[GatewayLog] Fallback: Switching model to ${this.models[modelIdx]}`);
            continue;
          }

          modelIdx = 0;
          keyIdx++;
          if (keyIdx < this.apiKeys.length) {
            this.currentKeyIndex = keyIdx;
            console.log(`[GatewayLog] Failover: Rotating API Key to index ${keyIdx}`);
          }
        } else {
          throw error;
        }
      }
    }

    throw new Error("All OpenRouter API keys and fallback models failed to respond.");
  }
}

const gateway = new OpenRouterGatewayManager();

async function startServer() {
  const app = express();
  app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Backend is working"
  });
});
  const PORT = 3001;
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // ==========================================
  // 1. Generate Complaint
  // ==========================================
  app.post("/api/ai/generate-complaint", async (req, res) => {
    try {
      const { category, date, location, opposingParty, description } = req.body;
      const prompt = `
You are an expert advocate practicing in Indian courts. Draft a comprehensive, professional formal court complaint based on the details below:

CASE CATEGORY: ${category}
DATE OF INCIDENT: ${date}
LOCATION: ${location}
OPPOSING PARTY: ${opposingParty}

INCIDENT DESCRIPTION & CONTEXT:
${description}

Drafting guidelines:
- Adhere to the format of a legal plaint/complaint in Indian courts.
- Structure it clearly with title, description, acts/sections, and prayer/relief sought.
- Use formal Indian legal language. Cite applicable Acts and sections where relevant.
- Write the complete document. Do not truncate.
`;

      const responseText = await gateway.createChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
        endpoint: "/api/ai/generate-complaint",
      });

      res.json({ content: responseText });
    } catch (error: any) {
      console.error("AI Error (generate-complaint):", error);
      res.status(500).json({ error: "Failed to generate complaint" });
    }
  });

  // ==========================================
  // 2. Missing Info
  // ==========================================
  app.post("/api/ai/missing-info", async (req, res) => {
    try {
      const { category, description } = req.body;
      const prompt = `
You are a senior advocate mentoring a junior colleague. Analyze this draft description for a ${category} complaint:
"${description}"

Identify and list critical information that is missing or needs clarification to make the complaint legally sound.
Categorize findings under:
- Missing Facts (Dates, times, specific actions)
- Missing Evidence (Documents, receipts, chat backups, agreements)
- Missing Supporting Material

Format each item as a clear, specific question or requirement.
`;

      const responseText = await gateway.createChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1000,
        endpoint: "/api/ai/missing-info",
      });

      res.json({ content: responseText });
    } catch (error: any) {
      console.error("AI Error (missing-info):", error);
      res.status(500).json({ error: "Failed to generate missing info section" });
    }
  });

  // ==========================================
  // 3. Legal Guidance
  // ==========================================
  app.post("/api/ai/legal-guidance", async (req, res) => {
    try {
      const { issueType, description, history = [] } = req.body;
      const systemPrompt = `You are a Senior Legal Consultant specializing in Indian Law. Provide thorough, professional legal guidance.
Every response MUST include the following sections exactly:
## 📋 Legal Explanation
Detailed legal analysis of the situation.
## ⚖️ Relevant Acts / Sections
Applicable Indian statutes (e.g., BNS, BNSS, BSA, IPC, CPC, CrPC, IT Act).
## 🔍 Practical Guidance
Clear, step-by-step action plan.
## ⚠️ Risks
Procedural risks, evidentiary gaps, and legal hurdles.
## 🪜 Recommended Next Steps
Immediate actionable items.
`;

      const historyMessages = (history as { role: string; content: string }[]).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      const responseText = await gateway.createChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: description }
        ],
        temperature: 0.4,
        max_tokens: 1500,
        endpoint: "/api/ai/legal-guidance",
      });

      res.json({ content: responseText });
    } catch (error: any) {
      console.error("AI Error (legal-guidance):", error);
      res.status(500).json({ error: "Failed to provide guidance" });
    }
  });

  // ==========================================
  // 4. Legal Guidance Chat
  // ==========================================
  app.post("/api/ai/legal-guidance-chat", async (req, res) => {
    try {
      const { message, issueType, history = [] } = req.body;
      const systemPrompt = `You are an expert Indian legal consultant. Continue the discussion regarding this ${issueType || "legal"} matter, maintaining context. Citing relevant laws. Always structure responses clearly under:
## 📋 Legal Explanation
## ⚖️ Relevant Acts / Sections
## 🔍 Practical Guidance
## ⚠️ Risks
## 🪜 Recommended Next Steps`;

      const historyMessages = (history as { role: string; content: string }[]).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      const responseText = await gateway.createChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: message }
        ],
        temperature: 0.4,
        max_tokens: 1500,
        endpoint: "/api/ai/legal-guidance-chat",
      });

      res.json({ content: responseText });
    } catch (error: any) {
      console.error("AI Error (legal-guidance-chat):", error);
      res.status(500).json({ error: "Failed to continue guidance chat" });
    }
  });

  // ==========================================
  // 5. Case Research
  // ==========================================
  app.post("/api/ai/case-research", async (req, res) => {
    try {
      const { query } = req.body;
      const prompt = `
You are a legal research assistant. Search your knowledge base and find 4 real, landmark Supreme Court of India or High Court judgments relevant to this research query:
"${query}"

Return ONLY a valid JSON array:
[
  {
    "title": "Case Name vs. Respondent (Year)",
    "citation": "Citation (e.g. 2024 INSC 123 or SCR / SCC)",
    "court": "Supreme Court of India / etc",
    "year": "YYYY",
    "summary": "Short summary of the holding and law laid down."
  }
]
`;

      const responseText = await gateway.createChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
        endpoint: "/api/ai/case-research",
      });

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const cases = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json(cases);
    } catch (error: any) {
      console.error("AI Error (case-research):", error);
      res.status(500).json({ error: "Failed to research cases" });
    }
  });

  // ==========================================
  // 6. Research Response
  // ==========================================
  app.post("/api/ai/research-response", async (req, res) => {
    try {
      const { prompt, caseTitle, history = [] } = req.body;
      const systemPrompt = `You are a Senior Legal Research Analyst. Provide structured research output.
Every response MUST follow this structure exactly:
## 📋 Summary
## ⚖️ Relevant Acts / Sections
## 🏛️ Important Judgments
## 🔍 Practical Legal Analysis
## 🪜 Suggested Next Steps
`;

      const historyMessages = (history as { role: string; content: string }[]).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      const userContent = caseTitle ? `Context: Case "${caseTitle}"\n\n${prompt}` : prompt;

      const responseText = await gateway.createChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        endpoint: "/api/ai/research-response",
      });

      res.json({ content: responseText });
    } catch (error: any) {
      console.error("AI Error (research-response):", error);
      res.status(500).json({ error: "Failed to generate research response" });
    }
  });

  // ==========================================
  // 7. Chat Case (Aliased to /api/ai/chat)
  // ==========================================
  const handleChatCase = async (req: express.Request, res: express.Response) => {
    try {
      const { message, caseContext, history = [] } = req.body;
      const systemPrompt = `You are a Senior Legal Counsel and AI Legal Mentor for PocketLawyer. You are analyzing a specific case and mentoring the advocate.
Your role:
- Act as a senior legal counsel / advocate mentoring a junior colleague
- Analyze provided context, evidence documents, hearings
- Highlight case strengths and weaknesses
- Suggest cross-examination strategy ideas
- Propose actionable strategy suggestions

Always maintain a professional, mentoring tone. Cite specific Indian laws and acts.`;

      const historyMessages = (history as { role: string; content: string }[]).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      const responseText = await gateway.createChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: message }
        ],
        temperature: 0.4,
        max_tokens: 1500,
        endpoint: "/api/ai/chat-case",
      });

      res.json({ reply: responseText, content: responseText });
    } catch (error: any) {
      console.error("AI Error (chat-case):", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  };

  app.post("/api/ai/chat-case", handleChatCase);
  app.post("/api/ai/chat", handleChatCase);

  // ==========================================
  // 8. Moot Court
  // ==========================================
  app.post("/api/ai/moot-court", async (req, res) => {
    try {
      const { role, caseTitle, caseType, userArgument, exchangeHistory = [], roundNumber } = req.body;
      let systemPrompt = "";
      let userContent = "";

      if (role === "judge") {
        systemPrompt = `You are the presiding Judge in a Moot Court. Based on the case: ${caseTitle || "Untitled"}.
Listen to the advocate's argument, ask sharp follow-up questions, and evaluate their legal reasoning.
Return ONLY valid JSON: { "dialogue": "..." }`;
        userContent = userArgument;
      } else if (role === "opposing_counsel") {
        systemPrompt = `You are the Opposing Counsel in a Moot Court. Counters the advocate's arguments with legal precision. Citing counter-precedents.
Return ONLY valid JSON: { "argument": "..." }`;
        userContent = userArgument;
      } else {
        systemPrompt = `You are the presiding judge in a Moot Court. Pronounce final order and performance evaluation.
Return ONLY valid JSON: { "order": "...", "verdict": "...", "performanceReport": { "overallScore": 85, "strengths": [], "weaknesses": [], "improvements": [], "advocateRating": "Junior Counsel" } }`;
        userContent = `History:\n${JSON.stringify(exchangeHistory)}`;
      }

      const responseText = await gateway.createChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        temperature: 0.5,
        max_tokens: 1500,
        endpoint: "/api/ai/moot-court",
      });

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { dialogue: responseText, argument: responseText, order: responseText };
      res.json(result);
    } catch (error: any) {
      console.error("AI Error (moot-court):", error);
      res.status(500).json({ error: "Failed to process moot court dialogue" });
    }
  });

  // ==========================================
  // 9. Document Analysis
  // ==========================================
  app.post("/api/ai/analyze-docs", async (req, res) => {
    res.json({
      summary: "Documents received. Please describe your case in the chat and I will provide detailed analysis based on the context you share."
    });
  });

  // ==========================================
  // 10. Analyze Case (Aliased to /api/ai/assistant)
  // ==========================================
  const handleAnalyzeCase = async (req: express.Request, res: express.Response) => {
    try {
      const { caseTitle, caseType, caseSummary, documents = [], hearings = [], researchSessions = [] } = req.body;

      const docList = documents.slice(0, 10).map((d: any, i: number) =>
        `${i + 1}. ${d.originalName || d.name || "Document"}`
      ).join("\n");

      const hearingList = hearings.slice(0, 5).map((h: any, i: number) =>
        `${i + 1}. ${h.date} — Status: ${h.status}`
      ).join("\n");

      const prompt = `
You are a Senior Legal Counsel reviewing a case file. Conduct a thorough initial case analysis.

CASE: ${caseTitle || "Untitled Case"}
TYPE: ${caseType || "Not specified"}
SUMMARY: ${caseSummary || "No summary provided"}

DOCUMENTS:
${docList || "None"}

HEARINGS:
${hearingList || "None"}

Provide a comprehensive case analysis covering:
## 🔍 Initial Assessment
## 💪 Strengths Identified
## ⚠️ Weaknesses & Risks
## 📋 Missing Evidence
## ⚖️ Applicable Laws
## 🎯 Strategic Recommendations
## ❓ Questions for Client
`;

      const responseText = await gateway.createChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1500,
        endpoint: "/api/ai/analyze-case",
      });

      res.json({ analysis: responseText, content: responseText });
    } catch (error: any) {
      console.error("AI Error (analyze-case):", error);
      res.status(500).json({ error: "Failed to analyze case" });
    }
  };

  app.post("/api/ai/analyze-case", handleAnalyzeCase);
  app.post("/api/ai/assistant", handleAnalyzeCase);

  // ==========================================
  // Vite / Static Files Middleware
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PocketLawyer server running on http://localhost:${PORT}`);
  });
}

startServer();