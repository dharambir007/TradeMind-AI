const { cache } = require('../config/redis');

/**
 * Cache middleware for Express routes
 * @param {number} ttl - Time to live in seconds (default: 60)
 * @param {function} keyGenerator - Function to generate cache key from request
 */
const cacheMiddleware = (ttl = 60, keyGenerator = null) => {
  return async (req, res, next) => {
    const key = keyGenerator
      ? keyGenerator(req)
      : `cache:${req.originalUrl}`;

    try {
      const cachedData = await cache.get(key);

      if (cachedData) {
        return res.json({ ...cachedData, cached: true });
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = async (data) => {
        await cache.set(key, data, ttl);
        return originalJson({ ...data, cached: false });
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Clear cache middleware - useful for POST/PUT/DELETE routes
 * @param {string|string[]} patterns - Cache key patterns to clear
 */
const clearCacheMiddleware = (patterns) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = async (data) => {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];

      for (const pattern of patternList) {
        await cache.delByPattern(pattern);
      }

      return originalJson(data);
    };

    next();
  };
};

module.exports = { cacheMiddleware, clearCacheMiddleware };
