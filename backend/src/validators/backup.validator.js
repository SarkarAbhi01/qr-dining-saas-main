const Joi = require('joi');

const createBackup = Joi.object({
  format: Joi.string().valid('EXCEL', 'PDF', 'TXT', 'SQL').required(),
});

module.exports = { createBackup };
