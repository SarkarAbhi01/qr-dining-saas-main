/**
 * Removes genuinely "unwanted" clutter records that accumulate over
 * time and have no ongoing business value — never anything that's
 * part of a restaurant's real order/payment history. Writes a plain
 * .txt report of exactly what it found/removed, so nothing disappears
 * silently.
 *
 * What counts as "unwanted" here (deliberately conservative — this
 * never touches PAID/SERVED orders, successful payments, or backups):
 *
 *   1. Refresh tokens that are expired or already revoked — pure
 *      auth-session litter, safe to delete unconditionally.
 *   2. Failed payments (status FAILED) older than --failed-payment-days
 *      (default 30) — the attempt didn't succeed, nothing to reconcile.
 *   3. Abandoned dining sessions — status ACTIVE, zero orders ever
 *      placed on them, older than --abandoned-session-hours (default 6)
 *      — e.g. a customer scanned a table's QR and never ordered.
 *   4. Fully-cancelled orders — status CANCELLED, older than
 *      --cancelled-order-days (default 90) — kept around for a
 *      retention window in case of a dispute, then cleared out.
 *
 * Usage:
 *   node scripts/cleanupUnwantedRecords.js                # dry run (default)
 *   node scripts/cleanupUnwantedRecords.js --apply         # actually delete
 *   node scripts/cleanupUnwantedRecords.js --apply --failed-payment-days=14
 *   node scripts/cleanupUnwantedRecords.js --apply --abandoned-session-hours=12
 *   node scripts/cleanupUnwantedRecords.js --apply --cancelled-order-days=60
 *   node scripts/cleanupUnwantedRecords.js --restaurant=<restaurantId>  # scope to one tenant
 *
 * Nothing is deleted unless --apply is passed — every run without it
 * only inspects the database and writes the .txt report, exactly like
 * scripts/dedupeMenuData.js's --dry-run does it (just inverted default,
 * since this script is more destructive and shouldn't run for-real by
 * accident).
 */
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

function argNumber(flag, fallback) {
  const hit = args.find((a) => a.startsWith(`--${flag}=`));
  if (!hit) return fallback;
  const n = Number(hit.split('=')[1]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function argString(flag) {
  const hit = args.find((a) => a.startsWith(`--${flag}=`));
  return hit ? hit.split('=')[1] : null;
}

const FAILED_PAYMENT_DAYS = argNumber('failed-payment-days', 30);
const ABANDONED_SESSION_HOURS = argNumber('abandoned-session-hours', 6);
const CANCELLED_ORDER_DAYS = argNumber('cancelled-order-days', 90);
const RESTAURANT_ID = argString('restaurant');

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function hoursAgo(n) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

async function findExpiredRefreshTokens() {
  return prisma.refreshToken.findMany({
    where: { OR: [{ revoked: true }, { expiresAt: { lt: new Date() } }] },
    select: { id: true, userId: true, expiresAt: true, revoked: true },
  });
}

async function findOldFailedPayments(restaurantId) {
  return prisma.payment.findMany({
    where: {
      status: 'FAILED',
      createdAt: { lt: daysAgo(FAILED_PAYMENT_DAYS) },
      ...(restaurantId ? { restaurantId } : {}),
    },
    select: { id: true, restaurantId: true, amount: true, createdAt: true },
  });
}

async function findAbandonedSessions(restaurantId) {
  return prisma.diningSession.findMany({
    where: {
      status: 'ACTIVE',
      startedAt: { lt: hoursAgo(ABANDONED_SESSION_HOURS) },
      orders: { none: {} },
      ...(restaurantId ? { restaurantId } : {}),
    },
    select: { id: true, restaurantId: true, tableId: true, startedAt: true },
  });
}

async function findFullyCancelledOrders(restaurantId) {
  return prisma.order.findMany({
    where: {
      status: 'CANCELLED',
      placedAt: { lt: daysAgo(CANCELLED_ORDER_DAYS) },
      ...(restaurantId ? { restaurantId } : {}),
    },
    select: { id: true, restaurantId: true, tableId: true, placedAt: true },
  });
}

function section(title, rows, describe) {
  const lines = [`## ${title} (${rows.length})`];
  if (rows.length === 0) {
    lines.push('  (none found)');
  } else {
    for (const row of rows) lines.push(`  - ${describe(row)}`);
  }
  lines.push('');
  return lines;
}

async function main() {
  const report = [];
  report.push('QR Dining SaaS — unwanted records cleanup report');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`Mode: ${APPLY ? 'APPLIED (records deleted)' : 'DRY RUN (nothing deleted — pass --apply to actually delete)'}`);
  report.push(`Restaurant scope: ${RESTAURANT_ID || 'ALL restaurants'}`);
  report.push(
    `Thresholds: failed payments > ${FAILED_PAYMENT_DAYS}d old, abandoned sessions > ${ABANDONED_SESSION_HOURS}h old, cancelled orders > ${CANCELLED_ORDER_DAYS}d old`
  );
  report.push('='.repeat(70));
  report.push('');

  const [expiredTokens, failedPayments, abandonedSessions, cancelledOrders] = await Promise.all([
    findExpiredRefreshTokens(),
    findOldFailedPayments(RESTAURANT_ID),
    findAbandonedSessions(RESTAURANT_ID),
    findFullyCancelledOrders(RESTAURANT_ID),
  ]);

  report.push(
    ...section('Expired/revoked refresh tokens', expiredTokens, (t) => `${t.id} — user ${t.userId}, expired ${t.expiresAt.toISOString()}${t.revoked ? ', revoked' : ''}`)
  );
  report.push(
    ...section('Old failed payments', failedPayments, (p) => `${p.id} — restaurant ${p.restaurantId}, ₹${p.amount}, failed ${p.createdAt.toISOString()}`)
  );
  report.push(
    ...section('Abandoned empty dining sessions', abandonedSessions, (s) => `${s.id} — restaurant ${s.restaurantId}, table ${s.tableId}, started ${s.startedAt.toISOString()}`)
  );
  report.push(
    ...section('Fully-cancelled orders past retention', cancelledOrders, (o) => `${o.id} — restaurant ${o.restaurantId}, table ${o.tableId}, placed ${o.placedAt.toISOString()}`)
  );

  const totalFound = expiredTokens.length + failedPayments.length + abandonedSessions.length + cancelledOrders.length;

  if (APPLY && totalFound > 0) {
    report.push('-'.repeat(70));
    report.push('DELETIONS');
    report.push('-'.repeat(70));

    if (expiredTokens.length) {
      const { count } = await prisma.refreshToken.deleteMany({ where: { id: { in: expiredTokens.map((t) => t.id) } } });
      report.push(`Deleted ${count} expired/revoked refresh token(s).`);
    }
    if (failedPayments.length) {
      const { count } = await prisma.payment.deleteMany({ where: { id: { in: failedPayments.map((p) => p.id) } } });
      report.push(`Deleted ${count} old failed payment(s).`);
    }
    if (abandonedSessions.length) {
      // Cascades to that session's BillSplit rows; the session has zero
      // orders by construction so there's nothing else hanging off it.
      const { count } = await prisma.diningSession.deleteMany({ where: { id: { in: abandonedSessions.map((s) => s.id) } } });
      report.push(`Deleted ${count} abandoned dining session(s).`);
    }
    if (cancelledOrders.length) {
      // Cascades to that order's OrderItem rows (and any modifier rows
      // under them); Payment.orderId is optional/nullable so a stray
      // payment record pointing at a cancelled order — there
      // shouldn't be one for a fully CANCELLED order — is left intact
      // rather than silently deleted here.
      const { count } = await prisma.order.deleteMany({ where: { id: { in: cancelledOrders.map((o) => o.id) } } });
      report.push(`Deleted ${count} fully-cancelled order(s).`);
    }
    report.push('');
  }

  report.push('='.repeat(70));
  report.push(
    APPLY
      ? `Done. ${totalFound} record(s) removed.`
      : `Done. ${totalFound} record(s) WOULD be removed — re-run with --apply to actually delete them.`
  );

  const reportsDir = path.join(__dirname, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(
    reportsDir,
    `cleanup-report-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  );
  fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

  console.log(report.join('\n'));
  console.log(`\nFull report written to: ${reportPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
