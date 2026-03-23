const { normalizeSymbol } = require("../utils/symbolNormalizer");
const { createHttpClient, withRetry } = require("../utils/httpClient");
const CacheService = require("./cacheService");
const MarketDataService = require("./marketDataService");

const TIMEFRAME_INTERVAL_SECONDS = {
  "3m": 180,
  "5m": 300,
  "10m": 600,
};

const DEFAULT_WAKEUP_MESSAGE = "AI service is waking up... please try again in 10 seconds.";
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS) || 45000;

const mlClient = createHttpClient({
  baseURL: process.env.ML_SERVICE_URL || "http://127.0.0.1:8000",
  timeout: ML_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num <= 1 ? round2(num * 100) : round2(num);
}

function sanitizePredictionCandle(candidate) {
  if (!candidate) return null;

  const timeValue = candidate.time ?? candidate.timestamp ?? candidate.date;
  const parsedTime =
    typeof timeValue === "string" && !/^\d+(\.\d+)?$/.test(timeValue)
      ? Date.parse(timeValue)
      : Number(timeValue);

  const normalizedTime = Number.isFinite(parsedTime)
    ? parsedTime > 1e12
      ? Math.floor(parsedTime / 1000)
      : Math.floor(parsedTime)
    : null;

  const open = Number(candidate.open);
  const high = Number(candidate.high);
  const low = Number(candidate.low);
  const close = Number(candidate.close);
  const volume = Number(candidate.volume) || 0;

  if (![normalizedTime, open, high, low, close].every(Number.isFinite)) {
    return null;
  }

  if (normalizedTime <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0) {
    return null;
  }

  return {
    time: normalizedTime,
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    volume: Number.isFinite(volume) ? Math.max(0, volume) : 0,
    date:
      typeof candidate.date === "string" && candidate.date.trim()
        ? candidate.date
        : new Date(normalizedTime * 1000).toISOString(),
  };
}

function sanitizePredictionCandles(candles) {
  if (!Array.isArray(candles) || !candles.length) return [];

  return candles
    .map(sanitizePredictionCandle)
    .filter(Boolean)
    .sort((left, right) => left.time - right.time);
}

function aggregateCandles(candles, intervalSeconds) {
  const sanitizedCandles = sanitizePredictionCandles(candles);
  if (!sanitizedCandles.length) return [];

  const buckets = new Map();
  for (const candle of sanitizedCandles) {
    const bucketTime = Math.floor(Number(candle.time) / intervalSeconds) * intervalSeconds;
    const existing = buckets.get(bucketTime);

    if (!existing) {
      buckets.set(bucketTime, {
        time: bucketTime,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume) || 0,
      });
      continue;
    }

    existing.high = Math.max(existing.high, Number(candle.high));
    existing.low = Math.min(existing.low, Number(candle.low));
    existing.close = Number(candle.close);
    existing.volume += Number(candle.volume) || 0;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((item) => ({
      time: item.time,
      open: round2(item.open),
      high: round2(item.high),
      low: round2(item.low),
      close: round2(item.close),
      volume: Math.max(0, Math.round(item.volume)),
    }));
}

function getDirectionFromCandles(candles) {
  if (!Array.isArray(candles) || candles.length < 2) return "UP";
  return Number(candles[candles.length - 1].close) >= Number(candles[candles.length - 2].close) ? "UP" : "DOWN";
}

function buildFallbackPrediction(symbol, candles, message) {
  const currentPrice = Number(candles[candles.length - 1]?.close) || 0;
  const direction = getDirectionFromCandles(candles);

  return {
    success: false,
    symbol,
    prediction_price: round2(currentPrice),
    trend: direction === "UP" ? "up" : "down",
    confidence: 0,
    direction,
    probability: 0,
    current_price: round2(currentPrice),
    target_price: round2(currentPrice),
    message: message || DEFAULT_WAKEUP_MESSAGE,
    timestamp: new Date().toISOString(),
  };
}

function getMlFallbackMessage(error) {
  const status = Number(error?.response?.status || 0);
  const detail = String(error?.response?.data?.detail || error?.response?.data?.message || "").trim();
  const code = String(error?.code || "").trim();

  if (status >= 400 && status < 500) {
    return detail || "Prediction request could not be processed. Please try with another symbol.";
  }

  if (code === "ECONNABORTED") {
    return DEFAULT_WAKEUP_MESSAGE;
  }

  if (!status || status >= 500) {
    return DEFAULT_WAKEUP_MESSAGE;
  }

  return detail || DEFAULT_WAKEUP_MESSAGE;
}

function buildPredictedDataForTimeframe({ predictionCandles, historicalData, intervalSeconds, direction, currentPrice }) {
  const lastHistorical = historicalData[historicalData.length - 1];
  if (!lastHistorical) return [];

  const base = Array.isArray(predictionCandles) ? predictionCandles : [];
  const fallbackMove = String(direction || "UP").toUpperCase() === "DOWN" ? -0.0015 : 0.0015;
  const output = [];
  let prevClose = Number(currentPrice) || Number(lastHistorical.close);

  for (let index = 0; index < Math.max(base.length, 3); index += 1) {
    const source = base[index] || {};
    const time = Number(source.time) || Number(lastHistorical.time) + intervalSeconds * (index + 1);
    const open = Number(source.open) || prevClose;
    const close = Number(source.close) || open * (1 + fallbackMove);
    const high = Math.max(Number(source.high) || 0, open, close);
    const low = Math.min(Number(source.low) || Number.MAX_SAFE_INTEGER, open, close);
    const candle = {
      time: Math.floor(time),
      open: round2(open),
      high: round2(high),
      low: round2(Number.isFinite(low) ? low : Math.min(open, close)),
      close: round2(close),
      volume: Math.max(Number(source.volume) || Number(lastHistorical.volume) || 0, 0),
    };
    output.push(candle);
    prevClose = candle.close;
  }

  return output;
}

async function callMl(path, payload) {
  const response = await withRetry(
    () => mlClient.post(path, payload),
    { retries: 4, delayMs: 1200 }
  );

  return response.data;
}

class PredictionService {
  static async getPrediction(symbolInput) {
    const symbol = normalizeSymbol(symbolInput);
    const cacheKey = `prediction:single:${symbol}`;

    const cached = await CacheService.get(cacheKey);
    if (cached && cached.success !== false) {
      return cached;
    }

    const candles = sanitizePredictionCandles(await MarketDataService.getPredictionCandles(symbol));
    if (candles.length < 30) {
      return buildFallbackPrediction(symbol, candles, "Insufficient data for prediction");
    }

    const recentCandles = candles.slice(-100).map((candle) => ({
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      date: candle.date,
    }));

    try {
      const mlResponse = await callMl("/predict", {
        symbol,
        candles: recentCandles,
        horizon: 5,
        features: recentCandles.map((item) => item.close),
      });

      const currentPrice = Number(recentCandles[recentCandles.length - 1]?.close) || 0;
      const predictedReturn = Number(mlResponse.prediction) || 0;
      const targetPrice = round2(currentPrice * (1 + predictedReturn));
      const direction = String(mlResponse.direction || getDirectionFromCandles(recentCandles)).toUpperCase();
      const confidence = Number(mlResponse.probability) || 0;

      const result = {
        success: true,
        symbol,
        prediction_price: targetPrice,
        trend: direction === "UP" ? "up" : "down",
        confidence,
        direction,
        probability: confidence,
        current_price: round2(currentPrice),
        target_price: targetPrice,
        processing_time_ms: Number(mlResponse.processing_time_ms) || 0,
        timestamp: new Date().toISOString(),
      };

      await CacheService.set(cacheKey, result, 180);
      return result;
    } catch (error) {
      return buildFallbackPrediction(symbol, recentCandles, getMlFallbackMessage(error));
    }
  }

  static async getChartPrediction(symbolInput, options = {}) {
    const symbol = normalizeSymbol(symbolInput);
    const timeframe = String(options.timeframe || "3m").toLowerCase();
    const intervalSeconds = TIMEFRAME_INTERVAL_SECONDS[timeframe] || TIMEFRAME_INTERVAL_SECONDS["3m"];
    const steps = Math.min(Math.max(Number(options.steps) || 3, 1), 30);
    const cacheKey = `prediction:chart:${symbol}:${timeframe}:${steps}`;

    const cached = await CacheService.get(cacheKey);
    if (cached && cached.success !== false) {
      return cached;
    }

    const sourceCandles = sanitizePredictionCandles(await MarketDataService.getPredictionCandles(symbol));
    const historicalData = aggregateCandles(sourceCandles, intervalSeconds).slice(-160);

    if (sourceCandles.length < 30 || !historicalData.length) {
      const fallback = buildFallbackPrediction(symbol, sourceCandles, "Insufficient data for prediction");
      return {
        success: false,
        symbol,
        timeframe,
        historicalData,
        predictedData: buildPredictedDataForTimeframe({
          predictionCandles: [],
          historicalData,
          intervalSeconds,
          direction: fallback.direction,
          currentPrice: fallback.current_price,
        }).slice(0, steps),
        predictionMeta: {
          direction: fallback.direction,
          confidence: 0,
          currentPrice: fallback.current_price,
          targetPrice: fallback.target_price,
          processingTimeMs: 0,
          steps,
        },
        message: fallback.message,
        timestamp: fallback.timestamp,
      };
    }

    const recentCandles = sourceCandles.slice(-100).map((candle) => ({
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      date: candle.date,
    }));

    try {
      const mlResponse = await callMl("/predict-candles", {
        symbol,
        candles: recentCandles,
        steps,
        timeframe,
        interval_seconds: intervalSeconds,
        pullback_probability: clamp(Number(options.pullbackProbability) || 0.35, 0.2, 0.6),
        volatility_scale: clamp(Number(options.volatilityScale) || 1, 0.6, 1.8),
      });

      const predictedData = buildPredictedDataForTimeframe({
        predictionCandles: mlResponse.predicted_candles || [],
        historicalData,
        intervalSeconds,
        direction: mlResponse.direction,
        currentPrice: mlResponse.current_price,
      }).slice(0, steps);

      const result = {
        success: true,
        symbol,
        timeframe,
        historicalData,
        predictedData,
        predictionMeta: {
          direction: String(mlResponse.direction || getDirectionFromCandles(historicalData)).toUpperCase(),
          confidence: normalizeConfidence(mlResponse.confidence),
          currentPrice: round2(mlResponse.current_price),
          targetPrice: round2(mlResponse.target_price),
          processingTimeMs: Number(mlResponse.processing_time_ms) || 0,
          steps: predictedData.length,
        },
        timestamp: new Date().toISOString(),
      };

      await CacheService.set(cacheKey, result, 180);
      return result;
    } catch (error) {
      const fallback = buildFallbackPrediction(symbol, recentCandles, getMlFallbackMessage(error));
      return {
        success: false,
        symbol,
        timeframe,
        historicalData,
        predictedData: buildPredictedDataForTimeframe({
          predictionCandles: [],
          historicalData,
          intervalSeconds,
          direction: fallback.direction,
          currentPrice: fallback.current_price,
        }).slice(0, steps),
        predictionMeta: {
          direction: fallback.direction,
          confidence: 0,
          currentPrice: fallback.current_price,
          targetPrice: fallback.target_price,
          processingTimeMs: 0,
          steps,
        },
        message: fallback.message,
        timestamp: fallback.timestamp,
      };
    }
  }

  static async checkHealth() {
    try {
      const response = await mlClient.get("/health", { timeout: 3000 });
      return response.data?.status === "ok";
    } catch (_) {
      return false;
    }
  }
}

module.exports = PredictionService;
