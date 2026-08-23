const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

// GET /api/restaurant/categories
async function listCategories(req, res) {
  const categories = await prisma.category.findMany({
    where: { restaurantId: req.restaurantId },
    orderBy: { sequence: 'asc' },
    include: { _count: { select: { menuItems: true } } },
  });
  res.json({ success: true, data: categories });
}

// POST /api/restaurant/categories
async function createCategory(req, res) {
  const category = await prisma.category.create({
    data: { ...req.body, restaurantId: req.restaurantId },
  });
  res.status(201).json({ success: true, data: category });
}

// PATCH /api/restaurant/categories/:id
async function updateCategory(req, res) {
  await assertOwnership(req.restaurantId, req.params.id);
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: category });
}

// DELETE /api/restaurant/categories/:id
async function deleteCategory(req, res) {
  await assertOwnership(req.restaurantId, req.params.id);
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Category deleted' });
}

// PATCH /api/restaurant/categories/reorder  { order: [id, id, id...] }
async function reorderCategories(req, res) {
  const { order } = req.body;

  await prisma.$transaction(
    order.map((id, index) =>
      prisma.category.updateMany({
        where: { id, restaurantId: req.restaurantId },
        data: { sequence: index },
      })
    )
  );

  res.json({ success: true, message: 'Order updated' });
}

async function assertOwnership(restaurantId, categoryId) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.restaurantId !== restaurantId) {
    throw ApiError.notFound('Category not found');
  }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, reorderCategories };
