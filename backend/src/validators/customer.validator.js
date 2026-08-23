const Joi = require('joi');

const orderItemModifier = Joi.object({
  modifierOptionId: Joi.string().uuid().required(),
});

const orderItem = Joi.object({
  menuItemId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).max(50).required(),
  portion: Joi.string().valid('FULL', 'HALF').default('FULL'),
  notes: Joi.string().max(300).allow('', null),
  modifierOptionIds: Joi.array().items(Joi.string().uuid()).default([]),
});

const placeOrder = Joi.object({
  items: Joi.array().items(orderItem).min(1).required(),
});

const splitBill = Joi.object({
  splitType: Joi.string().valid('FULL', 'EQUAL', 'CUSTOM').required(),
  numberOfShares: Joi.number().integer().min(2).max(20).when('splitType', {
    is: 'EQUAL',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  shares: Joi.array()
    .items(
      Joi.object({
        label: Joi.string().max(60).allow('', null),
        amount: Joi.number().positive().required(),
      })
    )
    .min(2)
    .when('splitType', {
      is: 'CUSTOM',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
});

const submitFeedback = Joi.object({
  type: Joi.string().valid('REVIEW', 'COMPLAINT').default('REVIEW'),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('', null),
  aboutWaiterId: Joi.string().uuid().allow(null),
  aboutChefId: Joi.string().uuid().allow(null),
});

module.exports = { placeOrder, splitBill, submitFeedback };
