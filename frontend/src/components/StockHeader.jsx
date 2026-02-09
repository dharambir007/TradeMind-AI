import { memo } from "react";
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
    <section style={{
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.04)",
      background: "rgba(255,255,255,0.015)",
      padding: "20px 24px",
      marginBottom: "0px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.01em" }}>{stock.name || stock.symbol}</h3>
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
          <p style={{
            fontSize: "32px", fontWeight: 800, marginTop: "4px",
            letterSpacing: "-0.03em", color: "#f0f2f5",
          }}>{formatPrice(stock.price, cur)}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "3px",
              fontSize: "13px", fontWeight: 600,
              color: isUp ? "#10b981" : "#f43f5e",
              padding: "2px 8px", borderRadius: "6px",
              background: isUp ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isUp ? "rotate(0)" : "rotate(180deg)", transition: "transform 0.3s ease" }}>
                <polyline points="18 15 12 9 6 15" />
              </svg>
              {isUp ? "+" : ""}{delta}
            </span>
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px 24px",
          fontSize: "13px",
        }}>
          {metaItems.map((item, i) => (
            <div key={i}>
              <dt style={{ color: "#3b4260", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</dt>
              <dd style={{ fontWeight: 600, color: "#8b93a7", marginTop: "2px" }}>{item.value}</dd>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export default StockHeader;
