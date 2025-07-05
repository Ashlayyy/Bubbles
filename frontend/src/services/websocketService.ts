export interface WebSocketMessage {
	type: string;
	event: string;
	data: unknown;
	guildId?: string;
	timestamp: number;
	messageId: string;
}

export class FrontendWebSocketService {
	private ws: WebSocket | null = null;
	private authenticated = false;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 5000;
	private eventHandlers = new Map<string, ((data: unknown) => void)[]>();
	private currentToken: string | null = null;
	private currentGuildId: string | undefined;
	private pingInterval: NodeJS.Timeout | null = null;
	private lastPingSent = 0;

	constructor(private apiUrl: string) {}

	public async connect(token: string, guildId?: string): Promise<void> {
		if (
			this.ws &&
			(this.ws.readyState === WebSocket.OPEN ||
				this.ws.readyState === WebSocket.CONNECTING)
		) {
			console.warn('WebSocket is already connecting/connected');
			return;
		}

		const wsUrl = this.apiUrl.replace('http', 'ws') + '/ws';
		console.log(`Connecting to API WebSocket: ${wsUrl}`);

		this.ws = new WebSocket(wsUrl);

		this.currentToken = token;
		this.currentGuildId = guildId;

		this.ws.onopen = () => {
			console.log('WebSocket connection opened');
			this.authenticated = false;
			this.reconnectAttempts = 0;
			if (this.pingInterval) {
				clearInterval(this.pingInterval);
				this.pingInterval = null;
			}
			this.authenticate(this.currentToken!, this.currentGuildId);
		};

		this.ws.onmessage = (event) => {
			try {
				const message: WebSocketMessage = JSON.parse(event.data);
				this.handleMessage(message);
			} catch (error) {
				console.error('Failed to parse WebSocket message:', error);
			}
		};

		this.ws.onclose = (event) => {
			console.warn(
				`WebSocket connection closed: ${event.code} - ${event.reason}`
			);
			this.authenticated = false;
			if (this.pingInterval) {
				clearInterval(this.pingInterval);
				this.pingInterval = null;
			}
			this.emit('disconnected', { code: event.code, reason: event.reason });
			this.scheduleReconnect(this.currentToken!, this.currentGuildId);
		};

		this.ws.onerror = (error) => {
			console.error('WebSocket error:', error);
		};
	}

	private authenticate(token: string, guildId?: string): void {
		if (!token) return;
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const authMessage = {
			type: 'AUTH',
			data: {
				token,
				type: 'CLIENT',
				guildId,
			},
		};

		this.ws.send(JSON.stringify(authMessage));
		console.log('Sent authentication message to API');
	}

	private handleMessage(message: WebSocketMessage): void {
		switch (message.type) {
			case 'AUTH':
				this.handleAuthResponse(message);
				break;

			case 'DISCORD_EVENT':
			case 'BOT_EVENT':
				this.handleDiscordEvent(message);
				break;

			case 'SYSTEM':
				this.handleSystemMessage(message);
				break;

			case 'PONG':
				this.handlePong(message);
				break;

			default:
				console.debug(`Received unknown message type: ${message.type}`);
		}
	}

	private handleAuthResponse(message: WebSocketMessage): void {
		if (message.event === 'AUTHENTICATED') {
			this.authenticated = true;
			console.log('Successfully authenticated with API server');
			this.emit('authenticated', message.data);
			if (!this.pingInterval) {
				this.pingInterval = setInterval(() => this.sendPing(), 30000);
			}
		} else {
			console.error('Authentication failed:', message.data);
			this.emit('auth_failed', message.data);
		}
	}

	private handleDiscordEvent(message: WebSocketMessage): void {
		console.log(`Received Discord event: ${message.event}`, message.data);
		this.emit('discord_event', {
			event: message.event,
			data: message.data,
			guildId: message.guildId,
		});

		// Emit specific event types
		this.emit(`discord_${message.event}`, message.data);
	}

	private handleSystemMessage(message: WebSocketMessage): void {
		console.log(`System message: ${message.event}`, message.data);
		this.emit('system_message', message.data);
	}

	private handlePong(_message: WebSocketMessage): void {
		const latency = Date.now() - this.lastPingSent;
		this.emit('pong', latency);
	}

	private sendPing(): void {
		if (!this.isConnected()) return;
		this.lastPingSent = Date.now();
		this.sendMessage('PING', 'PING', { timestamp: this.lastPingSent });
	}

	public subscribe(events: string[], guildId?: string): void {
		if (
			!this.ws ||
			this.ws.readyState !== WebSocket.OPEN ||
			!this.authenticated
		) {
			console.warn(
				'WebSocket not connected or authenticated. Cannot subscribe.'
			);
			return;
		}

		const subscribeMessage = {
			type: 'SUBSCRIBE',
			data: {
				events,
				guildId,
			},
		};

		this.ws.send(JSON.stringify(subscribeMessage));
		console.log(`Subscribed to events:`, events);
	}

	public sendMessage(type: string, event: string, data: unknown): void {
		if (
			!this.ws ||
			this.ws.readyState !== WebSocket.OPEN ||
			!this.authenticated
		) {
			console.warn(
				'WebSocket not connected or authenticated. Cannot send message.'
			);
			return;
		}

		const message = {
			type,
			event,
			data,
			timestamp: Date.now(),
			messageId: this.generateMessageId(),
		};

		this.ws.send(JSON.stringify(message));
	}

	public sendClientAction(
		action: string,
		data: unknown,
		guildId?: string
	): void {
		this.sendMessage('CLIENT_ACTION', action, {
			action,
			guildId,
			...(data as Record<string, unknown>),
		});
	}

	// Event handling
	public on(event: string, handler: (data: unknown) => void): void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, []);
		}
		this.eventHandlers.get(event)!.push(handler);
	}

	public off(event: string, handler: (data: unknown) => void): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index > -1) {
				handlers.splice(index, 1);
			}
		}
	}

	private emit(event: string, data: unknown): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(data);
				} catch (error) {
					console.error(`Error in event handler for ${event}:`, error);
				}
			});
		}
	}

	private scheduleReconnect(token: string, guildId?: string): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error('Max reconnection attempts reached. Giving up.');
			return;
		}

		this.reconnectAttempts++;
		const delay = this.reconnectDelay * this.reconnectAttempts;

		console.log(
			`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`
		);

		setTimeout(() => {
			this.connect(token, guildId);
		}, delay);
	}

	private generateMessageId(): string {
		return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	public disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
		this.authenticated = false;
	}

	public isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
	}

	public updateToken(newToken: string): void {
		this.currentToken = newToken;
		if (this.isConnected()) {
			this.authenticate(this.currentToken!, this.currentGuildId);
		}
	}
}

// Export singleton for easy use
export const websocketService = new FrontendWebSocketService(
	import.meta.env.VITE_WS_URL ||
		(import.meta.env.VITE_API_URL || 'http://localhost:3001')
			.replace(/^http/, 'ws')
			.replace('/api/v1', '')
);
