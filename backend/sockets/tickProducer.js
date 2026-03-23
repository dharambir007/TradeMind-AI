const WebSocket = require("ws");
const YahooFinance = require("yahoo-finance2").default;

let ws;
let reconnectTimer;
let pollTimer;
let sendTickFn;
let lastWsTick = 0;

const RECONNECT_DELAY = 5000;
const POLL_INTERVAL_MS = 12000;      // Poll every 12 seconds as fallback
const WS_STALE_MS = 20000;           // Consider WS stale after 20s of silence
const DEFAULT_SYMBOLS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS", "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS", "ITC.NS"];
const activeSymbols = new Set(DEFAULT_SYMBOLS);
const yahooFinance = new YahooFinance();

function startTickProducer(sendTick) {
  sendTickFn = sendTick;
  connectWs();
  // Start polling fallback after a short delay (give WS time to connect)
  setTimeout(() => {
    pollQuotes(); // first poll immediately
    pollTimer = setInterval(pollQuotes, POLL_INTERVAL_MS);
  }, 5000);
}

function connectWs() {
  ws = new WebSocket("wss://streamer.finance.yahoo.com");
  ws.on("open", () => {
    console.log("Yahoo Finance WebSocket connected");
    ws.send(JSON.stringify({ subscribe: [...activeSymbols] }));
  });
  ws.on("message", (raw) => {
    try {
      const buf = Buffer.from(raw.toString(), "base64");
      const data = decodeYahooMessage(buf);
      if (data && data.id && data.price) {
        lastWsTick = Date.now();
        sendTickFn(data.id, { symbol: data.id, price: data.price, change: data.change || 0, changePercent: data.changePercent || 0, volume: data.volume || 0, dayHigh: data.dayHigh || 0, dayLow: data.dayLow || 0, time: data.time || Date.now() });
      }
    } catch (err) {}
  });
  ws.on("error", (err) => { console.error("Yahoo WS error:", err.message); });
  ws.on("close", () => {
    console.log("Yahoo WS disconnected, reconnecting...");
    reconnectTimer = setTimeout(connectWs, RECONNECT_DELAY);
  });
}

/**
 * Polling fallback: when the Yahoo WebSocket hasn't delivered ticks recently,
 * fetch current quotes via the REST API and push them as ticks.
 */
async function pollQuotes() {
  // Skip polling if WebSocket is actively delivering data
  if (lastWsTick && Date.now() - lastWsTick < WS_STALE_MS) return;

  const symbols = [...activeSymbols];
  if (!symbols.length || !sendTickFn) return;

  console.log(`[Poll fallback] Fetching quotes for ${symbols.length} symbols...`);

  // Process in batches of 5 to respect rate limits
  const BATCH = 5;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    try {
      const results = await Promise.allSettled(
        batch.map(s => yahooFinance.quote(s).catch(() => null))
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          const q = result.value;
          if (q.regularMarketPrice) {
            sendTickFn(q.symbol, {
              symbol: q.symbol,
              price: q.regularMarketPrice,
              change: parseFloat((q.regularMarketChange || 0).toFixed(2)),
              changePercent: parseFloat((q.regularMarketChangePercent || 0).toFixed(2)),
              volume: q.regularMarketVolume || 0,
              dayHigh: q.regularMarketDayHigh || 0,
              dayLow: q.regularMarketDayLow || 0,
              time: Date.now(),
            });
          }
        }
      }
    } catch (err) {
      console.error("[Poll fallback] Batch error:", err.message);
    }
  }
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
        let len = 0, shift = 0, b;
        do { b = buf[offset++]; len |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
        const value = buf.slice(offset, offset + len).toString("utf-8");
        offset += len;
        if (fieldNumber === 1) result.id = value;
      } else if (wireType === 5) {
        const value = buf.readFloatLE(offset);
        offset += 4;
        if (fieldNumber === 2) result.price = parseFloat(value.toFixed(2));
        else if (fieldNumber === 4) result.change = parseFloat(value.toFixed(2));
        else if (fieldNumber === 5) result.dayHigh = parseFloat(value.toFixed(2));
        else if (fieldNumber === 6) result.dayLow = parseFloat(value.toFixed(2));
        else if (fieldNumber === 8) result.changePercent = parseFloat(value.toFixed(2));
      } else if (wireType === 0) {
        let value = 0, shift = 0, b;
        do { b = buf[offset++]; value |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
        if (fieldNumber === 3) result.time = value; // Unix seconds — do NOT multiply; frontend reads as seconds
        else if (fieldNumber === 7) result.volume = value;
      } else if (wireType === 1) offset += 8;
      else break;
    }
    return result;
  } catch { return null; }
}

function subscribeSymbols(symbols) {
  if (Array.isArray(symbols)) symbols.forEach(s => activeSymbols.add(s));
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ subscribe: symbols }));
}
function unsubscribeSymbols(symbols) {
  if (Array.isArray(symbols)) symbols.forEach(s => {
    if (!DEFAULT_SYMBOLS.includes(s)) activeSymbols.delete(s);
  });
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ unsubscribe: symbols }));
}

module.exports = { startTickProducer, subscribeSymbols, unsubscribeSymbols, DEFAULT_SYMBOLS };
