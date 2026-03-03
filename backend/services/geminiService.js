const axios = require("axios");

const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 12000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function normalizeSentiment(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("bull")) return "Bullish";
  if (raw.includes("bear")) return "Bearish";
  return "Neutral";
}

function sanitizeSummary(summary, fallbackHeadlines = []) {
  const rows = Array.isArray(summary) ? summary : [];
  const cleaned = rows
    .map((s) => String(s || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 5);

  if (cleaned.length >= 5) return cleaned;

  for (const headline of fallbackHeadlines) {
    const text = String(headline || "").trim();
    if (!text) continue;
    if (!cleaned.includes(text)) cleaned.push(text);
    if (cleaned.length >= 5) break;
  }

  while (cleaned.length < 5) {
    cleaned.push("No additional high-confidence news signal.");
  }
  return cleaned.slice(0, 5);
}

function buildPrompt({ symbol, headlines }) {
  const newsBlock = headlines
    .map((h, idx) => {
      const title = String(h.title || "").trim();
      const source = String(h.source || "Unknown").trim();
      const publishedAt = String(h.publishedAt || "").trim();
      return `${idx + 1}. ${title} | Source: ${source} | Time: ${publishedAt}`;
    })
    .join("\n");

  return [
    "You are a financial news analyst for an Indian equities trading dashboard.",
    `Analyze the latest news for symbol: ${symbol}.`,
    "",
    "News Headlines:",
    newsBlock,
    "",
    "Task:",
    "1) Write exactly 5 concise bullet summary points.",
    "2) Classify sentiment as one of: Bullish, Bearish, Neutral.",
    "3) Write one short insight paragraph (max 70 words) focused on near-term market impact.",
    "",
    "Rules:",
    "- Use only evidence from given headlines.",
    "- Avoid investment advice language.",
    "- If headlines are mixed, choose Neutral.",
    "- Return valid JSON only with keys: summary, sentiment, insight.",
    '- JSON schema: {"summary":["...","...","...","...","..."],"sentiment":"Bullish|Bearish|Neutral","insight":"..."}',
  ].join("\n");
}

function extractJsonObject(text) {
  if (!text) return null;
  const trimmed = String(text).trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    // Continue fallback parsing.
  }

  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i) || trimmed.match(/```([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (_) {
      // Continue to brace-matching fallback.
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const body = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(body);
    } catch (_) {
      return null;
    }
  }

  return null;
}

function extractModelText(geminiResponse) {
  const candidates = geminiResponse?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

async function generateInsightFromNews({ symbol, headlines }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const prompt = buildPrompt({ symbol, headlines });
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await axios.post(
    endpoint,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 700,
        responseMimeType: "application/json",
      },
    },
    {
      timeout: GEMINI_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    }
  );

  const rawText = extractModelText(response.data);
  const parsed = extractJsonObject(rawText);

  const fallbackHeadlines = headlines.map((h) => h.title).filter(Boolean);

  return {
    summary: sanitizeSummary(parsed?.summary, fallbackHeadlines),
    sentiment: normalizeSentiment(parsed?.sentiment),
    insight: String(parsed?.insight || "News flow is mixed; monitor confirmation from price action and volume.")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

module.exports = {
  generateInsightFromNews,
  generateMacroAnalysis,
};

// ──────────────────────────────────────────────────────────────────
// Macro market analysis
// ──────────────────────────────────────────────────────────────────

function buildMacroPrompt(combinedNews) {
  return `You are a professional global macro financial analyst.

Below is a collection of the latest financial and economic news headlines and summaries.

Your task:
1. Identify the 5–8 most important news events that could impact the overall stock market (not company-specific minor news).
2. Focus on macroeconomic factors such as inflation, interest rates, central bank policy (Fed/RBI), crude oil prices, geopolitical tensions, global indices, bond yields, currency movement, FII/DII activity, and major economic data releases.
3. Ignore low-impact or irrelevant news.
4. Provide:
   - A concise bullet-point summary (5–8 key events)
   - Overall Market Sentiment: Bullish / Bearish / Neutral / Volatile
   - Short 3–4 line explanation of expected market impact
   - Risk Level: Low / Medium / High
   - Sectors likely to be affected (if applicable)

Respond strictly in JSON format:

{
  "keyEvents": [],
  "marketSentiment": "",
  "impactAnalysis": "",
  "riskLevel": "",
  "affectedSectors": []
}

News Data:
${combinedNews}`;
}

function normalizeMacroResponse(parsed) {
  const keyEvents = Array.isArray(parsed?.keyEvents)
    ? parsed.keyEvents.map((e) => String(e || "").trim()).filter(Boolean).slice(0, 8)
    : [];

  const sentimentRaw = String(parsed?.marketSentiment || "").trim().toLowerCase();
  let marketSentiment = "Neutral";
  if (sentimentRaw.includes("bull")) marketSentiment = "Bullish";
  else if (sentimentRaw.includes("bear")) marketSentiment = "Bearish";
  else if (sentimentRaw.includes("volat")) marketSentiment = "Volatile";

  const impactAnalysis = String(parsed?.impactAnalysis || "Insufficient data to determine market impact.").trim();

  const riskRaw = String(parsed?.riskLevel || "").trim().toLowerCase();
  let riskLevel = "Medium";
  if (riskRaw.includes("low")) riskLevel = "Low";
  else if (riskRaw.includes("high")) riskLevel = "High";

  const affectedSectors = Array.isArray(parsed?.affectedSectors)
    ? parsed.affectedSectors.map((s) => String(s || "").trim()).filter(Boolean)
    : [];

  return { keyEvents, marketSentiment, impactAnalysis, riskLevel, affectedSectors };
}

async function generateMacroAnalysis(headlines) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  // Combine headlines into a single text block
  const combinedNews = headlines
    .map((h) => {
      const title = String(h.title || "").trim();
      const desc = String(h.description || "").trim();
      const source = String(h.source || "").trim();
      const time = String(h.publishedAt || "").trim();
      return `${title}${desc ? ". " + desc : ""}${source ? " | Source: " + source : ""}${time ? " | " + time : ""}`;
    })
    .filter(Boolean)
    .join("\n");

  if (!combinedNews) {
    throw new Error("No news content to analyze");
  }

  const prompt = buildMacroPrompt(combinedNews);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const MAX_RETRIES = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        endpoint,
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            topP: 0.9,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
          },
        },
        {
          timeout: GEMINI_TIMEOUT_MS,
          headers: { "Content-Type": "application/json" },
        }
      );

      const rawText = extractModelText(response.data);
      const parsed = extractJsonObject(rawText);

      if (!parsed) {
        throw new Error("Failed to parse Gemini macro analysis response");
      }

      return normalizeMacroResponse(parsed);
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // Retry on 429 (rate limit) or 503 (overloaded) with backoff
      if ((status === 429 || status === 503) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 3000; // 3s, 6s
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

