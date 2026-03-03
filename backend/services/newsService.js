const axios = require("axios");

const RSS_TIMEOUT_MS = Number(process.env.NEWS_TIMEOUT_MS) || 5000;
const DEFAULT_NEWS_LIMIT = 10;

function normalizeSymbol(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function buildSymbolCandidates(symbol) {
  const base = normalizeSymbol(symbol);
  if (!base) return [];

  const set = new Set();
  set.add(base);

  if (base === "NSEI") set.add("^NSEI");
  if (!base.includes(".") && !base.startsWith("^")) {
    set.add(`${base}.NS`);
    set.add(`${base}.BO`);
  }

  return Array.from(set);
}

function buildFeedUrls(symbol) {
  const encoded = encodeURIComponent(symbol);
  return [
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encoded}&region=IN&lang=en-IN`,
    `https://finance.yahoo.com/rss/headline?s=${encoded}`,
  ];
}

function decodeHtml(value) {
  if (!value) return "";
  return String(value)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function getTagValue(itemXml, tagName) {
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = itemXml.match(re);
  return match ? decodeHtml(match[1]) : "";
}

function parseYahooRss(xmlText, symbol) {
  if (!xmlText || typeof xmlText !== "string") return [];
  const items = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return items
    .map((item) => {
      const title = getTagValue(item, "title");
      const link = getTagValue(item, "link");
      const publishedAt = getTagValue(item, "pubDate");
      const source = getTagValue(item, "source") || "Yahoo Finance";
      const description = getTagValue(item, "description");
      return {
        symbol,
        title,
        link,
        source,
        description,
        publishedAt,
      };
    })
    .filter((entry) => entry.title);
}

function dedupeNews(newsList) {
  const seen = new Set();
  const out = [];
  for (const item of newsList) {
    const key = `${String(item.title || "").toLowerCase()}|${String(item.link || "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function fetchRss(url) {
  const response = await axios.get(url, {
    timeout: RSS_TIMEOUT_MS,
    headers: {
      "User-Agent": "TradeMindAI/1.0 (+https://example.com)",
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    responseType: "text",
    transformResponse: [(data) => data],
  });
  return typeof response.data === "string" ? response.data : "";
}

async function fetchYahooFinanceNews(symbol, limit = DEFAULT_NEWS_LIMIT) {
  const safeLimit = Math.max(3, Math.min(Number(limit) || DEFAULT_NEWS_LIMIT, 20));
  const symbolCandidates = buildSymbolCandidates(symbol);
  const collected = [];

  for (const ticker of symbolCandidates) {
    const feedUrls = buildFeedUrls(ticker);
    for (const url of feedUrls) {
      try {
        const xml = await fetchRss(url);
        const parsed = parseYahooRss(xml, ticker);
        if (parsed.length) {
          collected.push(...parsed);
        }
      } catch (_) {
        // Ignore individual feed failures and continue fallbacks.
      }
      if (collected.length >= safeLimit) break;
    }
    if (collected.length >= safeLimit) break;
  }

  const deduped = dedupeNews(collected).slice(0, safeLimit);
  return deduped;
}

// ──────────────────────────────────────────────────────────────────
// Macro / general-market news fetching (not stock-specific)
// ──────────────────────────────────────────────────────────────────

const MACRO_SEARCH_QUERIES = [
  "stock market OR inflation OR interest rate",
  "RBI OR Federal Reserve OR crude oil price",
  "global markets OR bond yields OR NIFTY",
  "FII DII OR currency rupee OR geopolitical",
];

/**
 * Build Google News RSS URLs for broad macro/market searches.
 * Google News RSS is reliable and returns rich results.
 */
function buildGoogleNewsFeedUrls() {
  return MACRO_SEARCH_QUERIES.map((q) => {
    const encoded = encodeURIComponent(q);
    return `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;
  });
}

/**
 * Parse a Google News RSS feed into normalized headline objects.
 */
function parseGoogleNewsRss(xmlText) {
  if (!xmlText || typeof xmlText !== "string") return [];
  const items = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return items
    .map((item) => {
      const rawTitle = getTagValue(item, "title");
      // Google News appends " - SourceName" at the end; split to get source
      const dashIdx = rawTitle.lastIndexOf(" - ");
      const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx).trim() : rawTitle;
      const source = dashIdx > 0 ? rawTitle.slice(dashIdx + 3).trim() : "Google News";
      const link = getTagValue(item, "link");
      const publishedAt = getTagValue(item, "pubDate");
      const description = getTagValue(item, "description")
        .replace(/<[^>]*>/g, " ") // strip HTML tags
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);

      return { symbol: "MACRO", title, link, source, description, publishedAt };
    })
    .filter((entry) => entry.title);
}

/**
 * Fetch broad market / macro news headlines from Google News RSS.
 * Returns up to `limit` de-duplicated headlines suitable for macro analysis.
 */
async function fetchMarketMacroNews(limit = 15) {
  const safeLimit = Math.max(5, Math.min(Number(limit) || 15, 30));
  const feedUrls = buildGoogleNewsFeedUrls();
  const collected = [];

  // Fetch all feeds in parallel for speed
  const results = await Promise.allSettled(
    feedUrls.map(async (url) => {
      try {
        const xml = await fetchRss(url);
        return parseGoogleNewsRss(xml);
      } catch (_) {
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      collected.push(...r.value);
    }
  }

  return dedupeNews(collected).slice(0, safeLimit);
}

// ──────────────────────────────────────────────────────────────────
// NewsAPI.org – general market news
// ──────────────────────────────────────────────────────────────────

const NEWS_API_KEY = process.env.NEWS_API_KEY || "";
const NEWS_API_BASE = "https://newsapi.org/v2/everything";
const NEWS_API_QUERY =
  "stock market OR inflation OR RBI OR Federal Reserve OR crude oil OR bond yields OR global markets OR Nifty OR Sensex OR Dow Jones OR Nasdaq";

/**
 * Fetch broad market news from NewsAPI.org.
 * Returns an array of { title, description, source, url, publishedAt, image }.
 */
async function fetchNewsApiMarketNews(limit = 20) {
  if (!NEWS_API_KEY || NEWS_API_KEY === "YOUR_NEWSAPI_KEY_HERE") {
    console.warn("[newsService] NEWS_API_KEY not set – skipping NewsAPI fetch");
    return [];
  }

  const safeLimit = Math.max(5, Math.min(Number(limit) || 20, 100));

  try {
    const response = await axios.get(NEWS_API_BASE, {
      timeout: RSS_TIMEOUT_MS,
      params: {
        q: NEWS_API_QUERY,
        language: "en",
        sortBy: "publishedAt",
        pageSize: safeLimit,
        apiKey: NEWS_API_KEY,
      },
    });

    const articles = response.data?.articles || [];

    return articles.map((a) => ({
      title: a.title || "",
      description: a.description || "",
      source: a.source?.name || "Unknown",
      url: a.url || "",
      publishedAt: a.publishedAt || "",
      image: a.urlToImage || "",
    }));
  } catch (err) {
    console.error("[newsService] NewsAPI error:", err.message);
    return [];
  }
}

module.exports = {
  fetchYahooFinanceNews,
  fetchMarketMacroNews,
  fetchNewsApiMarketNews,
  normalizeSymbol,
};

