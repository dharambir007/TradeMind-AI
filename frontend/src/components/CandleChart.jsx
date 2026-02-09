import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import apiClient from "../services/api";
import { getCurrencySymbol } from "../utils/formatters";

const INTERVALS = [
  { key: "1m", label: "1m", ranges: [{ key: "1d", label: "1D" }] },
  { key: "2m", label: "2m", ranges: [{ key: "1d", label: "1D" }, { key: "5d", label: "5D" }] },
  { key: "5m", label: "5m", ranges: [{ key: "1d", label: "1D" }, { key: "5d", label: "5D" }] },
  { key: "30m", label: "30m", ranges: [{ key: "5d", label: "5D" }, { key: "1mo", label: "1M" }] },
  { key: "1d", label: "1D", ranges: [{ key: "1mo", label: "1M" }, { key: "3mo", label: "3M" }, { key: "6mo", label: "6M" }, { key: "1y", label: "1Y" }, { key: "5y", label: "5Y" }] },
];

const CandleChart = ({ symbol, currency }) => {
  const chartContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interval, setInterval] = useState("1d");
  const [range, setRange] = useState("1mo");
  const [chartInfo, setChartInfo] = useState(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [wlBusy, setWlBusy] = useState(false);

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
      } catch {}
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
  const isIntraday = interval !== "1d";

  const handleIntervalChange = (newInterval) => {
    const intObj = INTERVALS.find((i) => i.key === newInterval);
    setInterval(newInterval);
    if (intObj) {
      const validRange = intObj.ranges.find((r) => r.key === range);
      if (!validRange) setRange(intObj.ranges[0].key);
    }
  };

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
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      borderVisible: false,
    });

    async function loadHistory() {
      setLoading(true);
      setError("");
      setChartInfo(null);

      try {
        const res = await apiClient.get(
          `/stocks/${encodeURIComponent(symbol)}/history`,
          { params: { range, interval } }
        );
        if (!active) return;

        const candles = res.data;

        if (Array.isArray(candles) && candles.length > 0) {
          const formatted = candles.map((c) => ({
            time: typeof c.time === "number" ? c.time : c.time,
            open: +c.open, high: +c.high, low: +c.low, close: +c.close,
          }));

          const volumes = candles.map((c) => ({
            time: typeof c.time === "number" ? c.time : c.time,
            value: c.volume || 0,
            color: +c.close >= +c.open ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          }));

          candleSeries.setData(formatted);
          volumeSeries.setData(volumes);
          chart.timeScale().fitContent();

          const last = candles[candles.length - 1];
          const lastTime = typeof last.time === "number"
            ? new Date(last.time * 1000).toLocaleString()
            : last.time;
          setChartInfo({
            lastDate: lastTime,
            lastClose: (+last.close).toFixed(2),
            dataPoints: candles.length,
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
      chart.remove();
    };
  }, [symbol, interval, range]);

  const btnStyle = (isActive) => ({
    padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
    fontWeight: isActive ? 600 : 400, border: "none", cursor: "pointer",
    background: isActive ? "rgba(0,212,255,0.08)" : "transparent",
    color: isActive ? "#00d4ff" : "#505872",
    transition: "all 0.2s ease",
  });

  const rangeBtnStyle = (isActive) => ({
    padding: "3px 8px", borderRadius: "5px", fontSize: "10px",
    fontWeight: isActive ? 600 : 400, border: "none", cursor: "pointer",
    background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
    color: isActive ? "#8b93a7" : "#3b4260",
    transition: "all 0.15s ease",
  });

  return (
    <section style={{
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.04)",
      background: "rgba(255,255,255,0.015)",
      padding: "16px",
      position: "relative",
      overflow: "hidden",
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
          <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.01em" }}>
            {symbol} Price Action
          </h4>
          {chartInfo && (
            <span style={{ fontSize: "11px", color: "#3b4260" }}>
              Last: {chartInfo.currencySymbol}{chartInfo.lastClose} · {chartInfo.lastDate} · {chartInfo.dataPoints} pts
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          {/* Interval + Watchlist */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "2px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "2px" }}>
              {INTERVALS.map((i) => (
                <button key={i.key} onClick={() => handleIntervalChange(i.key)} style={btnStyle(interval === i.key)}>
                  {i.label}
                </button>
              ))}
            </div>

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

          {/* Range buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            {activeInterval.ranges.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} style={rangeBtnStyle(range === r.key)}>
                {r.label}
              </button>
            ))}
            <span style={{ fontSize: "10px", color: "#2a3050", marginLeft: "6px", borderLeft: "1px solid rgba(255,255,255,0.04)", paddingLeft: "6px" }}>
              OHLCV
            </span>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "420px", color: "#505872", fontSize: "13px",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "8px", animation: "spin 1s linear infinite" }}>
            <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
          </svg>
          Loading chart...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          textAlign: "center", color: "#f43f5e", padding: "32px 16px", fontSize: "13px",
          height: "420px", display: "flex", flexDirection: "column",
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
          width: "100%", height: "420px",
          display: loading || error ? "none" : "block",
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
};

export default CandleChart;
