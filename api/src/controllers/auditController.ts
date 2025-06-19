import type { Response } from 'express';
import { discordApi } from '../services/discordApiService.js';
import { getDiscordEventForwarder } from '../services/discordEventForwarder.js';
import { createLogger } from '../types/shared.js';
import type { ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';

const logger = createLogger('api-audit');

// ============================================================================
// AUDIT LOG OPERATIONS
// ============================================================================

export const getGuildAuditLog = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { user_id, action_type, before, after, limit = 50 } = req.query;

		if (!guildId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID is required',
			} as ApiResponse);
		}

		const options = {
			...(user_id && { user_id: user_id as string }),
			...(action_type && { action_type: parseInt(action_type as string) }),
			...(before && { before: before as string }),
			...(after && { after: after as string }),
			...(limit && { limit: parseInt(limit as string) }),
		};

		const auditLog = await discordApi.getGuildAuditLog(guildId, options);

		res.json({
			success: true,
			data: auditLog,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching guild audit log:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch guild audit log',
		} as ApiResponse);
	}
};

// ============================================================================
// AUDIT LOG ANALYTICS
// ============================================================================

export const getAuditLogAnalytics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { days = '7' } = req.query;

		if (!guildId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID is required',
			} as ApiResponse);
		}

		// Get recent audit log entries
		const auditLog = await discordApi.getGuildAuditLog(guildId, { limit: 100 });

		// Analyze audit log data
		const analytics = analyzeAuditLog(auditLog, parseInt(days as string));

		res.json({
			success: true,
			data: analytics,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error generating audit log analytics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to generate audit log analytics',
		} as ApiResponse);
	}
};

export const getAuditLogsByUser = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const { limit = 50, action_type } = req.query;

		if (!guildId || !userId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID and User ID are required',
			} as ApiResponse);
		}

		const options = {
			user_id: userId,
			limit: parseInt(limit as string),
			...(action_type && { action_type: parseInt(action_type as string) }),
		};

		const auditLog = await discordApi.getGuildAuditLog(guildId, options);

		// Add user activity summary
		const userAnalytics = analyzeUserActivity(auditLog);

		res.json({
			success: true,
			data: {
				audit_log_entries: auditLog.audit_log_entries,
				user_analytics: userAnalytics,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching user audit logs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch user audit logs',
		} as ApiResponse);
	}
};

export const getAuditLogsByAction = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, actionType } = req.params;
		const { limit = 50, user_id } = req.query;

		if (!guildId || !actionType) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID and Action Type are required',
			} as ApiResponse);
		}

		const options = {
			action_type: parseInt(actionType),
			limit: parseInt(limit as string),
			...(user_id && { user_id: user_id as string }),
		};

		const auditLog = await discordApi.getGuildAuditLog(guildId, options);

		// Add action-specific analytics
		const actionAnalytics = analyzeActionType(auditLog, parseInt(actionType));

		res.json({
			success: true,
			data: {
				audit_log_entries: auditLog.audit_log_entries,
				action_analytics: actionAnalytics,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching action audit logs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch action audit logs',
		} as ApiResponse);
	}
};

// ============================================================================
// AUDIT LOG MONITORING
// ============================================================================

export const getSecurityAlerts = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { hours = '24' } = req.query;

		if (!guildId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID is required',
			} as ApiResponse);
		}

		// Get recent audit log entries
		const auditLog = await discordApi.getGuildAuditLog(guildId, { limit: 100 });

		// Analyze for security concerns
		const securityAlerts = analyzeSecurityConcerns(
			auditLog,
			parseInt(hours as string)
		);

		res.json({
			success: true,
			data: securityAlerts,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error generating security alerts:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to generate security alerts',
		} as ApiResponse);
	}
};

export const getModerationHistory = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { target_user_id, moderator_id, limit = 50 } = req.query;

		if (!guildId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID is required',
			} as ApiResponse);
		}

		// Get moderation-related audit log entries
		const moderationActions = [
			1, // GUILD_UPDATE
			10, // CHANNEL_CREATE
			11, // CHANNEL_UPDATE
			12, // CHANNEL_DELETE
			13, // CHANNEL_OVERWRITE_CREATE
			14, // CHANNEL_OVERWRITE_UPDATE
			15, // CHANNEL_OVERWRITE_DELETE
			20, // MEMBER_KICK
			21, // MEMBER_PRUNE
			22, // MEMBER_BAN_ADD
			23, // MEMBER_BAN_REMOVE
			24, // MEMBER_UPDATE
			25, // MEMBER_ROLE_UPDATE
			26, // MEMBER_MOVE
			27, // MEMBER_DISCONNECT
			28, // BOT_ADD
			30, // ROLE_CREATE
			31, // ROLE_UPDATE
			32, // ROLE_DELETE
			40, // INVITE_CREATE
			41, // INVITE_UPDATE
			42, // INVITE_DELETE
			50, // WEBHOOK_CREATE
			51, // WEBHOOK_UPDATE
			52, // WEBHOOK_DELETE
			60, // EMOJI_CREATE
			61, // EMOJI_UPDATE
			62, // EMOJI_DELETE
			72, // MESSAGE_DELETE
			73, // MESSAGE_BULK_DELETE
			74, // MESSAGE_PIN
			75, // MESSAGE_UNPIN
			80, // INTEGRATION_CREATE
			81, // INTEGRATION_UPDATE
			82, // INTEGRATION_DELETE
			83, // STAGE_INSTANCE_CREATE
			84, // STAGE_INSTANCE_UPDATE
			85, // STAGE_INSTANCE_DELETE
		];

		const allModerationLogs = [];

		// Fetch logs for each moderation action type
		for (const actionType of moderationActions) {
			try {
				const options: any = {
					action_type: actionType,
					limit: 25,
				};

				if (moderator_id) options.user_id = moderator_id as string;

				const auditLog = await discordApi.getGuildAuditLog(guildId, options);

				// Filter by target user if specified
				let entries = auditLog.audit_log_entries || [];
				if (target_user_id) {
					entries = entries.filter(
						(entry: any) => entry.target_id === target_user_id
					);
				}

				allModerationLogs.push(...entries);
			} catch (error) {
				logger.warn(
					`Failed to fetch audit logs for action type ${actionType}:`,
					error
				);
			}
		}

		// Sort by timestamp (newest first) and limit
		const sortedLogs = allModerationLogs
			.sort(
				(a: any, b: any) =>
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			)
			.slice(0, parseInt(limit as string));

		// Generate moderation analytics
		const moderationAnalytics = analyzeModerationHistory(sortedLogs);

		res.json({
			success: true,
			data: {
				moderation_history: sortedLogs,
				analytics: moderationAnalytics,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching moderation history:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch moderation history',
		} as ApiResponse);
	}
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function analyzeAuditLog(auditLog: any, days: number) {
	const entries = auditLog.audit_log_entries || [];
	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

	const recentEntries = entries.filter(
		(entry: any) => new Date(entry.created_at) > cutoff
	);

	const actionCounts = recentEntries.reduce((acc: any, entry: any) => {
		acc[entry.action_type] = (acc[entry.action_type] || 0) + 1;
		return acc;
	}, {});

	const userActivity = recentEntries.reduce((acc: any, entry: any) => {
		const userId = entry.user_id;
		acc[userId] = (acc[userId] || 0) + 1;
		return acc;
	}, {});

	return {
		total_entries: recentEntries.length,
		period_days: days,
		action_breakdown: actionCounts,
		most_active_users: Object.entries(userActivity)
			.sort(([, a], [, b]) => (b as number) - (a as number))
			.slice(0, 10),
		timeline: generateTimeline(recentEntries, days),
	};
}

function analyzeUserActivity(auditLog: any) {
	const entries = auditLog.audit_log_entries || [];

	const actionCounts = entries.reduce((acc: any, entry: any) => {
		acc[entry.action_type] = (acc[entry.action_type] || 0) + 1;
		return acc;
	}, {});

	const recentActivity = entries
		.sort(
			(a: any, b: any) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		)
		.slice(0, 10);

	return {
		total_actions: entries.length,
		action_breakdown: actionCounts,
		recent_activity: recentActivity,
		first_action:
			entries.length > 0 ? entries[entries.length - 1].created_at : null,
		last_action: entries.length > 0 ? entries[0].created_at : null,
	};
}

function analyzeActionType(auditLog: any, actionType: number) {
	const entries = auditLog.audit_log_entries || [];

	const userCounts = entries.reduce((acc: any, entry: any) => {
		acc[entry.user_id] = (acc[entry.user_id] || 0) + 1;
		return acc;
	}, {});

	return {
		total_occurrences: entries.length,
		action_type: actionType,
		top_performers: Object.entries(userCounts)
			.sort(([, a], [, b]) => (b as number) - (a as number))
			.slice(0, 5),
		recent_entries: entries.slice(0, 10),
	};
}

function analyzeSecurityConcerns(auditLog: any, hours: number) {
	const entries = auditLog.audit_log_entries || [];
	const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

	const recentEntries = entries.filter(
		(entry: any) => new Date(entry.created_at) > cutoff
	);

	// Define high-risk actions
	const highRiskActions = [
		22, // MEMBER_BAN_ADD
		32, // ROLE_DELETE
		30, // ROLE_CREATE
		31, // ROLE_UPDATE
		12, // CHANNEL_DELETE
		10, // CHANNEL_CREATE
		52, // WEBHOOK_DELETE
		50, // WEBHOOK_CREATE
		82, // INTEGRATION_DELETE
		80, // INTEGRATION_CREATE
	];

	const securityAlerts = recentEntries
		.filter((entry: any) => highRiskActions.includes(entry.action_type))
		.map((entry: any) => ({
			...entry,
			risk_level: getRiskLevel(entry.action_type),
			alert_type: getAlertType(entry.action_type),
		}));

	// Check for rapid successive actions (potential abuse)
	const rapidActions = detectRapidActions(recentEntries, 5); // 5 minutes

	return {
		period_hours: hours,
		total_alerts: securityAlerts.length,
		high_risk_actions: securityAlerts.filter(
			(alert: any) => alert.risk_level === 'HIGH'
		),
		medium_risk_actions: securityAlerts.filter(
			(alert: any) => alert.risk_level === 'MEDIUM'
		),
		rapid_actions: rapidActions,
		recommendations: generateSecurityRecommendations(
			securityAlerts,
			rapidActions
		),
	};
}

function analyzeModerationHistory(logs: any[]) {
	const actionCounts = logs.reduce((acc: any, log: any) => {
		acc[log.action_type] = (acc[log.action_type] || 0) + 1;
		return acc;
	}, {});

	const moderatorActivity = logs.reduce((acc: any, log: any) => {
		acc[log.user_id] = (acc[log.user_id] || 0) + 1;
		return acc;
	}, {});

	const targetActivity = logs.reduce((acc: any, log: any) => {
		if (log.target_id) {
			acc[log.target_id] = (acc[log.target_id] || 0) + 1;
		}
		return acc;
	}, {});

	return {
		total_actions: logs.length,
		action_breakdown: actionCounts,
		most_active_moderators: Object.entries(moderatorActivity)
			.sort(([, a], [, b]) => (b as number) - (a as number))
			.slice(0, 5),
		most_targeted_users: Object.entries(targetActivity)
			.sort(([, a], [, b]) => (b as number) - (a as number))
			.slice(0, 10),
		recent_activity: logs.slice(0, 20),
	};
}

function generateTimeline(entries: any[], days: number) {
	const timeline = [];
	const now = new Date();

	for (let i = 0; i < days; i++) {
		const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
		const dayStart = new Date(date.setHours(0, 0, 0, 0));
		const dayEnd = new Date(date.setHours(23, 59, 59, 999));

		const dayEntries = entries.filter((entry: any) => {
			const entryDate = new Date(entry.created_at);
			return entryDate >= dayStart && entryDate <= dayEnd;
		});

		timeline.unshift({
			date: dayStart.toISOString().split('T')[0],
			count: dayEntries.length,
			actions: dayEntries.map((entry: any) => entry.action_type),
		});
	}

	return timeline;
}

function getRiskLevel(actionType: number): string {
	const highRisk = [22, 32, 12, 52, 82]; // Bans, role/channel/webhook deletions
	const mediumRisk = [30, 31, 10, 50, 80]; // Creates and updates

	if (highRisk.includes(actionType)) return 'HIGH';
	if (mediumRisk.includes(actionType)) return 'MEDIUM';
	return 'LOW';
}

function getAlertType(actionType: number): string {
	const alertTypes: { [key: number]: string } = {
		22: 'Member Ban',
		32: 'Role Deletion',
		30: 'Role Creation',
		31: 'Role Update',
		12: 'Channel Deletion',
		10: 'Channel Creation',
		52: 'Webhook Deletion',
		50: 'Webhook Creation',
		82: 'Integration Deletion',
		80: 'Integration Creation',
	};

	return alertTypes[actionType] || 'Unknown Action';
}

function detectRapidActions(entries: any[], minutes: number) {
	const rapidThreshold = minutes * 60 * 1000; // Convert to milliseconds
	const userActions: { [key: string]: any[] } = {};

	// Group actions by user
	entries.forEach((entry: any) => {
		if (!userActions[entry.user_id]) {
			userActions[entry.user_id] = [];
		}
		userActions[entry.user_id].push(entry);
	});

	const rapidActions: any[] = [];

	// Check for rapid actions by each user
	Object.entries(userActions).forEach(([userId, actions]) => {
		const sortedActions = actions.sort(
			(a, b) =>
				new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
		);

		for (let i = 0; i < sortedActions.length - 1; i++) {
			const timeDiff =
				new Date(sortedActions[i + 1].created_at).getTime() -
				new Date(sortedActions[i].created_at).getTime();

			if (timeDiff <= rapidThreshold) {
				rapidActions.push({
					user_id: userId,
					actions: [sortedActions[i], sortedActions[i + 1]],
					time_difference_ms: timeDiff,
				});
			}
		}
	});

	return rapidActions;
}

function generateSecurityRecommendations(alerts: any[], rapidActions: any[]) {
	const recommendations = [];

	if (alerts.filter((alert: any) => alert.risk_level === 'HIGH').length > 5) {
		recommendations.push({
			type: 'HIGH_RISK_ACTIVITY',
			message:
				'Multiple high-risk actions detected. Consider reviewing administrator permissions.',
			priority: 'HIGH',
		});
	}

	if (rapidActions.length > 0) {
		recommendations.push({
			type: 'RAPID_ACTIONS',
			message:
				'Rapid successive actions detected. This may indicate automated behavior or potential abuse.',
			priority: 'MEDIUM',
		});
	}

	if (alerts.filter((alert: any) => alert.action_type === 22).length > 3) {
		recommendations.push({
			type: 'MULTIPLE_BANS',
			message:
				'Multiple ban actions detected. Ensure proper moderation protocols are being followed.',
			priority: 'MEDIUM',
		});
	}

	return recommendations;
}
