import { Router } from 'express';
import { getVoiceActivity } from '../controllers/voiceController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateGuildId, validateGuildAccess } from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

addRoute(
	router,
	'get',
	'/activity',
	{ permissionsOverride: true },
	generalRateLimit,
	getVoiceActivity
);

export default router;
