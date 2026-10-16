import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class DeletePollCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "poll-delete",
      description: "Delete a poll completely",
      category: "polls",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const pollId = this.getStringOption("poll-id", true);
    const confirm = this.getBooleanOption("confirm") ?? false;

    if (!confirm) {
      return this.createGeneralError(
        "Confirmation Required",
        "You must set `confirm` to `true` to delete a poll. This action cannot be undone and will remove all votes!"
      );
    }

    try {
      const pollsApiUrl = process.env.API_URL || "http://localhost:3001";

      // First, get poll details for confirmation message
      const pollResponse = await fetch(`${pollsApiUrl}/api/polls/${this.guild.id}/${pollId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!pollResponse.ok) {
        if (pollResponse.status === 404) {
          return this.createGeneralError("Poll Not Found", "The specified poll was not found.");
        }
        throw new Error(`API request failed: ${pollResponse.status}`);
      }

      const pollResult = (await pollResponse.json()) as any;

      if (!pollResult.success) {
        return this.createGeneralError("Error", pollResult.error || "Failed to fetch poll details");
      }

      const poll = pollResult.data;

      // Delete the poll
      const deleteResponse = await fetch(`${pollsApiUrl}/api/polls/${this.guild.id}/${pollId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          deletedBy: this.user.id,
          deletedByName: this.user.username,
        }),
      });

      if (!deleteResponse.ok) {
        throw new Error(`API request failed: ${deleteResponse.status}`);
      }

      const deleteResult = (await deleteResponse.json()) as any;

      if (!deleteResult.success) {
        return this.createGeneralError("Deletion Error", deleteResult.error || "Failed to delete poll");
      }

      const endTime = new Date(poll.endTime);
      const wasActive = poll.status === "active" && endTime > new Date();

      // Create success embed
      const typeEmojis = {
        single: "🔘",
        multiple: "☑️",
        rating: "⭐",
        ranked: "📊",
      };

      const embed = new EmbedBuilder()
        .setTitle("🗑️ Poll Deleted")
        .setDescription(`Successfully deleted poll: **${poll.question}**`)
        .setColor("#ff0000")
        .addFields(
          {
            name: "📊 Poll Type",
            value: `${typeEmojis[poll.type]} ${poll.type.charAt(0).toUpperCase() + poll.type.slice(1)}`,
            inline: true,
          },
          {
            name: "📈 Final Statistics",
            value:
              `**Total Votes:** ${poll.voteCount || 0}\n` +
              `**Unique Voters:** ${poll.uniqueVoters || 0}\n` +
              `**Status:** ${wasActive ? "🟢 Was Active" : "🔴 Was Closed"}`,
            inline: true,
          },
          {
            name: "⏰ Timeline",
            value:
              `**Created:** <t:${Math.floor(new Date(poll.createdAt).getTime() / 1000)}:R>\n` +
              `**Scheduled End:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
              `**Deleted:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Deleted by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add poll details if available
      if (poll.options && poll.options.length > 0) {
        const optionsText = poll.options
          .slice(0, 5) // Show first 5 options
          .map((option: string, index: number) => `**${index + 1}.** ${option}`)
          .join("\n");

        embed.addFields({
          name: "📝 Poll Options",
          value: optionsText + (poll.options.length > 5 ? `\n... and ${poll.options.length - 5} more` : ""),
          inline: false,
        });
      }

      // Add final results if poll had votes
      if (poll.voteCount > 0 && poll.detailedResults) {
        let resultsText = "";

        if (poll.type === "single" || poll.type === "multiple") {
          const results = poll.detailedResults.choiceCounts;
          if (results && Object.keys(results).length > 0) {
            const winner = Object.entries(results).reduce((a, b) => ((a[1] as number) > (b[1] as number) ? a : b));
            resultsText = `**Leading Option:** ${winner[0]} (${winner[1]} votes)`;
          }
        } else if (poll.type === "rating") {
          const avgRating = poll.detailedResults.averageRating || 0;
          const stars = "⭐".repeat(Math.round(avgRating));
          resultsText = `**Average Rating:** ${avgRating.toFixed(2)}/5 ${stars}`;
        } else if (poll.type === "ranked") {
          const winner = poll.detailedResults.winner;
          resultsText = winner ? `**Winner:** ${winner}` : "No winner determined";
        }

        if (resultsText) {
          embed.addFields({
            name: "📊 Final Results",
            value: resultsText,
            inline: false,
          });
        }
      }

      embed.addFields(
        {
          name: "🆔 Deleted Poll ID",
          value: `\`${poll.id}\``,
          inline: true,
        },
        {
          name: "👤 Deleted by",
          value: this.formatUserDisplay(this.user),
          inline: true,
        },
        {
          name: "⚠️ Important",
          value: wasActive
            ? "This poll was active when deleted - participants have been notified."
            : "This poll was already closed when deleted.",
          inline: false,
        },
        {
          name: "📱 Next Steps",
          value:
            "• Use `/poll-list` to view remaining polls\n" +
            "• Use `/poll-create` to create a new poll\n" +
            "• Consider creating a replacement poll if needed",
          inline: false,
        }
      );

      await this.logCommandUsage("poll-delete", {
        pollId: poll.id,
        pollType: poll.type,
        finalVotes: poll.voteCount || 0,
        uniqueVoters: poll.uniqueVoters || 0,
        wasActive,
        question: poll.question,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing poll-delete command:", error);
      return this.createGeneralError("Error", "An error occurred while deleting the poll. Please try again.");
    }
  }
}

export default new DeletePollCommand();

export const builder = new SlashCommandBuilder()
  .setName("poll-delete")
  .setDescription("Delete a poll completely")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) => option.setName("poll-id").setDescription("ID of the poll to delete").setRequired(true))
  .addBooleanOption((option) =>
    option.setName("confirm").setDescription("Confirm that you want to delete this poll (required)").setRequired(true)
  );
