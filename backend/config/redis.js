const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "";
const useTls =
  String(process.env.REDIS_TLS || "").toLowerCase() === "true" ||
  redisUrl.startsWith("rediss://");

const connectionOptions = redisUrl
  ? redisUrl
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      tls: useTls ? {} : undefined,
    };

const redis = new Redis(connectionOptions, {
  lazyConnect: false,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  retryStrategy(attempt) {
    return Math.min(attempt * 250, 3000);
  },
});

redis.on("connect", () => {
  console.log("[redis] connected");
});

redis.on("ready", () => {
  console.log("[redis] ready");
});

redis.on("error", (error) => {
  console.error("[redis] error:", error.message);
});

const cache = {
  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },
  async set(key, value, ttlSeconds = 60) {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  },
  async del(key) {
    await redis.del(key);
  },
  async delByPattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length) {
      await redis.del(...keys);
    }
  },
  async exists(key) {
    return redis.exists(key);
  },
};

module.exports = {
  redis,
  cache,
};
