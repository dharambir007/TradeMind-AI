const axios = require('axios');
const http = require('http');

const agent = new http.Agent({
    keepAlive: true,
    maxSockets: 100,
    maxFreeSockets: 10,
    keepAliveMsecs: 1000,
});

const mlClient = axios.create({
    baseURL: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000',
    timeout: 5000,
    httpAgent: agent,
    headers: {
        'Content-Type': 'application/json',
    },
});

const getPrediction = async (candles, horizon = 5) => {
    try {
        const start = performance.now();

        const response = await mlClient.post('/predict', {
            candles,
            horizon,
        });

        const end = performance.now();
        if (end - start > 50) {
            console.warn(`Slow ML response: ${(end - start).toFixed(2)}ms`);
        }

        return response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error('ML Service timeout');
            throw new Error('ML Service timed out');
        }
        if (error.response) {
            console.error(`ML Service Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            throw new Error(error.response.data.detail || 'ML Service error');
        }
        console.error('ML Service connection failed:', error.message);
        throw new Error('ML Service unavailable');
    }
};

const getPredictionCandles = async (candles, steps = 3, options = {}) => {
    try {
        const start = performance.now();

        const payload = {
            candles,
            steps,
        };

        if (options && typeof options === 'object') {
            if (typeof options.timeframe === 'string' && options.timeframe.trim()) {
                payload.timeframe = options.timeframe.trim().toLowerCase();
            }
            if (Number.isFinite(options.intervalSeconds) && options.intervalSeconds > 0) {
                payload.interval_seconds = Math.floor(options.intervalSeconds);
            }
            if (Number.isFinite(options.pullbackProbability)) {
                payload.pullback_probability = options.pullbackProbability;
            }
            if (Number.isFinite(options.volatilityScale)) {
                payload.volatility_scale = options.volatilityScale;
            }
        }

        const response = await mlClient.post('/predict-candles', {
            ...payload,
        });

        const end = performance.now();
        if (end - start > 100) {
            console.warn(`Slow ML candle prediction: ${(end - start).toFixed(2)}ms`);
        }

        return response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error('ML Service timeout (predict-candles)');
            throw new Error('ML Service timed out');
        }
        if (error.response) {
            console.error(`ML Service Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            throw new Error(error.response.data.detail || 'ML Service error');
        }
        console.error('ML Service connection failed:', error.message);
        throw new Error('ML Service unavailable');
    }
};

module.exports = {
    getPrediction,
    getPredictionCandles,
};
