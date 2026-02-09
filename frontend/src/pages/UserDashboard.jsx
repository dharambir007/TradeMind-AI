import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import CandleChart from "../components/CandleChart";
import StockHeader from "../components/StockHeader";
import Watchlist from "../components/Watchlist";
import MarketStatus from "../components/MarketStatus";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 8000,
});

const MOCK_STOCK = {
  symbol: "RELIANCE",
  name: "Reliance Industries Ltd.",
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
  const symbol = (routeSymbol || "RELIANCE").toUpperCase();

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingMock, setUsingMock] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const stockRes = await apiClient.get(`/stocks/${symbol}`, {
          signal: controller.signal,
        });

        const fetchedStock = stockRes?.data;
        const hasStock = fetchedStock && Object.keys(fetchedStock).length > 0;

        if (!active) return;

        if (hasStock) {
          setStock(fetchedStock);
          setUsingMock(false);
        } else {
          setStock(MOCK_STOCK);
          setUsingMock(true);
        }

        setError("");
      } catch (err) {
        if (!active || err?.name === "CanceledError" || axios.isCancel(err)) return;

        console.error("Failed to load live data", err);
        setError("Live data unavailable. Showing sample data.");
        setStock(MOCK_STOCK);
        setUsingMock(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [symbol]);

  return (
    <div style={{ backgroundColor: "#06080f", minHeight: "100vh", color: "#f0f2f5", position: "relative" }}>
      {/* Subtle bg grain */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.008) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.008) 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
      }} />

      <Navbar />

      {/* Settings FAB */}
      <button
        onClick={() => setSettingsOpen(true)}
        style={{
          position: "fixed", bottom: "24px", right: "24px",
          width: "48px", height: "48px", borderRadius: "14px",
          background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff", cursor: "pointer",
          boxShadow: "0 8px 30px rgba(99,102,241,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 30, transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.05)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(99,102,241,0.4)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(99,102,241,0.3)"; }}
        title="Settings"
      >
        <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <Sidebar isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 20px", position: "relative", zIndex: 1 }}>
        {/* Dashboard header */}
        <header className="animate-fade-in-up" style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: "24px", flexWrap: "wrap", gap: "12px",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", color: "#f0f2f5" }}>Dashboard</h2>
              <div style={{
                height: "1px", width: "24px", background: "rgba(255,255,255,0.08)",
              }} />
              <span style={{
                fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px",
                background: "rgba(0,212,255,0.08)", color: "#00d4ff",
                border: "1px solid rgba(0,212,255,0.12)",
              }}>{symbol}</span>
            </div>
            <MarketStatus />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {loading && (
              <span style={{
                fontSize: "12px", borderRadius: "8px",
                background: "rgba(0,212,255,0.06)", color: "#67e8f9",
                padding: "4px 12px", border: "1px solid rgba(0,212,255,0.1)",
                display: "flex", alignItems: "center", gap: "6px",
                animation: "fadeIn 0.3s ease",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                </svg>
                Syncing...
              </span>
            )}
            {usingMock && (
              <span style={{
                fontSize: "12px", borderRadius: "8px",
                background: "rgba(245,158,11,0.06)", color: "#fcd34d",
                padding: "4px 12px", border: "1px solid rgba(245,158,11,0.1)",
              }}>
                Sample data
              </span>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div style={{
            borderRadius: "10px", border: "1px solid rgba(245,158,11,0.15)",
            background: "rgba(245,158,11,0.04)", color: "#fcd34d",
            padding: "12px 16px", fontSize: "13px", marginBottom: "20px",
            display: "flex", alignItems: "center", gap: "8px",
            animation: "scaleIn 0.3s ease",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Stock header */}
        {stock && (
          <div className="animate-fade-in-up delay-100">
            <StockHeader stock={stock} />
          </div>
        )}

        {/* Chart + Watchlist grid */}
        <div style={{ display: "grid", gap: "20px", marginTop: "20px" }} className="dashboard-grid">
          <div className="animate-fade-in-up delay-200">
            <CandleChart symbol={symbol} currency={stock?.currency} />
          </div>
          <div className="animate-fade-in-up delay-300">
            <Watchlist onStockClick={(sym) => navigate(`/dashboard/${sym}`)} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;
