const router = require('express').Router();

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const tenantScope = require('../middlewares/tenantScope');
const validate = require('../middlewares/validate');

const controller = require('../controllers/backup.controller');
const schemas = require('../validators/backup.validator');

// Owner only — triggering a full data export/backup of the tenant's
// data is more sensitive than anything a Manager needs day-to-day.
router.use(authenticate, authorize('OWNER'), tenantScope);

router.get('/', controller.listMyBackups);
router.post('/', validate(schemas.createBackup), controller.createBackup);
router.get('/:id/download', controller.downloadMyBackup);

module.exports = router;
