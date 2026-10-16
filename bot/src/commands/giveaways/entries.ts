import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class GiveawayEntriesCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "giveaway-entries",
      description: "View all entries for a giveaway",
      category: "giveaways",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const giveawayId = this.getStringOption("giveaway_id", true);
    const page = this.getIntegerOption("page") || 1;
    const sortBy = this.getStringOption("sort_by") || "entries";
    const guildId = this.guild.id;

    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        sortBy,
      });

      // Make API request to get giveaway entries
      const response = await fetch(`${customApiUrl}/api/giveaways/${guildId}/${giveawayId}/entries?${params}`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return this.createGeneralError("Giveaway Not Found", `No giveaway found with ID: ${giveawayId}`);
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createGeneralError("API Error", result.error || "Failed to fetch giveaway entries");
      }

      const { giveaway, entries, pagination, statistics } = result.data;

      if (entries.length === 0) {
        const embed = new EmbedBuilder()
          .setColor("#ffa500")
          .setTitle("🎁 Giveaway Entries")
          .setDescription(`No entries found for giveaway: **${giveaway.title}**`)
          .addFields(
            {
              name: "🎁 Prize",
              value: giveaway.prize,
              inline: true,
            },
            {
              name: "🆔 Giveaway ID",
              value: `\`${giveaway.id}\``,
              inline: true,
            },
            {
              name: "📊 Status",
              value: this.formatStatus(giveaway.status),
              inline: true,
            }
          )
          .setFooter({ text: "No participants have entered this giveaway yet." });

        return { embeds: [embed], ephemeral: false };
      }

      // Create embed with entries list
      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("🎁 Giveaway Entries")
        .setDescription(`Entries for: **${giveaway.title}**`)
        .addFields(
          {
            name: "🎁 Prize",
            value: giveaway.prize,
            inline: true,
          },
          {
            name: "🆔 Giveaway ID",
            value: `\`${giveaway.id}\``,
            inline: true,
          },
          {
            name: "📊 Status",
            value: this.formatStatus(giveaway.status),
            inline: true,
          }
        );

      // Add statistics
      if (statistics) {
        embed.addFields(
          {
            name: "📈 Total Entries",
            value: `${statistics.totalEntries}`,
            inline: true,
          },
          {
            name: "👥 Unique Users",
            value: `${statistics.uniqueUsers}`,
            inline: true,
          },
          {
            name: "📊 Avg Entries/User",
            value: `${statistics.averageEntriesPerUser.toFixed(1)}`,
            inline: true,
          }
        );
      }

      // Add entry fields
      const entriesText = entries
        .map((entry: any, index: number) => {
          const position = (page - 1) * 15 + index + 1;
          const chance =
            statistics?.totalEntries > 0 ? ((entry.entries / statistics.totalEntries) * 100).toFixed(2) : "0.00";

          const winnerIcon = entry.isWinner ? "👑 " : "";
          const bonusIcon = entry.bonusEntries > 0 ? "🎉 " : "";

          return `${position}. ${winnerIcon}${bonusIcon}<@${entry.userId}> - **${entry.entries}** entries (${chance}%)`;
        })
        .join("\n");

      embed.addFields({
        name: `📋 Participants (Sorted by ${this.formatSortBy(sortBy)})`,
        value: entriesText,
        inline: false,
      });

      // Add pagination info
      embed.setFooter({
        text: `Page ${pagination.currentPage} of ${pagination.totalPages} • Total: ${pagination.totalItems} participants`,
      });

      // Add legend if there are special entries
      const hasWinners = entries.some((entry: any) => entry.isWinner);
      const hasBonusEntries = entries.some((entry: any) => entry.bonusEntries > 0);

      if (hasWinners || hasBonusEntries) {
        const legend: string[] = [];
        if (hasWinners) legend.push("👑 = Winner");
        if (hasBonusEntries) legend.push("🎉 = Has bonus entries");

        embed.addFields({
          name: "📖 Legend",
          value: legend.join(" • "),
          inline: false,
        });
      }

      // Add giveaway timing information
      const now = Date.now();
      const endTime = new Date(giveaway.endsAt).getTime();

      if (giveaway.status === "active") {
        embed.addFields({
          name: "⏰ Ends",
          value: `<t:${Math.floor(endTime / 1000)}:R>`,
          inline: true,
        });
      } else if (giveaway.status === "ended") {
        embed.addFields({
          name: "🏁 Ended",
          value: `<t:${Math.floor(endTime / 1000)}:R>`,
          inline: true,
        });
      }

      // Add winner information if giveaway is ended
      if (giveaway.status === "ended" && giveaway.winners?.length > 0) {
        embed.addFields({
          name: "👑 Winners",
          value: giveaway.winners.map((winner: any) => `<@${winner.userId}>`).join(", "),
          inline: false,
        });
      }

      await this.logCommandUsage("giveaway-entries", {
        giveawayId: giveaway.id,
        giveawayTitle: giveaway.title,
        page,
        sortBy,
        entriesShown: entries.length,
        totalEntries: statistics?.totalEntries || 0,
        uniqueUsers: statistics?.uniqueUsers || 0,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing giveaway-entries command:", error);
      return this.createGeneralError("Error", "An error occurred while fetching giveaway entries. Please try again.");
    }
  }

  private formatStatus(status: string): string {
    switch (status) {
      case "active":
        return "🟢 Active";
      case "ended":
        return "🔴 Ended";
      case "cancelled":
        return "⚫ Cancelled";
      default:
        return status;
    }
  }

  private formatSortBy(sortBy: string): string {
    switch (sortBy) {
      case "entries":
        return "Entry Count";
      case "joined":
        return "Join Date";
      case "username":
        return "Username";
      default:
        return sortBy;
    }
  }
}

export default new GiveawayEntriesCommand();

export const builder = new SlashCommandBuilder()
  .setName("giveaway-entries")
  .setDescription("View all entries for a giveaway")
  .addStringOption((option) =>
    option.setName("giveaway_id").setDescription("ID of the giveaway to view entries for").setRequired(true)
  )
  .addIntegerOption((option) => option.setName("page").setDescription("Page number (default: 1)").setMinValue(1))
  .addStringOption((option) =>
    option
      .setName("sort_by")
      .setDescription("How to sort the entries")
      .addChoices(
        { name: "Entry Count (Most first)", value: "entries" },
        { name: "Join Date (Latest first)", value: "joined" },
        { name: "Username (A-Z)", value: "username" }
      )
  );
