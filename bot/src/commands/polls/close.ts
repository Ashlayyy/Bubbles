import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class ClosePollCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "poll-close",
      description: "Close an active poll early",
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
        "You must set `confirm` to `true` to close a poll. This action cannot be undone!"
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

      // Check if poll is already closed
      if (poll.status !== "active") {
        return this.createGeneralError("Poll Already Closed", "This poll is already closed.");
      }

      // Check if poll has naturally ended
      const endTime = new Date(poll.endTime);
      if (endTime < new Date()) {
        return this.createGeneralError("Poll Already Ended", "This poll has already ended naturally.");
      }

      // Close the poll
      const closeResponse = await fetch(`${pollsApiUrl}/api/polls/${this.guild.id}/${pollId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          closedBy: this.user.id,
          closedByName: this.user.username,
        }),
      });

      if (!closeResponse.ok) {
        throw new Error(`API request failed: ${closeResponse.status}`);
      }

      const closeResult = (await closeResponse.json()) as any;

      if (!closeResult.success) {
        return this.createGeneralError("Close Error", closeResult.error || "Failed to close poll");
      }

      const closedPoll = closeResult.data;

      // Create success embed
      const typeEmojis = {
        single: "🔘",
        multiple: "☑️",
        rating: "⭐",
        ranked: "📊",
      };

      const embed = new EmbedBuilder()
        .setTitle("🔒 Poll Closed")
        .setDescription(`Successfully closed poll: **${poll.question}**`)
        .setColor("#ff6600")
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
              `**Duration:** ${this.formatDuration(new Date(poll.createdAt), new Date())}`,
            inline: true,
          },
          {
            name: "⏰ Timeline",
            value:
              `**Created:** <t:${Math.floor(new Date(poll.createdAt).getTime() / 1000)}:R>\n` +
              `**Scheduled End:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
              `**Actually Closed:** <t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Closed by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add final results summary
      if (poll.detailedResults) {
        let resultsText = "";

        if (poll.type === "single" || poll.type === "multiple") {
          const results = poll.detailedResults.choiceCounts;
          if (results && Object.keys(results).length > 0) {
            const winner = Object.entries(results).reduce((a, b) => ((a[1] as number) > (b[1] as number) ? a : b));
            resultsText = `**Winner:** ${winner[0]} (${winner[1]} votes)`;
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
            name: "🏆 Final Results",
            value: resultsText,
            inline: false,
          });
        }
      }

      embed.addFields(
        {
          name: "🆔 Poll ID",
          value: `\`${poll.id}\``,
          inline: true,
        },
        {
          name: "👤 Closed by",
          value: this.formatUserDisplay(this.user),
          inline: true,
        },
        {
          name: "📱 Next Steps",
          value:
            "• Use `/poll-results` to view detailed results\n" +
            "• Use `/poll-list` to see all polls\n" +
            "• Use `/poll-create` to create a new poll",
          inline: false,
        }
      );

      await this.logCommandUsage("poll-close", {
        pollId: poll.id,
        pollType: poll.type,
        finalVotes: poll.voteCount || 0,
        uniqueVoters: poll.uniqueVoters || 0,
        wasEarlyClose: true,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing poll-close command:", error);
      return this.createGeneralError("Error", "An error occurred while closing the poll. Please try again.");
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
}

export default new ClosePollCommand();

export const builder = new SlashCommandBuilder()
  .setName("poll-close")
  .setDescription("Close an active poll early")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) => option.setName("poll-id").setDescription("ID of the poll to close").setRequired(true))
  .addBooleanOption((option) =>
    option.setName("confirm").setDescription("Confirm that you want to close this poll (required)").setRequired(true)
  );
