const { openTime, closeTime, tradingDays } = require('../config/marketConfig');
const { cache } = require('../config/redis');

const CACHE_TTL = 30; // Cache for 30 seconds

// Safe cache wrapper — never let Redis failures break endpoints
const safeCache = {
  async get(key) { try { return await cache.get(key); } catch { return null; } },
  async set(key, value, ttl) { try { await cache.set(key, value, ttl); } catch { /* ignore */ } },
};

const getMarketStatus = async (req, res) => {
  try {
    // Try to get from cache first
    const cachedStatus = await safeCache.get('market:status');
    if (cachedStatus) {
      return res.json({ ...cachedStatus, cached: true });
    }

    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(now);

    const day = istDate.getDay();
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const openMinutes = openTime.hour * 60 + openTime.minute;
    const closeMinutes = closeTime.hour * 60 + closeTime.minute;

    const isTradingDay = tradingDays.includes(day);
    const isWithinHours = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    const isOpen = isTradingDay && isWithinHours;

    const response = {
      isOpen,
      currentTime: istDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      openTime: '09:15 AM',
      closeTime: '03:30 PM',
      message: isOpen ? 'Market is Open' : 'Market is Closed'
    };

    // Cache the response
    await safeCache.set('market:status', response, CACHE_TTL);

    res.json({ ...response, cached: false });
  } catch (error) {
    console.error('Market status error:', error);
    res.status(500).json({ error: 'Failed to get market status' });
  }
};

module.exports = { getMarketStatus };
