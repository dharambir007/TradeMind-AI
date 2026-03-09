const axios = require("axios");
const http = require("http");
const https = require("https");

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  keepAliveMsecs: 1000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  keepAliveMsecs: 1000,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryRequest(error) {
  const status = error?.response?.status;
  return (
    error?.code === "ECONNABORTED" ||
    error?.code === "ENOTFOUND" ||
    error?.code === "ECONNRESET" ||
    error?.code === "EAI_AGAIN" ||
    !status ||
    status >= 500 ||
    status === 429
  );
}

function createHttpClient({ baseURL, timeout = 8000, headers = {} } = {}) {
  return axios.create({
    baseURL,
    timeout,
    headers,
    httpAgent,
    httpsAgent,
  });
}

async function withRetry(task, options = {}) {
  const retries = Number(options.retries) || 0;
  const delayMs = Number(options.delayMs) || 300;
  const shouldRetry = options.shouldRetry || shouldRetryRequest;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      await sleep(delayMs * (attempt + 1));
    }
  }

  throw lastError;
}

module.exports = {
  createHttpClient,
  shouldRetryRequest,
  withRetry,
};
