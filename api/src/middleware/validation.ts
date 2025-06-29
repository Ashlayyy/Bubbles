import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ApiResponse } from '../types/shared.js';
import type { AuthRequest } from './auth.js';
import { discordApi } from '../services/discordApiService.js';

// Common validation schemas
const schemas = {
	// Common patterns
	guildId: Joi.string()
		.pattern(/^\d{17,19}$/)
		.required(),
	userId: Joi.string()
		.pattern(/^\d{17,19}$/)
		.required(),
	channelId: Joi.string()
		.pattern(/^\d{17,19}$/)
		.required(),
	roleId: Joi.string()
		.pattern(/^\d{17,19}$/)
		.required(),
	messageId: Joi.string()
		.pattern(/^\d{17,19}$/)
		.required(),

	// Pagination
	pagination: Joi.object({
		limit: Joi.number().min(1).max(100).default(50),
		offset: Joi.number().min(0).default(0),
		before: Joi.string().optional(),
		after: Joi.string().optional(),
	}),

	// Moderation
	moderationCase: Joi.object({
		userId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.required(),
		type: Joi.string()
			.valid('ban', 'kick', 'timeout', 'warn', 'unban', 'untimeout', 'note')
			.required(),
		reason: Joi.string().max(500).optional(),
		evidence: Joi.array().items(Joi.string().uri()).max(10).optional(),
		duration: Joi.number().min(60).max(2419200).optional(), // 1 minute to 28 days
		severity: Joi.string()
			.valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
			.default('MEDIUM'),
		points: Joi.number().min(0).max(100).default(0),
		publicNote: Joi.string().max(200).optional(),
		staffNote: Joi.string().max(500).optional(),
		notifyUser: Joi.boolean().default(true),
	}),

	// Tickets
	ticket: Joi.object({
		category: Joi.string().max(50).required(),
		title: Joi.string().max(100).required(),
		description: Joi.string().max(1000).optional(),
		tags: Joi.array().items(Joi.string().max(20)).max(5).default([]),
	}),

	ticketSettings: Joi.object({
		enabled: Joi.boolean().required(),
		categoryId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.optional(),
		logChannelId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.optional(),
		supportRoleId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.optional(),
		maxTicketsPerUser: Joi.number().min(1).max(10).default(3),
		ticketInactiveHours: Joi.number().min(1).max(168).default(24),
		useThreads: Joi.boolean().default(true),
		requireReason: Joi.boolean().default(false),
		supportMessage: Joi.string().max(1000).optional(),
	}),

	// Welcome
	welcomeSettings: Joi.object({
		welcomeEnabled: Joi.boolean().required(),
		goodbyeEnabled: Joi.boolean().required(),
		welcomeChannelId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.optional(),
		goodbyeChannelId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.optional(),
		welcomeMessage: Joi.string().max(2000).optional(),
		goodbyeMessage: Joi.string().max(2000).optional(),
		embedEnabled: Joi.boolean().default(false),
		embedColor: Joi.string()
			.pattern(/^#[0-9A-Fa-f]{6}$/)
			.optional(),
		assignRoles: Joi.array()
			.items(Joi.string().pattern(/^\d{17,19}$/))
			.max(10)
			.default([]),
		dmWelcome: Joi.boolean().default(false),
		dmMessage: Joi.string().max(2000).optional(),
	}),

	// Custom Commands
	customCommand: Joi.object({
		name: Joi.string()
			.min(1)
			.max(32)
			.pattern(/^[a-zA-Z0-9_-]+$/)
			.required(),
		aliases: Joi.array()
			.items(
				Joi.string()
					.min(1)
					.max(32)
					.pattern(/^[a-zA-Z0-9_-]+$/)
			)
			.max(5)
			.default([]),
		content: Joi.string().max(2000).required(),
		type: Joi.string()
			.valid('TEXT', 'EMBED', 'REACTION', 'SCRIPT')
			.default('TEXT'),
		embedData: Joi.object().optional(),
		permissions: Joi.array().items(Joi.string()).max(10).default([]),
		cooldown: Joi.number().min(0).max(3600).default(0),
		enabled: Joi.boolean().default(true),
	}),

	// Leveling
	levelingSettings: Joi.object({
		enabled: Joi.boolean().required(),
		xpPerMessage: Joi.number().min(1).max(100).default(10),
		xpCooldown: Joi.number().min(0).max(300).default(60),
		levelUpMessage: Joi.string().max(500).optional(),
		levelUpChannel: Joi.string()
			.pattern(/^\d{17,19}$/)
			.optional(),
		ignoredChannels: Joi.array()
			.items(Joi.string().pattern(/^\d{17,19}$/))
			.max(50)
			.default([]),
		ignoredRoles: Joi.array()
			.items(Joi.string().pattern(/^\d{17,19}$/))
			.max(20)
			.default([]),
		multiplierRoles: Joi.array()
			.items(
				Joi.object({
					roleId: Joi.string()
						.pattern(/^\d{17,19}$/)
						.required(),
					multiplier: Joi.number().min(0.1).max(10).required(),
				})
			)
			.max(10)
			.default([]),
		stackMultipliers: Joi.boolean().default(false),
	}),

	// Reaction Roles
	reactionRole: Joi.object({
		channelId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.required(),
		messageId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.required(),
		emoji: Joi.string().required(),
		roleIds: Joi.array()
			.items(Joi.string().pattern(/^\d{17,19}$/))
			.min(1)
			.max(5)
			.required(),
		type: Joi.string()
			.valid('TOGGLE', 'ADD_ONLY', 'REMOVE_ONLY')
			.default('TOGGLE'),
		maxUses: Joi.number().min(1).optional(),
	}),

	// Appeals
	appeal: Joi.object({
		caseId: Joi.string().optional(),
		type: Joi.string().valid('BAN', 'TIMEOUT', 'KICK', 'WARN').required(),
		reason: Joi.string().min(10).max(1000).required(),
		evidence: Joi.array().items(Joi.string().uri()).max(5).optional(),
	}),

	// Reminders
	reminder: Joi.object({
		channelId: Joi.string()
			.pattern(/^\d{17,19}$/)
			.required(),
		content: Joi.string().max(1000).required(),
		triggerAt: Joi.date().min('now').required(),
		recurring: Joi.object({
			interval: Joi.number().min(1).required(),
			unit: Joi.string().valid('MINUTES', 'HOURS', 'DAYS', 'WEEKS').required(),
			endAt: Joi.date().min(Joi.ref('../../triggerAt')).optional(),
		}).optional(),
	}),

	// Automation
	automationRule: Joi.object({
		name: Joi.string().max(100).required(),
		description: Joi.string().max(500).optional(),
		enabled: Joi.boolean().default(true),
		trigger: Joi.object({
			type: Joi.string()
				.valid(
					'MEMBER_JOIN',
					'MEMBER_LEAVE',
					'MESSAGE_SENT',
					'REACTION_ADD',
					'ROLE_ASSIGN',
					'SCHEDULED'
				)
				.required(),
			conditions: Joi.object().required(),
		}).required(),
		actions: Joi.array()
			.items(
				Joi.object({
					type: Joi.string()
						.valid(
							'SEND_MESSAGE',
							'ADD_ROLE',
							'REMOVE_ROLE',
							'KICK',
							'BAN',
							'TIMEOUT',
							'SEND_DM'
						)
						.required(),
					parameters: Joi.object().required(),
				})
			)
			.min(1)
			.max(5)
			.required(),
		cooldown: Joi.number().min(0).max(86400).optional(),
		maxTriggers: Joi.number().min(1).max(1000).optional(),
	}),

	// Applications
	applicationForm: Joi.object({
		name: Joi.string().max(100).required(),
		description: Joi.string().max(500).optional(),
		questions: Joi.array()
			.items(
				Joi.object({
					id: Joi.string().required(),
					type: Joi.string()
						.valid(
							'TEXT',
							'TEXTAREA',
							'SELECT',
							'MULTISELECT',
							'CHECKBOX',
							'RADIO'
						)
						.required(),
					question: Joi.string().max(200).required(),
					required: Joi.boolean().default(false),
					options: Joi.array()
						.items(Joi.string().max(100))
						.when('type', {
							is: Joi.string().valid('SELECT', 'MULTISELECT', 'RADIO'),
							then: Joi.required(),
							otherwise: Joi.optional(),
						}),
					minLength: Joi.number()
						.min(1)
						.when('type', {
							is: Joi.string().valid('TEXT', 'TEXTAREA'),
							then: Joi.optional(),
							otherwise: Joi.forbidden(),
						}),
					maxLength: Joi.number()
						.min(Joi.ref('minLength'))
						.when('type', {
							is: Joi.string().valid('TEXT', 'TEXTAREA'),
							then: Joi.optional(),
							otherwise: Joi.forbidden(),
						}),
				})
			)
			.min(1)
			.max(20)
			.required(),
		autoRole: Joi.string()
			.pattern(/^\d{17,19}$/)
			.optional(),
		reviewChannel: Joi.string()
			.pattern(/^\d{17,19}$/)
			.optional(),
		enabled: Joi.boolean().default(true),
	}),
};

// Validation middleware factory
export const validate = (
	schema: Joi.ObjectSchema,
	source: 'body' | 'params' | 'query' = 'body'
) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const data = req[source];
		const { error, value } = schema.validate(data, {
			abortEarly: false,
			stripUnknown: true,
			convert: true,
		});

		if (error) {
			const validationErrors = error.details.map((detail) => ({
				field: detail.path.join('.'),
				message: detail.message,
			}));

			return res.status(400).json({
				success: false,
				error: 'Validation failed',
				details: validationErrors,
			} as ApiResponse);
		}

		// Replace the original data with validated and sanitized data.
		// Some request objects (e.g., from `router`) expose req.query/params as
		// getters without a setter, so assigning a new object throws.
		// Instead, mutate the target object in place.

		if (source === 'query' || source === 'params') {
			Object.keys(req[source] as any).forEach(
				(k) => delete (req as any)[source][k]
			);
			Object.assign(req[source], value);
		} else {
			(req as any)[source] = value;
		}

		next();
	};
};

// Specific validation middleware
export const validateGuildId = validate(
	Joi.object({ guildId: schemas.guildId }),
	'params'
);
export const validateUserId = validate(
	Joi.object({
		userId: schemas.userId,
	}),
	'params'
);
export const validatePagination = validate(schemas.pagination, 'query');

// Feature-specific validators
export const validateModerationCase = validate(schemas.moderationCase);
export const validateTicket = validate(schemas.ticket);
export const validateTicketSettings = validate(schemas.ticketSettings);
export const validateWelcomeSettings = validate(schemas.welcomeSettings);
export const validateCustomCommand = validate(schemas.customCommand);
export const validateLevelingSettings = validate(schemas.levelingSettings);
export const validateReactionRole = validate(schemas.reactionRole);
export const validateAppeal = validate(schemas.appeal);
export const validateReminder = validate(schemas.reminder);
export const validateAutomationRule = validate(schemas.automationRule);
export const validateApplicationForm = validate(schemas.applicationForm);

// Webhook validation schema
const webhookSchema = Joi.object({
	name: Joi.string().min(1).max(50).required(),
	url: Joi.string().uri().required(),
	channelId: Joi.string()
		.pattern(/^\d{17,19}$/)
		.required(),
	type: Joi.string().valid('INCOMING', 'OUTGOING').required(),
	events: Joi.array().items(Joi.string()).min(1).max(20).required(),
	secret: Joi.string().max(100).optional().allow(null),
	enabled: Joi.boolean().default(true),
	settings: Joi.object({
		retryAttempts: Joi.number().min(0).max(5).default(3),
		timeout: Joi.number().min(1000).max(30000).default(5000),
		rateLimit: Joi.number().min(1).max(100).default(10),
		customHeaders: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
	}).optional(),
});

export const validateWebhook = validate(webhookSchema);

// Guild access validation – ensures the authenticated user is a member of the guild
export const validateGuildAccess = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const { guildId } = req.params;
		const user = req.user;

		if (!user) {
			return res.status(401).json({
				success: false,
				error: 'Authentication required',
			} as ApiResponse);
		}

		// Attempt to fetch the guild member; if not found the API will throw / 404
		try {
			await discordApi.getGuildMember(guildId, user.id);
		} catch (err) {
			return res.status(403).json({
				success: false,
				error: 'You do not have access to this guild',
			} as ApiResponse);
		}

		next();
	} catch {
		return res.status(500).json({
			success: false,
			error: 'Failed to validate guild access',
		} as ApiResponse);
	}
};

// Music action validation
export const validateMusicAction = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const schema = Joi.object({
		query: Joi.string().min(1).max(200).when('action', {
			is: 'play',
			then: Joi.required(),
			otherwise: Joi.optional(),
		}),
		platform: Joi.string().valid('youtube', 'spotify', 'soundcloud').optional(),
		volume: Joi.number().min(0).max(100).optional(),
		mode: Joi.string().valid('off', 'track', 'queue').optional(),
		position: Joi.number().min(0).optional(),
	});

	const { error } = schema.validate(req.body);
	if (error) {
		return res.status(400).json({
			success: false,
			error: 'Invalid music action data',
			details: error.details.map((err) => err.message),
		} as ApiResponse);
	}

	next();
};

// Logging settings validation
export const validateLoggingSettings = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const schema = Joi.object({
		enabled: Joi.boolean().optional(),
		channels: Joi.object({
			moderation: Joi.string()
				.pattern(/^\d{17,19}$/)
				.allow(null)
				.optional(),
			member: Joi.string()
				.pattern(/^\d{17,19}$/)
				.allow(null)
				.optional(),
			message: Joi.string()
				.pattern(/^\d{17,19}$/)
				.allow(null)
				.optional(),
			voice: Joi.string()
				.pattern(/^\d{17,19}$/)
				.allow(null)
				.optional(),
			role: Joi.string()
				.pattern(/^\d{17,19}$/)
				.allow(null)
				.optional(),
			channel: Joi.string()
				.pattern(/^\d{17,19}$/)
				.allow(null)
				.optional(),
			server: Joi.string()
				.pattern(/^\d{17,19}$/)
				.allow(null)
				.optional(),
			music: Joi.string()
				.pattern(/^\d{17,19}$/)
				.allow(null)
				.optional(),
		}).optional(),
		events: Joi.object().pattern(Joi.string(), Joi.boolean()).optional(),
		ignoredChannels: Joi.array()
			.items(Joi.string().pattern(/^\d{17,19}$/))
			.optional(),
		ignoredRoles: Joi.array()
			.items(Joi.string().pattern(/^\d{17,19}$/))
			.optional(),
		ignoredUsers: Joi.array()
			.items(Joi.string().pattern(/^\d{17,19}$/))
			.optional(),
	});

	const { error } = schema.validate(req.body);
	if (error) {
		return res.status(400).json({
			success: false,
			error: 'Invalid logging settings data',
			details: error.details.map((err) => err.message),
		} as ApiResponse);
	}

	next();
};
