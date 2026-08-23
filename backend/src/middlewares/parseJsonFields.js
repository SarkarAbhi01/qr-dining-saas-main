const ApiError = require('../utils/ApiError');

/**
 * multipart/form-data only carries strings — nested structures like
 * `modifierGroups` are sent by the client as a JSON string field and
 * need parsing back into an object/array before Joi validation runs.
 */
function parseJsonFields(...fields) {
  return (req, res, next) => {
    for (const field of fields) {
      if (typeof req.body[field] === 'string' && req.body[field].length) {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch {
          throw ApiError.badRequest(`Field '${field}' must be valid JSON`);
        }
      }
    }
    next();
  };
}

module.exports = parseJsonFields;
