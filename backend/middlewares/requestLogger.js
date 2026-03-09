const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl}`, `status=${res.statusCode}`, `duration=${Date.now() - start}ms`);
  });

  next();
}

module.exports = requestLogger;
