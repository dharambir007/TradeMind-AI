const AppError = require("../utils/appError");

function validate(schema) {
  return (req, res, next) => {
    const errors = schema(req) || [];
    if (!errors.length) {
      return next();
    }

    return next(new AppError("Validation failed", 400, { errors }));
  };
}

module.exports = validate;
