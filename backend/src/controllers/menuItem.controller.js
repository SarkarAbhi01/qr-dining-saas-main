const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

function imageUrlFor(req, filename) {
  if (!filename) return null;
  return `${req.protocol}://${req.get('host')}/uploads/menu-items/${filename}`;
}

// GET /api/restaurant/menu-items
async function listMenuItems(req, res) {
  const { categoryId, isAvailable } = req.query;

  const items = await prisma.menuItem.findMany({
    where: {
      restaurantId: req.restaurantId,
      ...(categoryId ? { categoryId } : {}),
      ...(isAvailable !== undefined ? { isAvailable: isAvailable === 'true' } : {}),
    },
    include: { modifierGroups: { include: { options: true } }, category: { select: { id: true, name: true } } },
    orderBy: [{ categoryId: 'asc' }, { sequence: 'asc' }],
  });

  res.json({ success: true, data: items });
}

// GET /api/restaurant/menu-items/:id
async function getMenuItem(req, res) {
  const item = await prisma.menuItem.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
    include: { modifierGroups: { include: { options: true } } },
  });
  if (!item) throw ApiError.notFound('Menu item not found');
  res.json({ success: true, data: item });
}

// POST /api/restaurant/menu-items  (multipart/form-data — 'image' field optional)
async function createMenuItem(req, res) {
  const { modifierGroups, ...data } = req.body;

  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, restaurantId: req.restaurantId },
  });
  if (!category) throw ApiError.badRequest('Invalid categoryId for this restaurant');

  const item = await prisma.menuItem.create({
    data: {
      ...data,
      restaurantId: req.restaurantId,
      imageUrl: imageUrlFor(req, req.file?.filename),
      modifierGroups: modifierGroups?.length
        ? {
            create: modifierGroups.map((g) => ({
              name: g.name,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
              options: { create: g.options.map((o) => ({ name: o.name, extraPrice: o.extraPrice })) },
            })),
          }
        : undefined,
    },
    include: { modifierGroups: { include: { options: true } } },
  });

  res.status(201).json({ success: true, data: item });
}

// PATCH /api/restaurant/menu-items/:id  (multipart/form-data — 'image' field optional)
async function updateMenuItem(req, res) {
  const item = await prisma.menuItem.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!item) throw ApiError.notFound('Menu item not found');

  if (req.body.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: req.body.categoryId, restaurantId: req.restaurantId },
    });
    if (!category) throw ApiError.badRequest('Invalid categoryId for this restaurant');
  }

  const updated = await prisma.menuItem.update({
    where: { id: item.id },
    data: {
      ...req.body,
      ...(req.file ? { imageUrl: imageUrlFor(req, req.file.filename) } : {}),
    },
    include: { modifierGroups: { include: { options: true } } },
  });

  res.json({ success: true, data: updated });
}

// PATCH /api/restaurant/menu-items/:id/availability  { isAvailable: boolean }
async function toggleAvailability(req, res) {
  const item = await prisma.menuItem.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!item) throw ApiError.notFound('Menu item not found');

  const updated = await prisma.menuItem.update({
    where: { id: item.id },
    data: { isAvailable: req.body.isAvailable },
  });

  // Live-view: instantly reflect 86'd items on customer-facing menus
  req.app.get('io')?.to(`restaurant:${req.restaurantId}`).emit('menu-item:availability', {
    menuItemId: updated.id,
    isAvailable: updated.isAvailable,
  });

  res.json({ success: true, data: updated });
}

// DELETE /api/restaurant/menu-items/:id
async function deleteMenuItem(req, res) {
  const item = await prisma.menuItem.findFirst({
    where: { id: req.params.id, restaurantId: req.restaurantId },
  });
  if (!item) throw ApiError.notFound('Menu item not found');

  await prisma.menuItem.delete({ where: { id: item.id } });
  res.json({ success: true, message: 'Menu item deleted' });
}

module.exports = {
  listMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem,
};
