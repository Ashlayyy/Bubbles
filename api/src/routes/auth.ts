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

const loginHandler: any = discordLogin;
loginHandler.secure = false;
const callbackHandler: any = discordCallback;
callbackHandler.secure = false;

router.get('/discord', authRateLimit, loginHandler);
router.get('/discord/callback', authRateLimit, callbackHandler);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);
router.get('/refresh', authenticateToken, refreshToken);

export default router;
