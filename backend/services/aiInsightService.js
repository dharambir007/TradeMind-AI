const CacheService = require("./cacheService");
const { fetchYahooFinanceNews, fetchMarketMacroNews } = require("./newsService");
const { generateInsightFromNews, generateMacroAnalysis } = require("./geminiService");
const { normalizeSymbol } = require("../utils/symbolNormalizer");

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

    const headlines = await fetchYahooFinanceNews(symbol, limit);
    if (!headlines.length) {
      return {
        success: false,
        symbol,
        summary: ["No recent headlines available right now."],
        sentiment: "Neutral",
        insight: "Could not generate insight because no recent news was found.",
      };
    }

    const insight = await generateInsightFromNews({
      symbol,
      headlines: headlines.map((item) => ({
        title: item.title,
        source: item.source,
        publishedAt: item.publishedAt,
      })),
    });

    const response = {
      success: true,
      symbol,
      summary: insight.summary,
      sentiment: insight.sentiment,
      insight: insight.insight,
      timestamp: new Date().toISOString(),
    };

    await CacheService.set(cacheKey, response, 180);
    return response;
  }

  static async getMacroAnalysis(forceRefresh = false) {
    const cacheKey = "ai:macro:v1";
    if (!forceRefresh) {
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;
    }

    const headlines = await fetchMarketMacroNews(15);
    const analysis = await generateMacroAnalysis(headlines);
    const response = {
      ...analysis,
      newsCount: headlines.length,
      timestamp: new Date().toISOString(),
    };

    await CacheService.set(cacheKey, response, Number(process.env.AI_INSIGHT_CACHE_TTL) || 180);
    return response;
  }
}

module.exports = AIInsightService;
