export const LANDING_FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "Real-time Signals",
    desc: "Live trade entries with sub-millisecond latency and precision confidence scoring across all major markets.",
    accent: "#00d4ff",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Risk Controls",
    desc: "Automated position sizing, intelligent stop-losses, and portfolio guardrails protecting every trade you make.",
    accent: "#8b5cf6",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
    title: "Clean Analytics",
    desc: "Distilled performance dashboards that surface what matters and eliminate noise from your trading workflow.",
    accent: "#10b981",
  },
];

export const LANDING_STATS = [
  { value: "87%", label: "Signal Accuracy", suffix: "" },
  { value: "150", label: "Avg Response", suffix: "ms" },
  { value: "50K", label: "Active Traders", suffix: "+" },
];

export const LANDING_LOGOS = ["Bloomberg", "Reuters", "NASDAQ", "NYSE", "NSE"];
