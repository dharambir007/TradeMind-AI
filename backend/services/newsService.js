const { normalizeSymbol, stripExchangeSuffix } = require("../utils/symbolNormalizer");
const { createHttpClient, withRetry } = require("../utils/httpClient");
const CacheService = require("./cacheService");

const NEWS_TIMEOUT_MS = Number(process.env.NEWS_TIMEOUT_MS) || 5000;
const NEWS_API_KEY = process.env.NEWS_API_KEY || "";
const NEWS_API_BASE = "https://newsapi.org/v2/everything";
const DEFAULT_STOCK_NEWS_LIMIT = 10;
const DEFAULT_MARKET_NEWS_LIMIT = 20;

const newsClient = createHttpClient({
  timeout: NEWS_TIMEOUT_MS,
  headers: {
    "User-Agent": "TradeMindAI/1.0",
    Accept: "application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
});

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

function dedupeNews(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${String(item.title || "").toLowerCase()}|${String(item.url || item.link || "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildStockFeedUrls(symbol) {
  const encoded = encodeURIComponent(symbol);
  return [
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encoded}&region=IN&lang=en-IN`,
    `https://finance.yahoo.com/rss/headline?s=${encoded}`,
  ];
}

async function fetchRss(url) {
  const response = await withRetry(
    () =>
      newsClient.get(url, {
        responseType: "text",
        transformResponse: [(value) => value],
      }),
    { retries: 2, delayMs: 250 }
  );

  return typeof response.data === "string" ? response.data : "";
}

function parseYahooRss(xmlText, symbol) {
  const items = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items
    .map((item) => ({
      symbol,
      title: getTagValue(item, "title"),
      description: getTagValue(item, "description"),
      source: getTagValue(item, "source") || "Yahoo Finance",
      url: getTagValue(item, "link"),
      publishedAt: getTagValue(item, "pubDate"),
      image: "",
    }))
    .filter((item) => item.title);
}

function parseGoogleNewsRss(xmlText) {
  const items = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return items
    .map((item) => {
      const rawTitle = getTagValue(item, "title");
      const separatorIndex = rawTitle.lastIndexOf(" - ");
      const title = separatorIndex > 0 ? rawTitle.slice(0, separatorIndex).trim() : rawTitle;
      const source = separatorIndex > 0 ? rawTitle.slice(separatorIndex + 3).trim() : "Google News";

      return {
        title,
        description: getTagValue(item, "description").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
        source,
        url: getTagValue(item, "link"),
        publishedAt: getTagValue(item, "pubDate"),
        image: "",
      };
    })
    .filter((item) => item.title);
}

async function fetchYahooFinanceNews(symbol, limit = DEFAULT_STOCK_NEWS_LIMIT) {
  const normalized = normalizeSymbol(symbol);
  const baseSymbol = stripExchangeSuffix(normalized);
  const candidates = normalized.startsWith("^")
    ? [normalized]
    : [normalized, `${baseSymbol}.BO`];

  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_STOCK_NEWS_LIMIT, 1), 20);
  const collected = [];

  for (const candidate of candidates) {
    const urls = buildStockFeedUrls(candidate);
    for (const url of urls) {
      try {
        const xml = await fetchRss(url);
        collected.push(...parseYahooRss(xml, candidate));
      } catch (_) {
        // Continue through fallbacks.
      }
      if (collected.length >= safeLimit) break;
    }
    if (collected.length >= safeLimit) break;
  }

  return dedupeNews(collected).slice(0, safeLimit);
}

async function getStockNews(symbol, limit = DEFAULT_STOCK_NEWS_LIMIT) {
  const normalized = normalizeSymbol(symbol);
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_STOCK_NEWS_LIMIT, 1), 20);

  return CacheService.remember(`news:stock:${normalized}:${safeLimit}`, 600, async () => {
    const news = await fetchYahooFinanceNews(normalized, safeLimit);
    return {
      success: true,
      symbol: normalized,
      count: news.length,
      news,
      timestamp: new Date().toISOString(),
    };
  });
}

async function fetchNewsApiMarketNews(limit = DEFAULT_MARKET_NEWS_LIMIT) {
  if (!NEWS_API_KEY) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_MARKET_NEWS_LIMIT, 1), 50);
  const response = await withRetry(
    () =>
      newsClient.get(NEWS_API_BASE, {
        params: {
          q: "stock market OR inflation OR RBI OR Federal Reserve OR crude oil OR bond yields OR Nifty OR Sensex",
          language: "en",
          sortBy: "publishedAt",
          pageSize: safeLimit,
          apiKey: NEWS_API_KEY,
        },
      }),
    { retries: 2, delayMs: 250 }
  );

  return (response.data?.articles || []).map((article) => ({
    title: article.title || "",
    description: article.description || "",
    source: article.source?.name || "News API",
    url: article.url || "",
    publishedAt: article.publishedAt || "",
    image: article.urlToImage || "",
  }));
}

async function fetchMarketMacroNews(limit = 15) {
  const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 30);
  const queries = [
    "stock market OR inflation OR interest rate",
    "RBI OR Federal Reserve OR crude oil price",
    "global markets OR bond yields OR NIFTY",
    "FII DII OR rupee OR geopolitical",
  ];

  const urls = queries.map((query) => `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`);
  const results = await Promise.allSettled(urls.map((url) => fetchRss(url)));
  const combined = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      combined.push(...parseGoogleNewsRss(result.value));
    }
  }

  return dedupeNews(combined).slice(0, safeLimit);
}

async function getMarketNews(limit = DEFAULT_MARKET_NEWS_LIMIT) {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_MARKET_NEWS_LIMIT, 1), 50);

  return CacheService.remember(`news:market:${safeLimit}`, 600, async () => {
    let news = [];

    try {
      news = await fetchNewsApiMarketNews(safeLimit);
    } catch (_) {
      news = [];
    }

    if (!news.length) {
      news = await fetchMarketMacroNews(safeLimit);
    }

    return {
      success: true,
      count: news.length,
      news,
      timestamp: new Date().toISOString(),
    };
  });
}

module.exports = {
  fetchYahooFinanceNews,
  fetchMarketMacroNews,
  fetchNewsApiMarketNews,
  getStockNews,
  getMarketNews,
};
