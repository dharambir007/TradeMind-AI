import apiClient from "./api";

export async function fetchAIInsight(symbol, options = {}) {
    const payload = {
        symbol: String(symbol || "").trim().toUpperCase(),
        limit: Math.min(Math.max(Number(options.limit) || 10, 5), 20),
    };

    if (options.forceRefresh === true) {
        payload.forceRefresh = true;
    }

    const response = await apiClient.post("/ai-insight", payload, {
        signal: options.signal,
        retry: true,
    });

    return response.data;
}

export default {
    fetchAIInsight,
};
