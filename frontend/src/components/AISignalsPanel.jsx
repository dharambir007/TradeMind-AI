import { useState, useEffect, memo } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/api";
import { fetchAIInsight } from "../services/aiService";
import LoadingSkeleton from "./LoadingSkeleton";
import { easeOutExpo } from "../utils/animations";

const isAbortError = (err) =>
    err?.name === "CanceledError" || err?.name === "AbortError" || err?.code === "ERR_CANCELED";

const AISignalsPanel = memo(({ symbol }) => {
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [aiInsight, setAiInsight] = useState(null);
    const [insightLoading, setInsightLoading] = useState(true);
    const [insightError, setInsightError] = useState("");

    const symbolKey = String(symbol || "").trim().toUpperCase();

    useEffect(() => {
        if (!symbolKey) return;
        let active = true;
        const controller = new AbortController();

        const fetchPrediction = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await apiClient.get(
                    `/stocks/${encodeURIComponent(symbolKey)}/prediction`,
                    { signal: controller.signal }
                );
                if (active) {
                    if (res.data && res.data.success === false) {
                        throw new Error(res.data.message || "Prediction unavailable");
                    }
                    setPrediction(res.data);
                    setLoading(false);
                }
            } catch (err) {
                if (!active || isAbortError(err)) return;
                setError("Prediction unavailable");
                setLoading(false);
            }
        };

        fetchPrediction();
        const interval = window.setInterval(fetchPrediction, 60000);

        return () => {
            active = false;
            controller.abort();
            clearInterval(interval);
        };
    }, [symbolKey]);

    useEffect(() => {
        if (!symbolKey) return;
        let active = true;
        const controller = new AbortController();

        const loadInsight = async () => {
            setInsightLoading(true);
            setInsightError("");
            try {
                const data = await fetchAIInsight(symbolKey, {
                    limit: 10,
                    signal: controller.signal,
                });
                if (!active) return;
                setAiInsight(data);
                setInsightLoading(false);
            } catch (err) {
                if (!active || isAbortError(err)) return;
                setInsightError(err?.response?.data?.error || "News insight unavailable");
                setInsightLoading(false);
            }
        };

        loadInsight();
        const interval = window.setInterval(loadInsight, 120000);

        return () => {
            active = false;
            controller.abort();
            clearInterval(interval);
        };
    }, [symbolKey]);

    const isBullish = prediction?.direction === "UP" || prediction?.predicted_direction === "UP";
    const rawConfidence = Number(prediction?.confidence ?? prediction?.probability ?? 0);
    const confidencePct = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
    const safeConfidencePct = Math.max(0, Math.min(100, Number.isFinite(confidencePct) ? confidencePct : 0));

    const sentiment = String(aiInsight?.sentiment || "Neutral");
    const sentimentTone = sentiment === "Bullish"
        ? { fg: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.16)" }
        : sentiment === "Bearish"
            ? { fg: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.16)" }
            : { fg: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.16)" };

    const summaryRows = Array.isArray(aiInsight?.summary) ? aiInsight.summary.slice(0, 5) : [];

    return (
        <section style={{
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(255,255,255,0.015)",
            padding: "16px",
            position: "relative",
            overflow: "hidden",
            height: "100%",
        }}>
            <div style={{
                position: "absolute", top: 0, left: "15%", right: "15%", height: "1px",
                background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.25), transparent)",
            }} />

            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "16px",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                        width: "28px", height: "28px", borderRadius: "8px",
                        background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#f0f2f5", letterSpacing: "-0.01em" }}>
                        AI Signals
                    </h4>
                </div>
                <Motion.span
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                        fontSize: "9px", fontWeight: 600, color: "#8b5cf6",
                        background: "rgba(139,92,246,0.08)", padding: "2px 8px",
                        borderRadius: "4px", border: "1px solid rgba(139,92,246,0.12)",
                        letterSpacing: "0.04em",
                    }}
                >
                    ML + NEWS
                </Motion.span>
            </div>

            {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <LoadingSkeleton variant="card" height="100px" />
                    <LoadingSkeleton variant="text" count={3} />
                </div>
            )}

            {!loading && error && (
                <Motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={easeOutExpo}
                    style={{
                        textAlign: "center", padding: "18px 12px",
                        color: "#505872", fontSize: "13px",
                    }}
                >
                    <p>{error}</p>
                    <p style={{ fontSize: "11px", color: "#2a3050", marginTop: "4px" }}>
                        ML service may be offline
                    </p>
                </Motion.div>
            )}

            <AnimatePresence mode="wait">
                {!loading && (prediction || aiInsight) && (
                    <Motion.div
                        key={`${symbolKey}-${prediction?.direction || prediction?.predicted_direction || "insight"}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={easeOutExpo}
                        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                    >
                        {prediction && (
                            <>
                                <Motion.div
                                    whileHover={{ scale: 1.01 }}
                                    style={{
                                        borderRadius: "12px",
                                        background: isBullish ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                                        border: `1px solid ${isBullish ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}`,
                                        padding: "16px",
                                        textAlign: "center",
                                    }}
                                >
                                    <p style={{
                                        fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em",
                                        color: isBullish ? "#10b981" : "#ef4444",
                                    }}>
                                        {isBullish ? "BULLISH" : "BEARISH"}
                                    </p>
                                    <p style={{ fontSize: "11px", color: "#505872", marginTop: "4px" }}>
                                        Predicted Direction
                                    </p>
                                </Motion.div>

                                {(prediction.confidence != null || prediction.probability != null) && (
                                    <div style={{
                                        borderRadius: "10px", background: "rgba(255,255,255,0.02)",
                                        padding: "12px", border: "1px solid rgba(255,255,255,0.04)",
                                    }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                            <span style={{ fontSize: "11px", color: "#505872", fontWeight: 500 }}>Confidence</span>
                                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#f0f2f5", fontFeatureSettings: '"tnum" 1' }}>
                                                {safeConfidencePct.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div style={{
                                            height: "5px", borderRadius: "3px",
                                            background: "rgba(255,255,255,0.04)", overflow: "hidden",
                                        }}>
                                            <Motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${safeConfidencePct}%` }}
                                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                                                style={{
                                                    height: "100%", borderRadius: "3px",
                                                    background: isBullish
                                                        ? "linear-gradient(90deg, #10b981, #34d399)"
                                                        : "linear-gradient(90deg, #ef4444, #f87171)",
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div style={{
                            borderRadius: "12px",
                            padding: "12px",
                            border: "1px solid rgba(255,255,255,0.05)",
                            background: "rgba(255,255,255,0.02)",
                        }}>
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "8px",
                                gap: "8px",
                            }}>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#dbe2ea" }}>News Insight</span>
                                {aiInsight?.sentiment && (
                                    <span style={{
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        color: sentimentTone.fg,
                                        background: sentimentTone.bg,
                                        border: `1px solid ${sentimentTone.border}`,
                                        borderRadius: "999px",
                                        padding: "3px 8px",
                                        letterSpacing: "0.02em",
                                    }}>
                                        {sentiment.toUpperCase()}
                                    </span>
                                )}
                            </div>

                            {insightLoading && !aiInsight && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <LoadingSkeleton variant="text" count={3} />
                                </div>
                            )}

                            {!insightLoading && insightError && !aiInsight && (
                                <div style={{
                                    fontSize: "11px",
                                    color: "#7b8499",
                                    background: "rgba(255,255,255,0.01)",
                                    border: "1px solid rgba(255,255,255,0.04)",
                                    borderRadius: "8px",
                                    padding: "8px",
                                }}>
                                    {insightError}
                                </div>
                            )}

                            {!insightLoading && aiInsight && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <ul style={{
                                        margin: 0,
                                        paddingLeft: "16px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "5px",
                                    }}>
                                        {summaryRows.map((point, idx) => (
                                            <li key={`${idx}-${point}`} style={{ fontSize: "11px", color: "#c8cfda", lineHeight: 1.35 }}>
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                    <div style={{
                                        fontSize: "11px",
                                        color: "#9ca5b8",
                                        lineHeight: 1.45,
                                        borderTop: "1px solid rgba(255,255,255,0.04)",
                                        paddingTop: "8px",
                                    }}>
                                        {aiInsight.insight}
                                    </div>
                                </div>
                            )}
                        </div>

                        <p style={{
                            fontSize: "9px", color: "#2a3050", textAlign: "center",
                            lineHeight: 1.4, marginTop: "4px",
                        }}>
                            AI outputs are informational only. Not financial advice.
                        </p>
                    </Motion.div>
                )}
            </AnimatePresence>
        </section>
    );
});

export default AISignalsPanel;
