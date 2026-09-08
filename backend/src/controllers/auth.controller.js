const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { comparePassword, hashPassword } = require('../utils/password');
const tokenService = require('../services/token.service');

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurantId,
  };
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Single-active-session enforcement: bumping sessionVersion makes
  // any access token issued before this moment fail its version check
  // on its very next request (see middlewares/authenticate.js), and
  // revoking refresh tokens stops that old device from silently
  // renewing its way to a fresh one instead.
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 }, lastLoginAt: new Date() },
  });
  await tokenService.revokeAllUserTokens(user.id);

  const { accessToken, refreshToken } = await tokenService.issueTokenPair(updatedUser);

  res.json({
    success: true,
    data: { user: serializeUser(updatedUser), accessToken, refreshToken },
  });
}

// POST /api/auth/refresh
async function refresh(req, res) {
  const { refreshToken } = req.body;
  const tokens = await tokenService.rotateRefreshToken(refreshToken);
  res.json({ success: true, data: tokens });
}

// POST /api/auth/logout
async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await tokenService.revokeRefreshToken(refreshToken);
  }
  res.json({ success: true, message: 'Logged out' });
}

// GET /api/auth/me
async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ success: true, data: serializeUser(user) });
}

// PATCH /api/auth/change-password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Force re-login everywhere else after a password change
  await tokenService.revokeAllUserTokens(user.id);

  res.json({ success: true, message: 'Password updated. Please log in again.' });
}

module.exports = { login, refresh, logout, me, changePassword };
