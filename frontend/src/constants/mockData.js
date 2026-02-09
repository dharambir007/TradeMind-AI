// Mock stock data for fallback when API is unavailable
export const MOCK_STOCK = {
  symbol: "AAPL",
  name: "Apple Inc.",
  price: 182.24,
  change: -1.12,
  changePercent: -0.61,
  marketCap: "2.9T",
  volume: "52.1M",
};

// Mock candlestick data
export const MOCK_CANDLES = [
  { time: "2025-01-10", open: 182.9, high: 184.2, low: 181.6, close: 182.4 },
  { time: "2025-01-13", open: 182.4, high: 183.8, low: 180.9, close: 181.7 },
  { time: "2025-01-14", open: 181.7, high: 183.1, low: 181.4, close: 182.9 },
  { time: "2025-01-15", open: 182.9, high: 184.0, low: 182.0, close: 183.6 },
  { time: "2025-01-16", open: 183.6, high: 185.3, low: 183.0, close: 184.8 },
  { time: "2025-01-17", open: 184.8, high: 185.6, low: 183.7, close: 184.1 },
  { time: "2025-01-21", open: 184.1, high: 186.0, low: 183.9, close: 185.6 },
  { time: "2025-01-22", open: 185.6, high: 186.2, low: 184.2, close: 184.7 },
  { time: "2025-01-23", open: 184.7, high: 185.8, low: 184.0, close: 185.2 },
  { time: "2025-01-24", open: 185.2, high: 186.9, low: 184.9, close: 186.4 },
];

// Mock watchlist data
export const MOCK_WATCHLIST = [
  { symbol: "MSFT", price: 388.14, changePercent: 0.82 },
  { symbol: "GOOGL", price: 142.18, changePercent: -0.35 },
  { symbol: "TSLA", price: 213.64, changePercent: 1.21 },
  { symbol: "NVDA", price: 585.42, changePercent: 2.48 },
];

// Landing page features
export const LANDING_FEATURES = [
  { icon: "⚡", title: "Real-time signals", desc: "Live entries with millisecond latency and clear confidence scores." },
  { icon: "🛡️", title: "Risk controls", desc: "Auto sizing, smart stops, and guardrails to protect every trade." },
  { icon: "📊", title: "Clean analytics", desc: "Simple performance views to spot what works and cut noise." },
];

// Landing page stats
export const LANDING_STATS = [
  { value: "87%", label: "Signal win rate" },
  { value: "150ms", label: "Avg response" },
  { value: "50K+", label: "Active traders" },
];
