import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
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
    <nav style={{
      height: "56px",
      background: "rgba(5, 7, 14, 0.8)",
      backdropFilter: "blur(24px) saturate(1.3)",
      WebkitBackdropFilter: "blur(24px) saturate(1.3)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      position: "sticky", top: 0, zIndex: 40,
    }}>
      {/* logo */}
      <Motion.div
        style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
        onClick={() => navigate("/dashboard")}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div style={{
          width: "32px", height: "32px", borderRadius: "10px",
          background: "linear-gradient(135deg, #00d4ff, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,212,255,0.2)",
        }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>TM</span>
        </div>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.03em" }}>
          Trade<span style={{ color: "#00d4ff" }}>Mind</span>
        </span>
      </Motion.div>

      {/* search */}
      <SearchBar />

      {/* user dropdown */}
      <div ref={dropdownRef} style={{ position: "relative" }}>
        <Motion.button
          onClick={() => setDropdownOpen((prev) => !prev)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px", padding: "5px 12px 5px 5px",
            color: "#f0f2f5", cursor: "pointer",
            transition: "all 0.2s ease",
          }}
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
          <Motion.svg
            animate={{ rotate: dropdownOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ width: "12px", height: "12px", color: "#505872" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </Motion.svg>
        </Motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {dropdownOpen && (
            <Motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)",
                background: "rgba(10, 14, 24, 0.95)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px", minWidth: "200px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                zIndex: 50, overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0f2f5" }}>{user?.name?.split(" ").slice(0, 2).join(" ") || "User"}</p>
                <p style={{ fontSize: "11px", color: "#505872", marginTop: "2px" }}>{user?.email || ""}</p>
              </div>

              <Motion.button
                onClick={handleLogout}
                whileHover={{ backgroundColor: "rgba(244,63,94,0.06)" }}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 16px",
                  background: "transparent", border: "none",
                  color: "#f43f5e", cursor: "pointer", fontSize: "13px",
                  display: "flex", alignItems: "center", gap: "8px",
                }}
              >
                <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </Motion.button>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;
