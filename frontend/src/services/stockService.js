import apiClient from "./api";

export const stockService = {
  // Get stock details
  async getStock(symbol) {
    const response = await apiClient.get(`/stocks/${symbol}`);
    return response.data;
  },

  // Get stock price history (candles)
  async getStockHistory(symbol) {
    const response = await apiClient.get(`/stocks/${symbol}/history`);
    return response.data;
  },

  // Search stocks
  async searchStocks(query) {
    const response = await apiClient.get(`/stocks/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Get watchlist
  async getWatchlist() {
    const response = await apiClient.get("/watchlist");
    return response.data;
  },

  // Add to watchlist
  async addToWatchlist(symbol) {
    const response = await apiClient.post("/watchlist", { symbol });
    return response.data;
  },

  // Remove from watchlist
  async removeFromWatchlist(symbol) {
    const response = await apiClient.delete(`/watchlist/${symbol}`);
    return response.data;
  },
};

export default stockService;
