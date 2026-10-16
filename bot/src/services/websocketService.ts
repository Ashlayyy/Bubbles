import { EventEmitter } from "events";
import { SignJWT } from "jose";
import { WebSocket } from "ws";
import logger from "../logger.js";
import type Client from "../structures/Client.js";

interface WebSocketMessage {
  type: string;
  event: string;
  data: unknown;
  guildId?: string;
  shardId?: number;
  timestamp: number;
  messageId: string;
}

interface BotCommand {
  command: string;
  data: {
    guildId?: string;
    userId?: string;
    channelId?: string;
    messageId?: string;
    reason?: string;
    deleteMessageDays?: number;
    duration?: number;
    content?: string;
    embeds?: unknown[];
    components?: unknown[];
    [key: string]: unknown;
  };
}

export class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private client: Client;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private authenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private permissionListenersSetup = false;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor(client: Client) {
    super();
    this.client = client;
  }

  public connect(): void {
    // Skip WebSocket connection if API integration is disabled
    if (process.env.DISABLE_API === "true") {
      logger.info("API integration disabled via DISABLE_API environment variable");
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.warn("WebSocket is already connected");
      return;
    }

    const wsUrl = process.env.WS_URL ?? "ws://localhost:3001/ws";
    const originHeader = process.env.WS_ORIGIN;
    logger.info(`Connecting to API WebSocket: ${wsUrl}${originHeader ? ` (origin: ${originHeader})` : ""}`);

    if (originHeader) {
      this.ws = new WebSocket(wsUrl, undefined, { headers: { Origin: originHeader } });
    } else {
      this.ws = new WebSocket(wsUrl);
    }
    logger.debug(`Created WebSocket instance. Ready state: ${this.ws.readyState}`);

    this.ws.on("open", () => {
      logger.info("WebSocket connection opened");
      this.authenticated = false;
      this.reconnectAttempts = 0;
      this.authenticate();
    });

    this.ws.on("message", (data: Buffer | string) => {
      logger.debug(`WS message received: ${data.toString().slice(0, 200)}`);
      try {
        const messageStr = data.toString();
        const message = JSON.parse(messageStr) as WebSocketMessage;
        this.handleMessage(message);
      } catch (error) {
        logger.error("Failed to parse WebSocket message:", error);
      }
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      logger.warn(`WebSocket connection closed: ${code.toString()} - ${reason.toString()}`);
      this.authenticated = false;
      this.clearIntervals();
      this.scheduleReconnect();
    });

    this.ws.on("error", (error: Error) => {
      logger.error("WebSocket error:", error);
    });

    this.ws.on("pong", () => {
      logger.debug("Received PONG from API WebSocket");
      // Connection is alive
    });
  }

  private authenticate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Create a bot JWT token for authentication
    this.generateBotToken()
      .then((botToken) => {
        const authMessage = {
          type: "AUTH",
          data: {
            token: botToken,
            type: "BOT",
            shardId: this.client.shard?.ids[0] ?? 0,
          },
        };

        this.ws?.send(JSON.stringify(authMessage));
        logger.info("Sent authentication message to API");
      })
      .catch((error: unknown) => {
        logger.error("Error generating bot token:", error);
        this.emit("auth_failed", error);
      });
  }

  private async generateBotToken(): Promise<string> {
    // Generate a JWT token for bot authentication using jose (HS256)
    const payload = {
      type: "bot",
      clientId: process.env.DISCORD_CLIENT_ID,
      shardId: this.client.shard?.ids[0] ?? 0,
      permissions: ["BOT_COMMANDS", "SEND_EVENTS"],
    } as Record<string, unknown>;

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is required for bot authentication");
    }

    const key = new TextEncoder().encode(secret);

    const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("24h").sign(key);

    return token;
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case "AUTH":
        this.handleAuthResponse(message);
        break;

      case "BOT_COMMAND":
      case "CLIENT_ACTION":
        this.handleBotCommand(message).catch((error: unknown) => {
          logger.error("Error handling bot command:", error);
        });
        break;

      case "DEAD_LETTER_QUERY":
        this.handleDeadLetterQuery(message);
        break;

      case "DEAD_LETTER_MANAGEMENT":
        this.handleDeadLetterManagement(message);
        break;

      case "PING":
        this.sendPong();
        break;

      case "SYSTEM":
        this.handleSystemMessage(message);
        break;

      case "BOT_EVENT":
        if (message.event === "BOT_COMMAND_RESPONSE") {
          this.handleCommandResponse(message);
        }
        break;

      default:
        logger.debug(`Received unknown message type: ${message.type}`);
    }
  }

  private handleAuthResponse(message: WebSocketMessage): void {
    if (message.event === "AUTHENTICATED") {
      this.authenticated = true;
      logger.info("Successfully authenticated with API server");
      this.startHeartbeat();
      this.sendPermissionSnapshot();
      this.setupPermissionListeners();
      this.emit("authenticated");
    } else {
      logger.error("Authentication failed:", message.data);
      this.emit("auth_failed", message.data);
    }
  }

  private async handleBotCommand(message: WebSocketMessage): Promise<void> {
    if (!this.authenticated) {
      logger.warn("Received command while not authenticated");
      return;
    }

    try {
      const command = message.data as BotCommand;
      if (!command.command) {
        logger.warn("Received command without command field");
        return;
      }

      logger.info(`Executing bot command: ${command.command}`);

      switch (command.command) {
        case "SEND_MESSAGE":
          await this.executeSendMessage(command);
          break;

        case "BAN_USER":
          await this.executeBanUser(command);
          break;

        case "KICK_USER":
          await this.executeKickUser(command);
          break;

        case "DELETE_MESSAGE":
          await this.executeDeleteMessage(command);
          break;

        case "TIMEOUT_USER":
          await this.executeTimeoutUser(command);
          break;

        default:
          logger.warn(`Unknown bot command: ${command.command}`);
      }
    } catch (error) {
      logger.error("Error executing bot command:", error);
    }
  }

  private async executeSendMessage(command: BotCommand): Promise<void> {
    const { channelId, content, embeds, components } = command.data;

    if (typeof channelId !== "string") {
      logger.error("Invalid channelId for send message command");
      return;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel?.isTextBased() && "send" in channel) {
        await channel.send({
          content: content,
          embeds: embeds as [] | undefined,
          components: components as [] | undefined,
        });
        logger.info(`Message sent to channel ${channelId}`);
      }
    } catch (error) {
      logger.error(`Failed to send message to channel ${channelId}:`, error);
    }
  }

  private async executeBanUser(command: BotCommand): Promise<void> {
    const { guildId, userId, reason, deleteMessageDays } = command.data;

    if (typeof guildId !== "string" || typeof userId !== "string") {
      logger.error("Invalid guildId or userId for ban command");
      return;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      await guild.members.ban(userId, {
        reason: (typeof reason === "string" ? reason : undefined) ?? "No reason provided",
        deleteMessageDays: (typeof deleteMessageDays === "number" ? deleteMessageDays : undefined) ?? 0,
      });
      logger.info(`User ${userId} banned from guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to ban user ${userId} from guild ${guildId}:`, error);
    }
  }

  private async executeKickUser(command: BotCommand): Promise<void> {
    const { guildId, userId, reason } = command.data;

    if (typeof guildId !== "string" || typeof userId !== "string") {
      logger.error("Invalid guildId or userId for kick command");
      return;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      await member.kick((typeof reason === "string" ? reason : undefined) ?? "No reason provided");
      logger.info(`User ${userId} kicked from guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to kick user ${userId} from guild ${guildId}:`, error);
    }
  }

  private async executeDeleteMessage(command: BotCommand): Promise<void> {
    const { channelId, messageId } = command.data;

    if (typeof channelId !== "string" || typeof messageId !== "string") {
      logger.error("Invalid channelId or messageId for delete message command");
      return;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(messageId);
        await message.delete();
        logger.info(`Message ${messageId} deleted from channel ${channelId}`);
      }
    } catch (error) {
      logger.error(`Failed to delete message ${messageId} from channel ${channelId}:`, error);
    }
  }

  private async executeTimeoutUser(command: BotCommand): Promise<void> {
    const { guildId, userId, duration, reason } = command.data;

    if (typeof guildId !== "string" || typeof userId !== "string" || typeof duration !== "number") {
      logger.error("Invalid guildId, userId, or duration for timeout command");
      return;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      // Determine if duration is seconds (<= 28 days) or already milliseconds
      const maxSeconds = 28 * 24 * 60 * 60; // 28 days in seconds
      const durationMs = duration <= maxSeconds ? duration * 1000 : duration;

      await member.timeout(durationMs, (typeof reason === "string" ? reason : undefined) ?? "No reason provided");
      logger.info(`User ${userId} timed out in guild ${guildId} for ${durationMs.toString()}ms`);
    } catch (error) {
      logger.error(`Failed to timeout user ${userId} in guild ${guildId}:`, error);
    }
  }

  private handleSystemMessage(message: WebSocketMessage): void {
    logger.info(`System message: ${message.event}`, message.data);
  }

  private sendPong(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "PONG",
          event: "PONG",
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
          messageId: this.generateMessageId(),
        })
      );
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // 30 seconds
  }

  private clearIntervals(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached. Giving up.");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts.toString()} in ${delay.toString()}ms`);

    this.reconnectInterval = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public sendDiscordEvent(eventType: string, eventData: Record<string, unknown>, guildId?: string): void {
    if (process.env.DISABLE_API === "true") return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.authenticated) {
      logger.warn("WebSocket not connected or authenticated. Cannot send event.");
      return;
    }

    const message = {
      type: "BOT_EVENT",
      event: eventType,
      data: {
        type: eventType,
        ...eventData,
        timestamp: Date.now(),
      },
      guildId,
      shardId: this.client.shard?.ids[0] ?? 0,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
    };

    this.ws.send(JSON.stringify(message));
    logger.debug(`Sent Discord event: ${eventType}`);
  }

  private generateMessageId(): string {
    return `msg_${Date.now().toString()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  public disconnect(): void {
    this.clearIntervals();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }

  private handleDeadLetterQuery(message: WebSocketMessage): void {
    try {
      const { event, messageId, guildId } = message;
      let response: Record<string, unknown> = { success: false };

      switch (event) {
        case "GET_STATS":
          if (this.client.queueService?.deadLetterQueue) {
            response = {
              success: true,
              data: this.client.queueService.deadLetterQueue.getDeadLetterStats(),
            } as Record<string, unknown>;
          } else {
            response = { success: false, error: "Dead letter queue not available" };
          }
          break;

        case "GET_QUARANTINED_JOBS":
          if (this.client.queueService?.deadLetterQueue) {
            response = {
              success: true,
              data: this.client.queueService.deadLetterQueue.getQuarantinedJobs(),
            } as Record<string, unknown>;
          } else {
            response = { success: false, error: "Dead letter queue not available" };
          }
          break;

        default:
          response = { success: false, error: `Unknown query event: ${event}` };
      }

      // Send response back
      this.internalSendMessage({
        type: "DEAD_LETTER_RESPONSE",
        event,
        messageId,
        guildId,
        data: response,
      });
    } catch (error) {
      logger.error("Error handling dead letter query:", error);
      this.internalSendMessage({
        type: "DEAD_LETTER_RESPONSE",
        event: message.event,
        messageId: message.messageId,
        guildId: message.guildId,
        data: { success: false, error: "Internal error" },
      });
    }
  }

  private handleDeadLetterManagement(message: WebSocketMessage): void {
    try {
      const { event, data, messageId, guildId } = message;
      let response: Record<string, unknown> = { success: false };

      switch (event) {
        case "RELEASE_QUARANTINE":
          if (this.client.queueService?.deadLetterQueue) {
            const { jobId } = data as { jobId?: string };
            if (!jobId) {
              response = { success: false, error: "Missing jobId" };
              break;
            }
            const success = this.client.queueService.deadLetterQueue.releaseFromQuarantine(jobId);
            response = {
              success,
              message: success ? "Job released from quarantine" : "Job not found in quarantine",
            };
          } else {
            response = { success: false, error: "Dead letter queue not available" };
          }
          break;

        case "CLEAR_DEAD_LETTER_QUEUE":
          if (this.client.queueService?.deadLetterQueue) {
            const count = this.client.queueService.deadLetterQueue.clearDeadLetterQueue();
            response = {
              success: true,
              message: `Cleared ${count} entries from dead letter queue`,
            };
          } else {
            response = { success: false, error: "Dead letter queue not available" };
          }
          break;

        default:
          response = { success: false, error: `Unknown management event: ${event}` };
      }

      this.internalSendMessage({
        type: "DEAD_LETTER_RESPONSE",
        event,
        messageId,
        guildId,
        data: response,
      });
    } catch (error) {
      logger.error("Error handling dead letter management:", error);
      this.internalSendMessage({
        type: "DEAD_LETTER_RESPONSE",
        event: message.event,
        messageId: message.messageId,
        guildId: message.guildId,
        data: { success: false, error: "Internal error" },
      });
    }
  }

  /**
   * Internal helper to send messages after verifying connection and auth
   */
  private internalSendMessage(
    partial: Omit<Partial<WebSocketMessage>, "timestamp" | "messageId"> & {
      timestamp?: number;
      messageId?: string;
    }
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn("WebSocket not connected. Cannot send response.");
      return;
    }
    if (!this.authenticated && partial.type !== "DEAD_LETTER_RESPONSE") {
      logger.warn("WebSocket not authenticated. Cannot send response.");
      return;
    }

    const full: WebSocketMessage = {
      type: partial.type ?? "SYSTEM",
      event: partial.event ?? "UNKNOWN",
      data: partial.data,
      guildId: partial.guildId,
      shardId: this.client.shard?.ids[0] ?? 0,
      timestamp: partial.timestamp ?? Date.now(),
      messageId: partial.messageId ?? this.generateMessageId(),
    } as WebSocketMessage;

    this.ws.send(JSON.stringify(full));
  }

  private buildPermissionSnapshot(): { guildId: string; bitfield: string }[] {
    const snapshot: { guildId: string; bitfield: string }[] = [];

    for (const guild of this.client.guilds.cache.values()) {
      const me = guild.members.me;
      if (me) {
        snapshot.push({ guildId: guild.id, bitfield: me.permissions.bitfield.toString() });
      }
    }

    return snapshot;
  }

  private sendPermissionSnapshot(): void {
    const data = this.buildPermissionSnapshot();
    this.internalSendMessage({
      type: "SYNC_PERMISSIONS",
      event: "PERMISSION_SNAPSHOT",
      data,
    });
  }

  private sendPermissionUpdate(guildId: string, bitfield: bigint): void {
    this.internalSendMessage({
      type: "SYNC_PERMISSIONS",
      event: "PERMISSION_UPDATE",
      data: { guildId, bitfield: bitfield.toString() },
    });
  }

  private setupPermissionListeners(): void {
    if (this.permissionListenersSetup) return;
    this.permissionListenersSetup = true;

    this.client.on("guildMemberUpdate", (oldMember, newMember) => {
      if (newMember.id === this.client.user?.id) {
        this.sendPermissionUpdate(newMember.guild.id, newMember.permissions.bitfield);
      }
    });

    this.client.on("roleUpdate", (_oldRole, newRole) => {
      const guild = newRole.guild;
      const me = guild.members.me;
      if (me) {
        this.sendPermissionUpdate(guild.id, me.permissions.bitfield);
      }
    });

    this.client.on("roleDelete", (role) => {
      const guild = role.guild;
      const me = guild.members.me;
      if (me) {
        this.sendPermissionUpdate(guild.id, me.permissions.bitfield);
      }
    });
  }

  public async sendRequest(request: Record<string, unknown> & { type?: string }): Promise<unknown> {
    if (!this.authenticated || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected or authenticated");
    }

    const messageId = this.generateMessageId();

    const payload = {
      type: "CLIENT_ACTION" as const,
      event: request.type ?? "UNKNOWN_REQUEST",
      data: {
        ...request,
        _requestId: messageId,
      },
      timestamp: Date.now(),
      messageId,
    } as const;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error("WebSocket request timed out"));
      }, 15000);

      this.pendingRequests.set(messageId, { resolve, reject, timeout });

      const wsInstance = this.ws;
      if (!wsInstance) {
        reject(new Error("WebSocket disconnected"));
        return;
      }
      wsInstance.send(JSON.stringify(payload));
    });
  }

  private handleCommandResponse(message: WebSocketMessage): void {
    const { data } = message;
    if (!data || typeof data !== "object" || !("requestId" in data)) return;

    const response = data as {
      requestId: string;
      success?: boolean;
      result?: unknown;
      error?: string;
    };

    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.requestId);

    if (response.success) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error ?? "Request failed"));
    }
  }
}
