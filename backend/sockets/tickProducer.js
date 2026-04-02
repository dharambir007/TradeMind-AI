const WebSocket = require("ws");
const YahooFinance = require("yahoo-finance2").default;
const { normalizeSymbol } = require("../utils/symbolNormalizer");
const logger = require("../utils/logger");

const RECONNECT_DELAY = 5000;
const POLL_INTERVAL_MS = Number(process.env.MARKET_STREAM_FALLBACK_POLL_MS) || 12000;
const WS_STALE_MS = Number(process.env.MARKET_STREAM_STALE_MS) || 20000;
const DEFAULT_SYMBOLS = [
  "RELIANCE.NS",
  "TCS.NS",
  "INFY.NS",
  "HDFCBANK.NS",
  "ICICIBANK.NS",
  "HINDUNILVR.NS",
  "SBIN.NS",
  "BHARTIARTL.NS",
  "KOTAKBANK.NS",
  "ITC.NS",
];

const activeSymbols = new Set(DEFAULT_SYMBOLS);
const yahooFinance = new YahooFinance();

let sendTickFn = null;
let ws = null;
let reconnectTimer = null;
let pollTimer = null;
let pollStartTimer = null;
let lastWsTickAt = 0;

function clampUnixSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return Math.floor(Date.now() / 1000);
  }

  const seconds = numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.min(seconds, nowSeconds);
}

function emitTick(symbolInput, payload, transport) {
  const symbol = normalizeSymbol(symbolInput);
  if (!symbol || !sendTickFn) return;

  const price = Number(payload?.price);
  if (!Number.isFinite(price) || price <= 0) {
    return;
  }

  const close = Number(payload?.close);
  const safeClose = Number.isFinite(close) && close > 0 ? close : price;
  const change = Number(payload?.change);
  const computedChange = Number.isFinite(change) ? change : price - safeClose;
  const changePercent = Number(payload?.changePercent);
  const computedChangePercent =
    Number.isFinite(changePercent) && Number.isFinite(computedChange)
      ? changePercent
      : safeClose > 0
        ? Number(((computedChange / safeClose) * 100).toFixed(2))
        : 0;

  if (transport === "websocket") {
    lastWsTickAt = Date.now();
  }

  sendTickFn(symbol, {
    symbol,
    price: Number(price.toFixed(2)),
    close: Number(safeClose.toFixed(2)),
    change: Number(computedChange.toFixed(2)),
    changePercent: Number(computedChangePercent.toFixed(2)),
    volume: Number(payload?.volume) || 0,
    dayHigh: Number(payload?.dayHigh) || 0,
    dayLow: Number(payload?.dayLow) || 0,
    time: clampUnixSeconds(payload?.time),
    receivedAt: Date.now(),
    isLive: transport === "websocket",
    streamStatus: transport === "websocket" ? "live" : "fallback",
    streamTransport: transport,
    streamProvider: "yahoo",
  });
}

function decodeYahooMessage(buf) {
  try {
    let offset = 0;
    const result = {};

    while (offset < buf.length) {
      const byte = buf[offset++];
      const fieldNumber = byte >> 3;
      const wireType = byte & 0x07;

      if (wireType === 2) {
        let len = 0;
        let shift = 0;
        let nextByte = 0;
        do {
          nextByte = buf[offset++];
          len |= (nextByte & 0x7f) << shift;
          shift += 7;
        } while (nextByte & 0x80);

        const value = buf.slice(offset, offset + len).toString("utf8");
        offset += len;
        if (fieldNumber === 1) result.id = value;
      } else if (wireType === 5) {
        const value = buf.readFloatLE(offset);
        offset += 4;
        if (fieldNumber === 2) result.price = Number(value.toFixed(2));
        else if (fieldNumber === 4) result.change = Number(value.toFixed(2));
        else if (fieldNumber === 5) result.dayHigh = Number(value.toFixed(2));
        else if (fieldNumber === 6) result.dayLow = Number(value.toFixed(2));
        else if (fieldNumber === 8) result.changePercent = Number(value.toFixed(2));
      } else if (wireType === 0) {
        let value = 0;
        let shift = 0;
        let nextByte = 0;
        do {
          nextByte = buf[offset++];
          value |= (nextByte & 0x7f) << shift;
          shift += 7;
        } while (nextByte & 0x80);

        if (fieldNumber === 3) result.time = value;
        else if (fieldNumber === 7) result.volume = value;
      } else if (wireType === 1) {
        offset += 8;
      } else {
        break;
      }
    }

    return result;
  } catch {
    return null;
  }
}

function connectYahooWs(symbols = [...activeSymbols]) {
  ws = new WebSocket("wss://streamer.finance.yahoo.com");

  ws.on("open", () => {
    logger.info("[market-stream] Yahoo Finance WebSocket connected");
    subscribeSymbols(symbols);
  });

  ws.on("message", (raw) => {
    try {
      const data = decodeYahooMessage(Buffer.from(raw.toString(), "base64"));
      if (!data?.id || !data?.price) return;

      emitTick(data.id, data, "websocket");
    } catch (error) {
      logger.warn("[market-stream] Failed to decode Yahoo tick:", error.message);
    }
  });

  ws.on("error", (error) => {
    logger.warn("[market-stream] Yahoo WS error:", error.message);
  });

  ws.on("close", () => {
    logger.warn("[market-stream] Yahoo WS disconnected, reconnecting...");
    reconnectTimer = setTimeout(() => connectYahooWs(), RECONNECT_DELAY);
  });
}

async function pollQuotes() {
  if (lastWsTickAt && Date.now() - lastWsTickAt < WS_STALE_MS) {
    return;
  }

  const symbols = [...activeSymbols];
  if (!symbols.length || !sendTickFn) {
    return;
  }

  const batchSize = 5;
  for (let index = 0; index < symbols.length; index += batchSize) {
    const batch = symbols.slice(index, index + batchSize);

    try {
      const results = await Promise.allSettled(
        batch.map((symbol) => yahooFinance.quote(symbol).catch(() => null))
      );

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value?.regularMarketPrice) {
          continue;
        }

        const quote = result.value;
        emitTick(
          quote.symbol,
          {
            price: quote.regularMarketPrice,
            close: quote.regularMarketPreviousClose,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            time: Date.now(),
          },
          "polling"
        );
      }
    } catch (error) {
      logger.warn("[market-stream] Poll fallback batch failed:", error.message);
    }
  }
}

function startTickProducer(sendTick) {
  sendTickFn = sendTick;
  lastWsTickAt = 0;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (pollStartTimer) {
    clearTimeout(pollStartTimer);
  }

  if (pollTimer) {
    clearInterval(pollTimer);
  }

  if (ws) {
    try {
      ws.terminate();
    } catch {
      // no-op
    }
    ws = null;
  }

  connectYahooWs([...activeSymbols]);

  pollStartTimer = setTimeout(() => {
    pollQuotes();
    pollTimer = setInterval(pollQuotes, POLL_INTERVAL_MS);
  }, 5000);
}

function subscribeSymbols(symbols) {
  if (!Array.isArray(symbols) || !symbols.length) return;

  const normalizedSymbols = symbols.map((symbol) => normalizeSymbol(symbol));
  for (const symbol of normalizedSymbols) {
    activeSymbols.add(symbol);
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ subscribe: normalizedSymbols }));
  }
}

function unsubscribeSymbols(symbols) {
  if (!Array.isArray(symbols) || !symbols.length) return;

  const normalizedSymbols = symbols.map((symbol) => normalizeSymbol(symbol));
  for (const symbol of normalizedSymbols) {
    if (!DEFAULT_SYMBOLS.includes(symbol)) {
      activeSymbols.delete(symbol);
    }
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ unsubscribe: normalizedSymbols }));
  }
}

module.exports = {
  startTickProducer,
  subscribeSymbols,
  unsubscribeSymbols,
  DEFAULT_SYMBOLS,
};
