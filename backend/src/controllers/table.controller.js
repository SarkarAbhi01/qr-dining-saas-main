const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

/**
 * The QR code is rendered CLIENT-SIDE (see frontend Tables.jsx), encoding
 * `${window.location.origin}${qrCodeUrl}`. We deliberately do NOT bake an
 * absolute host into the stored value — a backend env var can't know
 * whether the Owner is viewing the dashboard on localhost during dev or
 * on the live domain in production, and baking it wrong means the QR
 * silently points at the wrong place. Storing just the path and letting
 * the browser supply its own origin makes this correct in both cases
 * with zero configuration.
 */
function buildOrderPath({ tableId, restaurantSlug }) {
  return `/order/${restaurantSlug}/${tableId}`;
}

function serializeTable(t) {
  return {
    id: t.id,
    tableNumber: t.tableNumber,
    capacity: t.capacity,
    status: t.status,
    qrCodeUrl: t.qrCodeUrl,
    activeSessionId: t.diningSessions?.[0]?.id || null,
  };
}

// Restaurants are capped by their subscription plan's maxTables, unless
// a SuperAdmin has granted a custom (higher or lower) limit via the
// bypass toggle — which only applies while it hasn't expired.
async function assertWithinTableLimit(restaurant, additionalCount) {
  const bypassActive =
    restaurant.customLimitsEnabled &&
    restaurant.customLimitsExpiresAt &&
    restaurant.customLimitsExpiresAt > new Date();

  const maxTables = bypassActive ? restaurant.customMaxTables : restaurant.subscriptionPlan?.maxTables;
  if (maxTables == null) return; // no plan/limit attached — don't block

  const currentCount = await prisma.restaurantTable.count({ where: { restaurantId: restaurant.id } });
  if (currentCount + additionalCount > maxTables) {
    throw ApiError.conflict(
      `This would exceed your table limit (${maxTables}). You currently have ${currentCount}. Contact your platform admin to raise it.`
    );
  }
}

// GET /api/restaurant/tables
async function listTables(req, res) {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: req.restaurantId },
    include: {
      diningSessions: { where: { status: { in: ['ACTIVE', 'BILL_REQUESTED'] } }, take: 1 },
    },
    orderBy: { tableNumber: 'asc' },
  });
  res.json({ success: true, data: tables.map(serializeTable) });
}

// POST /api/restaurant/tables  { tableNumber, capacity }
async function createTable(req, res) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId },
    include: { subscriptionPlan: true },
  });
  await assertWithinTableLimit(restaurant, 1);

  const table = await prisma.restaurantTable.create({
    data: {
      restaurantId: req.restaurantId,
      tableNumber: req.body.tableNumber,
      capacity: req.body.capacity,
      qrCodeUrl: '', // filled in right after, once we have the table id
    },
  });

  const qrCodeUrl = buildOrderPath({ tableId: table.id, restaurantSlug: restaurant.slug });
  const updated = await prisma.restaurantTable.update({ where: { id: table.id }, data: { qrCodeUrl } });

  res.status(201).json({ success: true, data: serializeTable(updated) });
}

// POST /api/restaurant/tables/bulk  { prefix, startAt, count, capacity }
async function bulkCreateTables(req, res) {
  const { prefix = '', startAt, count, capacity } = req.body;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId },
    include: { subscriptionPlan: true },
  });
  await assertWithinTableLimit(restaurant, count);

  const created = [];
  for (let i = 0; i < count; i++) {
    const tableNumber = `${prefix}${startAt + i}`;
    const table = await prisma.restaurantTable.create({
      data: { restaurantId: req.restaurantId, tableNumber, capacity, qrCodeUrl: '' },
    });
    const qrCodeUrl = buildOrderPath({ tableId: table.id, restaurantSlug: restaurant.slug });
    const updated = await prisma.restaurantTable.update({ where: { id: table.id }, data: { qrCodeUrl } });
    created.push(serializeTable(updated));
  }

  res.status(201).json({ success: true, data: created });
}

// PATCH /api/restaurant/tables/:id
async function updateTable(req, res) {
  const table = await prisma.restaurantTable.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!table) throw ApiError.notFound('Table not found');

  const updated = await prisma.restaurantTable.update({
    where: { id: table.id },
    data: req.body,
  });

  req.app.get('io')?.to(`restaurant:${req.restaurantId}`).emit('table:update', serializeTable(updated));

  res.json({ success: true, data: serializeTable(updated) });
}

// DELETE /api/restaurant/tables/:id
async function deleteTable(req, res) {
  const table = await prisma.restaurantTable.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!table) throw ApiError.notFound('Table not found');

  await prisma.restaurantTable.delete({ where: { id: table.id } });

  res.json({ success: true, message: 'Table deleted' });
}

module.exports = {
  listTables,
  createTable,
  bulkCreateTables,
  updateTable,
  deleteTable,
};
