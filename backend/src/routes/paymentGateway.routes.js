const router = require('express').Router();

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const tenantScope = require('../middlewares/tenantScope');
const validate = require('../middlewares/validate');

const controller = require('../controllers/paymentGateway.controller');
const schemas = require('../validators/paymentGateway.validator');

// Owner only, both directions — these are payment credentials, more
// sensitive than the branding/theme settings Manager can at least view.
router.use(authenticate, authorize('OWNER'), tenantScope);

router.get('/', controller.getPaymentGateway);
router.patch('/', validate(schemas.updatePaymentGateway), controller.updatePaymentGateway);

module.exports = router;
