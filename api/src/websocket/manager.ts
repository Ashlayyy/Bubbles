import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createLogger } from '../types/shared.js';
import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const logger = createLogger('websocket-manager');

export interface WebSocketConnection {
	id: string;
	type: 'CLIENT' | 'BOT' | 'ADMIN';
	ws: WebSocket;
	userId?: string;
	guildId?: string;
	shardId?: number;
	permissions: string[];
	lastPing: number;
	authenticated: boolean;
	metadata: Record<string, any>;
}

export interface WebSocketMessage {
	type: string;
	event: string;
	data: any;
	targetType?: 'CLIENT' | 'BOT' | 'ADMIN' | 'ALL';
	targetId?: string;
	guildId?: string;
	shardId?: number;
	timestamp: number;
	messageId: string;
}

export class WebSocketManager extends EventEmitter {
	private wss: WebSocketServer | null = null;
	private connections = new Map<string, WebSocketConnection>();
	private guildConnections = new Map<string, Set<string>>(); // guildId -> connection IDs
	private shardConnections = new Map<number, Set<string>>(); // shardId -> connection IDs
	private userConnections = new Map<string, Set<string>>(); // userId -> connection IDs
	private pingInterval: NodeJS.Timeout | null = null;
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor() {
		super();
		this.setupCleanupInterval();
	}

	public initialize(server: any): void {
		this.wss = new WebSocketServer({
			server,
			path: '/ws',
			verifyClient: this.verifyClient.bind(this),
		});

		this.wss.on('connection', this.handleConnection.bind(this));
		this.setupPingInterval();

		logger.info('WebSocket server initialized');
	}

	private verifyClient(info: {
		origin: string;
		secure: boolean;
		req: IncomingMessage;
	}): boolean {
		// Allow all origins for bot and internal services to prevent 401 handshake errors.
		// If you need strict CORS, configure via WS_ORIGIN_WHITELIST env.
		const allowed = process.env.WS_ORIGIN_WHITELIST;
		if (!allowed || allowed === '*') {
			logger.debug(
				`WS connection from origin ${info.origin} accepted (no whitelist)`
			);
			return true;
		}
		const list = allowed.split(',');
		const allowedOrigin = list.includes(info.origin);
		if (!allowedOrigin) {
			logger.warn(
				`WS connection from origin ${info.origin} rejected (not in whitelist)`
			);
		} else {
			logger.debug(`WS connection from origin ${info.origin} accepted`);
		}
		return allowedOrigin;
	}

	private async handleConnection(
		ws: WebSocket,
		req: IncomingMessage
	): Promise<void> {
		const connectionId = this.generateConnectionId();
		const connection: WebSocketConnection = {
			id: connectionId,
			type: 'CLIENT', // Default, will be updated on auth
			ws,
			permissions: [],
			lastPing: Date.now(),
			authenticated: false,
			metadata: {},
		};

		this.connections.set(connectionId, connection);
		logger.info(`New WebSocket connection: ${connectionId}`);

		// Set connection timeout for authentication
		const authTimeout = setTimeout(() => {
			if (!connection.authenticated) {
				logger.warn(
					`Connection ${connectionId} failed to authenticate in time`
				);
				this.closeConnection(connectionId, 4001, 'Authentication timeout');
			}
		}, 30000); // 30 seconds to authenticate

		ws.on('message', async (data: any) => {
			try {
				const message = JSON.parse(data.toString());
				await this.handleMessage(connectionId, message);
			} catch (error) {
				logger.error(`Error handling message from ${connectionId}:`, error);
				this.sendError(
					connectionId,
					'INVALID_MESSAGE',
					'Failed to parse message'
				);
			}
		});

		ws.on('close', (code: number, reason: Buffer) => {
			clearTimeout(authTimeout);
			this.handleDisconnection(connectionId, code, reason.toString());
		});

		ws.on('error', (error: Error) => {
			logger.error(`WebSocket error for ${connectionId}:`, error);
			this.handleDisconnection(connectionId, 1011, 'Internal error');
		});

		ws.on('pong', () => {
			connection.lastPing = Date.now();
		});

		// Send welcome message
		this.sendMessage(connectionId, {
			type: 'SYSTEM',
			event: 'CONNECTED',
			data: {
				connectionId,
				timestamp: Date.now(),
				requiresAuth: true,
			},
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		});
	}

	private async handleMessage(
		connectionId: string,
		message: any
	): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection) return;

		switch (message.type) {
			case 'AUTH':
				await this.handleAuthentication(connectionId, message);
				break;

			case 'SUBSCRIBE':
				await this.handleSubscription(connectionId, message);
				break;

			case 'UNSUBSCRIBE':
				await this.handleUnsubscription(connectionId, message);
				break;

			case 'BOT_EVENT':
				await this.handleBotEvent(connectionId, message);
				break;

			case 'CLIENT_ACTION':
				await this.handleClientAction(connectionId, message);
				break;

			case 'PING':
				this.sendMessage(connectionId, {
					type: 'PONG',
					event: 'PONG',
					data: { timestamp: Date.now() },
					timestamp: Date.now(),
					messageId: this.generateMessageId(),
				});
				break;

			default:
				this.sendError(
					connectionId,
					'UNKNOWN_MESSAGE_TYPE',
					`Unknown message type: ${message.type}`
				);
		}
	}

	private async handleAuthentication(
		connectionId: string,
		message: any
	): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection) return;

		try {
			const { token, type, shardId, guildId } = message.data;

			// Verify JWT token
			const decoded = jwt.verify(token, config.jwt.secret) as any;

			connection.authenticated = true;
			connection.type = type || 'CLIENT';
			connection.userId = decoded.userId;
			connection.permissions = decoded.permissions || [];
			connection.metadata = decoded.metadata || {};

			if (type === 'BOT' && typeof shardId === 'number') {
				connection.shardId = shardId;
				this.addToShardConnections(shardId, connectionId);
			}

			if (guildId) {
				connection.guildId = guildId;
				this.addToGuildConnections(guildId, connectionId);
			}

			if (connection.userId) {
				this.addToUserConnections(connection.userId, connectionId);
			}

			logger.info(`Connection ${connectionId} authenticated as ${type}`);

			this.sendMessage(connectionId, {
				type: 'AUTH',
				event: 'AUTHENTICATED',
				data: {
					success: true,
					connectionType: connection.type,
					permissions: connection.permissions,
				},
				timestamp: Date.now(),
				messageId: this.generateMessageId(),
			});

			this.emit('connection_authenticated', connection);
		} catch (error) {
			logger.error(`Authentication failed for ${connectionId}:`, error);
			this.sendError(connectionId, 'AUTH_FAILED', 'Invalid token');
			this.closeConnection(connectionId, 4003, 'Authentication failed');
		}
	}

	private async handleSubscription(
		connectionId: string,
		message: any
	): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection || !connection.authenticated) {
			this.sendError(
				connectionId,
				'NOT_AUTHENTICATED',
				'Must authenticate first'
			);
			return;
		}

		const { events, guildId } = message.data;

		// Validate permissions for subscription
		if (guildId && !this.hasGuildPermission(connection, guildId)) {
			this.sendError(
				connectionId,
				'INSUFFICIENT_PERMISSIONS',
				'No access to this guild'
			);
			return;
		}

		// Store subscription preferences in connection metadata
		connection.metadata.subscriptions = connection.metadata.subscriptions || [];
		connection.metadata.subscriptions.push(...events);

		if (guildId && !connection.guildId) {
			connection.guildId = guildId;
			this.addToGuildConnections(guildId, connectionId);
		}

		this.sendMessage(connectionId, {
			type: 'SUBSCRIPTION',
			event: 'SUBSCRIBED',
			data: {
				events,
				guildId,
			},
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		});

		logger.info(`Connection ${connectionId} subscribed to events:`, events);
	}

	private async handleUnsubscription(
		connectionId: string,
		message: any
	): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection || !connection.authenticated) return;

		const { events } = message.data;

		if (connection.metadata.subscriptions) {
			connection.metadata.subscriptions =
				connection.metadata.subscriptions.filter(
					(event: string) => !events.includes(event)
				);
		}

		this.sendMessage(connectionId, {
			type: 'SUBSCRIPTION',
			event: 'UNSUBSCRIBED',
			data: { events },
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		});
	}

	private async handleBotEvent(
		connectionId: string,
		message: any
	): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection || connection.type !== 'BOT') {
			this.sendError(
				connectionId,
				'INVALID_CONNECTION_TYPE',
				'Only bot connections can send bot events'
			);
			return;
		}

		// Broadcast bot event to relevant clients
		this.broadcastBotEvent(
			message.data,
			connection.guildId,
			connection.shardId
		);

		this.emit('bot_event', {
			event: message.data,
			guildId: connection.guildId,
			shardId: connection.shardId,
		});
	}

	private async handleClientAction(
		connectionId: string,
		message: any
	): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection || connection.type === 'BOT') {
			this.sendError(
				connectionId,
				'INVALID_CONNECTION_TYPE',
				'Bots cannot send client actions'
			);
			return;
		}

		// Forward client action to appropriate bot shard
		this.forwardToBot(message.data, connection.guildId);

		this.emit('client_action', {
			action: message.data,
			connectionId,
			userId: connection.userId,
			guildId: connection.guildId,
		});
	}

	// Public methods for external use
	public broadcastToGuild(
		guildId: string,
		eventOrMessage: string | WebSocketMessage,
		data?: any
	): void {
		let message: WebSocketMessage;

		if (typeof eventOrMessage === 'string') {
			// Build a standard message envelope when called as (guildId, event, data)
			message = {
				type: 'GUILD_EVENT',
				event: eventOrMessage,
				data,
				guildId,
				timestamp: Date.now(),
				messageId: this.generateMessageId(),
			};
		} else {
			message = eventOrMessage;
		}

		const connections = this.guildConnections.get(guildId);
		if (!connections) return;

		for (const connectionId of connections) {
			this.sendMessage(connectionId, message);
		}
	}

	public broadcastToShard(shardId: number, message: WebSocketMessage): void {
		const connectionIds = this.shardConnections.get(shardId);
		if (!connectionIds) return;

		for (const connectionId of connectionIds) {
			this.sendMessage(connectionId, message);
		}
	}

	public broadcastToUser(userId: string, message: WebSocketMessage): void {
		const connectionIds = this.userConnections.get(userId);
		if (!connectionIds) return;

		for (const connectionId of connectionIds) {
			this.sendMessage(connectionId, message);
		}
	}

	public broadcastToAll(
		message: WebSocketMessage,
		filter?: (connection: WebSocketConnection) => boolean
	): void {
		for (const [connectionId, connection] of this.connections) {
			if (filter && !filter(connection)) continue;
			this.sendMessage(connectionId, message);
		}
	}

	public broadcast(
		message: WebSocketMessage,
		targetTypes: ('CLIENT' | 'BOT' | 'ADMIN')[] = ['CLIENT', 'BOT', 'ADMIN']
	): void {
		this.broadcastToAll(message, (connection) => {
			if (!connection.authenticated) return false;
			if (!targetTypes.includes(connection.type)) return false;

			// Check guild permission if message has guildId
			if (
				message.guildId &&
				!this.hasGuildPermission(connection, message.guildId)
			) {
				return false;
			}

			return true;
		});
	}

	public sendToConnection(
		connectionId: string,
		message: WebSocketMessage
	): boolean {
		return this.sendMessage(connectionId, message);
	}

	public getConnectionStats(): any {
		const stats = {
			totalConnections: this.connections.size,
			authenticatedConnections: 0,
			clientConnections: 0,
			botConnections: 0,
			adminConnections: 0,
			guildConnections: this.guildConnections.size,
			shardConnections: this.shardConnections.size,
			userConnections: this.userConnections.size,
		};

		for (const connection of this.connections.values()) {
			if (connection.authenticated) {
				stats.authenticatedConnections++;
				switch (connection.type) {
					case 'CLIENT':
						stats.clientConnections++;
						break;
					case 'BOT':
						stats.botConnections++;
						break;
					case 'ADMIN':
						stats.adminConnections++;
						break;
				}
			}
		}

		return stats;
	}

	// Private helper methods
	private sendMessage(
		connectionId: string,
		message: WebSocketMessage
	): boolean {
		const connection = this.connections.get(connectionId);
		if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
			return false;
		}

		try {
			connection.ws.send(JSON.stringify(message));
			return true;
		} catch (error) {
			logger.error(`Failed to send message to ${connectionId}:`, error);
			this.handleDisconnection(connectionId, 1011, 'Send error');
			return false;
		}
	}

	private sendError(connectionId: string, code: string, message: string): void {
		this.sendMessage(connectionId, {
			type: 'ERROR',
			event: 'ERROR',
			data: { code, message },
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		});
	}

	private broadcastBotEvent(
		event: any,
		guildId?: string,
		shardId?: number
	): void {
		const message: WebSocketMessage = {
			type: 'BOT_EVENT',
			event: event.type || 'UNKNOWN',
			data: event,
			guildId,
			shardId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		// Broadcast to guild-specific connections
		if (guildId) {
			this.broadcastToGuild(guildId, message);
		}

		// Broadcast to clients subscribed to this event type
		this.broadcastToAll(message, (connection) => {
			return (
				connection.type === 'CLIENT' &&
				connection.metadata.subscriptions?.includes(event.type)
			);
		});
	}

	// ============================================================================
	// ENHANCED REAL-TIME DISCORD EVENT BROADCASTING
	// ============================================================================

	public broadcastDiscordEvent(
		eventType: string,
		data: any,
		guildId?: string,
		userId?: string
	): void {
		const message: WebSocketMessage = {
			type: 'DISCORD_EVENT',
			event: eventType,
			data: {
				...data,
				timestamp: Date.now(),
			},
			guildId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		// Real-time event routing
		switch (eventType) {
			case 'MESSAGE_CREATE':
			case 'MESSAGE_UPDATE':
			case 'MESSAGE_DELETE':
			case 'MESSAGE_DELETE_BULK':
				this.broadcastMessageEvent(message, data);
				break;

			case 'GUILD_MEMBER_ADD':
			case 'GUILD_MEMBER_UPDATE':
			case 'GUILD_MEMBER_REMOVE':
				this.broadcastMemberEvent(message, data);
				break;

			case 'GUILD_ROLE_CREATE':
			case 'GUILD_ROLE_UPDATE':
			case 'GUILD_ROLE_DELETE':
				this.broadcastRoleEvent(message, data);
				break;

			case 'CHANNEL_CREATE':
			case 'CHANNEL_UPDATE':
			case 'CHANNEL_DELETE':
				this.broadcastChannelEvent(message, data);
				break;

			case 'GUILD_UPDATE':
				this.broadcastGuildEvent(message, data);
				break;

			case 'VOICE_STATE_UPDATE':
				this.broadcastVoiceEvent(message, data);
				break;

			case 'PRESENCE_UPDATE':
				this.broadcastPresenceEvent(message, data);
				break;

			case 'TYPING_START':
				this.broadcastTypingEvent(message, data);
				break;

			case 'REACTION_ADD':
			case 'REACTION_REMOVE':
			case 'REACTION_REMOVE_ALL':
			case 'REACTION_REMOVE_EMOJI':
				this.broadcastReactionEvent(message, data);
				break;

			case 'THREAD_CREATE':
			case 'THREAD_UPDATE':
			case 'THREAD_DELETE':
			case 'THREAD_LIST_SYNC':
			case 'THREAD_MEMBER_UPDATE':
			case 'THREAD_MEMBERS_UPDATE':
				this.broadcastThreadEvent(message, data);
				break;

			case 'GUILD_BAN_ADD':
			case 'GUILD_BAN_REMOVE':
				this.broadcastModerationEvent(message, data);
				break;

			case 'GUILD_SCHEDULED_EVENT_CREATE':
			case 'GUILD_SCHEDULED_EVENT_UPDATE':
			case 'GUILD_SCHEDULED_EVENT_DELETE':
			case 'GUILD_SCHEDULED_EVENT_USER_ADD':
			case 'GUILD_SCHEDULED_EVENT_USER_REMOVE':
				this.broadcastScheduledEventEvent(message, data);
				break;

			case 'INVITE_CREATE':
			case 'INVITE_DELETE':
				this.broadcastInviteEvent(message, data);
				break;

			case 'WEBHOOKS_UPDATE':
				this.broadcastWebhookEvent(message, data);
				break;

			case 'AUTO_MODERATION_RULE_CREATE':
			case 'AUTO_MODERATION_RULE_UPDATE':
			case 'AUTO_MODERATION_RULE_DELETE':
			case 'AUTO_MODERATION_ACTION_EXECUTION':
				this.broadcastAutoModerationEvent(message, data);
				break;

			default:
				// Generic broadcast for unhandled events
				if (guildId) {
					this.broadcastToGuild(guildId, message);
				} else {
					this.broadcastToAll(message);
				}
		}

		this.emit('discord-event', eventType, data, guildId, userId);
	}

	private broadcastMessageEvent(message: WebSocketMessage, data: any): void {
		const { channel_id, guild_id, author } = data;

		// Broadcast to guild members
		if (guild_id) {
			this.broadcastToGuild(guild_id, message);
		}

		// Broadcast to specific channel subscribers
		this.broadcastToChannelSubscribers(channel_id, message);

		// Real-time analytics
		this.broadcastToAnalytics(message);
	}

	private broadcastMemberEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, user } = data;

		if (guild_id) {
			this.broadcastToGuild(guild_id, message);

			// Also notify user-specific connections
			if (user?.id) {
				this.broadcastToUser(user.id, message);
			}
		}

		// Real-time member count updates
		this.broadcastMemberCountUpdate(guild_id);
	}

	private broadcastRoleEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, role } = data;

		if (guild_id) {
			this.broadcastToGuild(guild_id, message);

			// Notify permission management systems
			this.broadcastPermissionUpdate(guild_id, role?.id);
		}
	}

	private broadcastChannelEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, id: channel_id } = data;

		if (guild_id) {
			this.broadcastToGuild(guild_id, message);

			// Update channel cache notifications
			this.broadcastChannelCacheUpdate(guild_id, channel_id);
		}
	}

	private broadcastGuildEvent(message: WebSocketMessage, data: any): void {
		const { id: guild_id } = data;

		if (guild_id) {
			this.broadcastToGuild(guild_id, message);

			// Update guild settings cache
			this.broadcastGuildCacheUpdate(guild_id);
		}
	}

	private broadcastVoiceEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, user_id, channel_id } = data;

		if (guild_id) {
			this.broadcastToGuild(guild_id, message);

			// Real-time voice activity updates
			this.broadcastVoiceActivityUpdate(guild_id, channel_id, user_id);
		}
	}

	private broadcastPresenceEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, user } = data;

		if (guild_id && user?.id) {
			// Limited presence broadcast to reduce noise
			this.broadcastToGuildAdmins(guild_id, message);
			this.broadcastToUser(user.id, message);
		}
	}

	private broadcastTypingEvent(message: WebSocketMessage, data: any): void {
		const { channel_id, guild_id, user_id } = data;

		// Short-lived event, broadcast immediately
		if (guild_id) {
			this.broadcastToGuild(guild_id, message);
		}

		this.broadcastToChannelSubscribers(channel_id, message);
	}

	private broadcastReactionEvent(message: WebSocketMessage, data: any): void {
		const { channel_id, guild_id, message_id } = data;

		if (guild_id) {
			this.broadcastToGuild(guild_id, message);
		}

		// Real-time reaction updates
		this.broadcastMessageReactionUpdate(channel_id, message_id);
	}

	private broadcastThreadEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, parent_id, id: thread_id } = data;

		if (guild_id) {
			this.broadcastToGuild(guild_id, message);

			// Thread-specific subscribers
			this.broadcastToThreadSubscribers(thread_id, message);
		}
	}

	private broadcastModerationEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, user } = data;

		if (guild_id) {
			// Only broadcast to moderators and admins
			this.broadcastToGuildModerators(guild_id, message);

			// Log to moderation systems
			this.broadcastToModerationSystems(guild_id, message);
		}
	}

	private broadcastScheduledEventEvent(
		message: WebSocketMessage,
		data: any
	): void {
		const { guild_id, id: event_id } = data;

		if (guild_id) {
			this.broadcastToGuild(guild_id, message);

			// Event-specific notifications
			this.broadcastEventNotification(guild_id, event_id, message.event);
		}
	}

	private broadcastInviteEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, channel_id } = data;

		if (guild_id) {
			// Limited to administrators
			this.broadcastToGuildAdmins(guild_id, message);
		}
	}

	private broadcastWebhookEvent(message: WebSocketMessage, data: any): void {
		const { guild_id, channel_id } = data;

		if (guild_id) {
			// Administrator notification
			this.broadcastToGuildAdmins(guild_id, message);
		}
	}

	private broadcastAutoModerationEvent(
		message: WebSocketMessage,
		data: any
	): void {
		const { guild_id } = data;

		if (guild_id) {
			// Moderation team notifications
			this.broadcastToGuildModerators(guild_id, message);
			this.broadcastToModerationSystems(guild_id, message);
		}
	}

	// ============================================================================
	// SPECIALIZED BROADCAST HELPERS
	// ============================================================================

	private broadcastToChannelSubscribers(
		channelId: string,
		message: WebSocketMessage
	): void {
		this.broadcastToAll(message, (conn) =>
			conn.metadata.subscribedChannels?.includes(channelId)
		);
	}

	private broadcastToThreadSubscribers(
		threadId: string,
		message: WebSocketMessage
	): void {
		this.broadcastToAll(message, (conn) =>
			conn.metadata.subscribedThreads?.includes(threadId)
		);
	}

	private broadcastToGuildAdmins(
		guildId: string,
		message: WebSocketMessage
	): void {
		this.broadcastToAll(
			message,
			(conn) =>
				conn.guildId === guildId &&
				(conn.type === 'ADMIN' || conn.permissions.includes('ADMINISTRATOR'))
		);
	}

	private broadcastToGuildModerators(
		guildId: string,
		message: WebSocketMessage
	): void {
		this.broadcastToAll(
			message,
			(conn) =>
				conn.guildId === guildId &&
				(conn.type === 'ADMIN' ||
					conn.permissions.includes('ADMINISTRATOR') ||
					conn.permissions.includes('MODERATE_MEMBERS') ||
					conn.permissions.includes('BAN_MEMBERS') ||
					conn.permissions.includes('KICK_MEMBERS'))
		);
	}

	private broadcastToAnalytics(message: WebSocketMessage): void {
		const analyticsMessage: WebSocketMessage = {
			...message,
			type: 'ANALYTICS_EVENT',
		};

		this.broadcastToAll(
			analyticsMessage,
			(conn) => conn.metadata.analyticsSubscription === true
		);
	}

	private broadcastToModerationSystems(
		guildId: string,
		message: WebSocketMessage
	): void {
		const moderationMessage: WebSocketMessage = {
			...message,
			type: 'MODERATION_EVENT',
		};

		this.broadcastToAll(
			moderationMessage,
			(conn) =>
				conn.guildId === guildId && conn.metadata.moderationSystem === true
		);
	}

	// ============================================================================
	// REAL-TIME UPDATE HELPERS
	// ============================================================================

	private broadcastMemberCountUpdate(guildId: string): void {
		if (!guildId) return;

		const updateMessage: WebSocketMessage = {
			type: 'CACHE_UPDATE',
			event: 'MEMBER_COUNT_CHANGE',
			data: { guildId, timestamp: Date.now() },
			guildId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		this.broadcastToGuild(guildId, updateMessage);
	}

	private broadcastPermissionUpdate(guildId: string, roleId?: string): void {
		if (!guildId) return;

		const updateMessage: WebSocketMessage = {
			type: 'PERMISSION_UPDATE',
			event: 'ROLE_PERMISSIONS_CHANGED',
			data: { guildId, roleId, timestamp: Date.now() },
			guildId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		this.broadcastToGuild(guildId, updateMessage);
	}

	private broadcastChannelCacheUpdate(
		guildId: string,
		channelId: string
	): void {
		const updateMessage: WebSocketMessage = {
			type: 'CACHE_UPDATE',
			event: 'CHANNEL_CACHE_INVALIDATE',
			data: { guildId, channelId, timestamp: Date.now() },
			guildId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		this.broadcastToGuild(guildId, updateMessage);
	}

	private broadcastGuildCacheUpdate(guildId: string): void {
		const updateMessage: WebSocketMessage = {
			type: 'CACHE_UPDATE',
			event: 'GUILD_CACHE_INVALIDATE',
			data: { guildId, timestamp: Date.now() },
			guildId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		this.broadcastToGuild(guildId, updateMessage);
	}

	private broadcastVoiceActivityUpdate(
		guildId: string,
		channelId?: string,
		userId?: string
	): void {
		const updateMessage: WebSocketMessage = {
			type: 'VOICE_UPDATE',
			event: 'VOICE_ACTIVITY_CHANGE',
			data: { guildId, channelId, userId, timestamp: Date.now() },
			guildId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		this.broadcastToGuild(guildId, updateMessage);
	}

	private broadcastMessageReactionUpdate(
		channelId: string,
		messageId: string
	): void {
		const updateMessage: WebSocketMessage = {
			type: 'MESSAGE_UPDATE',
			event: 'REACTION_COUNT_CHANGE',
			data: { channelId, messageId, timestamp: Date.now() },
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		this.broadcastToChannelSubscribers(channelId, updateMessage);
	}

	private broadcastEventNotification(
		guildId: string,
		eventId: string,
		eventType: string
	): void {
		const notificationMessage: WebSocketMessage = {
			type: 'EVENT_NOTIFICATION',
			event: eventType,
			data: { guildId, eventId, timestamp: Date.now() },
			guildId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		this.broadcastToGuild(guildId, notificationMessage);
	}

	private forwardToBot(action: any, guildId?: string): void {
		const message: WebSocketMessage = {
			type: 'CLIENT_ACTION',
			event: action.type || 'UNKNOWN',
			data: action,
			guildId,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		// Find appropriate bot connection
		if (guildId) {
			// Send to bot handling this guild
			this.broadcastToAll(message, (connection) => {
				return (
					connection.type === 'BOT' &&
					(connection.guildId === guildId || !connection.guildId)
				);
			});
		} else {
			// Send to any available bot
			this.broadcastToAll(message, (connection) => connection.type === 'BOT');
		}
	}

	private hasGuildPermission(
		connection: WebSocketConnection,
		guildId: string
	): boolean {
		// Implement your permission logic here
		return (
			connection.permissions.includes('GUILD_ACCESS') ||
			connection.permissions.includes('ADMIN') ||
			connection.guildId === guildId
		);
	}

	private handleDisconnection(
		connectionId: string,
		code: number,
		reason: string
	): void {
		const connection = this.connections.get(connectionId);
		if (!connection) return;

		logger.info(`Connection ${connectionId} disconnected: ${code} - ${reason}`);

		// Remove from all tracking maps
		this.connections.delete(connectionId);

		if (connection.guildId) {
			this.removeFromGuildConnections(connection.guildId, connectionId);
		}

		if (connection.shardId !== undefined) {
			this.removeFromShardConnections(connection.shardId, connectionId);
		}

		if (connection.userId) {
			this.removeFromUserConnections(connection.userId, connectionId);
		}

		this.emit('connection_closed', {
			connectionId,
			connection,
			code,
			reason,
		});
	}

	private closeConnection(
		connectionId: string,
		code: number,
		reason: string
	): void {
		const connection = this.connections.get(connectionId);
		if (!connection) return;

		try {
			connection.ws.close(code, reason);
		} catch (error) {
			logger.error(`Error closing connection ${connectionId}:`, error);
		}
	}

	private addToGuildConnections(guildId: string, connectionId: string): void {
		if (!this.guildConnections.has(guildId)) {
			this.guildConnections.set(guildId, new Set());
		}
		this.guildConnections.get(guildId)!.add(connectionId);
	}

	private removeFromGuildConnections(
		guildId: string,
		connectionId: string
	): void {
		const connections = this.guildConnections.get(guildId);
		if (connections) {
			connections.delete(connectionId);
			if (connections.size === 0) {
				this.guildConnections.delete(guildId);
			}
		}
	}

	private addToShardConnections(shardId: number, connectionId: string): void {
		if (!this.shardConnections.has(shardId)) {
			this.shardConnections.set(shardId, new Set());
		}
		this.shardConnections.get(shardId)!.add(connectionId);
	}

	private removeFromShardConnections(
		shardId: number,
		connectionId: string
	): void {
		const connections = this.shardConnections.get(shardId);
		if (connections) {
			connections.delete(connectionId);
			if (connections.size === 0) {
				this.shardConnections.delete(shardId);
			}
		}
	}

	private addToUserConnections(userId: string, connectionId: string): void {
		if (!this.userConnections.has(userId)) {
			this.userConnections.set(userId, new Set());
		}
		this.userConnections.get(userId)!.add(connectionId);
	}

	private removeFromUserConnections(
		userId: string,
		connectionId: string
	): void {
		const connections = this.userConnections.get(userId);
		if (connections) {
			connections.delete(connectionId);
			if (connections.size === 0) {
				this.userConnections.delete(userId);
			}
		}
	}

	private setupPingInterval(): void {
		this.pingInterval = setInterval(() => {
			for (const [connectionId, connection] of this.connections) {
				if (connection.ws.readyState === WebSocket.OPEN) {
					connection.ws.ping();
				}
			}
		}, 30000); // Ping every 30 seconds
	}

	private setupCleanupInterval(): void {
		this.cleanupInterval = setInterval(() => {
			const now = Date.now();
			const timeout = 60000; // 1 minute timeout

			for (const [connectionId, connection] of this.connections) {
				if (now - connection.lastPing > timeout) {
					logger.warn(`Connection ${connectionId} timed out`);
					this.closeConnection(connectionId, 4000, 'Ping timeout');
				}
			}
		}, 30000); // Check every 30 seconds
	}

	private generateConnectionId(): string {
		return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private generateMessageId(): string {
		return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	public shutdown(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
		}
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}

		// Close all connections
		for (const [connectionId, connection] of this.connections) {
			this.closeConnection(connectionId, 1001, 'Server shutdown');
		}

		if (this.wss) {
			this.wss.close();
		}

		logger.info('WebSocket manager shut down');
	}
}

// Singleton instance
export const wsManager = new WebSocketManager();
