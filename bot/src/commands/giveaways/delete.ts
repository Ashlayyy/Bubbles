import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

class DeleteGiveawayCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "giveaway-delete",
      description: "Delete a giveaway (cannot be undone)",
      category: "giveaways",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const giveawayId = this.getStringOption("giveaway_id", true);
    const confirm = this.getBooleanOption("confirm") || false;
    const guildId = this.guild.id;

    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      // If not confirmed, show warning first
      if (!confirm) {
        const embed = new EmbedBuilder()
          .setTitle("⚠️ Confirm Giveaway Deletion")
          .setDescription(`Are you sure you want to delete giveaway: **${giveawayId}**?`)
          .setColor("#ff9900")
          .addFields(
            {
              name: "🚨 Warning",
              value: "This action cannot be undone. The giveaway and all its data will be permanently deleted.",
              inline: false,
            },
            {
              name: "📋 To Confirm",
              value: `Run this command again with the \`confirm\` option set to \`true\`:\n\`/giveaway-delete giveaway_id:${giveawayId} confirm:true\``,
              inline: false,
            }
          )
          .setFooter({
            text: `Requested by ${this.user.username}`,
            iconURL: this.user.displayAvatarURL(),
          });

        return { embeds: [embed], ephemeral: false };
      }

      // Get giveaway info first to show in the success message
      const getResponse = await fetch(`${customApiUrl}/api/giveaways/${guildId}/${giveawayId}`, {
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return this.createAdminError("Giveaway Not Found", `No giveaway found with ID: ${giveawayId}`);
        }
        throw new Error(`API request failed: ${getResponse.status}`);
      }

      const getResult = (await getResponse.json()) as any;
      if (!getResult.success) {
        return this.createAdminError("API Error", getResult.error || "Failed to fetch giveaway information");
      }

      const giveawayToDelete = getResult.data;

      // Make API request to delete giveaway
      const response = await fetch(`${customApiUrl}/api/giveaways/${guildId}/${giveawayId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return this.createAdminError("Giveaway Not Found", `No giveaway found with ID: ${giveawayId}`);
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (!result.success) {
        return this.createAdminError("Delete Error", result.error || "Failed to delete giveaway");
      }

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Giveaway Deleted")
        .setDescription(`Successfully deleted giveaway: **${giveawayToDelete.title}**`)
        .setColor("#ff0000")
        .addFields(
          {
            name: "🎁 Prize",
            value: giveawayToDelete.prize,
            inline: true,
          },
          {
            name: "🆔 Giveaway ID",
            value: `\`${giveawayToDelete.id}\``,
            inline: true,
          },
          {
            name: "📊 Total Entries",
            value: `${giveawayToDelete.totalEntries || 0}`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Deleted by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add giveaway details
      embed.addFields(
        {
          name: "📅 Was Scheduled For",
          value: `<t:${Math.floor(new Date(giveawayToDelete.endsAt).getTime() / 1000)}:F>`,
          inline: true,
        },
        {
          name: "👥 Winner Count",
          value: `${giveawayToDelete.winnerCount} winners`,
          inline: true,
        },
        {
          name: "📈 Status",
          value: this.formatStatus(giveawayToDelete.status),
          inline: true,
        }
      );

      // Add description if it existed
      if (giveawayToDelete.description) {
        const description =
          String(giveawayToDelete.description).length > 200
            ? String(giveawayToDelete.description).substring(0, 197) + "..."
            : String(giveawayToDelete.description);

        embed.addFields({
          name: "📄 Description",
          value: description,
          inline: false,
        });
      }

      // Add requirements if any existed
      if (giveawayToDelete.requirements && Object.keys(giveawayToDelete.requirements).length > 0) {
        const requirements: string[] = [];
        const req = giveawayToDelete.requirements;

        if (req.minLevel) requirements.push(`Level ${req.minLevel}+`);
        if (req.requiredRoles?.length) requirements.push(`Role: ${req.requiredRoles.join(", ")}`);
        if (req.blockedRoles?.length) requirements.push(`No roles: ${req.blockedRoles.join(", ")}`);
        if (req.minAccountAge) requirements.push(`Account age: ${req.minAccountAge} days`);
        if (req.minServerTime) requirements.push(`Server time: ${req.minServerTime} days`);

        if (requirements.length > 0) {
          embed.addFields({
            name: "📋 Requirements",
            value: requirements.join(", "),
            inline: false,
          });
        }
      }

      // Add winners if any
      if (giveawayToDelete.winners && giveawayToDelete.winners.length > 0) {
        embed.addFields({
          name: "👑 Winners",
          value: giveawayToDelete.winners.map((winner: any) => `<@${winner.userId}>`).join(", "),
          inline: false,
        });
      }

      embed.addFields({
        name: "✅ Completed",
        value: "The giveaway has been permanently removed from this server.",
        inline: false,
      });

      // Log command usage
      logger.info("Giveaway deleted successfully", {
        giveawayId: giveawayToDelete.id,
        giveawayTitle: giveawayToDelete.title,
        prize: giveawayToDelete.prize,
        status: giveawayToDelete.status,
        totalEntries: giveawayToDelete.totalEntries || 0,
        winnerCount: giveawayToDelete.winnerCount,
        hadWinners: giveawayToDelete.winners?.length > 0,
        userId: this.user.id,
        guildId: this.guild.id,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing giveaway-delete command:", error);
      return this.createAdminError("Error", "An error occurred while deleting the giveaway. Please try again.");
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
}

export default new DeleteGiveawayCommand();

export const builder = new SlashCommandBuilder()
  .setName("giveaway-delete")
  .setDescription("Delete a giveaway (cannot be undone)")
  .setDefaultMemberPermissions(AdminCommand.getDefaultAdminPermissions())
  .addStringOption((option) =>
    option.setName("giveaway_id").setDescription("ID of the giveaway to delete").setRequired(true)
  )
  .addBooleanOption((option) =>
    option.setName("confirm").setDescription("Confirm that you want to delete this giveaway (required for deletion)")
  );
