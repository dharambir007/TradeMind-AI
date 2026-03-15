const asyncHandler = require("../utils/asyncHandler");
const CacheService = require("../services/cacheService");
const AIInsightService = require("../services/aiInsightService");
const { getMarketNews } = require("../services/newsService");

const CACHE_TTL = 30;

const getMarketStatus = asyncHandler(async (req, res) => {
  const response = await CacheService.remember("market:status:v2", CACHE_TTL, async () => {
    // Use Intl.DateTimeFormat.formatToParts for reliable IST conversion
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(now);

    const p = {};
    for (const part of parts) p[part.type] = part.value;

    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    const minutes = Number(p.hour) * 60 + Number(p.minute);
    const isTradingDay = day >= 1 && day <= 5;
    const isWithinHours = minutes >= 555 && minutes < 930;
    const isOpen = isTradingDay && isWithinHours;

    const hh = String(Number(p.hour) % 12 || 12).padStart(2, "0");
    const mm = p.minute;
    const ampm = Number(p.hour) < 12 ? "AM" : "PM";

    return {
      isOpen,
      currentTime: `${hh}:${mm} ${ampm}`,
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
