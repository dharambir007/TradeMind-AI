import { memo } from "react";
import { motion as Motion } from "framer-motion";
import { getCurrencySymbol, formatPrice } from "../utils/formatters";

const StockHeader = memo(({ stock }) => {
  const isUp = Number(stock.change) >= 0 || Number(stock.changePercent) >= 0;
  const delta = `${stock.change ?? 0} (${stock.changePercent ?? 0}%)`;
  const cur = stock.currency || "USD";
  const sym = getCurrencySymbol(cur);

  const metaItems = [
    { label: "Market Cap", value: stock.marketCap || "-" },
    { label: "Volume", value: stock.volume || "-" },
    { label: "Day Range", value: stock.low && stock.high ? `${sym}${stock.low} – ${sym}${stock.high}` : "-" },
    { label: "Prev Close", value: stock.prevClose ? `${sym}${stock.prevClose}` : "-" },
  ];

  return (
    <Motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        borderRadius: "14px",
        border: `1px solid ${isUp ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)"}`,
        background: "rgba(255,255,255,0.015)",
        padding: "20px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
        background: isUp
          ? "linear-gradient(90deg, transparent, rgba(16,185,129,0.2), transparent)"
          : "linear-gradient(90deg, transparent, rgba(244,63,94,0.2), transparent)",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.02em" }}>{stock.name || stock.symbol}</h3>
            <span style={{
              fontSize: "12px", fontWeight: 600, color: "#505872",
              padding: "2px 8px", borderRadius: "5px",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
            }}>{stock.symbol}</span>
            <span style={{
              fontSize: "10px", fontWeight: 600, color: "#3b4260",
              padding: "2px 6px", borderRadius: "4px",
              background: "rgba(255,255,255,0.02)",
            }}>{cur}</span>
          </div>

          {/* Price with animated flash */}
          <Motion.p
            key={stock.price}
            initial={{ opacity: 0.7, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: "34px", fontWeight: 800, marginTop: "2px",
              letterSpacing: "-0.04em", color: "#f0f2f5",
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            {formatPrice(stock.price, cur)}
          </Motion.p>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
            <Motion.span
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "13px", fontWeight: 600,
                color: isUp ? "#10b981" : "#f43f5e",
                padding: "3px 10px", borderRadius: "6px",
                background: isUp ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
                border: `1px solid ${isUp ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)"}`,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isUp ? "rotate(0)" : "rotate(180deg)", transition: "transform 0.3s ease" }}>
                <polyline points="18 15 12 9 6 15" />
              </svg>
              {isUp ? "+" : ""}{delta}
            </Motion.span>
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px 28px",
          fontSize: "13px",
        }}>
          {metaItems.map((item, i) => (
            <Motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <dt style={{ color: "#3b4260", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</dt>
              <dd style={{ fontWeight: 600, color: "#8b93a7", marginTop: "3px", fontFeatureSettings: '"tnum" 1' }}>{item.value}</dd>
            </Motion.div>
          ))}
        </div>
      </div>
    </Motion.section>
  );
});

export default StockHeader;
