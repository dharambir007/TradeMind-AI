const WebSocket = require("ws");
let ws;
let reconnectTimer;
const RECONNECT_DELAY = 5000;
const DEFAULT_SYMBOLS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS", "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS", "ITC.NS"];

function startTickProducer(sendTick) {
  function connect() {
    ws = new WebSocket("wss://streamer.finance.yahoo.com");
    ws.on("open", () => {
      console.log("Yahoo Finance WebSocket connected");
      ws.send(JSON.stringify({ subscribe: DEFAULT_SYMBOLS }));
    });
    ws.on("message", (raw) => {
      try {
        const buf = Buffer.from(raw.toString(), "base64");
        const data = decodeYahooMessage(buf);
        if (data && data.id && data.price) {
          sendTick(data.id, { symbol: data.id, price: data.price, change: data.change || 0, changePercent: data.changePercent || 0, volume: data.volume || 0, dayHigh: data.dayHigh || 0, dayLow: data.dayLow || 0, time: data.time || Date.now() });
        }
      } catch (err) {}
    });
    ws.on("error", (err) => { console.error("Yahoo WS error:", err.message); });
    ws.on("close", () => {
      console.log("Yahoo WS disconnected, reconnecting...");
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
    });
  }
  connect();
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
        if (fieldNumber === 3) result.time = value * 1000;
        else if (fieldNumber === 7) result.volume = value;
      } else if (wireType === 1) offset += 8;
      else break;
    }
    return result;
  } catch { return null; }
}

function subscribeSymbols(symbols) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ subscribe: symbols }));
}
function unsubscribeSymbols(symbols) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ unsubscribe: symbols }));
}

module.exports = { startTickProducer, subscribeSymbols, unsubscribeSymbols, DEFAULT_SYMBOLS };
