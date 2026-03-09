const { cache, redis } = require("../config/redis");
const logger = require("../utils/logger");

class CacheService {
  static async get(key) {
    try {
      return await cache.get(key);
    } catch (error) {
      logger.warn(`[cache] get failed for ${key}:`, error.message);
      return null;
    }
  }

  static async set(key, value, ttlSeconds) {
    try {
      await cache.set(key, value, ttlSeconds);
    } catch (error) {
      logger.warn(`[cache] set failed for ${key}:`, error.message);
    }
  }

  static async del(key) {
    try {
      await cache.del(key);
    } catch (error) {
      logger.warn(`[cache] delete failed for ${key}:`, error.message);
    }
  }

  static async remember(key, ttlSeconds, loader) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const value = await loader();
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttlSeconds);
    }
    return value;
  }

  static async ping() {
    try {
      return (await redis.ping()) === "PONG";
    } catch (_) {
      return false;
    }
  }
}

module.exports = CacheService;
