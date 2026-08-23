const router = require('express').Router();

// NOTE: Remaining route modules (restaurant/owner domain, menu, tables,
// orders, kds, waiter, customer, payments) are wired in as each phase lands.
router.use('/auth', require('./auth.routes'));
router.use('/superadmin', require('./superadmin.routes'));
// IMPORTANT: these two must be mounted before '/restaurant' — that router
// applies a blanket authorize('OWNER','MANAGER') to everything under it,
// which would otherwise reject CHEF/WAITER requests before they ever
// reach these sub-routers and their own (different) role gates.
router.use('/restaurant/kds', require('./kds.routes'));
router.use('/restaurant/waiter', require('./waiter.routes'));
router.use('/restaurant', require('./restaurant.routes'));
router.use('/customer', require('./customer.routes'));

router.get('/', (req, res) => {
  res.json({ success: true, message: 'QR Dining SaaS API — Phase 5 real-time KDS & Waiter ready' });
});

module.exports = router;
