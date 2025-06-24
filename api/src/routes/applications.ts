import { Router } from 'express';
import {
	getApplications,
	submitApplication,
	getApplication,
	updateApplicationStatus,
	getApplicationForms,
	createApplicationForm,
	updateApplicationForm,
	deleteApplicationForm,
} from '../controllers/applicationsController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validatePagination,
} from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import {
	requireAdminPermissions,
	requireModerationPermissions,
} from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

// All application routes require authentication and guild access
router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// Applications
router.get(
	'/',
	validatePagination,
	generalRateLimit,
	requireModerationPermissions,
	getApplications
);

router.post('/', generalRateLimit, submitApplication);

router.get(
	'/:applicationId',
	generalRateLimit,
	requireModerationPermissions,
	getApplication
);

router.put(
	'/:applicationId',
	generalRateLimit,
	requireModerationPermissions,
	updateApplicationStatus
);

// Application forms
router.get(
	'/forms',
	generalRateLimit,
	requireAdminPermissions,
	getApplicationForms
);

router.post(
	'/forms',
	generalRateLimit,
	requireAdminPermissions,
	createApplicationForm
);

router.put(
	'/forms/:formId',
	generalRateLimit,
	requireAdminPermissions,
	updateApplicationForm
);

router.delete(
	'/forms/:formId',
	generalRateLimit,
	requireAdminPermissions,
	deleteApplicationForm
);

export default router;
