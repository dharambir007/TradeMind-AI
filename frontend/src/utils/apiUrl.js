export const WAKEUP_MESSAGE = "AI service is waking up... please try again in 10 seconds.";

function sanitizeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  // Keep localhost/http for local development, enforce https elsewhere.
  if (/^http:\/\/(?!localhost|127\.0\.0\.1)/i.test(value)) {
    return value.replace(/^http:\/\//i, "https://");
  }

  return value;
}

export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "";
  const sanitized = sanitizeUrl(raw);

  if (!sanitized) return "/api";
  if (/\/api\/?$/i.test(sanitized)) return sanitized.replace(/\/$/, "");
  return `${sanitized.replace(/\/$/, "")}/api`;
}

export function getSocketUrl() {
  const apiBase = getApiBaseUrl();
  if (!apiBase || apiBase === "/api") {
    return window.location.origin;
  }
  return apiBase.replace(/\/api\/?$/i, "");
}

export function isWakeUpError(error) {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || "");

  return (
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}