const { Server } = require("socket.io");
const { redis, cache } = require("../config/redis");
const Redis = require("ioredis");
const { isAllowedOrigin } = require("../config/cors");
const { startTickProducer, subscribeSymbols, unsubscribeSymbols } = require("./tickProducer");

let io;
let subscriber;

function normalizeSocketSymbol(raw) {
  const symbol = String(raw || "").trim().toUpperCase();
  if (!symbol) return "";

  if (
    symbol.startsWith("^") ||
    symbol.endsWith("=X") ||
    symbol.endsWith("=F") ||
    symbol.endsWith("-USD")
  ) {
    return symbol.replace(/\.(NS|BO)$/, "");
  }

  return symbol.includes(".") ? symbol : `${symbol}.NS`;
}

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  subscriber = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  });

  subscriber.on('error', (err) => {
    console.error('Redis subscriber error:', err.message);
  });

  subscriber.subscribe("market:ticks", (err) => {
    if (err) console.error("Redis subscribe error:", err);
    else console.log("Subscribed to market:ticks channel");
  });

  subscriber.on("message", (channel, message) => {
    if (channel === "market:ticks") {
      const { symbol, data } = JSON.parse(message);
      io.to(symbol).emit("tick", data);
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("subscribe", async (rawSymbol) => {
      const symbol = normalizeSocketSymbol(rawSymbol);
      if (!symbol) return;

      socket.join(symbol);
      console.log(`Client ${socket.id} subscribed to ${symbol}`);
      subscribeSymbols([symbol]); // Tell tick producer about new symbol
      try {
        const lastTick = await cache.get(`tick:${symbol}`);
        if (lastTick) socket.emit("tick", lastTick);
      } catch (_) {}
    });
    socket.on("unsubscribe", (rawSymbol) => {
      const symbol = normalizeSocketSymbol(rawSymbol);
      if (!symbol) return;

      socket.leave(symbol);
      console.log(`Client ${socket.id} unsubscribed from ${symbol}`);
      // Only unsubscribe from tick producer if no other clients in the room
      const room = io.sockets.adapter.rooms.get(symbol);
      if (!room || room.size === 0) unsubscribeSymbols([symbol]);
    });
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  startTickProducer(sendTick);
  console.log("Yahoo Finance tick producer started");
}

async function sendTick(symbol, data) {
  try {
    await cache.set(`tick:${symbol}`, data, 300);
    await redis.publish("market:ticks", JSON.stringify({ symbol, data }));
  } catch (err) {
    if (io) io.to(symbol).emit("tick", data);
  }
}

module.exports = { initSocket, sendTick };
