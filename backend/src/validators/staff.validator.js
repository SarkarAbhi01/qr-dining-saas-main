const Joi = require('joi');

const createStaff = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow('', null),
  role: Joi.string().valid('CHEF', 'WAITER', 'MANAGER').required(),
  password: Joi.string().min(8).optional(),
});

const updateStaff = Joi.object({
  name: Joi.string().min(2).max(120),
  phone: Joi.string().allow('', null),
  role: Joi.string().valid('CHEF', 'WAITER', 'MANAGER'),
  isActive: Joi.boolean(),
  canViewOwnReports: Joi.boolean(),
}).min(1);

module.exports = { createStaff, updateStaff };
