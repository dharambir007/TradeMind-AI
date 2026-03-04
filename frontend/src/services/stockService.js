import apiClient from "./api";

export const stockService = {
  async getStock(symbol) {
    const response = await apiClient.get(`/stocks/${symbol}`);
    return response.data;
  },

  async getStockHistory(symbol, range = "1d", interval = "5m") {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/history`, {
      params: { range: range || "1d", interval: interval || "5m" },
    });
    return response.data;
  },

  async searchStocks(query) {
    const response = await apiClient.get(`/stocks/search?q=${encodeURIComponent(query)}`);
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
