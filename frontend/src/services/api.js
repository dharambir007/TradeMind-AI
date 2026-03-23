import axios from "axios";
import { getApiBaseUrl, isWakeUpError, WAKEUP_MESSAGE } from "../utils/apiUrl";

// Auth endpoints hit MongoDB; Atlas free tier can have cold-start latency > 10s
const API_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBaseURL() {
  return getApiBaseUrl();
}

const apiClient = axios.create({
  baseURL: resolveBaseURL(),
  timeout: API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

function shouldAttachAuth(config) {
  const url = String(config?.url || "");
  if (!url) return false;

  return (
    url.startsWith("/user") ||
    url.startsWith("/watchlist")
  );
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && shouldAttachAuth(config)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.__retryCount = config.__retryCount || 0;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const retryCount = Number(config.__retryCount || 0);
    const method = String(config.method || "get").toLowerCase();
    const canRetryMethod = ["get", "head", "options"].includes(method) || config.retry === true;
    const shouldRetry =
      canRetryMethod &&
      retryCount < MAX_RETRIES &&
      (error.code === "ECONNABORTED" ||
        error.code === "ERR_NETWORK" ||
        !status ||
        status >= 500);

    if (shouldRetry) {
      config.__retryCount = retryCount + 1;
      await sleep(300 * config.__retryCount);
      return apiClient(config);
    }

    if (isWakeUpError(error)) {
      error.userMessage = WAKEUP_MESSAGE;
    }

    if (status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
