const asyncHandler = require("../utils/asyncHandler");
const CacheService = require("../services/cacheService");
const AIInsightService = require("../services/aiInsightService");
const { getMarketNews } = require("../services/newsService");

const CACHE_TTL = 30;

const getMarketStatus = asyncHandler(async (req, res) => {
  const response = await CacheService.remember("market:status:v2", CACHE_TTL, async () => {
    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(now);
    const day = istDate.getDay();
    const minutes = istDate.getHours() * 60 + istDate.getMinutes();
    const isTradingDay = [1, 2, 3, 4, 5].includes(day);
    const isWithinHours = minutes >= 555 && minutes < 930;
    const isOpen = isTradingDay && isWithinHours;

    return {
      isOpen,
      currentTime: istDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      openTime: "09:15 AM",
      closeTime: "03:30 PM",
      message: isOpen ? "Market is Open" : "Market is Closed",
    };
  });

  return res.json(response);
});

const getMarketNewsController = asyncHandler(async (req, res) => {
  const response = await getMarketNews(req.query.limit);
  return res.json(response);
});

const getMacroAnalysis = asyncHandler(async (req, res) => {
  const forceRefresh = String(req.body?.forceRefresh || req.query?.forceRefresh || "").toLowerCase() === "true";
  const response = await AIInsightService.getMacroAnalysis(forceRefresh);
  return res.json(response);
});

module.exports = {
  getMarketStatus,
  getMarketNews: getMarketNewsController,
  getMacroAnalysis,
};
