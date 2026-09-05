const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

/**
 * Resolves (or creates, defaulting to one FULL share) the unpaid
 * portions of a session's bill, and turns each into a PENDING Payment
 * row of the given method. Shared by every checkout path — customer
 * self-checkout (cash or online) AND a waiter settling a manually-
 * served table that never went through the QR flow at all — so they
 * all behave identically up to the point they diverge (waiter
 * collection vs. redirect to Stripe vs. immediate waiter settlement).
 */
async function createPendingPaymentsForSession(session, method) {
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
          method,
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

  return { payments, total: payments.reduce((sum, p) => sum + Number(p.amount), 0) };
}

/**
 * Marks a payment SUCCEEDED and, if every payment on its dining session
 * is now SUCCEEDED, closes the session, marks its orders PAID, and
 * frees the table for the next sitting. Shared by cash confirmation
 * (a waiter taps "Collected"), online confirmation (Stripe redirect
 * comes back paid), and a waiter's immediate table-side settlement.
 */
async function markPaymentSucceeded(payment, { collectedById = null, io = null } = {}) {
  if (payment.status === 'SUCCEEDED') {
    return { payment, sessionClosed: false };
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'SUCCEEDED', paidAt: new Date(), collectedById },
  });

  const sessionId = payment.diningSessionId;
  let sessionClosed = false;

  if (sessionId) {
    const remaining = await prisma.payment.count({
      where: { diningSessionId: sessionId, status: { not: 'SUCCEEDED' } },
    });

    if (remaining === 0) {
      const session = await prisma.diningSession.update({
        where: { id: sessionId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      await prisma.order.updateMany({
        where: { diningSessionId: sessionId },
        data: { status: 'PAID' },
      });
      await prisma.restaurantTable.update({
        where: { id: session.tableId },
        data: { status: 'EMPTY' },
      });
      sessionClosed = true;

      io?.to(`restaurant:${payment.restaurantId}`).emit('table:update', { id: session.tableId, status: 'EMPTY' });
      io?.to(`table:${session.tableId}`).emit('session:closed', { sessionId });
    }
  }

  return { payment: updated, sessionClosed };
}

module.exports = { createPendingPaymentsForSession, markPaymentSucceeded };
