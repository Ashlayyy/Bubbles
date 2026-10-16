import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class PollResultsCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "poll-results",
      description: "View detailed results and analytics for a poll",
      category: "polls",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const pollId = this.getStringOption("poll-id", true);
    const showVotes = this.getBooleanOption("show-votes") ?? false;

    try {
      const pollsApiUrl = process.env.API_URL || "http://localhost:3001";

      // Get poll with detailed results
      const pollResponse = await fetch(
        `${pollsApiUrl}/api/polls/${this.guild.id}/${pollId}?includeVotes=${showVotes}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.API_TOKEN}`,
          },
        }
      );

      if (!pollResponse.ok) {
        if (pollResponse.status === 404) {
          return this.createGeneralError("Poll Not Found", "The specified poll was not found.");
        }
        throw new Error(`API request failed: ${pollResponse.status}`);
      }

      const pollResult = (await pollResponse.json()) as any;

      if (!pollResult.success) {
        return this.createGeneralError("Error", pollResult.error || "Failed to fetch poll results");
      }

      const poll = pollResult.data;
      const endTime = new Date(poll.endTime);
      const isActive = poll.status === "active" && endTime > new Date();

      // Create main results embed
      const typeEmojis = {
        single: "🔘",
        multiple: "☑️",
        rating: "⭐",
        ranked: "📊",
      };

      const embed = new EmbedBuilder()
        .setTitle("📊 Poll Results")
        .setDescription(`**${poll.question}**`)
        .setColor(isActive ? "#00ff00" : "#808080")
        .addFields(
          {
            name: "🗳️ Poll Type",
            value: `${typeEmojis[poll.type]} ${poll.type.charAt(0).toUpperCase() + poll.type.slice(1)}`,
            inline: true,
          },
          {
            name: "📊 Status",
            value: isActive ? "🟢 Active" : "🔴 Closed",
            inline: true,
          },
          {
            name: "⏰ End Time",
            value: `<t:${Math.floor(endTime.getTime() / 1000)}:${isActive ? "R" : "F"}>`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Poll ID: ${poll.id}`,
          iconURL: this.guild.iconURL() || undefined,
        });

      // Add participation stats
      embed.addFields({
        name: "👥 Participation",
        value:
          `**Total Votes:** ${poll.voteCount || 0}\n` +
          `**Unique Voters:** ${poll.uniqueVoters || 0}\n` +
          `**Anonymous:** ${poll.anonymous ? "✅ Yes" : "❌ No"}`,
        inline: true,
      });

      // Add results based on poll type
      if (poll.type === "single" || poll.type === "multiple") {
        const results = poll.detailedResults;
        if (results?.choiceCounts) {
          const totalVotes = results.totalVotes || 0;
          const resultText = Object.entries(results.choiceCounts)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([choice, count]) => {
              const percentage = totalVotes > 0 ? (((count as number) / totalVotes) * 100).toFixed(1) : "0.0";
              const barLength = totalVotes > 0 ? Math.round(((count as number) / totalVotes) * 10) : 0;
              const bar = "█".repeat(barLength) + "░".repeat(10 - barLength);
              return `**${choice}**\n${bar} ${count} votes (${percentage}%)`;
            })
            .join("\n\n");

          embed.addFields({
            name: "📊 Results",
            value: resultText || "No votes yet",
            inline: false,
          });
        }
      } else if (poll.type === "rating") {
        const results = poll.detailedResults;
        if (results && results.averageRating !== undefined) {
          const avgRating = results.averageRating;
          const totalRatings = results.totalRatings || 0;
          const stars = "⭐".repeat(Math.round(avgRating));

          embed.addFields({
            name: "⭐ Rating Results",
            value:
              `**Average Rating:** ${avgRating.toFixed(2)}/5 ${stars}\n` +
              `**Total Ratings:** ${totalRatings}\n` +
              `**Median:** ${results.median || 0}`,
            inline: false,
          });

          // Add rating distribution
          if (results.ratingDistribution) {
            const distText = Object.entries(results.ratingDistribution)
              .sort(([a], [b]) => parseInt(b) - parseInt(a))
              .map(([rating, count]) => {
                const percentage = totalRatings > 0 ? (((count as number) / totalRatings) * 100).toFixed(1) : "0.0";
                return `⭐ ${rating}: ${count} votes (${percentage}%)`;
              })
              .join("\n");

            embed.addFields({
              name: "📈 Rating Distribution",
              value: distText,
              inline: false,
            });
          }
        }
      } else if (poll.type === "ranked") {
        const results = poll.detailedResults;
        if (results?.winner) {
          embed.addFields({
            name: "🏆 Winner",
            value: `**${results.winner}**\n` + `Winner determined by instant runoff voting`,
            inline: false,
          });

          if (results.rounds && results.rounds.length > 0) {
            const roundsText = results.rounds
              .map((round: any, index: number) => {
                const roundNum = index + 1;
                const eliminated = round.eliminated || "None";
                return `**Round ${roundNum}:** Eliminated ${eliminated}`;
              })
              .join("\n");

            embed.addFields({
              name: "📊 Elimination Rounds",
              value: roundsText,
              inline: false,
            });
          }
        }
      }

      // Add settings info
      embed.addFields({
        name: "⚙️ Settings",
        value:
          `**Allow Changes:** ${poll.allowChanges ? "✅ Yes" : "❌ No"}\n` +
          `**Max Votes per User:** ${poll.maxVotesPerUser || 1}\n` +
          `**Created:** <t:${Math.floor(new Date(poll.createdAt).getTime() / 1000)}:R>`,
        inline: true,
      });

      // Add individual votes if requested and not anonymous
      if (showVotes && !poll.anonymous && poll.votes && poll.votes.length > 0) {
        const votesText = poll.votes
          .slice(0, 10) // Limit to first 10 votes
          .map((vote: any) => {
            const username = vote.username || vote.userId;
            let voteDetail = "";

            if (poll.type === "single" || poll.type === "multiple") {
              voteDetail = vote.choices?.join(", ") || "No choices";
            } else if (poll.type === "rating") {
              voteDetail = `${vote.rating}/5 ⭐`;
            } else if (poll.type === "ranked") {
              voteDetail = vote.ranking?.join(" → ") || "No ranking";
            }

            return `**${username}:** ${voteDetail}`;
          })
          .join("\n");

        embed.addFields({
          name: "🗳️ Individual Votes",
          value: votesText + (poll.votes.length > 10 ? `\n... and ${poll.votes.length - 10} more` : ""),
          inline: false,
        });
      }

      embed.addFields({
        name: "📱 Actions",
        value: isActive
          ? "• Use `/poll-vote` to cast your vote\n• Use `/poll-close` to end the poll early\n• Use `/poll-list` to see all polls"
          : "• Use `/poll-list` to see all polls\n• Use `/poll-create` to create a new poll",
        inline: false,
      });

      await this.logCommandUsage("poll-results", {
        pollId: poll.id,
        pollType: poll.type,
        totalVotes: poll.voteCount || 0,
        isActive,
        showVotes: showVotes && !poll.anonymous,
      });

      return { embeds: [embed], ephemeral: false };
    } catch (error) {
      logger.error("Error executing poll-results command:", error);
      return this.createGeneralError("Error", "An error occurred while fetching poll results. Please try again.");
    }
  }
}

export default new PollResultsCommand();

export const builder = new SlashCommandBuilder()
  .setName("poll-results")
  .setDescription("View detailed results and analytics for a poll")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) =>
    option.setName("poll-id").setDescription("ID of the poll to view results for").setRequired(true)
  )
  .addBooleanOption((option) =>
    option
      .setName("show-votes")
      .setDescription("Show individual votes (only for non-anonymous polls)")
      .setRequired(false)
  );
