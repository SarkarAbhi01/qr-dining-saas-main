const ApiError = require('../utils/ApiError');

/**
 * Enforces tenant isolation for restaurant-scoped roles (OWNER, MANAGER,
 * CHEF, WAITER). Must run after `authenticate`.
 *
 * - SUPERADMIN bypasses scoping entirely (platform-wide access).
 * - Every other role is pinned to `req.user.restaurantId`. If the route
 *   has a `:restaurantId` param, it must match — otherwise 403.
 * - Sets `req.restaurantId` as the single source of truth controllers
 *   should filter all Prisma queries by.
 */
function tenantScope(req, res, next) {
  if (req.user.role === 'SUPERADMIN') {
    // Superadmin may target any restaurant via param/query/body if provided
    req.restaurantId =
      req.params.restaurantId || req.query.restaurantId || req.body.restaurantId || null;
    return next();
  }

  if (!req.user.restaurantId) {
    throw ApiError.forbidden('User is not attached to a restaurant');
  }

  const paramRestaurantId = req.params.restaurantId;
  if (paramRestaurantId && paramRestaurantId !== req.user.restaurantId) {
    throw ApiError.forbidden('Cannot access another restaurant\'s data');
  }

  req.restaurantId = req.user.restaurantId;
  next();
}

module.exports = tenantScope;
