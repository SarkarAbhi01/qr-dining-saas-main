const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { hashPassword, generateTempPassword } = require('../utils/password');

function serializeRestaurant(r) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    address: r.address,
    phone: r.phone,
    email: r.email,
    logoUrl: r.logoUrl,
    currency: r.currency,
    timezone: r.timezone,
    status: r.status,
    statusReason: r.statusReason,
    subscriptionPlan: r.subscriptionPlan
      ? { id: r.subscriptionPlan.id, name: r.subscriptionPlan.name, maxTables: r.subscriptionPlan.maxTables, maxStaff: r.subscriptionPlan.maxStaff }
      : null,
    subscriptionStatus: r.subscriptionStatus,
    subscriptionEndsAt: r.subscriptionEndsAt,
    revenueModel: r.revenueModel,
    commissionRatePercent: r.commissionRatePercent,
    customLimitsEnabled: r.customLimitsEnabled,
    customMaxTables: r.customMaxTables,
    customMaxStaff: r.customMaxStaff,
    customLimitsExpiresAt: r.customLimitsExpiresAt,
    createdAt: r.createdAt,
    counts: r._count
      ? { tables: r._count.tables, users: r._count.users, orders: r._count.orders }
      : undefined,
  };
}

// ---------------------------------------------------------------------
// Restaurants (Tenants)
// ---------------------------------------------------------------------

// POST /api/superadmin/restaurants
// Creates the restaurant tenant AND its first Owner account atomically.
async function createRestaurant(req, res) {
  const { owner, subscriptionPlanId, ...restaurantData } = req.body;

  const tempPassword = owner.password || generateTempPassword('Owner');
  const passwordHash = await hashPassword(tempPassword);

  const result = await prisma.$transaction(async (tx) => {
    // Restaurant.superadminId is required, so we create it pointing at
    // the acting superadmin, then create the Owner scoped to it.
    const restaurant = await tx.restaurant.create({
      data: {
        ...restaurantData,
        superadminId: req.user.id,
        subscriptionPlanId: subscriptionPlanId || null,
        status: 'TRIAL',
        subscriptionStatus: 'TRIALING',
      },
    });

    const ownerUser = await tx.user.create({
      data: {
        restaurantId: restaurant.id,
        name: owner.name,
        email: owner.email,
        passwordHash,
        role: 'OWNER',
      },
    });

    return { restaurant, ownerUser };
  });

  res.status(201).json({
    success: true,
    data: {
      restaurant: serializeRestaurant(result.restaurant),
      ownerCredentials: {
        email: result.ownerUser.email,
        // Returned once, at creation time only — never retrievable again.
        temporaryPassword: owner.password ? undefined : tempPassword,
      },
    },
  });
}

// GET /api/superadmin/restaurants
async function listRestaurants(req, res) {
  const { page, pageSize, status, search } = req.query;

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, restaurants] = await Promise.all([
    prisma.restaurant.count({ where }),
    prisma.restaurant.findMany({
      where,
      include: {
        subscriptionPlan: true,
        _count: { select: { tables: true, users: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    success: true,
    data: restaurants.map(serializeRestaurant),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// GET /api/superadmin/restaurants/:id
async function getRestaurant(req, res) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.params.id },
    include: {
      subscriptionPlan: true,
      _count: { select: { tables: true, users: true, orders: true } },
      users: {
        where: { role: { in: ['OWNER', 'MANAGER'] } },
        select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
      },
    },
  });

  if (!restaurant) throw ApiError.notFound('Restaurant not found');

  res.json({ success: true, data: { ...serializeRestaurant(restaurant), managers: restaurant.users } });
}

// PATCH /api/superadmin/restaurants/:id
// Generic edits only (name, contact info) — status, plan, revenue model,
// and limits each have their own endpoint below since they carry extra
// rules (mandatory reason, mutual exclusivity, duration math).
async function updateRestaurant(req, res) {
  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: req.body,
    include: { subscriptionPlan: true },
  });

  res.json({ success: true, data: serializeRestaurant(restaurant) });
}

// PATCH /api/superadmin/restaurants/:id/status  { status, reason? }
// `reason` is required by the validator whenever status is SUSPENDED or
// CANCELLED — enforced before this ever runs.
async function changeStatus(req, res) {
  const { status, reason } = req.body;

  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: { status, statusReason: reason || null },
    include: { subscriptionPlan: true },
  });

  res.json({ success: true, data: serializeRestaurant(restaurant) });
}

// DELETE /api/superadmin/restaurants/:id  body: { reason }
async function deleteRestaurant(req, res) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.params.id } });
  if (!restaurant) throw ApiError.notFound('Restaurant not found');

  await prisma.$transaction([
    prisma.deletionLog.create({
      data: {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        reason: req.body.reason,
        deletedById: req.user.id,
      },
    }),
    prisma.restaurant.delete({ where: { id: restaurant.id } }),
  ]);

  res.json({ success: true, message: 'Restaurant and all associated data deleted' });
}

// PATCH /api/superadmin/restaurants/:id/plan  { subscriptionPlanId, durationDays }
// Manually assigns a plan with an explicit validity window — bypasses
// any billing cycle entirely, per SuperAdmin's discretion.
async function assignPlan(req, res) {
  const { subscriptionPlanId, durationDays } = req.body;

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId } });
  if (!plan) throw ApiError.notFound('Subscription plan not found');

  const subscriptionEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      subscriptionPlanId,
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt,
      status: 'ACTIVE',
    },
    include: { subscriptionPlan: true },
  });

  res.json({ success: true, data: serializeRestaurant(restaurant) });
}

// PATCH /api/superadmin/restaurants/:id/revenue-model
// { revenueModel, commissionRatePercent? }
// A restaurant is charged one way or the other, never both — setting
// MONTHLY_FEE always clears any commission rate, and vice versa the
// validator forbids sending a rate unless revenueModel is COMMISSION.
async function setRevenueModel(req, res) {
  const { revenueModel, commissionRatePercent } = req.body;

  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      revenueModel,
      commissionRatePercent: revenueModel === 'COMMISSION' ? commissionRatePercent : null,
    },
    include: { subscriptionPlan: true },
  });

  res.json({ success: true, data: serializeRestaurant(restaurant) });
}

// PATCH /api/superadmin/restaurants/:id/custom-limits
// { customLimitsEnabled, customMaxTables?, customMaxStaff?, validityDays? }
// The bypass toggle: while enabled (and not yet expired), table/staff
// limit checks read these values instead of the assigned plan's.
async function setCustomLimits(req, res) {
  const { customLimitsEnabled, customMaxTables, customMaxStaff, validityDays } = req.body;

  const restaurant = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      customLimitsEnabled,
      customMaxTables: customLimitsEnabled ? customMaxTables : null,
      customMaxStaff: customLimitsEnabled ? customMaxStaff : null,
      customLimitsExpiresAt: customLimitsEnabled
        ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
        : null,
    },
    include: { subscriptionPlan: true },
  });

  res.json({ success: true, data: serializeRestaurant(restaurant) });
}

// ---------------------------------------------------------------------
// Owner / Manager credential management
// ---------------------------------------------------------------------

// POST /api/superadmin/restaurants/:id/credentials
// Creates an additional Owner/Manager account for an existing restaurant.
async function createCredential(req, res) {
  const restaurantId = req.params.id;
  const { name, email, role, password } = req.body;

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw ApiError.notFound('Restaurant not found');

  const tempPassword = password || generateTempPassword(role === 'OWNER' ? 'Owner' : 'Mgr');
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: { restaurantId, name, email, role, passwordHash },
  });

  res.status(201).json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      credentials: { email: user.email, temporaryPassword: password ? undefined : tempPassword },
    },
  });
}

// POST /api/superadmin/users/:userId/reset-password
async function resetPassword(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) throw ApiError.notFound('User not found');

  const tempPassword = generateTempPassword('Reset');
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ success: true, data: { email: user.email, temporaryPassword: tempPassword } });
}

// ---------------------------------------------------------------------
// Subscription Plans
// ---------------------------------------------------------------------

// GET /api/superadmin/plans
async function listPlans(req, res) {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { priceMonthly: 'asc' } });
  res.json({ success: true, data: plans });
}

// POST /api/superadmin/plans
async function createPlan(req, res) {
  const plan = await prisma.subscriptionPlan.create({ data: req.body });
  res.status(201).json({ success: true, data: plan });
}

// PATCH /api/superadmin/plans/:id
async function updatePlan(req, res) {
  const plan = await prisma.subscriptionPlan.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: plan });
}

// ---------------------------------------------------------------------
// Global (platform-wide) reports
// ---------------------------------------------------------------------

// GET /api/superadmin/reports/overview
async function globalOverview(req, res) {
  const [restaurantCounts, totalOrders, revenueAgg, recentSignups] = await Promise.all([
    prisma.restaurant.groupBy({ by: ['status'], _count: true }),
    prisma.order.count(),
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true },
    }),
    prisma.restaurant.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const statusMap = Object.fromEntries(restaurantCounts.map((r) => [r.status, r._count]));

  res.json({
    success: true,
    data: {
      totalRestaurants: Object.values(statusMap).reduce((a, b) => a + b, 0),
      activeRestaurants: statusMap.ACTIVE || 0,
      trialRestaurants: statusMap.TRIAL || 0,
      suspendedRestaurants: statusMap.SUSPENDED || 0,
      newRestaurantsLast30Days: recentSignups,
      totalOrdersProcessed: totalOrders,
      totalRevenue: revenueAgg._sum.amount || 0,
    },
  });
}

// GET /api/superadmin/reports/restaurant-revenue?days=30
// Per-restaurant daily revenue, so SuperAdmin can see which tenants are
// actually generating money before adjusting commission or plan terms.
async function restaurantRevenueReport(req, res) {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [restaurants, rows] = await Promise.all([
    prisma.restaurant.findMany({
      select: { id: true, name: true, slug: true, status: true, revenueModel: true, commissionRatePercent: true },
      orderBy: { name: 'asc' },
    }),
    prisma.$queryRaw`
      SELECT "restaurantId" AS restaurant_id, date_trunc('day', "paidAt") AS day, SUM(amount) AS revenue
      FROM payments
      WHERE status = 'SUCCEEDED' AND "paidAt" >= ${since}
      GROUP BY "restaurantId", day
      ORDER BY day ASC
    `,
  ]);

  const byRestaurant = new Map(restaurants.map((r) => [r.id, { ...r, daily: [], totalRevenue: 0 }]));
  for (const row of rows) {
    const entry = byRestaurant.get(row.restaurant_id);
    if (!entry) continue;
    const revenue = Number(row.revenue);
    entry.daily.push({ date: row.day, revenue });
    entry.totalRevenue += revenue;
  }

  const data = [...byRestaurant.values()]
    .map((r) => ({
      ...r,
      // Rough estimate of what SuperAdmin earned from this tenant over
      // the window — only meaningful for COMMISSION-model restaurants.
      estimatedCommissionEarned:
        r.revenueModel === 'COMMISSION' && r.commissionRatePercent
          ? Math.round(r.totalRevenue * (Number(r.commissionRatePercent) / 100) * 100) / 100
          : null,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  res.json({ success: true, data });
}

module.exports = {
  createRestaurant,
  listRestaurants,
  getRestaurant,
  updateRestaurant,
  changeStatus,
  deleteRestaurant,
  assignPlan,
  setRevenueModel,
  setCustomLimits,
  createCredential,
  resetPassword,
  listPlans,
  createPlan,
  updatePlan,
  globalOverview,
  restaurantRevenueReport,
};
