const express = require("express");
const { getAIInsight } = require("../controllers/aiInsightController");
const validate = require("../middlewares/validate");

const router = express.Router();

router.post(
  "/",
  validate((req) => {
    const errors = [];
    if (!String(req.body?.symbol || "").trim()) {
      errors.push({ field: "symbol", message: "symbol is required" });
    }
    return errors;
  }),
  getAIInsight
);
router.get("/", getAIInsight);

module.exports = router;
