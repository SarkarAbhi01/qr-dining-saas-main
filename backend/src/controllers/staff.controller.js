const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { hashPassword, generateTempPassword } = require('../utils/password');

// Same custom-limit bypass logic as tables (see table.controller.js).
async function assertWithinStaffLimit(restaurantId) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { subscriptionPlan: true },
  });

  const bypassActive =
    restaurant.customLimitsEnabled &&
    restaurant.customLimitsExpiresAt &&
    restaurant.customLimitsExpiresAt > new Date();

  const maxStaff = bypassActive ? restaurant.customMaxStaff : restaurant.subscriptionPlan?.maxStaff;
  if (maxStaff == null) return;

  const currentCount = await prisma.user.count({
    where: { restaurantId, role: { in: ['MANAGER', 'CHEF', 'WAITER'] } },
  });
  if (currentCount + 1 > maxStaff) {
    throw ApiError.conflict(
      `This would exceed your staff limit (${maxStaff}). You currently have ${currentCount}. Contact your platform admin to raise it.`
    );
  }
}

function serializeStaff(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    canViewOwnReports: u.canViewOwnReports,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

// GET /api/restaurant/staff
async function listStaff(req, res) {
  const { role } = req.query;
  const staff = await prisma.user.findMany({
    where: {
      restaurantId: req.restaurantId,
      role: role ? role : { in: ['MANAGER', 'CHEF', 'WAITER'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: staff.map(serializeStaff) });
}

// POST /api/restaurant/staff
async function createStaff(req, res) {
  const { name, email, phone, role, password } = req.body;

  await assertWithinStaffLimit(req.restaurantId);

  const tempPassword = password || generateTempPassword(role);
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: { restaurantId: req.restaurantId, name, email, phone, role, passwordHash },
  });

  res.status(201).json({
    success: true,
    data: {
      user: serializeStaff(user),
      credentials: { email: user.email, temporaryPassword: password ? undefined : tempPassword },
    },
  });
}

// PATCH /api/restaurant/staff/:id
async function updateStaff(req, res) {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!user) throw ApiError.notFound('Staff member not found');
  if (user.role === 'OWNER') throw ApiError.forbidden('Owner accounts cannot be edited here');

  const updated = await prisma.user.update({ where: { id: user.id }, data: req.body });
  res.json({ success: true, data: serializeStaff(updated) });
}

// POST /api/restaurant/staff/:id/reset-password
async function resetStaffPassword(req, res) {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!user) throw ApiError.notFound('Staff member not found');

  const tempPassword = generateTempPassword('Reset');
  const passwordHash = await hashPassword(tempPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ success: true, data: { email: user.email, temporaryPassword: tempPassword } });
}

// DELETE /api/restaurant/staff/:id
async function deleteStaff(req, res) {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!user) throw ApiError.notFound('Staff member not found');
  if (user.role === 'OWNER') throw ApiError.forbidden('Owner accounts cannot be deleted here');

  await prisma.user.delete({ where: { id: user.id } });
  res.json({ success: true, message: 'Staff member removed' });
}

module.exports = { listStaff, createStaff, updateStaff, resetStaffPassword, deleteStaff };
