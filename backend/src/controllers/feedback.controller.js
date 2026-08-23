const prisma = require('../config/prisma');

// GET /api/restaurant/feedback?minRating=&limit=
async function listFeedback(req, res) {
  const { minRating, limit } = req.query;

  const feedback = await prisma.feedback.findMany({
    where: {
      restaurantId: req.restaurantId,
      ...(minRating ? { rating: { gte: Number(minRating) } } : {}),
    },
    include: {
      table: { select: { tableNumber: true } },
      aboutWaiter: { select: { name: true } },
      aboutChef: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit ? Number(limit) : 50,
  });

  const avgRating =
    feedback.length > 0 ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length : null;

  res.json({ success: true, data: { feedback, avgRating, count: feedback.length } });
}

module.exports = { listFeedback };
