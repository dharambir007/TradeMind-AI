const asyncHandler = require("../utils/asyncHandler");
const CacheService = require("../services/cacheService");
const PredictionService = require("../services/predictionService");

const getHealth = asyncHandler(async (req, res) => {
  const redis = await CacheService.ping();
  const mlService = await PredictionService.checkHealth();

  const allHealthy = redis; // ML service is optional on free tier
  const status = allHealthy ? 200 : 503;

  return res.status(status).json({
    status: allHealthy ? "ok" : "degraded",
    services: {
      backend: true,
      redis,
      ml_service: mlService,
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  getHealth,
};
