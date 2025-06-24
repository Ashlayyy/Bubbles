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
import welcomeRoutes from './welcome.js';
import appealsRoutes from './appeals.js';
import remindersRoutes from './reminders.js';
import applicationsRoutes from './applications.js';
import automationRoutes from './automation.js';
import entertainmentRoutes from './entertainment.js';
import webhooksRoutes from './webhooks.js';
import messagesRoutes from './messages.js';
import channelsRoutes from './channels.js';
import rolesRoutes from './roles.js';
import invitesRoutes from './invites.js';
import auditRoutes from './audit.js';
import hybridRoutes from './hybrid.js';
import devRoutes from './dev.js';
import healthRoutes from './health.js';

const router = Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/guilds', guildRoutes);
router.use('/:guildId/moderation', moderationRoutes);
router.use('/:guildId/logging', loggingRoutes);
router.use('/:guildId/reaction-roles', reactionRolesRoutes);
router.use('/:guildId/custom-commands', customCommandsRoutes);
router.use('/:guildId/leveling', levelingRoutes);
router.use('/:guildId/tickets', ticketsRoutes);
router.use('/:guildId/welcome', welcomeRoutes);
router.use('/guilds/:guildId/music', musicRoutes);
router.use('/guilds/:guildId/analytics', analyticsRoutes);
router.use('/guilds/:guildId/starboard', starboardRoutes);
router.use('/guilds/:guildId/appeals', appealsRoutes);
router.use('/guilds/:guildId/reminders', remindersRoutes);
router.use('/guilds/:guildId/applications', applicationsRoutes);
router.use('/guilds/:guildId/automation', automationRoutes);
router.use('/guilds/:guildId/entertainment', entertainmentRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/messages', messagesRoutes);
router.use('/channels', channelsRoutes);
router.use('/roles', rolesRoutes);
router.use('/invites', invitesRoutes);
router.use('/audit', auditRoutes);
router.use('/hybrid', hybridRoutes);
router.use('/health', healthRoutes);

// Development routes (only in development)
if (process.env.NODE_ENV === 'development') {
	router.use('/dev', devRoutes);
}

export default router;
