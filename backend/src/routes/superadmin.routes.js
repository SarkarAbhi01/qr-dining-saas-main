const router = require('express').Router();

const controller = require('../controllers/superadmin.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const schemas = require('../validators/superadmin.validator');

// Every route here requires a logged-in Superadmin
router.use(authenticate, authorize('SUPERADMIN'));

// --- Restaurants ---
router.post('/restaurants', validate(schemas.createRestaurant), controller.createRestaurant);
router.get('/restaurants', validate(schemas.listQuery, 'query'), controller.listRestaurants);
router.get('/restaurants/:id', controller.getRestaurant);
router.patch('/restaurants/:id', validate(schemas.updateRestaurant), controller.updateRestaurant);
router.delete('/restaurants/:id', validate(schemas.deleteRestaurant), controller.deleteRestaurant);

// --- Status / plan / revenue model / limits (each has its own rules) ---
router.patch('/restaurants/:id/status', validate(schemas.changeStatus), controller.changeStatus);
router.patch('/restaurants/:id/plan', validate(schemas.assignPlan), controller.assignPlan);
router.patch(
  '/restaurants/:id/revenue-model',
  validate(schemas.setRevenueModel),
  controller.setRevenueModel
);
router.patch(
  '/restaurants/:id/custom-limits',
  validate(schemas.setCustomLimits),
  controller.setCustomLimits
);

// --- Owner / Manager credentials ---
router.post(
  '/restaurants/:id/credentials',
  validate(schemas.createCredential),
  controller.createCredential
);
router.post('/users/:userId/reset-password', controller.resetPassword);

// --- Subscription plans ---
router.get('/plans', controller.listPlans);
router.post('/plans', validate(schemas.createPlan), controller.createPlan);
router.patch('/plans/:id', validate(schemas.updatePlan), controller.updatePlan);

// --- Reports ---
router.get('/reports/overview', controller.globalOverview);
router.get('/reports/restaurant-revenue', controller.restaurantRevenueReport);

module.exports = router;
