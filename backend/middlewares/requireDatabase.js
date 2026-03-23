const AppError = require("../utils/appError");
const { getDbState } = require("../config/db");

function requireDatabase(req, res, next) {
  const db = getDbState();

  if (db.ready) {
    return next();
  }

  return next(
    new AppError(
      `Database is currently unavailable (${db.status}). Please try again shortly.`,
      503
    )
  );
}

module.exports = requireDatabase;
