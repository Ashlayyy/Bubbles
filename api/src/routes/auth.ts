import { Router } from 'express';
import {
	discordLogin,
	discordCallback,
	logout,
	getCurrentUser,
	refreshToken,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimiting.js';

const router = Router();

// Authentication routes
router.post('/discord/login', authRateLimit, discordLogin);
router.post('/discord/callback', authRateLimit, discordCallback);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);
router.get('/refresh', authenticateToken, refreshToken);

export default router;
