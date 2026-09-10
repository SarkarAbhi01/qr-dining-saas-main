const prisma = require('../config/prisma');
const { isRazorpayConfigured } = require('../config/razorpay');
const { isStripeConfigured } = require('../config/stripe');

function maskSecret(secret) {
  if (!secret) return null;
  return secret.length <= 4 ? '••••' : `••••${secret.slice(-4)}`;
}

// GET /api/restaurant/payment-gateway  (Owner only)
// Secret is never returned in full once saved — only a masked
// last-4-characters preview, the same pattern a card-on-file UI uses.
async function getPaymentGateway(req, res) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.restaurantId },
    select: { razorpayKeyId: true, razorpayKeySecret: true },
  });

  res.json({
    success: true,
    data: {
      razorpayKeyId: restaurant.razorpayKeyId || null,
      razorpayKeySecretMasked: maskSecret(restaurant.razorpayKeySecret),
      razorpayConfigured: isRazorpayConfigured(restaurant),
      // Informational — this platform-wide gateway is what customer
      // checkout actually uses today regardless of Razorpay being
      // stored; see the note in customer.controller.js getPaymentConfig.
      platformStripeConfigured: isStripeConfigured(),
    },
  });
}

// PATCH /api/restaurant/payment-gateway  (Owner only)  { razorpayKeyId, razorpayKeySecret }
async function updatePaymentGateway(req, res) {
  const { razorpayKeyId, razorpayKeySecret } = req.body;

  const data = {};
  if (razorpayKeyId !== undefined) data.razorpayKeyId = razorpayKeyId || null;
  if (razorpayKeySecret !== undefined) data.razorpayKeySecret = razorpayKeySecret || null;

  const restaurant = await prisma.restaurant.update({
    where: { id: req.restaurantId },
    data,
    select: { razorpayKeyId: true, razorpayKeySecret: true },
  });

  res.json({
    success: true,
    data: {
      razorpayKeyId: restaurant.razorpayKeyId || null,
      razorpayKeySecretMasked: maskSecret(restaurant.razorpayKeySecret),
      razorpayConfigured: isRazorpayConfigured(restaurant),
    },
  });
}

module.exports = { getPaymentGateway, updatePaymentGateway };
