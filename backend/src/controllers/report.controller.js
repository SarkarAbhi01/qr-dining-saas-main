const prisma = require('../config/prisma');

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

function startOfRange(range) {
  if (range === 'all') return new Date(0);
  const days = RANGE_DAYS[range] || 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------
// Quick overview stats
// ---------------------------------------------------------------------

// GET /api/restaurant/reports/overview
async function overview(req, res) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayAgg, weekAgg, monthAgg, totalOrders, avgFulfillment] = await Promise.all([
    prisma.payment.aggregate({
      where: { restaurantId: req.restaurantId, status: 'SUCCEEDED', paidAt: { gte: startOfToday } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { restaurantId: req.restaurantId, status: 'SUCCEEDED', paidAt: { gte: startOfWeek } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { restaurantId: req.restaurantId, status: 'SUCCEEDED', paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.order.count({ where: { restaurantId: req.restaurantId, status: { not: 'CANCELLED' } } }),
    prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM ("readyAt" - "placedAt"))) AS avg_seconds
      FROM orders
      WHERE "restaurantId" = ${req.restaurantId} AND "readyAt" IS NOT NULL
        AND "placedAt" >= ${startOfMonth}
    `,
  ]);

  const avgOrderValue =
    todayAgg._count > 0 ? Number(todayAgg._sum.amount || 0) / todayAgg._count : 0;

  res.json({
    success: true,
    data: {
      todayRevenue: Number(todayAgg._sum.amount || 0),
      weekRevenue: Number(weekAgg._sum.amount || 0),
      monthRevenue: Number(monthAgg._sum.amount || 0),
      totalOrders,
      avgOrderValue,
      avgKitchenPrepMinutes: avgFulfillment[0]?.avg_seconds
        ? Math.round(Number(avgFulfillment[0].avg_seconds) / 60)
        : null,
    },
  });
}

// ---------------------------------------------------------------------
// Revenue over time (for charts)
// ---------------------------------------------------------------------

// GET /api/restaurant/reports/revenue-series?range=7d|30d|12m
async function revenueSeries(req, res) {
  const { range } = req.query;
  const bucket = range === '12m' ? 'month' : 'day';
  const since =
    range === '12m'
      ? new Date(new Date().setMonth(new Date().getMonth() - 12))
      : startOfRange(range);

  const rows = await prisma.$queryRaw`
    SELECT date_trunc(${bucket}, "paidAt") AS bucket, SUM(amount) AS revenue, COUNT(*) AS payments
    FROM payments
    WHERE "restaurantId" = ${req.restaurantId} AND status = 'SUCCEEDED' AND "paidAt" >= ${since}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  res.json({
    success: true,
    data: rows.map((r) => ({
      date: r.bucket,
      revenue: Number(r.revenue),
      payments: Number(r.payments),
    })),
  });
}

// ---------------------------------------------------------------------
// Top-selling items
// ---------------------------------------------------------------------

// GET /api/restaurant/reports/top-items?limit=10&range=30d
async function topItems(req, res) {
  const { limit, range } = req.query;
  const since = startOfRange(range);

  const grouped = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: {
      status: { not: 'CANCELLED' },
      order: { restaurantId: req.restaurantId, placedAt: { gte: since } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: grouped.map((g) => g.menuItemId) } },
    select: { id: true, name: true, price: true, imageUrl: true, type: true },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  const data = grouped.map((g) => {
    const item = menuItemMap.get(g.menuItemId);
    const quantitySold = g._sum.quantity || 0;
    return {
      menuItemId: g.menuItemId,
      name: item?.name || 'Unknown item',
      type: item?.type,
      imageUrl: item?.imageUrl,
      quantitySold,
      revenue: quantitySold * Number(item?.price || 0),
    };
  });

  res.json({ success: true, data });
}

// ---------------------------------------------------------------------
// Peak hours
// ---------------------------------------------------------------------

// GET /api/restaurant/reports/peak-hours
async function peakHours(req, res) {
  const since = startOfRange('30d');

  const rows = await prisma.$queryRaw`
    SELECT EXTRACT(HOUR FROM "placedAt") AS hour, COUNT(*) AS orders
    FROM orders
    WHERE "restaurantId" = ${req.restaurantId} AND "placedAt" >= ${since} AND status != 'CANCELLED'
    GROUP BY hour
    ORDER BY hour ASC
  `;

  // Fill in every hour 0-23 so the chart doesn't have gaps.
  const byHour = new Map(rows.map((r) => [Number(r.hour), Number(r.orders)]));
  const data = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: byHour.get(hour) || 0 }));

  res.json({ success: true, data });
}

// ---------------------------------------------------------------------
// Staff performance
// ---------------------------------------------------------------------

// GET /api/restaurant/reports/staff-performance (Waiters)
async function staffPerformance(req, res) {
  const waiters = await prisma.user.findMany({
    where: { restaurantId: req.restaurantId, role: 'WAITER' },
    select: { id: true, name: true, email: true, isActive: true },
  });

  const [manualOrderStats, servedStats, callStats] = await Promise.all([
    prisma.order.groupBy({
      by: ['takenByWaiterId'],
      where: { restaurantId: req.restaurantId, source: 'WAITER_MANUAL', takenByWaiterId: { not: null } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ['servedById'],
      where: { restaurantId: req.restaurantId, servedById: { not: null } },
      _count: { _all: true },
    }),
    prisma.waiterCall.groupBy({
      by: ['acknowledgedById'],
      where: { restaurantId: req.restaurantId, acknowledgedById: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const orderStatsMap = new Map(manualOrderStats.map((s) => [s.takenByWaiterId, s]));
  const servedMap = new Map(servedStats.map((s) => [s.servedById, s._count._all]));
  const callMap = new Map(callStats.map((s) => [s.acknowledgedById, s._count._all]));

  const data = waiters
    .map((w) => {
      const s = orderStatsMap.get(w.id);
      return {
        id: w.id,
        name: w.name,
        email: w.email,
        isActive: w.isActive,
        ordersTaken: s?._count._all || 0,
        revenueGenerated: Number(s?._sum.totalAmount || 0),
        tablesServed: servedMap.get(w.id) || 0,
        callsAttended: callMap.get(w.id) || 0,
      };
    })
    .sort((a, b) => b.revenueGenerated - a.revenueGenerated);

  res.json({ success: true, data });
}

// GET /api/restaurant/reports/chef-performance?range=7d|30d
// Daily breakdown of orders accepted/completed per chef.
async function chefPerformance(req, res) {
  const since = startOfRange(req.query.range || '30d');

  const chefs = await prisma.user.findMany({
    where: { restaurantId: req.restaurantId, role: 'CHEF' },
    select: { id: true, name: true, email: true, isActive: true },
  });

  const rows = await prisma.$queryRaw`
    SELECT "acceptedById" AS chef_id, date_trunc('day', "acceptedAt") AS day,
           COUNT(*) AS accepted,
           COUNT(*) FILTER (WHERE status IN ('SERVED', 'PAID')) AS completed
    FROM orders
    WHERE "restaurantId" = ${req.restaurantId} AND "acceptedById" IS NOT NULL AND "acceptedAt" >= ${since}
    GROUP BY chef_id, day
    ORDER BY day ASC
  `;

  const totalsMap = new Map();
  for (const r of rows) {
    const key = r.chef_id;
    const cur = totalsMap.get(key) || { accepted: 0, completed: 0 };
    cur.accepted += Number(r.accepted);
    cur.completed += Number(r.completed);
    totalsMap.set(key, cur);
  }

  const data = chefs.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    isActive: c.isActive,
    ordersAccepted: totalsMap.get(c.id)?.accepted || 0,
    ordersCompleted: totalsMap.get(c.id)?.completed || 0,
  }));

  const dailyBreakdown = rows.map((r) => ({
    chefId: r.chef_id,
    date: r.day,
    accepted: Number(r.accepted),
    completed: Number(r.completed),
  }));

  res.json({ success: true, data: { summary: data, dailyBreakdown } });
}

// ---------------------------------------------------------------------
// Personal summary (Chef / Waiter — only if Owner has granted access)
// ---------------------------------------------------------------------

// GET /api/restaurant/reports/my-performance
// Gated by req.user.canViewOwnReports (checked in the route middleware).
async function myPerformance(req, res) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const where = { restaurantId: req.restaurantId, placedAt: { gte: startOfToday } };

  if (req.user.role === 'CHEF') {
    const [accepted, completed] = await Promise.all([
      prisma.order.count({ where: { ...where, acceptedById: req.user.id } }),
      prisma.order.count({
        where: { ...where, acceptedById: req.user.id, status: { in: ['SERVED', 'PAID'] } },
      }),
    ]);
    return res.json({ success: true, data: { role: 'CHEF', ordersAccepted: accepted, ordersCompleted: completed } });
  }

  if (req.user.role === 'WAITER') {
    const [callsAttended, tablesServed] = await Promise.all([
      prisma.waiterCall.count({
        where: { restaurantId: req.restaurantId, acknowledgedById: req.user.id, createdAt: { gte: startOfToday } },
      }),
      prisma.order.count({ where: { ...where, servedById: req.user.id } }),
    ]);
    return res.json({ success: true, data: { role: 'WAITER', callsAttended, tablesServed } });
  }

  res.json({ success: true, data: null });
}

// ---------------------------------------------------------------------
// Payments collected — accountability for cash collection
// ---------------------------------------------------------------------

// GET /api/restaurant/reports/payments-collected?range=7d|30d|90d|all
// Owner-facing view of who actually confirmed cash-in-hand for each
// payment, plus a per-collector summary (count + total).
async function paymentsCollected(req, res) {
  const since = startOfRange(req.query.range || '30d');

  const payments = await prisma.payment.findMany({
    where: {
      restaurantId: req.restaurantId,
      status: 'SUCCEEDED',
      collectedById: { not: null },
      paidAt: { gte: since },
    },
    include: {
      collectedBy: { select: { id: true, name: true, role: true } },
      diningSession: { include: { table: { select: { tableNumber: true } } } },
    },
    orderBy: { paidAt: 'desc' },
    take: 100,
  });

  const summaryMap = new Map();
  for (const p of payments) {
    const key = p.collectedById;
    const cur = summaryMap.get(key) || {
      id: p.collectedBy.id,
      name: p.collectedBy.name,
      role: p.collectedBy.role,
      count: 0,
      totalCollected: 0,
    };
    cur.count += 1;
    cur.totalCollected += Number(p.amount);
    summaryMap.set(key, cur);
  }

  res.json({
    success: true,
    data: {
      summary: Array.from(summaryMap.values()).sort((a, b) => b.totalCollected - a.totalCollected),
      recent: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        paidAt: p.paidAt,
        collectedBy: p.collectedBy ? { id: p.collectedBy.id, name: p.collectedBy.name, role: p.collectedBy.role } : null,
        tableNumber: p.diningSession?.table?.tableNumber || null,
      })),
    },
  });
}

module.exports = {
  overview,
  revenueSeries,
  topItems,
  peakHours,
  staffPerformance,
  chefPerformance,
  myPerformance,
  paymentsCollected,
};
