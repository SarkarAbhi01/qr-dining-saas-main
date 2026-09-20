const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const ApiError = require('../utils/ApiError');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'menu-items');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(ApiError.badRequest('Only JPEG, PNG, or WEBP images are allowed'));
  }
  cb(null, true);
}

const uploadMenuItemImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// --- Menu import (Excel/CSV) ---
// Kept in memory (not written to disk) — the file is parsed once by
// menuImport.controller.js and then discarded, there's no reason to
// persist the spreadsheet itself.
const SPREADSHEET_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Some browsers/OSes send CSV as one of these instead of text/csv
  'application/csv',
  'application/octet-stream',
];
const SPREADSHEET_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

function spreadsheetFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!SPREADSHEET_EXTENSIONS.includes(ext) && !SPREADSHEET_MIME_TYPES.includes(file.mimetype)) {
    return cb(ApiError.badRequest('Only .csv, .xlsx, or .xls files are accepted'));
  }
  cb(null, true);
}

const uploadMenuImportFile = multer({
  storage: multer.memoryStorage(),
  fileFilter: spreadsheetFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = { uploadMenuItemImage, uploadMenuImportFile };
