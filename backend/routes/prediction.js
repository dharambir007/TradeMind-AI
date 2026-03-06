const express = require("express");
const { getStockPrediction } = require("../controllers/stockController");

const router = express.Router();

async function predictionCompatHandler(req, res, next) {
  try {
    const symbol = req.query?.symbol || req.body?.symbol;
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "symbol is required",
      });
    }

    req.params = { ...(req.params || {}), symbol };
    return getStockPrediction(req, res, next);
  } catch (error) {
    return next(error);
  }
}

router.get("/", predictionCompatHandler);
router.post("/", predictionCompatHandler);

module.exports = router;
