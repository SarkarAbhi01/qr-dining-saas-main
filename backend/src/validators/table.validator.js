const Joi = require('joi');

const createTable = Joi.object({
  tableNumber: Joi.string().min(1).max(20).required(),
  capacity: Joi.number().integer().min(1).max(50).default(4),
});

const bulkCreateTables = Joi.object({
  // e.g. prefix "T", count 20 -> T1..T20
  prefix: Joi.string().max(10).allow(''),
  startAt: Joi.number().integer().min(1).default(1),
  count: Joi.number().integer().min(1).max(200).required(),
  capacity: Joi.number().integer().min(1).max(50).default(4),
});

const updateTable = Joi.object({
  tableNumber: Joi.string().min(1).max(20),
  capacity: Joi.number().integer().min(1).max(50),
  status: Joi.string().valid('EMPTY', 'OCCUPIED', 'NEEDS_ATTENTION', 'RESERVED'),
}).min(1);

module.exports = { createTable, bulkCreateTables, updateTable };
