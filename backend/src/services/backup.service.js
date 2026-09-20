const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const prisma = require('../config/prisma');

// Kept OUTSIDE the `uploads/` tree (which app.js serves publicly via
// `express.static('uploads')`) — backups can contain pricing, staff
// names, and payment history, so they're only ever reachable through
// the authenticated backup.controller.js download routes, never by
// guessing a static URL.
const BACKUP_ROOT = path.join(process.cwd(), 'storage', 'backups');

const EXTENSION_BY_FORMAT = { EXCEL: 'xlsx', PDF: 'pdf', TXT: 'txt', SQL: 'sql' };

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'owner';
}

function dateStamp(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ---------------------------------------------------------------------
// Data gathering — everything a restaurant would want copied out.
// ---------------------------------------------------------------------
async function collectRestaurantData(restaurantId) {
  const [restaurant, categories, menuItems, tables, staff, orders, payments] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId } }),
    prisma.category.findMany({ where: { restaurantId }, orderBy: { sequence: 'asc' } }),
    prisma.menuItem.findMany({ where: { restaurantId }, include: { category: { select: { name: true } } } }),
    prisma.restaurantTable.findMany({ where: { restaurantId }, orderBy: { tableNumber: 'asc' } }),
    prisma.user.findMany({
      where: { restaurantId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { restaurantId },
      include: { table: { select: { tableNumber: true } }, items: { include: { menuItem: { select: { name: true } } } } },
      orderBy: { placedAt: 'desc' },
      take: 5000, // sane cap so an old, high-volume restaurant can't produce an unbounded export
    }),
    prisma.payment.findMany({
      where: { restaurantId },
      include: {
        diningSession: { include: { table: { select: { tableNumber: true } } } },
        collectedBy: { select: { name: true } },
        discountedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
  ]);

  return { restaurant, categories, menuItems, tables, staff, orders, payments };
}

// Flattens the collected data into the row shapes shared by every
// export format (Excel sheet rows, PDF/TXT table rows, SQL row values).
function toRows(data) {
  return {
    categories: data.categories.map((c) => ({
      ID: c.id,
      Name: c.name,
      Sequence: c.sequence,
      Active: c.isActive ? 'Yes' : 'No',
    })),
    menuItems: data.menuItems.map((m) => ({
      ID: m.id,
      Category: m.category?.name || '',
      Name: m.name,
      Price: Number(m.price),
      HalfPrice: m.halfPrice != null ? Number(m.halfPrice) : '',
      Type: m.type,
      Available: m.isAvailable ? 'Yes' : 'No',
    })),
    tables: data.tables.map((t) => ({
      ID: t.id,
      TableNumber: t.tableNumber,
      Capacity: t.capacity,
      Status: t.status,
    })),
    staff: data.staff.map((u) => ({
      ID: u.id,
      Name: u.name,
      Email: u.email,
      Role: u.role,
      Active: u.isActive ? 'Yes' : 'No',
      CreatedAt: u.createdAt.toISOString(),
    })),
    orders: data.orders.map((o) => ({
      ID: o.id,
      Table: o.table?.tableNumber || '',
      Status: o.status,
      Source: o.source,
      Items: o.items.map((i) => `${i.quantity}x ${i.menuItem?.name || 'Item'}`).join('; '),
      Subtotal: Number(o.subtotal),
      Tax: Number(o.taxAmount),
      Total: Number(o.totalAmount),
      PlacedAt: o.placedAt.toISOString(),
    })),
    // Discount fields ARE included here on purpose — this backup/export
    // is an internal Owner/SuperAdmin record, the opposite of the
    // customer-facing printed bill, which never mentions a discount
    // (see waiter.controller.js / print.js).
    payments: data.payments.map((p) => ({
      ID: p.id,
      Table: p.diningSession?.table?.tableNumber || '',
      Method: p.method,
      Status: p.status,
      Amount: Number(p.amount),
      OriginalAmount: p.originalAmount != null ? Number(p.originalAmount) : '',
      DiscountAmount: p.discountAmount != null ? Number(p.discountAmount) : '',
      DiscountReason: p.discountReason || '',
      CollectedBy: p.collectedBy?.name || '',
      PaidAt: p.paidAt ? p.paidAt.toISOString() : '',
    })),
  };
}

function buildExcelBuffer(rows) {
  const wb = XLSX.utils.book_new();
  const sheets = {
    Categories: rows.categories,
    'Menu Items': rows.menuItems,
    Tables: rows.tables,
    Staff: rows.staff,
    Orders: rows.orders,
    Payments: rows.payments,
  };
  for (const [name, sheetRows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(sheetRows.length ? sheetRows : [{ Note: 'No data' }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function buildTxtBuffer(rows, restaurant) {
  const lines = [];
  lines.push(`Data backup — ${restaurant.name}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));

  for (const [section, sectionRows] of Object.entries(rows)) {
    lines.push('');
    lines.push(`## ${section.toUpperCase()} (${sectionRows.length})`);
    if (sectionRows.length === 0) {
      lines.push('  (no data)');
      continue;
    }
    for (const row of sectionRows) {
      lines.push('  - ' + Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' | '));
    }
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

function sqlEscape(value) {
  if (value == null || value === '') return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSqlBuffer(rows, restaurant) {
  const lines = [];
  lines.push(`-- Data backup for restaurant "${restaurant.name}" (${restaurant.id})`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- This is a plain-data export (INSERT statements only) for');
  lines.push('-- portability/inspection — it does not include schema DDL.');
  lines.push('');

  const tableNameFor = { categories: 'categories', menuItems: 'menu_items', tables: 'restaurant_tables', staff: 'users', orders: 'orders', payments: 'payments' };

  for (const [section, sectionRows] of Object.entries(rows)) {
    const tableName = tableNameFor[section] || section;
    lines.push(`-- ${tableName} (${sectionRows.length} rows)`);
    if (sectionRows.length === 0) {
      lines.push('-- (no data)');
      lines.push('');
      continue;
    }
    const columns = Object.keys(sectionRows[0]);
    for (const row of sectionRows) {
      const values = columns.map((c) => sqlEscape(row[c]));
      lines.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
    }
    lines.push('');
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

function buildPdfBuffer(rows, restaurant) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(`Data backup — ${restaurant.name}`, { align: 'left' });
    doc.fontSize(9).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    for (const [section, sectionRows] of Object.entries(rows)) {
      doc.fillColor('#000').fontSize(13).text(`${section} (${sectionRows.length})`, { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(8);
      if (sectionRows.length === 0) {
        doc.fillColor('#666').text('No data');
      } else {
        const columns = Object.keys(sectionRows[0]);
        doc.fillColor('#000').text(columns.join(' | '), { continued: false });
        doc.moveTo(doc.x, doc.y).lineTo(800, doc.y).strokeColor('#ccc').stroke();
        for (const row of sectionRows.slice(0, 500)) {
          // Cap PDF rows for readability/size — the Excel/SQL/TXT exports
          // carry the full data if a restaurant needs the complete set.
          doc.text(columns.map((c) => String(row[c] ?? '')).join(' | '));
        }
        if (sectionRows.length > 500) {
          doc.fillColor('#666').text(`… and ${sectionRows.length - 500} more rows (see Excel/SQL/TXT export for the full set)`);
        }
      }
      doc.moveDown();
      if (doc.y > 500) doc.addPage();
    }

    doc.end();
  });
}

/**
 * Generates the Owner's requested export AND the companion .bak
 * archive copy that SuperAdmin gets to see, writes both to disk, and
 * returns everything a Backup row + the controller's response needs.
 */
async function generateBackup({ restaurantId, requestedByName, format }) {
  const data = await collectRestaurantData(restaurantId);
  if (!data.restaurant) {
    throw new Error('Restaurant not found while generating backup');
  }
  const rows = toRows(data);

  let buffer;
  if (format === 'EXCEL') buffer = buildExcelBuffer(rows);
  else if (format === 'PDF') buffer = await buildPdfBuffer(rows, data.restaurant);
  else if (format === 'TXT') buffer = buildTxtBuffer(rows, data.restaurant);
  else if (format === 'SQL') buffer = buildSqlBuffer(rows, data.restaurant);
  else throw new Error(`Unsupported backup format: ${format}`);

  const ext = EXTENSION_BY_FORMAT[format];
  const stamp = dateStamp();
  const restaurantDir = path.join(BACKUP_ROOT, restaurantId);
  const superadminArchiveDir = path.join(BACKUP_ROOT, '_superadmin-archive');
  ensureDir(restaurantDir);
  ensureDir(superadminArchiveDir);

  const fileName = `${slugify(data.restaurant.name)}-backup-${stamp}-${Date.now()}.${ext}`;
  const filePath = path.join(restaurantDir, fileName);
  fs.writeFileSync(filePath, buffer);

  // The archival copy SuperAdmin sees — named "{ownerName}_{date}.bak"
  // per spec, regardless of which format the Owner actually chose (the
  // original `format` is preserved as metadata on the Backup row so
  // SuperAdmin still knows what's inside it).
  const bakFileName = `${slugify(requestedByName)}_${stamp}.bak`;
  const bakFilePath = path.join(superadminArchiveDir, `${Date.now()}-${bakFileName}`);
  fs.writeFileSync(bakFilePath, buffer);

  return {
    fileName,
    filePath,
    bakFileName,
    bakFilePath,
    sizeBytes: buffer.length,
  };
}

module.exports = { generateBackup, BACKUP_ROOT };
