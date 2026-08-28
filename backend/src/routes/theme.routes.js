const router = require('express').Router();

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const tenantScope = require('../middlewares/tenantScope');
const validate = require('../middlewares/validate');

const controller = require('../controllers/theme.controller');
const schemas = require('../validators/theme.validator');

router.use(authenticate, tenantScope);

// Every restaurant-scoped role reads the theme — Owner, Manager, Chef,
// and Waiter dashboards all apply it to their own UI.
router.get('/', authorize('OWNER', 'MANAGER', 'CHEF', 'WAITER'), controller.getTheme);

// Only the Owner can change it — Manager can see the themed dashboards
// but not edit branding.
router.patch('/', authorize('OWNER'), validate(schemas.updateTheme), controller.updateTheme);

module.exports = router;
