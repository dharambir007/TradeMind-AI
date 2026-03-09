const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const AIInsightService = require("../services/aiInsightService");

const getAIInsight = asyncHandler(async (req, res) => {
  const symbol = req.body?.symbol || req.query?.symbol;
  if (!symbol) {
    throw new AppError("symbol is required", 400);
  }

  const forceRefresh = String(req.body?.forceRefresh || req.query?.forceRefresh || "").toLowerCase() === "true";
  const limit = Number(req.body?.limit || req.query?.limit) || 10;
  const response = await AIInsightService.getStockInsight(symbol, { limit, forceRefresh });
  return res.json(response);
});

module.exports = {
  getAIInsight,
};
