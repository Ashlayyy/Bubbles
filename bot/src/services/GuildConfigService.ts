import { prisma } from "@shared/database";
import { logger } from "../logger";

export interface TicketSettings {
  channelId?: string;
  categoryId?: string;
  useThreads: boolean;
  onCallRole?: string;
  silentClaim: boolean;
  access: {
    type: "role" | "permission" | "default";
    roleId?: string;
    permission?: string;
  };
  logChannelId?: string;
}

export interface ModerationSettings {
  automod: {
    enabled: boolean;
    rules: any[];
  };
  punishments: {
    defaultDuration: number;
    escalation: boolean;
  };
  appeals: {
    enabled: boolean;
    channelId?: string;
  };
  moderatorRoles: string[];
  reportChannel?: string;
  reportPingRole?: string;
  notifyUser: boolean;
  caseRules?: any;
}

export interface WelcomeSettings {
  welcome: {
    enabled: boolean;
    channelId?: string;
    message?: string;
  };
  goodbye: {
    enabled: boolean;
    channelId?: string;
    message?: string;
  };
  stats?: any;
}

export class GuildConfigService {
  /**
   * Get or create guild config with proper JSON structure
   */
  async getGuildConfig(guildId: string, guildName?: string): Promise<any> {
    try {
      let config = await prisma.guildConfig.findUnique({
        where: { guildId },
        include: {
          logSettings: true,
          automodConfig: true,
          economyConfig: true,
          levelsConfig: true,
        }
      });

      if (!config) {
        // Create default config
        config = await prisma.guildConfig.create({
          data: {
            guildId,
            guildName: guildName || null,
            ticketSettings: this.getDefaultTicketSettings(),
            moderationSettings: this.getDefaultModerationSettings(),
            welcomeSettings: this.getDefaultWelcomeSettings(),
          },
          include: {
            logSettings: true,
            automodConfig: true,
            economyConfig: true,
            levelsConfig: true,
          }
        });
      } else if (guildName && config.guildName !== guildName) {
        // Update guild name if it changed
        config = await prisma.guildConfig.update({
          where: { guildId },
          data: { guildName },
          include: {
            logSettings: true,
            automodConfig: true,
            economyConfig: true,
            levelsConfig: true,
          }
        });
      }

      return config;
    } catch (error) {
      logger.error(`Failed to get guild config for ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Update ticket settings using JSON structure
   */
  async updateTicketSettings(guildId: string, settings: Partial<TicketSettings>): Promise<void> {
    try {
      const config = await this.getGuildConfig(guildId);
      const currentSettings = (config.ticketSettings as TicketSettings) || this.getDefaultTicketSettings();

      const updatedSettings = {
        ...currentSettings,
        ...settings,
        access: {
          ...currentSettings.access,
          ...(settings.access || {})
        }
      };

      await prisma.guildConfig.update({
        where: { guildId },
        data: {
          ticketSettings: updatedSettings
        }
      });

      logger.info(`Updated ticket settings for guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to update ticket settings for guild ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Update moderation settings using JSON structure
   */
  async updateModerationSettings(guildId: string, settings: Partial<ModerationSettings>): Promise<void> {
    try {
      const config = await this.getGuildConfig(guildId);
      const currentSettings = (config.moderationSettings as ModerationSettings) || this.getDefaultModerationSettings();

      const updatedSettings = {
        ...currentSettings,
        ...settings,
        automod: {
          ...currentSettings.automod,
          ...(settings.automod || {})
        },
        punishments: {
          ...currentSettings.punishments,
          ...(settings.punishments || {})
        },
        appeals: {
          ...currentSettings.appeals,
          ...(settings.appeals || {})
        }
      };

      await prisma.guildConfig.update({
        where: { guildId },
        data: {
          moderationSettings: updatedSettings
        }
      });

      logger.info(`Updated moderation settings for guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to update moderation settings for guild ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Get ticket settings with backwards compatibility
   */
  getTicketSettings(config: any): TicketSettings {
    // If new JSON structure exists, use it
    if (config.ticketSettings && typeof config.ticketSettings === 'object') {
      return config.ticketSettings as TicketSettings;
    }

    // Otherwise, migrate from legacy fields
    return {
      channelId: config.ticketChannelId || undefined,
      categoryId: config.ticketCategoryId || undefined,
      useThreads: config.useTicketThreads ?? true,
      onCallRole: config.ticketOnCallRoleId || undefined,
      silentClaim: config.ticketSilentClaim ?? true,
      access: {
        type: config.ticketAccessType || "default",
        roleId: config.ticketAccessRoleId || undefined,
        permission: config.ticketAccessPermission || undefined,
      },
      logChannelId: config.ticketLogChannelId || undefined,
    };
  }

  /**
   * Migrate legacy flat fields to JSON structure
   */
  async migrateLegacyConfig(guildId: string): Promise<void> {
    try {
      const config = await prisma.guildConfig.findUnique({
        where: { guildId }
      });

      if (!config) return;

      const updates: any = {};

      // Migrate ticket settings if not already JSON
      if (!config.ticketSettings && (
        config.ticketChannelId || 
        config.ticketCategoryId || 
        config.ticketOnCallRoleId ||
        config.ticketAccessRoleId
      )) {
        updates.ticketSettings = this.getTicketSettings(config);
      }

      // Migrate moderation settings
      if (!config.moderationSettings && (
        config.moderatorRoleIds?.length ||
        config.reportChannelId ||
        config.reportPingRoleId
      )) {
        updates.moderationSettings = {
          automod: { enabled: false, rules: [] },
          punishments: { defaultDuration: 3600, escalation: true },
          appeals: { enabled: true },
          moderatorRoles: config.moderatorRoleIds || [],
          reportChannel: config.reportChannelId,
          reportPingRole: config.reportPingRoleId,
          notifyUser: config.notify_user ?? false,
          caseRules: config.moderation_case_rules,
        };
      }

      // Migrate welcome settings
      if (!config.welcomeSettings && (
        config.welcomeChannelId ||
        config.goodbyeChannelId
      )) {
        updates.welcomeSettings = {
          welcome: {
            enabled: config.welcomeEnabled ?? true,
            channelId: config.welcomeChannelId,
          },
          goodbye: {
            enabled: config.goodbyeEnabled ?? true,
            channelId: config.goodbyeChannelId,
          },
          stats: config.welcomeStats,
        };
      }

      if (Object.keys(updates).length > 0) {
        await prisma.guildConfig.update({
          where: { guildId },
          data: updates
        });

        logger.info(`Migrated legacy config for guild ${guildId}`);
      }
    } catch (error) {
      logger.error(`Failed to migrate legacy config for guild ${guildId}:`, error);
    }
  }

  private getDefaultTicketSettings(): TicketSettings {
    return {
      useThreads: true,
      silentClaim: true,
      access: {
        type: "default"
      }
    };
  }

  private getDefaultModerationSettings(): ModerationSettings {
    return {
      automod: { enabled: false, rules: [] },
      punishments: { defaultDuration: 3600, escalation: true },
      appeals: { enabled: true },
      moderatorRoles: [],
      notifyUser: false,
    };
  }

  private getDefaultWelcomeSettings(): WelcomeSettings {
    return {
      welcome: { enabled: false },
      goodbye: { enabled: false },
    };
  }
}