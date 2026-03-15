require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const connectDb = require("./config/db");
const { initSocket } = require("./sockets/marketSocket");
const requestLogger = require("./middlewares/requestLogger");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");
const logger = require("./utils/logger");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const marketRoutes = require("./routes/market");
const stockRoutes = require("./routes/stocks");
const watchlistRoutes = require("./routes/watchlist");
const aiInsightRoutes = require("./routes/aiInsight");
const predictionRoutes = require("./routes/prediction");
const { getHealth } = require("./controllers/healthController");

function optionalRequire(moduleName, fallback) {
  try {
    return require(moduleName);
  } catch (_) {
    return fallback;
  }
}

function fallbackHelmet() {
  return () => (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  };
}

function fallbackCompression() {
  return () => (req, res, next) => next();
}

function createFallbackRateLimiter({ windowMs, max }) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = hits.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    hits.set(key, current);

    if (current.count > max) {
      return res.status(429).json({
        success: false,
        message: "Too many requests, please try again later.",
      });
    }

    return next();
  };
}

const helmet = optionalRequire("helmet", fallbackHelmet());
const compression = optionalRequire("compression", fallbackCompression());
const expressRateLimit = optionalRequire("express-rate-limit", null);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 5000;
const IS_PROD = process.env.NODE_ENV === "production";

// Exit on uncaught exceptions — process state is undefined after these
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error?.stack || error?.message || error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason?.stack || reason?.message || reason);
  process.exit(1);
});

// Graceful shutdown on SIGTERM (sent by Render during deploys/scale-down)
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  // Force exit if connections haven't closed within 15 seconds
  setTimeout(() => process.exit(0), 15000).unref();
});

function getAllowedOrigins() {
  const base = [
    "https://trade-mind-ai-umber.vercel.app",
    ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",") : []),
  ];

  // Localhost origins only in non-production
  if (!IS_PROD) {
    base.push(
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175"
    );
  }

  return base.map((value) => String(value || "").trim()).filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = String(origin || "").trim();
  if (!normalizedOrigin) return true;
  return getAllowedOrigins().includes(normalizedOrigin);
}

async function bootstrap() {
  await connectDb();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(compression());

  // Single CORS middleware — removed the duplicate manual header block
  app.use(
    cors({
      origin(origin, callback) {
        return callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    })
  );

  const apiRateLimit = expressRateLimit
    ? expressRateLimit({
        windowMs: 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
      })
    : createFallbackRateLimiter({ windowMs: 60 * 1000, max: 200 });

  // Strict rate limit for auth endpoints — prevent brute force
  const authRateLimit = expressRateLimit
    ? expressRateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: "Too many auth attempts, please try again later." },
      })
    : createFallbackRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

  // Strict rate limit for expensive AI insight endpoint (calls Gemini + news APIs)
  const aiInsightRateLimit = expressRateLimit
    ? expressRateLimit({
        windowMs: 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: "AI insight rate limit exceeded. Try again in a minute." },
      })
    : createFallbackRateLimiter({ windowMs: 60 * 1000, max: 10 });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);
  app.use("/api", apiRateLimit);

  app.get("/health", getHealth);
  app.get("/api/health", getHealth);

  app.use("/api/auth", authRateLimit, authRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/market", marketRoutes);
  app.use("/api/stocks", stockRoutes);
  app.use("/api/watchlist", watchlistRoutes);
  app.use("/api/ai-insight", aiInsightRateLimit, aiInsightRoutes);
  app.use("/api/prediction", predictionRoutes);

  app.get("/", (req, res) => {
    res.json({ status: "ok", service: "TradeMind AI backend" });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  try {
    initSocket(server);
  } catch (error) {
    logger.warn("Socket initialization failed:", error.message);
  }

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server listening on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  });
}

bootstrap().catch((error) => {
  logger.error("Bootstrap failed:", error?.stack || error?.message || error);
  process.exit(1);
});
