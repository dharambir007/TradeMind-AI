import { motion as Motion, AnimatePresence } from "framer-motion";
import Watchlist from "../Watchlist";
import StockHeader from "../StockHeader";
import TradingChart from "../TradingChart";
import MarketStatus from "../MarketStatus";
import AISignalsPanel from "../AISignalsPanel";
import MarketNewsPanel from "../MarketNewsPanel";
import LoadingSkeleton from "../LoadingSkeleton";
import { fadeInUp, slideInLeft, slideInRight, easeOutExpo } from "../../utils/animations";

const DesktopDashboardView = ({ symbol, stock, loading, error, usingMock, onStockClick }) => {
  return (
    <main
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 300px",
        gap: "16px",
        maxWidth: "1600px",
        margin: "0 auto",
        padding: "16px 20px",
        position: "relative",
        zIndex: 1,
        minHeight: "calc(100vh - 56px)",
      }}
    >
      <Motion.aside
        initial={slideInLeft.initial}
        animate={slideInLeft.animate}
        transition={slideInLeft.transition}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "calc(100vh - 88px)",
          position: "sticky",
          top: "72px",
          overflowY: "auto",
        }}
      >
        <Watchlist onStockClick={onStockClick} />
      </Motion.aside>

      <Motion.div
        initial={fadeInUp.initial}
        animate={fadeInUp.animate}
        transition={{ ...easeOutExpo, delay: 0.08 }}
        style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", color: "#f0f2f5" }}>Dashboard</h2>
            <div style={{ height: "1px", width: "20px", background: "rgba(255,255,255,0.08)" }} />
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: "6px",
                background: "rgba(0,212,255,0.08)",
                color: "#00d4ff",
                border: "1px solid rgba(0,212,255,0.12)",
              }}
            >
              {symbol}
            </span>
            <MarketStatus />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {loading && (
              <Motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  fontSize: "11px",
                  borderRadius: "8px",
                  background: "rgba(0,212,255,0.06)",
                  color: "#67e8f9",
                  padding: "4px 12px",
                  border: "1px solid rgba(0,212,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                </svg>
                Syncing...
              </Motion.span>
            )}
            {usingMock && (
              <span
                style={{
                  fontSize: "11px",
                  borderRadius: "8px",
                  background: "rgba(245,158,11,0.06)",
                  color: "#fcd34d",
                  padding: "4px 12px",
                  border: "1px solid rgba(245,158,11,0.1)",
                }}
              >
                Sample data
              </span>
            )}
          </div>
        </header>

        <AnimatePresence>
          {error && (
            <Motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={easeOutExpo}
              style={{
                borderRadius: "10px",
                border: "1px solid rgba(245,158,11,0.15)",
                background: "rgba(245,158,11,0.04)",
                color: "#fcd34d",
                padding: "12px 16px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </Motion.div>
          )}
        </AnimatePresence>

        {stock ? (
          <Motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...easeOutExpo, delay: 0.14 }}>
            <StockHeader stock={stock} />
          </Motion.div>
        ) : loading ? (
          <LoadingSkeleton variant="card" height="110px" />
        ) : null}

        <Motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeOutExpo, delay: 0.2 }}
          style={{ position: "relative" }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "70%",
              height: "50%",
              background: "radial-gradient(ellipse, rgba(0,212,255,0.03) 0%, transparent 70%)",
              pointerEvents: "none",
              zIndex: 0,
              filter: "blur(40px)",
            }}
          />
          <TradingChart symbol={symbol} currency={stock?.currency} />
        </Motion.div>

        <Motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.28 }}
        >
          <MarketNewsPanel />
        </Motion.div>
      </Motion.div>

      <Motion.aside
        initial={slideInRight.initial}
        animate={slideInRight.animate}
        transition={slideInRight.transition}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "calc(100vh - 88px)",
          position: "sticky",
          top: "72px",
          overflowY: "auto",
        }}
      >
        <AISignalsPanel symbol={symbol} />
      </Motion.aside>
    </main>
  );
};

export default DesktopDashboardView;
