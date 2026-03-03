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

// get currency symbol from ISO code
export function getCurrencySymbol(code) {
  if (!code) return "₹";
  const upper = code.toUpperCase();
  return CURRENCY_SYMBOLS[upper] || `${upper} `;
}

// format price with currency symbol
export function formatPrice(value, currency) {
  if (value == null || isNaN(value)) return "-";
  const sym = getCurrencySymbol(currency);
  const code = (currency || "INR").toUpperCase();
  if (code === "INR") {
    return `${sym}${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${sym}${Number(value).toFixed(2)}`;
}
