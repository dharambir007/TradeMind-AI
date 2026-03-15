import { motion as Motion, AnimatePresence } from "framer-motion";
import StockHeader from "../StockHeader";
import Watchlist from "../Watchlist";
import TradingChart from "../TradingChart";
import AISignalsPanel from "../AISignalsPanel";
import MarketNewsPanel from "../MarketNewsPanel";
import MarketStatus from "../MarketStatus";
import MobileBottomNav from "../MobileBottomNav";
import { easeOutExpo } from "../../utils/animations";

const MobileDashboardView = ({
  symbol,
  stock,
  loading,
  error,
  mobileTab,
  onTabChange,
  onStockClick,
}) => {
  const renderMobileContent = () => {
    switch (mobileTab) {
      case "watchlist":
        return (
          <div className="animate-fade-in" style={{ padding: "0 16px" }}>
            <Watchlist onStockClick={onStockClick} />
          </div>
        );
      case "signals":
        return (
          <div className="animate-fade-in" style={{ padding: "0 16px" }}>
            <AISignalsPanel symbol={symbol} />
          </div>
        );
      case "portfolio":
        return (
          <div className="animate-fade-in" style={{ padding: "40px 16px", textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "rgba(139,92,246,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#f0f2f5" }}>Portfolio</p>
            <p style={{ fontSize: "12px", color: "#505872", marginTop: "4px" }}>Coming soon</p>
          </div>
        );
      case "news":
        return (
          <div className="animate-fade-in" style={{ padding: "0 16px" }}>
            <MarketNewsPanel />
          </div>
        );
      default:
        return (
          <>
            {stock && (
              <div className="animate-fade-in-up" style={{ padding: "0 16px" }}>
                <StockHeader stock={stock} />
              </div>
            )}
            <div className="animate-fade-in-up delay-100" style={{ padding: "0 16px", marginTop: "12px" }}>
              <TradingChart symbol={symbol} currency={stock?.currency} />
            </div>
          </>
        );
    }
  };

  return (
    <main style={{ position: "relative", zIndex: 1, paddingTop: "8px", paddingBottom: "72px" }}>
      <Motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={easeOutExpo}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em", color: "#f0f2f5" }}>
            {mobileTab === "chart"
              ? symbol
              : mobileTab === "watchlist"
              ? "Watchlist"
              : mobileTab === "signals"
              ? "AI Signals"
              : mobileTab === "news"
              ? "Market News"
              : "Portfolio"}
          </h2>
          {mobileTab === "chart" && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "5px",
                background: "rgba(0,212,255,0.08)",
                color: "#00d4ff",
                border: "1px solid rgba(0,212,255,0.12)",
              }}
            >
              {symbol}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {loading && (
            <span
              style={{
                fontSize: "11px",
                borderRadius: "6px",
                background: "rgba(0,212,255,0.06)",
                color: "#67e8f9",
                padding: "3px 10px",
                border: "1px solid rgba(0,212,255,0.1)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
              </svg>
              Syncing
            </span>
          )}
          <MarketStatus />
        </div>
      </Motion.header>

      <AnimatePresence>
        {error && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              borderRadius: "10px",
              border: "1px solid rgba(245,158,11,0.15)",
              background: "rgba(245,158,11,0.04)",
              color: "#fcd34d",
              padding: "10px 14px",
              fontSize: "12px",
              margin: "0 16px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <Motion.div
          key={mobileTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {renderMobileContent()}
        </Motion.div>
      </AnimatePresence>

      <MobileBottomNav activeTab={mobileTab} onTabChange={onTabChange} />
    </main>
  );
};

export default MobileDashboardView;
