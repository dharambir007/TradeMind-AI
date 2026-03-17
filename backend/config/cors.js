const IS_PROD = process.env.NODE_ENV === "production";

function getAllowedOrigins() {
  const base = [
    "https://trade-mind-ai-umber.vercel.app",
    ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",") : []),
  ];

  if (!IS_PROD) {
    base.push(
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175"
    );
  }

  return base.map((value) => String(value || "").trim()).filter(Boolean);
}

function isVercelPreviewOrigin(origin) {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(String(origin || "").trim());
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = String(origin || "").trim();
  if (!normalizedOrigin) return true;

  if (getAllowedOrigins().includes(normalizedOrigin)) return true;
  if (isVercelPreviewOrigin(normalizedOrigin)) return true;

  return false;
}

module.exports = {
  getAllowedOrigins,
  isAllowedOrigin,
};