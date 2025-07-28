import { EmbedBuilder, Guild, GuildMember, TextChannel, User } from "discord.js";
import logger from "../logger.js";

export interface LevelUpEmbedConfig {
  // Basic embed settings
  enabled?: boolean;
  title?: string;
  description?: string;
  color?: string;
  thumbnail?: "user" | "server" | "custom" | "none";
  customThumbnail?: string;

  // Footer settings
  showFooter?: boolean;
  footerText?: string;
  footerIcon?: "user" | "server" | "custom" | "none";
  customFooterIcon?: string;

  // Field settings
  showLevel?: boolean;
  showXP?: boolean;
  showRank?: boolean;
  showRewards?: boolean;
  showProgress?: boolean;

  // Message settings
  mentionUser?: boolean;
  sendToChannel?: string | null; // Channel ID or null for same channel
  deleteAfter?: number; // Seconds to delete message after

  // Advanced settings
  showTimestamp?: boolean;
  showAuthor?: boolean;
  authorName?: string;
  authorIcon?: string;

  // Reward notification
  rewardTitle?: string;
  rewardDescription?: string;
  rewardEmoji?: string;
}

export interface LevelUpData {
  user: User;
  guild: Guild;
  member: GuildMember;
  oldLevel: number;
  newLevel: number;
  totalXP: number;
  rank?: number;
  rewards?: {
    type: "role" | "currency" | "item";
    name: string;
    id: string;
    amount?: number;
  }[];
  channel: TextChannel;
}

export class LevelUpService {
  private static instance: LevelUpService;
  private defaultConfig: LevelUpEmbedConfig = {
    enabled: true,
    title: "🎉 Level Up!",
    description: "Congratulations {user}, you've reached level {level}!",
    color: "#FFD700",
    thumbnail: "user",
    showFooter: true,
    footerText: "Keep up the great work!",
    footerIcon: "server",
    showLevel: true,
    showXP: true,
    showRank: true,
    showRewards: true,
    showProgress: true,
    mentionUser: true,
    sendToChannel: null,
    deleteAfter: 0,
    showTimestamp: true,
    showAuthor: false,
    rewardTitle: "🎁 Rewards Unlocked!",
    rewardDescription: "You've earned: {rewards}",
    rewardEmoji: "🎁",
  };

  static getInstance(): LevelUpService {
    if (!LevelUpService.instance) {
      LevelUpService.instance = new LevelUpService();
    }
    return LevelUpService.instance;
  }

  /**
   * Send a level-up message with customizable embed
   */
  async sendLevelUpMessage(data: LevelUpData): Promise<void> {
    try {
      const config = await this.getGuildLevelUpConfig(data.guild.id);

      // Skip if leveling is disabled
      if (!config.enabled) {
        return;
      }

      const embed = await this.createLevelUpEmbed(data, config);

      // Determine target channel
      let targetChannel: TextChannel = data.channel;
      if (config.sendToChannel) {
        const channel = data.guild.channels.cache.get(config.sendToChannel);
        if (channel?.isTextBased()) {
          targetChannel = channel as TextChannel;
        }
      }

      // Send message
      const messageOptions: any = {
        embeds: [embed],
      };

      if (config.mentionUser) {
        messageOptions.content = data.user.toString();
      }

      const message = await targetChannel.send(messageOptions);

      // Auto-delete if configured
      if (config.deleteAfter && config.deleteAfter > 0) {
        setTimeout(() => {
          message.delete().catch(() => {
            // Ignore errors (message might already be deleted)
          });
        }, config.deleteAfter * 1000);
      }

      logger.info(`Level up message sent for ${data.user.username} (${data.oldLevel} → ${data.newLevel})`);
    } catch (error) {
      logger.error("Error sending level up message:", error);
    }
  }

  /**
   * Create a level-up embed with custom configuration
   */
  private async createLevelUpEmbed(data: LevelUpData, config: LevelUpEmbedConfig): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder();

    // Set title
    if (config.title) {
      embed.setTitle(this.replacePlaceholders(config.title, data));
    }

    // Set description
    if (config.description) {
      embed.setDescription(this.replacePlaceholders(config.description, data));
    }

    // Set color
    if (config.color) {
      embed.setColor(config.color as any);
    }

    // Set thumbnail
    if (config.thumbnail && config.thumbnail !== "none") {
      const thumbnailUrl = this.getThumbnailUrl(config.thumbnail, data, config.customThumbnail);
      if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
      }
    }

    // Set author
    if (config.showAuthor) {
      embed.setAuthor({
        name: config.authorName || data.user.displayName,
        iconURL: config.authorIcon || data.user.displayAvatarURL(),
      });
    }

    // Add level field
    if (config.showLevel) {
      embed.addFields({
        name: "📈 New Level",
        value: `${data.newLevel}`,
        inline: true,
      });
    }

    // Add XP field
    if (config.showXP) {
      embed.addFields({
        name: "✨ Total XP",
        value: data.totalXP.toLocaleString(),
        inline: true,
      });
    }

    // Add rank field
    if (config.showRank && data.rank) {
      embed.addFields({
        name: "🏆 Rank",
        value: `#${data.rank}`,
        inline: true,
      });
    }

    // Add progress field
    if (config.showProgress) {
      const currentLevelXP = this.calculateLevelXP(data.newLevel);
      const nextLevelXP = this.calculateLevelXP(data.newLevel + 1);
      const progressXP = data.totalXP - currentLevelXP;
      const neededXP = nextLevelXP - currentLevelXP;
      const progressPercent = Math.floor((progressXP / neededXP) * 100);
      const progressBar = this.createProgressBar(progressPercent);

      embed.addFields({
        name: "📊 Progress to Next Level",
        value: `${progressBar}\n${progressXP}/${neededXP} XP (${progressPercent}%)`,
        inline: false,
      });
    }

    // Add rewards field
    if (config.showRewards && data.rewards && data.rewards.length > 0) {
      const rewardText = data.rewards
        .map((reward) => {
          const emoji = config.rewardEmoji || "🎁";
          if (reward.type === "role") {
            return `${emoji} <@&${reward.id}>`;
          } else if (reward.type === "currency") {
            return `${emoji} ${reward.amount?.toLocaleString()} ${reward.name}`;
          } else {
            return `${emoji} ${reward.name}`;
          }
        })
        .join("\n");

      embed.addFields({
        name: config.rewardTitle || "🎁 Rewards",
        value: rewardText,
        inline: false,
      });
    }

    // Set footer
    if (config.showFooter) {
      const footerOptions: any = {};

      if (config.footerText) {
        footerOptions.text = this.replacePlaceholders(config.footerText, data);
      }

      if (config.footerIcon && config.footerIcon !== "none") {
        const footerIconUrl = this.getFooterIconUrl(config.footerIcon, data, config.customFooterIcon);
        if (footerIconUrl) {
          footerOptions.iconURL = footerIconUrl;
        }
      }

      if (footerOptions.text || footerOptions.iconURL) {
        embed.setFooter(footerOptions);
      }
    }

    // Set timestamp
    if (config.showTimestamp) {
      embed.setTimestamp();
    }

    return embed;
  }

  /**
   * Get guild-specific level-up configuration
   */
  private async getGuildLevelUpConfig(guildId: string): Promise<LevelUpEmbedConfig> {
    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";
      const response = await fetch(`${customApiUrl}/api/leveling/${guildId}/level-up-config`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.success) {
          return { ...this.defaultConfig, ...data.data };
        }
      }
    } catch (error) {
      logger.warn("Failed to fetch guild level-up config:", error);
    }

    return this.defaultConfig;
  }

  /**
   * Replace placeholders in text with actual values
   */
  private replacePlaceholders(text: string, data: LevelUpData): string {
    return text
      .replace(/{user}/g, data.user.toString())
      .replace(/{username}/g, data.user.username)
      .replace(/{displayName}/g, data.user.displayName)
      .replace(/{level}/g, data.newLevel.toString())
      .replace(/{oldLevel}/g, data.oldLevel.toString())
      .replace(/{xp}/g, data.totalXP.toLocaleString())
      .replace(/{rank}/g, data.rank?.toString() || "Unknown")
      .replace(/{server}/g, data.guild.name)
      .replace(/{channel}/g, data.channel.name)
      .replace(/{rewards}/g, data.rewards?.map((r) => r.name).join(", ") || "None");
  }

  /**
   * Get thumbnail URL based on configuration
   */
  private getThumbnailUrl(type: string, data: LevelUpData, customUrl?: string): string | null {
    switch (type) {
      case "user":
        return data.user.displayAvatarURL();
      case "server":
        return data.guild.iconURL();
      case "custom":
        return customUrl || null;
      default:
        return null;
    }
  }

  /**
   * Get footer icon URL based on configuration
   */
  private getFooterIconUrl(type: string, data: LevelUpData, customUrl?: string): string | null {
    switch (type) {
      case "user":
        return data.user.displayAvatarURL();
      case "server":
        return data.guild.iconURL();
      case "custom":
        return customUrl || null;
      default:
        return null;
    }
  }

  /**
   * Calculate XP required for a specific level
   */
  private calculateLevelXP(level: number): number {
    return Math.floor(Math.pow(level, 2) * 100);
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(percent: number, length = 10): string {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    const fillChar = "█";
    const emptyChar = "░";
    return "`" + fillChar.repeat(filled) + emptyChar.repeat(empty) + "`";
  }
}

export const levelUpService = LevelUpService.getInstance();
