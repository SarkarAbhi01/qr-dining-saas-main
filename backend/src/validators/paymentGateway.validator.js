const Joi = require('joi');

const updatePaymentGateway = Joi.object({
  razorpayKeyId: Joi.string().allow('', null).optional(),
  razorpayKeySecret: Joi.string().allow('', null).optional(),
}).min(1);

module.exports = { updatePaymentGateway };
