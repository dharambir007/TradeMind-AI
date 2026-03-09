const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { decodeSymbol, normalizeSymbol } = require("../utils/symbolNormalizer");
const MarketDataService = require("../services/marketDataService");
const PredictionService = require("../services/predictionService");
const { getStockNews } = require("../services/newsService");

const VALID_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y"]);
const VALID_INTERVALS = new Set(["1m", "2m", "5m", "10m", "15m", "30m", "1h", "4h", "1d", "1wk", "1mo"]);
const VALID_TIMEFRAMES = new Set(["3m", "5m", "10m"]);

function getParamSymbol(req) {
  return normalizeSymbol(req.params?.symbol || req.query?.symbol || req.body?.symbol || "");
}

const getStock = asyncHandler(async (req, res) => {
  const symbol = getParamSymbol(req);
  if (!symbol) {
    throw new AppError("symbol is required", 400);
  }

  const data = await MarketDataService.getStock(symbol);
  const statusCode = data.success === false ? 503 : 200;
  return res.status(statusCode).json(data);
});

const getStockHistory = asyncHandler(async (req, res) => {
  const symbol = getParamSymbol(req);
  if (!symbol) {
    throw new AppError("symbol is required", 400);
  }

  const range = VALID_RANGES.has(String(req.query.range || "").trim().toLowerCase())
    ? String(req.query.range).trim().toLowerCase()
    : "1d";
  const interval = VALID_INTERVALS.has(String(req.query.interval || "").trim().toLowerCase())
    ? String(req.query.interval).trim().toLowerCase()
    : "5m";

  try {
    const candles = await MarketDataService.getHistory(symbol, { range, interval });
    return res.json(candles);
  } catch (_) {
    return res.json([]);
  }
});

const searchStocks = asyncHandler(async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) {
    throw new AppError("Query parameter 'q' is required", 400);
  }

  const results = await MarketDataService.searchStocks(query);
  return res.json(results);
});

const getStockPrediction = asyncHandler(async (req, res) => {
  const symbol = getParamSymbol(req);
  if (!symbol) {
    throw new AppError("symbol is required", 400);
  }

  const response = await PredictionService.getPrediction(symbol);
  return res.json(response);
});

const getChartPrediction = asyncHandler(async (req, res) => {
  const symbol = getParamSymbol(req);
  if (!symbol) {
    throw new AppError("symbol is required", 400);
  }

  const timeframe = VALID_TIMEFRAMES.has(String(req.query.timeframe || "").trim().toLowerCase())
    ? String(req.query.timeframe).trim().toLowerCase()
    : "3m";
  const steps = Math.min(Math.max(Number(req.query.steps) || 3, 1), 30);

  const response = await PredictionService.getChartPrediction(symbol, { timeframe, steps });
  return res.json(response);
});

const getChartPredictionByTimeframe = asyncHandler(async (req, res) => {
  const symbol = normalizeSymbol(req.body?.symbol || "");
  if (!symbol) {
    throw new AppError("symbol is required", 400);
  }

  const timeframe = VALID_TIMEFRAMES.has(String(req.body?.timeframe || "").trim().toLowerCase())
    ? String(req.body.timeframe).trim().toLowerCase()
    : "3m";
  const steps = Math.min(Math.max(Number(req.body?.steps) || 3, 1), 30);

  const response = await PredictionService.getChartPrediction(symbol, {
    timeframe,
    steps,
    pullbackProbability: req.body?.pullbackProbability,
    volatilityScale: req.body?.volatilityScale,
  });
  return res.json(response);
});

const getStockNewsBySymbol = asyncHandler(async (req, res) => {
  const symbol = getParamSymbol(req);
  if (!symbol) {
    throw new AppError("symbol is required", 400);
  }

  const response = await getStockNews(symbol, req.query.limit);
  return res.json(response);
});

const predictionCompatHandler = asyncHandler(async (req, res) => {
  const symbol = normalizeSymbol(req.query?.symbol || req.body?.symbol || "");
  if (!symbol) {
    throw new AppError("symbol is required", 400);
  }

  req.params = { ...(req.params || {}), symbol: decodeSymbol(symbol) };
  return getStockPrediction(req, res);
});

module.exports = {
  getStock,
  getStockHistory,
  searchStocks,
  getStockPrediction,
  getChartPrediction,
  getChartPredictionByTimeframe,
  getStockNewsBySymbol,
  predictionCompatHandler,
};
