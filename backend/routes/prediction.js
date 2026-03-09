const express = require("express");
const { predictionCompatHandler } = require("../controllers/stockController");

const router = express.Router();

router.get("/", predictionCompatHandler);
router.post("/", predictionCompatHandler);

module.exports = router;
