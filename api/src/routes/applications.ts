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
import { requireModerationPermissions } from '../middleware/permissions.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

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

addRoute(
	router,
	'get',
	'/forms',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getApplicationForms
);

addRoute(
	router,
	'post',
	'/forms',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	createApplicationForm
);

addRoute(
	router,
	'put',
	'/forms/:formId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	updateApplicationForm
);

addRoute(
	router,
	'delete',
	'/forms/:formId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	deleteApplicationForm
);

export default router;
