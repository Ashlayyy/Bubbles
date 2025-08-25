import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

class ListPollsCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "poll-list",
      description: "View all polls in this server",
      category: "polls",
      ephemeral: false,
      guildOnly: true,
      permissions: {
        level: PermissionLevel.ADMIN,
        isConfigurable: false,
        discordPermissions: [PermissionsBitField.Flags.Administrator],
      },
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const page = this.getIntegerOption("page") || 1;
    const status = this.getStringOption("status") || "all";
    const type = this.getStringOption("type");
    const createdBy = this.getUserOption("created-by");

    // Validate page number
    if (page < 1) {
      return this.createAdminError("Invalid Page", "Page number must be greater than 0.");
    }

    try {
      const pollsApiUrl = process.env.API_URL || "http://localhost:3001";

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        status,
      });

      if (type) {
        queryParams.append("type", type);
      }

      if (createdBy) {
        queryParams.append("createdBy", createdBy.id);
      }

      // Make API request to get polls
      const response = await fetch(`${pollsApiUrl}/api/polls/${this.guild.id}?${queryParams}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createAdminError("Polls Error", result.error || "Failed to fetch polls");
      }

      const { polls, pagination } = result.data;

      if (!polls || polls.length === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle("📊 Polls")
              .setDescription("No polls found!")
              .setColor("#ffa500")
              .addFields({
                name: "📱 Getting Started",
                value: "Create your first poll with `/poll-create`",
                inline: false,
              })
              .setTimestamp(),
          ],
          ephemeral: false,
        };
      }

      // Format polls for display
      const typeEmojis = {
        single: "🔘",
        multiple: "☑️",
        rating: "⭐",
        ranked: "📊",
      };

      const pollsText = polls
        .map((poll: any, index: number) => {
          const pollNumber = (page - 1) * 10 + index + 1;
          const endTime = new Date(poll.endTime);
          const isActive = poll.status === "active" && endTime > new Date();
          const statusIcon = isActive ? "🟢" : "🔴";

          const voteText = poll.voteCount > 0 ? ` (${poll.voteCount} votes)` : "";

          return (
            `**${pollNumber}.** ${statusIcon} ${typeEmojis[poll.type]} **${poll.question}**${voteText}\n` +
            `⏰ <t:${Math.floor(endTime.getTime() / 1000)}:${isActive ? "R" : "F"}>\n` +
            `🆔 \`${poll.id}\``
          );
        })
        .join("\n\n");

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle("📊 Polls")
        .setDescription(pollsText || "No polls to display")
        .setColor("#9932cc")
        .addFields(
          {
            name: "📈 Summary",
            value:
              `**Total Polls:** ${pagination.total}\n` +
              `**Status Filter:** ${status.charAt(0).toUpperCase() + status.slice(1)}\n` +
              `**Total Votes:** ${polls.reduce((sum: number, p: any) => sum + ((p.voteCount as number) || 0), 0)}`,
            inline: true,
          },
          {
            name: "🔧 Management",
            value:
              "• `/poll-create` - Create new poll\n" +
              "• `/poll-vote` - Vote on a poll\n" +
              "• `/poll-results` - View poll results\n" +
              "• `/poll-close` - Close an active poll\n" +
              "• `/poll-delete` - Delete a poll",
            inline: true,
          }
        )
        .setFooter({
          text: `Page ${pagination.page}/${pagination.pages} • Total: ${pagination.total} polls`,
          iconURL: this.guild.iconURL() || undefined,
        })
        .setTimestamp();

      // Add filter info if filters are applied
      const activeFilters: string[] = [];
      if (status !== "all") activeFilters.push(`Status: ${status}`);
      if (type) activeFilters.push(`Type: ${type}`);
      if (createdBy) activeFilters.push(`Created by: ${createdBy.username}`);

      if (activeFilters.length > 0) {
        embed.addFields({
          name: "🔍 Active Filters",
          value: activeFilters.join(" • "),
          inline: false,
        });
      }

      // Add poll type legend
      embed.addFields({
        name: "📋 Poll Types",
        value: "🔘 Single Choice • ☑️ Multiple Choice • ⭐ Rating • 📊 Ranked Choice",
        inline: false,
      });

      await this.logCommandUsage("poll-list", {
        page,
        totalPolls: pagination.total,
        status,
        type: type || null,
        createdBy: createdBy?.id || null,
        activeFilters: activeFilters.length,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing poll-list command:", error);
      return this.createAdminError("Error", "An error occurred while fetching polls. Please try again.");
    }
  }
}

export default new ListPollsCommand();

export const builder = new SlashCommandBuilder()
  .setName("poll-list")
  .setDescription("View all polls in this server")
  .setDefaultMemberPermissions("0")
  .addIntegerOption((option) =>
    option.setName("page").setDescription("Page number to view").setRequired(false).setMinValue(1).setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName("status")
      .setDescription("Filter by poll status")
      .setRequired(false)
      .addChoices(
        { name: "All", value: "all" },
        { name: "Active", value: "active" },
        { name: "Closed", value: "closed" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Filter by poll type")
      .setRequired(false)
      .addChoices(
        { name: "🔘 Single Choice", value: "single" },
        { name: "☑️ Multiple Choice", value: "multiple" },
        { name: "⭐ Rating", value: "rating" },
        { name: "📊 Ranked Choice", value: "ranked" }
      )
  )
  .addUserOption((option) =>
    option.setName("created-by").setDescription("Filter polls created by specific user").setRequired(false)
  );
