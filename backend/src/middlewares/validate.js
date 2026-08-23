const ApiError = require('../utils/ApiError');

/**
 * Validates req[source] (default 'body') against a Joi schema.
 * On success, replaces req[source] with the sanitized/coerced value.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw ApiError.badRequest(
        'Validation failed',
        error.details.map((d) => d.message)
      );
    }
    req[source] = value;
    next();
  };
}

module.exports = validate;
