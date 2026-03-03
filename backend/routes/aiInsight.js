const express = require("express");
const { getAIInsight } = require("../controllers/aiInsightController");

const router = express.Router();

router.post("/", getAIInsight);
router.get("/", getAIInsight);

module.exports = router;

