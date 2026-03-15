const AppError = require("../utils/appError");
const logger = require("../utils/logger");

function notFoundHandler(req, res, next) {
  next(new AppError("Route not found", 404));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error?.statusCode || error?.status || 500;
  logger.error(`${req.method} ${req.originalUrl}`, error?.stack || error?.message || error);

  // In production, hide internal error details from non-operational errors
  const isOperational = error?.isOperational === true;
  const isProd = process.env.NODE_ENV === "production";
  const message =
    isProd && !isOperational && statusCode === 500
      ? "Internal server error"
      : error?.message || "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message,
    ...(error?.details && (isOperational || !isProd) ? { details: error.details } : {}),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
