const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();
const { cache } = require("../config/redis");

const safeCache = {
  async get(key) { try { return await cache.get(key); } catch { return null; } },
  async set(key, value, ttl) { try { await cache.set(key, value, ttl); } catch {} },
};

// GET /api/watchlist — get user's watchlist with live prices
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("watchlist");
    if (!user || !user.watchlist || user.watchlist.length === 0) {
      return res.json([]);
    }

    // Fetch live quotes in parallel
    const items = await Promise.all(
      user.watchlist.map(async (entry) => {
        const sym = entry.symbol;
        const cacheKey = `wl:${sym}`;

        // Check cache
        const cached = await safeCache.get(cacheKey);
        if (cached) return { ...cached, addedAt: entry.addedAt };

        try {
          // Resolve to Yahoo symbol (prefer .NS)
          let yahooSym = sym;
          if (!sym.includes(".")) {
            yahooSym = `${sym}.NS`;
          }

          const quote = await yahooFinance.quote(yahooSym);
          const data = {
            symbol: sym,
            name: quote.shortName || quote.longName || sym,
            price: quote.regularMarketPrice || 0,
            change: parseFloat((quote.regularMarketChange || 0).toFixed(2)),
            changePercent: parseFloat((quote.regularMarketChangePercent || 0).toFixed(2)),
            currency: quote.currency || "INR",
          };

          await safeCache.set(cacheKey, data, 30); // cache 30s for watchlist
          return { ...data, addedAt: entry.addedAt };
        } catch (err) {
          // Return basic info if quote fails
          return {
            symbol: sym,
            name: sym,
            price: 0,
            change: 0,
            changePercent: 0,
            currency: "INR",
            addedAt: entry.addedAt,
            error: true,
          };
        }
      })
    );

    res.json(items);
  } catch (err) {
    console.error("Get watchlist error:", err.message);
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

// POST /api/watchlist — add a stock to watchlist
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const cleanSymbol = symbol.replace(/\.(NS|BO)$/, "").toUpperCase().trim();

    const user = await User.findById(req.user._id);

    // Check if already in watchlist
    const existing = user.watchlist.find((w) => w.symbol === cleanSymbol);
    if (existing) {
      return res.status(409).json({ error: "Stock already in watchlist" });
    }

    // Max 20 stocks in watchlist
    if (user.watchlist.length >= 20) {
      return res.status(400).json({ error: "Watchlist limit reached (max 20)" });
    }

    user.watchlist.push({ symbol: cleanSymbol });
    await user.save();

    res.status(201).json({ message: "Added to watchlist", symbol: cleanSymbol });
  } catch (err) {
    console.error("Add to watchlist error:", err.message);
    res.status(500).json({ error: "Failed to add to watchlist" });
  }
});

// DELETE /api/watchlist/:symbol — remove a stock from watchlist
router.delete("/:symbol", authMiddleware, async (req, res) => {
  try {
    const cleanSymbol = req.params.symbol.replace(/\.(NS|BO)$/, "").toUpperCase().trim();

    const user = await User.findById(req.user._id);

    const idx = user.watchlist.findIndex((w) => w.symbol === cleanSymbol);
    if (idx === -1) {
      return res.status(404).json({ error: "Stock not in watchlist" });
    }

    user.watchlist.splice(idx, 1);
    await user.save();

    res.json({ message: "Removed from watchlist", symbol: cleanSymbol });
  } catch (err) {
    console.error("Remove from watchlist error:", err.message);
    res.status(500).json({ error: "Failed to remove from watchlist" });
  }
});

module.exports = router;
