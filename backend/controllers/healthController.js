const asyncHandler = require("../utils/asyncHandler");
const CacheService = require("../services/cacheService");
const PredictionService = require("../services/predictionService");

const getHealth = asyncHandler(async (req, res) => {
  const redis = await CacheService.ping();
  const mlService = await PredictionService.checkHealth();

  return res.json({
    status: "ok",
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
