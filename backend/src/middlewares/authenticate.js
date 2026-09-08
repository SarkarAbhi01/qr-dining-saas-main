const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../config/prisma');

/**
 * Verifies the Bearer access token and attaches a minimal `req.user`
 * ({ id, role, restaurantId }) built from the token claims — no DB hit
 * on the hot path. Controllers that need fresh user data (e.g. isActive
 * checks) can still query prisma.user directly.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  const token = header.split(' ')[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  // Guard against tokens issued to since-deactivated/deleted users
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      role: true,
      restaurantId: true,
      isActive: true,
      name: true,
      email: true,
      canViewOwnReports: true,
      sessionVersion: true,
    },
  });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  // Single-active-session enforcement: this account was logged into on
  // another device after this token was issued (that login bumped
  // sessionVersion), so this token is stale even though it hasn't
  // technically expired yet.
  if (payload.sessionVersion !== user.sessionVersion) {
    throw ApiError.unauthorized('Logged out — this account was signed in on another device');
  }

  req.user = user;
  next();
}

module.exports = authenticate;
