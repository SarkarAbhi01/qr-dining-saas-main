const Joi = require('joi');

const createCategory = Joi.object({
  name: Joi.string().min(1).max(80).required(),
  sequence: Joi.number().integer().min(0).default(0),
});

const updateCategory = Joi.object({
  name: Joi.string().min(1).max(80),
  sequence: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
}).min(1);

const reorderCategories = Joi.object({
  order: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const modifierOption = Joi.object({
  name: Joi.string().min(1).max(60).required(),
  extraPrice: Joi.number().min(0).default(0),
});

const modifierGroup = Joi.object({
  name: Joi.string().min(1).max(60).required(),
  minSelect: Joi.number().integer().min(0).default(0),
  maxSelect: Joi.number().integer().min(1).default(1),
  options: Joi.array().items(modifierOption).min(1).required(),
});

const createMenuItem = Joi.object({
  categoryId: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(120).required(),
  description: Joi.string().allow('', null),
  price: Joi.number().positive().required(),
  hasHalfFull: Joi.boolean().default(false),
  // Required exactly when hasHalfFull is true, and must be cheaper than
  // the Full price (`price`) — a Half portion costing more than Full
  // is almost certainly a data-entry mistake.
  halfPrice: Joi.number()
    .positive()
    .less(Joi.ref('price'))
    .when('hasHalfFull', { is: true, then: Joi.required(), otherwise: Joi.forbidden() })
    .messages({ 'number.less': 'Half price must be less than the Full price' }),
  type: Joi.string().valid('VEG', 'NON_VEG', 'EGG', 'VEGAN').default('VEG'),
  isAvailable: Joi.boolean().default(true),
  isFeatured: Joi.boolean().default(false),
  spiceLevel: Joi.number().integer().min(0).max(3).allow(null),
  preparationMinutes: Joi.number().integer().min(0).allow(null),
  sequence: Joi.number().integer().min(0).default(0),
  modifierGroups: Joi.array().items(modifierGroup).default([]),
});

const updateMenuItem = Joi.object({
  categoryId: Joi.string().uuid(),
  name: Joi.string().min(1).max(120),
  description: Joi.string().allow('', null),
  price: Joi.number().positive(),
  hasHalfFull: Joi.boolean(),
  halfPrice: Joi.number()
    .positive()
    .less(Joi.ref('price'))
    .allow(null)
    .when('hasHalfFull', { is: true, then: Joi.required() })
    .messages({ 'number.less': 'Half price must be less than the Full price' }),
  type: Joi.string().valid('VEG', 'NON_VEG', 'EGG', 'VEGAN'),
  isAvailable: Joi.boolean(),
  isFeatured: Joi.boolean(),
  spiceLevel: Joi.number().integer().min(0).max(3).allow(null),
  preparationMinutes: Joi.number().integer().min(0).allow(null),
  sequence: Joi.number().integer().min(0),
}).min(1);

module.exports = {
  createCategory,
  updateCategory,
  reorderCategories,
  createMenuItem,
  updateMenuItem,
};
