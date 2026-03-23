const asyncHandler = require("../utils/asyncHandler");
const CacheService = require("../services/cacheService");
const PredictionService = require("../services/predictionService");
const { getDbState } = require("../config/db");

const getHealth = asyncHandler(async (req, res) => {
  const db = getDbState();
  const redis = await CacheService.ping();
  const mlService = await PredictionService.checkHealth();

  const allHealthy = db.ready;
  const status = allHealthy ? 200 : 503;

  return res.status(status).json({
    status: allHealthy ? "ok" : "degraded",
    services: {
      backend: true,
      database: db,
      redis,
      ml_service: mlService,
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  getHealth,
};
