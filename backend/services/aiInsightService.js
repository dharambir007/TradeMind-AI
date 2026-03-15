const CacheService = require("./cacheService");
const { fetchYahooFinanceNews, fetchMarketMacroNews } = require("./newsService");
const { generateInsightFromNews, generateMacroAnalysis } = require("./geminiService");
const { normalizeSymbol } = require("../utils/symbolNormalizer");

const logger = require("../utils/logger");

class AIInsightService {
  static async getStockInsight(symbolInput, options = {}) {
    const symbol = normalizeSymbol(symbolInput);
    const limit = Math.min(Math.max(Number(options.limit) || 10, 5), 20);
    const forceRefresh = options.forceRefresh === true;
    const cacheKey = `ai:stock:${symbol}:${limit}`;

    if (!forceRefresh) {
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;
    }

    let headlines;
    try {
      headlines = await fetchYahooFinanceNews(symbol, limit);
    } catch (err) {
      logger.warn(`[AIInsight] fetchYahooFinanceNews failed for ${symbol}:`, err.message);
      headlines = [];
    }

    if (!headlines.length) {
      return {
        success: false,
        symbol,
        summary: ["No recent headlines available right now."],
        sentiment: "Neutral",
        insight: "Could not generate insight because no recent news was found.",
      };
    }

    let insight;
    try {
      insight = await generateInsightFromNews({
        symbol,
        headlines: headlines.map((item) => ({
          title: item.title,
          source: item.source,
          publishedAt: item.publishedAt,
        })),
      });
    } catch (err) {
      logger.warn(`[AIInsight] generateInsightFromNews failed for ${symbol}:`, err.message);
      return {
        success: false,
        symbol,
        summary: headlines.slice(0, 5).map((h) => h.title || ""),
        sentiment: "Neutral",
        insight: "AI analysis temporarily unavailable.",
      };
    }

    const response = {
      success: true,
      symbol,
      summary: insight.summary,
      sentiment: insight.sentiment,
      insight: insight.insight,
      timestamp: new Date().toISOString(),
    };

    await CacheService.set(cacheKey, response, Number(process.env.AI_INSIGHT_CACHE_TTL) || 300);
    return response;
  }

  static async getMacroAnalysis(forceRefresh = false) {
    const cacheKey = "ai:macro:v1";
    if (!forceRefresh) {
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;
    }

    let headlines;
    try {
      headlines = await fetchMarketMacroNews(15);
    } catch (err) {
      logger.warn("[AIInsight] fetchMarketMacroNews failed:", err.message);
      headlines = [];
    }

    if (!headlines.length) {
      return {
        success: false,
        summary: "Market macro news unavailable.",
        sentiment: "Neutral",
        newsCount: 0,
        timestamp: new Date().toISOString(),
      };
    }

    let analysis;
    try {
      analysis = await generateMacroAnalysis(headlines);
    } catch (err) {
      logger.warn("[AIInsight] generateMacroAnalysis failed:", err.message);
      return {
        success: false,
        summary: "Macro analysis temporarily unavailable.",
        sentiment: "Neutral",
        newsCount: headlines.length,
        timestamp: new Date().toISOString(),
      };
    }

    const response = {
      ...analysis,
      newsCount: headlines.length,
      timestamp: new Date().toISOString(),
    };

    await CacheService.set(cacheKey, response, Number(process.env.AI_INSIGHT_CACHE_TTL) || 300);
    return response;
  }
}

module.exports = AIInsightService;
