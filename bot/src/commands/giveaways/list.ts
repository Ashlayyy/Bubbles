import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

class ListGiveawaysCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "giveaway-list",
      description: "View all giveaways in this server",
      category: "giveaways",
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
    const page = this.getIntegerOption("page") ?? 1;
    const status = this.getStringOption("status") ?? "all";
    const createdBy = this.getUserOption("created-by");

    // Validate page number
    if (page < 1) {
      return this.createAdminError("Invalid Page", "Page number must be greater than 0.");
    }

    try {
      const giveawayApiUrl = process.env.API_URL ?? "http://localhost:3001";

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        status,
      });

      if (createdBy) {
        queryParams.append("createdBy", createdBy.id);
      }

      // Make API request to get giveaways
      const response = await fetch(`${giveawayApiUrl}/api/giveaways/${this.guild.id}?${queryParams}`, {
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
        return this.createAdminError("Giveaways Error", result.error || "Failed to fetch giveaways");
      }

      const { giveaways, pagination } = result.data;

      if (!giveaways || giveaways.length === 0) {
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle("🎉 Giveaways")
              .setDescription("No giveaways found!")
              .setColor("#ffa500")
              .addFields({
                name: "📱 Getting Started",
                value: "Create your first giveaway with `/giveaway-create`",
                inline: false,
              })
              .setTimestamp(),
          ],
          ephemeral: false,
        };
      }

      // Format giveaways for display
      const giveawaysText = giveaways
        .map((giveaway: any, index: number) => {
          const giveawayNumber = (page - 1) * 10 + index + 1;
          const endTime = new Date(giveaway.endTime);
          const isActive = giveaway.status === "active" && endTime > new Date();
          const statusIcon = isActive ? "🟢" : "🔴";

          const entryText = giveaway.entryCount > 0 ? ` (${giveaway.entryCount} entries)` : "";

          const winnerText = giveaway.winnerCount > 1 ? ` • ${giveaway.winnerCount} winners` : "";

          return (
            `**${giveawayNumber}.** ${statusIcon} **${giveaway.title}**${entryText}\n` +
            `🏆 ${giveaway.prize}${winnerText}\n` +
            `⏰ <t:${Math.floor(endTime.getTime() / 1000)}:${isActive ? "R" : "F"}>\n` +
            `🆔 \`${giveaway.id}\``
          );
        })
        .join("\n\n");

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle("🎉 Giveaways")
        .setDescription(giveawaysText || "No giveaways to display")
        .setColor("#ff6600")
        .addFields(
          {
            name: "📊 Summary",
            value:
              `**Total Giveaways:** ${pagination.total}\n` +
              `**Status Filter:** ${status.charAt(0).toUpperCase() + status.slice(1)}\n` +
              `**Total Entries:** ${giveaways.reduce((sum: number, g: any) => sum + (Number(g.entryCount) || 0), 0)}`,
            inline: true,
          },
          {
            name: "🔧 Management",
            value:
              "• `/giveaway-create` - Create new giveaway\n" +
              "• `/giveaway-enter` - Enter a giveaway\n" +
              "• `/giveaway-entries` - View giveaway entries\n" +
              "• `/giveaway-end` - End a giveaway early\n" +
              "• `/giveaway-reroll` - Reroll winners\n" +
              "• `/giveaway-delete` - Delete a giveaway",
            inline: true,
          }
        )
        .setFooter({
          text: `Page ${pagination.page}/${pagination.pages} • Total: ${pagination.total} giveaways`,
          iconURL: this.guild.iconURL() || undefined,
        })
        .setTimestamp();

      // Add filter info if filters are applied
      const activeFilters: string[] = [];
      if (status !== "all") activeFilters.push(`Status: ${status}`);
      if (createdBy) activeFilters.push(`Created by: ${createdBy.username}`);

      if (activeFilters.length > 0) {
        embed.addFields({
          name: "🔍 Active Filters",
          value: activeFilters.join(" • "),
          inline: false,
        });
      }

      // Add status legend
      embed.addFields({
        name: "📋 Status Legend",
        value: "🟢 Active • 🔴 Ended",
        inline: false,
      });

      await this.logCommandUsage("giveaway-list", {
        page,
        totalGiveaways: pagination.total,
        status,
        createdBy: createdBy?.id || null,
        activeFilters: activeFilters.length,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing giveaway-list command:", error);
      return this.createAdminError("Error", "An error occurred while fetching giveaways. Please try again.");
    }
  }
}

export default new ListGiveawaysCommand();

export const builder = new SlashCommandBuilder()
  .setName("giveaway-list")
  .setDescription("View all giveaways in this server")
  .addIntegerOption((option) =>
    option.setName("page").setDescription("Page number to view").setRequired(false).setMinValue(1).setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName("status")
      .setDescription("Filter by giveaway status")
      .setRequired(false)
      .addChoices({ name: "All", value: "all" }, { name: "Active", value: "active" }, { name: "Ended", value: "ended" })
  )
  .addUserOption((option) =>
    option.setName("created-by").setDescription("Filter giveaways created by specific user").setRequired(false)
  );
