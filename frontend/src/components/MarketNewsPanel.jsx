import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/api";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min

/* ─── small helpers ─── */

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── styles ─── */

const panelStyle = {
  background: "rgba(12,14,22,0.65)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "14px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  maxHeight: "480px",
  overflow: "hidden",
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "2px",
};

const titleStyle = {
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "#f0f2f5",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const scrollArea = {
  overflowY: "auto",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  paddingRight: "2px",
};

const cardStyle = {
  display: "flex",
  gap: "10px",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.04)",
  background: "rgba(255,255,255,0.02)",
  cursor: "pointer",
  textDecoration: "none",
  transition: "background 0.15s, border-color 0.15s",
};

const imgStyle = {
  width: "56px",
  height: "56px",
  borderRadius: "8px",
  objectFit: "cover",
  flexShrink: 0,
  background: "rgba(255,255,255,0.04)",
};

const placeholderImg = {
  ...imgStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/* ─── skeleton ─── */

function SkeletonCard() {
  return (
    <div style={{ ...cardStyle, pointerEvents: "none" }}>
      <div
        style={{
          ...placeholderImg,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div
          style={{
            height: "12px",
            borderRadius: "4px",
            width: "90%",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }}
        />
        <div
          style={{
            height: "10px",
            borderRadius: "4px",
            width: "60%",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }}
        />
      </div>
    </div>
  );
}

/* ─── news card ─── */

function NewsCard({ article, index }) {
  const hasImage = !!article.image;

  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      style={cardStyle}
      whileHover={{
        background: "rgba(255,255,255,0.04)",
        borderColor: "rgba(99,102,241,0.18)",
      }}
    >
      {hasImage ? (
        <img
          src={article.image}
          alt=""
          style={imgStyle}
          onError={(e) => {
            e.target.style.display = "none";
          }}
          loading="lazy"
        />
      ) : (
        <div style={placeholderImg}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
        <p
          style={{
            fontSize: "12px",
            fontWeight: 600,
            lineHeight: 1.4,
            color: "#e2e5ea",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            margin: 0,
          }}
        >
          {article.title}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "10px",
            color: "#505872",
          }}
        >
          <span style={{ fontWeight: 600, color: "#6366f1" }}>{article.source}</span>
          <span>·</span>
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
    </motion.a>
  );
}

/* ─── main panel ─── */

export default function MarketNewsPanel() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNews = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/market/news");
      setNews(data.news || []);
      setError("");
    } catch (err) {
      console.error("[MarketNewsPanel] fetch error:", err.message);
      setError("Unable to load news");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNews]);

  return (
    <div style={panelStyle}>
      {/* shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Header */}
      <div style={headerRow}>
        <div style={titleStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
          </svg>
          Market News
        </div>
        {!loading && news.length > 0 && (
          <span
            style={{
              fontSize: "10px",
              color: "#505872",
              fontWeight: 500,
            }}
          >
            {news.length} articles
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={scrollArea}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div
          style={{
            textAlign: "center",
            padding: "24px 8px",
            fontSize: "12px",
            color: "#505872",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" style={{ display: "block", margin: "0 auto 8px" }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      ) : news.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "24px 8px",
            fontSize: "12px",
            color: "#505872",
          }}
        >
          No market news available
        </div>
      ) : (
        <div style={scrollArea}>
          <AnimatePresence>
            {news.map((article, i) => (
              <NewsCard key={article.url || i} article={article} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
