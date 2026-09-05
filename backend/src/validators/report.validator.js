const Joi = require('joi');

const revenueSeries = Joi.object({
  range: Joi.string().valid('7d', '30d', '12m').default('7d'),
});

const topItems = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(10),
  range: Joi.string().valid('7d', '30d', '90d', 'all').default('30d'),
});

const paymentsCollected = Joi.object({
  range: Joi.string().valid('7d', '30d', '90d', 'all').default('30d'),
});

const revenueByMethod = Joi.object({
  range: Joi.string().valid('7d', '30d', '90d', 'all').default('30d'),
});

module.exports = { revenueSeries, topItems, paymentsCollected, revenueByMethod };
