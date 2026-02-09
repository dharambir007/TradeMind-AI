import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/api";

/**
 * Groww-style search bar with instant dropdown suggestions.
 * Debounces keystrokes and shows symbol + company name + sector badge.
 */
const SearchBar = memo(() => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focused, setFocused] = useState(false);

  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await apiClient.get(`/stocks/search?q=${encodeURIComponent(q.trim())}`, {
        signal: controller.signal,
      });
      setResults(res.data || []);
      setOpen(true);
      setActiveIdx(-1);
    } catch (err) {
      if (err?.name !== "CanceledError") {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    // Debounce 250ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const navigateToStock = (symbol) => {
    // Strip .NS/.BO suffix for clean URL
    const clean = symbol.replace(/\.(NS|BO)$/, "");
    navigate(`/dashboard/${clean}`);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        navigateToStock(query.trim().toUpperCase());
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && results[activeIdx]) {
          navigateToStock(results[activeIdx].symbol);
        } else if (query.trim()) {
          navigateToStock(query.trim().toUpperCase());
        }
        break;
      case "Escape":
        setOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const getSectorColor = (sector) => {
    const colors = {
      IT: "#00d4ff",
      Banking: "#8b5cf6",
      Finance: "#a78bfa",
      Pharma: "#10b981",
      Energy: "#f59e0b",
      FMCG: "#ec4899",
      Automobile: "#6366f1",
      Metals: "#94a3b8",
      Telecom: "#14b8a6",
      Power: "#eab308",
      Infrastructure: "#f97316",
      Defence: "#22c55e",
      Insurance: "#a855f7",
      Index: "#67e8f9",
    };
    return colors[sector] || "#505872";
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "380px" }}>
      {/* Search input */}
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
          color: focused ? "#00d4ff" : "#3b4260",
          transition: "color 0.2s ease",
          display: "flex", alignItems: "center",
        }}>
          {loading ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search stocks... e.g. Reliance, TCS"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { setFocused(true); if (results.length > 0) setOpen(true); }}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", padding: "8px 40px 8px 34px", borderRadius: "10px",
            background: focused ? "rgba(0,212,255,0.03)" : "rgba(255,255,255,0.03)",
            color: "#f0f2f5",
            border: `1px solid ${focused ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.05)"}`,
            outline: "none", fontSize: "13px",
            transition: "all 0.3s ease",
            boxShadow: focused ? "0 0 0 3px rgba(0,212,255,0.05)" : "none",
          }}
          autoComplete="off"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            style={{
              position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "#505872", cursor: "pointer",
              padding: "2px", display: "flex", alignItems: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {!query && (
          <kbd style={{
            position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
            fontSize: "10px", color: "#3b4260", padding: "2px 6px", borderRadius: "4px",
            border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)",
          }}>↵</kbd>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "rgba(10, 14, 24, 0.98)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          zIndex: 100,
          overflow: "hidden",
          animation: "scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* Header */}
          <div style={{
            padding: "8px 14px 6px",
            fontSize: "10px", fontWeight: 600, color: "#3b4260",
            textTransform: "uppercase", letterSpacing: "0.08em",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
          }}>
            {results.length} result{results.length !== 1 ? "s" : ""} · NSE
          </div>

          {/* Results */}
          <div style={{ maxHeight: "320px", overflowY: "auto" }}>
            {results.map((item, idx) => {
              const isActive = idx === activeIdx;
              const displaySymbol = item.symbol.replace(/\.(NS|BO)$/, "");
              return (
                <div
                  key={item.symbol + idx}
                  onMouseDown={(e) => { e.preventDefault(); navigateToStock(item.symbol); }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px",
                    cursor: "pointer",
                    background: isActive ? "rgba(0,212,255,0.04)" : "transparent",
                    borderLeft: isActive ? "2px solid #00d4ff" : "2px solid transparent",
                    transition: "all 0.1s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    {/* Symbol icon */}
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "8px",
                      background: "rgba(0,212,255,0.06)",
                      border: "1px solid rgba(0,212,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", fontWeight: 700, color: "#00d4ff",
                      flexShrink: 0,
                    }}>
                      {displaySymbol.slice(0, 3)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#f0f2f5" }}>
                          {displaySymbol}
                        </span>
                        {item.sector && (
                          <span style={{
                            fontSize: "9px", fontWeight: 600, padding: "1px 5px", borderRadius: "3px",
                            background: `${getSectorColor(item.sector)}10`,
                            color: getSectorColor(item.sector),
                            border: `1px solid ${getSectorColor(item.sector)}20`,
                            whiteSpace: "nowrap",
                          }}>
                            {item.sector}
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontSize: "11px", color: "#505872", marginTop: "1px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {item.name}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                    <span style={{
                      fontSize: "10px", color: "#3b4260",
                      padding: "2px 6px", borderRadius: "4px",
                      background: "rgba(255,255,255,0.02)",
                    }}>
                      {item.exchange || "NSE"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div style={{
            padding: "6px 14px", borderTop: "1px solid rgba(255,255,255,0.03)",
            display: "flex", alignItems: "center", gap: "12px",
            fontSize: "10px", color: "#3b4260",
          }}>
            <span><kbd style={{ padding: "1px 4px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", fontSize: "9px" }}>↑↓</kbd> Navigate</span>
            <span><kbd style={{ padding: "1px 4px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", fontSize: "9px" }}>↵</kbd> Select</span>
            <span><kbd style={{ padding: "1px 4px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", fontSize: "9px" }}>Esc</kbd> Close</span>
          </div>
        </div>
      )}

      {/* No results message */}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "rgba(10, 14, 24, 0.98)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          zIndex: 100, padding: "20px",
          textAlign: "center", animation: "scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <p style={{ fontSize: "13px", color: "#505872" }}>No stocks found for "<span style={{ color: "#8b93a7" }}>{query}</span>"</p>
          <p style={{ fontSize: "11px", color: "#3b4260", marginTop: "4px" }}>Press Enter to search Yahoo Finance</p>
        </div>
      )}
    </div>
  );
});

export default SearchBar;
