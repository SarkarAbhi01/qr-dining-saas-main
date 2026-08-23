const ApiError = require('../utils/ApiError');

/**
 * Restricts a route to a set of roles. Must run after `authenticate`.
 *
 *   router.get('/reports', authenticate, authorize('OWNER', 'MANAGER'), handler);
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(`Role '${req.user.role}' is not permitted to access this resource`);
    }
    next();
  };
}

module.exports = authorize;
