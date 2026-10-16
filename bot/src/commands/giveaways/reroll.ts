import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

class RerollGiveawayCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "giveaway-reroll",
      description: "Reroll winners for a completed giveaway",
      category: "giveaways",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const giveawayId = this.getStringOption("giveaway_id", true);
    const winnerCount = this.getIntegerOption("winner_count");
    const guildId = this.guild.id;

    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // Make API request to reroll giveaway
      const response = await fetch(`${customApiUrl}/api/giveaways/${guildId}/${giveawayId}/reroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          winnerCount: winnerCount || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return this.createAdminError("Giveaway Not Found", `No giveaway found with ID: ${giveawayId}`);
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createAdminError("Reroll Error", result.error || "Failed to reroll giveaway");
      }

      const { giveaway, newWinners, previousWinners } = result.data;

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🎲 Giveaway Rerolled!")
        .setDescription(`Successfully rerolled winners for: **${giveaway.title}**`)
        .setColor("#ff9900")
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
            name: "📊 Total Entries",
            value: `${giveaway.totalEntries} users`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Rerolled by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add previous winners if any
      if (previousWinners && previousWinners.length > 0) {
        embed.addFields({
          name: "👑 Previous Winners",
          value: previousWinners.map((winner: any) => `<@${winner.userId}>`).join(", "),
          inline: false,
        });
      }

      // Add new winners
      if (newWinners && newWinners.length > 0) {
        embed.addFields({
          name: "🎉 New Winners",
          value: newWinners.map((winner: any) => `<@${winner.userId}>`).join(", "),
          inline: false,
        });

        // Add winner details if available
        if (newWinners.length <= 5) {
          const winnerDetails = newWinners.map((winner: any, index: number) => {
            const chance =
              giveaway.totalEntries > 0 ? ((winner.entries / giveaway.totalEntries) * 100).toFixed(2) : "0.00";
            return `${index + 1}. <@${winner.userId}> - ${winner.entries} entries (${chance}% chance)`;
          });

          embed.addFields({
            name: "📋 Winner Details",
            value: winnerDetails.join("\n"),
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: "❌ No New Winners",
          value: "No eligible participants found for reroll.",
          inline: false,
        });
      }

      // Add reroll information
      embed.addFields(
        {
          name: "🔄 Reroll Info",
          value: [
            `• Rerolled at: <t:${Math.floor(Date.now() / 1000)}:F>`,
            `• New winner count: ${newWinners?.length || 0}`,
            `• Previous winner count: ${previousWinners?.length || 0}`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "ℹ️ Note",
          value:
            "The previous winners have been notified about the reroll. New winners will receive their prizes separately.",
          inline: false,
        }
      );

      // Log command usage
      logger.info("Giveaway rerolled successfully", {
        giveawayId: giveaway.id,
        giveawayTitle: giveaway.title,
        newWinnerCount: newWinners?.length || 0,
        previousWinnerCount: previousWinners?.length || 0,
        totalEntries: giveaway.totalEntries,
        requestedWinnerCount: winnerCount,
        userId: this.user.id,
        guildId: this.guild.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing giveaway-reroll command:", error);
      return this.createAdminError("Error", "An error occurred while rerolling the giveaway. Please try again.");
    }
  }
}

export default new RerollGiveawayCommand();

export const builder = new SlashCommandBuilder()
  .setName("giveaway-reroll")
  .setDescription("Reroll winners for a completed giveaway")
  .setDefaultMemberPermissions(AdminCommand.getDefaultAdminPermissions())
  .addStringOption((option) =>
    option.setName("giveaway_id").setDescription("ID of the giveaway to reroll").setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName("winner_count")
      .setDescription("Number of new winners to select (defaults to original winner count)")
      .setMinValue(1)
      .setMaxValue(20)
  );
