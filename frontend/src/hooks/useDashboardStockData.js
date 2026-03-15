import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../services/api";

const MOCK_STOCK_BASE = {
  symbol: "RELIANCE",
  name: "Sample Stock",
  price: 2945.3,
  change: 18.75,
  changePercent: 0.64,
  marketCap: "19.92L Cr",
  volume: "1.12Cr",
  currency: "INR",
};

export default function useDashboardStockData(routeSymbol) {
  const symbol = useMemo(() => {
    const raw = String(routeSymbol || "").trim();
    if (!raw) return "RELIANCE";
    try {
      return decodeURIComponent(raw).toUpperCase();
    } catch {
      return raw.toUpperCase();
    }
  }, [routeSymbol]);

  const buildFallbackStock = useCallback(
    (targetSymbol) => ({
      ...MOCK_STOCK_BASE,
      symbol: targetSymbol,
      name: `${targetSymbol} (Sample Data)`,
    }),
    []
  );

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const stockRes = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}`, {
          signal: controller.signal,
        });

        const fetchedStock = stockRes?.data;
        const hasStock =
          fetchedStock &&
          fetchedStock.success !== false &&
          Number.isFinite(Number(fetchedStock.price));

        if (!active) return;

        if (hasStock) {
          setStock(fetchedStock);
          setUsingMock(false);
        } else {
          setStock(buildFallbackStock(symbol));
          setUsingMock(true);
        }
        setError("");
      } catch (err) {
        if (!active || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        console.error("Failed to load live data", err);
        setError("Live data unavailable. Showing sample data.");
        setStock(buildFallbackStock(symbol));
        setUsingMock(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [symbol, buildFallbackStock]);

  return {
    symbol,
    stock,
    loading,
    error,
    usingMock,
  };
}
