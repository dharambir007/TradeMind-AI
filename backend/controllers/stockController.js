const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();
const { cache } = require("../config/redis");
const { searchIndianStocks } = require("../data/indianStocks");

// Safe cache wrapper — never let Redis failures break endpoints
const safeCache = {
  async get(key) {
    try { return await cache.get(key); } catch { return null; }
  },
  async set(key, value, ttl) {
    try { await cache.set(key, value, ttl); } catch { /* ignore */ }
  },
};

// GET /api/stocks/:symbol — quote + summary
const getStock = async (req, res) => {
  try {
    const symbol = await resolveSymbol(req.params.symbol);
    const cacheKey = `stock:${symbol}`;

    // Check cache first
    const cached = await safeCache.get(cacheKey);
    if (cached) return res.json(cached);

    const quote = await yahooFinance.quote(symbol);

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

    await safeCache.set(cacheKey, data, 60); // cache 60s
    res.json(data);
  } catch (err) {
    console.error("getStock error:", err.message);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
};

// GET /api/stocks/:symbol/history — OHLC candles
const getStockHistory = async (req, res) => {
  try {
    const symbol = await resolveSymbol(req.params.symbol);
    let range = req.query.range || "1mo"; // 1d, 5d, 1mo, 3mo, 6mo, 1y
    const interval = req.query.interval || "1d"; // 1m, 2m, 5m, 15m, 30m, 1d, 1wk
    const isIntraday = /\d+m$/.test(interval) || /\d+h$/.test(interval);

    // Yahoo limits: 1m max 7 days; 2m/5m/15m/30m max 60 days
    if (isIntraday) {
      if (interval === "1m" && range !== "1d") range = "5d"; // 1m: keep 1d or 5d (max 7d)
      if (interval === "1m" && range === "5d") range = "5d";
      if (["2m", "5m"].includes(interval) && !["1d", "5d"].includes(range)) range = "5d";
    }

    const cacheKey = `history:${symbol}:${range}:${interval}`;
    const cached = await safeCache.get(cacheKey);
    if (cached) return res.json(cached);

    const period1 = getPeriodStart(range, interval);
    const period2 = new Date();

    let result;
    try {
      result = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval,
      });
    } catch (chartErr) {
      // For intraday, fallback to 1d data so chart still renders
      if (isIntraday) {
        const fallbackRange = interval === "1m" ? "5d" : "5d";
        result = await yahooFinance.chart(symbol, {
          period1: getPeriodStart(fallbackRange, "1d"),
          period2: new Date(),
          interval: "1d",
        });
        const candles = (result.quotes || [])
          .filter((q) => q.open != null && q.close != null)
          .map((q) => ({
            time: formatDate(q.date),
            open: parseFloat(q.open.toFixed(2)),
            high: parseFloat(q.high.toFixed(2)),
            low: parseFloat(q.low.toFixed(2)),
            close: parseFloat(q.close.toFixed(2)),
            volume: q.volume || 0,
          }));
        return res.json(candles);
      }
      throw chartErr;
    }

    const quotes = result.quotes || [];
    const candles = quotes
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        time: isIntraday
          ? Math.floor(new Date(q.date).getTime() / 1000)
          : formatDate(q.date),
        open: parseFloat(q.open.toFixed(2)),
        high: parseFloat(q.high.toFixed(2)),
        low: parseFloat(q.low.toFixed(2)),
        close: parseFloat(q.close.toFixed(2)),
        volume: q.volume || 0,
      }));

    // If intraday returned empty, fallback to daily for same period
    if (isIntraday && candles.length === 0) {
      const fallback = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval: "1d",
      });
      const dailyCandles = (fallback.quotes || [])
        .filter((q) => q.open != null && q.close != null)
        .map((q) => ({
          time: formatDate(q.date),
          open: parseFloat(q.open.toFixed(2)),
          high: parseFloat(q.high.toFixed(2)),
          low: parseFloat(q.low.toFixed(2)),
          close: parseFloat(q.close.toFixed(2)),
          volume: q.volume || 0,
        }));
      await safeCache.set(cacheKey, dailyCandles, 60);
      return res.json(dailyCandles);
    }

    const ttl = interval.includes("m") ? 30 : 300;
    await safeCache.set(cacheKey, candles, ttl);
    res.json(candles);
  } catch (err) {
    console.error("getStockHistory error:", err.message);
    res.status(500).json({ error: "Failed to fetch stock history" });
  }
};

// GET /api/stocks/search?q=tata
const searchStocks = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });

    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = await safeCache.get(cacheKey);
    if (cached) return res.json(cached);

    // Fast local search first (Indian stocks)
    const localResults = searchIndianStocks(query, 8).map((s) => ({
      symbol: s.symbol,
      name: s.name,
      exchange: "NSE",
      sector: s.sector,
    }));

    // If we have enough local results, return immediately
    if (localResults.length >= 3) {
      await safeCache.set(cacheKey, localResults, 300);
      return res.json(localResults);
    }

    // Otherwise, supplement with Yahoo search
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

      // Merge: local results first, then Yahoo results (deduped)
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
      // Yahoo failed, return local results only
      await safeCache.set(cacheKey, localResults, 60);
      return res.json(localResults);
    }
  } catch (err) {
    console.error("searchStocks error:", err.message);
    res.status(500).json({ error: "Failed to search stocks" });
  }
};

// ── Helpers ──

/**
 * Resolve a user-entered symbol (e.g. "TCS") to a valid Yahoo Finance symbol
 * (e.g. "TCS.NS"). Tries direct quote first; on failure, uses search API.
 * Results are cached for 1 hour.
 */
async function resolveSymbol(input) {
  const upper = input.toUpperCase();
  const cacheKey = `resolve:${upper}`;

  const cached = await safeCache.get(cacheKey);
  if (cached) return cached;

  // If user already supplied an exchange suffix (.NS, .BO, etc.), use as-is
  if (upper.includes(".")) {
    try {
      const q = await yahooFinance.quote(upper);
      if (q && q.symbol) {
        await safeCache.set(cacheKey, q.symbol, 3600);
        return q.symbol;
      }
    } catch (_) {}
    return upper;
  }

  // Try direct quote first
  try {
    const q = await yahooFinance.quote(upper);
    if (q && q.symbol) {
      await safeCache.set(cacheKey, q.symbol, 3600);
      return q.symbol;
    }
  } catch (_) {
    // direct lookup failed — fall through to search
  }

  // Search and pick the best match.
  // Prefer Indian exchanges (.NS, .BO) for common Indian stock names,
  // then exact symbol matches, then first equity result.
  try {
    const results = await yahooFinance.search(upper);
    const equities = (results.quotes || []).filter(
      (q) => q.quoteType === "EQUITY"
    );

    if (equities.length > 0) {
      // 1. Prefer NSE/BSE match whose base symbol matches the input
      const indianMatch = equities.find(
        (q) =>
          (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO")) &&
          q.symbol.replace(/\.(NS|BO)$/, "").toUpperCase() === upper
      );
      if (indianMatch) {
        await safeCache.set(cacheKey, indianMatch.symbol, 3600);
        return indianMatch.symbol;
      }

      // 2. Exact symbol match on any exchange
      const exactMatch = equities.find(
        (q) => q.symbol.toUpperCase() === upper
      );
      if (exactMatch) {
        await safeCache.set(cacheKey, exactMatch.symbol, 3600);
        return exactMatch.symbol;
      }

      // 3. First equity result
      await safeCache.set(cacheKey, equities[0].symbol, 3600);
      return equities[0].symbol;
    }
  } catch (_) {
    // search also failed
  }

  // Last resort: return as-is
  return upper;
}

function formatLargeNumber(num) {
  if (!num) return "-";
  // Indian numbering: Cr (crore) and L (lakh)
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

module.exports = { getStock, getStockHistory, searchStocks };
