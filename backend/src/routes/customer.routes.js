const router = require('express').Router();

const controller = require('../controllers/customer.controller');
const validate = require('../middlewares/validate');
const schemas = require('../validators/customer.validator');

// No `authenticate` here by design — the customer never logs in.
// Trust boundary is the unguessable table/session UUID from the QR code.
router.get('/tables/:restaurantSlug/:tableId', controller.resolveTable);
router.get('/menu/:slug', controller.getPublicMenu);
router.get('/staff/:slug', controller.listStaffForComplaint);

router.get('/sessions/:sessionId', controller.getSession);
router.post('/sessions/:sessionId/orders', validate(schemas.placeOrder), controller.placeOrder);
router.post('/sessions/:sessionId/call-waiter', controller.callWaiter);
router.post('/sessions/:sessionId/request-bill', controller.requestBill);
router.post('/sessions/:sessionId/split', validate(schemas.splitBill), controller.createBillSplit);
router.post('/sessions/:sessionId/checkout/cash', controller.checkoutCash);
router.post('/sessions/:sessionId/feedback', validate(schemas.submitFeedback), controller.submitFeedback);

module.exports = router;
