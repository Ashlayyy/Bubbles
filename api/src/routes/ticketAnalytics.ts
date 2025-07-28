import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermissions } from '../middleware/permissions.js';
import {
	getTicketAnalytics,
	getResponseTimeAnalytics,
	getSatisfactionAnalytics,
	submitSatisfactionSurvey,
	getStaffPerformance,
} from '../controllers/ticketAnalyticsController.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get overall ticket analytics for a guild
router.get(
	'/guilds/:guildId/ticket-analytics',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTicketAnalytics
);

// Get response time analytics
router.get(
	'/guilds/:guildId/ticket-analytics/response-times',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getResponseTimeAnalytics
);

// Get satisfaction analytics
router.get(
	'/guilds/:guildId/ticket-analytics/satisfaction',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getSatisfactionAnalytics
);

// Get staff performance metrics
router.get(
	'/guilds/:guildId/ticket-analytics/staff-performance',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getStaffPerformance
);

// Submit satisfaction survey (public endpoint for ticket creators)
router.post(
	'/guilds/:guildId/tickets/:ticketId/satisfaction-survey',
	submitSatisfactionSurvey
);

export default router;
