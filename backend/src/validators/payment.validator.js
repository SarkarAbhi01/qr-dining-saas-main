const Joi = require('joi');

// Kept to the labels a waiter would actually pick standing at a table —
// STRIPE/RAZORPAY are excluded here since those are for the customer's
// own online-checkout redirect flow, not something a waiter records
// manually after collecting payment in person.
const settleTablePayment = Joi.object({
  method: Joi.string().valid('CASH', 'UPI', 'CARD', 'OTHER').required(),
  // Discount is optional and authority-gated server-side (Owner/Manager
  // only — see waiter.controller.js) rather than just hidden in the UI,
  // since a raw API call could otherwise bypass a UI-only restriction.
  discountAmount: Joi.number().min(0).optional(),
  discountReason: Joi.string().max(200).allow('', null).optional(),
});

const confirmPayment = Joi.object({
  discountAmount: Joi.number().min(0).optional(),
  discountReason: Joi.string().max(200).allow('', null).optional(),
});

module.exports = { settleTablePayment, confirmPayment };
