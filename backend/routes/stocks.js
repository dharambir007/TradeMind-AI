const express = require("express");
const router = express.Router();
const { getStock, getStockHistory, searchStocks } = require("../controllers/stockController");

router.get("/search", searchStocks);
router.get("/:symbol/history", getStockHistory);
router.get("/:symbol", getStock);

module.exports = router;
