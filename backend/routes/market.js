const express = require('express');
const router = express.Router();
const { getMarketStatus, getMacroAnalysis, getMarketNews } = require('../controllers/marketController');

router.get('/status', getMarketStatus);
router.get('/news', getMarketNews);
router.get('/macro-analysis', getMacroAnalysis);
router.post('/macro-analysis', getMacroAnalysis);

module.exports = router;
