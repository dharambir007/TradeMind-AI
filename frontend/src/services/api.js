import axios from "axios";

const API_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBaseURL() {
  const raw = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!raw) return "/api";
  if (/\/api\/?$/i.test(raw)) return raw.replace(/\/$/, "");
  return `${raw.replace(/\/$/, "")}/api`;
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
