const router = require('express').Router();

const controller = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const schemas = require('../validators/auth.validator');

router.post('/login', validate(schemas.login), controller.login);
router.post('/refresh', validate(schemas.refresh), controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);
router.patch(
  '/change-password',
  authenticate,
  validate(schemas.changePassword),
  controller.changePassword
);

module.exports = router;
