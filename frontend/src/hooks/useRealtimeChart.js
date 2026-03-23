import { useEffect, useRef, useCallback } from "react";
import {
    getTimeframeIntervalMinutes,
    mergeTickIntoCandles,
    normalizeTickTimestampMs,
    sortAndDeduplicateCandles,
} from "../utils/liveCandles";

const INTRADAY_INTERVAL_SECONDS = Object.freeze({
    "1m": 60,
    "2m": 120,
    "5m": 300,
    "10m": 600,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
});
const DATE_BUCKET_INTERVALS = new Set(["1d", "1wk", "1mo"]);
const DEFAULT_INTERVAL_KEY = "1m";
const warnedInvalidIntervals = new Set();

export function useRealtimeChart({
    tick,
    candleSeriesRef,
    volumeSeriesRef,
    interval,
    onTickUpdate,
    realCandlesRef,
    predictedCandlesRef,
    syncPredictionSeries,
    onPredictionConsumed,
    onAllPredictionsConsumed,
}) {
    const lastCandleRef = useRef(null);
    const consumeRafRef = useRef(null);
    const lastEmittedPriceRef = useRef(null); // prevent duplicate state updates
    const onTickUpdateRef = useRef(onTickUpdate);
    const syncPredRef = useRef(syncPredictionSeries);
    const onPredConsumedRef = useRef(onPredictionConsumed);
    const onAllPredConsumedRef = useRef(onAllPredictionsConsumed);

    // Keep callback refs fresh without triggering effect re-runs
    useEffect(() => { onTickUpdateRef.current = onTickUpdate; });
    useEffect(() => { syncPredRef.current = syncPredictionSeries; });
    useEffect(() => { onPredConsumedRef.current = onPredictionConsumed; });
    useEffect(() => { onAllPredConsumedRef.current = onAllPredictionsConsumed; });

    const cancelDeferredConsume = useCallback(() => {
        if (consumeRafRef.current) {
            cancelAnimationFrame(consumeRafRef.current);
            consumeRafRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!tick || !candleSeriesRef?.current) return;

        const price = Number(tick.price);
        if (!Number.isFinite(price) || price <= 0) return;

        const parsedVolume = Number(tick.volume);
        const parsedChange = Number(tick.change);
        const parsedChangePercent = Number(tick.changePercent);
        const volume = Number.isFinite(parsedVolume) ? parsedVolume : 0;
        const change = Number.isFinite(parsedChange) ? parsedChange : 0;
        const changePercent = Number.isFinite(parsedChangePercent) ? parsedChangePercent : 0;
        const timestampMs = normalizeTickTimestampMs(tick.time);
        const tickTimeSeconds = Math.floor(timestampMs / 1000);

        const normalizedInterval = normalizeIntervalKey(interval, "useRealtimeChart");
        const intervalMinutes = getTimeframeIntervalMinutes(normalizedInterval);

        let updatedCandle;
        let isNewPeriod = false;

        if (Number.isFinite(intervalMinutes)) {
            const merged = mergeTickIntoCandles({
                candles: realCandlesRef.current,
                price,
                timestampMs,
                intervalMinutes,
                intervalLabel: normalizedInterval,
                volume,
                enableLogs: true,
            });

            if (merged.ignored || !merged.latestCandle) {
                return;
            }

            updatedCandle = merged.latestCandle;
            isNewPeriod = merged.isNewCandle;
            realCandlesRef.current = merged.candles;
            lastCandleRef.current = updatedCandle;
        } else {
            const candleTime = getCandleTime(tickTimeSeconds, normalizedInterval);
            const lastCandle = lastCandleRef.current;
            isNewPeriod = !lastCandle || lastCandle.time !== candleTime;

            if (!isNewPeriod) {
                updatedCandle = {
                    time: candleTime,
                    open: lastCandle.open,
                    high: Math.max(lastCandle.high, price),
                    low: Math.min(lastCandle.low, price),
                    close: price,
                };
            } else {
                updatedCandle = {
                    time: candleTime,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                };
            }

            lastCandleRef.current = updatedCandle;

            const reals = sortAndDeduplicateCandles(realCandlesRef.current);
            if (reals.length && reals[reals.length - 1].time === candleTime) {
                reals[reals.length - 1] = updatedCandle;
            } else {
                reals.push(updatedCandle);
            }
            realCandlesRef.current = reals;
        }

        try {
            candleSeriesRef.current.update(updatedCandle);
        } catch {
            // Series may not be ready during initial mount.
        }

        // consume predicted candles that are now in the past
        if (isNewPeriod && predictedCandlesRef.current.length) {
            const realTimeNum = timeToNum(updatedCandle.time);

            const remaining = [];
            let consumedCount = 0;
            for (const pc of predictedCandlesRef.current) {
                if (timeToNum(pc.time) <= realTimeNum) {
                    consumedCount++;
                } else {
                    remaining.push(pc);
                }
            }

            if (consumedCount > 0) {
                cancelDeferredConsume();
                consumeRafRef.current = requestAnimationFrame(() => {
                    consumeRafRef.current = null;

                    if (!predictedCandlesRef.current.length && !remaining.length) return;

                    remaining.sort((a, b) => timeToNum(a.time) - timeToNum(b.time));
                    predictedCandlesRef.current = remaining;

                    syncPredRef.current?.();

                    if (!remaining.length) {
                        onAllPredConsumedRef.current?.();
                    } else {
                        onPredConsumedRef.current?.();
                    }
                });
            }
        }

        if (volumeSeriesRef?.current) {
            const isUp = updatedCandle.close >= updatedCandle.open;
            try {
                volumeSeriesRef.current.update({
                    time: updatedCandle.time,
                    value: volume,
                    color: isUp ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)",
                });
            } catch { /* noop */ }
        }

        // Only notify parent when price actually changes (prevents re-render cascade)
        if (lastEmittedPriceRef.current !== price) {
            lastEmittedPriceRef.current = price;
            onTickUpdateRef.current?.({
                price,
                change,
                changePercent,
                volume,
                time: tickTimeSeconds,
            });
        }
    }, [tick, interval]);

    useEffect(() => {
        lastCandleRef.current = null;
        cancelDeferredConsume();
    }, [interval, cancelDeferredConsume]);

    useEffect(() => cancelDeferredConsume, [cancelDeferredConsume]);
}

// convert lightweight-charts time to comparable number
function timeToNum(t) {
    if (typeof t === "number") return t;
    if (typeof t === "string") {
        const ms = Date.parse(t + "T00:00:00Z");
        return Number.isFinite(ms) ? ms / 1000 : 0;
    }
    return 0;
}

// get time bucket for candle based on interval
function getCandleTime(unixSeconds, interval) {
    const intervalKey = normalizeIntervalKey(interval, "getCandleTime");

    if (DATE_BUCKET_INTERVALS.has(intervalKey)) {
        const d = new Date(unixSeconds * 1000);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    // Intraday: round to interval boundary (in seconds)
    const intervalSeconds = parseIntervalSeconds(intervalKey);
    return Math.floor(unixSeconds / intervalSeconds) * intervalSeconds;
}

function parseIntervalSeconds(interval) {
    const intervalKey = normalizeIntervalKey(interval, "parseIntervalSeconds");
    const seconds = INTRADAY_INTERVAL_SECONDS[intervalKey];
    if (Number.isFinite(seconds)) {
        return seconds;
    }

    // Daily/weekly/monthly intervals are date-bucketed before this function.
    return INTRADAY_INTERVAL_SECONDS[DEFAULT_INTERVAL_KEY];
}

function normalizeIntervalKey(rawInterval, source) {
    const key = typeof rawInterval === "string"
        ? rawInterval.trim()
        : String(rawInterval ?? "").trim();

    if (INTRADAY_INTERVAL_SECONDS[key] || DATE_BUCKET_INTERVALS.has(key)) {
        return key;
    }

    if (import.meta.env.DEV) {
        const warnKey = `${source}:${String(rawInterval)}`;
        if (!warnedInvalidIntervals.has(warnKey)) {
            warnedInvalidIntervals.add(warnKey);
            console.warn("[useRealtimeChart] Invalid interval received, using fallback.", {
                source,
                received: rawInterval,
                fallback: DEFAULT_INTERVAL_KEY,
            });
        }
    }

    return DEFAULT_INTERVAL_KEY;
}

export default useRealtimeChart;
