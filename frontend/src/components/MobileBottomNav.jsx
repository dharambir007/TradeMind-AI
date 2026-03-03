import { memo } from "react";
import { motion } from "framer-motion";

const tabs = [
    {
        id: "chart",
        label: "Chart",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        ),
    },
    {
        id: "watchlist",
        label: "Watchlist",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
        ),
    },
    {
        id: "signals",
        label: "AI Signals",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
            </svg>
        ),
    },
    {
        id: "portfolio",
        label: "Portfolio",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
        ),
    },
    {
        id: "news",
        label: "News",
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
            </svg>
        ),
    },
];

/**
 * Mobile bottom navigation bar — shown only on small screens.
 */
const MobileBottomNav = memo(({ activeTab, onTabChange }) => {
    return (
        <nav style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            height: "60px",
            background: "rgba(5, 7, 14, 0.95)",
            backdropFilter: "blur(24px) saturate(1.3)",
            WebkitBackdropFilter: "blur(24px) saturate(1.3)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", justifyContent: "space-around",
            padding: "0 8px",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            zIndex: 50,
        }}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <motion.button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        whileTap={{ scale: 0.92 }}
                        style={{
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            gap: "2px",
                            padding: "6px 12px", borderRadius: "10px",
                            border: "none", cursor: "pointer",
                            background: isActive ? "rgba(0,212,255,0.06)" : "transparent",
                            color: isActive ? "#00d4ff" : "#3b4260",
                            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                            minWidth: "56px",
                            position: "relative",
                        }}
                    >
                        {/* Active indicator dot */}
                        {isActive && (
                            <motion.div
                                layoutId="mobile-tab-indicator"
                                style={{
                                    position: "absolute", top: "-1px", left: "50%",
                                    transform: "translateX(-50%)",
                                    width: "16px", height: "2px", borderRadius: "1px",
                                    background: "#00d4ff",
                                    boxShadow: "0 0 8px rgba(0,212,255,0.4)",
                                }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                        <motion.span
                            animate={{ scale: isActive ? 1.1 : 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                            {tab.icon}
                        </motion.span>
                        <span style={{
                            fontSize: "9px", fontWeight: isActive ? 700 : 500,
                            letterSpacing: "0.02em",
                        }}>
                            {tab.label}
                        </span>
                    </motion.button>
                );
            })}
        </nav>
    );
});

export default MobileBottomNav;
