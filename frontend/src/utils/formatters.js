/**
 * Map ISO 4217 currency codes to their display symbols.
 * Covers the most common trading currencies.
 */
const CURRENCY_SYMBOLS = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  HKD: "HK$",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF ",
  BRL: "R$",
  ZAR: "R",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  TWD: "NT$",
  THB: "฿",
  MYR: "RM",
  IDR: "Rp",
  PHP: "₱",
  SAR: "﷼",
  AED: "د.إ",
  BDT: "৳",
  PKR: "₨",
  LKR: "₨",
  NPR: "₨",
};

/**
 * Get the currency symbol for a given ISO currency code.
 * Falls back to the code itself (e.g. "XYZ ") if unknown.
 */
export function getCurrencySymbol(code) {
  if (!code) return "₹";
  const upper = code.toUpperCase();
  return CURRENCY_SYMBOLS[upper] || `${upper} `;
}

/**
 * Format a price with the correct currency symbol.
 * e.g. formatPrice(2945.30, "INR") → "₹2,945.30"
 */
export function formatPrice(value, currency) {
  if (value == null || isNaN(value)) return "-";
  const sym = getCurrencySymbol(currency);
  const code = (currency || "INR").toUpperCase();
  // Use Indian locale for INR
  if (code === "INR") {
    return `${sym}${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${sym}${Number(value).toFixed(2)}`;
}
