import { memo } from "react";

/**
 * Reusable loading skeleton with shimmer animation.
 * Supports different variants: chart, card, list-item, text.
 */
const LoadingSkeleton = memo(({ variant = "card", count = 1, height }) => {
    const baseStyle = {
        background: "linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)",
        backgroundSize: "400% 100%",
        animation: "shimmer 1.8s ease-in-out infinite",
        borderRadius: "10px",
    };

    if (variant === "chart") {
        return (
            <div style={{ ...baseStyle, height: height || "420px", borderRadius: "12px" }} />
        );
    }

    if (variant === "text") {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} style={{
                        ...baseStyle,
                        height: "12px",
                        width: i === count - 1 ? "60%" : "100%",
                    }} />
                ))}
            </div>
        );
    }

    if (variant === "list-item") {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 12px", borderRadius: "10px",
                        background: "rgba(255,255,255,0.02)",
                    }}>
                        <div style={{ ...baseStyle, width: "32px", height: "32px", flexShrink: 0, borderRadius: "8px" }} />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ ...baseStyle, height: "12px", width: "60%" }} />
                            <div style={{ ...baseStyle, height: "10px", width: "40%" }} />
                        </div>
                        <div style={{ ...baseStyle, height: "20px", width: "48px", borderRadius: "5px" }} />
                    </div>
                ))}
            </div>
        );
    }

    // Default: card
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} style={{
                    ...baseStyle,
                    height: height || "80px",
                    padding: "16px",
                }} />
            ))}
        </div>
    );
});

export default LoadingSkeleton;
