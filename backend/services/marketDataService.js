const YahooFinance = require("yahoo-finance2").default;
const { searchIndianStocks, symbolMap } = require("../data/indianStocks");
const { normalizeSymbol, stripExchangeSuffix } = require("../utils/symbolNormalizer");
const { createHttpClient, withRetry } = require("../utils/httpClient");
const AppError = require("../utils/appError");
const CacheService = require("./cacheService");
const logger = require("../utils/logger");

const yahooSearch = new YahooFinance();
const yahooClient = createHttpClient({
  baseURL: "https://query2.finance.yahoo.com/v8/finance/chart",
  timeout: Number(process.env.YAHOO_TIMEOUT_MS) || 10000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
  },
});

const INTRADAY_INTERVALS = new Set(["1m", "2m", "5m", "10m", "15m", "30m", "1h", "4h"]);
const MARKET_TIME_ZONE = "Asia/Kolkata";
const MARKET_OPEN_MINUTE = 9 * 60 + 15;
const MARKET_CLOSE_MINUTE = 15 * 60 + 30;
const inFlightChartRequests = new Map();

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function formatLargeNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e7) return `${(num / 1e7).toFixed(2)}Cr`;
  if (num >= 1e5) return `${(num / 1e5).toFixed(2)}L`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return String(num);
}

function validateChartPayload(payload) {
  // Render IP block returning an HTML page instead of JSON
  if (typeof payload === 'string' && payload.toLowerCase().includes('html')) {
     throw new AppError("Yahoo Finance IP Blocked (Render)", 503);
  }

  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];

  if (!result || !Array.isArray(timestamps) || !quote) {
    throw new AppError("Market data unavailable", 503);
  }

  return result;
}

function isRateLimitError(error) {
  const status = Number(error?.response?.status);
  return status === 429;
}


function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function getRangeWindow(range) {
  const now = new Date();
  const period2 = toUnixSeconds(now);
  const start = new Date(now);

  switch (String(range || "").toLowerCase()) {
    case "1d":
      start.setDate(start.getDate() - 1);
      break;
    case "5d":
      start.setDate(start.getDate() - 5);
      break;
    case "1mo":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3mo":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6mo":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "5y":
      start.setFullYear(start.getFullYear() - 5);
      break;
    default:
      start.setDate(start.getDate() - 1);
      break;
  }

  return {
    period1: toUnixSeconds(start),
    period2,
  };
}

function getChartCacheTtlSeconds(interval) {
  return INTRADAY_INTERVALS.has(String(interval || "").toLowerCase()) ? 20 : 120;
}

function getChartStaleTtlSeconds(interval) {
  return INTRADAY_INTERVALS.has(String(interval || "").toLowerCase()) ? 180 : 900;
}

function sanitizeRawCandle(candidate) {
  const time = Number(candidate?.time);
  const open = Number(candidate?.open);
  const high = Number(candidate?.high);
  const low = Number(candidate?.low);
  const close = Number(candidate?.close);
  const volume = Number(candidate?.volume) || 0;

  if (![time, open, high, low, close].every(Number.isFinite)) {
    return null;
  }

  if (time <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0) {
    return null;
  }

  return {
    time: Math.floor(time),
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    volume: Number.isFinite(volume) ? Math.max(0, volume) : 0,
  };
}

function buildCandlesFromResult(result) {
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const open = Array.isArray(quote.open) ? quote.open : [];
  const high = Array.isArray(quote.high) ? quote.high : [];
  const low = Array.isArray(quote.low) ? quote.low : [];
  const close = Array.isArray(quote.close) ? quote.close : [];
  const volume = Array.isArray(quote.volume) ? quote.volume : [];

  const candles = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const item = sanitizeRawCandle({
      time: Number(timestamps[index]),
      open: Number(open[index]),
      high: Number(high[index]),
      low: Number(low[index]),
      close: Number(close[index]),
      volume: Number(volume[index]) || 0,
    });

    if (!item) {
      continue;
    }

    candles.push(item);
  }

  return candles.sort((a, b) => a.time - b.time);
}

function getZonedMinuteMeta(timestampMs, timeZone = MARKET_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date(timestampMs));

  const map = {};
  for (const part of parts) {
    if (["year", "month", "day", "hour", "minute", "weekday"].includes(part.type)) {
      map[part.type] = part.value;
    }
  }

  if (!map.year || !map.month || !map.day || map.hour == null || map.minute == null) {
    return null;
  }

  return {
    dayKey: `${map.year}-${map.month}-${map.day}`,
    minuteOfDay: Number(map.hour) * 60 + Number(map.minute),
    weekday: map.weekday,
  };
}

function filterToCurrentOrLastTradingSession(candles) {
  if (!candles.length) return [];

  const enriched = candles
    .map((candle) => {
      const meta = getZonedMinuteMeta(Number(candle.time) * 1000);
      if (!meta) return null;
      return { candle, ...meta };
    })
    .filter(Boolean);

  if (!enriched.length) return [];

  const byDay = new Map();
  for (const item of enriched) {
    if (!byDay.has(item.dayKey)) byDay.set(item.dayKey, []);
    byDay.get(item.dayKey).push(item);
  }

  const nowMeta = getZonedMinuteMeta(Date.now());
  if (!nowMeta) return candles;

  const isWeekday = nowMeta.weekday !== "Sat" && nowMeta.weekday !== "Sun";
  const isMarketOpen = isWeekday && nowMeta.minuteOfDay >= MARKET_OPEN_MINUTE && nowMeta.minuteOfDay <= MARKET_CLOSE_MINUTE;
  const cutoff = isMarketOpen ? Math.min(nowMeta.minuteOfDay, MARKET_CLOSE_MINUTE) : MARKET_CLOSE_MINUTE;

  const selectSession = (items, maxMinute) =>
    (items || []).filter((item) => item.minuteOfDay >= MARKET_OPEN_MINUTE && item.minuteOfDay <= maxMinute);

  let selected = selectSession(byDay.get(nowMeta.dayKey), cutoff);
  if (!selected.length) {
    const lastDay = Array.from(byDay.keys()).sort().pop();
    selected = selectSession(byDay.get(lastDay), MARKET_CLOSE_MINUTE);
  }

  return selected.map((item) => item.candle).sort((a, b) => a.time - b.time);
}

function buildChartResponse(symbol, result, candles) {
  const filteredCandles = INTRADAY_INTERVALS.has(String(result?.meta?.dataGranularity || "").toLowerCase())
    ? filterToCurrentOrLastTradingSession(candles)
    : candles;
  const finalCandles = filteredCandles.length ? filteredCandles : candles;

  return {
    symbol,
    meta: result.meta || {},
    timestamps: finalCandles.map((item) => item.time),
    prices: finalCandles.map((item) => round2(item.close)),
    candles: finalCandles.map((item) => ({
      time: item.time,
      open: round2(item.open),
      high: round2(item.high),
      low: round2(item.low),
      close: round2(item.close),
      volume: Number(item.volume) || 0,
    })),
  };
}

async function fetchChartViaDirectUrl(symbol, { range, interval }) {
  const response = await withRetry(
    () =>
      yahooClient.get(`/${encodeURIComponent(symbol)}`, {
        params: {
          range,
          interval,
          includePrePost: false,
          events: "div,splits",
        },
      }),
    {
      retries: 4,
      delayMs: 500,
      shouldRetry(error, attempt) {
        if (isRateLimitError(error)) {
          const retryAfterSeconds = Number(error?.response?.headers?.["retry-after"] || 0);
          // Respect upstream backoff hints when Yahoo rate-limits requests.
          return retryAfterSeconds >= 0 && attempt < 4;
        }
        return true;
      },
    }
  );

  return validateChartPayload(response.data);
}

async function fetchChartViaYahooFinance(symbol, { range, interval }) {
  const { period1, period2 } = getRangeWindow(range);
  const modernOptions = {
    period1,
    period2,
    interval,
    includePrePost: false,
    events: "div|split|earn",
    return: "object",
  };
  return yahooSearch.chart(symbol, modernOptions, { validateResult: false });
}

function withInFlightChartRequest(cacheKey, loader) {
  if (inFlightChartRequests.has(cacheKey)) {
    return inFlightChartRequests.get(cacheKey);
  }

  const promise = Promise.resolve()
    .then(loader)
    .finally(() => {
      inFlightChartRequests.delete(cacheKey);
    });

  inFlightChartRequests.set(cacheKey, promise);
  return promise;
}

class MarketDataService {
  static async fetchChart(symbolInput, { range = "1d", interval = "5m" } = {}) {
    const symbol = normalizeSymbol(symbolInput);
    const cacheKey = `market:chart:${symbol}:${range}:${interval}`;
    const staleCacheKey = `${cacheKey}:stale`;
    const chartTtl = getChartCacheTtlSeconds(interval);
    const staleTtl = getChartStaleTtlSeconds(interval);

    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    return withInFlightChartRequest(cacheKey, async () => {
      const secondReadCache = await CacheService.get(cacheKey);
      if (secondReadCache) {
        return secondReadCache;
      }

      let result;
      let source = "direct";

      try {
        result = await fetchChartViaDirectUrl(symbol, { range, interval });
      } catch (error) {
        logger.warn(
          `Direct Yahoo chart fetch failed for ${symbol} range=${range} interval=${interval}: ${
            error?.message || error
          }`
        );
        try {
          result = await fetchChartViaYahooFinance(symbol, { range, interval });
          source = "yahoo-finance2";
        } catch (fallbackError) {
          logger.error(
            `Yahoo chart fallback failed for ${symbol} range=${range} interval=${interval}: ${
              fallbackError?.message || fallbackError
            }`
          );
          const stale = await CacheService.get(staleCacheKey);
          if (stale) {
            logger.warn(`Using stale chart cache for ${symbol} after upstream failure`);
            return {
              ...stale,
              stale: true,
            };
          }

          throw new AppError("Market data unavailable", 503);
        }
      }

      const candles = buildCandlesFromResult(result);
      if (!candles.length) {
        logger.warn(`Yahoo chart returned no candles for ${symbol} via ${source}`);
        const stale = await CacheService.get(staleCacheKey);
        if (stale) {
          logger.warn(`Using stale chart cache for ${symbol} because fresh candles are empty`);
          return {
            ...stale,
            stale: true,
          };
        }

        throw new AppError("Market data unavailable", 503);
      }

      const payload = buildChartResponse(symbol, result, candles);
      await Promise.all([
        CacheService.set(cacheKey, payload, chartTtl),
        CacheService.set(staleCacheKey, payload, staleTtl),
      ]);
      return payload;
    });
  }

  static async getStock(symbolInput) {
    const symbol = normalizeSymbol(symbolInput);

    try {
      const chart = await this.fetchChart(symbol, { range: "1d", interval: "5m" });
      const candles = chart.candles;
      const last = candles[candles.length - 1];
      const previousClose = Number(chart.meta.chartPreviousClose || chart.meta.previousClose || candles[candles.length - 2]?.close || last.open || last.close);
      const change = round2(last.close - previousClose);
      const changePercent = previousClose ? round2((change / previousClose) * 100) : 0;
      const baseSymbol = stripExchangeSuffix(symbol);
      const stockInfo = symbolMap.get(baseSymbol);

      return {
        success: true,
        symbol,
        name: stockInfo?.name || chart.meta.longName || chart.meta.shortName || symbol,
        price: round2(chart.meta.regularMarketPrice || last.close),
        change,
        changePercent,
        marketCap: "-",
        volume: formatLargeNumber(chart.meta.regularMarketVolume || last.volume),
        high: round2(chart.meta.regularMarketDayHigh || last.high),
        low: round2(chart.meta.regularMarketDayLow || last.low),
        prevClose: round2(previousClose),
        open: round2(chart.meta.regularMarketOpen || last.open),
        fiftyTwoWeekHigh: chart.meta.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: chart.meta.fiftyTwoWeekLow || null,
        currency: chart.meta.currency || "INR",
        exchange: chart.meta.exchangeName || "NSE",
        history: candles.slice(-78),
        ohlc: candles.slice(-78),
        timestamps: chart.timestamps,
        prices: chart.prices,
        chart: {
          symbol,
          timestamps: chart.timestamps,
          prices: chart.prices,
        },
      };
    } catch (error) {
      logger.warn(`getStock failed for ${symbol}: ${error?.message || error}`);
      return {
        success: false,
        symbol,
        message: "Market data unavailable",
        history: [],
        ohlc: [],
        timestamps: [],
        prices: [],
        chart: {
          symbol,
          timestamps: [],
          prices: [],
        },
      };
    }
  }

  static async getHistory(symbolInput, options = {}) {
    const chart = await this.fetchChart(symbolInput, options);
    return chart.candles;
  }

  static async getPredictionCandles(symbolInput) {
    const symbol = normalizeSymbol(symbolInput);
    const attempts = [
      { range: "5d", interval: "1m" },
      { range: "5d", interval: "2m" },
      { range: "5d", interval: "5m" },
    ];

    for (const attempt of attempts) {
      try {
        const chart = await this.fetchChart(symbol, attempt);
        if (chart.candles.length) {
          return chart.candles.map((candle) => ({
            ...candle,
            date: new Date(candle.time * 1000).toISOString(),
          }));
        }
      } catch (_) {
        // Continue through fallbacks.
      }
    }

    return [];
  }

  static async searchStocks(queryInput) {
    const query = String(queryInput || "").trim();
    if (!query) return [];

    const cacheKey = `market:search:${query.toLowerCase()}`;
    return CacheService.remember(cacheKey, 300, async () => {
      const localResults = searchIndianStocks(query, 8).map((item) => ({
        symbol: item.symbol,
        name: item.name,
        exchange: "NSE",
        sector: item.sector,
      }));

      if (localResults.length >= 5) {
        return localResults;
      }

      try {
        const searchResults = await yahooSearch.search(query);
        const seen = new Set(localResults.map((item) => item.symbol));
        const merged = [...localResults];

        for (const quote of searchResults.quotes || []) {
          if (quote.quoteType !== "EQUITY") continue;
          const symbol = stripExchangeSuffix(quote.symbol);
          if (seen.has(symbol)) continue;

          merged.push({
            symbol,
            name: quote.shortname || quote.longname || quote.symbol,
            exchange: quote.exchDisp || quote.exchange || "NSE",
          });
          seen.add(symbol);

          if (merged.length >= 8) break;
        }

        return merged;
      } catch (_) {
        return localResults;
      }
    });
  }
}

module.exports = MarketDataService;
