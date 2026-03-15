class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Distinguishes known errors from programmer bugs
  }
}

module.exports = AppError;
