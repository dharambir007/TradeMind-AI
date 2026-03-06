import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import CandleChart from "../components/CandleChart";
import StockHeader from "../components/StockHeader";
import Watchlist from "../components/Watchlist";
import MarketStatus from "../components/MarketStatus";
import AISignalsPanel from "../components/AISignalsPanel";
import MarketNewsPanel from "../components/MarketNewsPanel";
import MobileBottomNav from "../components/MobileBottomNav";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { fadeInUp, slideInLeft, slideInRight, easeOutExpo } from "../utils/animations";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 8000,
});

const MOCK_STOCK_BASE = {
  symbol: "RELIANCE",
  name: "Sample Stock",
  price: 2945.30,
  change: 18.75,
  changePercent: 0.64,
  marketCap: "19.92L Cr",
  volume: "1.12Cr",
  currency: "INR",
};

const UserDashboard = () => {
  const { symbol: routeSymbol } = useParams();
  const navigate = useNavigate();

  const symbol = useMemo(() => {
    const raw = String(routeSymbol || "").trim();
    if (!raw) return "RELIANCE";
    try {
      return decodeURIComponent(raw).toUpperCase();
    } catch (_) {
      return raw.toUpperCase();
    }
  }, [routeSymbol]);

  const buildFallbackStock = useCallback((targetSymbol) => ({
    ...MOCK_STOCK_BASE,
    symbol: targetSymbol,
    name: `${targetSymbol} (Sample Data)`,
  }), []);

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingMock, setUsingMock] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Mobile state
  const [mobileTab, setMobileTab] = useState("chart");
  const [isMobile, setIsMobile] = useState(false);

  // Responsive detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch stock data
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const stockRes = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}`, {
          signal: controller.signal,
        });
        const fetchedStock = stockRes?.data;
        const hasStock =
          fetchedStock &&
          fetchedStock.success !== false &&
          Number.isFinite(Number(fetchedStock.price));
        if (!active) return;

        if (hasStock) {
          setStock(fetchedStock);
          setUsingMock(false);
        } else {
          setStock(buildFallbackStock(symbol));
          setUsingMock(true);
        }
        setError("");
      } catch (err) {
        if (!active || err?.name === "CanceledError" || axios.isCancel(err)) return;
        console.error("Failed to load live data", err);
        setError("Live data unavailable. Showing sample data.");
        setStock(buildFallbackStock(symbol));
        setUsingMock(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; controller.abort(); };
  }, [symbol, buildFallbackStock]);

  const handleStockClick = useCallback((sym) => {
    navigate(`/dashboard/${encodeURIComponent(sym)}`);
    if (isMobile) setMobileTab("chart");
  }, [navigate, isMobile]);

  // Mobile tab content rendering
  const renderMobileContent = () => {
    switch (mobileTab) {
      case "watchlist":
        return (
          <div className="animate-fade-in" style={{ padding: "0 16px" }}>
            <Watchlist onStockClick={handleStockClick} />
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
          <div className="animate-fade-in" style={{
            padding: "40px 16px", textAlign: "center",
          }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "14px",
              background: "rgba(139,92,246,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
            }}>
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
      default: // chart
        return (
          <>
            {stock && (
              <div className="animate-fade-in-up" style={{ padding: "0 16px" }}>
                <StockHeader stock={stock} />
              </div>
            )}
            <div className="animate-fade-in-up delay-100" style={{ padding: "0 16px", marginTop: "12px" }}>
              <CandleChart symbol={symbol} currency={stock?.currency} />
            </div>
          </>
        );
    }
  };

  return (
    <div style={{
      backgroundColor: "#05070e", minHeight: "100vh", color: "#f0f2f5", position: "relative",
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.006) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.006) 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
      }} />
      {/* Ambient glow top */}
      <div style={{
        position: "fixed", top: "-120px", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "320px", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse, rgba(0,212,255,0.04) 0%, transparent 70%)",
        filter: "blur(60px)",
      }} />

      <Navbar />

      {/* Settings FAB */}
      <motion.button
        onClick={() => setSettingsOpen(true)}
        whileHover={{ y: -2, scale: 1.06, boxShadow: "0 12px 40px rgba(99,102,241,0.4)" }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: "fixed", bottom: isMobile ? "76px" : "24px", right: "24px",
          width: "44px", height: "44px", borderRadius: "12px",
          background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff", cursor: "pointer",
          boxShadow: "0 8px 30px rgba(99,102,241,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 30,
        }}
        title="Settings"
      >
        <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </motion.button>

      <Sidebar isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ═══════ MOBILE LAYOUT ═══════ */}
      {isMobile && (
        <main style={{ position: "relative", zIndex: 1, paddingTop: "8px", paddingBottom: "72px" }}>
          {/* Mobile header */}
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOutExpo}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 16px", marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em", color: "#f0f2f5" }}>
                {mobileTab === "chart" ? symbol : mobileTab === "watchlist" ? "Watchlist" : mobileTab === "signals" ? "AI Signals" : mobileTab === "news" ? "Market News" : "Portfolio"}
              </h2>
              {mobileTab === "chart" && (
                <span style={{
                  fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "5px",
                  background: "rgba(0,212,255,0.08)", color: "#00d4ff",
                  border: "1px solid rgba(0,212,255,0.12)",
                }}>{symbol}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {loading && (
                <span style={{
                  fontSize: "11px", borderRadius: "6px",
                  background: "rgba(0,212,255,0.06)", color: "#67e8f9",
                  padding: "3px 10px", border: "1px solid rgba(0,212,255,0.1)",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                  </svg>
                  Syncing
                </span>
              )}
              <MarketStatus />
            </div>
          </motion.header>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  borderRadius: "10px", border: "1px solid rgba(245,158,11,0.15)",
                  background: "rgba(245,158,11,0.04)", color: "#fcd34d",
                  padding: "10px 14px", fontSize: "12px", margin: "0 16px 12px",
                  display: "flex", alignItems: "center", gap: "6px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={mobileTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderMobileContent()}
            </motion.div>
          </AnimatePresence>
          <MobileBottomNav activeTab={mobileTab} onTabChange={setMobileTab} />
        </main>
      )}

      {/* ═══════ DESKTOP LAYOUT ═══════ */}
      {!isMobile && (
        <main style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 300px",
          gap: "16px",
          maxWidth: "1600px",
          margin: "0 auto",
          padding: "16px 20px",
          position: "relative", zIndex: 1,
          minHeight: "calc(100vh - 56px)",
        }}>
          {/* watchlist sidebar */}
          <motion.aside
            initial={slideInLeft.initial}
            animate={slideInLeft.animate}
            transition={slideInLeft.transition}
            style={{
              display: "flex", flexDirection: "column", gap: "12px",
              height: "calc(100vh - 88px)",
              position: "sticky", top: "72px",
              overflowY: "auto",
            }}
          >
            <Watchlist onStockClick={handleStockClick} />
          </motion.aside>

          {/* chart area */}
          <motion.div
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ ...easeOutExpo, delay: 0.08 }}
            style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}
          >
            {/* Dashboard header */}
            <header style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: "10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", color: "#f0f2f5" }}>Dashboard</h2>
                <div style={{ height: "1px", width: "20px", background: "rgba(255,255,255,0.08)" }} />
                <span style={{
                  fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px",
                  background: "rgba(0,212,255,0.08)", color: "#00d4ff",
                  border: "1px solid rgba(0,212,255,0.12)",
                }}>{symbol}</span>
                <MarketStatus />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {loading && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      fontSize: "11px", borderRadius: "8px",
                      background: "rgba(0,212,255,0.06)", color: "#67e8f9",
                      padding: "4px 12px", border: "1px solid rgba(0,212,255,0.1)",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                    </svg>
                    Syncing...
                  </motion.span>
                )}
                {usingMock && (
                  <span style={{
                    fontSize: "11px", borderRadius: "8px",
                    background: "rgba(245,158,11,0.06)", color: "#fcd34d",
                    padding: "4px 12px", border: "1px solid rgba(245,158,11,0.1)",
                  }}>
                    Sample data
                  </span>
                )}
              </div>
            </header>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={easeOutExpo}
                  style={{
                    borderRadius: "10px", border: "1px solid rgba(245,158,11,0.15)",
                    background: "rgba(245,158,11,0.04)", color: "#fcd34d",
                    padding: "12px 16px", fontSize: "13px",
                    display: "flex", alignItems: "center", gap: "8px",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stock header */}
            {stock ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...easeOutExpo, delay: 0.14 }}
              >
                <StockHeader stock={stock} />
              </motion.div>
            ) : loading ? (
              <LoadingSkeleton variant="card" height="110px" />
            ) : null}

            {/* Chart with ambient glow */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...easeOutExpo, delay: 0.2 }}
              style={{ position: "relative" }}
            >
              {/* Chart ambient glow */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: "70%", height: "50%",
                background: "radial-gradient(ellipse, rgba(0,212,255,0.03) 0%, transparent 70%)",
                pointerEvents: "none", zIndex: 0, filter: "blur(40px)",
              }} />
              <CandleChart symbol={symbol} currency={stock?.currency} />
            </motion.div>

            {/* Market News */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.28 }}
            >
              <MarketNewsPanel />
            </motion.div>
          </motion.div>

          {/* ai signals sidebar */}
          <motion.aside
            initial={slideInRight.initial}
            animate={slideInRight.animate}
            transition={slideInRight.transition}
            style={{
              display: "flex", flexDirection: "column", gap: "12px",
              height: "calc(100vh - 88px)",
              position: "sticky", top: "72px",
              overflowY: "auto",
            }}
          >
            <AISignalsPanel symbol={symbol} />
          </motion.aside>
        </main>
      )}
    </div>
  );
};

export default UserDashboard;
