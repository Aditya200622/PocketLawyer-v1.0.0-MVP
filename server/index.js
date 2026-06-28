import "dotenv/config";
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ─── IN-MEMORY CACHE ────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── HEADERS ────────────────────────────────────────────────────────────────
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// ─── SOURCE 1: INDIAN KANOON SEARCH ─────────────────────────────────────────
async function scrapeIndianKanoon(query) {
  try {
    const url = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(query)}&pagenum=0`;
    const { data } = await axios.get(url, { headers: BROWSER_HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);
    const results = [];

    $(".result").each((_, el) => {
      const titleEl = $(el).find(".result_title a");
      const title = titleEl.text().trim();
      const href = titleEl.attr("href");
      const snippet = $(el).find(".result_doc").text().trim().slice(0, 300);

      if (title && href) {
        results.push({
          title,
          link: `https://indiankanoon.org${href}`,
          snippet,
          source: "Indian Kanoon",
        });
      }
    });

    return results.slice(0, 12);
  } catch (err) {
    console.warn("⚠️ Indian Kanoon scrape failed:", err.message);
    return [];
  }
}

// ─── SOURCE 2: GOOGLE → INDIANKANOON + SCC ONLINE ───────────────────────────
async function scrapeGoogleLegal(query) {
  try {
    const searchQuery = `${query} site:indiankanoon.org OR site:scconline.com OR site:judis.nic.in`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=20`;

    const { data } = await axios.get(url, { headers: BROWSER_HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);
    const results = [];
    const seen = new Set();

    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const cleanLink = href.split("&")[0].replace("/url?q=", "");

      const isLegal =
        cleanLink.includes("indiankanoon.org/doc") ||
        cleanLink.includes("scconline.com") ||
        cleanLink.includes("judis.nic.in");

      if (isLegal && !seen.has(cleanLink) && cleanLink.startsWith("http")) {
        seen.add(cleanLink);
        const title = $(el).text().trim();
        if (title.length > 5) {
          results.push({ title, link: cleanLink, snippet: "", source: "Google Legal" });
        }
      }
    });

    return results.slice(0, 12);
  } catch (err) {
    console.warn("⚠️ Google scrape failed:", err.message);
    return [];
  }
}

// ─── SOURCE 3: LAW INSIDER INDIA ─────────────────────────────────────────────
async function scrapeLawInsider(query) {
  try {
    const url = `https://www.lawinsider.in/judgment?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, { headers: BROWSER_HEADERS, timeout: 8000 });
    const $ = cheerio.load(data);
    const results = [];

    $("a[href*='/judgment/']").each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr("href");
      if (title && href && title.length > 10) {
        results.push({
          title,
          link: href.startsWith("http") ? href : `https://www.lawinsider.in${href}`,
          snippet: "",
          source: "Law Insider India",
        });
      }
    });

    return results.slice(0, 6);
  } catch (err) {
    console.warn("⚠️ Law Insider scrape failed:", err.message);
    return [];
  }
}

// ─── DEDUPLICATE ─────────────────────────────────────────────────────────────
function deduplicateCases(cases) {
  const seen = new Set();
  return cases.filter((c) => {
    const key = (c.title || "").toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── MULTI-SOURCE FETCH WITH FALLBACK ────────────────────────────────────────
async function fetchFromAllSources(query) {
  const [kanoon, google, lawInsider] = await Promise.allSettled([
    scrapeIndianKanoon(query),
    scrapeGoogleLegal(query),
    scrapeLawInsider(query),
  ]);

  const combined = [
    ...(kanoon.status === "fulfilled" ? kanoon.value : []),
    ...(google.status === "fulfilled" ? google.value : []),
    ...(lawInsider.status === "fulfilled" ? lawInsider.value : []),
  ];

  return deduplicateCases(combined).slice(0, 20);
}

// ─── AI REFINE ───────────────────────────────────────────────────────────────
async function refineWithAI(query, cases) {
  const prompt = `You are an expert Indian legal research assistant.

User's legal research query: "${query}"

Raw case data fetched from multiple sources:
${JSON.stringify(cases, null, 2)}

TASK:
1. Select the top 8 most relevant cases that match the query.
2. For each case, extract or intelligently infer:
   - title: Full case name (e.g., "Ram vs State of Maharashtra")
   - court: "Supreme Court of India", "High Court of [State]", "District Court", etc.
   - year: 4-digit year as string, infer from title/link if possible
   - category: One of: "Constitutional", "Criminal", "Civil", "Family", "Property", "Labour", "Tax", "Corporate", "Consumer", "Environmental"
   - summary: 2-3 sentence professional legal summary of what this case decided or established
   - link: The original URL from the data (preserve exactly)
   - relevance: "High" | "Medium" | "Low"

CRITICAL RULES:
- Return ONLY valid JSON array. No markdown, no backticks, no preamble.
- If you cannot determine a field, use "—" not null.
- Do NOT fabricate cases. Only use cases from the input data.
- Prioritize cases from Supreme Court of India and High Courts.
- Keep summary professional and concise (legal tone).

Return format:
[{ "title": "", "court": "", "year": "", "category": "", "summary": "", "link": "", "relevance": "" }]`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pocketlawyer.in",
      "X-Title": "PocketLawyer",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) throw new Error("AI empty response");
  return data.choices[0].message.content;
}

// ─── PARSE AI RESPONSE ────────────────────────────────────────────────────────
function parseAIResponse(text) {
  const clean = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const jsonMatch = clean.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array in AI response");
  return JSON.parse(jsonMatch[0]);
}

// ─── RAW FALLBACK FORMATTER ───────────────────────────────────────────────────
function formatRawCases(rawCases) {
  return rawCases.slice(0, 10).map((c) => {
    const yearMatch = (c.title + c.link).match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "—";

    let court = "—";
    if (/supreme court/i.test(c.title + c.link)) court = "Supreme Court of India";
    else if (/high court/i.test(c.title + c.link)) court = "High Court";

    return {
      title: c.title || "Untitled Case",
      court,
      year,
      category: "—",
      summary: c.snippet || "View full judgment on source website.",
      link: c.link || "#",
      relevance: "Medium",
    };
  });
}

// ─── MAIN API ─────────────────────────────────────────────────────────────────
app.post("/api/cases", async (req, res) => {
  try {
    const filters = req.body;

    const query = [filters.category, filters.keywords, filters.purpose, filters.court]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!query) {
      return res.status(400).json({ error: "Query cannot be empty" });
    }

    console.log("📥 Query:", query);

    // CHECK CACHE
    const cached = getCached(query);
    if (cached) {
      console.log("⚡ Cache hit");
      return res.json(cached);
    }

    // FETCH FROM ALL SOURCES
    const rawCases = await fetchFromAllSources(query);
    console.log("🔍 Raw cases found:", rawCases.length);

    if (!rawCases.length) {
      const empty = [
        {
          title: "No cases found",
          court: "—",
          year: "—",
          category: "—",
          summary: "No results matched your query. Try different keywords or broaden your search.",
          link: "#",
          relevance: "Low",
        },
      ];
      return res.json(empty);
    }

    // AI REFINE
    let finalResults;
    try {
      const aiText = await refineWithAI(query, rawCases);
      const parsed = parseAIResponse(aiText);

      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty AI array");

      finalResults = parsed.map((item) => ({
        title: item.title || "Untitled Case",
        court: item.court || "—",
        year: String(item.year || "—"),
        category: item.category || "—",
        summary: item.summary || "View judgment for details.",
        link: item.link || "#",
        relevance: item.relevance || "Medium",
      }));

      console.log("✅ AI refined:", finalResults.length, "cases");
    } catch (aiErr) {
      console.warn("⚠️ AI failed, using raw results:", aiErr.message);
      finalResults = formatRawCases(rawCases);
    }

    setCache(query, finalResults);
    res.json(finalResults);
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

// ─── AI RESEARCH RESPONSE PROXY ──────────────────────────────────────────────
// Proxies OpenRouter calls from the frontend so the API key never leaves the server.
app.post("/api/ai/research-response", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pocketlawyer.in",
        "X-Title": "PocketLawyer",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a legal research assistant for Indian law. Give structured case results with title, court, year, category, summary.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenRouter error:", errText);
      return res.status(502).json({ error: "AI provider error", content: "Error fetching AI response" });
    }

    const data = await aiRes.json();
    const content = data.choices?.[0]?.message?.content || "No response";
    return res.json({ content });
  } catch (err) {
    console.error("research-response error:", err);
    return res.status(500).json({ error: "Internal server error", content: "Error fetching AI response" });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "PocketLawyer API", version: "2.0.0" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", cache_size: cache.size });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(5000, () => {
  console.log("✅ PocketLawyer Backend v2.0 → http://localhost:5000");
});