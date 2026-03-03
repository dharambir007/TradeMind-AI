const express = require("express");
const router = express.Router();
const {
  getStock,
  getStockHistory,
  searchStocks,
  getStockPrediction,
  getChartPrediction,
  getChartPredictionByTimeframe,
} = require("../controllers/stockController");

router.get("/search", searchStocks);
router.post("/predict-chart", getChartPredictionByTimeframe);
router.get("/:symbol/history", getStockHistory);
router.get("/:symbol/prediction", getStockPrediction);
router.get("/:symbol/predict-chart", getChartPrediction);
router.get("/:symbol", getStock);

module.exports = router;
