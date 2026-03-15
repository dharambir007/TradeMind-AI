import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import SettingsFab from "../components/dashboard/SettingsFab";
import MobileDashboardView from "../components/dashboard/MobileDashboardView";
import DesktopDashboardView from "../components/dashboard/DesktopDashboardView";
import useDashboardStockData from "../hooks/useDashboardStockData";

const UserDashboard = () => {
  const { symbol: routeSymbol } = useParams();
  const navigate = useNavigate();
  const { symbol, stock, loading, error, usingMock } = useDashboardStockData(routeSymbol);
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

  const handleStockClick = useCallback((sym) => {
    navigate(`/dashboard/${encodeURIComponent(sym)}`);
    if (isMobile) setMobileTab("chart");
  }, [navigate, isMobile]);

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

      <SettingsFab isMobile={isMobile} onOpen={() => setSettingsOpen(true)} />

      <Sidebar isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {isMobile && (
        <MobileDashboardView
          symbol={symbol}
          stock={stock}
          loading={loading}
          error={error}
          mobileTab={mobileTab}
          onTabChange={setMobileTab}
          onStockClick={handleStockClick}
        />
      )}

      {!isMobile && (
        <DesktopDashboardView
          symbol={symbol}
          stock={stock}
          loading={loading}
          error={error}
          usingMock={usingMock}
          onStockClick={handleStockClick}
        />
      )}
    </div>
  );
};

export default UserDashboard;
