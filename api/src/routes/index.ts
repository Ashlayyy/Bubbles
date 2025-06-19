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
router.use('/api', authRoutes);
router.use('/api', guildRoutes);
router.use('/api', moderationRoutes);
router.use('/api', musicRoutes);
router.use('/api', loggingRoutes);
router.use('/api', analyticsRoutes);
router.use('/api', starboardRoutes);
router.use('/api', customCommandsRoutes);
router.use('/api', levelingRoutes);
router.use('/api', reactionRolesRoutes);
router.use('/api', ticketsRoutes);
router.use('/api', welcomeRoutes);
router.use('/api', appealsRoutes);
router.use('/api', remindersRoutes);
router.use('/api', applicationsRoutes);
router.use('/api', automationRoutes);
router.use('/api', entertainmentRoutes);
router.use('/api', webhooksRoutes);
router.use('/api/messages', messagesRoutes);
router.use('/api/channels', channelsRoutes);
router.use('/api/roles', rolesRoutes);
router.use('/api/invites', invitesRoutes);
router.use('/api/audit', auditRoutes);
router.use('/api/hybrid', hybridRoutes);
router.use('/api/health', healthRoutes);

// Development routes (only in development)
if (process.env.NODE_ENV === 'development') {
	router.use('/api/dev', devRoutes);
}

export default router;
