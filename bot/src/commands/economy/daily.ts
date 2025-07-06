import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { economyApiService } from "../../services/economyApiService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class DailyCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "daily",
      description: "Claim your daily reward",
      category: "economy",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    try {
      // Check if API client is configured
      if (!economyApiService.isConfigured()) {
        return this.createGeneralError("Service Unavailable", "Economy service is not properly configured.");
      }

      // Claim daily reward using the API service
      const result = await economyApiService.claimDaily(this.guild.id, {
        userId: this.user.id,
        username: this.user.username,
      });

      if (!result.success) {
        return this.createGeneralError("Daily Claim Error", result.error || "Failed to claim daily reward");
      }

      const dailyData = result.data!;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("💰 Daily Reward Claimed!")
        .setColor("#28a745")
        .setThumbnail(this.user.displayAvatarURL())
        .addFields(
          {
            name: "💵 Reward",
            value: `**+${dailyData.reward.toLocaleString()}** coins`,
            inline: true,
          },
          {
            name: "🔥 Streak",
            value: `**${dailyData.streak}** day${dailyData.streak !== 1 ? "s" : ""}`,
            inline: true,
          },
          {
            name: "💳 New Balance",
            value: `**${dailyData.user.balance.toLocaleString()}** coins`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Next daily: ${new Date(dailyData.nextDaily).toLocaleString()}`,
        });

      // Add streak bonus information
      if (dailyData.streak >= 7) {
        embed.addFields({
          name: "🎉 Streak Bonus!",
          value: `Amazing! You've maintained a ${dailyData.streak}-day streak! Keep it up for even better rewards!`,
          inline: false,
        });
      } else if (dailyData.streak >= 3) {
        embed.addFields({
          name: "🔥 Great Streak!",
          value: `You're on a roll with ${dailyData.streak} days! Keep claiming daily for bigger rewards!`,
          inline: false,
        });
      }

      // Add rank information if available
      if (dailyData.user.rank) {
        embed.addFields({
          name: "📊 Your Rank",
          value: `#${dailyData.user.rank} in the server`,
          inline: true,
        });
      }

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error executing daily command:", error);
      return this.createGeneralError("Error", "An error occurred while claiming your daily reward. Please try again.");
    }
  }
}

export default new DailyCommand();

export const builder = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Claim your daily reward and build your streak");
