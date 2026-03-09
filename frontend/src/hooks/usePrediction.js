import { useState, useCallback, useRef } from "react";
import apiClient from "../services/api";

export function usePrediction(symbol) {
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const abortRef = useRef(null);

    const predict = useCallback(async ({ timeframe = "3m", steps = 3 } = {}) => {
        if (!symbol) return;

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError("");

        try {
            const safeTimeframe = String(timeframe || "3m").toLowerCase();
            const safeSteps = Math.min(Math.max(parseInt(steps, 10) || 3, 1), 30);
            const res = await apiClient.post(
                "/stocks/predict-chart",
                {
                    symbol,
                    timeframe: safeTimeframe,
                    steps: safeSteps,
                },
                {
                    signal: controller.signal,
                    retry: true,
                }
            );
            setPrediction(res.data);
            return res.data; // Return data for immediate imperative use
        } catch (err) {
            if (err?.name === "CanceledError" || err?.name === "AbortError") return null;
            console.error("Prediction error:", err);
            setError(err?.response?.data?.error || "Prediction failed");
            setPrediction(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    const clearPrediction = useCallback(() => {
        setPrediction(null);
        setError("");
    }, []);

    return { prediction, loading, error, predict, clearPrediction };
}

export default usePrediction;
