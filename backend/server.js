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

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error?.stack || error?.message || error);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason?.stack || reason?.message || reason);
});

function getAllowedOrigins() {
  return [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://trade-mind-ai-umber.vercel.app",
    ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",") : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalizedOrigin = String(origin || "").trim();
  if (!normalizedOrigin) return true;

  if (getAllowedOrigins().includes(normalizedOrigin)) {
    return true;
  }

  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin);
}

async function bootstrap() {
  await connectDb();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(compression());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        return callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    })
  );

  const apiRateLimit = expressRateLimit
    ? expressRateLimit({
        windowMs: 60 * 1000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
      })
    : createFallbackRateLimiter({ windowMs: 60 * 1000, max: 120 });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);
  app.use("/api", apiRateLimit);

  app.get("/health", getHealth);
  app.get("/api/health", getHealth);

  app.use("/api/auth", authRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/market", marketRoutes);
  app.use("/api/stocks", stockRoutes);
  app.use("/api/watchlist", watchlistRoutes);
  app.use("/api/ai-insight", aiInsightRoutes);
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
    logger.info(`Server listening on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error("Bootstrap failed:", error?.stack || error?.message || error);
  process.exit(1);
});
