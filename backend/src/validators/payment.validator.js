const Joi = require('joi');

// Kept to the labels a waiter would actually pick standing at a table —
// STRIPE/RAZORPAY are excluded here since those are for the customer's
// own online-checkout redirect flow, not something a waiter records
// manually after collecting payment in person.
const settleTablePayment = Joi.object({
  method: Joi.string().valid('CASH', 'UPI', 'CARD', 'OTHER').required(),
});

module.exports = { settleTablePayment };
