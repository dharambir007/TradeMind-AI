export function getCandleBucket(timestamp, intervalMinutes) {
  return Math.floor(timestamp / (intervalMinutes * 60 * 1000)) * (intervalMinutes * 60 * 1000);
}

const MAX_FUTURE_TICK_DRIFT_MS = 10 * 60 * 1000;

function sanitizeTimestampMs(timestampMs) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return Date.now();
  }

  const normalized = Math.floor(timestampMs);
  const nowMs = Date.now();
  if (normalized > nowMs + MAX_FUTURE_TICK_DRIFT_MS) {
    return nowMs;
  }

  return normalized;
}

export function normalizeTickTimestampMs(rawTimestamp) {
  if (typeof rawTimestamp === "number") {
    if (!Number.isFinite(rawTimestamp) || rawTimestamp <= 0) {
      return Date.now();
    }
    const timestampMs = rawTimestamp > 1e12 ? rawTimestamp : rawTimestamp * 1000;
    return sanitizeTimestampMs(timestampMs);
  }

  if (typeof rawTimestamp === "string") {
    const trimmed = rawTimestamp.trim();
    if (!trimmed) {
      return Date.now();
    }

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return normalizeTickTimestampMs(Number(trimmed));
    }

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  if (rawTimestamp instanceof Date) {
    const timestampMs = rawTimestamp.getTime();
    return Number.isFinite(timestampMs) ? sanitizeTimestampMs(timestampMs) : Date.now();
  }

  return Date.now();
}

export function getTimeframeIntervalMinutes(timeframe) {
  const normalized = typeof timeframe === "string" ? timeframe.trim().toLowerCase() : "";
  const match = normalized.match(/^(\d+)(m|h)$/);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return match[2] === "h" ? amount * 60 : amount;
}

function normalizeLiveCandle(candidate) {
  if (!candidate) return null;

  const rawTime = Number(candidate.time);
  const open = Number(candidate.open);
  const high = Number(candidate.high);
  const low = Number(candidate.low);
  const close = Number(candidate.close);
  const volume = Number(candidate.volume || 0);

  if (![rawTime, open, high, low, close].every(Number.isFinite)) {
    return null;
  }

  const time = rawTime > 1e12 ? Math.floor(rawTime / 1000) : Math.floor(rawTime);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (time <= 0 || time > nowSeconds + 24 * 60 * 60) {
    return null;
  }

  return {
    time,
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    volume: Number.isFinite(volume) ? Math.max(0, volume) : 0,
  };
}

export function sortAndDeduplicateCandles(candles = []) {
  if (!Array.isArray(candles) || !candles.length) {
    return [];
  }

  const sorted = candles
    .map(normalizeLiveCandle)
    .filter(Boolean)
    .sort((left, right) => left.time - right.time);

  const deduplicated = [];
  for (const candle of sorted) {
    const previous = deduplicated[deduplicated.length - 1];
    if (!previous || previous.time !== candle.time) {
      deduplicated.push(candle);
      continue;
    }

    previous.high = Math.max(previous.high, candle.high);
    previous.low = Math.min(previous.low, candle.low);
    previous.close = candle.close;
    previous.volume = Math.max(previous.volume || 0, candle.volume || 0);
  }

  return deduplicated;
}

export function mergeTickIntoCandles({
  candles = [],
  price,
  timestampMs,
  intervalMinutes,
  intervalLabel,
  volume,
  enableLogs = false,
}) {
  const nextPrice = Number(price);
  const nextTimestampMs = normalizeTickTimestampMs(timestampMs);

  if (!Number.isFinite(nextPrice) || nextPrice <= 0 || !Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return {
      candles: sortAndDeduplicateCandles(candles),
      latestCandle: null,
      changed: false,
      ignored: true,
      isNewCandle: false,
      bucket: null,
    };
  }

  const normalizedCandles = sortAndDeduplicateCandles(candles);
  const bucket = getCandleBucket(nextTimestampMs, intervalMinutes);
  const candleTime = Math.floor(bucket / 1000);

  if (enableLogs && import.meta.env.DEV) {
    console.log("TIMEFRAME:", intervalLabel);
    console.log("BUCKET:", new Date(bucket));
    console.log("PRICE:", nextPrice);
  }

  const lastCandle = normalizedCandles[normalizedCandles.length - 1] ?? null;
  if (lastCandle && bucket < lastCandle.time * 1000) {
    return {
      candles: normalizedCandles,
      latestCandle: lastCandle,
      changed: false,
      ignored: true,
      isNewCandle: false,
      bucket,
    };
  }

  const nextVolume = Number.isFinite(Number(volume)) ? Math.max(0, Number(volume)) : 0;

  if (!lastCandle) {
    const firstCandle = {
      time: candleTime,
      open: nextPrice,
      high: nextPrice,
      low: nextPrice,
      close: nextPrice,
      volume: nextVolume,
    };

    return {
      candles: [firstCandle],
      latestCandle: firstCandle,
      changed: true,
      ignored: false,
      isNewCandle: true,
      bucket,
    };
  }

  if (bucket === lastCandle.time * 1000) {
    const updatedCandle = {
      ...lastCandle,
      high: Math.max(lastCandle.high, nextPrice),
      low: Math.min(lastCandle.low, nextPrice),
      close: nextPrice,
      volume: nextVolume ? Math.max(lastCandle.volume || 0, nextVolume) : lastCandle.volume || 0,
    };

    const changed =
      updatedCandle.high !== lastCandle.high ||
      updatedCandle.low !== lastCandle.low ||
      updatedCandle.close !== lastCandle.close ||
      updatedCandle.volume !== lastCandle.volume;

    const nextCandles = normalizedCandles.slice(0, -1);
    nextCandles.push(updatedCandle);

    return {
      candles: nextCandles,
      latestCandle: updatedCandle,
      changed,
      ignored: false,
      isNewCandle: false,
      bucket,
    };
  }

  const newCandle = {
    time: candleTime,
    open: nextPrice,
    high: nextPrice,
    low: nextPrice,
    close: nextPrice,
    volume: nextVolume,
  };

  return {
    candles: [...normalizedCandles, newCandle],
    latestCandle: newCandle,
    changed: true,
    ignored: false,
    isNewCandle: true,
    bucket,
  };
}
