import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/api";

const Watchlist = memo(({ onStockClick }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [deletingSymbol, setDeletingSymbol] = useState(null);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Fetch watchlist
  const fetchWatchlist = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await apiClient.get("/watchlist");
      setItems(res.data || []);
      setError("");
    } catch (err) {
      if (err.response?.status !== 401) {
        setError("Failed to load watchlist");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
    // Refresh every 30s for live prices
    const interval = setInterval(fetchWatchlist, 30000);
    // Sync when chart watchlist button is toggled
    const handler = () => fetchWatchlist();
    window.addEventListener("watchlist-updated", handler);
    return () => { clearInterval(interval); window.removeEventListener("watchlist-updated", handler); };
  }, [fetchWatchlist]);

  // Close search on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search stocks for add
  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearchLoading(true);

      try {
        const res = await apiClient.get(`/stocks/search?q=${encodeURIComponent(val.trim())}`, {
          signal: controller.signal,
        });
        // Filter out stocks already in watchlist
        const existing = new Set(items.map((i) => i.symbol));
        const filtered = (res.data || []).filter((s) => {
          const clean = s.symbol.replace(/\.(NS|BO)$/, "");
          return !existing.has(clean) && !existing.has(s.symbol);
        });
        setSearchResults(filtered);
        setSearchOpen(true);
      } catch (err) {
        if (err?.name !== "CanceledError") setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
  };

  // Add to watchlist
  const handleAdd = async (symbol) => {
    try {
      setAdding(true);
      const clean = symbol.replace(/\.(NS|BO)$/, "");
      await apiClient.post("/watchlist", { symbol: clean });
      setSearchQuery("");
      setSearchResults([]);
      setSearchOpen(false);
      await fetchWatchlist();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to add";
      setError(msg);
      setTimeout(() => setError(""), 3000);
    } finally {
      setAdding(false);
    }
  };

  // Remove from watchlist
  const handleDelete = async (symbol) => {
    try {
      setDeletingSymbol(symbol);
      await apiClient.delete(`/watchlist/${encodeURIComponent(symbol)}`);
      setItems((prev) => prev.filter((i) => i.symbol !== symbol));
    } catch (err) {
      setError("Failed to remove");
      setTimeout(() => setError(""), 3000);
    } finally {
      setDeletingSymbol(null);
    }
  };

  const handleItemClick = (symbol) => {
    const clean = symbol.replace(/\.(NS|BO)$/, "");
    if (onStockClick) onStockClick(clean);
    else navigate(`/dashboard/${clean}`);
  };

  return (
    <section style={{
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.04)",
      background: "rgba(255,255,255,0.015)",
      padding: "16px",
      position: "relative",
      overflow: "visible",
    }}>
      {/* Accent glow */}
      <div style={{
        position: "absolute", top: 0, left: "15%", right: "15%", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)",
      }} />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px",
      }}>
        <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.01em" }}>Watchlist</h4>
        <span style={{
          fontSize: "10px", color: "#3b4260", background: "rgba(255,255,255,0.03)",
          padding: "3px 8px", borderRadius: "6px",
        }}>
          {items.length}/20
        </span>
      </div>

      {/* Add stock search */}
      <div ref={searchRef} style={{ position: "relative", marginBottom: "12px" }}>
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
            color: "#3b4260", display: "flex", alignItems: "center",
          }}>
            {searchLoading ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            )}
          </div>
          <input
            type="text"
            placeholder="Add stock..."
            value={searchQuery}
            onChange={handleSearch}
            style={{
              width: "100%", padding: "8px 10px 8px 30px", borderRadius: "8px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              color: "#f0f2f5", fontSize: "12px", outline: "none",
              transition: "all 0.2s ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(0,212,255,0.2)";
              e.target.style.background = "rgba(0,212,255,0.03)";
              if (searchResults.length > 0) setSearchOpen(true);
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.05)";
              e.target.style.background = "rgba(255,255,255,0.03)";
            }}
            disabled={items.length >= 20}
          />
        </div>

        {/* Search dropdown */}
        {searchOpen && searchResults.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "rgba(10, 14, 24, 0.98)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            zIndex: 60, overflow: "hidden",
            animation: "scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            {searchResults.slice(0, 6).map((item) => {
              const displaySymbol = item.symbol.replace(/\.(NS|BO)$/, "");
              return (
                <div
                  key={item.symbol}
                  onMouseDown={(e) => { e.preventDefault(); handleAdd(item.symbol); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", cursor: "pointer",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,212,255,0.04)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#f0f2f5" }}>{displaySymbol}</span>
                    <p style={{ fontSize: "10px", color: "#505872", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </p>
                  </div>
                  <button
                    disabled={adding}
                    style={{
                      padding: "3px 8px", borderRadius: "5px", border: "none",
                      background: "rgba(16,185,129,0.1)", color: "#10b981",
                      fontSize: "10px", fontWeight: 600, cursor: "pointer",
                      transition: "all 0.15s ease", flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.target.style.background = "rgba(16,185,129,0.2)"; }}
                    onMouseLeave={(e) => { e.target.style.background = "rgba(16,185,129,0.1)"; }}
                  >
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div style={{
          padding: "6px 10px", borderRadius: "6px", marginBottom: "8px",
          background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.12)",
          color: "#fda4af", fontSize: "11px",
          animation: "scaleIn 0.2s ease",
        }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "32px 12px", color: "#505872", fontSize: "12px", gap: "6px",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
            <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
          </svg>
          Loading...
        </div>
      )}

      {/* Watchlist items */}
      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {items.map((item, idx) => {
            const up = (item.changePercent || 0) >= 0;
            const isDeleting = deletingSymbol === item.symbol;
            return (
              <div
                key={item.symbol}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderRadius: "10px", background: "rgba(255,255,255,0.02)",
                  padding: "10px 12px",
                  border: "1px solid transparent",
                  transition: "all 0.2s ease",
                  animation: `fadeInUp 0.3s ease ${idx * 0.05}s both`,
                  opacity: isDeleting ? 0.4 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  const del = e.currentTarget.querySelector(".wl-delete");
                  if (del) del.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  e.currentTarget.style.borderColor = "transparent";
                  const del = e.currentTarget.querySelector(".wl-delete");
                  if (del) del.style.opacity = "0";
                }}
              >
                {/* Clickable stock info */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", flex: 1, minWidth: 0 }}
                  onClick={() => handleItemClick(item.symbol)}
                >
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: up ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "10px", fontWeight: 700, color: up ? "#10b981" : "#ef4444",
                    flexShrink: 0,
                  }}>
                    {item.symbol?.slice(0, 3)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "13px", color: "#e0e4ec", letterSpacing: "-0.01em" }}>{item.symbol}</p>
                    {item.price > 0 ? (
                      <p style={{ fontSize: "11px", color: "#3b4260", marginTop: "1px" }}>
                        ₹{item.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    ) : (
                      <p style={{ fontSize: "10px", color: "#3b4260", marginTop: "1px" }}>
                        {item.name || item.symbol}
                      </p>
                    )}
                  </div>
                </div>

                {/* Price change + delete */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {item.price > 0 && (
                    <span style={{
                      fontSize: "11px", fontWeight: 600,
                      color: up ? "#10b981" : "#ef4444",
                      background: up ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                      padding: "3px 7px", borderRadius: "5px",
                    }}>
                      {up ? "+" : ""}{item.changePercent}%
                    </span>
                  )}

                  {/* Delete button — visible on hover */}
                  <button
                    className="wl-delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.symbol); }}
                    disabled={isDeleting}
                    style={{
                      width: "22px", height: "22px", borderRadius: "5px",
                      background: "rgba(244,63,94,0.06)",
                      border: "1px solid rgba(244,63,94,0.1)",
                      color: "#f43f5e", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: 0, transition: "opacity 0.15s ease",
                      padding: 0, flexShrink: 0,
                    }}
                    title="Remove from watchlist"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {!items.length && !loading && (
            <div style={{
              textAlign: "center", padding: "28px 12px",
              color: "#2a3050", fontSize: "13px",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: "0 auto 8px", opacity: 0.3, display: "block" }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <p>Your watchlist is empty</p>
              <p style={{ fontSize: "11px", color: "#1e2540", marginTop: "4px" }}>Search and add stocks above</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
});

export default Watchlist;
