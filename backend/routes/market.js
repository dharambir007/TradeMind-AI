const express = require('express');
const router = express.Router();
const { getMarketStatus } = require('../controllers/marketController');

router.get('/status', getMarketStatus);

module.exports = router;
