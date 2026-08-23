const Joi = require('joi');

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createRestaurant = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  slug: Joi.string().pattern(slugPattern).min(2).max(60).required().messages({
    'string.pattern.base': 'Slug must be lowercase letters, numbers, and hyphens only',
  }),
  address: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  currency: Joi.string().length(3).default('INR'),
  timezone: Joi.string().default('Asia/Kolkata'),
  subscriptionPlanId: Joi.string().uuid().allow(null),
  owner: Joi.object({
    name: Joi.string().min(2).max(120).required(),
    email: Joi.string().email().required(),
    // If omitted, a temp password is generated and returned once
    password: Joi.string().min(8).optional(),
  }).required(),
});

const updateRestaurant = Joi.object({
  name: Joi.string().min(2).max(120),
  address: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  currency: Joi.string().length(3),
  timezone: Joi.string(),
}).min(1);

// Suspending or cancelling a restaurant always requires a reason on
// record — activating/trialing doesn't need one.
const changeStatus = Joi.object({
  status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED').required(),
  reason: Joi.string().min(3).max(500).when('status', {
    is: Joi.valid('SUSPENDED', 'CANCELLED'),
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null),
  }),
});

const deleteRestaurant = Joi.object({
  reason: Joi.string().min(3).max(500).required(),
});

// Manually assign (or change) a restaurant's plan with an explicit
// validity window rather than an ongoing billing cycle.
const assignPlan = Joi.object({
  subscriptionPlanId: Joi.string().uuid().required(),
  durationDays: Joi.number().integer().min(1).max(3650).required(),
});

// A restaurant is charged one way or the other, never both — see the
// schema comment on Restaurant.revenueModel.
const setRevenueModel = Joi.object({
  revenueModel: Joi.string().valid('MONTHLY_FEE', 'COMMISSION').required(),
  commissionRatePercent: Joi.number().min(0).max(100).when('revenueModel', {
    is: 'COMMISSION',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

// The bypass toggle: while enabled, table/staff limit checks read these
// custom values instead of the assigned plan's, until it expires.
const setCustomLimits = Joi.object({
  customLimitsEnabled: Joi.boolean().required(),
  customMaxTables: Joi.number().integer().min(1).allow(null),
  customMaxStaff: Joi.number().integer().min(1).allow(null),
  validityDays: Joi.number().integer().min(1).max(3650).when('customLimitsEnabled', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional().allow(null),
  }),
});

const createCredential = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('OWNER', 'MANAGER').required(),
  password: Joi.string().min(8).optional(),
});

const createPlan = Joi.object({
  name: Joi.string().min(2).max(60).required(),
  description: Joi.string().allow('', null),
  priceMonthly: Joi.number().positive().required(),
  priceYearly: Joi.number().positive().allow(null),
  maxTables: Joi.number().integer().min(1).default(10),
  maxStaff: Joi.number().integer().min(1).default(10),
  features: Joi.object().unknown(true).default({}),
  isActive: Joi.boolean().default(true),
});

const updatePlan = createPlan.fork(
  ['name', 'priceMonthly'],
  (schema) => schema.optional()
).min(1);

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED'),
  search: Joi.string().allow(''),
});

module.exports = {
  createRestaurant,
  updateRestaurant,
  changeStatus,
  deleteRestaurant,
  assignPlan,
  setRevenueModel,
  setCustomLimits,
  createCredential,
  createPlan,
  updatePlan,
  listQuery,
};
