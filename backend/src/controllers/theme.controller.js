const prisma = require('../config/prisma');

// GET /api/restaurant/theme  (Owner/Manager)
async function getTheme(req, res) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId },
    select: { themeConfig: true },
  });
  res.json({ success: true, data: restaurant.themeConfig || {} });
}

// PATCH /api/restaurant/theme  (Owner/Manager)
// Merges into the existing config rather than replacing it wholesale,
// so saving just a font change doesn't wipe out previously-set colors.
async function updateTheme(req, res) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId },
    select: { themeConfig: true },
  });

  const merged = { ...(restaurant.themeConfig || {}), ...req.body };
  // Drop explicit nulls so "reset to default" actually removes the key
  // instead of storing themeConfig.bodyColor = null forever.
  Object.keys(merged).forEach((k) => merged[k] == null && delete merged[k]);

  const updated = await prisma.restaurant.update({
    where: { id: req.restaurantId },
    data: { themeConfig: merged },
    select: { themeConfig: true },
  });

  res.json({ success: true, data: updated.themeConfig || {} });
}

module.exports = { getTheme, updateTheme };
