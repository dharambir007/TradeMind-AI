const { openTime, closeTime, tradingDays } = require('../config/marketConfig');
const { cache } = require('../config/redis');
const { fetchMarketMacroNews, fetchNewsApiMarketNews } = require('../services/newsService');
const { generateMacroAnalysis } = require('../services/geminiService');

const CACHE_TTL = 30;

const safeCache = {
  async get(key) { try { return await cache.get(key); } catch { return null; } },
  async set(key, value, ttl) { try { await cache.set(key, value, ttl); } catch { /* ignore */ } },
};

const getMarketStatus = async (req, res) => {
  try {
    const cachedStatus = await safeCache.get('market:status');
    if (cachedStatus) {
      return res.json({ ...cachedStatus, cached: true });
    }

    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(now);

    const day = istDate.getDay();
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const openMinutes = openTime.hour * 60 + openTime.minute;
    const closeMinutes = closeTime.hour * 60 + closeTime.minute;

    const isTradingDay = tradingDays.includes(day);
    const isWithinHours = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    const isOpen = isTradingDay && isWithinHours;

    const response = {
      isOpen,
      currentTime: istDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      openTime: '09:15 AM',
      closeTime: '03:30 PM',
      message: isOpen ? 'Market is Open' : 'Market is Closed'
    };

    await safeCache.set('market:status', response, CACHE_TTL);

    res.json({ ...response, cached: false });
  } catch (error) {
    console.error('Market status error:', error);
    res.status(500).json({ error: 'Failed to get market status' });
  }
};

// ──────────────────────────────────────────────────────────────────
// Global macro market analysis
// ──────────────────────────────────────────────────────────────────

const MACRO_CACHE_TTL = Number(process.env.AI_INSIGHT_CACHE_TTL) || 180;

const getMacroAnalysis = async (req, res) => {
  try {
    const forceRefresh =
      String(req.body?.forceRefresh || req.query?.forceRefresh || "").toLowerCase() === "true";

    const cacheKey = "macro:analysis:v1";
    if (!forceRefresh) {
      const cached = await safeCache.get(cacheKey);
      if (cached) return res.json({ ...cached, cached: true });
    }

    // 1) Fetch broad market / macro news
    const headlines = await fetchMarketMacroNews(15);
    if (!headlines.length) {
      return res.status(404).json({ error: "No macro news headlines available" });
    }

    // 2) Send to Gemini for analysis
    const analysis = await generateMacroAnalysis(headlines);

    const response = {
      ...analysis,
      newsCount: headlines.length,
      timestamp: new Date().toISOString(),
    };

    await safeCache.set(cacheKey, response, MACRO_CACHE_TTL);
    return res.json({ ...response, cached: false });
  } catch (err) {
    console.error("getMacroAnalysis error:", err.message);
    if (err.message === "GEMINI_API_KEY not configured") {
      return res.status(503).json({ error: "Gemini API key is not configured" });
    }
    if (err.response?.status === 429) {
      return res.status(429).json({ error: "AI rate limit exceeded. Please try again in a few minutes." });
    }
    return res.status(500).json({ error: "Failed to generate macro analysis" });
  }
};

// ──────────────────────────────────────────────────────────────────
// Market News (NewsAPI.org → Google News RSS fallback)
// ──────────────────────────────────────────────────────────────────

const NEWS_CACHE_TTL = 300; // 5 min – news doesn't change every second

const getMarketNews = async (req, res) => {
  try {
    const cacheKey = "market:news:v1";
    const cached = await safeCache.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    // Primary: NewsAPI.org
    let news = await fetchNewsApiMarketNews(20);

    // Fallback: Google News RSS (extract title/link/source/publishedAt)
    if (!news.length) {
      const rssHeadlines = await fetchMarketMacroNews(20);
      news = rssHeadlines.map((h) => ({
        title: h.title || "",
        description: h.description || "",
        source: h.source || "Google News",
        url: h.link || "",
        publishedAt: h.publishedAt || "",
        image: "",
      }));
    }

    const response = {
      totalResults: news.length,
      count: news.length,
      news,
      timestamp: new Date().toISOString(),
    };

    await safeCache.set(cacheKey, response, NEWS_CACHE_TTL);
    return res.json({ ...response, cached: false });
  } catch (err) {
    console.error("getMarketNews error:", err.message);
    return res.status(500).json({ error: "Failed to fetch market news" });
  }
};

module.exports = { getMarketStatus, getMacroAnalysis, getMarketNews };
