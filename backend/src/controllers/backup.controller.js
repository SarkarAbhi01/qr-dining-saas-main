const fs = require('fs');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { generateBackup } = require('../services/backup.service');

function serializeBackup(b) {
  return {
    id: b.id,
    format: b.format,
    fileName: b.fileName,
    bakFileName: b.bakFileName,
    sizeBytes: b.sizeBytes,
    createdAt: b.createdAt,
    requestedBy: b.requestedBy ? { id: b.requestedBy.id, name: b.requestedBy.name } : undefined,
    restaurant: b.restaurant ? { id: b.restaurant.id, name: b.restaurant.name } : undefined,
  };
}

// ---------------------------------------------------------------------
// Owner side — /api/restaurant/backup
// ---------------------------------------------------------------------

// POST /api/restaurant/backup  { format: EXCEL|PDF|TXT|SQL }
// Gated on Restaurant.backupEnabled, which only SuperAdmin can flip on
// (see superadmin.controller.setPermissions). Generates the Owner's
// requested file AND a companion .bak archive copy that immediately
// becomes visible/downloadable to SuperAdmin (see backup:created
// socket emit below) — named "{ownerName}_{date}.bak".
async function createBackup(req, res) {
  const { format } = req.body;

  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
  if (!restaurant) throw ApiError.notFound('Restaurant not found');
  if (!restaurant.backupEnabled) {
    throw ApiError.forbidden(
      'Data backup isn\'t enabled for your account yet — ask the platform admin to turn it on'
    );
  }

  const generated = await generateBackup({
    restaurantId: restaurant.id,
    requestedByName: req.user.name,
    format,
  });

  const backup = await prisma.backup.create({
    data: {
      restaurantId: restaurant.id,
      requestedById: req.user.id,
      format,
      ...generated,
    },
    include: { requestedBy: { select: { id: true, name: true } }, restaurant: { select: { id: true, name: true } } },
  });

  // "SuperAdmin side download .bak file automatically" — the closest a
  // browser can get to a push-download is: notify every connected
  // SuperAdmin socket the instant the archive exists, so their Backups
  // screen can trigger the download itself without any polling/refresh.
  req.app.get('io')?.to('superadmin').emit('backup:created', serializeBackup(backup));

  res.status(201).json({ success: true, data: serializeBackup(backup) });
}

// GET /api/restaurant/backup — this restaurant's own backup history
async function listMyBackups(req, res) {
  const backups = await prisma.backup.findMany({
    where: { restaurantId: req.restaurantId },
    include: { requestedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: backups.map(serializeBackup) });
}

// GET /api/restaurant/backup/:id/download — Owner downloads their OWN
// export, in the format they originally requested (never the .bak —
// that copy is SuperAdmin's archive, not a second copy for the Owner).
async function downloadMyBackup(req, res) {
  const backup = await prisma.backup.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!backup) throw ApiError.notFound('Backup not found');
  if (!fs.existsSync(backup.filePath)) throw ApiError.notFound('Backup file is no longer available on disk');

  res.download(backup.filePath, backup.fileName);
}

// ---------------------------------------------------------------------
// SuperAdmin side — /api/superadmin/backups
// ---------------------------------------------------------------------

// GET /api/superadmin/backups — every restaurant's backup history
async function listAllBackups(req, res) {
  const backups = await prisma.backup.findMany({
    include: {
      requestedBy: { select: { id: true, name: true } },
      restaurant: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, data: backups.map(serializeBackup) });
}

// GET /api/superadmin/backups/:id/download — the archival .bak copy,
// named "{ownerName}_{date}.bak", independent of whatever format the
// Owner originally chose for their own copy.
async function downloadBackupArchive(req, res) {
  const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
  if (!backup) throw ApiError.notFound('Backup not found');
  if (!fs.existsSync(backup.bakFilePath)) throw ApiError.notFound('Archive file is no longer available on disk');

  res.download(backup.bakFilePath, backup.bakFileName);
}

module.exports = {
  createBackup,
  listMyBackups,
  downloadMyBackup,
  listAllBackups,
  downloadBackupArchive,
};
