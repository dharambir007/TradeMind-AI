import { useEffect, useRef, useState, useCallback, memo } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";
import apiClient from "../services/api";
import { getCurrencySymbol } from "../utils/formatters";
import { useSocket } from "../hooks/useSocket";
import { useRealtimeChart } from "../hooks/useRealtimeChart";
import { usePrediction } from "../hooks/usePrediction";
import { sortAndDeduplicateCandles } from "../utils/liveCandles";

const INTERVALS = [
  { key: "1m", label: "1min", ranges: [{ key: "1d", label: "1D" }] },
  { key: "2m", label: "2min", ranges: [{ key: "1d", label: "1D" }, { key: "5d", label: "5D" }] },
  { key: "5m", label: "5min", ranges: [{ key: "1d", label: "1D" }, { key: "5d", label: "5D" }] },
  { key: "10m", label: "10min", ranges: [{ key: "1d", label: "1D" }, { key: "5d", label: "5D" }] },
  { key: "15m", label: "15min", ranges: [{ key: "1d", label: "1D" }, { key: "5d", label: "5D" }, { key: "1mo", label: "1M" }] },
  { key: "30m", label: "30min", ranges: [{ key: "5d", label: "5D" }, { key: "1mo", label: "1M" }] },
  { key: "1h", label: "1H", ranges: [{ key: "5d", label: "5D" }, { key: "1mo", label: "1M" }, { key: "3mo", label: "3M" }] },
  { key: "4h", label: "4H", ranges: [{ key: "1mo", label: "1M" }, { key: "3mo", label: "3M" }, { key: "6mo", label: "6M" }] },
  { key: "1d", label: "1D", ranges: [{ key: "1mo", label: "1M" }, { key: "3mo", label: "3M" }, { key: "6mo", label: "6M" }, { key: "1y", label: "1Y" }, { key: "5y", label: "5Y" }] },
  { key: "1wk", label: "1W", ranges: [{ key: "3mo", label: "3M" }, { key: "6mo", label: "6M" }, { key: "1y", label: "1Y" }, { key: "5y", label: "5Y" }] },
];

const TIMEFRAME_MAP = Object.freeze({
  "1m": "3m",
  "2m": "3m",
  "5m": "5m",
  "10m": "5m",
  "15m": "10m",
  "30m": "10m",
  "1h": "15m",
  "4h": "30m",
  "1d": "10m",
  "1wk": "30m",
});

const DEFAULT_PREDICTION_TIMEFRAME = "3m";
const DEFAULT_PREDICTION_STEPS = 3;
const PREDICTION_TIMEFRAME_OPTIONS = ["3m", "5m", "10m"];
const DEFAULT_CHART_INTERVAL = "5m";
const MARKET_TIME_ZONE = "Asia/Kolkata";
const MARKET_OPEN_MINUTE = 9 * 60 + 15; // 09:15 IST
const MARKET_CLOSE_MINUTE = 15 * 60 + 30; // 15:30 IST
const ALLOWED_INTERVAL_KEYS = new Set(INTERVALS.map((item) => item.key));
const INTRADAY_INTERVAL_KEYS = new Set(
  INTERVALS.filter((item) => item.key.endsWith("m") || item.key.endsWith("h")).map((item) => item.key)
);
const warnedInvalidChartIntervals = new Set();
const datePartsFormatterByTz = new Map();
const weekdayFormatterByTz = new Map();
const MIN_VALID_UNIX_SECONDS = 946684800; // 2000-01-01
const MAX_FUTURE_UNIX_SECONDS_DRIFT = 24 * 60 * 60;

function normalizeIntervalKey(rawInterval, source = "unknown") {
  const key = typeof rawInterval === "string"
    ? rawInterval.trim()
    : String(rawInterval ?? "").trim();

  if (ALLOWED_INTERVAL_KEYS.has(key)) return key;

  if (import.meta.env.DEV) {
    const warnKey = `${source}:${String(rawInterval)}`;
    if (!warnedInvalidChartIntervals.has(warnKey)) {
      warnedInvalidChartIntervals.add(warnKey);
      console.warn("[CandleChart] Invalid interval received, using fallback.", {
        source,
        received: rawInterval,
        fallback: DEFAULT_CHART_INTERVAL,
      });
    }
  }

  return DEFAULT_CHART_INTERVAL;
}

function getDatePartsFormatter(timeZone) {
  if (!datePartsFormatterByTz.has(timeZone)) {
    datePartsFormatterByTz.set(
      timeZone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
    );
  }
  return datePartsFormatterByTz.get(timeZone);
}

function getWeekdayFormatter(timeZone) {
  if (!weekdayFormatterByTz.has(timeZone)) {
    weekdayFormatterByTz.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
      })
    );
  }
  return weekdayFormatterByTz.get(timeZone);
}

function toCandleTimestampMs(rawTime) {
  if (typeof rawTime === "number") {
    if (!Number.isFinite(rawTime)) return null;
    return rawTime > 1e12 ? rawTime : rawTime * 1000;
  }

  if (typeof rawTime === "string") {
    const trimmed = rawTime.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) return null;
      return numeric > 1e12 ? numeric : numeric * 1000;
    }

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getZonedDateMeta(timestampMs, timeZone = MARKET_TIME_ZONE) {
  if (!Number.isFinite(timestampMs)) return null;

  const date = new Date(timestampMs);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = getDatePartsFormatter(timeZone).formatToParts(date);
  const meta = {};
  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day" || part.type === "hour" || part.type === "minute") {
      meta[part.type] = part.value;
    }
  }

  if (!meta.year || !meta.month || !meta.day || meta.hour == null || meta.minute == null) {
    return null;
  }

  const dayKey = `${meta.year}-${meta.month}-${meta.day}`;
  const minuteOfDay = Number(meta.hour) * 60 + Number(meta.minute);
  const weekday = getWeekdayFormatter(timeZone).format(date);

  return { dayKey, minuteOfDay, weekday };
}

/**
 * For intraday chart intervals, keep only one trading session:
 * - Prefer today's session (09:15 -> now while market open, else 09:15 -> 15:30)
 * - If no candles for today (market closed/holiday), fallback to last available trading day
 */
function filterIntradaySessionCandles(candles, interval, options = {}) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  const intervalKey = normalizeIntervalKey(interval, "session-filter");
  if (!INTRADAY_INTERVAL_KEYS.has(intervalKey)) return candles;

  const timeZone = options.timeZone || MARKET_TIME_ZONE;
  const openMinute = Number.isFinite(options.openMinute) ? options.openMinute : MARKET_OPEN_MINUTE;
  const closeMinute = Number.isFinite(options.closeMinute) ? options.closeMinute : MARKET_CLOSE_MINUTE;

  const enriched = candles
    .map((c) => {
      const tsMs = toCandleTimestampMs(c?.time);
      if (!Number.isFinite(tsMs)) return null;
      const meta = getZonedDateMeta(tsMs, timeZone);
      if (!meta) return null;
      return {
        candle: c,
        tsMs,
        dayKey: meta.dayKey,
        minuteOfDay: meta.minuteOfDay,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.tsMs - b.tsMs);

  if (!enriched.length) return [];

  const byDay = new Map();
  for (const item of enriched) {
    if (!byDay.has(item.dayKey)) byDay.set(item.dayKey, []);
    byDay.get(item.dayKey).push(item);
  }

  const nowMeta = getZonedDateMeta(Date.now(), timeZone);
  if (!nowMeta) return enriched.map((item) => item.candle);

  const isWeekday = nowMeta.weekday !== "Sat" && nowMeta.weekday !== "Sun";
  const isMarketOpenNow = isWeekday && nowMeta.minuteOfDay >= openMinute && nowMeta.minuteOfDay <= closeMinute;

  const sessionSlice = (items, maxMinute) =>
    (items || []).filter((item) => item.minuteOfDay >= openMinute && item.minuteOfDay <= maxMinute);

  const todaySession = sessionSlice(
    byDay.get(nowMeta.dayKey),
    isMarketOpenNow ? Math.min(nowMeta.minuteOfDay, closeMinute) : closeMinute
  );

  let selectedDayKey = nowMeta.dayKey;
  let selected = todaySession;

  if (!selected.length) {
    const dayKeys = Array.from(byDay.keys()).sort();
    const fallbackDay = dayKeys[dayKeys.length - 1];
    selectedDayKey = fallbackDay;
    selected = sessionSlice(byDay.get(fallbackDay), closeMinute);
  }

  if (import.meta.env.DEV) {
    console.debug("[CandleChart] Intraday session filter", {
      interval: intervalKey,
      inputCount: candles.length,
      outputCount: selected.length,
      selectedDay: selectedDayKey,
      marketOpenNow: isMarketOpenNow,
      emptyAfterSessionFilter: selected.length === 0,
      timeZone,
    });
  }

  return selected.map((item) => item.candle);
}

function resolvePredictionTimeframe(intervalKey) {
  return TIMEFRAME_MAP[intervalKey] || DEFAULT_PREDICTION_TIMEFRAME;
}

function sanitizeChartUnixSeconds(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const normalized = Math.floor(seconds);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (normalized < MIN_VALID_UNIX_SECONDS) return null;
  if (normalized > nowSeconds + MAX_FUTURE_UNIX_SECONDS_DRIFT) return null;
  return normalized;
}

function isFutureBusinessDate(rawDate) {
  if (typeof rawDate !== "string") return false;
  const parsed = Date.parse(`${rawDate}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return true;
  const now = new Date();
  const tomorrowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return parsed > tomorrowUtc;
}

function normalizeChartTimeValue(rawTime) {
  if (typeof rawTime === "number") {
    if (!Number.isFinite(rawTime)) return null;
    const seconds = rawTime > 1e12 ? rawTime / 1000 : rawTime;
    return sanitizeChartUnixSeconds(seconds);
  }

  if (typeof rawTime === "string") {
    const trimmed = rawTime.trim();
    if (!trimmed) return null;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) return null;
      const seconds = numeric > 1e12 ? numeric / 1000 : numeric;
      return sanitizeChartUnixSeconds(seconds);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return isFutureBusinessDate(trimmed) ? null : trimmed;
    }

    const parsedMs = Date.parse(trimmed);
    return Number.isFinite(parsedMs) ? sanitizeChartUnixSeconds(parsedMs / 1000) : null;
  }

  return null;
}

function getChartTimeDate(rawTime) {
  const normalized = normalizeChartTimeValue(rawTime);

  if (typeof normalized === "string") {
    const parsed = new Date(`${normalized}T00:00:00`);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  if (typeof normalized === "number") {
    const parsed = new Date(normalized * 1000);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  return null;
}

function normalizeChartCandle(candle) {
  if (!candle) return null;

  const time = normalizeChartTimeValue(candle.time);
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);
  const volume = Number(candle.volume || 0);

  if (time == null || ![open, high, low, close].every(Number.isFinite)) {
    return null;
  }

  return {
    time,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : 0,
  };
}

function normalizeChartCandles(candles) {
  if (!Array.isArray(candles)) return [];
  const sorted = candles
    .map(normalizeChartCandle)
    .filter(Boolean)
    .sort((a, b) => {
      if (typeof a.time === "number" && typeof b.time === "number") return a.time - b.time;
      return String(a.time).localeCompare(String(b.time));
    });

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
    previous.volume = Math.max(Number(previous.volume || 0), Number(candle.volume || 0));
  }

  return deduplicated;
}

function formatChartTime(value, intraday) {
  const date = getChartTimeDate(value);
  if (!date || !Number.isFinite(date.getTime())) return "";
  if (intraday) {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: MARKET_TIME_ZONE,
    });
  }
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: MARKET_TIME_ZONE,
  });
}

function formatChartInfoTimestamp(value, intraday) {
  const date = getChartTimeDate(value);
  if (!date) return "";

  if (intraday) {
    const timeLabel = date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: MARKET_TIME_ZONE,
    });
    const dayLabel = date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: MARKET_TIME_ZONE,
    });
    return `${timeLabel} | ${dayLabel}`;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: MARKET_TIME_ZONE,
  });
}

const CandleChart = memo(({ symbol, currency }) => {
  const chartContainerRef = useRef(null);
  const sectionRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const chartRef = useRef(null);

  // candle state refs
  const realCandlesRef = useRef([]);           // Historical + live real candles
  const predictedCandlesRef = useRef([]);      // ML predicted candles (purple)

  // Prediction overlay series refs
  const predCandleSeriesRef = useRef(null);
  const predGlowLineRef = useRef(null);    // Wide transparent glow under trail
  const predTrailLineRef = useRef(null);   // Smooth dashed path line through predicted closes
  const predAnimFrameRef = useRef(null);   // Running animation frame id
  const predConfidenceRef = useRef(1);     // Opacity multiplier derived from prediction confidence

  /**
   * Map prediction confidence to opacity multiplier (0.35-1.0).
   */
  const confidenceToMultiplier = useCallback((conf) => {
    const pct = Math.max(0, Math.min(100, Number(conf) || 0));
    return 0.35 + 0.65 * (pct / 100);     // linear ramp: [0.35 … 1.0]
  }, []);

  // prediction animation helpers
  const cancelPredAnimation = useCallback(() => {
    if (predAnimFrameRef.current) {
      cancelAnimationFrame(predAnimFrameRef.current);
      predAnimFrameRef.current = null;
    }
  }, []);

  // Fade prediction overlay from invisible → confidence-scaled ghost opacity
  const animatePredictionFadeIn = useCallback((durationMs = 350) => {
    cancelPredAnimation();
    const data = predictedCandlesRef.current;
    if (!data.length) return;
    const m = predConfidenceRef.current; // confidence multiplier
    const bullish = data[data.length - 1].close >= data[0].open;
    const [tr, tg, tb] = bullish ? [16, 185, 129] : [239, 68, 68];

    // Target opacities scaled by confidence
    const tBody = 0.25 * m, tWick = 0.35 * m, tBorder = 0.45 * m;
    const tTrail = 0.65 * m, tGlow = 0.12 * m;

    // Immediately set overlay to fully transparent (prevents 1-frame flash)
    try { predCandleSeriesRef.current?.applyOptions({
      upColor: "rgba(16,185,129,0)", downColor: "rgba(239,68,68,0)",
      wickUpColor: "rgba(16,185,129,0)", wickDownColor: "rgba(239,68,68,0)",
      borderUpColor: "rgba(16,185,129,0)", borderDownColor: "rgba(239,68,68,0)",
    }); } catch { /* noop */ }
    try { predTrailLineRef.current?.applyOptions({ color: "rgba(0,0,0,0)" }); } catch { /* noop */ }
    try { predGlowLineRef.current?.applyOptions({ color: "rgba(0,0,0,0)" }); } catch { /* noop */ }

    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / durationMs, 1);
      const ease = 1 - Math.pow(1 - p, 3);  // ease-out cubic

      try { predCandleSeriesRef.current?.applyOptions({
        upColor:         `rgba(16,185,129,${(tBody * ease).toFixed(3)})`,
        downColor:       `rgba(239,68,68,${(tBody * ease).toFixed(3)})`,
        wickUpColor:     `rgba(16,185,129,${(tWick * ease).toFixed(3)})`,
        wickDownColor:   `rgba(239,68,68,${(tWick * ease).toFixed(3)})`,
        borderUpColor:   `rgba(16,185,129,${(tBorder * ease).toFixed(3)})`,
        borderDownColor: `rgba(239,68,68,${(tBorder * ease).toFixed(3)})`,
      }); } catch { /* noop */ }
      try { predTrailLineRef.current?.applyOptions({
        color: `rgba(${tr},${tg},${tb},${(tTrail * ease).toFixed(3)})`,
      }); } catch { /* noop */ }
      try { predGlowLineRef.current?.applyOptions({
        color: `rgba(${tr},${tg},${tb},${(tGlow * ease).toFixed(3)})`,
      }); } catch { /* noop */ }

      if (p < 1) {
        predAnimFrameRef.current = requestAnimationFrame(frame);
      } else {
        predAnimFrameRef.current = null;
      }
    }
    predAnimFrameRef.current = requestAnimationFrame(frame);
  }, [cancelPredAnimation]);

  // Brief brightness pulse when a predicted candle is consumed by reality
  const animateConsumptionPulse = useCallback((durationMs = 250) => {
    cancelPredAnimation();
    const data = predictedCandlesRef.current;
    if (!data.length) return;
    const m = predConfidenceRef.current; // confidence multiplier
    const bullish = data[data.length - 1].close >= data[0].open;
    const [tr, tg, tb] = bullish ? [16, 185, 129] : [239, 68, 68];
    const start = performance.now();

    function frame(now) {
      const p = Math.min((now - start) / durationMs, 1);
      // Scale: 1.6× → 1.0× (ease-out quadratic)
      const s = 1 + 0.6 * Math.pow(1 - p, 2);

      try { predCandleSeriesRef.current?.applyOptions({
        upColor:         `rgba(16,185,129,${Math.min(0.25 * m * s, 0.7).toFixed(3)})`,
        downColor:       `rgba(239,68,68,${Math.min(0.25 * m * s, 0.7).toFixed(3)})`,
        wickUpColor:     `rgba(16,185,129,${Math.min(0.35 * m * s, 0.8).toFixed(3)})`,
        wickDownColor:   `rgba(239,68,68,${Math.min(0.35 * m * s, 0.8).toFixed(3)})`,
        borderUpColor:   `rgba(16,185,129,${Math.min(0.45 * m * s, 0.9).toFixed(3)})`,
        borderDownColor: `rgba(239,68,68,${Math.min(0.45 * m * s, 0.9).toFixed(3)})`,
      }); } catch { /* noop */ }
      try { predTrailLineRef.current?.applyOptions({
        color: `rgba(${tr},${tg},${tb},${Math.min(0.65 * m * s, 1).toFixed(3)})`,
      }); } catch { /* noop */ }
      try { predGlowLineRef.current?.applyOptions({
        color: `rgba(${tr},${tg},${tb},${Math.min(0.12 * m * s, 0.3).toFixed(3)})`,
        lineWidth: Math.round(8 + 4 * (s - 1)),
      }); } catch { /* noop */ }

      if (p < 1) {
        predAnimFrameRef.current = requestAnimationFrame(frame);
      } else {
        predAnimFrameRef.current = null;
        try { predGlowLineRef.current?.applyOptions({ lineWidth: 8 }); } catch { /* noop */ }
      }
    }
    predAnimFrameRef.current = requestAnimationFrame(frame);
  }, [cancelPredAnimation]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartInterval, setChartInterval] = useState(DEFAULT_CHART_INTERVAL);
  const [range, setRange] = useState("1d");
  const [chartInfo, setChartInfo] = useState(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [wlBusy, setWlBusy] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [predictionTimeframe, setPredictionTimeframe] = useState(
    resolvePredictionTimeframe(DEFAULT_CHART_INTERVAL)
  );
  const interval = normalizeIntervalKey(chartInterval, "state");

  // ML Prediction
  const {
    prediction,
    loading: predLoading,
    error: predError,
    predict,
    clearPrediction,
  } = usePrediction(symbol);

  // WebSocket integration
  const { tick, live } = useSocket(symbol);

  // sync prediction overlay series
  const syncPredictionSeries = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const data = predictedCandlesRef.current;

    if (!data.length) {
      // Remove overlay if no predicted candles remain
      if (predCandleSeriesRef.current) {
        try { chart.removeSeries(predCandleSeriesRef.current); } catch { /* noop */ }
        predCandleSeriesRef.current = null;
      }
      if (predGlowLineRef.current) {
        try { chart.removeSeries(predGlowLineRef.current); } catch { /* noop */ }
        predGlowLineRef.current = null;
      }
      if (predTrailLineRef.current) {
        try { chart.removeSeries(predTrailLineRef.current); } catch { /* noop */ }
        predTrailLineRef.current = null;
      }
      return;
    }

    // ghost styling scaled by confidence
    const m = predConfidenceRef.current;   // 0.35 – 1.0
    const GHOST_UP_BODY     = `rgba(16,185,129,${(0.25 * m).toFixed(3)})`;   // bullish body
    const GHOST_DOWN_BODY   = `rgba(239,68,68,${(0.25 * m).toFixed(3)})`;     // bearish body
    const GHOST_UP_WICK     = `rgba(16,185,129,${(0.35 * m).toFixed(3)})`;    // bullish wick
    const GHOST_DOWN_WICK   = `rgba(239,68,68,${(0.35 * m).toFixed(3)})`;     // bearish wick
    const GHOST_UP_BORDER   = `rgba(16,185,129,${(0.45 * m).toFixed(3)})`;    // bullish border
    const GHOST_DOWN_BORDER = `rgba(239,68,68,${(0.45 * m).toFixed(3)})`;     // bearish border

    if (predCandleSeriesRef.current) {
      try {
        predCandleSeriesRef.current.setData(data);
        // Re-apply confidence-scaled colors when data is updated
        predCandleSeriesRef.current.applyOptions({
          upColor: GHOST_UP_BODY, downColor: GHOST_DOWN_BODY,
          borderUpColor: GHOST_UP_BORDER, borderDownColor: GHOST_DOWN_BORDER,
          wickUpColor: GHOST_UP_WICK, wickDownColor: GHOST_DOWN_WICK,
        });
      } catch { /* noop */ }
    } else {
      const predSeries = chart.addSeries(CandlestickSeries, {
        upColor: GHOST_UP_BODY,
        downColor: GHOST_DOWN_BODY,
        borderVisible: true,
        borderUpColor: GHOST_UP_BORDER,
        borderDownColor: GHOST_DOWN_BORDER,
        wickUpColor: GHOST_UP_WICK,
        wickDownColor: GHOST_DOWN_WICK,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      predSeries.setData(data);
      predCandleSeriesRef.current = predSeries;
    }

    // prediction path line with glow
    const reals = realCandlesRef.current;
    const lastReal = reals.length ? reals[reals.length - 1] : null;
    const firstPred = data[0];
    const lastPred = data[data.length - 1];
    const trailBullish = lastPred && firstPred
      ? lastPred.close >= firstPred.open
      : true;
    const trailColor = trailBullish
      ? `rgba(16,185,129,${(0.65 * m).toFixed(3)})`
      : `rgba(239,68,68,${(0.65 * m).toFixed(3)})`;
    const glowColor = trailBullish
      ? `rgba(16,185,129,${(0.12 * m).toFixed(3)})`
      : `rgba(239,68,68,${(0.12 * m).toFixed(3)})`;
    const trailPoints = [];

    // Anchor at last real candle close
    if (lastReal) {
      trailPoints.push({ time: lastReal.time, value: lastReal.close });
    }
    for (const c of data) {
      trailPoints.push({ time: c.time, value: c.close });
    }

    if (trailPoints.length >= 2) {
      // glow layer
      if (predGlowLineRef.current) {
        try {
          predGlowLineRef.current.setData(trailPoints);
          predGlowLineRef.current.applyOptions({ color: glowColor });
        } catch { /* noop */ }
      } else {
        const glowLine = chart.addSeries(LineSeries, {
          color: glowColor,
          lineWidth: 8,
          lineStyle: 0,          // Solid (glow shouldn't be dashed)
          lineType: 2,           // Curved
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          pointMarkersVisible: false,
        });
        glowLine.setData(trailPoints);
        predGlowLineRef.current = glowLine;
      }

      // main trail line
      if (predTrailLineRef.current) {
        try {
          predTrailLineRef.current.setData(trailPoints);
          predTrailLineRef.current.applyOptions({ color: trailColor });
        } catch { /* noop */ }
      } else {
        const trailLine = chart.addSeries(LineSeries, {
          color: trailColor,
          lineWidth: 2,
          lineStyle: 2,          // Dashed
          lineType: 2,           // Curved (smooth)
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          pointMarkersVisible: true,
          pointMarkersRadius: 3,
        });
        trailLine.setData(trailPoints);
        predTrailLineRef.current = trailLine;
      }
    } else {
      // Not enough points — tear down both line series
      if (predGlowLineRef.current) {
        try { chart.removeSeries(predGlowLineRef.current); } catch { /* noop */ }
        predGlowLineRef.current = null;
      }
      if (predTrailLineRef.current) {
        try { chart.removeSeries(predTrailLineRef.current); } catch { /* noop */ }
        predTrailLineRef.current = null;
      }
    }
  }, []);

  // clear prediction overlay
  const clearPredictionOverlay = useCallback(() => {
    cancelPredAnimation();
    const chart = chartRef.current;

    // Clear predicted candles state
    predictedCandlesRef.current = [];
    predConfidenceRef.current = 1;

    // Remove prediction overlay series
    if (chart && predCandleSeriesRef.current) {
      try { chart.removeSeries(predCandleSeriesRef.current); } catch { /* noop */ }
      predCandleSeriesRef.current = null;
    }

    // Remove glow + trail line series
    if (chart && predGlowLineRef.current) {
      try { chart.removeSeries(predGlowLineRef.current); } catch { /* noop */ }
      predGlowLineRef.current = null;
    }
    if (chart && predTrailLineRef.current) {
      try { chart.removeSeries(predTrailLineRef.current); } catch { /* noop */ }
      predTrailLineRef.current = null;
    }

    // Clear prediction marker from real candle series
    if (candleSeriesRef.current) {
      try { candleSeriesRef.current.setMarkers([]); } catch { /* noop */ }
    }

    if (chart) chart.timeScale().fitContent();
  }, []);

  // Called by useRealtimeChart when every predicted candle has been
  // replaced by a real candle — tears down the layer and resets state
  // so the user can trigger a fresh prediction without duplication.
  const handleAllPredictionsConsumed = useCallback(() => {
    clearPredictionOverlay();
    clearPrediction();
  }, [clearPredictionOverlay, clearPrediction]);

  // Stable tick callback — only updates state when price changes (ref-checked inside hook)
  const handleTickUpdate = useCallback((data) => {
    setLivePrice((prev) => {
      // Skip state update if price hasn't changed — prevents needless re-render
      if (prev && prev.price === data.price && prev.changePercent === data.changePercent) return prev;
      return data;
    });

    setChartInfo((prev) => {
      if (!prev) return prev;
      const nextPrice = Number(data.price);
      return {
        ...prev,
        lastClose: Number.isFinite(nextPrice) ? nextPrice.toFixed(2) : prev.lastClose,
        lastDate: formatChartInfoTimestamp(data.time, true) || prev.lastDate,
      };
    });
  }, []);

  // Bridge ticks to chart (includes live candle merge with prediction overlay)
  useRealtimeChart({
    tick,
    candleSeriesRef,
    volumeSeriesRef,
    interval,
    onTickUpdate: handleTickUpdate,
    realCandlesRef,
    predictedCandlesRef,
    syncPredictionSeries,
    onPredictionConsumed: animateConsumptionPulse,
    onAllPredictionsConsumed: handleAllPredictionsConsumed,
  });

  // apply prediction overlay
  const applyPredictionOverlay = useCallback((predData) => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries || !predData) return;

    const predictedData = normalizeChartCandles(predData.predictedData);
    if (!predictedData.length) return;

    // clear stale overlay before applying new
    if (predictedCandlesRef.current.length || predCandleSeriesRef.current) {
      cancelPredAnimation();
      predictedCandlesRef.current = [];
      predConfidenceRef.current = 1;
      if (predCandleSeriesRef.current) {
        try { chart.removeSeries(predCandleSeriesRef.current); } catch { /* noop */ }
        predCandleSeriesRef.current = null;
      }
      if (predGlowLineRef.current) {
        try { chart.removeSeries(predGlowLineRef.current); } catch { /* noop */ }
        predGlowLineRef.current = null;
      }
      if (predTrailLineRef.current) {
        try { chart.removeSeries(predTrailLineRef.current); } catch { /* noop */ }
        predTrailLineRef.current = null;
      }
      if (candleSeries) {
        try { candleSeries.setMarkers([]); } catch { /* noop */ }
      }
    }

    // Store in predicted candles ref (source of truth)
    predictedCandlesRef.current = predictedData;

    // Derive confidence multiplier for ghost opacity scaling
    const confidence = Number(predData.predictionMeta?.confidence || 0);
    predConfidenceRef.current = confidenceToMultiplier(confidence);

    // Sync overlay series to chart, then fade in
    syncPredictionSeries();
    animatePredictionFadeIn();

    // Add marker on last real candle to mark prediction start
    const realCandles = realCandlesRef.current;
    const direction = String(predData.predictionMeta?.direction || "").toUpperCase();
    const isBullish = direction !== "DOWN";
    const markerColor = isBullish ? "#10b981" : "#ef4444";
    const lastReal = realCandles[realCandles.length - 1];
    if (lastReal?.time != null) {
      try {
        candleSeries.setMarkers([
          {
            time: lastReal.time,
            position: isBullish ? "belowBar" : "aboveBar",
            color: markerColor,
            shape: isBullish ? "arrowUp" : "arrowDown",
            text: `${predData.timeframe || DEFAULT_PREDICTION_TIMEFRAME} prediction`,
          },
        ]);
      } catch { /* noop */ }
    }

    chart.timeScale().fitContent();
  }, [syncPredictionSeries, animatePredictionFadeIn, cancelPredAnimation, confidenceToMultiplier]);

  // Sync fallback: if prediction state changes externally
  useEffect(() => {
    if (!prediction) {
      clearPredictionOverlay();
      return;
    }
    // Only apply if predictedCandlesRef is empty (not yet applied imperatively)
    if (!predictedCandlesRef.current.length) {
      applyPredictionOverlay(prediction);
    }
  }, [prediction, clearPredictionOverlay, applyPredictionOverlay]);

  // Check if symbol is in watchlist
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await apiClient.get("/watchlist");
        if (active) {
          const syms = (res.data || []).map((i) => i.symbol?.toUpperCase());
          setInWatchlist(syms.includes(symbol?.toUpperCase()));
        }
      } catch { /* noop */ }
    };
    check();
    const handler = () => check();
    window.addEventListener("watchlist-updated", handler);
    return () => { active = false; window.removeEventListener("watchlist-updated", handler); };
  }, [symbol]);

  const toggleWatchlist = async () => {
    if (wlBusy) return;
    setWlBusy(true);
    try {
      if (inWatchlist) {
        await apiClient.delete(`/watchlist/${encodeURIComponent(symbol)}`);
        setInWatchlist(false);
      } else {
        await apiClient.post("/watchlist", { symbol });
        setInWatchlist(true);
      }
      window.dispatchEvent(new Event("watchlist-updated"));
    } catch (err) {
      console.error("Watchlist toggle failed:", err?.response?.data?.message || err.message);
    } finally {
      setWlBusy(false);
    }
  };

  const activeInterval = INTERVALS.find((i) => i.key === interval) || INTERVALS[4];
  const isIntraday = INTRADAY_INTERVAL_KEYS.has(interval);
  const selectedPredictionTimeframe =
    predictionTimeframe || resolvePredictionTimeframe(interval);

  const handleIntervalChange = (newInterval) => {
    const normalized = normalizeIntervalKey(newInterval, "dropdown");
    const intObj = INTERVALS.find((i) => i.key === normalized);
    if (import.meta.env.DEV) {
      console.debug("[CandleChart] Interval changed.", { from: interval, to: normalized });
    }
    setChartInterval(normalized);
    setPredictionTimeframe(resolvePredictionTimeframe(normalized));
    clearPrediction(); // Clear prediction on interval change
    if (intObj) {
      const validRange = intObj.ranges.find((r) => r.key === range);
      if (!validRange) setRange(intObj.ranges[0].key);
    }
  };

  // Self-heal invalid interval state to prevent runtime crashes.
  useEffect(() => {
    if (chartInterval !== interval) {
      setChartInterval(interval);
    }
  }, [chartInterval, interval]);

  // Create chart and load historical data
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !symbol) return;

    let active = true;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#505872",
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.025)" },
        horzLines: { color: "rgba(255,255,255,0.025)" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(0,212,255,0.15)", width: 1, style: 2, labelBackgroundColor: "#0c1019" },
        horzLine: { color: "rgba(0,212,255,0.15)", width: 1, style: 2, labelBackgroundColor: "#0c1019" },
      },
      rightPriceScale: { borderVisible: false, textColor: "#3b4260" },
      timeScale: {
        borderVisible: false,
        timeVisible: isIntraday,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 5,
        tickMarkFormatter: (time) => formatChartTime(time, isIntraday),
      },
      localization: {
        timeFormatter: (timestamp) => formatChartTime(timestamp, isIntraday),
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    volumeSeriesRef.current = volumeSeries;

    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      borderVisible: false,
    });

    // Load historical data ONCE (not polled)
    async function loadHistory() {
      setLoading(true);
      setError("");
      try {
        const safeRange = range || "1d";
        const safeInterval = interval || "5m";
        const res = await apiClient.get(
          `/stocks/${encodeURIComponent(symbol)}/history`,
          { params: { range: safeRange, interval: safeInterval } }
        );
        if (!active) return;

        const rawCandles = Array.isArray(res.data) ? res.data : [];
        if (import.meta.env.DEV) {
          console.debug("[CandleChart] loadHistory raw timestamps", {
            symbol,
            interval,
            range,
            count: rawCandles.length,
            sample: rawCandles.slice(0, 5).map((item) => item?.time ?? item?.timestamp ?? null),
          });
        }
        // Backend already filters intraday candles to the correct session.
        // Only apply the frontend session filter for daily/weekly data that
        // arrives as date-strings (not Unix timestamps).
        const backendAlreadyFiltered =
          rawCandles.length > 0 && typeof rawCandles[0].time === "number";
        const candles = backendAlreadyFiltered
          ? rawCandles
          : filterIntradaySessionCandles(rawCandles, interval, {
              timeZone: MARKET_TIME_ZONE,
            });

        if (candles.length > 0) {
          const formatted = normalizeChartCandles(candles);
          const volumes = formatted.map((c) => ({
            time: c.time,
            value: c.volume || 0,
            color: c.close >= c.open ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          }));

          candleSeries.setData(formatted);
          volumeSeries.setData(volumes);
          realCandlesRef.current = formatted;
          predictedCandlesRef.current = [];
          chart.timeScale().fitContent();

          const last = formatted[formatted.length - 1];
          const lastTime = formatChartInfoTimestamp(last?.time, INTRADAY_INTERVAL_KEYS.has(interval)) || "-";

          setChartInfo({
            lastDate: lastTime,
            lastClose: (+last.close).toFixed(2),
            dataPoints: formatted.length,
            intervalLabel: activeInterval.label,
            currencySymbol: getCurrencySymbol(currency),
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error(`Chart fetch error (range=${range}, interval=${interval}):`, err?.message);
      }
      if (active) {
        setError("No chart data available for this stock.");
        setLoading(false);
      }
    }

    loadHistory();

    return () => {
      active = false;
      if (predAnimFrameRef.current) cancelAnimationFrame(predAnimFrameRef.current);
      predAnimFrameRef.current = null;
      predCandleSeriesRef.current = null;
      predGlowLineRef.current = null;
      predTrailLineRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chartRef.current = null;
      realCandlesRef.current = [];
      predictedCandlesRef.current = [];
      chart.remove();
    };
  }, [symbol, interval, range]);

  // Periodic refresh: re-fetch chart data every 5s for intraday intervals
  // Frequent refresh keeps chart aligned when websocket ticks are delayed/dropped.
  useEffect(() => {
    const isIntradayInterval = INTRADAY_INTERVAL_KEYS.has(interval);
    if (!symbol || !isIntradayInterval) return;
    if (live) return undefined;

    let active = true;

    const refresh = async () => {
      // Skip if chart series aren't initialised yet
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      try {
        const safeRange = range || "1d";
        const safeInterval = interval || "5m";
        const res = await apiClient.get(
          `/stocks/${encodeURIComponent(symbol)}/history`,
          { params: { range: safeRange, interval: safeInterval } }
        );
        if (!active) return;

        // Handle {success:false} response from backend
        if (res.data && res.data.success === false) return;
        const rawCandles = Array.isArray(res.data) ? res.data : [];
        if (import.meta.env.DEV) {
          console.debug("[CandleChart] refresh raw timestamps", {
            symbol,
            interval,
            range,
            count: rawCandles.length,
            sample: rawCandles.slice(0, 5).map((item) => item?.time ?? item?.timestamp ?? null),
          });
        }
        const backendAlreadyFiltered =
          rawCandles.length > 0 && typeof rawCandles[0].time === "number";
        const candles = backendAlreadyFiltered
          ? rawCandles
          : filterIntradaySessionCandles(rawCandles, interval, {
              timeZone: MARKET_TIME_ZONE,
            });
        if (!candles.length) return;

        const refreshed = normalizeChartCandles(candles);
        const merged = sortAndDeduplicateCandles([
          ...realCandlesRef.current,
          ...refreshed,
        ]);
        const volumes = merged.map((c) => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
        }));

        // Use requestAnimationFrame to batch DOM updates and avoid mid-frame jank
        requestAnimationFrame(() => {
          if (!active) return;
          try {
            if (candleSeriesRef.current) candleSeriesRef.current.setData(merged);
            if (volumeSeriesRef.current) volumeSeriesRef.current.setData(volumes);
            realCandlesRef.current = merged;
            const last = merged[merged.length - 1];
            if (last) {
              setChartInfo((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  lastClose: Number(last.close).toFixed(2),
                  lastDate: formatChartInfoTimestamp(last.time, INTRADAY_INTERVAL_KEYS.has(interval)) || prev.lastDate,
                  dataPoints: merged.length,
                };
              });
            }
          } catch { /* chart may have been disposed */ }
        });
      } catch { /* silent — will retry next cycle */ }
    };

    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [symbol, interval, range, live]);

  // Prediction info derived state
  const predInfo = prediction?.predictionMeta ? (() => {
    const currentPrice = Number(prediction.predictionMeta.currentPrice);
    const targetPrice = Number(prediction.predictionMeta.targetPrice);
    const changePct = currentPrice
      ? (((targetPrice - currentPrice) / currentPrice) * 100).toFixed(2)
      : "0.00";

    return {
      direction: prediction.predictionMeta.direction,
      confidence: Number(prediction.predictionMeta.confidence || 0),
      targetPrice,
      currentPrice,
      changePct,
      isBullish: String(prediction.predictionMeta.direction || "").toUpperCase() === "UP",
      processingMs: Number(prediction.predictionMeta.processingTimeMs || 0),
      timeframe: prediction.timeframe,
    };
  })() : null;

  const rangeBtnStyle = (isActive) => ({
    padding: "3px 8px", borderRadius: "5px", fontSize: "10px",
    fontWeight: isActive ? 600 : 400, border: "none", cursor: "pointer",
    background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
    color: isActive ? "#8b93a7" : "#3b4260",
    transition: "all 0.15s ease",
  });

  // Fullscreen toggle using native Fullscreen API
  const toggleFullscreen = useCallback(async () => {
    const section = sectionRef.current;
    if (!section) return;

    try {
      if (!document.fullscreenElement) {
        await section.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // Sync state with native fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Resize chart after fullscreen change
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
        chartRef.current?.timeScale()?.fitContent();
      }, 100);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const livePriceValue = Number(livePrice?.price);
  const liveChangePercent = Number(livePrice?.changePercent);
  const hasLivePrice = Number.isFinite(livePriceValue);
  const hasLiveChangePercent = Number.isFinite(liveChangePercent);

  return (
    <section
      ref={sectionRef}
      style={{
        borderRadius: isFullscreen ? "0" : "14px",
        border: isFullscreen ? "none" : "1px solid rgba(255,255,255,0.04)",
        background: isFullscreen ? "#0a0e17" : "rgba(255,255,255,0.015)",
        padding: isFullscreen ? "20px" : "16px",
        position: "relative",
        display: isFullscreen ? "flex" : "block",
        flexDirection: isFullscreen ? "column" : "initial",
        overflow: "hidden",
        height: isFullscreen ? "100vh" : "auto",
        width: isFullscreen ? "100vw" : "auto",
      }}>
      {/* Top glow line */}
      <div style={{
        position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)",
      }} />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: "8px", marginBottom: "12px",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.01em" }}>
              {symbol} Price Action
            </h4>
            {/* Live indicator */}
            {live && !loading && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em",
                color: "#10b981", background: "rgba(16,185,129,0.08)",
                padding: "2px 8px", borderRadius: "4px",
                border: "1px solid rgba(16,185,129,0.15)",
                animation: "pulse-glow 2s ease-in-out infinite",
              }}>
                <span style={{
                  width: "5px", height: "5px", borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 6px rgba(16,185,129,0.5)",
                }} />
                LIVE
              </span>
            )}
          </div>
          {chartInfo && (
            <span style={{ fontSize: "11px", color: "#3b4260" }}>
              Last: {chartInfo.currencySymbol}
              {hasLivePrice ? livePriceValue.toFixed(2) : chartInfo.lastClose}
              {hasLiveChangePercent && (
                <span style={{
                  color: liveChangePercent >= 0 ? "#10b981" : "#ef4444",
                  marginLeft: "6px", fontWeight: 600,
                }}>
                  {liveChangePercent >= 0 ? "+" : ""}{liveChangePercent.toFixed(2)}%
                </span>
              )}
              {" · "}{chartInfo.lastDate} · {chartInfo.dataPoints} pts
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          {/* Interval + Predict + Watchlist */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Interval Dropdown */}
            <select
              value={interval}
              onChange={(e) => handleIntervalChange(e.target.value)}
              title="Chart Interval"
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(0,212,255,0.15)",
                background: "rgba(0,212,255,0.05)",
                color: "#00d4ff",
                fontSize: "11px",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
                minWidth: "70px",
              }}
            >
              {INTERVALS.map((i) => (
                <option key={i.key} value={i.key} style={{ background: "#0c1019", color: "#c7cee2" }}>
                  {i.label}
                </option>
              ))}
            </select>

            {/* Prediction Timeframe Dropdown */}
            <select
              value={selectedPredictionTimeframe}
              onChange={(e) => setPredictionTimeframe(e.target.value)}
              disabled={predLoading}
              title="Prediction timeframe"
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(139,92,246,0.15)",
                background: "rgba(139,92,246,0.05)",
                color: "#a78bfa",
                fontSize: "11px",
                fontWeight: 600,
                outline: "none",
                cursor: predLoading ? "wait" : "pointer",
                minWidth: "60px",
              }}
            >
              {PREDICTION_TIMEFRAME_OPTIONS.map((tf) => (
                <option key={tf} value={tf} style={{ background: "#0c1019", color: "#c7cee2" }}>
                  {tf.toUpperCase()}
                </option>
              ))}
            </select>

            {/* predict button */}
            <button
              className="predict-btn"
              onClick={async () => {
                if (prediction) {
                  clearPrediction();
                  return;
                }
                // Clear any stale ghost candles that might linger
                // (e.g. previous prediction fully consumed but ref not yet reset)
                if (predictedCandlesRef.current.length) {
                  clearPredictionOverlay();
                }
                const data = await predict({
                  timeframe: selectedPredictionTimeframe,
                  steps: DEFAULT_PREDICTION_STEPS,
                });
                if (data) applyPredictionOverlay(data);
              }}
              disabled={predLoading}
              title={prediction ? "Clear Prediction" : `Predict ${selectedPredictionTimeframe}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "5px 14px", borderRadius: "8px", fontSize: "11px",
                fontWeight: 700, letterSpacing: "0.02em",
                border: prediction
                  ? "1px solid rgba(139,92,246,0.3)"
                  : "1px solid rgba(139,92,246,0.2)",
                cursor: predLoading ? "wait" : "pointer",
                background: prediction
                  ? "rgba(139,92,246,0.15)"
                  : "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.08))",
                color: prediction ? "#c4b5fd" : "#a78bfa",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                animation: predLoading ? "prediction-pulse 1.5s ease-in-out infinite" : "none",
                boxShadow: prediction ? "0 0 20px rgba(139,92,246,0.15)" : "none",
              }}
            >
              {predLoading ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                  </svg>
                  Predicting...
                </>
              ) : prediction ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Clear
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Predict
                </>
              )}
            </button>

            {/* Watchlist toggle */}
            <button
              onClick={toggleWatchlist}
              disabled={wlBusy}
              title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "32px", height: "32px", borderRadius: "8px", border: "none", cursor: wlBusy ? "wait" : "pointer",
                background: inWatchlist ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
                color: inWatchlist ? "#10b981" : "#505872",
                transition: "all 0.25s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!inWatchlist) { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; e.currentTarget.style.color = "#10b981"; } }}
              onMouseLeave={(e) => { if (!inWatchlist) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#505872"; } }}
            >
              {inWatchlist ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              )}
            </button>
          </div>

          {/* Range buttons + Fullscreen */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            {activeInterval.ranges.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} style={rangeBtnStyle(range === r.key)}>
                {r.label}
              </button>
            ))}
            <span style={{ fontSize: "10px", color: "#2a3050", marginLeft: "6px", borderLeft: "1px solid rgba(255,255,255,0.04)", paddingLeft: "6px" }}>
              OHLCV
            </span>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
              style={{
                marginLeft: "8px",
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.06)",
                background: isFullscreen ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.02)",
                color: isFullscreen ? "#00d4ff" : "#505872",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0,212,255,0.08)";
                e.currentTarget.style.color = "#00d4ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isFullscreen ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.02)";
                e.currentTarget.style.color = isFullscreen ? "#00d4ff" : "#505872";
              }}
            >
              {isFullscreen ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* prediction info badge */}
      {predInfo && (
        <div className="prediction-badge" style={{
          display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          padding: "10px 14px", marginBottom: "12px", borderRadius: "10px",
          background: predInfo.isBullish
            ? "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.03))"
            : "linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.03))",
          border: `1px solid ${predInfo.isBullish ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}`,
          animation: "fadeIn 0.4s ease",
        }}>
          {/* Direction arrow */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={predInfo.isBullish ? "#10b981" : "#ef4444"} strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: predInfo.isBullish ? "rotate(0)" : "rotate(180deg)", transition: "transform 0.3s ease" }}>
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span style={{
              fontSize: "14px", fontWeight: 800, letterSpacing: "-0.01em",
              color: predInfo.isBullish ? "#10b981" : "#ef4444",
            }}>
              {predInfo.direction}
            </span>
          </div>

          {/* Separator */}
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.06)" }} />

          {/* Confidence */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "9px", color: "#505872", fontWeight: 500, letterSpacing: "0.04em" }}>CONFIDENCE</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#e0e4ec" }}>{predInfo.confidence.toFixed(1)}%</span>
          </div>

          {/* Separator */}
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.06)" }} />

          {/* Timeframe */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "9px", color: "#505872", fontWeight: 500, letterSpacing: "0.04em" }}>TIMEFRAME</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#e0e4ec" }}>
              {String(predInfo.timeframe || selectedPredictionTimeframe).toUpperCase()}
            </span>
          </div>

          {/* Separator */}
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.06)" }} />

          {/* Target price */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "9px", color: "#505872", fontWeight: 500, letterSpacing: "0.04em" }}>TARGET</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#e0e4ec" }}>
              {chartInfo?.currencySymbol || "\u20B9"}{Number.isFinite(predInfo.targetPrice) ? predInfo.targetPrice.toFixed(2) : "--"}
              <span style={{
                fontSize: "10px", fontWeight: 600, marginLeft: "4px",
                color: predInfo.isBullish ? "#10b981" : "#ef4444",
              }}>
                {predInfo.isBullish ? "+" : ""}{predInfo.changePct}%
              </span>
            </span>
          </div>

          {/* Separator */}
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.06)" }} />

          {/* Processing time */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "9px", color: "#505872", fontWeight: 500, letterSpacing: "0.04em" }}>LATENCY</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#3b4260" }}>{Number.isFinite(predInfo.processingMs) ? predInfo.processingMs.toFixed(0) : "--"}ms</span>
          </div>
        </div>
      )}

      {/* Prediction error */}
      {predError && (
        <div style={{
          padding: "8px 12px", marginBottom: "8px", borderRadius: "8px",
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)",
          color: "#f87171", fontSize: "12px",
          display: "flex", alignItems: "center", gap: "6px",
          animation: "fadeIn 0.3s ease",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {predError}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{
          height: isFullscreen ? "calc(100vh - 180px)" : "420px",
          flex: isFullscreen ? 1 : "none",
          borderRadius: "8px",
          background: "linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.02) 75%)",
          backgroundSize: "400% 100%",
          animation: "shimmer 1.8s ease-in-out infinite",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#505872", fontSize: "13px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
            </svg>
            Loading chart...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          textAlign: "center", color: "#f43f5e", padding: "32px 16px", fontSize: "13px",
          height: isFullscreen ? "calc(100vh - 180px)" : "420px",
          flex: isFullscreen ? 1 : "none",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "12px",
        }}>
          <span>{error}</span>
          <button
            style={{
              padding: "6px 16px", borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)",
              color: "#8b93a7", cursor: "pointer", fontSize: "12px",
              transition: "all 0.2s ease",
            }}
            onMouseDown={() => { setRange(""); setTimeout(() => setRange(activeInterval.ranges[0].key), 0); }}
            onMouseEnter={e => { e.target.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.02)"; }}
          >Retry</button>
        </div>
      )}

      {/* Chart */}
      <div
        ref={chartContainerRef}
        style={{
          width: "100%",
          height: isFullscreen ? "calc(100vh - 180px)" : "420px",
          display: loading || error ? "none" : "block",
          flex: isFullscreen ? 1 : "none",
        }}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes prediction-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(139,92,246,0.2); }
          50% { box-shadow: 0 0 20px rgba(139,92,246,0.4); }
        }
        .predict-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15)) !important;
          color: #c4b5fd !important;
          border-color: rgba(139,92,246,0.35) !important;
          box-shadow: 0 0 24px rgba(139,92,246,0.2);
          transform: translateY(-1px);
        }
        .predict-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 0 12px rgba(139,92,246,0.15);
        }
      `}</style>
    </section>
  );
});

export default CandleChart;

