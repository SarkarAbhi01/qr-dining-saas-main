const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { createPendingPaymentsForSession, markPaymentSucceeded } = require('../services/payment.service');

const TAX_RATE = Number(process.env.TAX_RATE || 0);

function emitToRestaurant(req, event, payload) {
  const io = req.app.get('io');
  if (!io) return;
  io.to(`restaurant:${req.restaurantId}`).emit(event, payload);
  io.to(`restaurant:${req.restaurantId}:waiters`).emit(event, payload);
}

// ---------------------------------------------------------------------
// Live table grid — Green (empty) / Red (occupied) / Yellow (attention)
// ---------------------------------------------------------------------

// GET /api/restaurant/waiter/tables
async function listTables(req, res) {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: req.restaurantId },
    include: {
      diningSessions: {
        where: { status: { in: ['ACTIVE', 'BILL_REQUESTED'] } },
        take: 1,
        orderBy: { startedAt: 'desc' },
        include: {
          orders: { select: { id: true, status: true, totalAmount: true } },
          openedBy: { select: { id: true, name: true, role: true } },
        },
      },
    },
    orderBy: { tableNumber: 'asc' },
  });

  const data = tables.map((t) => {
    const session = t.diningSessions[0] || null;
    return {
      id: t.id,
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      status: t.status,
      session: session
        ? {
            id: session.id,
            status: session.status,
            orderCount: session.orders.length,
            totalAmount: session.orders.reduce((s, o) => s + Number(o.totalAmount), 0),
            hasReadyOrder: session.orders.some((o) => o.status === 'READY'),
            source: session.source,
            openedBy: session.openedBy ? { name: session.openedBy.name, role: session.openedBy.role } : null,
          }
        : null,
    };
  });

  res.json({ success: true, data });
}

// ---------------------------------------------------------------------
// Service queue — orders the kitchen has marked READY
// ---------------------------------------------------------------------

// GET /api/restaurant/waiter/service-queue
async function serviceQueue(req, res) {
  const orders = await prisma.order.findMany({
    where: { restaurantId: req.restaurantId, status: 'READY' },
    include: {
      table: { select: { id: true, tableNumber: true } },
      items: { include: { menuItem: { select: { name: true } } } },
    },
    orderBy: { readyAt: 'asc' },
  });
  res.json({ success: true, data: orders });
}

// PATCH /api/restaurant/waiter/orders/:id/serve
async function markServed(req, res) {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!order) throw ApiError.notFound('Order not found');

  await prisma.orderItem.updateMany({
    where: { orderId: order.id, status: { not: 'CANCELLED' } },
    data: { status: 'SERVED' },
  });
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'SERVED', servedAt: new Date(), servedById: req.user.id },
    include: { table: true },
  });

  emitToRestaurant(req, 'order:update', updated);
  req.app.get('io')?.to(`table:${order.tableId}`).emit('order:update', updated);

  res.json({ success: true, data: updated });
}

// ---------------------------------------------------------------------
// Manual order entry (for non-tech-savvy customers)
// ---------------------------------------------------------------------

// POST /api/restaurant/waiter/manual-orders  { tableId, items[] }
async function createManualOrder(req, res) {
  const table = await prisma.restaurantTable.findFirst({
    where: { id: req.body.tableId, restaurantId: req.restaurantId },
  });
  if (!table) throw ApiError.notFound('Table not found');

  let session = await prisma.diningSession.findFirst({
    where: { tableId: table.id, status: { in: ['ACTIVE', 'BILL_REQUESTED'] } },
    orderBy: { startedAt: 'desc' },
  });
  if (!session) {
    session = await prisma.diningSession.create({
      data: {
        restaurantId: req.restaurantId,
        tableId: table.id,
        status: 'ACTIVE',
        source: 'STAFF_MANUAL',
        openedById: req.user.id,
      },
    });
  }
  if (session.status === 'BILL_REQUESTED') {
    throw ApiError.conflict('Bill already requested for this table — settle up before adding more items');
  }

  const menuItemIds = req.body.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId: req.restaurantId },
    include: { modifierGroups: { include: { options: true } } },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const itemsToCreate = [];
  for (const line of req.body.items) {
    const menuItem = menuItemMap.get(line.menuItemId);
    if (!menuItem) throw ApiError.badRequest(`Menu item ${line.menuItemId} not found`);

    const portion = line.portion || 'FULL';
    if (portion === 'HALF' && !menuItem.hasHalfFull) {
      throw ApiError.badRequest(`${menuItem.name} doesn't offer a Half portion`);
    }
    const basePrice = portion === 'HALF' ? Number(menuItem.halfPrice) : Number(menuItem.price);

    const allOptions = menuItem.modifierGroups.flatMap((g) => g.options);
    const chosenOptions = allOptions.filter((o) => line.modifierOptionIds?.includes(o.id));
    const modifierTotal = chosenOptions.reduce((sum, o) => sum + Number(o.extraPrice), 0);
    const unitPrice = basePrice + modifierTotal;
    subtotal += unitPrice * line.quantity;

    itemsToCreate.push({
      menuItemId: menuItem.id,
      quantity: line.quantity,
      portion,
      unitPrice,
      notes: line.notes || null,
      modifiers: {
        create: chosenOptions.map((o) => ({ modifierOptionId: o.id, priceSnapshot: o.extraPrice })),
      },
    });
  }

  const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
  const totalAmount = subtotal + taxAmount;

  const order = await prisma.order.create({
    data: {
      restaurantId: req.restaurantId,
      tableId: table.id,
      diningSessionId: session.id,
      source: 'WAITER_MANUAL',
      takenByWaiterId: req.user.id,
      subtotal,
      taxAmount,
      totalAmount,
      items: { create: itemsToCreate },
    },
    include: { items: { include: { menuItem: true, modifiers: true } }, table: true },
  });

  if (table.status === 'EMPTY') {
    await prisma.restaurantTable.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } });
  }

  const io = req.app.get('io');
  io?.to(`restaurant:${req.restaurantId}:kitchen`).emit('order:new', order);
  io?.to(`restaurant:${req.restaurantId}`).emit('order:new', order);

  res.status(201).json({ success: true, data: order });
}

// ---------------------------------------------------------------------
// Waiter calls (Call Waiter / Request Bill notifications)
// ---------------------------------------------------------------------

// GET /api/restaurant/waiter/calls?status=PENDING
async function listCalls(req, res) {
  const status = req.query.status;
  const calls = await prisma.waiterCall.findMany({
    where: { restaurantId: req.restaurantId, ...(status ? { status } : { status: { not: 'RESOLVED' } }) },
    include: { table: { select: { id: true, tableNumber: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: calls });
}

// PATCH /api/restaurant/waiter/calls/:id/acknowledge
async function acknowledgeCall(req, res) {
  const call = await prisma.waiterCall.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!call) throw ApiError.notFound('Call not found');

  const updated = await prisma.waiterCall.update({
    where: { id: call.id },
    data: { status: 'ACKNOWLEDGED', acknowledgedById: req.user.id },
  });

  emitToRestaurant(req, 'waiter-call:update', updated);
  res.json({ success: true, data: updated });
}

// PATCH /api/restaurant/waiter/calls/:id/resolve
async function resolveCall(req, res) {
  const call = await prisma.waiterCall.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!call) throw ApiError.notFound('Call not found');

  const updated = await prisma.waiterCall.update({
    where: { id: call.id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      // Most waiters go straight to "Resolve" without a separate
      // "Acknowledge" tap — without this fallback, acknowledgedById
      // (which every waiter-performance report is built on) would
      // stay null for the majority of calls, undercounting real work.
      acknowledgedById: call.acknowledgedById || req.user.id,
    },
  });

  // If no other open calls remain for this table, drop it back to occupied
  const otherOpenCalls = await prisma.waiterCall.count({
    where: { tableId: call.tableId, status: { not: 'RESOLVED' } },
  });
  if (otherOpenCalls === 0) {
    await prisma.restaurantTable.update({ where: { id: call.tableId }, data: { status: 'OCCUPIED' } });
  }

  emitToRestaurant(req, 'waiter-call:update', updated);
  res.json({ success: true, data: updated });
}

// GET /api/restaurant/waiter/menu — read-only menu for manual order entry
async function getMenu(req, res) {
  const categories = await prisma.category.findMany({
    where: { restaurantId: req.restaurantId, isActive: true },
    orderBy: { sequence: 'asc' },
    include: {
      menuItems: {
        where: { isAvailable: true },
        orderBy: { sequence: 'asc' },
        include: { modifierGroups: { include: { options: true } } },
      },
    },
  });
  res.json({ success: true, data: categories });
}

// ---------------------------------------------------------------------
// Cash payment collection
// ---------------------------------------------------------------------

// GET /api/restaurant/waiter/payments/pending
async function listPendingPayments(req, res) {
  const payments = await prisma.payment.findMany({
    where: { restaurantId: req.restaurantId, status: 'PENDING' },
    include: {
      diningSession: { include: { table: { select: { id: true, tableNumber: true } } } },
      billSplitShare: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: payments });
}

// PATCH /api/restaurant/waiter/payments/:id/confirm
// Marks a single share as paid. Once every share on the session is paid,
// the session closes and the table frees up for the next sitting.
async function confirmPayment(req, res) {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
    include: { diningSession: true },
  });
  if (!payment) throw ApiError.notFound('Payment not found');

  const { payment: updated, sessionClosed } = await markPaymentSucceeded(payment, {
    collectedById: req.user.id,
    io: req.app.get('io'),
  });

  emitToRestaurant(req, 'payment:confirmed', { payment: updated, sessionClosed });
  res.json({ success: true, data: { payment: updated, sessionClosed } });
}

// POST /api/restaurant/waiter/tables/:tableId/settle-payment  { method }
//
// The gap this closes: every other checkout path (cash, online) is
// initiated by the CUSTOMER from their own phone after scanning the
// table's QR code. A table the waiter served and billed manually never
// goes through that flow, so it never gets a BillSplit or Payment row
// created for it at all — the waiter had no way to collect payment on
// it. This creates the bill split/payment (defaulting to one FULL
// share, same as the QR path) AND immediately marks it paid in one
// step, since the waiter is standing at the table with the money in
// hand right now — there's no reason to make them wait for a separate
// "confirm collected" tap the way the QR flow does (that two-step
// exists specifically because the customer requests payment before a
// waiter has physically arrived).
async function settleTablePayment(req, res) {
  const { method } = req.body;

  const table = await prisma.restaurantTable.findFirst({
    where: { id: req.params.tableId, restaurantId: req.restaurantId },
  });
  if (!table) throw ApiError.notFound('Table not found');

  let session = await prisma.diningSession.findFirst({
    where: { tableId: table.id, status: { in: ['ACTIVE', 'BILL_REQUESTED'] } },
    orderBy: { startedAt: 'desc' },
  });
  if (!session) throw ApiError.notFound('No active order for this table to settle');

  const orderCount = await prisma.order.count({ where: { diningSessionId: session.id } });
  if (orderCount === 0) throw ApiError.conflict('No orders placed for this table yet');

  if (session.status === 'ACTIVE') {
    session = await prisma.diningSession.update({
      where: { id: session.id },
      data: { status: 'BILL_REQUESTED', billRequestedAt: new Date() },
    });
  }

  const io = req.app.get('io');
  const { payments } = await createPendingPaymentsForSession(session, method);

  let sessionClosed = false;
  const settled = [];
  for (const payment of payments) {
    const result = await markPaymentSucceeded(payment, { collectedById: req.user.id, io });
    settled.push(result.payment);
    sessionClosed = sessionClosed || result.sessionClosed;
  }

  emitToRestaurant(req, 'payment:confirmed', { payments: settled, sessionClosed });

  res.status(201).json({
    success: true,
    message: sessionClosed ? 'Table settled and freed up' : 'Payment recorded',
    data: { payments: settled, sessionClosed },
  });
}

// GET /api/restaurant/waiter/payments/collected?range=today
// Payment history with WHO collected each — "Waiter A collected ₹500
// in cash" — surfaced to the Owner for accountability.
async function listCollectedPayments(req, res) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const payments = await prisma.payment.findMany({
    where: { restaurantId: req.restaurantId, status: 'SUCCEEDED', paidAt: { gte: startOfToday } },
    include: {
      diningSession: { include: { table: { select: { tableNumber: true } } } },
      collectedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: { paidAt: 'desc' },
  });

  res.json({ success: true, data: payments });
}

module.exports = {
  listTables,
  serviceQueue,
  markServed,
  createManualOrder,
  getMenu,
  listCalls,
  acknowledgeCall,
  resolveCall,
  listPendingPayments,
  listCollectedPayments,
  confirmPayment,
  settleTablePayment,
};
