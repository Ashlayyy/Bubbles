import { Router } from 'express';
import authRoutes from './auth.js';
import guildRoutes from './guilds.js';
import moderationRoutes from './moderation.js';
import musicRoutes from './music.js';
import loggingRoutes from './logging.js';
import analyticsRoutes from './analytics.js';
import starboardRoutes from './starboard.js';
import customCommandsRoutes from './customCommands.js';
import levelingRoutes from './leveling.js';
import reactionRolesRoutes from './reactionRoles.js';
import ticketsRoutes from './tickets.js';
import ticketCategoriesRoutes from './ticketCategories.js';
import ticketAnalyticsRoutes from './ticketAnalytics.js';
import ticketTemplatesRoutes from './ticketTemplates.js';
import ticketUserManagementRoutes from './ticketUserManagement.js';
import welcomeRoutes from './welcome.js';
import appealsRoutes from './appeals.js';
import remindersRoutes from './reminders.js';
import applicationsRoutes from './applications.js';
import automationRoutes from './automation.js';
import entertainmentRoutes from './entertainment.js';
import economyRoutes from './economy.js';
import pollsRoutes from './polls.js';
import webhooksRoutes from './webhooks.js';
import messagesRoutes from './messages.js';
import channelsRoutes from './channels.js';
import rolesRoutes from './roles.js';
import serverStatsRoutes from './serverStats.js';
import invitesRoutes from './invites.js';
import auditRoutes from './audit.js';
import hybridRoutes from './hybrid.js';
import devRoutes from './dev.js';
import healthRoutes from './health.js';
import metricsRoutes from './metrics.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireUniversalPermissions } from '../middleware/permissions.js';
import eventsRoutes from './events.js';

const router = Router();

router.use(
	'/guilds/:guildId',
	authenticateToken,
	requireUniversalPermissions(['token', 'discord:MANAGE_GUILD'])
);

router.use('/auth', authRoutes);
router.use('/guilds', guildRoutes);
router.use('/guilds/:guildId/moderation', moderationRoutes);
router.use('/guilds/:guildId/logging', loggingRoutes);
router.use('/guilds/:guildId/reaction-roles', reactionRolesRoutes);
router.use('/guilds/:guildId/custom-commands', customCommandsRoutes);
router.use('/guilds/:guildId/leveling', levelingRoutes);
router.use('/guilds/:guildId/tickets', ticketsRoutes);
router.use('/', ticketCategoriesRoutes);
router.use('/', ticketAnalyticsRoutes);
router.use('/', ticketTemplatesRoutes);
router.use('/', ticketUserManagementRoutes);
router.use('/guilds/:guildId/welcome', welcomeRoutes);
router.use('/guilds/:guildId/channels', channelsRoutes);
router.use('/guilds/:guildId/roles', rolesRoutes);
router.use('/guilds/:guildId/server-stats', serverStatsRoutes);
router.use('/guilds/:guildId/invites', invitesRoutes);
router.use('/guilds/:guildId/music', musicRoutes);
router.use('/guilds/:guildId/analytics', analyticsRoutes);
router.use('/guilds/:guildId/starboard', starboardRoutes);
router.use('/guilds/:guildId/appeals', appealsRoutes);
router.use('/guilds/:guildId/reminders', remindersRoutes);
router.use('/guilds/:guildId/applications', applicationsRoutes);
router.use('/guilds/:guildId/automation', automationRoutes);
router.use('/guilds/:guildId/entertainment', entertainmentRoutes);
router.use('/economy', economyRoutes);
router.use('/polls', pollsRoutes);
router.use('/guilds/:guildId/webhooks', webhooksRoutes);
router.use('/guilds/:guildId/messages', messagesRoutes);
router.use('/guilds/:guildId/audit', auditRoutes);
router.use('/hybrid', hybridRoutes);
router.use('/health', healthRoutes);
router.use('/metrics', metricsRoutes);
router.use('/events', eventsRoutes);

if (process.env.NODE_ENV === 'development') {
	router.use('/dev', devRoutes);
}

export default router;
