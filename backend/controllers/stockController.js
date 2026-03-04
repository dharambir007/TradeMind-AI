const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();
const { cache } = require("../config/redis");
const { searchIndianStocks, symbolMap } = require("../data/indianStocks");
const { getPrediction, getPredictionCandles } = require("../services/mlService");

const safeCache = {
  async get(key) {
    try { return await cache.get(key); } catch { return null; }
  },
  async set(key, value, ttl) {
    try { await cache.set(key, value, ttl); } catch { /* ignore */ }
  },
};

const TIMEFRAME_INTERVAL_SECONDS = {
  "3m": 180,
  "5m": 300,
  "10m": 600,
};

const INTRADAY_CHART_INTERVAL_SECONDS = {
  "1m": 60,
  "2m": 120,
  "5m": 300,
  "10m": 600,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
};

const YAHOO_DIRECT_INTRADAY_INTERVALS = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "90m"]);
const MARKET_TIME_ZONE = "Asia/Kolkata";
const MARKET_OPEN_MINUTE = 9 * 60 + 15;
const MARKET_CLOSE_MINUTE = 15 * 60 + 30;

const DEFAULT_CHART_STEPS = 3;

const getStock = async (req, res) => {
  try {
    let symbol;
    try {
      symbol = await resolveSymbol(req.params.symbol);
    } catch (resolveErr) {
      console.error("[getStock] resolveSymbol failed:", resolveErr.message);
      const raw = String(req.params.symbol).toUpperCase();
      symbol = raw.includes(".") ? raw : `${raw}.NS`;
    }

    console.log(`[getStock] symbol=${req.params.symbol} → resolved=${symbol}`);
    const cacheKey = `stock:${symbol}`;

    const cached = await safeCache.get(cacheKey);
    if (cached) return res.json(cached);

    let quote;
    try {
      quote = await yahooFinance.quote(symbol);
    } catch (quoteErr) {
      console.error(`[getStock] Yahoo quote(${symbol}) failed:`, quoteErr.message);
      return res.status(502).json({ error: "Unable to fetch stock quote from market data provider" });
    }

    if (!quote || !quote.regularMarketPrice) {
      console.warn(`[getStock] No valid quote data for ${symbol}`);
      return res.status(404).json({ error: `No market data found for ${symbol}` });
    }

    const data = {
      symbol: quote.symbol,
      name: quote.shortName || quote.longName || symbol,
      price: quote.regularMarketPrice,
      change: parseFloat((quote.regularMarketChange || 0).toFixed(2)),
      changePercent: parseFloat(
        (quote.regularMarketChangePercent || 0).toFixed(2)
      ),
      marketCap: formatLargeNumber(quote.marketCap),
      volume: formatLargeNumber(quote.regularMarketVolume),
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      prevClose: quote.regularMarketPreviousClose,
      open: quote.regularMarketOpen,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      currency: quote.currency || "USD",
    };

    await safeCache.set(cacheKey, data, 60);
    res.json(data);
  } catch (err) {
    console.error("[getStock] Unhandled error:", err.message);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
};

const VALID_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y"]);
const VALID_INTERVALS = new Set([
  "1m", "2m", "5m", "10m", "15m", "30m", "1h", "4h", "1d", "1wk", "1mo",
]);

const getStockHistory = async (req, res) => {
  try {
    // --- 1. Validate & default query parameters ---
    let range = String(req.query.range || "").trim().toLowerCase();
    let interval = String(req.query.interval || "").trim().toLowerCase();

    if (!range || !VALID_RANGES.has(range)) range = "1d";
    if (!interval || !VALID_INTERVALS.has(interval)) interval = "5m";

    console.log(`[getStockHistory] symbol=${req.params.symbol} range=${range} interval=${interval}`);

    // --- 2. Resolve symbol (appends .NS for NSE via resolveSymbol) ---
    let symbol;
    try {
      symbol = await resolveSymbol(req.params.symbol);
    } catch (resolveErr) {
      console.error("[getStockHistory] resolveSymbol failed:", resolveErr.message);
      // Fallback: append .NS for Indian stocks
      const raw = String(req.params.symbol).toUpperCase();
      symbol = raw.includes(".") ? raw : `${raw}.NS`;
    }

    const intradaySeconds = getIntradayIntervalSeconds(interval);
    const isIntraday = Number.isFinite(intradaySeconds);

    if (isIntraday) {
      if (interval === "1m" && range !== "1d") range = "5d";
      if (["2m", "5m"].includes(interval) && !["1d", "5d"].includes(range)) range = "5d";
    }

    // --- 3. Cache check ---
    const cacheKey = `history:v2:${symbol}:${range}:${interval}`;
    const cached = await safeCache.get(cacheKey);
    if (cached) {
      console.log(`[getStockHistory] Cache HIT for ${cacheKey}`);
      return res.json(cached);
    }

    // --- 4. Fetch data ---
    if (isIntraday) {
      let intradayCandles = [];
      try {
        intradayCandles = await fetchIntradayHistoryCandles(symbol, { range, interval });
      } catch (fetchErr) {
        console.error("[getStockHistory] fetchIntradayHistoryCandles failed:", fetchErr.message);
        return res.json({ success: false, message: "No stock data available", data: [] });
      }

      const sessionCandles = filterToCurrentOrLastTradingSession(intradayCandles, {
        timeZone: MARKET_TIME_ZONE,
        openMinute: MARKET_OPEN_MINUTE,
        closeMinute: MARKET_CLOSE_MINUTE,
      });

      if (!sessionCandles || sessionCandles.length === 0) {
        console.warn(`[getStockHistory] No intraday candles for ${symbol} (${range}/${interval})`);
        return res.json([]);
      }

      // Intraday should stay fresh for realtime UI.
      await safeCache.set(cacheKey, sessionCandles, 10);
      console.log(`[getStockHistory] Intraday response: ${symbol} ${interval} ${range} → ${sessionCandles.length} candles`);
      return res.json(sessionCandles);
    }

    // --- 5. Daily / weekly / monthly ---
    let result;
    try {
      const period1 = getPeriodStart(range, interval);
      const period2 = new Date();
      result = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval,
      });
    } catch (yahooErr) {
      console.error("[getStockHistory] Yahoo Finance chart() error:", yahooErr.message);
      return res.json({ success: false, message: "No stock data available", data: [] });
    }

    if (!result || !result.quotes || result.quotes.length === 0) {
      console.warn(`[getStockHistory] Yahoo returned empty quotes for ${symbol}`);
      return res.json({ success: false, message: "No stock data available", data: [] });
    }

    const candles = (result.quotes)
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        time: formatDate(q.date),
        open: parseFloat(q.open.toFixed(2)),
        high: parseFloat(q.high.toFixed(2)),
        low: parseFloat(q.low.toFixed(2)),
        close: parseFloat(q.close.toFixed(2)),
        volume: q.volume || 0,
      }));

    if (candles.length === 0) {
      console.warn(`[getStockHistory] All quotes filtered out for ${symbol}`);
      return res.json({ success: false, message: "No stock data available", data: [] });
    }

    await safeCache.set(cacheKey, candles, 300);
    console.log(`[getStockHistory] Daily response: ${symbol} ${interval} ${range} → ${candles.length} candles`);
    res.json(candles);
  } catch (err) {
    console.error("[getStockHistory] Unhandled error:", err.message, err.stack);
    res.status(500).json({ success: false, message: "Failed to fetch stock history", data: [] });
  }
};

const searchStocks = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });

    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = await safeCache.get(cacheKey);
    if (cached) return res.json(cached);

    const localResults = searchIndianStocks(query, 8).map((s) => ({
      symbol: s.symbol,
      name: s.name,
      exchange: "NSE",
      sector: s.sector,
    }));

    if (localResults.length >= 3) {
      await safeCache.set(cacheKey, localResults, 300);
      return res.json(localResults);
    }

    try {
      const results = await yahooFinance.search(query);
      const yahooStocks = (results.quotes || [])
        .filter((q) => q.quoteType === "EQUITY")
        .slice(0, 10)
        .map((q) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          exchange: q.exchDisp || q.exchange,
        }));

      const seen = new Set(localResults.map((r) => r.symbol));
      const merged = [...localResults];
      for (const s of yahooStocks) {
        const base = s.symbol.replace(/\.(NS|BO)$/, "");
        if (!seen.has(base) && !seen.has(s.symbol)) {
          seen.add(base);
          merged.push(s);
        }
        if (merged.length >= 8) break;
      }

      await safeCache.set(cacheKey, merged, 300);
      return res.json(merged);
    } catch (_) {
      await safeCache.set(cacheKey, localResults, 60);
      return res.json(localResults);
    }
  } catch (err) {
    console.error("searchStocks error:", err.message);
    res.status(500).json({ error: "Failed to search stocks" });
  }
};

const getStockPrediction = async (req, res) => {
  try {
    const symbol = await resolveSymbol(req.params.symbol);
    const cacheKey = `prediction:${symbol}`;

    const cached = await safeCache.get(cacheKey);
    if (cached) return res.json(cached);

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: "1m",
    });

    const quotes = result.quotes || [];
    const candles = quotes
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
        date: q.date.toISOString(),
      }));

    if (candles.length < 60) {
      return res.status(400).json({ error: "Insufficient data for prediction" });
    }

    const recentCandles = candles.slice(-100);
    const prediction = await getPrediction(recentCandles);

    const response = {
      symbol,
      ...prediction,
      timestamp: new Date().toISOString(),
    };

    await safeCache.set(cacheKey, response, 60);
    res.json(response);

  } catch (err) {
    console.error("getStockPrediction error:", err.message);
    res.status(500).json({ error: "Failed to generate prediction" });
  }
};

const getChartPrediction = async (req, res) => {
  try {
    const symbol = await resolveSymbol(req.params.symbol);
    const steps = Math.min(Math.max(parseInt(req.query.steps) || 3, 1), 30);

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: "1m",
    });

    const quotes = result.quotes || [];
    const candles = quotes
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
        date: q.date.toISOString(),
      }));

    if (candles.length < 60) {
      return res.status(400).json({ error: "Insufficient data for prediction" });
    }

    const recentCandles = candles.slice(-100);
    const prediction = await getPredictionCandles(recentCandles, steps, {
      timeframe: "1m",
      intervalSeconds: 60,
    });

    res.json({
      symbol,
      ...prediction,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("getChartPrediction error:", err.message);
    res.status(500).json({ error: "Failed to generate chart prediction" });
  }
};

const getChartPredictionByTimeframe = async (req, res) => {
  try {
    const inputSymbol = req.body?.symbol;
    const timeframe = normalizeTimeframe(req.body?.timeframe || "3m");
    const steps = Math.min(Math.max(parseInt(req.body?.steps) || DEFAULT_CHART_STEPS, 1), 30);

    if (!inputSymbol) {
      return res.status(400).json({ error: "symbol is required" });
    }

    if (!timeframe) {
      return res.status(400).json({ error: "timeframe must be one of: 3m, 5m, 10m" });
    }

    const symbol = await resolveSymbol(inputSymbol);
    const cacheKey = `predictChartV3:${symbol}:${timeframe}:${steps}`;

    const cached = await safeCache.get(cacheKey);
    if (cached) return res.json(cached);

    const minuteCandles = await fetchRecentMinuteCandles(symbol);
    if (minuteCandles.length < 60) {
      return res.status(400).json({ error: "Insufficient data for prediction" });
    }

    const recentCandles = minuteCandles.slice(-100).map((c) => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 0,
      date: c.date,
    }));

    const intervalSeconds = TIMEFRAME_INTERVAL_SECONDS[timeframe];
    const pullbackProbability = Number(req.body?.pullbackProbability);
    const volatilityScale = Number(req.body?.volatilityScale);
    const predictionOptions = {
      timeframe,
      intervalSeconds,
    };
    if (Number.isFinite(pullbackProbability)) {
      predictionOptions.pullbackProbability = clamp(pullbackProbability, 0.2, 0.6);
    }
    if (Number.isFinite(volatilityScale)) {
      predictionOptions.volatilityScale = clamp(volatilityScale, 0.6, 1.8);
    }

    const prediction = await getPredictionCandles(recentCandles, steps, predictionOptions);

    const historicalData = aggregateCandles(minuteCandles, intervalSeconds).slice(-160);
    const predictedData = buildPredictedDataForTimeframe({
      basePredictedCandles: prediction.predicted_candles || [],
      lastHistoricalCandle: historicalData[historicalData.length - 1],
      intervalSeconds,
      fallbackDirection: prediction.direction,
      fallbackCurrentPrice: prediction.current_price,
    });

    const response = {
      symbol,
      timeframe,
      historicalData,
      predictedData,
      predictionMeta: {
        direction: prediction.direction,
        confidence: normalizeConfidenceToPercent(prediction.confidence),
        currentPrice: prediction.current_price,
        targetPrice: prediction.target_price,
        processingTimeMs: prediction.processing_time_ms,
        steps: predictedData.length,
      },
      timestamp: new Date().toISOString(),
    };

    await safeCache.set(cacheKey, response, 30);
    res.json(response);
  } catch (err) {
    console.error("getChartPredictionByTimeframe error:", err.message);
    res.status(500).json({ error: "Failed to generate timeframe chart prediction" });
  }
};

async function fetchRecentMinuteCandles(symbol) {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  const result = await yahooFinance.chart(symbol, {
    period1: start,
    period2: end,
    interval: "1m",
  });

  return (result.quotes || [])
    .filter((q) => q.open != null && q.close != null)
    .map((q) => ({
      time: Math.floor(new Date(q.date).getTime() / 1000),
      open: parseFloat(q.open.toFixed(2)),
      high: parseFloat(q.high.toFixed(2)),
      low: parseFloat(q.low.toFixed(2)),
      close: parseFloat(q.close.toFixed(2)),
      volume: q.volume || 0,
      date: new Date(q.date).toISOString(),
    }));
}

function aggregateCandles(candles, intervalSeconds) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  if (intervalSeconds === 60) {
    return candles.map(({ time, open, high, low, close, volume }) => ({
      time,
      open,
      high,
      low,
      close,
      volume: volume || 0,
    }));
  }

  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const bucketMap = new Map();

  for (const candle of sorted) {
    const bucketTime = Math.floor(candle.time / intervalSeconds) * intervalSeconds;
    const existing = bucketMap.get(bucketTime);

    if (!existing) {
      bucketMap.set(bucketTime, {
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
      });
      continue;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume = (existing.volume || 0) + (candle.volume || 0);
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);
}

async function fetchIntradayHistoryCandles(symbol, { range, interval }) {
  const normalizedInterval = normalizeIntradayInterval(interval);
  const targetSeconds = getIntradayIntervalSeconds(normalizedInterval);

  // Use Yahoo-supported interval directly when possible, otherwise fetch 1m and aggregate.
  const directYahooInterval = getYahooDirectIntradayInterval(normalizedInterval);
  const sourceInterval = directYahooInterval || "1m";
  const period1 = getIntradayPeriodStart(range);
  const period2 = new Date();

  let result;
  try {
    result = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: sourceInterval,
    });
  } catch (err) {
    // Fallback for symbols/ranges where Yahoo rejects source interval.
    const fallbackInterval = "5m";
    result = await yahooFinance.chart(symbol, {
      period1: getPeriodStart(range, fallbackInterval),
      period2,
      interval: fallbackInterval,
    });
  }

  const baseCandles = (result.quotes || [])
    .filter((q) => q.open != null && q.close != null)
    .map((q) => ({
      time: Math.floor(new Date(q.date).getTime() / 1000),
      open: parseFloat(q.open.toFixed(2)),
      high: parseFloat(q.high.toFixed(2)),
      low: parseFloat(q.low.toFixed(2)),
      close: parseFloat(q.close.toFixed(2)),
      volume: q.volume || 0,
    }))
    .sort((a, b) => a.time - b.time);

  if (!baseCandles.length) return [];

  const sourceSeconds = getIntervalSecondsFromYahoo(sourceInterval);
  if (sourceSeconds === targetSeconds) return baseCandles;

  if (!Number.isFinite(targetSeconds) || targetSeconds <= sourceSeconds) {
    return baseCandles;
  }

  return aggregateCandles(baseCandles, targetSeconds);
}

function filterToCurrentOrLastTradingSession(candles, options = {}) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  const timeZone = options.timeZone || MARKET_TIME_ZONE;
  const openMinute = Number.isFinite(options.openMinute) ? options.openMinute : MARKET_OPEN_MINUTE;
  const closeMinute = Number.isFinite(options.closeMinute) ? options.closeMinute : MARKET_CLOSE_MINUTE;

  const enriched = candles
    .map((c) => {
      const tsMs = Number(c?.time) * 1000;
      if (!Number.isFinite(tsMs)) return null;
      const meta = getZonedMinuteMeta(tsMs, timeZone);
      if (!meta) return null;
      return {
        candle: c,
        dayKey: meta.dayKey,
        minuteOfDay: meta.minuteOfDay,
      };
    })
    .filter(Boolean);

  if (!enriched.length) return [];

  const byDay = new Map();
  for (const item of enriched) {
    if (!byDay.has(item.dayKey)) byDay.set(item.dayKey, []);
    byDay.get(item.dayKey).push(item);
  }

  const nowMeta = getZonedMinuteMeta(Date.now(), timeZone);
  if (!nowMeta) return enriched.map((i) => i.candle);

  const isWeekday = nowMeta.weekday !== "Sat" && nowMeta.weekday !== "Sun";
  const isMarketOpenNow = isWeekday && nowMeta.minuteOfDay >= openMinute && nowMeta.minuteOfDay <= closeMinute;
  const cutoff = isMarketOpenNow ? Math.min(nowMeta.minuteOfDay, closeMinute) : closeMinute;

  const selectSession = (items, maxMinute) =>
    (items || []).filter((i) => i.minuteOfDay >= openMinute && i.minuteOfDay <= maxMinute);

  let selected = selectSession(byDay.get(nowMeta.dayKey), cutoff);
  if (!selected.length) {
    const sortedDayKeys = Array.from(byDay.keys()).sort();
    const lastDay = sortedDayKeys[sortedDayKeys.length - 1];
    selected = selectSession(byDay.get(lastDay), closeMinute);
  }

  return selected
    .map((item) => item.candle)
    .sort((a, b) => Number(a.time) - Number(b.time));
}

function normalizeIntradayInterval(interval) {
  const key = String(interval || "").trim().toLowerCase();
  return getIntradayIntervalSeconds(key) ? key : "1m";
}

function getIntradayIntervalSeconds(interval) {
  return INTRADAY_CHART_INTERVAL_SECONDS[String(interval || "").trim().toLowerCase()] || null;
}

function getYahooDirectIntradayInterval(interval) {
  const key = String(interval || "").trim().toLowerCase();
  if (key === "1h") return "60m";
  if (key === "4h") return null; // aggregate from lower timeframe
  return YAHOO_DIRECT_INTRADAY_INTERVALS.has(key) ? key : null;
}

function getIntervalSecondsFromYahoo(interval) {
  const key = String(interval || "").trim().toLowerCase();
  if (key === "60m") return 3600;
  if (key === "90m") return 5400;
  return getIntradayIntervalSeconds(key) || 60;
}

function getZonedMinuteMeta(timestampMs, timeZone) {
  const date = new Date(timestampMs);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);

  const data = {};
  for (const part of parts) {
    if (["year", "month", "day", "hour", "minute", "weekday"].includes(part.type)) {
      data[part.type] = part.value;
    }
  }

  if (!data.year || !data.month || !data.day || data.hour == null || data.minute == null) return null;

  return {
    dayKey: `${data.year}-${data.month}-${data.day}`,
    minuteOfDay: Number(data.hour) * 60 + Number(data.minute),
    weekday: data.weekday,
  };
}

function buildPredictedDataForTimeframe({
  basePredictedCandles,
  lastHistoricalCandle,
  intervalSeconds,
  fallbackDirection,
  fallbackCurrentPrice,
}) {
  if (!lastHistoricalCandle || !intervalSeconds) return [];

  const base = Array.isArray(basePredictedCandles) ? basePredictedCandles : [];
  const steps = Math.max(base.length, DEFAULT_CHART_STEPS);
  const predicted = [];

  const fallbackDir = String(fallbackDirection || "").toUpperCase() === "DOWN" ? -1 : 1;
  const fallbackReturn = fallbackDir * 0.0015;
  const fallbackRange = Math.max(
    Number(lastHistoricalCandle.high) - Number(lastHistoricalCandle.low),
    0.01
  );
  const fallbackVolume = Math.max(Number(lastHistoricalCandle.volume) || 0, 0);
  const startTime = Number(lastHistoricalCandle.time) || Math.floor(Date.now() / 1000);
  let prevTime = startTime;

  let prevClose = Number(fallbackCurrentPrice);
  if (!Number.isFinite(prevClose) || prevClose <= 0) prevClose = Number(lastHistoricalCandle.close);
  if (!Number.isFinite(prevClose) || prevClose <= 0) prevClose = 1;

  const source = base.length
    ? base
    : Array.from({ length: steps }, (_, idx) => ({
      close: prevClose * (1 + fallbackReturn * (idx + 1)),
    }));

  for (let i = 0; i < source.length; i++) {
    const item = source[i] || {};

    const rawTime = Number(item.time);
    const time = Number.isFinite(rawTime) && rawTime > prevTime
      ? rawTime
      : startTime + ((i + 1) * intervalSeconds);

    let open = Number(item.open);
    if (!Number.isFinite(open) || open <= 0) {
      open = prevClose;
    } else {
      // Keep continuity with the last real/predicted close.
      open = (open + prevClose) * 0.5;
    }

    let close = Number(item.close);
    if (!Number.isFinite(close) || close <= 0) {
      close = open * (1 + fallbackReturn);
    }

    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const dynamicSpread = Math.max(Math.abs(close - open) * 0.6 + fallbackRange * 0.25, 0.01);

    let high = Number(item.high);
    if (!Number.isFinite(high) || high <= 0) high = bodyHigh + dynamicSpread * 0.5;

    let low = Number(item.low);
    if (!Number.isFinite(low) || low <= 0) low = bodyLow - dynamicSpread * 0.5;

    high = Math.max(high, bodyHigh);
    low = Math.min(low, bodyLow);
    low = Math.max(low, 0.01);

    if (high <= low) {
      const mid = (bodyHigh + bodyLow) * 0.5;
      high = mid + dynamicSpread * 0.5;
      low = Math.max(0.01, mid - dynamicSpread * 0.5);
    }

    const volume = Number.isFinite(Number(item.volume))
      ? Math.max(Number(item.volume), 0)
      : fallbackVolume;

    predicted.push({
      time: Math.floor(time),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: round2(volume),
    });

    prevClose = close;
    prevTime = time;
  }

  return predicted.slice(0, steps);
}

function normalizeTimeframe(value) {
  const tf = String(value || "").trim().toLowerCase();
  return TIMEFRAME_INTERVAL_SECONDS[tf] ? tf : null;
}

function normalizeConfidenceToPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1) return Math.max(0, Math.min(100, Math.round(n * 100)));
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Number(Number(value).toFixed(2));
}

async function resolveSymbol(input) {
  const upper = input.toUpperCase().trim();
  const cacheKey = `resolve:${upper}`;

  const cached = await safeCache.get(cacheKey);
  if (cached) return cached;

  // --- Fast path: if it already has a suffix (.NS, .BO), validate & return ---
  if (upper.includes(".")) {
    try {
      const q = await yahooFinance.quote(upper);
      if (q && q.symbol) {
        await safeCache.set(cacheKey, q.symbol, 3600);
        return q.symbol;
      }
    } catch (_) { }
    await safeCache.set(cacheKey, upper, 3600);
    return upper;
  }

  // --- Fast path: check local Indian stocks list first (no network needed) ---
  if (symbolMap.has(upper)) {
    const resolved = `${upper}.NS`;
    console.log(`[resolveSymbol] Local match: ${upper} → ${resolved}`);
    await safeCache.set(cacheKey, resolved, 3600);
    return resolved;
  }

  // --- Try Yahoo quote with bare symbol ---
  try {
    const q = await yahooFinance.quote(upper);
    if (q && q.symbol) {
      await safeCache.set(cacheKey, q.symbol, 3600);
      return q.symbol;
    }
  } catch (_) {
    console.warn(`[resolveSymbol] Yahoo quote(${upper}) failed, trying .NS`);
  }

  // --- Try with .NS suffix directly (common for Indian stocks) ---
  const nsSymbol = `${upper}.NS`;
  try {
    const q = await yahooFinance.quote(nsSymbol);
    if (q && q.symbol) {
      console.log(`[resolveSymbol] .NS fallback success: ${upper} → ${q.symbol}`);
      await safeCache.set(cacheKey, q.symbol, 3600);
      return q.symbol;
    }
  } catch (_) {
    console.warn(`[resolveSymbol] Yahoo quote(${nsSymbol}) also failed`);
  }

  // --- Try Yahoo search as last resort ---
  try {
    const results = await yahooFinance.search(upper);
    const equities = (results.quotes || []).filter(
      (q) => q.quoteType === "EQUITY"
    );

    if (equities.length > 0) {
      const indianMatch = equities.find(
        (q) =>
          (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO")) &&
          q.symbol.replace(/\.(NS|BO)$/, "").toUpperCase() === upper
      );
      if (indianMatch) {
        await safeCache.set(cacheKey, indianMatch.symbol, 3600);
        return indianMatch.symbol;
      }

      const exactMatch = equities.find(
        (q) => q.symbol.toUpperCase() === upper
      );
      if (exactMatch) {
        await safeCache.set(cacheKey, exactMatch.symbol, 3600);
        return exactMatch.symbol;
      }

      await safeCache.set(cacheKey, equities[0].symbol, 3600);
      return equities[0].symbol;
    }
  } catch (_) {
    console.warn(`[resolveSymbol] Yahoo search(${upper}) failed`);
  }

  // --- Ultimate fallback: assume Indian stock ---
  console.warn(`[resolveSymbol] All lookups failed for ${upper}, defaulting to ${nsSymbol}`);
  await safeCache.set(cacheKey, nsSymbol, 600);
  return nsSymbol;
}

function formatLargeNumber(num) {
  if (!num) return "-";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e7) return (num / 1e7).toFixed(2) + "Cr";
  if (num >= 1e5) return (num / 1e5).toFixed(2) + "L";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toString();
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * For intraday ranges, compute a period1 that always covers the most recent
 * trading session by rewinding to midnight IST of the target day.
 * After market close the "current-time minus 24h" trick misses yesterday's
 * session, so we always anchor to the start of the calendar day instead.
 */
function getIntradayPeriodStart(range) {
  // Compute "today midnight" in IST (UTC+5:30), then subtract days.
  const nowUtc = Date.now();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = nowUtc + IST_OFFSET_MS;
  // Midnight IST today as a UTC timestamp.
  const midnightIstMs = nowIst - (nowIst % (24 * 60 * 60 * 1000)) - IST_OFFSET_MS;

  const RANGE_DAYS = { "1d": 2, "5d": 6, "1mo": 32 };
  const days = RANGE_DAYS[range] || 2;
  return new Date(midnightIstMs - (days - 1) * 24 * 60 * 60 * 1000);
}

function getPeriodStart(range, interval) {
  const now = new Date();
  switch (range) {
    case "1d":
      now.setDate(now.getDate() - 1);
      break;
    case "5d":
      now.setDate(now.getDate() - 5);
      break;
    case "1mo":
      now.setMonth(now.getMonth() - 1);
      break;
    case "3mo":
      now.setMonth(now.getMonth() - 3);
      break;
    case "6mo":
      now.setMonth(now.getMonth() - 6);
      break;
    case "1y":
      now.setFullYear(now.getFullYear() - 1);
      break;
    case "5y":
      now.setFullYear(now.getFullYear() - 5);
      break;
    default:
      now.setMonth(now.getMonth() - 1);
  }
  return now;
}

module.exports = {
  getStock,
  getStockHistory,
  searchStocks,
  getStockPrediction,
  getChartPrediction,
  getChartPredictionByTimeframe,
};
