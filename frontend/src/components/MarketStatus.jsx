import { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { getMarketStatus } from '../services/marketService';

const MarketStatus = memo(() => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getMarketStatus();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch market status');
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const isOpen = status.isOpen;

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "8px",
      fontSize: "12px", color: "#8b93a7",
    }}>
      <motion.span
        animate={isOpen ? {
          scale: [1, 1.3, 1],
          opacity: [1, 0.6, 1],
          boxShadow: [
            `0 0 4px ${isOpen ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            `0 0 10px ${isOpen ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"}`,
            `0 0 4px ${isOpen ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          ],
        } : {}}
        transition={isOpen ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
        style={{
          width: "6px", height: "6px", borderRadius: "50%",
          display: "inline-block",
          background: isOpen ? "#10b981" : "#ef4444",
          boxShadow: isOpen ? "0 0 6px rgba(16,185,129,0.4)" : "0 0 6px rgba(239,68,68,0.4)",
        }}
      />
      <span style={{ color: "#e0e4ec", fontWeight: 500 }}>{status.message}</span>
      <span style={{ color: "#3b4260", fontSize: "11px", fontFeatureSettings: '"tnum" 1' }}>{status.currentTime} IST</span>
    </div>
  );
});

export default MarketStatus;
