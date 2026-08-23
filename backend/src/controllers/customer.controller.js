const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const TAX_RATE = Number(process.env.TAX_RATE || 0); // e.g. 0.05 for 5%

function serializeSession(session, orders = []) {
  const subtotal = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  return {
    id: session.id,
    status: session.status,
    billRequestedAt: session.billRequestedAt,
    startedAt: session.startedAt,
    orderCount: orders.length,
    totalAmount: subtotal,
  };
}

// ---------------------------------------------------------------------
// Table scan -> resolve / start dining session
// ---------------------------------------------------------------------

// GET /api/customer/tables/:restaurantSlug/:tableId
// This is what firing the QR code hits first. It either resumes the
// table's current sitting or starts a brand new one.
//
// The URL carries BOTH the restaurant slug and the table id. We verify
// they actually belong together — a table id is already an unguessable
// UUID and would resolve correctly on its own, but requiring the slug
// to match too closes off any edit-the-URL cross-tenant mixup (e.g.
// pasting restaurant B's slug in front of restaurant A's table id) as
// a hard 404 instead of silently trusting whichever one "wins".
async function resolveTable(req, res) {
  const table = await prisma.restaurantTable.findUnique({
    where: { id: req.params.tableId },
    include: { restaurant: true },
  });

  if (!table || table.restaurant.slug !== req.params.restaurantSlug) {
    throw ApiError.notFound('This QR code is no longer valid');
  }
  if (!['ACTIVE', 'TRIAL'].includes(table.restaurant.status)) {
    throw ApiError.forbidden('This restaurant is not currently accepting orders');
  }

  let session = await prisma.diningSession.findFirst({
    where: { tableId: table.id, status: { in: ['ACTIVE', 'BILL_REQUESTED'] } },
    orderBy: { startedAt: 'desc' },
  });

  if (!session) {
    session = await prisma.diningSession.create({
      data: { restaurantId: table.restaurantId, tableId: table.id, status: 'ACTIVE' },
    });
  }

  if (table.status === 'EMPTY') {
    await prisma.restaurantTable.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } });
  }

  const orders = await prisma.order.findMany({ where: { diningSessionId: session.id } });

  res.json({
    success: true,
    data: {
      restaurant: {
        id: table.restaurant.id,
        name: table.restaurant.name,
        slug: table.restaurant.slug,
        currency: table.restaurant.currency,
        logoUrl: table.restaurant.logoUrl,
      },
      table: { id: table.id, tableNumber: table.tableNumber },
      session: serializeSession(session, orders),
    },
  });
}

// ---------------------------------------------------------------------
// Public menu
// ---------------------------------------------------------------------

// GET /api/customer/menu/:slug
async function getPublicMenu(req, res) {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant) throw ApiError.notFound('Restaurant not found');

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    orderBy: { sequence: 'asc' },
    include: {
      menuItems: {
        where: { isAvailable: true },
        orderBy: { sequence: 'asc' },
        include: { modifierGroups: { include: { options: true } } },
      },
    },
  });

  res.json({ success: true, data: { restaurant: { name: restaurant.name, currency: restaurant.currency }, categories } });
}

// ---------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------

async function loadActiveSession(sessionId) {
  const session = await prisma.diningSession.findUnique({ where: { id: sessionId } });
  if (!session) throw ApiError.notFound('Session not found — please rescan the table QR code');
  return session;
}

// POST /api/customer/sessions/:sessionId/orders
async function placeOrder(req, res) {
  const session = await loadActiveSession(req.params.sessionId);

  if (session.status === 'CLOSED') {
    throw ApiError.conflict('Your bill has already been settled — please scan the table QR code again to start a new order');
  }
  if (session.status !== 'ACTIVE') {
    throw ApiError.conflict('The bill has already been requested for this table — ask your waiter to add more items');
  }

  const menuItemIds = req.body.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId: session.restaurantId, isAvailable: true },
    include: { modifierGroups: { include: { options: true } } },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const itemsToCreate = [];

  for (const line of req.body.items) {
    const menuItem = menuItemMap.get(line.menuItemId);
    if (!menuItem) throw ApiError.badRequest(`Menu item ${line.menuItemId} is unavailable`);

    const portion = line.portion || 'FULL';
    if (portion === 'HALF' && !menuItem.hasHalfFull) {
      throw ApiError.badRequest(`${menuItem.name} doesn't offer a Half portion`);
    }
    const basePrice = portion === 'HALF' ? Number(menuItem.halfPrice) : Number(menuItem.price);

    const allOptions = menuItem.modifierGroups.flatMap((g) => g.options);
    const chosenOptions = allOptions.filter((o) => line.modifierOptionIds.includes(o.id));

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
      restaurantId: session.restaurantId,
      tableId: session.tableId,
      diningSessionId: session.id,
      source: 'CUSTOMER_QR',
      subtotal,
      taxAmount,
      totalAmount,
      items: { create: itemsToCreate },
    },
    include: { items: { include: { menuItem: true, modifiers: true } } },
  });

  // Live-push to the kitchen (KDS) and staff dashboards — Phase 5 consumes this
  req.app.get('io')?.to(`restaurant:${session.restaurantId}:kitchen`).emit('order:new', order);
  req.app.get('io')?.to(`restaurant:${session.restaurantId}`).emit('order:new', order);

  res.status(201).json({ success: true, data: order });
}

// GET /api/customer/sessions/:sessionId
async function getSession(req, res) {
  const session = await loadActiveSession(req.params.sessionId);

  const orders = await prisma.order.findMany({
    where: { diningSessionId: session.id },
    orderBy: { placedAt: 'asc' },
    include: { items: { include: { menuItem: true, modifiers: { include: { modifierOption: true } } } } },
  });

  res.json({ success: true, data: { session: serializeSession(session, orders), orders } });
}

// ---------------------------------------------------------------------
// Waiter calls (Call Waiter / Request Bill)
// ---------------------------------------------------------------------

// POST /api/customer/sessions/:sessionId/call-waiter
async function callWaiter(req, res) {
  const session = await loadActiveSession(req.params.sessionId);

  const call = await prisma.waiterCall.create({
    data: { restaurantId: session.restaurantId, tableId: session.tableId, type: 'CALL_WAITER' },
  });

  await prisma.restaurantTable.update({
    where: { id: session.tableId },
    data: { status: 'NEEDS_ATTENTION' },
  });

  req.app.get('io')?.to(`restaurant:${session.restaurantId}:waiters`).emit('waiter-call:new', call);

  res.status(201).json({ success: true, message: 'A waiter has been notified', data: call });
}

// POST /api/customer/sessions/:sessionId/request-bill
// Enforced once per sitting — see DiningSession.status in the schema.
async function requestBill(req, res) {
  const session = await loadActiveSession(req.params.sessionId);

  if (session.status === 'BILL_REQUESTED') {
    return res.json({ success: true, message: 'Bill already requested', data: { alreadyRequested: true } });
  }
  if (session.status === 'CLOSED') {
    throw ApiError.conflict('This session has already been closed');
  }

  const [updatedSession, call] = await prisma.$transaction([
    prisma.diningSession.update({
      where: { id: session.id },
      data: { status: 'BILL_REQUESTED', billRequestedAt: new Date() },
    }),
    prisma.waiterCall.create({
      data: { restaurantId: session.restaurantId, tableId: session.tableId, type: 'REQUEST_BILL' },
    }),
  ]);

  await prisma.restaurantTable.update({
    where: { id: session.tableId },
    data: { status: 'NEEDS_ATTENTION' },
  });

  req.app.get('io')?.to(`restaurant:${session.restaurantId}:waiters`).emit('waiter-call:new', call);

  res.status(201).json({ success: true, data: { session: updatedSession, call } });
}

// ---------------------------------------------------------------------
// Split bill
// ---------------------------------------------------------------------

// POST /api/customer/sessions/:sessionId/split
async function createBillSplit(req, res) {
  const session = await loadActiveSession(req.params.sessionId);
  if (session.status !== 'BILL_REQUESTED') {
    throw ApiError.conflict('Request the bill before choosing how to split it');
  }

  const orders = await prisma.order.findMany({ where: { diningSessionId: session.id } });
  const total = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const { splitType, numberOfShares, shares } = req.body;

  let shareRows;
  if (splitType === 'FULL') {
    shareRows = [{ label: 'Full bill', amount: total }];
  } else if (splitType === 'EQUAL') {
    const perShare = Math.round((total / numberOfShares) * 100) / 100;
    shareRows = Array.from({ length: numberOfShares }, (_, i) => ({
      label: `Guest ${i + 1}`,
      amount: perShare,
    }));
  } else {
    const sum = shares.reduce((s, x) => s + Number(x.amount), 0);
    if (Math.abs(sum - total) > 0.5) {
      throw ApiError.badRequest(
        `Custom split amounts (${sum.toFixed(2)}) must add up to the bill total (${total.toFixed(2)})`
      );
    }
    shareRows = shares;
  }

  const billSplit = await prisma.billSplit.create({
    data: {
      diningSessionId: session.id,
      splitType,
      numberOfShares: splitType === 'EQUAL' ? numberOfShares : null,
      shares: { create: shareRows },
    },
    include: { shares: true },
  });

  res.status(201).json({ success: true, data: { ...billSplit, total } });
}

// ---------------------------------------------------------------------
// Checkout (cash-only for now — card gateways are a later addition)
// ---------------------------------------------------------------------

// POST /api/customer/sessions/:sessionId/checkout/cash
// Turns the chosen bill split (or defaults to a single FULL share if the
// customer skipped that step) into Payment records a waiter can collect
// against and confirm. Doesn't close the session — that happens once
// every share has actually been paid (see waiter.controller.confirmPayment).
async function checkoutCash(req, res) {
  const session = await loadActiveSession(req.params.sessionId);

  if (session.status !== 'BILL_REQUESTED') {
    throw ApiError.conflict('Request the bill before checking out');
  }

  const orders = await prisma.order.findMany({ where: { diningSessionId: session.id } });
  const total = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  let billSplit = await prisma.billSplit.findFirst({
    where: { diningSessionId: session.id },
    orderBy: { createdAt: 'desc' },
    include: { shares: true },
  });

  if (!billSplit) {
    billSplit = await prisma.billSplit.create({
      data: { diningSessionId: session.id, splitType: 'FULL', shares: { create: [{ label: 'Full bill', amount: total }] } },
      include: { shares: true },
    });
  }

  const unpaidShares = billSplit.shares.filter((s) => !s.paymentId);
  if (unpaidShares.length === 0) {
    throw ApiError.conflict('This bill has already been submitted for payment');
  }

  const payments = await prisma.$transaction(
    unpaidShares.map((share) =>
      prisma.payment.create({
        data: {
          restaurantId: session.restaurantId,
          diningSessionId: session.id,
          method: 'CASH',
          status: 'PENDING',
          amount: share.amount,
        },
      })
    )
  );

  await prisma.$transaction(
    payments.map((p, i) =>
      prisma.billSplitShare.update({ where: { id: unpaidShares[i].id }, data: { paymentId: p.id } })
    )
  );

  const io = req.app.get('io');
  io?.to(`restaurant:${session.restaurantId}:waiters`).emit('payment:requested', {
    tableId: session.tableId,
    diningSessionId: session.id,
    payments,
  });

  res.status(201).json({
    success: true,
    message: 'A waiter has been notified to collect payment',
    data: { payments },
  });
}

// ---------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------

// POST /api/customer/sessions/:sessionId/feedback  { type, rating, comment?, aboutWaiterId?, aboutChefId? }
async function submitFeedback(req, res) {
  const session = await loadActiveSession(req.params.sessionId);

  const feedback = await prisma.feedback.create({
    data: {
      restaurantId: session.restaurantId,
      tableId: session.tableId,
      diningSessionId: session.id,
      type: req.body.type,
      rating: req.body.rating,
      comment: req.body.comment || null,
      aboutWaiterId: req.body.aboutWaiterId || null,
      aboutChefId: req.body.aboutChefId || null,
    },
  });

  res.status(201).json({ success: true, message: 'Thanks for your feedback!', data: feedback });
}

// GET /api/customer/staff/:slug — active Waiters & Chefs, for the
// complaint form's "which staff member" dropdown. Names only.
async function listStaffForComplaint(req, res) {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant) throw ApiError.notFound('Restaurant not found');

  const staff = await prisma.user.findMany({
    where: { restaurantId: restaurant.id, role: { in: ['WAITER', 'CHEF'] }, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });

  res.json({ success: true, data: staff });
}

module.exports = {
  resolveTable,
  getPublicMenu,
  placeOrder,
  getSession,
  callWaiter,
  requestBill,
  createBillSplit,
  checkoutCash,
  submitFeedback,
  listStaffForComplaint,
};
