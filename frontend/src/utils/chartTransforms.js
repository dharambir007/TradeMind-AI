export const TIMEFRAME_PRESETS = Object.freeze({
  "1m": {
    key: "1m",
    label: "1m",
    apiInterval: "1m",
    range: "1d",
    bucketSeconds: 60,
    predictionTimeframe: "3m",
    intraday: true,
  },
  "3m": {
    key: "3m",
    label: "3m",
    apiInterval: "1m",
    range: "1d",
    bucketSeconds: 180,
    predictionTimeframe: "3m",
    intraday: true,
  },
  "5m": {
    key: "5m",
    label: "5m",
    apiInterval: "5m",
    range: "5d",
    bucketSeconds: 300,
    predictionTimeframe: "5m",
    intraday: true,
  },
  "15m": {
    key: "15m",
    label: "15m",
    apiInterval: "15m",
    // Yahoo Finance only serves 15m intraday data for up to 5 trading days
    range: "5d",
    bucketSeconds: 900,
    predictionTimeframe: "10m",
    intraday: true,
  },
  "1h": {
    key: "1h",
    label: "1h",
    apiInterval: "1h",
    // Yahoo Finance supports 1h granularity for up to 1 month
    range: "1mo",
    bucketSeconds: 3600,
    predictionTimeframe: "10m",
    intraday: true,
  },
  "1d": {
    key: "1d",
    label: "1d",
    apiInterval: "1d",
    range: "1y",
    bucketSeconds: 86400,
    predictionTimeframe: "10m",
    intraday: false,
  },
});

export const DEFAULT_TRADING_TIMEFRAME = "5m";

const MIN_VALID_UNIX_SECONDS = 946684800; // 2000-01-01
const MAX_FUTURE_DRIFT_SECONDS = 24 * 60 * 60;

export function getTimeframePreset(timeframe) {
  return TIMEFRAME_PRESETS[timeframe] || TIMEFRAME_PRESETS[DEFAULT_TRADING_TIMEFRAME];
}

function roundToTwo(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeUnixSeconds(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const normalized = Math.floor(seconds);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (normalized < MIN_VALID_UNIX_SECONDS) return null;
  if (normalized > nowSeconds + MAX_FUTURE_DRIFT_SECONDS) return null;
  return normalized;
}

function toUnixTime(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const seconds = value > 1e12 ? value / 1000 : value;
    return normalizeUnixSeconds(seconds);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return toUnixTime(Number(trimmed));
    }

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? normalizeUnixSeconds(parsed / 1000) : null;
  }

  if (value instanceof Date) {
    return normalizeUnixSeconds(value.getTime() / 1000);
  }

  return null;
}

function normalizeCandle(candidate, fallbackTimestamp, previousClose) {
  if (!candidate) return null;

  const time = toUnixTime(candidate.time ?? candidate.timestamp ?? fallbackTimestamp);
  if (!Number.isFinite(time)) return null;

  const close = Number(candidate.close ?? candidate.price);
  const open = Number(candidate.open ?? previousClose ?? close);
  const high = Number(candidate.high ?? Math.max(open, close));
  const low = Number(candidate.low ?? Math.min(open, close));
  const volume = Number(candidate.volume ?? candidate.vol ?? 0);

  if (![open, high, low, close].every(Number.isFinite)) {
    return null;
  }

  return {
    time,
    open: roundToTwo(open),
    high: roundToTwo(Math.max(high, open, close)),
    low: roundToTwo(Math.min(low, open, close)),
    close: roundToTwo(close),
    volume: Number.isFinite(volume) ? Math.max(0, volume) : 0,
  };
}

function buildCandlesFromPriceArrays(timestamps = [], prices = []) {
  const candles = [];
  let previousClose = null;

  for (let index = 0; index < Math.min(timestamps.length, prices.length); index += 1) {
    const close = Number(prices[index]);
    const time = toUnixTime(timestamps[index]);

    if (!Number.isFinite(close) || !Number.isFinite(time)) {
      continue;
    }

    const open = previousClose ?? close;
    candles.push({
      time,
      open: roundToTwo(open),
      high: roundToTwo(Math.max(open, close)),
      low: roundToTwo(Math.min(open, close)),
      close: roundToTwo(close),
      volume: 0,
    });
    previousClose = close;
  }

  return candles;
}

function getBucketTime(time, bucketSeconds) {
  if (!Number.isFinite(time) || !Number.isFinite(bucketSeconds) || bucketSeconds <= 0) {
    return null;
  }
  return Math.floor(time / bucketSeconds) * bucketSeconds;
}

export function aggregateCandles(candles, bucketSeconds) {
  if (!Array.isArray(candles) || !candles.length || !Number.isFinite(bucketSeconds)) {
    return [];
  }

  const buckets = new Map();

  for (const candle of candles) {
    const time = getBucketTime(toUnixTime(candle.time), bucketSeconds);
    if (!Number.isFinite(time)) continue;

    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    const volume = Number(candle.volume || 0);

    if (![open, high, low, close].every(Number.isFinite)) {
      continue;
    }

    const existing = buckets.get(time);
    if (!existing) {
      buckets.set(time, {
        time,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      });
      continue;
    }

    existing.high = Math.max(existing.high, high);
    existing.low = Math.min(existing.low, low);
    existing.close = close;
    existing.volume += Number.isFinite(volume) ? volume : 0;
  }

  return Array.from(buckets.values())
    .sort((left, right) => left.time - right.time)
    .map((item) => ({
      time: item.time,
      open: roundToTwo(item.open),
      high: roundToTwo(item.high),
      low: roundToTwo(item.low),
      close: roundToTwo(item.close),
      volume: Math.max(0, Math.round(item.volume)),
    }));
}

export function transformMarketDataToCandles(payload, timeframe = DEFAULT_TRADING_TIMEFRAME) {
  const preset = getTimeframePreset(timeframe);

  let sourceCandles = [];
  if (Array.isArray(payload)) {
    sourceCandles = payload;
  } else if (Array.isArray(payload?.candles)) {
    sourceCandles = payload.candles;
  } else if (Array.isArray(payload?.history)) {
    sourceCandles = payload.history;
  } else if (Array.isArray(payload?.ohlc)) {
    sourceCandles = payload.ohlc;
  }

  let candles = [];

  if (sourceCandles.length) {
    if (import.meta.env.DEV) {
      console.debug("[chartTransforms] raw market timestamps", {
        timeframe,
        sample: sourceCandles.slice(0, 5).map((item) => item?.time ?? item?.timestamp ?? null),
        count: sourceCandles.length,
      });
    }

    let previousClose = null;
    candles = sourceCandles
      .map((item) => {
        const normalized = normalizeCandle(item, null, previousClose);
        if (normalized) previousClose = normalized.close;
        return normalized;
      })
      .filter(Boolean)
      .sort((left, right) => left.time - right.time);
  }

  if (!candles.length && Array.isArray(payload?.timestamps) && Array.isArray(payload?.prices)) {
    candles = buildCandlesFromPriceArrays(payload.timestamps, payload.prices);
  }

  if (!candles.length) {
    return [];
  }

  if (import.meta.env.DEV) {
    console.debug("[chartTransforms] normalized market candles", {
      timeframe,
      count: candles.length,
      first: candles[0]?.time ?? null,
      last: candles[candles.length - 1]?.time ?? null,
    });
  }

  if (preset.bucketSeconds && preset.apiInterval !== preset.key) {
    return aggregateCandles(candles, preset.bucketSeconds);
  }

  return candles;
}

export function transformPredictionToCandles(
  payload,
  timeframe = DEFAULT_TRADING_TIMEFRAME
) {
  return transformMarketDataToCandles(
    payload?.predictedData ?? payload?.predictionCandles ?? [],
    timeframe
  );
}

export function buildVolumePoint(candle) {
  return {
    time: candle.time,
    value: Math.max(0, Number(candle.volume || 0)),
    color: candle.close >= candle.open ? "rgba(38,166,154,0.38)" : "rgba(239,83,80,0.38)",
  };
}

export function getLiveCandleTime(unixTime, timeframe) {
  const preset = getTimeframePreset(timeframe);
  if (preset.key === "1d") {
    const date = new Date(Number(unixTime) * 1000);
    if (!Number.isFinite(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }
  return getBucketTime(unixTime, preset.bucketSeconds);
}

// IST locale + timezone constants — reused across both formatters
const IST_LOCALE = "en-IN";
const IST_TZ = "Asia/Kolkata";

export function formatAxisTime(unixTime, timeframe) {
  const date = new Date(Number(unixTime) * 1000);
  if (!Number.isFinite(date.getTime())) return "";

  const preset = getTimeframePreset(timeframe);
  if (preset.intraday) {
    // Always display in IST (Asia/Kolkata) regardless of browser locale
    return date.toLocaleTimeString(IST_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: IST_TZ,
    });
  }

  return date.toLocaleDateString(IST_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST_TZ,
  });
}

export function formatVolume(value) {
  const numeric = Number(value || 0);
  if (numeric >= 1e7) return `${(numeric / 1e7).toFixed(2)}Cr`;
  if (numeric >= 1e5) return `${(numeric / 1e5).toFixed(2)}L`;
  if (numeric >= 1e3) return `${(numeric / 1e3).toFixed(2)}K`;
  return numeric.toFixed(0);
}
