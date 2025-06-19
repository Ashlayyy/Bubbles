import { createLogger } from '../types/shared.js';
import { WebSocketManager } from '../websocket/manager.js';

const logger = createLogger('discord-event-forwarder');

export interface DiscordEventData {
	type: string;
	data: any;
	guildId?: string;
	channelId?: string;
	userId?: string;
	shardId?: number;
	timestamp: number;
}

export class DiscordEventForwarder {
	private wsManager: WebSocketManager;
	private eventQueue: DiscordEventData[] = [];
	private processingQueue = false;
	private maxQueueSize = 1000;

	constructor(wsManager: WebSocketManager) {
		this.wsManager = wsManager;
		this.setupEventProcessing();
	}

	// ============================================================================
	// EVENT FORWARDING FROM BOT TO API
	// ============================================================================

	public forwardDiscordEvent(eventData: DiscordEventData): void {
		// Add timestamp if not present
		if (!eventData.timestamp) {
			eventData.timestamp = Date.now();
		}

		// Add to queue for processing
		this.addToQueue(eventData);

		// Immediate broadcast for high-priority events
		if (this.isHighPriorityEvent(eventData.type)) {
			this.processEventImmediate(eventData);
		}
	}

	private addToQueue(eventData: DiscordEventData): void {
		if (this.eventQueue.length >= this.maxQueueSize) {
			// Remove oldest events to prevent memory issues
			this.eventQueue = this.eventQueue.slice(-this.maxQueueSize + 100);
			logger.warn('Event queue size limit reached, removing old events');
		}

		this.eventQueue.push(eventData);

		if (!this.processingQueue) {
			this.processQueue();
		}
	}

	private async processQueue(): Promise<void> {
		if (this.processingQueue) return;
		this.processingQueue = true;

		try {
			while (this.eventQueue.length > 0) {
				const event = this.eventQueue.shift();
				if (event) {
					await this.processEvent(event);
				}
			}
		} catch (error) {
			logger.error('Error processing event queue:', error);
		} finally {
			this.processingQueue = false;
		}
	}

	private async processEvent(eventData: DiscordEventData): Promise<void> {
		try {
			// Forward to WebSocket manager for real-time broadcasting
			this.wsManager.broadcastDiscordEvent(
				eventData.type,
				eventData.data,
				eventData.guildId,
				eventData.userId
			);

			// Handle specific event types with additional processing
			await this.handleSpecificEventType(eventData);

			logger.debug(`Processed Discord event: ${eventData.type}`);
		} catch (error) {
			logger.error(`Error processing event ${eventData.type}:`, error);
		}
	}

	private processEventImmediate(eventData: DiscordEventData): void {
		try {
			this.wsManager.broadcastDiscordEvent(
				eventData.type,
				eventData.data,
				eventData.guildId,
				eventData.userId
			);
		} catch (error) {
			logger.error(
				`Error processing immediate event ${eventData.type}:`,
				error
			);
		}
	}

	private async handleSpecificEventType(
		eventData: DiscordEventData
	): Promise<void> {
		switch (eventData.type) {
			case 'MESSAGE_CREATE':
				await this.handleMessageCreate(eventData);
				break;

			case 'GUILD_MEMBER_ADD':
			case 'GUILD_MEMBER_REMOVE':
				await this.handleMemberChange(eventData);
				break;

			case 'GUILD_ROLE_CREATE':
			case 'GUILD_ROLE_UPDATE':
			case 'GUILD_ROLE_DELETE':
				await this.handleRoleChange(eventData);
				break;

			case 'CHANNEL_CREATE':
			case 'CHANNEL_UPDATE':
			case 'CHANNEL_DELETE':
				await this.handleChannelChange(eventData);
				break;

			case 'VOICE_STATE_UPDATE':
				await this.handleVoiceStateUpdate(eventData);
				break;

			case 'AUTO_MODERATION_ACTION_EXECUTION':
				await this.handleAutoModerationAction(eventData);
				break;

			case 'GUILD_BAN_ADD':
			case 'GUILD_BAN_REMOVE':
				await this.handleModerationAction(eventData);
				break;

			default:
				// Generic event handling
				logger.debug(`Generic event processing for: ${eventData.type}`);
		}
	}

	// ============================================================================
	// SPECIFIC EVENT HANDLERS
	// ============================================================================

	private async handleMessageCreate(
		eventData: DiscordEventData
	): Promise<void> {
		const { data } = eventData;
		const { channel_id, guild_id, author, content } = data;

		// Real-time message analytics
		this.broadcastAnalyticsEvent('MESSAGE_SENT', {
			guildId: guild_id,
			channelId: channel_id,
			userId: author?.id,
			messageLength: content?.length || 0,
			timestamp: eventData.timestamp,
		});

		// Check for spam/moderation patterns
		if (this.detectSpamPattern(data)) {
			this.broadcastModerationAlert('POTENTIAL_SPAM', {
				guildId: guild_id,
				channelId: channel_id,
				userId: author?.id,
				messageData: data,
			});
		}
	}

	private async handleMemberChange(eventData: DiscordEventData): Promise<void> {
		const { data, type } = eventData;
		const { guild_id, user } = data;

		// Update member count analytics
		this.broadcastAnalyticsEvent('MEMBER_COUNT_CHANGE', {
			guildId: guild_id,
			userId: user?.id,
			action: type === 'GUILD_MEMBER_ADD' ? 'JOIN' : 'LEAVE',
			timestamp: eventData.timestamp,
		});

		// Welcome/farewell message triggers
		if (type === 'GUILD_MEMBER_ADD') {
			this.triggerWelcomeMessage(guild_id, user);
		}
	}

	private async handleRoleChange(eventData: DiscordEventData): Promise<void> {
		const { data, type } = eventData;
		const { guild_id, role } = data;

		// Permission system cache invalidation
		this.broadcastCacheInvalidation('PERMISSIONS', {
			guildId: guild_id,
			roleId: role?.id,
			action: type,
		});

		// Security audit for permission changes
		if (this.isSecuritySensitiveRole(role)) {
			this.broadcastSecurityAlert('ROLE_PERMISSION_CHANGE', {
				guildId: guild_id,
				roleId: role?.id,
				permissions: role?.permissions,
				action: type,
			});
		}
	}

	private async handleChannelChange(
		eventData: DiscordEventData
	): Promise<void> {
		const { data, type } = eventData;
		const { guild_id, id: channel_id } = data;

		// Channel cache invalidation
		this.broadcastCacheInvalidation('CHANNELS', {
			guildId: guild_id,
			channelId: channel_id,
			action: type,
		});

		// Update channel-specific subscriptions
		this.updateChannelSubscriptions(guild_id, channel_id, type);
	}

	private async handleVoiceStateUpdate(
		eventData: DiscordEventData
	): Promise<void> {
		const { data } = eventData;
		const { guild_id, user_id, channel_id, before_channel_id } = data;

		// Voice activity analytics
		this.broadcastAnalyticsEvent('VOICE_ACTIVITY', {
			guildId: guild_id,
			userId: user_id,
			channelId: channel_id,
			previousChannelId: before_channel_id,
			action: this.determineVoiceAction(channel_id, before_channel_id),
			timestamp: eventData.timestamp,
		});
	}

	private async handleAutoModerationAction(
		eventData: DiscordEventData
	): Promise<void> {
		const { data } = eventData;
		const { guild_id, user_id, action, rule_trigger_type } = data;

		// Moderation action logging
		this.broadcastModerationEvent('AUTO_MOD_ACTION', {
			guildId: guild_id,
			userId: user_id,
			action: action?.type,
			triggerType: rule_trigger_type,
			timestamp: eventData.timestamp,
		});

		// Pattern analysis for moderation improvement
		this.analyzeModerationPattern(data);
	}

	private async handleModerationAction(
		eventData: DiscordEventData
	): Promise<void> {
		const { data, type } = eventData;
		const { guild_id, user } = data;

		// Moderation tracking
		this.broadcastModerationEvent('MANUAL_MOD_ACTION', {
			guildId: guild_id,
			userId: user?.id,
			action: type === 'GUILD_BAN_ADD' ? 'BAN' : 'UNBAN',
			timestamp: eventData.timestamp,
		});
	}

	// ============================================================================
	// UTILITY METHODS
	// ============================================================================

	private isHighPriorityEvent(eventType: string): boolean {
		const highPriorityEvents = [
			'TYPING_START',
			'VOICE_STATE_UPDATE',
			'PRESENCE_UPDATE',
			'MESSAGE_DELETE',
			'AUTO_MODERATION_ACTION_EXECUTION',
			'GUILD_BAN_ADD',
		];
		return highPriorityEvents.includes(eventType);
	}

	private detectSpamPattern(messageData: any): boolean {
		// Simple spam detection - can be enhanced with ML/AI
		const { content, author } = messageData;

		if (!content || !author) return false;

		// Check for excessive caps
		const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
		if (capsRatio > 0.7 && content.length > 10) return true;

		// Check for repeated characters
		if (/(.)\1{5,}/.test(content)) return true;

		// Check for excessive mentions
		const mentions = (content.match(/<@[!&]?\d+>/g) || []).length;
		if (mentions > 5) return true;

		return false;
	}

	private isSecuritySensitiveRole(role: any): boolean {
		if (!role || !role.permissions) return false;

		const sensitivePermissions = [
			'ADMINISTRATOR',
			'MANAGE_GUILD',
			'MANAGE_ROLES',
			'MANAGE_CHANNELS',
			'BAN_MEMBERS',
			'KICK_MEMBERS',
		];

		const rolePermissions = BigInt(role.permissions);
		return sensitivePermissions.some((perm) => {
			const permValue = this.getPermissionValue(perm);
			return (rolePermissions & permValue) === permValue;
		});
	}

	private getPermissionValue(permission: string): bigint {
		const permissions: Record<string, bigint> = {
			ADMINISTRATOR: 1n << 3n,
			MANAGE_GUILD: 1n << 5n,
			MANAGE_ROLES: 1n << 28n,
			MANAGE_CHANNELS: 1n << 4n,
			BAN_MEMBERS: 1n << 2n,
			KICK_MEMBERS: 1n << 1n,
		};

		return permissions[permission] || 0n;
	}

	private determineVoiceAction(
		channelId: string | null,
		beforeChannelId: string | null
	): string {
		if (!beforeChannelId && channelId) return 'JOIN';
		if (beforeChannelId && !channelId) return 'LEAVE';
		if (beforeChannelId && channelId && beforeChannelId !== channelId)
			return 'MOVE';
		return 'UPDATE';
	}

	// ============================================================================
	// SPECIALIZED BROADCASTING
	// ============================================================================

	private broadcastAnalyticsEvent(eventType: string, data: any): void {
		this.wsManager.broadcastDiscordEvent(
			`ANALYTICS_${eventType}`,
			data,
			data.guildId
		);
	}

	private broadcastModerationAlert(alertType: string, data: any): void {
		this.wsManager.broadcastDiscordEvent(
			`MODERATION_ALERT_${alertType}`,
			data,
			data.guildId
		);
	}

	private broadcastModerationEvent(eventType: string, data: any): void {
		this.wsManager.broadcastDiscordEvent(
			`MODERATION_${eventType}`,
			data,
			data.guildId
		);
	}

	private broadcastCacheInvalidation(cacheType: string, data: any): void {
		this.wsManager.broadcastDiscordEvent(
			`CACHE_INVALIDATE_${cacheType}`,
			data,
			data.guildId
		);
	}

	private broadcastSecurityAlert(alertType: string, data: any): void {
		this.wsManager.broadcastDiscordEvent(
			`SECURITY_ALERT_${alertType}`,
			data,
			data.guildId
		);
	}

	private triggerWelcomeMessage(guildId: string, user: any): void {
		this.wsManager.broadcastDiscordEvent(
			'WELCOME_TRIGGER',
			{
				guildId,
				user,
				timestamp: Date.now(),
			},
			guildId
		);
	}

	private updateChannelSubscriptions(
		guildId: string,
		channelId: string,
		action: string
	): void {
		this.wsManager.broadcastDiscordEvent(
			'CHANNEL_SUBSCRIPTION_UPDATE',
			{
				guildId,
				channelId,
				action,
				timestamp: Date.now(),
			},
			guildId
		);
	}

	private analyzeModerationPattern(data: any): void {
		// Pattern analysis for moderation improvement
		// This could be enhanced with ML/AI for better moderation
		logger.debug('Analyzing moderation pattern:', data);
	}

	// ============================================================================
	// SETUP AND CONFIGURATION
	// ============================================================================

	private setupEventProcessing(): void {
		// Setup periodic queue processing for non-critical events
		setInterval(() => {
			if (this.eventQueue.length > 0 && !this.processingQueue) {
				this.processQueue();
			}
		}, 100); // Process every 100ms

		logger.info('Discord event forwarder initialized');
	}

	public getQueueStats(): any {
		return {
			queueSize: this.eventQueue.length,
			maxQueueSize: this.maxQueueSize,
			isProcessing: this.processingQueue,
		};
	}

	public clearQueue(): void {
		this.eventQueue = [];
		logger.info('Event queue cleared');
	}
}

// Export singleton instance (will be initialized with WebSocket manager)
let discordEventForwarder: DiscordEventForwarder | null = null;

export function initializeDiscordEventForwarder(
	wsManager: WebSocketManager
): DiscordEventForwarder {
	if (!discordEventForwarder) {
		discordEventForwarder = new DiscordEventForwarder(wsManager);
	}
	return discordEventForwarder;
}

export function getDiscordEventForwarder(): DiscordEventForwarder | null {
	return discordEventForwarder;
}
