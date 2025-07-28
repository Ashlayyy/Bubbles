import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

class EndGiveawayCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "giveaway-end",
      description: "End an active giveaway early and select winners",
      category: "giveaways",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const giveawayId = this.getStringOption("giveaway-id", true);
    const confirm = this.getBooleanOption("confirm") ?? false;

    if (!confirm) {
      return this.createAdminError(
        "Confirmation Required",
        "You must set `confirm` to `true` to end a giveaway early. This will immediately select winners!"
      );
    }

    try {
      const giveawayApiUrl = process.env.API_URL || "http://localhost:3001";

      // First, get giveaway details for confirmation message
      const giveawayResponse = await fetch(`${giveawayApiUrl}/api/giveaways/${this.guild.id}/${giveawayId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!giveawayResponse.ok) {
        if (giveawayResponse.status === 404) {
          return this.createAdminError("Giveaway Not Found", "The specified giveaway was not found.");
        }
        throw new Error(`API request failed: ${giveawayResponse.status}`);
      }

      const giveawayResult = (await giveawayResponse.json()) as any;

      if (!giveawayResult.success) {
        return this.createAdminError("Error", giveawayResult.error || "Failed to fetch giveaway details");
      }

      const giveaway = giveawayResult.data;

      // Check if giveaway is already ended
      if (giveaway.status !== "active") {
        return this.createAdminError("Giveaway Already Ended", "This giveaway has already ended.");
      }

      // Check if giveaway has entries
      if (!giveaway.entryCount || giveaway.entryCount === 0) {
        return this.createAdminError("No Entries", "This giveaway has no entries. Cannot select winners.");
      }

      // End the giveaway
      const endResponse = await fetch(`${giveawayApiUrl}/api/giveaways/${this.guild.id}/${giveawayId}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          endedBy: this.user.id,
          endedByName: this.user.username,
        }),
      });

      if (!endResponse.ok) {
        throw new Error(`API request failed: ${endResponse.status}`);
      }

      const endResult = (await endResponse.json()) as any;

      if (!endResult.success) {
        return this.createAdminError("End Error", endResult.error || "Failed to end giveaway");
      }

      const endedGiveaway = endResult.data;
      const endTime = new Date(giveaway.endTime);

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🏆 Giveaway Ended!")
        .setDescription(`**${giveaway.title}** has been ended early`)
        .setColor("#gold")
        .addFields(
          {
            name: "🏆 Prize",
            value: giveaway.prize,
            inline: false,
          },
          {
            name: "📊 Final Statistics",
            value:
              `**Total Entries:** ${giveaway.entryCount}\n` +
              `**Winners Selected:** ${giveaway.winnerCount}\n` +
              `**Duration:** ${this.formatDuration(new Date(giveaway.createdAt), new Date())}`,
            inline: true,
          },
          {
            name: "⏰ Timeline",
            value:
              `**Created:** <t:${Math.floor(new Date(giveaway.createdAt).getTime() / 1000)}:R>\n` +
              `**Scheduled End:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
              `**Actually Ended:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Ended by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add winners if available
      if (endedGiveaway.winners && endedGiveaway.winners.length > 0) {
        const winnersText = endedGiveaway.winners
          .map((winnerId: string, index: number) => {
            return `**${index + 1}.** <@${winnerId}>`;
          })
          .join("\n");

        embed.addFields({
          name: "🎉 Winners",
          value: winnersText,
          inline: false,
        });
      } else {
        embed.addFields({
          name: "❌ No Winners",
          value: "Unable to select winners from available entries.",
          inline: false,
        });
      }

      // Add description if available
      if (giveaway.description) {
        embed.addFields({
          name: "📋 Description",
          value: giveaway.description,
          inline: false,
        });
      }

      embed.addFields(
        {
          name: "🆔 Giveaway ID",
          value: `\`${giveaway.id}\``,
          inline: true,
        },
        {
          name: "👤 Ended by",
          value: this.formatUserDisplay(this.user),
          inline: true,
        },
        {
          name: "📱 Next Steps",
          value:
            "• Winners have been automatically notified\n" +
            "• Use `/giveaway-reroll` to select different winners\n" +
            "• Use `/giveaway-list` to see all giveaways\n" +
            "• Use `/giveaway-create` to create a new giveaway",
          inline: false,
        }
      );

      // Log command usage
      logger.info("Giveaway ended successfully", {
        giveawayId: giveaway.id,
        giveawayTitle: giveaway.title,
        totalEntries: giveaway.entryCount,
        winnerCount: giveaway.winnerCount,
        winnersSelected: endedGiveaway.winners?.length || 0,
        wasEarlyEnd: true,
        userId: this.user.id,
        guildId: this.guild.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing giveaway-end command:", error);
      return this.createAdminError("Error", "An error occurred while ending the giveaway. Please try again.");
    }
  }

  private formatDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private formatUserDisplay(user: { displayName?: string; username?: string }): string {
    return user.displayName ?? user.username ?? "Unknown User";
  }
}

export default new EndGiveawayCommand();

export const builder = new SlashCommandBuilder()
  .setName("giveaway-end")
  .setDescription("End an active giveaway early and select winners")
  .setDefaultMemberPermissions(AdminCommand.getDefaultAdminPermissions())
  .addStringOption((option) =>
    option.setName("giveaway-id").setDescription("ID of the giveaway to end").setRequired(true)
  )
  .addBooleanOption((option) =>
    option.setName("confirm").setDescription("Confirm that you want to end the giveaway").setRequired(true)
  );
