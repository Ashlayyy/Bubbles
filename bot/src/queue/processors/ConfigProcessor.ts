import type { ConfigUpdateJob } from "@shared/types/queue";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

export class ConfigProcessor extends BaseProcessor<ConfigUpdateJob> {
  constructor(client: Client) {
    super(client, "ConfigProcessor");
  }

  getJobTypes(): string[] {
    return ["UPDATE_CONFIG"];
  }

  async processJob(job: ConfigUpdateJob): Promise<ProcessorResult> {
    const configKey = job.configKey;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const configValue = job.configValue;
    const guildId = job.guildId;

    if (!configKey) {
      return {
        success: false,
        error: "Config key is required",
        timestamp: Date.now(),
      };
    }

    if (!guildId) {
      return {
        success: false,
        error: "Guild ID is required for config updates",
        timestamp: Date.now(),
      };
    }

    try {
      // Validate the guild exists
      await this.fetchGuild(guildId);

      // Update guild configuration
      const result = await this.updateGuildConfig(guildId, configKey, configValue);

      return {
        success: true,
        data: {
          configKey,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          configValue,
          guildId,
          updated: result,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  private async updateGuildConfig(guildId: string, configKey: string, configValue: any): Promise<boolean> {
    try {
      // Import the database functions dynamically
      const { updateGuildConfig } = await import("../../database/GuildConfig.js");

      // Validate config key
      if (!this.isValidConfigKey(configKey)) {
        throw new Error(`Invalid config key: ${configKey}`);
      }

      // Map config keys to their respective update operations
      const configMap: Record<string, unknown> = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        [configKey]: configValue,
      };

      await updateGuildConfig(guildId, configMap);
      return true;
    } catch (error) {
      throw new Error(
        `Failed to update config ${configKey}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private isValidConfigKey(configKey: string): boolean {
    const validKeys = [
      "maxMessagesCleared",
      "musicChannelId",
      "defaultRepeatMode",
      "reactionRoleChannels",
      "logReactionRoles",
      "welcomeChannelId",
      "goodbyeChannelId",
      "welcomeEnabled",
      "goodbyeEnabled",
      "ticketChannelId",
      "ticketCategoryId",
      "useTicketThreads",
      "ticketOnCallRoleId",
      "ticketSilentClaim",
      "ticketAccessType",
      "ticketAccessRoleId",
      "ticketAccessPermission",
      "ticketLogChannelId",
      "logSettingsId",
      "appealSettingsId",
    ];

    return validKeys.includes(configKey);
  }

  protected getEventPrefix(): string {
    return "CONFIG";
  }

  protected getAdditionalEventData(job: ConfigUpdateJob): Record<string, unknown> {
    return {
      ...super.getAdditionalEventData(job),
      configKey: job.configKey,
      hasValue: job.configValue !== undefined,
    };
  }
}
