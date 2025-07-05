import { BaseCommand } from "../BaseCommand.js";
import type { CommandConfig, CommandResponse } from "../types.js";

export abstract class DevCommand extends BaseCommand {
  constructor(config: CommandConfig) {
    super({
      ...config,
      category: "dev",
      ownerOnly: true, // Dev commands are typically owner-only
    });
  }

  // Developer command utility methods

  /**
   * Check if user is bot developer
   */
  protected isDeveloper(userId: string): boolean {
    const developers = process.env.DEVELOPER_USER_IDS?.split(",") ?? [];
    return developers.includes(userId);
  }

  /**
   * Check if user is bot owner
   */
  protected isOwner(userId: string): boolean {
    return userId === process.env.OWNER_ID;
  }

  /**
   * Validate developer permissions
   */
  protected validateDevPermissions(): void {
    const userId = this.user.id;

    if (!this.isDeveloper(userId) && !this.isOwner(userId)) {
      throw new Error("This command is restricted to bot developers only.");
    }
  }

  /**
   * Create dev success response
   */
  protected createDevSuccess(title: string, description?: string): CommandResponse {
    return this.responseBuilder
      .success(title, description)
      .ephemeral(true) // Dev commands should usually be ephemeral
      .build();
  }

  /**
   * Create dev error response
   */
  protected createDevError(title: string, description?: string): CommandResponse {
    return this.responseBuilder.error(title, description).ephemeral(true).build();
  }

  /**
   * Create dev info response with debug data
   */
  protected createDevInfo(title: string, data?: any): CommandResponse {
    let description = "";

    if (data) {
      if (typeof data === "object") {
        description = "```json\n" + JSON.stringify(data, null, 2) + "\n```";
      } else {
        description = "```\n" + String(data) + "\n```";
      }
    }

    return this.responseBuilder.info(title, description).ephemeral(true).build();
  }

  /**
   * Get system information
   */
  protected getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }

  /**
   * Get bot statistics
   */
  protected getBotStats() {
    return {
      guildCount: this.client.guilds.cache.size,
      userCount: this.client.users.cache.size,
      channelCount: this.client.channels.cache.size,
      commandCount: this.client.commands.size,
    };
  }

  /**
   * Format bytes to human readable
   */
  protected formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${String(parseFloat((bytes / Math.pow(k, i)).toFixed(dm)))} ${sizes[i]}`;
  }

  /**
   * Format uptime to human readable
   */
  protected formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${String(days)}d`);
    if (hours > 0) parts.push(`${String(hours)}h`);
    if (minutes > 0) parts.push(`${String(minutes)}m`);
    if (secs > 0) parts.push(`${String(secs)}s`);

    return parts.join(" ");
  }
}
