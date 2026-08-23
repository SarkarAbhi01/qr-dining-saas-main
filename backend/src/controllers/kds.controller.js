const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY'];

const ORDER_ITEM_INCLUDE = {
  items: {
    include: {
      menuItem: { select: { id: true, name: true, preparationMinutes: true } },
      modifiers: { include: { modifierOption: true } },
    },
  },
  table: { select: { id: true, tableNumber: true } },
  acceptedBy: { select: { id: true, name: true, role: true } },
};

function emitOrderUpdate(req, order) {
  const io = req.app.get('io');
  if (!io) return;
  io.to(`restaurant:${req.restaurantId}:kitchen`).emit('order:update', order);
  io.to(`restaurant:${req.restaurantId}:waiters`).emit('order:update', order);
  io.to(`restaurant:${req.restaurantId}`).emit('order:update', order);
  io.to(`table:${order.tableId}`).emit('order:update', order);
}

// GET /api/restaurant/kds/orders
// The core KDS feed: every order still in flight, oldest first so the
// ticket rail naturally reads top-to-bottom in the order it was fired.
async function listActiveOrders(req, res) {
  const orders = await prisma.order.findMany({
    where: { restaurantId: req.restaurantId, status: { in: ACTIVE_STATUSES } },
    include: ORDER_ITEM_INCLUDE,
    orderBy: { placedAt: 'asc' },
  });

  res.json({ success: true, data: orders });
}

// Recomputes an order's overall status from the aggregate of its item
// statuses, and stamps readyAt/servedAt the moment every item crosses
// that threshold. Cancelled items don't block progression.
//
// `actingUserId`, when passed, implicitly claims the order (same effect
// as tapping "Accept order") the first time ANYONE acts on it — tapping
// "Start preparing" is itself an implicit acceptance. Without this, a
// chef who never bothers with the separate Accept button leaves
// acceptedById/acceptedAt null forever, silently zeroing them out of
// every chef-performance report even though they did the work.
async function recomputeOrderStatus(orderId, actingUserId = null) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_ITEM_INCLUDE,
  });

  const data = {};

  if (actingUserId && !order.acceptedById) {
    data.acceptedById = actingUserId;
    data.acceptedAt = new Date();
  }

  const liveItems = order.items.filter((i) => i.status !== 'CANCELLED');
  if (liveItems.length > 0) {
    const allServed = liveItems.every((i) => i.status === 'SERVED');
    const allReadyOrBeyond = liveItems.every((i) => ['READY', 'SERVED'].includes(i.status));
    const anyPreparing = liveItems.some((i) => ['PREPARING', 'READY', 'SERVED'].includes(i.status));

    let nextStatus = order.status;
    if (allServed) {
      nextStatus = 'SERVED';
      if (!order.servedAt) data.servedAt = new Date();
    } else if (allReadyOrBeyond) {
      nextStatus = 'READY';
      if (!order.readyAt) data.readyAt = new Date();
    } else if (anyPreparing) {
      nextStatus = 'PREPARING';
    }
    if (nextStatus !== order.status) data.status = nextStatus;
  }

  if (Object.keys(data).length === 0) return order;

  return prisma.order.update({ where: { id: orderId }, data, include: ORDER_ITEM_INCLUDE });
}

// PATCH /api/restaurant/kds/order-items/:id/status  { status }
// The one-tap "Received -> Preparing -> Ready" button on each item card.
async function updateOrderItemStatus(req, res) {
  if (req.body.status === 'SERVED') {
    throw ApiError.forbidden('Marking an item served happens from the Waiter view, not the kitchen');
  }

  const item = await prisma.orderItem.findFirst({
    where: { id: req.params.id, order: { restaurantId: req.restaurantId } },
  });
  if (!item) throw ApiError.notFound('Order item not found');

  await prisma.orderItem.update({ where: { id: item.id }, data: { status: req.body.status } });

  const order = await recomputeOrderStatus(item.orderId, req.user.id);

  emitOrderUpdate(req, order);

  // Once the whole order flips to READY, the waiter's service queue cares.
  if (order.status === 'READY') {
    req.app.get('io')?.to(`restaurant:${req.restaurantId}:waiters`).emit('order:ready', order);
  }

  res.json({ success: true, data: order });
}

// PATCH /api/restaurant/kds/orders/:id/status  { status }
// Bulk-advance every (non-cancelled) item on the order to match — the
// "move the whole ticket forward" action for kitchens that don't need
// per-item granularity.
async function updateOrderStatus(req, res) {
  const { status } = req.body;

  // Serving the food is the Waiter's responsibility, not the kitchen's.
  // The KDS flow stops at READY for everyone — marking SERVED must go
  // through waiter.controller.markServed instead, which is the only
  // path that correctly records who served it (servedById).
  if (status === 'SERVED') {
    throw ApiError.forbidden('Marking an order served happens from the Waiter view, not the kitchen');
  }

  const order = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
    include: { items: true },
  });
  if (!order) throw ApiError.notFound('Order not found');

  const itemStatusMap = { PREPARING: 'PREPARING', READY: 'READY' };
  const itemStatus = itemStatusMap[status];

  if (itemStatus) {
    await prisma.orderItem.updateMany({
      where: { orderId: order.id, status: { not: 'CANCELLED' } },
      data: { status: itemStatus },
    });
  } else if (status === 'CANCELLED') {
    await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { status: 'CANCELLED' } });
  }

  const updated = await recomputeOrderStatus(order.id, req.user.id);
  const finalOrder =
    status === 'CANCELLED'
      ? await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' }, include: ORDER_ITEM_INCLUDE })
      : updated;

  emitOrderUpdate(req, finalOrder);

  res.json({ success: true, data: finalOrder });
}

// PATCH /api/restaurant/kds/orders/:id/accept
// Accountability: whoever (Chef, Manager, or Owner) taps "Accept" is
// logged against the order so any mistake can be traced back to who
// took responsibility for cooking it. First to claim wins — a second
// tap by someone else is rejected rather than silently reassigning.
async function acceptOrder(req, res) {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
    include: { acceptedBy: { select: { id: true, name: true } } },
  });
  if (!order) throw ApiError.notFound('Order not found');

  if (order.acceptedById && order.acceptedById !== req.user.id) {
    throw ApiError.conflict(`Already accepted by ${order.acceptedBy?.name || 'another staff member'}`);
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { acceptedById: req.user.id, acceptedAt: order.acceptedAt || new Date() },
    include: ORDER_ITEM_INCLUDE,
  });

  emitOrderUpdate(req, updated);
  res.json({ success: true, data: updated });
}

// GET /api/restaurant/kds/stats — today's dashboard counters
async function todayStats(req, res) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const where = { restaurantId: req.restaurantId, placedAt: { gte: startOfToday } };

  const [total, accepted, pending, completed] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, acceptedById: { not: null } } }),
    prisma.order.count({ where: { ...where, status: { in: ['PENDING', 'PREPARING'] } } }),
    prisma.order.count({ where: { ...where, status: { in: ['SERVED', 'PAID'] } } }),
  ]);

  res.json({ success: true, data: { todaysOrders: total, accepted, pending, completed } });
}

module.exports = { listActiveOrders, updateOrderItemStatus, updateOrderStatus, acceptOrder, todayStats };
