import { Router } from 'express';
import { sendMessage, getChannels } from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /api/messages/channels/:guildId - Get channels for a guild
router.get('/channels/:guildId', authenticateToken, getChannels);

// POST /api/messages/send - Send a message to a channel
router.post('/send', authenticateToken, sendMessage);

export default router; 