const { cache } = require("../config/redis");
const { fetchYahooFinanceNews, normalizeSymbol } = require("../services/newsService");
const { generateInsightFromNews } = require("../services/geminiService");

const CACHE_TTL_SECONDS = Number(process.env.AI_INSIGHT_CACHE_TTL) || 180;

const safeCache = {
  async get(key) {
    try {
      return await cache.get(key);
    } catch (_) {
      return null;
    }
  },
  async set(key, value, ttl = CACHE_TTL_SECONDS) {
    try {
      await cache.set(key, value, ttl);
    } catch (_) {
      // Ignore cache write failures.
    }
  },
};

function buildNewsPayload(newsItems) {
  return newsItems.map((item) => ({
    title: item.title,
    source: item.source,
    publishedAt: item.publishedAt,
    link: item.link,
  }));
}

async function getAIInsight(req, res) {
  try {
    const rawSymbol = req.body?.symbol || req.query?.symbol;
    const symbol = normalizeSymbol(rawSymbol);
    const limit = Math.max(5, Math.min(Number(req.body?.limit || req.query?.limit) || 10, 20));
    const forceRefresh = String(req.body?.forceRefresh || req.query?.forceRefresh || "").toLowerCase() === "true";

    if (!symbol) {
      return res.status(400).json({ error: "symbol is required" });
    }

    const cacheKey = `aiInsight:v1:${symbol}:${limit}`;
    if (!forceRefresh) {
      const cached = await safeCache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const headlines = await fetchYahooFinanceNews(symbol, limit);
    if (!headlines.length) {
      return res.status(404).json({ error: `No recent news found for ${symbol}` });
    }

    const insight = await generateInsightFromNews({
      symbol,
      headlines: buildNewsPayload(headlines),
    });

    const response = {
      summary: insight.summary,
      sentiment: insight.sentiment,
      insight: insight.insight,
    };

    await safeCache.set(cacheKey, response);
    return res.json(response);
  } catch (err) {
    console.error("getAIInsight error:", err.message);
    if (err.message === "GEMINI_API_KEY not configured") {
      return res.status(503).json({ error: "Gemini API key is not configured" });
    }
    return res.status(500).json({ error: "Failed to generate AI insight" });
  }
}

module.exports = {
  getAIInsight,
};

