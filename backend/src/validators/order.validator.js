const Joi = require('joi');

const updateOrderItemStatus = Joi.object({
  status: Joi.string().valid('RECEIVED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED').required(),
});

const updateOrderStatus = Joi.object({
  status: Joi.string().valid('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED', 'PAID').required(),
});

const orderLine = Joi.object({
  menuItemId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).max(50).required(),
  portion: Joi.string().valid('FULL', 'HALF').default('FULL'),
  notes: Joi.string().allow('', null),
  modifierOptionIds: Joi.array().items(Joi.string().uuid()).default([]),
});

// Waiter manual entry — table is already known (waiter is standing there),
// so this either targets an existing active session or starts one.
const manualOrder = Joi.object({
  tableId: Joi.string().uuid().required(),
  items: Joi.array().items(orderLine).min(1).required(),
});

module.exports = { updateOrderItemStatus, updateOrderStatus, manualOrder };
