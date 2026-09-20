const XLSX = require('xlsx');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { assertNameNotDuplicate } = require('./category.controller');
const { assertItemNameNotDuplicate } = require('./menuItem.controller');

const VALID_TYPES = ['VEG', 'NON_VEG', 'EGG', 'VEGAN'];

// Menu import/template-download share the same SuperAdmin-controlled
// switch as the Reports "Excel" button (Restaurant.excelExportEnabled)
// — from a SuperAdmin's point of view it's one "can this owner use our
// Excel/CSV features" toggle. Enforced here on the backend (not just
// hidden in the UI — see Menu.jsx) so the block actually holds even if
// someone calls the API directly.
async function assertExcelFeatureEnabled(restaurantId) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { excelExportEnabled: true },
  });
  if (!restaurant) throw ApiError.notFound('Restaurant not found');
  if (restaurant.excelExportEnabled === false) {
    throw ApiError.forbidden(
      'Excel/CSV menu import isn\'t enabled for your account — ask the platform admin to turn it on'
    );
  }
}

// Accepts a handful of reasonable header spellings so an Owner (or
// whoever built their spreadsheet) doesn't have to match our column
// names exactly — normalized to lowercase/no-space for the lookup.
const HEADER_ALIASES = {
  category: 'category',
  categoryname: 'category',
  itemname: 'name',
  item: 'name',
  name: 'name',
  description: 'description',
  desc: 'description',
  price: 'price',
  fullprice: 'price',
  halfprice: 'halfPrice',
  type: 'type',
  foodtype: 'type',
  available: 'isAvailable',
  isavailable: 'isAvailable',
  spicelevel: 'spiceLevel',
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseBoolean(value, fallback = true) {
  if (value === '' || value == null) return fallback;
  const s = String(value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 'available'].includes(s)) return true;
  if (['no', 'n', 'false', '0', 'unavailable'].includes(s)) return false;
  return fallback;
}

function parseType(value) {
  const s = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  return VALID_TYPES.includes(s) ? s : 'VEG';
}

/**
 * Reads the uploaded workbook (xlsx/xls/csv all handled by the same
 * SheetJS parser) and returns an array of row objects keyed by our
 * canonical field names (category, name, description, price,
 * halfPrice, type, isAvailable, spiceLevel) — whatever header spelling
 * the sheet used, per HEADER_ALIASES above.
 */
function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw ApiError.badRequest('The uploaded file has no sheets/rows');
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  return rawRows.map((raw) => {
    const row = {};
    for (const [key, value] of Object.entries(raw)) {
      const canonical = HEADER_ALIASES[normalizeHeader(key)];
      if (canonical) row[canonical] = typeof value === 'string' ? value.trim() : value;
    }
    return row;
  });
}

// POST /api/restaurant/menu/import  (multipart/form-data — 'file' field)
// For a newly onboarded Owner (or anyone re-stocking their menu):
// upload one .csv/.xlsx/.xls with columns Category, Item Name,
// Description, Price, Half Price, Type, Available — creates any
// category that doesn't already exist (case-insensitively) and adds
// each item under it, SKIPPING any item that already exists in that
// category by name rather than silently overwriting or duplicating it
// (see category.controller.assertNameNotDuplicate /
// menuItem.controller.assertItemNameNotDuplicate — the same
// duplicate-prevention logic used by the regular "Add category/item"
// forms, so an import can never (re)introduce the duplicates bug).
async function importMenu(req, res) {
  if (!req.file) throw ApiError.badRequest('Upload a .csv, .xlsx, or .xls file under the "file" field');
  await assertExcelFeatureEnabled(req.restaurantId);

  let rows;
  try {
    rows = parseWorkbook(req.file.buffer);
  } catch (err) {
    throw ApiError.badRequest(`Couldn't read that file: ${err.message}`);
  }
  if (rows.length === 0) throw ApiError.badRequest('No rows found in the uploaded file');

  const existingCategories = await prisma.category.findMany({ where: { restaurantId: req.restaurantId } });
  const categoryByNormalizedName = new Map(existingCategories.map((c) => [c.name.trim().toLowerCase(), c]));
  let nextSequence = existingCategories.length;

  const result = {
    categoriesCreated: 0,
    categoriesReused: 0,
    itemsCreated: 0,
    itemsSkipped: 0,
    rowErrors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
    const row = rows[i];
    try {
      const categoryName = String(row.category || '').trim();
      const itemName = String(row.name || '').trim();
      const price = Number(row.price);

      if (!categoryName || !itemName) {
        result.rowErrors.push({ row: rowNumber, message: 'Missing Category or Item Name — row skipped' });
        continue;
      }
      if (!Number.isFinite(price) || price <= 0) {
        result.rowErrors.push({ row: rowNumber, message: `Invalid Price "${row.price}" — row skipped` });
        continue;
      }

      const normalizedCategory = categoryName.toLowerCase();
      let category = categoryByNormalizedName.get(normalizedCategory);
      if (!category) {
        category = await prisma.category.create({
          data: { restaurantId: req.restaurantId, name: categoryName, sequence: nextSequence++ },
        });
        categoryByNormalizedName.set(normalizedCategory, category);
        result.categoriesCreated += 1;
      } else {
        result.categoriesReused += 1;
      }

      try {
        await assertItemNameNotDuplicate(category.id, itemName);
      } catch {
        result.itemsSkipped += 1;
        result.rowErrors.push({
          row: rowNumber,
          message: `"${itemName}" already exists in "${category.name}" — skipped, not overwritten`,
        });
        continue;
      }

      const hasHalfFull = row.halfPrice !== '' && row.halfPrice != null;
      const halfPrice = hasHalfFull ? Number(row.halfPrice) : null;
      if (hasHalfFull && (!Number.isFinite(halfPrice) || halfPrice <= 0 || halfPrice >= price)) {
        result.rowErrors.push({
          row: rowNumber,
          message: `Half Price for "${itemName}" must be a positive number less than Price — imported without a Half option`,
        });
      }

      await prisma.menuItem.create({
        data: {
          restaurantId: req.restaurantId,
          categoryId: category.id,
          name: itemName,
          description: row.description || null,
          price,
          hasHalfFull: hasHalfFull && Number.isFinite(halfPrice) && halfPrice > 0 && halfPrice < price,
          halfPrice: hasHalfFull && Number.isFinite(halfPrice) && halfPrice > 0 && halfPrice < price ? halfPrice : null,
          type: parseType(row.type),
          isAvailable: parseBoolean(row.isAvailable, true),
          spiceLevel: row.spiceLevel !== '' && row.spiceLevel != null ? Number(row.spiceLevel) : null,
        },
      });
      result.itemsCreated += 1;
    } catch (err) {
      result.rowErrors.push({ row: rowNumber, message: err.message || 'Unexpected error — row skipped' });
    }
  }

  res.status(201).json({ success: true, data: result });
}

// GET /api/restaurant/menu/import/template — a starter .xlsx an Owner
// can fill in and re-upload, with the exact column names the importer
// recognizes plus one example row.
async function downloadImportTemplate(req, res) {
  await assertExcelFeatureEnabled(req.restaurantId);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    {
      Category: 'Starters',
      'Item Name': 'Veg Spring Rolls',
      Description: 'Crispy rolls with mixed vegetables',
      Price: 199,
      'Half Price': '',
      Type: 'VEG',
      Available: 'Yes',
    },
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Menu');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="menu-import-template.xlsx"');
  res.send(buffer);
}

module.exports = { importMenu, downloadImportTemplate };
