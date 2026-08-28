const prisma = require('../config/prisma');

/**
 * Marks a payment SUCCEEDED and, if every payment on its dining session
 * is now SUCCEEDED, closes the session, marks its orders PAID, and
 * frees the table for the next sitting. Shared by cash confirmation
 * (a waiter taps "Collected") and online confirmation (Stripe redirect
 * comes back paid) so both paths behave identically.
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

module.exports = { markPaymentSucceeded };
