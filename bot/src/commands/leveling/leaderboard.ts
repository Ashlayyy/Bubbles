import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { levelingApiService } from "../../services/levelingApiService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class LeaderboardCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "leaderboard",
      description: "View the server's leveling leaderboard",
      category: "leveling",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const page = this.getIntegerOption("page") || 1;
    const limit = this.getIntegerOption("limit") || 10;

    try {
      // Check if API client is configured
      if (!levelingApiService.isConfigured()) {
        return this.createGeneralError("Service Unavailable", "Leveling service is not properly configured.");
      }

      // Get leaderboard data using the API service
      const result = await levelingApiService.getLeaderboard(this.guild.id, page, limit);

      if (!result.success) {
        return this.createGeneralError("Leaderboard Error", result.error || "Failed to fetch leaderboard data");
      }

      const leaderboard = result.data!;

      if (!leaderboard.users.length) {
        return this.createGeneralError(
          "No Data",
          "No leveling data found for this server. Users need to send messages to start earning XP!"
        );
      }

      // Create leaderboard embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${this.guild.name} Leveling Leaderboard`)
        .setColor("#3498db")
        .setThumbnail(this.guild.iconURL() || null)
        .setTimestamp()
        .setFooter({
          text: `Page ${leaderboard.pagination.page} of ${leaderboard.pagination.pages} • Total: ${leaderboard.pagination.total} users`,
        });

      // Create leaderboard description
      let description = "";
      leaderboard.users.forEach((user, index) => {
        const position = (leaderboard.pagination.page - 1) * leaderboard.pagination.limit + index + 1;
        const medal = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : `**${position}.**`;

        description += `${medal} <@${user.userId}>\n`;
        description += `   Level **${user.level}** • **${user.xp.toLocaleString()}** XP\n\n`;
      });

      embed.setDescription(description.trim());

      // Add statistics field
      const stats = [
        `**Total Users:** ${leaderboard.pagination.total}`,
        `**Showing:** ${leaderboard.users.length} users`,
        `**Page:** ${leaderboard.pagination.page}/${leaderboard.pagination.pages}`,
      ];

      embed.addFields({
        name: "📈 Statistics",
        value: stats.join("\n"),
        inline: true,
      });

      // Add top user highlight if on first page
      if (page === 1 && leaderboard.users.length > 0) {
        const topUser = leaderboard.users[0];
        embed.addFields({
          name: "👑 Top User",
          value: `<@${topUser.userId}>\nLevel ${topUser.level} • ${topUser.xp.toLocaleString()} XP`,
          inline: true,
        });
      }

      // Add navigation hint
      if (leaderboard.pagination.pages > 1) {
        embed.addFields({
          name: "🔄 Navigation",
          value: `Use \`/leaderboard page:${page + 1}\` for next page`,
          inline: false,
        });
      }

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error executing leaderboard command:", error);
      return this.createGeneralError("Error", "An error occurred while fetching the leaderboard. Please try again.");
    }
  }
}

export default new LeaderboardCommand();

export const builder = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the server's leveling leaderboard")
  .addIntegerOption((option) =>
    option
      .setName("page")
      .setDescription("Page number to view (default: 1)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addIntegerOption((option) =>
    option
      .setName("limit")
      .setDescription("Number of users per page (default: 10, max: 25)")
      .setRequired(false)
      .setMinValue(5)
      .setMaxValue(25)
  );
