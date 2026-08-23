const router = require('express').Router();

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const tenantScope = require('../middlewares/tenantScope');
const validate = require('../middlewares/validate');

const controller = require('../controllers/waiter.controller');
const reportController = require('../controllers/report.controller');
const schemas = require('../validators/order.validator');
const requireOwnReportsPermission = require('../middlewares/requireOwnReportsPermission');

router.use(authenticate, authorize('WAITER', 'OWNER', 'MANAGER'), tenantScope);

router.get('/tables', controller.listTables);
router.get('/menu', controller.getMenu);
router.get('/service-queue', controller.serviceQueue);
router.patch('/orders/:id/serve', controller.markServed);
router.post('/manual-orders', validate(schemas.manualOrder), controller.createManualOrder);

router.get('/calls', controller.listCalls);
router.patch('/calls/:id/acknowledge', controller.acknowledgeCall);
router.patch('/calls/:id/resolve', controller.resolveCall);

router.get('/payments/pending', controller.listPendingPayments);
router.get('/payments/collected', controller.listCollectedPayments);
router.patch('/payments/:id/confirm', controller.confirmPayment);

router.get('/reports/my-performance', requireOwnReportsPermission, reportController.myPerformance);

module.exports = router;
