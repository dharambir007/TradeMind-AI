import apiClient from "./api";

export const stockService = {
  async getStock(symbol) {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}`);
    return response.data;
  },

  async getStockHistory(symbol, range = "1d", interval = "5m") {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/history`, {
      params: { range: range || "1d", interval: interval || "5m" },
    });
    return response.data;
  },

  async getTradingChart(symbol, { range = "1d", interval = "5m" } = {}) {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/history`, {
      params: { range: range || "1d", interval: interval || "5m" },
    });
    return response.data;
  },

  async getChartPrediction(symbol, { timeframe = "3m", steps = 3 } = {}) {
    const response = await apiClient.post(
      "/stocks/predict-chart",
      {
        symbol,
        timeframe: timeframe || "3m",
        steps: steps || 3,
      },
      {
        retry: true,
      }
    );
    return response.data;
  },

  async searchStocks(query) {
    const response = await apiClient.get(`/stocks/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  async getPrediction(symbol) {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/prediction`);
    return response.data;
  },

  async getStockNews(symbol) {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/news`);
    return response.data;
  },

  async getWatchlist() {
    const response = await apiClient.get("/watchlist");
    return response.data;
  },

  async addToWatchlist(symbol) {
    const response = await apiClient.post("/watchlist", { symbol });
    return response.data;
  },

  async removeFromWatchlist(symbol) {
    const response = await apiClient.delete(`/watchlist/${symbol}`);
    return response.data;
  },
};

export default stockService;
