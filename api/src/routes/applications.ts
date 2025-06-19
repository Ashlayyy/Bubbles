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

const router = Router();

// All application routes require authentication and guild access
router.use(
	'/guilds/:guildId/applications',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Applications
router.get(
	'/guilds/:guildId/applications',
	validatePagination,
	generalRateLimit,
	requireModerationPermissions,
	getApplications
);

router.post(
	'/guilds/:guildId/applications',
	generalRateLimit,
	submitApplication
);

router.get(
	'/guilds/:guildId/applications/:applicationId',
	generalRateLimit,
	requireModerationPermissions,
	getApplication
);

router.put(
	'/guilds/:guildId/applications/:applicationId',
	generalRateLimit,
	requireModerationPermissions,
	updateApplicationStatus
);

// Application forms
router.get(
	'/guilds/:guildId/applications/forms',
	generalRateLimit,
	requireAdminPermissions,
	getApplicationForms
);

router.post(
	'/guilds/:guildId/applications/forms',
	generalRateLimit,
	requireAdminPermissions,
	createApplicationForm
);

router.put(
	'/guilds/:guildId/applications/forms/:formId',
	generalRateLimit,
	requireAdminPermissions,
	updateApplicationForm
);

router.delete(
	'/guilds/:guildId/applications/forms/:formId',
	generalRateLimit,
	requireAdminPermissions,
	deleteApplicationForm
);

export default router;
