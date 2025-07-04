import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/shared.js';
import type { AuthRequest } from './auth.js';
import { discordApi } from '../services/discordApiService.js';
import { createLogger } from '../types/shared.js';

// Discord permission flags
export const DiscordPermissions = {
	CREATE_INSTANT_INVITE: '1',
	KICK_MEMBERS: '2',
	BAN_MEMBERS: '4',
	ADMINISTRATOR: '8',
	MANAGE_CHANNELS: '16',
	MANAGE_GUILD: '32',
	ADD_REACTIONS: '64',
	VIEW_AUDIT_LOG: '128',
	PRIORITY_SPEAKER: '256',
	STREAM: '512',
	VIEW_CHANNEL: '1024',
	SEND_MESSAGES: '2048',
	SEND_TTS_MESSAGES: '4096',
	MANAGE_MESSAGES: '8192',
	EMBED_LINKS: '16384',
	ATTACH_FILES: '32768',
	READ_MESSAGE_HISTORY: '65536',
	MENTION_EVERYONE: '131072',
	USE_EXTERNAL_EMOJIS: '262144',
	VIEW_GUILD_INSIGHTS: '524288',
	CONNECT: '1048576',
	SPEAK: '2097152',
	MUTE_MEMBERS: '4194304',
	DEAFEN_MEMBERS: '8388608',
	MOVE_MEMBERS: '16777216',
	USE_VAD: '33554432',
	CHANGE_NICKNAME: '67108864',
	MANAGE_NICKNAMES: '134217728',
	MANAGE_ROLES: '268435456',
	MANAGE_WEBHOOKS: '536870912',
	MANAGE_EMOJIS_AND_STICKERS: '1073741824',
	USE_APPLICATION_COMMANDS: '2147483648',
	REQUEST_TO_SPEAK: '4294967296',
	MANAGE_EVENTS: '8589934592',
	MANAGE_THREADS: '17179869184',
	CREATE_PUBLIC_THREADS: '34359738368',
	CREATE_PRIVATE_THREADS: '68719476736',
	USE_EXTERNAL_STICKERS: '137438953472',
	SEND_MESSAGES_IN_THREADS: '274877906944',
	USE_EMBEDDED_ACTIVITIES: '549755813888',
	MODERATE_MEMBERS: '1099511627776',
} as const;

// Permission requirements for different features
const featurePermissions = {
	// Moderation features
	moderation: {
		ban: [DiscordPermissions.BAN_MEMBERS],
		kick: [DiscordPermissions.KICK_MEMBERS],
		timeout: [DiscordPermissions.MODERATE_MEMBERS],
		manageMessages: [DiscordPermissions.MANAGE_MESSAGES],
		viewAuditLog: [DiscordPermissions.VIEW_AUDIT_LOG],
	},

	// Channel management
	channels: {
		manage: [DiscordPermissions.MANAGE_CHANNELS],
		view: [DiscordPermissions.VIEW_CHANNEL],
		sendMessages: [DiscordPermissions.SEND_MESSAGES],
	},

	// Role management
	roles: {
		manage: [DiscordPermissions.MANAGE_ROLES],
		view: [DiscordPermissions.VIEW_CHANNEL],
	},

	// Guild management
	guild: {
		manage: [DiscordPermissions.MANAGE_GUILD],
		administrator: [DiscordPermissions.ADMINISTRATOR],
		viewInsights: [DiscordPermissions.VIEW_GUILD_INSIGHTS],
	},

	// Webhook management
	webhooks: {
		manage: [DiscordPermissions.MANAGE_WEBHOOKS],
	},

	// Thread management
	threads: {
		manage: [DiscordPermissions.MANAGE_THREADS],
		create: [
			DiscordPermissions.CREATE_PUBLIC_THREADS,
			DiscordPermissions.CREATE_PRIVATE_THREADS,
		],
	},

	// Events
	events: {
		manage: [DiscordPermissions.MANAGE_EVENTS],
	},
} as const;

// Permission checking utility
const hasPermission = (
	userPermissions: string,
	requiredPermissions: string[]
): boolean => {
	const userPerms = BigInt(userPermissions);

	// Administrator has all permissions
	if ((userPerms & BigInt(DiscordPermissions.ADMINISTRATOR)) !== 0n) {
		return true;
	}

	// Check if user has any of the required permissions
	return requiredPermissions.some((perm) => {
		const permBigInt = BigInt(perm);
		return (userPerms & permBigInt) !== 0n;
	});
};

// -----------------------------------------------------------------------------
// SIMPLE IN-MEMORY CACHE (TTL-BASED)
// -----------------------------------------------------------------------------
interface CacheEntry<T> {
	value: T;
	expires: number; // epoch ms
}

const USER_PERMS_TTL = 60 * 1000; // 1 minute
const GUILD_ROLES_TTL = 5 * 60 * 1000; // 5 minutes

const userPermsCache: Map<string, CacheEntry<string>> = new Map();
const guildRolesCache: Map<string, CacheEntry<any[]>> = new Map();

// Map to track in-flight permission fetches to avoid duplicate Discord API requests
const userPermsInFlight: Map<string, Promise<string>> = new Map();

const permLogger = createLogger('permissions');

// Helper to get effective permission bitfield for a user in a guild
async function getUserGuildPermissions(
	guildId: string,
	userId: string
): Promise<string> {
	const cacheKey = `${guildId}:${userId}`;

	// 1) Serve from cache if still valid
	const cached = userPermsCache.get(cacheKey);
	if (cached && cached.expires > Date.now()) {
		return cached.value;
	}

	// 2) If another request is already fetching, wait for it instead of hitting Discord again
	const inFlight = userPermsInFlight.get(cacheKey);
	if (inFlight) {
		return inFlight;
	}

	// 3) Create the fetch promise and store in the map to deduplicate
	const fetchPromise = (async () => {
		try {
			// Fetch & cache guild roles (shared across users)
			let roles: any[] | undefined;
			const guildRolesCached = guildRolesCache.get(guildId);
			if (guildRolesCached && guildRolesCached.expires > Date.now()) {
				roles = guildRolesCached.value;
			} else {
				roles = await discordApi.getGuildRoles(guildId);
				guildRolesCache.set(guildId, {
					value: roles,
					expires: Date.now() + GUILD_ROLES_TTL,
				});
			}

			// Fetch member
			const member = await discordApi.getGuildMember(guildId, userId);

			const roleMap = new Map<string, string>();
			roles.forEach((r: any) => roleMap.set(r.id, r.permissions));

			let permissions = BigInt(0);

			// @everyone role – id == guildId in Discord
			const everyoneRole = roles.find((r: any) => r.id === guildId);
			if (everyoneRole) permissions |= BigInt(everyoneRole.permissions);

			// Aggregate role permissions
			(member.roles || []).forEach((roleId: string) => {
				const perms = roleMap.get(roleId);
				if (perms) permissions |= BigInt(perms);
			});

			const bitfield = permissions.toString();
			userPermsCache.set(cacheKey, {
				value: bitfield,
				expires: Date.now() + USER_PERMS_TTL,
			});

			return bitfield;
		} catch {
			return '0'; // fallback – no permissions
		} finally {
			// Clean up the in-flight entry regardless of outcome
			userPermsInFlight.delete(cacheKey);
		}
	})();

	userPermsInFlight.set(cacheKey, fetchPromise);
	return fetchPromise;
}

// Middleware factory for permission checking
export const requirePermissions = (permissions: string[]) => {
	return async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const user = req.user;
			const { guildId } = req.params;

			if (!user) {
				return res.status(401).json({
					success: false,
					error: 'Authentication required',
				} as ApiResponse);
			}

			// Fetch user's permissions in the guild
			const userGuildPermissions = await getUserGuildPermissions(
				guildId,
				user.id
			);

			permLogger.debug('[PERM-CHECK]', {
				route: req.originalUrl,
				userId: user.id,
				guildId,
				required: permissions,
				userPerms: userGuildPermissions,
			});

			if (!hasPermission(userGuildPermissions, permissions)) {
				return res.status(403).json({
					success: false,
					error: 'Insufficient permissions for this action',
					details: {
						required: permissions,
						userPermissions: userGuildPermissions,
					},
				} as ApiResponse);
			}

			next();
		} catch (error) {
			return res.status(500).json({
				success: false,
				error: 'Failed to check permissions',
			} as ApiResponse);
		}
	};
};

// Specific permission middleware
export const requireModerationPermissions = requirePermissions([
	...featurePermissions.moderation.ban,
	...featurePermissions.moderation.kick,
	...featurePermissions.moderation.timeout,
]);

export const requireChannelManagement = requirePermissions([
	...featurePermissions.channels.manage,
]);
export const requireRoleManagement = requirePermissions([
	...featurePermissions.roles.manage,
]);
export const requireGuildManagement = requirePermissions([
	...featurePermissions.guild.manage,
]);
export const requireWebhookManagement = requirePermissions([
	...featurePermissions.webhooks.manage,
]);
export const requireAdministrator = requirePermissions([
	...featurePermissions.guild.administrator,
]);

// Feature-specific permission checks
export const requireFeaturePermission = (
	feature: keyof typeof featurePermissions,
	action: string
) => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		const permissions =
			featurePermissions[feature]?.[
				action as keyof (typeof featurePermissions)[typeof feature]
			];

		if (!permissions) {
			return res.status(500).json({
				success: false,
				error: 'Invalid permission configuration',
			} as ApiResponse);
		}

		return requirePermissions(permissions as string[])(req, res, next);
	};
};

// Guild ownership check
export const requireGuildOwner = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = req.user;
		const { guildId } = req.params;

		if (!user) {
			return res.status(401).json({
				success: false,
				error: 'Authentication required',
			} as ApiResponse);
		}

		const guild = await discordApi.getGuild(guildId);
		if (guild?.owner_id !== user.id) {
			return res.status(403).json({
				success: false,
				error: 'Only the guild owner can perform this action',
			} as ApiResponse);
		}

		next();
	} catch (error) {
		return res.status(500).json({
			success: false,
			error: 'Failed to verify guild ownership',
		} as ApiResponse);
	}
};

// Music permission middleware
export const requireMusicPermissions = requirePermissions([
	DiscordPermissions.CONNECT,
	DiscordPermissions.SPEAK,
]);

// Admin permission middleware
export const requireAdminPermissions = requirePermissions([
	DiscordPermissions.ADMINISTRATOR,
]);

// -----------------------------------------------------------------------------
// UNIVERSAL PERMISSION CHECKER
// -----------------------------------------------------------------------------

type PermissionIdentifier = string;

// Placeholder for a custom permission system (e.g. database-stored). Returns true if
// the user possesses the custom permission in the relevant guild context.
async function hasCustomPermission(
	userId: string,
	permission: string,
	guildId?: string
): Promise<boolean> {
	// TODO: Integrate with real permission storage layer
	return false;
}

export async function checkUniversalPermissions(
	req: AuthRequest,
	required: PermissionIdentifier[]
): Promise<{ success: boolean; missing?: PermissionIdentifier[] }> {
	const { user } = req;
	const guildId = req.params.guildId;

	if (!required || required.length === 0) return { success: true };

	const missing: PermissionIdentifier[] = [];

	// Pre-fetch discord perms if any permission starts with "discord:" to avoid
	// multiple API calls.
	let userGuildPerms: string | null = null;
	if (required.some((p) => p.startsWith('discord:')) && user && guildId) {
		userGuildPerms = await getUserGuildPermissions(guildId, user.id);
	}

	for (const perm of required) {
		if (perm === 'token') {
			if (!user) missing.push('token');
			continue;
		}
		if (perm.startsWith('discord:')) {
			const discordPerm = perm.replace('discord:', '').toUpperCase();
			const flag = DiscordPermissions[discordPerm as keyof typeof DiscordPermissions];
			if (!flag || !userGuildPerms) {
				missing.push(perm);
				continue;
			}
			if (!hasPermission(userGuildPerms, [flag])) missing.push(perm);
			continue;
		}
		if (perm.startsWith('custom:')) {
			const customPerm = perm.replace('custom:', '');
			if (!user || !(await hasCustomPermission(user.id, customPerm, guildId))) {
				missing.push(perm);
			}
			continue;
		}
		// Unknown prefix, treat as custom
		if (!user || !(await hasCustomPermission(user.id, perm, guildId))) {
			missing.push(perm);
		}
	}

	return { success: missing.length === 0, missing };
}

export const requireUniversalPermissions = (
	permissions: PermissionIdentifier[]
) => {
	return async (req: AuthRequest, res: Response, next: NextFunction) => {
		const result = await checkUniversalPermissions(req, permissions);
		if (result.success) return next();
		return res.status(403).json({
			success: false,
			error: 'Insufficient permissions',
			missing: result.missing,
		} as ApiResponse);
	};
};
