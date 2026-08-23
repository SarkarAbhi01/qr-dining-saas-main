const ApiError = require('../utils/ApiError');

/**
 * Chef/Waiter accounts can only see their own performance summary if
 * the Owner has explicitly granted it (User.canViewOwnReports). Owner
 * and Manager always pass through — they're not restricted by this
 * flag, it exists specifically to gate lower-privilege roles.
 */
function requireOwnReportsPermission(req, res, next) {
  if (['OWNER', 'MANAGER'].includes(req.user.role)) return next();

  if (!req.user.canViewOwnReports) {
    throw ApiError.forbidden('Ask your manager to enable report access for your account');
  }
  next();
}

module.exports = requireOwnReportsPermission;
