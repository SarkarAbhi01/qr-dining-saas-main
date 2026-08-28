const Joi = require('joi');

const hexColor = Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).messages({
  'string.pattern.base': 'Must be a hex color like #E8A33D',
});

// Kept to a short curated list rather than free text — an arbitrary
// font-family string from an Owner could silently fail to load and
// leave the customer menu unstyled with no way to tell why.
const ALLOWED_FONTS = [
  'Inter',
  'Fraunces',
  'Poppins',
  'Roboto',
  'Playfair Display',
  'Nunito',
  'Georgia',
  'Arial',
];

const updateTheme = Joi.object({
  bodyColor: hexColor.allow(null),
  headerColor: hexColor.allow(null),
  menuColor: hexColor.allow(null),
  hoverColor: hexColor.allow(null),
  fontFamily: Joi.string().valid(...ALLOWED_FONTS).allow(null),
  fontSize: Joi.number().integer().min(12).max(20).allow(null), // base px
}).min(1);

module.exports = { updateTheme, ALLOWED_FONTS };
