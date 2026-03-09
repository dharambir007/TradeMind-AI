const INDEX_ALIASES = new Map([
  ["NIFTY", "^NSEI"],
  ["NIFTY50", "^NSEI"],
  ["NSEI", "^NSEI"],
  ["BANKNIFTY", "^NSEBANK"],
  ["NSEBANK", "^NSEBANK"],
  ["SENSEX", "^BSESN"],
  ["BSESN", "^BSESN"],
]);

function decodeSymbol(value) {
  let symbol = String(value || "").trim();
  if (!symbol) return "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decoded = decodeURIComponent(symbol);
      if (decoded === symbol) break;
      symbol = decoded;
    } catch (_) {
      break;
    }
  }

  return symbol;
}

function normalizeSymbol(value) {
  const decoded = decodeSymbol(value).trim().toUpperCase().replace(/\s+/g, "");
  if (!decoded) return "";

  const alias = INDEX_ALIASES.get(decoded);
  if (alias) return alias;
  if (decoded.startsWith("^")) return decoded;
  if (decoded.includes(".")) return decoded;
  return `${decoded}.NS`;
}

function stripExchangeSuffix(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\.(NS|BO)$/i, "");
}

function isDirectYahooSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  return (
    symbol.startsWith("^") ||
    symbol.endsWith("=X") ||
    symbol.endsWith("=F") ||
    symbol.endsWith("-USD")
  );
}

module.exports = {
  decodeSymbol,
  normalizeSymbol,
  stripExchangeSuffix,
  isDirectYahooSymbol,
};
