const router = require('express').Router();

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const tenantScope = require('../middlewares/tenantScope');
const validate = require('../middlewares/validate');
const parseJsonFields = require('../middlewares/parseJsonFields');
const { uploadMenuItemImage } = require('../middlewares/upload');

const categoryController = require('../controllers/category.controller');
const menuItemController = require('../controllers/menuItem.controller');
const tableController = require('../controllers/table.controller');
const staffController = require('../controllers/staff.controller');
const reportController = require('../controllers/report.controller');
const feedbackController = require('../controllers/feedback.controller');
const billingController = require('../controllers/billing.controller');

const menuSchemas = require('../validators/menu.validator');
const tableSchemas = require('../validators/table.validator');
const staffSchemas = require('../validators/staff.validator');
const reportSchemas = require('../validators/report.validator');

// Every route in this file requires an authenticated Owner or Manager,
// scoped to their own restaurant via tenantScope.
router.use(authenticate, authorize('OWNER', 'MANAGER'), tenantScope);

// --- Categories ---
router.get('/categories', categoryController.listCategories);
router.post('/categories', validate(menuSchemas.createCategory), categoryController.createCategory);
router.patch('/categories/reorder', validate(menuSchemas.reorderCategories), categoryController.reorderCategories);
router.patch('/categories/:id', validate(menuSchemas.updateCategory), categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// --- Menu items ---
router.get('/menu-items', menuItemController.listMenuItems);
router.get('/menu-items/:id', menuItemController.getMenuItem);
router.post(
  '/menu-items',
  uploadMenuItemImage.single('image'),
  parseJsonFields('modifierGroups'),
  validate(menuSchemas.createMenuItem),
  menuItemController.createMenuItem
);
router.patch(
  '/menu-items/:id',
  uploadMenuItemImage.single('image'),
  parseJsonFields('modifierGroups'),
  validate(menuSchemas.updateMenuItem),
  menuItemController.updateMenuItem
);
router.patch('/menu-items/:id/availability', menuItemController.toggleAvailability);
router.delete('/menu-items/:id', menuItemController.deleteMenuItem);

// --- Tables & QR ---
router.get('/tables', tableController.listTables);
router.post('/tables', validate(tableSchemas.createTable), tableController.createTable);
router.post('/tables/bulk', validate(tableSchemas.bulkCreateTables), tableController.bulkCreateTables);
router.patch('/tables/:id', validate(tableSchemas.updateTable), tableController.updateTable);
router.delete('/tables/:id', tableController.deleteTable);

// --- Staff ---
router.get('/staff', staffController.listStaff);
router.post('/staff', validate(staffSchemas.createStaff), staffController.createStaff);
router.patch('/staff/:id', validate(staffSchemas.updateStaff), staffController.updateStaff);
router.post('/staff/:id/reset-password', staffController.resetStaffPassword);
router.delete('/staff/:id', staffController.deleteStaff);

// --- Reports & Analytics ---
router.get('/reports/overview', reportController.overview);
router.get(
  '/reports/revenue-series',
  validate(reportSchemas.revenueSeries, 'query'),
  reportController.revenueSeries
);
router.get('/reports/top-items', validate(reportSchemas.topItems, 'query'), reportController.topItems);
router.get('/reports/peak-hours', reportController.peakHours);
router.get('/reports/staff-performance', reportController.staffPerformance);
router.get('/reports/chef-performance', reportController.chefPerformance);
router.get(
  '/reports/payments-collected',
  validate(reportSchemas.paymentsCollected, 'query'),
  reportController.paymentsCollected
);
router.get(
  '/reports/revenue-by-method',
  validate(reportSchemas.revenueByMethod, 'query'),
  reportController.revenueByMethod
);

// --- Feedback ---
router.get('/feedback', feedbackController.listFeedback);

// --- Billing (read-only — plan changes are a Superadmin action) ---
router.get('/billing', billingController.getBilling);
router.get('/billing/invoices', billingController.listInvoices);

module.exports = router;
