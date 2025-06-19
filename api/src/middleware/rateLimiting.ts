import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Extend Request interface to include user property from authentication middleware
interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		[key: string]: any;
	};
}

// Rate limit configurations for different features
const rateLimitConfigs = {
	// General API rate limiting
	general: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100,
		message: {
			success: false,
			error: 'Too many requests, please try again later.',
		},
	},

	// Authentication endpoints
	auth: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 5,
		message: {
			success: false,
			error: 'Too many authentication attempts, please try again later.',
		},
	},

	// Moderation actions (more restrictive)
	moderation: {
		windowMs: 5 * 60 * 1000, // 5 minutes
		max: 20,
		message: {
			success: false,
			error: 'Too many moderation actions, please slow down.',
		},
	},

	// Message sending
	messages: {
		windowMs: 1 * 60 * 1000, // 1 minute
		max: 10,
		message: {
			success: false,
			error: 'Too many messages sent, please wait before sending more.',
		},
	},

	// Configuration changes
	config: {
		windowMs: 10 * 60 * 1000, // 10 minutes
		max: 30,
		message: {
			success: false,
			error: 'Too many configuration changes, please slow down.',
		},
	},

	// Analytics and data fetching
	analytics: {
		windowMs: 5 * 60 * 1000, // 5 minutes
		max: 50,
		message: {
			success: false,
			error: 'Too many analytics requests, please try again later.',
		},
	},

	// Webhook operations
	webhooks: {
		windowMs: 10 * 60 * 1000, // 10 minutes
		max: 15,
		message: {
			success: false,
			error: 'Too many webhook operations, please try again later.',
		},
	},

	// Appeals and applications
	appeals: {
		windowMs: 60 * 60 * 1000, // 1 hour
		max: 3,
		message: {
			success: false,
			error:
				'Too many appeals submitted, please wait before submitting another.',
		},
	},

	// Automation rules
	automation: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 10,
		message: {
			success: false,
			error: 'Too many automation rule changes, please slow down.',
		},
	},
};

// Create rate limiter with user-specific keys
const createRateLimiter = (config: typeof rateLimitConfigs.general) => {
	return rateLimit({
		...config,
		keyGenerator: (req: any): string => {
			// Use user ID if authenticated, otherwise IP
			return req.user?.id || req.ip || 'unknown';
		},
		standardHeaders: true,
		legacyHeaders: false,
	}) as unknown as RequestHandler;
};

// Export specific rate limiters
export const generalRateLimit = createRateLimiter(rateLimitConfigs.general);
export const authRateLimit = createRateLimiter(rateLimitConfigs.auth);
export const moderationRateLimit = createRateLimiter(
	rateLimitConfigs.moderation
);
export const messageRateLimit = createRateLimiter(rateLimitConfigs.messages);
export const configRateLimit = createRateLimiter(rateLimitConfigs.config);
export const analyticsRateLimit = createRateLimiter(rateLimitConfigs.analytics);
export const webhookRateLimit = createRateLimiter(rateLimitConfigs.webhooks);
export const appealRateLimit = createRateLimiter(rateLimitConfigs.appeals);
export const automationRateLimit = createRateLimiter(
	rateLimitConfigs.automation
);

// Guild-specific rate limiting
export const createGuildRateLimit = (
	maxPerGuild: number,
	windowMs: number = 15 * 60 * 1000
) => {
	return rateLimit({
		windowMs,
		max: maxPerGuild,
		keyGenerator: (req: any): string => {
			const guildId = req.params?.guildId;
			const userId = req.user?.id || req.ip || 'unknown';
			return `${guildId}:${userId}`;
		},
		message: {
			success: false,
			error: 'Too many requests for this server, please try again later.',
		},
		standardHeaders: true,
		legacyHeaders: false,
	}) as unknown as RequestHandler;
};

// Feature-specific guild rate limits
export const guildModerationRateLimit = createGuildRateLimit(
	50,
	10 * 60 * 1000
); // 50 per 10 minutes per guild
export const guildConfigRateLimit = createGuildRateLimit(20, 15 * 60 * 1000); // 20 per 15 minutes per guild
export const guildAnalyticsRateLimit = createGuildRateLimit(100, 5 * 60 * 1000); // 100 per 5 minutes per guild

// Additional feature-specific rate limiters
export const musicRateLimit = createRateLimiter({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 30,
	message: {
		success: false,
		error: 'Too many music requests, please slow down.',
	},
});

export const loggingRateLimit = createRateLimiter({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 40,
	message: {
		success: false,
		error: 'Too many logging requests, please try again later.',
	},
});

export const starboardRateLimit = createRateLimiter({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 25,
	message: {
		success: false,
		error: 'Too many starboard requests, please slow down.',
	},
});

export const customCommandsRateLimit = createRateLimiter({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 30,
	message: {
		success: false,
		error: 'Too many custom command requests, please slow down.',
	},
});

export const levelingRateLimit = createRateLimiter({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 20,
	message: {
		success: false,
		error: 'Too many leveling requests, please slow down.',
	},
});

export const webhooksRateLimit = createRateLimiter({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 25,
	message: {
		success: false,
		error: 'Too many webhook requests, please slow down.',
	},
});

// Additional guild-specific rate limits
export const guildMusicRateLimit = createGuildRateLimit(80, 1 * 60 * 1000); // 80 per minute per guild
export const guildLoggingRateLimit = createGuildRateLimit(120, 5 * 60 * 1000); // 120 per 5 minutes per guild
export const guildStarboardRateLimit = createGuildRateLimit(60, 5 * 60 * 1000); // 60 per 5 minutes per guild
export const guildWebhookRateLimit = createGuildRateLimit(50, 10 * 60 * 1000); // 50 per 10 minutes per guild
export const guildCustomCommandsRateLimit = createGuildRateLimit(
	100,
	1 * 60 * 1000
); // 100 per minute per guild
export const guildLevelingRateLimit = createGuildRateLimit(150, 1 * 60 * 1000); // 150 per minute per guild
export const guildWebhooksRateLimit = createGuildRateLimit(80, 1 * 60 * 1000); // 80 per minute per guild

// Reaction roles rate limiting
export const reactionRolesRateLimit = createRateLimiter({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 20,
	message: {
		success: false,
		error: 'Too many reaction role requests, please slow down.',
	},
});

export const guildReactionRolesRateLimit = createGuildRateLimit(
	60,
	5 * 60 * 1000
); // 60 per 5 minutes per guild

// Tickets rate limiting
export const ticketsRateLimit = createRateLimiter({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 15,
	message: {
		success: false,
		error: 'Too many ticket requests, please slow down.',
	},
});

export const guildTicketsRateLimit = createGuildRateLimit(100, 10 * 60 * 1000); // 100 per 10 minutes per guild

// Applications rate limiting
export const applicationsRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 20, // limit each IP to 20 requests per windowMs
	message: {
		success: false,
		error: 'Too many application requests, please try again later.',
	},
	standardHeaders: true,
	legacyHeaders: false,
});

// Entertainment rate limiting
export const entertainmentRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 50, // limit each IP to 50 requests per windowMs
	message: {
		success: false,
		error: 'Too many entertainment requests, please try again later.',
	},
	standardHeaders: true,
	legacyHeaders: false,
});
