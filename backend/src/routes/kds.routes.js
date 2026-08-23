const router = require('express').Router();

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const tenantScope = require('../middlewares/tenantScope');
const validate = require('../middlewares/validate');

const controller = require('../controllers/kds.controller');
const reportController = require('../controllers/report.controller');
const schemas = require('../validators/order.validator');
const requireOwnReportsPermission = require('../middlewares/requireOwnReportsPermission');

router.use(authenticate, authorize('CHEF', 'OWNER', 'MANAGER'), tenantScope);

router.get('/orders', controller.listActiveOrders);
router.get('/stats', controller.todayStats);
router.get('/reports/my-performance', requireOwnReportsPermission, reportController.myPerformance);
router.patch('/orders/:id/accept', controller.acceptOrder);
router.patch(
  '/order-items/:id/status',
  validate(schemas.updateOrderItemStatus),
  controller.updateOrderItemStatus
);
router.patch('/orders/:id/status', validate(schemas.updateOrderStatus), controller.updateOrderStatus);

module.exports = router;
