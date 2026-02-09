import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          localStorage.removeItem("token");
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div style={{
      height: "56px", background: "rgba(6, 8, 15, 0.85)",
      backdropFilter: "blur(20px) saturate(1.2)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      position: "sticky", top: 0, zIndex: 40,
    }}>
      
      {/* Logo */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
        onClick={() => navigate("/dashboard")}
      >
        <div style={{
          width: "30px", height: "30px", borderRadius: "8px",
          background: "linear-gradient(135deg, #00d4ff, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,212,255,0.15)",
        }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#fff" }}>TM</span>
        </div>
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.02em" }}>TradeMind</span>
      </div>

      {/* Search */}
      <SearchBar />

      {/* User dropdown */}
      <div ref={dropdownRef} style={{ position: "relative" }}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          style={{ 
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px", padding: "6px 12px 6px 6px",
            color: "#f0f2f5", cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
        >
          <div style={{ 
            width: "28px", height: "28px", borderRadius: "8px",
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "11px", fontWeight: 700, color: "#fff",
          }}>
            {getInitials(user?.name)}
          </div>
          <span style={{ fontSize: "13px", fontWeight: 500 }}>{user?.name?.split(" ")[0] || "User"}</span>
          <svg style={{ width: "12px", height: "12px", color: "#505872", transition: "transform 0.2s", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div style={{ 
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            background: "rgba(12, 16, 28, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px", minWidth: "200px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            zIndex: 50, overflow: "hidden",
            animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0f2f5" }}>{user?.name?.split(" ").slice(0, 2).join(" ") || "User"}</p>
              <p style={{ fontSize: "11px", color: "#505872", marginTop: "2px" }}>{user?.email || ""}</p>
            </div>
            
            <button
              onClick={handleLogout}
              style={{ 
                width: "100%", textAlign: "left", padding: "10px 16px",
                background: "transparent", border: "none",
                color: "#f43f5e", cursor: "pointer", fontSize: "13px",
                display: "flex", alignItems: "center", gap: "8px",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(244,63,94,0.06)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
