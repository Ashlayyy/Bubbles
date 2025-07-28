import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { rankCardService } from "../../services/rankCardService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class RankCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "rank",
      description: "View your or another user's level and rank",
      category: "leveling",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const user = this.getUserOption("user") || this.user;
    const displayType = this.getStringOption("display") || "image";
    const guildId = this.guild.id;

    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // Fetch user's leveling data from API
      const response = await fetch(`${customApiUrl}/api/leveling/${guildId}/users/${user.id}`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return this.createGeneralError("No Data Found", `${user.username} hasn't gained any XP in this server yet.`);
        }
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      if (!data.success) {
        return this.createGeneralError("API Error", data.error || "Failed to fetch leveling data.");
      }

      const levelData = data.data;

      // Fetch leaderboard position
      const leaderboardResponse = await fetch(`${customApiUrl}/api/leveling/${guildId}/leaderboard?limit=1000`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      let rank = 0;
      if (leaderboardResponse.ok) {
        const leaderboardData = (await leaderboardResponse.json()) as any;
        if (leaderboardData.success) {
          const position: number = leaderboardData.data.users.findIndex((u: any) => u.userId === user.id);
          if (position !== -1) {
            rank = position + 1;
          }
        }
      }

      // Choose display type
      if (displayType === "image") {
        return await this.generateRankCard(user, guildId, rank, levelData);
      } else {
        return await this.generateRankEmbed(user, guildId, rank, levelData);
      }
    } catch (error) {
      logger.error("Error fetching rank data:", error);
      return this.createGeneralError("Error", "An error occurred while fetching rank data. Please try again later.");
    }
  }

  private async generateRankCard(user: any, guildId: string, rank: number, levelData: any): Promise<CommandResponse> {
    try {
      // Get custom rank card config from guild settings
      const customConfig = await this.getGuildRankCardConfig(guildId);

      const attachment = await rankCardService.generateRankCard(user, guildId, rank, customConfig);

      // Create simple embed to accompany the image
      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${user.displayName}'s Rank Card`)
        .setColor("#FFD700")
        .setImage(`attachment://rank-${user.id}.png`)
        .setTimestamp()
        .setFooter({
          text: `Requested by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      await this.logCommandUsage("rank", {
        targetUserId: user.id,
        targetUsername: user.username,
        level: levelData.level,
        totalXP: levelData.totalXP,
        rank: rank,
        displayType: "image",
        isOwnRank: user.id === this.user.id,
      });

      return { embeds: [embed], files: [attachment], ephemeral: true };
    } catch (error) {
      logger.error("Error generating rank card:", error);
      // Fallback to embed display
      return await this.generateRankEmbed(user, guildId, rank, levelData);
    }
  }

  private async generateRankEmbed(user: any, guildId: string, rank: number, levelData: any): Promise<CommandResponse> {
    // Calculate XP progress
    const currentLevelXP = this.calculateLevelXP(Number(levelData.level));
    const nextLevelXP = this.calculateLevelXP(Number(levelData.level) + 1);
    const progressXP = levelData.totalXP - currentLevelXP;
    const neededXP = nextLevelXP - currentLevelXP;
    const progressPercent = Math.floor((progressXP / neededXP) * 100);

    // Create progress bar
    const progressBar = this.createProgressBar(progressPercent);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 Level & Rank`)
      .setColor("#00ff00")
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        {
          name: "👤 User",
          value: `${user}`,
          inline: true,
        },
        {
          name: "🏆 Rank",
          value: rank > 0 ? `#${rank}` : "Unranked",
          inline: true,
        },
        {
          name: "📈 Level",
          value: `${levelData.level}`,
          inline: true,
        },
        {
          name: "✨ Total XP",
          value: `${levelData.totalXP.toLocaleString()}`,
          inline: true,
        },
        {
          name: "📝 Messages",
          value: `${levelData.messageCount.toLocaleString()}`,
          inline: true,
        },
        {
          name: "🎤 Voice Time",
          value: `${Math.floor(levelData.voiceTime / 60)} minutes`,
          inline: true,
        },
        {
          name: "📊 Progress to Next Level",
          value: `${progressBar}\n${progressXP}/${neededXP} XP (${progressPercent}%)`,
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({
        text: `Requested by ${this.user.username}`,
        iconURL: this.user.displayAvatarURL(),
      });

    // Add last activity if available
    if (levelData.lastMessageAt) {
      embed.addFields({
        name: "🕐 Last Activity",
        value: `<t:${Math.floor(new Date(levelData.lastMessageAt).getTime() / 1000)}:R>`,
        inline: true,
      });
    }

    // Add streak information if available
    if (levelData.dailyStreak > 0) {
      embed.addFields({
        name: "🔥 Daily Streak",
        value: `${levelData.dailyStreak} days`,
        inline: true,
      });
    }

    // Add multiplier information if applicable
    if (levelData.multiplier && levelData.multiplier > 1) {
      embed.addFields({
        name: "🚀 XP Multiplier",
        value: `${levelData.multiplier}x`,
        inline: true,
      });
    }

    await this.logCommandUsage("rank", {
      targetUserId: user.id,
      targetUsername: user.username,
      level: levelData.level,
      totalXP: levelData.totalXP,
      rank: rank,
      displayType: "embed",
      isOwnRank: user.id === this.user.id,
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async getGuildRankCardConfig(guildId: string): Promise<any> {
    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";
      const response = await fetch(`${customApiUrl}/api/leveling/${guildId}/rank-card-config`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        return data.success ? data.data : {};
      }
      return {};
    } catch (error) {
      logger.warn("Failed to fetch guild rank card config:", error);
      return {};
    }
  }

  private calculateLevelXP(level: number): number {
    // Standard leveling formula: level^2 * 100
    return Math.floor(Math.pow(level, 2) * 100);
  }

  private createProgressBar(percent: number, length = 10): string {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;

    const fillChar = "█";
    const emptyChar = "░";

    return "`" + fillChar.repeat(filled) + emptyChar.repeat(empty) + "`";
  }
}

export default new RankCommand();

export const builder = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("View your or another user's level and rank")
  .addUserOption((option) => option.setName("user").setDescription("User to view rank for (defaults to yourself)"))
  .addStringOption((option) =>
    option
      .setName("display")
      .setDescription("How to display the rank information")
      .setRequired(false)
      .addChoices({ name: "Image Card", value: "image" }, { name: "Embed", value: "embed" })
  );
