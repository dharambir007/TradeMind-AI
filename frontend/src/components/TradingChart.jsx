import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import { useSocket } from "../hooks/useSocket";
import stockService from "../services/stockService";
import { WAKEUP_MESSAGE } from "../utils/apiUrl";
import { getCurrencySymbol } from "../utils/formatters";
import {
  DEFAULT_TRADING_TIMEFRAME,
  TIMEFRAME_PRESETS,
  buildVolumePoint,
  formatAxisTime,
  formatVolume,
  getLiveCandleTime,
  getTimeframePreset,
  transformMarketDataToCandles,
  transformPredictionToCandles,
} from "../utils/chartTransforms";
import {
  getTimeframeIntervalMinutes,
  mergeTickIntoCandles,
  normalizeTickTimestampMs,
  sortAndDeduplicateCandles,
} from "../utils/liveCandles";

const CHART_HEIGHT = 460;
const ERROR_MESSAGE = "Market data temporarily unavailable";
const PREDICTION_ERROR_MESSAGE = "Failed to generate timeframe chart prediction";
const PREDICTION_TIMEFRAME_OPTIONS = ["3m", "5m", "10m"];
const DARK_SURFACE = "rgba(6, 12, 24, 0.9)";
const DARK_BORDER = "rgba(73, 95, 132, 0.22)";
const ACCENT_BLUE = "#58d8ff";
const ACCENT_GREEN = "#16d6a1";
const ACCENT_RED = "#ff4d57";
const GHOST_UP = "rgba(22, 214, 161, 0.28)";
const GHOST_DOWN = "rgba(255, 77, 87, 0.28)";
const GHOST_UP_WICK = "rgba(22, 214, 161, 0.82)";
const GHOST_DOWN_WICK = "rgba(255, 77, 87, 0.82)";
const TRACKED_LIVE_TIMEFRAMES = Object.freeze(["1m", "5m"]);

function addCandlestickSeries(chart, options) {
  if (typeof chart.addCandlestickSeries === "function") {
    return chart.addCandlestickSeries(options);
  }
  return chart.addSeries(CandlestickSeries, options);
}

function addHistogramSeries(chart, options) {
  if (typeof chart.addHistogramSeries === "function") {
    return chart.addHistogramSeries(options);
  }
  return chart.addSeries(HistogramSeries, options);
}

function captureVisibleRange(chart) {
  try {
    return chart?.timeScale()?.getVisibleLogicalRange?.() ?? null;
  } catch {
    return null;
  }
}

function restoreVisibleRange(chart, logicalRange) {
  const timeScale = chart?.timeScale?.();
  if (!timeScale) return;

  requestAnimationFrame(() => {
    try {
      if (logicalRange && typeof timeScale.setVisibleLogicalRange === "function") {
        timeScale.setVisibleLogicalRange(logicalRange);
      } else {
        timeScale.fitContent();
      }
    } catch {
      try {
        timeScale.fitContent();
      } catch {
        // no-op
      }
    }
  });
}

function formatPrice(value, currencySymbol) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return `${currencySymbol}${numeric.toFixed(2)}`;
}

function formatSignedPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function toComparableTime(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }

  if (value && typeof value === "object") {
    const year = Number(value.year);
    const month = Number(value.month);
    const day = Number(value.day);
    if ([year, month, day].every(Number.isFinite)) {
      return Math.floor(Date.UTC(year, month - 1, day) / 1000);
    }
  }

  return null;
}

function createTimeframeCandleStore() {
  return {
    candles1m: [],
    candles5m: [],
    byTimeframe: {},
  };
}

function getTimeframeStoreKey(timeframe) {
  if (timeframe === "1m") return "candles1m";
  if (timeframe === "5m") return "candles5m";
  return timeframe;
}

function readTimeframeCandles(store, timeframe) {
  const key = getTimeframeStoreKey(timeframe);
  if (key === "candles1m" || key === "candles5m") {
    return Array.isArray(store[key]) ? store[key] : [];
  }
  return Array.isArray(store.byTimeframe[key]) ? store.byTimeframe[key] : [];
}

function writeTimeframeCandles(store, timeframe, candles) {
  const nextCandles = sortAndDeduplicateCandles(candles);
  const key = getTimeframeStoreKey(timeframe);

  if (key === "candles1m" || key === "candles5m") {
    store[key] = nextCandles;
    return nextCandles;
  }

  store.byTimeframe[key] = nextCandles;
  return nextCandles;
}

function resetTimeframeCandleStore(store) {
  store.candles1m = [];
  store.candles5m = [];
  store.byTimeframe = {};
}

function getTrackedTimeframes(activeTimeframe) {
  return Array.from(new Set([...TRACKED_LIVE_TIMEFRAMES, activeTimeframe]));
}

const IST_TZ = "Asia/Kolkata";

function formatInfoTime(unixTime, timeframe) {
  if (!Number.isFinite(Number(unixTime))) return "--";
  const date = new Date(Number(unixTime) * 1000);
  if (!Number.isFinite(date.getTime())) return "--";
  // Force IST for both the time part and the date part
  const datePart = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: IST_TZ,
  });
  return `${formatAxisTime(unixTime, timeframe)} | ${datePart}`;
}

function updateTooltipContent({
  container,
  point,
  candle,
  volume,
  currencySymbol,
  timeframe,
}) {
  if (!container) return;

  if (!point || !candle) {
    container.style.opacity = "0";
    return;
  }

  const timeLabel = formatAxisTime(candle.time, timeframe);
  const volumeValue = Number(volume?.value ?? candle.volume ?? 0);

  container.innerHTML = `
    <div style="font-size:11px;color:#7b8ba7;margin-bottom:6px;">${timeLabel}</div>
    <div style="display:grid;grid-template-columns:auto auto;gap:4px 12px;">
      <span style="color:#7b8ba7;">O</span><span>${formatPrice(candle.open, currencySymbol)}</span>
      <span style="color:#7b8ba7;">H</span><span>${formatPrice(candle.high, currencySymbol)}</span>
      <span style="color:#7b8ba7;">L</span><span>${formatPrice(candle.low, currencySymbol)}</span>
      <span style="color:#7b8ba7;">C</span><span>${formatPrice(candle.close, currencySymbol)}</span>
      <span style="color:#7b8ba7;">Vol</span><span>${formatVolume(volumeValue)}</span>
    </div>
  `;

  const parentWidth = container.parentElement?.clientWidth || 0;
  const left = Math.max(12, Math.min(point.x + 16, parentWidth - 180));
  const top = Math.max(12, point.y + 12);

  container.style.transform = `translate(${left}px, ${top}px)`;
  container.style.opacity = "1";
}

function ToolbarButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: "10px",
        padding: "7px 10px",
        background: active ? "rgba(0, 212, 255, 0.14)" : "transparent",
        color: active ? ACCENT_BLUE : "#7b8ba7",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const TradingChart = memo(function TradingChart({ symbol, currency = "INR" }) {
  const sectionRef = useRef(null);
  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const predictionSeriesRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const tooltipRef = useRef(null);
  const requestIdRef = useRef(0);
  const pendingRangeRef = useRef(null);
  const candlesRef = useRef([]);
  const candleStoreRef = useRef(createTimeframeCandleStore());
  const lastCandleRef = useRef(null);
  const prevCloseRef = useRef(null);  // previous day close — denominator for change %
  const liveChangeRef = useRef(null);       // tick-provided absolute change vs prev close
  const liveChangePctRef = useRef(null);    // tick-provided change percent vs prev close
  const timeframeRef = useRef(DEFAULT_TRADING_TIMEFRAME);

  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);
  const [timeframe, setTimeframe] = useState(DEFAULT_TRADING_TIMEFRAME);
  const [predictionTimeframe, setPredictionTimeframe] = useState(
    getTimeframePreset(DEFAULT_TRADING_TIMEFRAME).predictionTimeframe
  );
  const [loading, setLoading] = useState(true);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [error, setError] = useState("");
  const [predictionError, setPredictionError] = useState("");
  const [lastPrice, setLastPrice] = useState(null);
  const [prevClose, setPrevClose] = useState(null);        // previous day close price
  const [liveChange, setLiveChange] = useState(null);      // tick-sourced absolute change
  const [liveChangePct, setLiveChangePct] = useState(null);// tick-sourced change percent
  const [lastCandleTime, setLastCandleTime] = useState(null);
  const [predictionMeta, setPredictionMeta] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { tick, live } = useSocket(symbol);

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  useEffect(() => {
    setPredictionTimeframe(getTimeframePreset(timeframe).predictionTimeframe);
  }, [timeframe]);

  useEffect(() => {
    const container = chartHostRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || CHART_HEIGHT,
      layout: {
        background: { type: "solid", color: "#050b17" },
        textColor: "#63748f",
        fontFamily: "'Segoe UI', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(29, 44, 70, 0.28)" },
        horzLines: { color: "rgba(29, 44, 70, 0.28)" },
      },
      rightPriceScale: {
        borderColor: "rgba(73, 95, 132, 0.2)",
        autoScale: true,
        scaleMargins: { top: 0.12, bottom: 0.24 },
      },
      timeScale: {
        borderColor: "rgba(73, 95, 132, 0.2)",
        rightOffset: 8,
        barSpacing: 10,
        minBarSpacing: 4,
        lockVisibleTimeRangeOnResize: false,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(88, 216, 255, 0.22)",
          width: 1,
          style: 2,
          labelBackgroundColor: ACCENT_GREEN,
        },
        horzLine: {
          color: "rgba(88, 216, 255, 0.22)",
          width: 1,
          style: 2,
          labelBackgroundColor: ACCENT_GREEN,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries = addCandlestickSeries(chart, {
      upColor: ACCENT_GREEN,
      downColor: ACCENT_RED,
      borderUpColor: ACCENT_GREEN,
      borderDownColor: ACCENT_RED,
      wickUpColor: ACCENT_GREEN,
      wickDownColor: ACCENT_RED,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: ACCENT_GREEN,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    const volumeSeries = addHistogramSeries(chart, {
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: { type: "volume" },
    });

    const predictionSeries = addCandlestickSeries(chart, {
      upColor: GHOST_UP,
      downColor: GHOST_DOWN,
      borderUpColor: GHOST_UP_WICK,
      borderDownColor: GHOST_DOWN_WICK,
      wickUpColor: GHOST_UP_WICK,
      wickDownColor: GHOST_DOWN_WICK,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });
    predictionSeries.setData([]);

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    });

    const onCrosshairMove = (param) => {
      const candleData =
        param?.seriesData?.get?.(candleSeries) ??
        param?.seriesData?.get?.(predictionSeries) ??
        null;
      const volumeData = param?.seriesData?.get?.(volumeSeries) ?? null;
      updateTooltipContent({
        container: tooltipRef.current,
        point: param?.point,
        candle: candleData,
        volume: volumeData,
        currencySymbol,
        timeframe: timeframeRef.current,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    if (typeof ResizeObserver === "function") {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (!width || !height) return;
        chart.applyOptions({ width, height });
      });
      resizeObserverRef.current.observe(container);
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    predictionSeriesRef.current = predictionSeries;

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
      predictionSeriesRef.current = null;
      volumeSeriesRef.current = null;
      candleSeriesRef.current = null;
      chartRef.current = null;
      resetTimeframeCandleStore(candleStoreRef.current);
      candlesRef.current = [];
      lastCandleRef.current = null;
      chart.remove();
    };
  }, [currencySymbol]);

  useEffect(() => {
    pendingRangeRef.current = null;
    resetTimeframeCandleStore(candleStoreRef.current);
    candlesRef.current = [];
    lastCandleRef.current = null;
  }, [symbol]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const preset = getTimeframePreset(timeframe);
    chart.applyOptions({
      timeScale: {
        timeVisible: preset.intraday,
        secondsVisible: false,
        tickMarkFormatter: (time) => formatAxisTime(time, timeframeRef.current),
      },
      localization: {
        timeFormatter: (time) => formatAxisTime(time, timeframeRef.current),
      },
    });
  }, [timeframe]);

  useEffect(() => {
    if (!symbol || !chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    let disposed = false;

    async function loadChartData() {
      const currentRequestId = requestIdRef.current + 1;
      requestIdRef.current = currentRequestId;

      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      const volumeSeries = volumeSeriesRef.current;
      const predictionSeries = predictionSeriesRef.current;
      const preset = getTimeframePreset(timeframe);
      const preservedRange = pendingRangeRef.current ?? captureVisibleRange(chart);
      pendingRangeRef.current = null;

      setLoading(true);
      setError("");
      setPredictionError("");

      try {
        const marketPayload = await stockService.getTradingChart(symbol, {
          range: preset.range,
          interval: preset.apiInterval,
        });

        if (import.meta.env.DEV) {
          const rawCandles = Array.isArray(marketPayload)
            ? marketPayload
            : Array.isArray(marketPayload?.candles)
              ? marketPayload.candles
              : Array.isArray(marketPayload?.history)
                ? marketPayload.history
                : [];
          console.debug("[TradingChart] load raw timestamps", {
            symbol,
            timeframe,
            count: rawCandles.length,
            sample: rawCandles.slice(0, 5).map((item) => item?.time ?? item?.timestamp ?? null),
          });
        }

        if (disposed || requestIdRef.current !== currentRequestId) {
          return;
        }

        const candles = transformMarketDataToCandles(marketPayload, timeframe);
        if (!candles.length) {
          throw new Error("No chart data");
        }

        const cachedCandles = readTimeframeCandles(candleStoreRef.current, timeframe);
        const mergedCandles = writeTimeframeCandles(candleStoreRef.current, timeframe, [
          ...cachedCandles,
          ...candles,
        ]);

        candleSeries.setData(mergedCandles);
        volumeSeries.setData(mergedCandles.map(buildVolumePoint));
        predictionSeries?.setData([]);

        // Resolve previous close: prefer meta value, fall back to first candle open
        const prevCloseValue = Number(
          marketPayload?.prevClose ??
          marketPayload?.meta?.chartPreviousClose ??
          marketPayload?.meta?.previousClose ??
          mergedCandles[0]?.open ??
          0
        );

        candlesRef.current = mergedCandles;
        lastCandleRef.current = mergedCandles[mergedCandles.length - 1];
        prevCloseRef.current = Number.isFinite(prevCloseValue) && prevCloseValue > 0 ? prevCloseValue : null;
        liveChangeRef.current = null;
        liveChangePctRef.current = null;

        const lastClose = mergedCandles[mergedCandles.length - 1].close;
        const computedChange = prevCloseRef.current ? lastClose - prevCloseRef.current : null;
        const computedChangePct = prevCloseRef.current && prevCloseRef.current !== 0
          ? (computedChange / prevCloseRef.current) * 100
          : null;

        setLastPrice(lastClose);
        setPrevClose(prevCloseRef.current);
        setLiveChange(computedChange);
        setLiveChangePct(computedChangePct);
        setLastCandleTime(mergedCandles[mergedCandles.length - 1]?.time ?? null);
        setPredictionMeta(null);
        setPredictionLoading(false);

        restoreVisibleRange(chart, preservedRange);
      } catch {
        if (disposed || requestIdRef.current !== currentRequestId) {
          return;
        }

        candleSeries.setData([]);
        volumeSeries.setData([]);
        predictionSeries?.setData([]);
        writeTimeframeCandles(candleStoreRef.current, timeframe, []);
        candlesRef.current = [];
        lastCandleRef.current = null;
        prevCloseRef.current = null;
        liveChangeRef.current = null;
        liveChangePctRef.current = null;
        setPredictionMeta(null);
        setLastPrice(null);
        setPrevClose(null);
        setLiveChange(null);
        setLiveChangePct(null);
        setLastCandleTime(null);
        setError(ERROR_MESSAGE);
      } finally {
        if (!disposed && requestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    }

    loadChartData();

    return () => {
      disposed = true;
    };
  }, [symbol, timeframe, reloadKey]);

  useEffect(() => {
    if (!symbol || !candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    if (live) {
      return undefined;
    }

    let active = true;

    const refresh = async () => {
      const preset = getTimeframePreset(timeframeRef.current);

      try {
        const marketPayload = await stockService.getTradingChart(symbol, {
          range: preset.range,
          interval: preset.apiInterval,
        });
        if (!active) return;

        const refreshed = transformMarketDataToCandles(marketPayload, timeframeRef.current);
        if (!refreshed.length) return;

        if (import.meta.env.DEV) {
          const rawCandles = Array.isArray(marketPayload)
            ? marketPayload
            : Array.isArray(marketPayload?.candles)
              ? marketPayload.candles
              : Array.isArray(marketPayload?.history)
                ? marketPayload.history
                : [];
          console.debug("[TradingChart] poll raw timestamps", {
            symbol,
            timeframe: timeframeRef.current,
            count: rawCandles.length,
            sample: rawCandles.slice(0, 5).map((item) => item?.time ?? item?.timestamp ?? null),
          });
        }

        const merged = writeTimeframeCandles(candleStoreRef.current, timeframeRef.current, [
          ...readTimeframeCandles(candleStoreRef.current, timeframeRef.current),
          ...refreshed,
        ]);

        if (!merged.length) return;

        candleSeriesRef.current.setData(merged);
        volumeSeriesRef.current.setData(merged.map(buildVolumePoint));
        candlesRef.current = merged;
        lastCandleRef.current = merged[merged.length - 1];

        const lastClose = merged[merged.length - 1].close;
        setLastPrice(lastClose);
        setLastCandleTime(merged[merged.length - 1].time);
      } catch {
        // silent polling retry
      }
    };

    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [symbol, timeframe, live]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    requestAnimationFrame(() => {
      try {
        chart.timeScale().fitContent();
      } catch {
        // no-op
      }
    });
  }, [isFullscreen]);

  useEffect(() => {
    if (!tick || !candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    const price = Number(tick.price);
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }

    // Normalize tick time: Yahoo WS sends Unix seconds; polling sends Date.now() (ms)
    const timestampMs = normalizeTickTimestampMs(tick.time);
    const tickVolume = Number(tick.volume);
    const activeTimeframe = timeframeRef.current;
    const activeIntervalMinutes = getTimeframeIntervalMinutes(activeTimeframe);
    const trackedTimeframes = getTrackedTimeframes(activeTimeframe);

    let activeUpdate = null;

    for (const trackedTimeframe of trackedTimeframes) {
      const intervalMinutes = getTimeframeIntervalMinutes(trackedTimeframe);
      if (!Number.isFinite(intervalMinutes)) {
        continue;
      }

      const merged = mergeTickIntoCandles({
        candles: readTimeframeCandles(candleStoreRef.current, trackedTimeframe),
        price,
        timestampMs,
        intervalMinutes,
        intervalLabel: trackedTimeframe,
        volume: tickVolume,
        enableLogs: trackedTimeframe === activeTimeframe,
      });

      if (!merged.ignored) {
        writeTimeframeCandles(candleStoreRef.current, trackedTimeframe, merged.candles);
      }

      if (trackedTimeframe === activeTimeframe) {
        activeUpdate = merged;
      }
    }

    let nextRealtimeCandle = activeUpdate?.latestCandle ?? null;
    let activeCandles = Number.isFinite(activeIntervalMinutes)
      ? readTimeframeCandles(candleStoreRef.current, activeTimeframe)
      : candlesRef.current;

    if (!Number.isFinite(activeIntervalMinutes)) {
      const tickTimeSeconds = Math.floor(timestampMs / 1000);
      const candleTime = getLiveCandleTime(tickTimeSeconds, activeTimeframe);
      if (!Number.isFinite(candleTime)) {
        return;
      }

      const latest = lastCandleRef.current;
      const latestTime = toComparableTime(latest?.time);
      if (Number.isFinite(latestTime) && candleTime < latestTime) {
        return;
      }

      if (latest && latest.time === candleTime) {
        nextRealtimeCandle = {
          ...latest,
          high: Math.max(latest.high, price),
          low: Math.min(latest.low, price),
          close: price,
          volume: Number.isFinite(tickVolume)
            ? Math.max(latest.volume || 0, tickVolume)
            : latest.volume || 0,
        };
        activeCandles = [...candlesRef.current.slice(0, -1), nextRealtimeCandle];
      } else {
        nextRealtimeCandle = {
          time: candleTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: Number.isFinite(tickVolume) ? Math.max(0, tickVolume) : 0,
        };
        activeCandles = [...candlesRef.current, nextRealtimeCandle];
      }
    }

    if (!nextRealtimeCandle || activeUpdate?.ignored) {
      return;
    }

    const latestRealtime = lastCandleRef.current;
    const latestRealtimeTime = toComparableTime(latestRealtime?.time);
    if (Number.isFinite(latestRealtimeTime) && nextRealtimeCandle.time < latestRealtimeTime) {
      return;
    }

    candlesRef.current = activeCandles;
    lastCandleRef.current = nextRealtimeCandle;

    if (activeUpdate?.changed !== false || !Number.isFinite(activeIntervalMinutes)) {
      try {
        candleSeriesRef.current.update(nextRealtimeCandle);
        volumeSeriesRef.current.update(buildVolumePoint(nextRealtimeCandle));
      } catch {
        try {
          candleSeriesRef.current.setData(activeCandles);
          volumeSeriesRef.current.setData(activeCandles.map(buildVolumePoint));
        } catch {
          return;
        }
      }
    }

    const tickChange = Number(tick.change);
    const tickChangePct = Number(tick.changePercent);
    const prevCloseVal = prevCloseRef.current;

    if (Number.isFinite(tickChange) && Number.isFinite(tickChangePct)) {
      liveChangeRef.current = tickChange;
      liveChangePctRef.current = tickChangePct;
      setLiveChange(tickChange);
      setLiveChangePct(tickChangePct);
    } else if (prevCloseVal && prevCloseVal > 0) {
      const computedChg = price - prevCloseVal;
      const computedChgPct = (computedChg / prevCloseVal) * 100;
      liveChangeRef.current = computedChg;
      liveChangePctRef.current = computedChgPct;
      setLiveChange(computedChg);
      setLiveChangePct(computedChgPct);
    }

    setLastPrice(price);
    setLastCandleTime(nextRealtimeCandle.time);
    return;
  }, [tick]);

  const timeframeButtons = useMemo(() => Object.values(TIMEFRAME_PRESETS), []);
  const chartHeight = isFullscreen ? "calc(100vh - 170px)" : `${CHART_HEIGHT}px`;

  // Use tick-native change % (vs prev close). Fall back to computing from prevClose state.
  const changePercent = Number.isFinite(liveChangePct)
    ? liveChangePct
    : Number.isFinite(lastPrice) && Number.isFinite(prevClose) && prevClose > 0
      ? ((lastPrice - prevClose) / prevClose) * 100
      : null;
  const changePoints = Number.isFinite(liveChange)
    ? liveChange
    : Number.isFinite(lastPrice) && Number.isFinite(prevClose) && prevClose > 0
      ? lastPrice - prevClose
      : null;
  const changeColor = !Number.isFinite(changePercent)
    ? "#7b8ba7"
    : changePercent >= 0
      ? ACCENT_GREEN
      : ACCENT_RED;

  const runPrediction = async () => {
    if (!symbol || predictionLoading || !predictionSeriesRef.current) return;

    const chart = chartRef.current;
    const visibleRange = captureVisibleRange(chart);
    setPredictionLoading(true);
    setPredictionError("");

    try {
      const payload = await stockService.getChartPrediction(symbol, {
        timeframe: predictionTimeframe,
        steps: 4,
      });

      if (payload && payload.success === false) {
        throw new Error(payload.message || "Prediction unavailable");
      }

      const predictionCandles = transformPredictionToCandles(payload, predictionTimeframe);
      predictionSeriesRef.current.setData(predictionCandles);
      setPredictionMeta(payload?.predictionMeta ?? null);
      restoreVisibleRange(chart, visibleRange);
    } catch (error) {
      predictionSeriesRef.current.setData([]);
      setPredictionMeta(null);
      const backendMessage = String(error?.response?.data?.message || "").trim();
      const thrownMessage = String(error?.message || "").trim();
      setPredictionError(
        error?.userMessage ||
          backendMessage ||
          thrownMessage ||
          WAKEUP_MESSAGE ||
          PREDICTION_ERROR_MESSAGE
      );
    } finally {
      setPredictionLoading(false);
    }
  };

  const clearPrediction = () => {
    predictionSeriesRef.current?.setData([]);
    setPredictionMeta(null);
    setPredictionError("");
  };

  const toggleFullscreen = async () => {
    const section = sectionRef.current;
    if (!section) return;

    try {
      if (!document.fullscreenElement) {
        await section.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // no-op
    }
  };

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${DARK_BORDER}`,
        background: "linear-gradient(180deg, rgba(4, 10, 22, 0.98), rgba(2, 6, 16, 0.98))",
        borderRadius: isFullscreen ? "0" : "24px",
        padding: isFullscreen ? "20px" : "18px",
        boxShadow: isFullscreen ? "none" : "0 28px 80px rgba(0, 0, 0, 0.42)",
        minHeight: isFullscreen ? "100vh" : "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(11, 21, 40, 0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(11, 21, 40, 0.35) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.38,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "14%",
          width: "46%",
          height: "36%",
          pointerEvents: "none",
          background: "radial-gradient(circle, rgba(0, 212, 255, 0.11), transparent 70%)",
          filter: "blur(42px)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "6px",
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#eef2ff",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              {symbol} Price Action
            </h3>
            {live && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "8px",
                  background: "rgba(22, 214, 161, 0.08)",
                  border: "1px solid rgba(22, 214, 161, 0.16)",
                  color: ACCENT_GREEN,
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: ACCENT_GREEN,
                    boxShadow: "0 0 10px rgba(22, 214, 161, 0.5)",
                  }}
                />
                LIVE
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              color: "#556581",
              fontSize: "13px",
            }}
          >
            <span>Last: {formatPrice(lastPrice, currencySymbol)}</span>
            <span style={{ color: changeColor, fontWeight: 700 }}>
              {Number.isFinite(changePoints)
                ? `${changePoints >= 0 ? "+" : ""}${changePoints.toFixed(2)} (${formatSignedPercent(changePercent)})`
                : "--"}
            </span>
            <span>{formatInfoTime(lastCandleTime, timeframe)}</span>
            <span style={{ color: "#3d4f69" }}>{candlesRef.current.length} bars</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "6px",
              padding: "5px",
              borderRadius: "14px",
              background: DARK_SURFACE,
              border: `1px solid ${DARK_BORDER}`,
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
            }}
          >
            {timeframeButtons.map((item) => {
              const active = item.key === timeframe;
              return (
                <ToolbarButton
                  key={item.key}
                  active={active}
                  onClick={() => {
                    if (item.key === timeframe) return;
                    pendingRangeRef.current = captureVisibleRange(chartRef.current);
                    setTimeframe(item.key);
                  }}
                >
                  {item.label}
                </ToolbarButton>
              );
            })}
          </div>

          <select
            value={predictionTimeframe}
            onChange={(event) => setPredictionTimeframe(event.target.value)}
            style={{
              border: "1px solid rgba(124, 92, 255, 0.26)",
              borderRadius: "12px",
              padding: "10px 12px",
              background: "rgba(24, 16, 44, 0.92)",
              color: "#d8cdff",
              fontSize: "12px",
              fontWeight: 700,
              outline: "none",
            }}
          >
            {PREDICTION_TIMEFRAME_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
                style={{ background: "#140f26", color: "#d8cdff" }}
              >
                {option.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={runPrediction}
            disabled={predictionLoading || loading}
            style={{
              border: "1px solid rgba(124, 92, 255, 0.26)",
              borderRadius: "12px",
              padding: "10px 14px",
              background: predictionLoading || loading
                ? "rgba(52, 40, 88, 0.92)"
                : "linear-gradient(135deg, rgba(86, 64, 176, 0.98), rgba(124, 92, 255, 0.98))",
              color: "#f7f4ff",
              fontSize: "12px",
              fontWeight: 700,
              cursor: predictionLoading || loading ? "wait" : "pointer",
              boxShadow: predictionLoading || loading
                ? "none"
                : "0 10px 28px rgba(124, 92, 255, 0.28)",
            }}
          >
            {predictionLoading ? "Predicting..." : "Predict"}
          </button>

          <button
            type="button"
            onClick={clearPrediction}
            style={{
              border: `1px solid ${DARK_BORDER}`,
              borderRadius: "12px",
              padding: "10px 14px",
              background: DARK_SURFACE,
              color: "#7f8ba6",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              border: `1px solid ${DARK_BORDER}`,
              borderRadius: "12px",
              padding: "10px 14px",
              background: DARK_SURFACE,
              color: "#dce5fa",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {predictionError && !error && (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
            padding: "10px 14px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 77, 87, 0.2)",
            background: "rgba(58, 16, 25, 0.76)",
            color: "#ff8c93",
            fontSize: "13px",
          }}
        >
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              border: "2px solid currentColor",
              boxSizing: "border-box",
            }}
          />
          {predictionError}
        </div>
      )}

      {predictionMeta && !error && (
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "14px",
            border: "1px solid rgba(124, 92, 255, 0.2)",
            background: "linear-gradient(135deg, rgba(25, 17, 45, 0.88), rgba(8, 12, 24, 0.92))",
            color: "#b7c2d8",
            fontSize: "12px",
          }}
        >
          <span>Forecast {predictionMeta.direction || "--"}</span>
          <span>Confidence {Number(predictionMeta.confidence || 0).toFixed(1)}%</span>
          <span>Target {formatPrice(predictionMeta.targetPrice, currencySymbol)}</span>
          <span>Latency {Number(predictionMeta.processingTimeMs || 0).toFixed(0)}ms</span>
        </div>
      )}

      <div
        style={{
          position: "relative",
          minHeight: chartHeight,
          borderRadius: "18px",
          overflow: "hidden",
          border: `1px solid ${DARK_BORDER}`,
          background: "linear-gradient(180deg, #060c18, #050914)",
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
        }}
      >
        <div
          ref={chartHostRef}
          style={{
            width: "100%",
            height: chartHeight,
          }}
        />

        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
            minWidth: "160px",
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(79, 102, 144, 0.3)",
            background: "rgba(4, 10, 22, 0.96)",
            color: "#dce5fa",
            fontSize: "12px",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.42)",
            backdropFilter: "blur(8px)",
            transition: "opacity 120ms ease",
          }}
        />

        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(4, 10, 22, 0.82)",
              color: "#a6b4cf",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Loading market data...
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              background: "rgba(4, 10, 22, 0.94)",
              color: "#ff8c93",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                pendingRangeRef.current = null;
                setReloadKey((current) => current + 1);
              }}
              style={{
                border: "1px solid rgba(255, 77, 87, 0.18)",
                borderRadius: "10px",
                padding: "8px 12px",
                background: "rgba(58, 16, 25, 0.76)",
                color: "#ff8c93",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

export default TradingChart;
