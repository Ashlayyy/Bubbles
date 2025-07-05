import { Request, Response } from 'express';
import { createLogger } from '../types/shared.js';
import { wsManager } from '../websocket/manager.js';
import crypto from 'crypto';

const logger = createLogger('discord-webhooks');

export interface DiscordWebhookEvent {
	id: string;
	type: string;
	guildId?: string;
	shardId?: number;
	timestamp: number;
	data: any;
	botId: string;
}

export interface DiscordEventData {
	// Guild Events
	guildCreate?: {
		id: string;
		name: string;
		icon?: string;
		memberCount: number;
		ownerId: string;
		features: string[];
		premiumTier: number;
	};
	guildDelete?: {
		id: string;
		name: string;
		unavailable?: boolean;
	};
	guildUpdate?: {
		id: string;
		name: string;
		changes: Record<string, { old: any; new: any }>;
	};

	// Member Events
	guildMemberAdd?: {
		userId: string;
		username: string;
		discriminator: string;
		avatar?: string;
		joinedAt: string;
		roles: string[];
		guildId: string;
	};
	guildMemberRemove?: {
		userId: string;
		username: string;
		discriminator: string;
		avatar?: string;
		guildId: string;
	};
	guildMemberUpdate?: {
		userId: string;
		guildId: string;
		changes: {
			nickname?: { old?: string; new?: string };
			roles?: { added: string[]; removed: string[] };
			avatar?: { old?: string; new?: string };
		};
	};

	// Message Events
	messageCreate?: {
		id: string;
		content: string;
		authorId: string;
		channelId: string;
		guildId?: string;
		attachments: Array<{
			id: string;
			filename: string;
			size: number;
			url: string;
			contentType?: string;
		}>;
		embeds: any[];
		mentions: {
			users: string[];
			roles: string[];
			channels: string[];
		};
		reactions: Array<{
			emoji: { id?: string; name: string };
			count: number;
			me: boolean;
		}>;
		timestamp: string;
	};
	messageDelete?: {
		id: string;
		channelId: string;
		guildId?: string;
		authorId?: string;
	};
	messageUpdate?: {
		id: string;
		channelId: string;
		guildId?: string;
		content?: string;
		editedTimestamp: string;
		changes: Record<string, { old: any; new: any }>;
	};

	// Channel Events
	channelCreate?: {
		id: string;
		name: string;
		type: number;
		guildId?: string;
		parentId?: string;
		position?: number;
		topic?: string;
		nsfw?: boolean;
	};
	channelDelete?: {
		id: string;
		name: string;
		type: number;
		guildId?: string;
	};
	channelUpdate?: {
		id: string;
		guildId?: string;
		changes: Record<string, { old: any; new: any }>;
	};

	// Role Events
	roleCreate?: {
		id: string;
		name: string;
		color: number;
		permissions: string;
		position: number;
		guildId: string;
		mentionable: boolean;
		hoist: boolean;
	};
	roleDelete?: {
		id: string;
		name: string;
		guildId: string;
	};
	roleUpdate?: {
		id: string;
		guildId: string;
		changes: Record<string, { old: any; new: any }>;
	};

	// Voice Events
	voiceStateUpdate?: {
		userId: string;
		guildId?: string;
		channelId?: string;
		oldChannelId?: string;
		deaf: boolean;
		mute: boolean;
		selfDeaf: boolean;
		selfMute: boolean;
		streaming: boolean;
		suppress: boolean;
	};

	// Moderation Events
	guildBanAdd?: {
		userId: string;
		guildId: string;
		reason?: string;
		executorId?: string;
	};
	guildBanRemove?: {
		userId: string;
		guildId: string;
		executorId?: string;
	};

	// Interaction Events
	interactionCreate?: {
		id: string;
		type: number;
		commandName?: string;
		userId: string;
		channelId: string;
		guildId?: string;
		options?: any[];
		customId?: string;
		componentType?: number;
	};

	// Reaction Events
	messageReactionAdd?: {
		messageId: string;
		channelId: string;
		guildId?: string;
		userId: string;
		emoji: {
			id?: string;
			name: string;
		};
	};
	messageReactionRemove?: {
		messageId: string;
		channelId: string;
		guildId?: string;
		userId: string;
		emoji: {
			id?: string;
			name: string;
		};
	};

	// Presence Events
	presenceUpdate?: {
		userId: string;
		guildId: string;
		status: string;
		activities: Array<{
			name: string;
			type: number;
			url?: string;
		}>;
	};

	// Auto Moderation Events
	autoModerationActionExecution?: {
		guildId: string;
		action: {
			type: number;
			metadata?: any;
		};
		ruleId: string;
		ruleTriggerType: number;
		userId: string;
		channelId?: string;
		messageId?: string;
		alertSystemMessageId?: string;
		content?: string;
		matchedKeyword?: string;
		matchedContent?: string;
	};

	// Thread Events
	threadCreate?: {
		id: string;
		name: string;
		parentId: string;
		guildId: string;
		ownerId: string;
		type: number;
		messageCount: number;
		memberCount: number;
	};
	threadDelete?: {
		id: string;
		parentId: string;
		guildId: string;
	};

	// Invite Events
	inviteCreate?: {
		code: string;
		guildId: string;
		channelId: string;
		inviterId?: string;
		maxAge: number;
		maxUses: number;
		temporary: boolean;
	};
	inviteDelete?: {
		code: string;
		guildId: string;
		channelId: string;
	};

	// Emoji Events
	emojiCreate?: {
		id: string;
		name: string;
		guildId: string;
		animated: boolean;
		managed: boolean;
		requireColons: boolean;
	};
	emojiDelete?: {
		id: string;
		name: string;
		guildId: string;
	};

	// Sticker Events
	stickerCreate?: {
		id: string;
		name: string;
		guildId: string;
		description?: string;
		tags: string;
		formatType: number;
	};
	stickerDelete?: {
		id: string;
		name: string;
		guildId: string;
	};
}

export class DiscordWebhookHandler {
	private webhookSecret: string;

	constructor(webhookSecret: string) {
		this.webhookSecret = webhookSecret;
	}

	public async handleWebhook(req: Request, res: Response): Promise<void> {
		try {
			// Verify webhook authenticity
			if (!this.verifyWebhookSignature(req)) {
				logger.warn('Invalid Discord webhook signature');
				res.status(401).json({ error: 'Invalid signature' });
				return;
			}

			const { eventType, guildId, shardId, botId, data } = req.body;
			const eventId = this.generateEventId();

			logger.info(
				`Received Discord webhook: ${eventType} from shard ${shardId} for guild ${guildId}`
			);

			// Create processed event
			const event: DiscordWebhookEvent = {
				id: eventId,
				type: eventType,
				guildId,
				shardId,
				timestamp: Date.now(),
				data,
				botId,
			};

			// Process the event based on type
			await this.processDiscordEvent(event);

			// Broadcast to WebSocket clients
			this.broadcastDiscordEvent(event);

			// Store event for analytics/history
			await this.storeDiscordEvent(event);

			res.status(200).json({
				success: true,
				eventId,
				processed: true,
			});
		} catch (error) {
			logger.error('Error handling Discord webhook:', error);
			res.status(500).json({ error: 'Internal server error' });
		}
	}

	private verifyWebhookSignature(req: Request): boolean {
		const signature = req.headers['x-discord-signature'] as string;
		if (!signature) {
			return false;
		}

		const expectedSignature = crypto
			.createHmac('sha256', this.webhookSecret)
			.update(JSON.stringify(req.body))
			.digest('hex');

		const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;

		return crypto.timingSafeEqual(
			Buffer.from(signature),
			Buffer.from(expectedSignatureWithPrefix)
		);
	}

	private async processDiscordEvent(event: DiscordWebhookEvent): Promise<void> {
		switch (event.type) {
			case 'guildCreate':
				await this.handleGuildCreate(event);
				break;
			case 'guildDelete':
				await this.handleGuildDelete(event);
				break;
			case 'guildMemberAdd':
				await this.handleGuildMemberAdd(event);
				break;
			case 'guildMemberRemove':
				await this.handleGuildMemberRemove(event);
				break;
			case 'messageCreate':
				await this.handleMessageCreate(event);
				break;
			case 'messageDelete':
				await this.handleMessageDelete(event);
				break;
			case 'guildBanAdd':
				await this.handleGuildBanAdd(event);
				break;
			case 'guildBanRemove':
				await this.handleGuildBanRemove(event);
				break;
			case 'voiceStateUpdate':
				await this.handleVoiceStateUpdate(event);
				break;
			case 'interactionCreate':
				await this.handleInteractionCreate(event);
				break;
			case 'autoModerationActionExecution':
				await this.handleAutoModerationAction(event);
				break;
			default:
				logger.info(`Unhandled Discord event type: ${event.type}`);
		}
	}

	private async handleGuildCreate(event: DiscordWebhookEvent): Promise<void> {
		logger.info(`Bot joined guild: ${event.data.name} (${event.guildId})`);
		// TODO: Initialize guild settings, create database entries, etc.
	}

	private async handleGuildDelete(event: DiscordWebhookEvent): Promise<void> {
		logger.info(`Bot left guild: ${event.guildId}`);
		// TODO: Cleanup guild data, notify admins, etc.
	}

	private async handleGuildMemberAdd(
		event: DiscordWebhookEvent
	): Promise<void> {
		logger.info(
			`Member joined: ${event.data.username} in guild ${event.guildId}`
		);
		// TODO: Handle welcome messages, auto-roles, etc.
	}

	private async handleGuildMemberRemove(
		event: DiscordWebhookEvent
	): Promise<void> {
		logger.info(
			`Member left: ${event.data.username} from guild ${event.guildId}`
		);
		// TODO: Handle goodbye messages, cleanup user data, etc.
	}

	private async handleMessageCreate(event: DiscordWebhookEvent): Promise<void> {
		// TODO: Handle message logging, auto-moderation, analytics, etc.
		if (event.data.content && event.data.content.length > 0) {
			logger.debug(
				`Message created in ${event.guildId}: ${event.data.content.substring(
					0,
					50
				)}...`
			);
		}
	}

	private async handleMessageDelete(event: DiscordWebhookEvent): Promise<void> {
		logger.debug(`Message deleted: ${event.data.id} in guild ${event.guildId}`);
		// TODO: Handle message delete logging, moderation tracking, etc.
	}

	private async handleGuildBanAdd(event: DiscordWebhookEvent): Promise<void> {
		logger.info(`User banned: ${event.data.userId} in guild ${event.guildId}`);
		// TODO: Log moderation action, update ban database, etc.
	}

	private async handleGuildBanRemove(
		event: DiscordWebhookEvent
	): Promise<void> {
		logger.info(
			`User unbanned: ${event.data.userId} in guild ${event.guildId}`
		);
		// TODO: Log moderation action, update ban database, etc.
	}

	private async handleVoiceStateUpdate(
		event: DiscordWebhookEvent
	): Promise<void> {
		// TODO: Handle voice channel logging, music bot integration, etc.
		if (event.data.channelId !== event.data.oldChannelId) {
			logger.debug(
				`Voice state update: ${event.data.userId} moved channels in ${event.guildId}`
			);
		}
	}

	private async handleInteractionCreate(
		event: DiscordWebhookEvent
	): Promise<void> {
		logger.debug(
			`Interaction created: ${
				event.data.commandName || event.data.customId
			} in guild ${event.guildId}`
		);
		// TODO: Log command usage, analytics, etc.
	}

	private async handleAutoModerationAction(
		event: DiscordWebhookEvent
	): Promise<void> {
		logger.info(
			`Auto-moderation action executed in guild ${event.guildId}: ${event.data.action.type}`
		);
		// TODO: Log auto-mod actions, update moderation statistics, etc.
	}

	private broadcastDiscordEvent(event: DiscordWebhookEvent): void {
		// Broadcast to guild-specific connections
		if (event.guildId) {
			wsManager.broadcastToGuild(event.guildId, {
				type: 'DISCORD_EVENT',
				event: event.type,
				data: event,
				guildId: event.guildId,
				shardId: event.shardId,
				timestamp: Date.now(),
				messageId: `discord_${event.id}`,
			});
		}

		// Broadcast to shard-specific connections
		if (event.shardId !== undefined) {
			wsManager.broadcastToShard(event.shardId, {
				type: 'DISCORD_EVENT',
				event: event.type,
				data: event,
				guildId: event.guildId,
				shardId: event.shardId,
				timestamp: Date.now(),
				messageId: `discord_${event.id}`,
			});
		}

		// Broadcast to all clients subscribed to Discord events
		wsManager.broadcastToAll(
			{
				type: 'DISCORD_EVENT',
				event: event.type,
				data: event,
				guildId: event.guildId,
				shardId: event.shardId,
				timestamp: Date.now(),
				messageId: `discord_${event.id}`,
			},
			(connection) => {
				// Only send to clients subscribed to Discord events
				return (
					connection.metadata.subscriptions?.includes('DISCORD_EVENTS') ||
					connection.metadata.subscriptions?.includes(
						`DISCORD_${event.type.toUpperCase()}`
					) ||
					(event.guildId && connection.guildId === event.guildId)
				);
			}
		);

		logger.debug(
			`Broadcasted Discord ${event.type} event to WebSocket clients`
		);
	}

	private async storeDiscordEvent(event: DiscordWebhookEvent): Promise<void> {
		try {
			const { eventStore } = await import('../services/eventStore.js');
			await eventStore.saveDiscordEvent({
				type: event.type,
				guildId: event.guildId,
				userId: (event.data as any)?.userId,
				channelId: (event.data as any)?.channelId,
				messageId: (event.data as any)?.id,
				payload: event.data,
				metadata: { botId: event.botId, shardId: event.shardId },
			});
		} catch (error) {
			logger.warn('Failed to persist discord event', error);
		}

		logger.debug(`Stored Discord event: ${event.type} - ${event.id}`);
	}

	public async sendBotCommand(guildId: string, command: any): Promise<boolean> {
		// Send command to bot via WebSocket
		const message = {
			type: 'BOT_COMMAND',
			event: 'EXECUTE_COMMAND',
			data: command,
			guildId,
			timestamp: Date.now(),
			messageId: this.generateEventId(),
		};

		// Find bot connections for this guild
		const sent = wsManager.broadcastToAll(message, (connection) => {
			return (
				connection.type === 'BOT' &&
				(connection.guildId === guildId || !connection.guildId)
			);
		});

		return true; // TODO: Track if message was actually sent
	}

	public getEventHistory(
		guildId?: string,
		eventType?: string,
		limit: number = 50
	): DiscordWebhookEvent[] {
		// TODO: Implement event history retrieval from storage
		return [];
	}

	public getEventStats(guildId?: string): any {
		// TODO: Implement event statistics
		return {
			totalEvents: 0,
			eventsByType: {},
			recentEvents: [],
			guilds: guildId ? [guildId] : [],
		};
	}

	public getShardStatus(): any {
		// Get shard information from connected bot instances
		const shardInfo: Record<number, any> = {};

		wsManager.broadcastToAll(
			{
				type: 'BOT_QUERY',
				event: 'SHARD_STATUS',
				data: {},
				timestamp: Date.now(),
				messageId: this.generateEventId(),
			},
			(connection) => connection.type === 'BOT'
		);

		// TODO: Collect responses and return shard status
		return {
			totalShards: 0,
			connectedShards: 0,
			shardInfo,
		};
	}

	private generateEventId(): string {
		return `discord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}

// Create singleton instance
export const discordWebhookHandler = new DiscordWebhookHandler(
	process.env.DISCORD_WEBHOOK_SECRET || 'default-discord-secret'
);
