const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

// GET /api/restaurant/billing
// Read-only for Owner/Manager — plan assignment and status changes stay
// a Superadmin action (see superadmin.controller.updateRestaurant).
async function getBilling(req, res) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId },
    include: { subscriptionPlan: true },
  });
  if (!restaurant) throw ApiError.notFound('Restaurant not found');

  const [tableCount, staffCount] = await Promise.all([
    prisma.restaurantTable.count({ where: { restaurantId: req.restaurantId } }),
    prisma.user.count({
      where: { restaurantId: req.restaurantId, role: { in: ['MANAGER', 'CHEF', 'WAITER'] } },
    }),
  ]);

  const plan = restaurant.subscriptionPlan;

  const bypassActive =
    restaurant.customLimitsEnabled &&
    restaurant.customLimitsExpiresAt &&
    restaurant.customLimitsExpiresAt > new Date();
  const effectiveMaxTables = bypassActive ? restaurant.customMaxTables : plan?.maxTables ?? null;
  const effectiveMaxStaff = bypassActive ? restaurant.customMaxStaff : plan?.maxStaff ?? null;

  res.json({
    success: true,
    data: {
      status: restaurant.status,
      statusReason: restaurant.statusReason,
      subscriptionStatus: restaurant.subscriptionStatus,
      subscriptionEndsAt: restaurant.subscriptionEndsAt,
      revenueModel: restaurant.revenueModel,
      commissionRatePercent: restaurant.commissionRatePercent,
      customLimitsActive: bypassActive,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceMonthly: plan.priceMonthly,
            priceYearly: plan.priceYearly,
            maxTables: plan.maxTables,
            maxStaff: plan.maxStaff,
            features: plan.features,
          }
        : null,
      usage: {
        tables: tableCount,
        maxTables: effectiveMaxTables,
        staff: staffCount,
        maxStaff: effectiveMaxStaff,
      },
    },
  });
}

// GET /api/restaurant/billing/invoices
async function listInvoices(req, res) {
  const invoices = await prisma.invoice.findMany({
    where: { restaurantId: req.restaurantId },
    orderBy: { periodStart: 'desc' },
  });
  res.json({ success: true, data: invoices });
}

module.exports = { getBilling, listInvoices };
