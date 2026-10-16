import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class VotePollCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "poll-vote",
      description: "Vote on a poll",
      category: "polls",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const pollId = this.getStringOption("poll-id", true);
    const choices = this.getStringOption("choices");
    const rating = this.getIntegerOption("rating");
    const ranking = this.getStringOption("ranking");

    try {
      const pollsApiUrl = process.env.API_URL || "http://localhost:3001";

      // First, get poll details to determine type and validate vote
      const pollResponse = await fetch(`${pollsApiUrl}/api/polls/${this.guild.id}/${pollId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      });

      if (!pollResponse.ok) {
        if (pollResponse.status === 404) {
          return this.createGeneralError(
            "Poll Not Found",
            "The specified poll was not found. Use `/poll-list` to see available polls."
          );
        }
        throw new Error(`API request failed: ${pollResponse.status}`);
      }

      const pollResult = (await pollResponse.json()) as any;

      if (!pollResult.success) {
        return this.createGeneralError("Error", pollResult.error || "Failed to fetch poll details");
      }

      const poll = pollResult.data;

      // Check if poll is still active
      if (poll.status !== "active") {
        return this.createGeneralError("Poll Closed", "This poll is no longer accepting votes.");
      }

      // Check if poll has ended
      const endTime = new Date(poll.endTime);
      if (endTime < new Date()) {
        return this.createGeneralError("Poll Expired", "This poll has already ended.");
      }

      // Validate vote based on poll type
      const voteData: any = {};

      if (poll.type === "single") {
        if (!choices) {
          return this.createGeneralError(
            "Missing Choice",
            'Please provide a choice using the `choices` parameter (e.g., "1" for option 1).'
          );
        }

        const choiceNumbers = choices.split(",").map((c) => c.trim());
        if (choiceNumbers.length !== 1) {
          return this.createGeneralError("Invalid Choice", "Single choice polls allow only one selection.");
        }

        const choiceIndex = parseInt(choiceNumbers[0]) - 1;
        if (choiceIndex < 0 || choiceIndex >= poll.options.length) {
          return this.createGeneralError(
            "Invalid Choice",
            `Please choose a number between 1 and ${poll.options.length}.`
          );
        }

        voteData.choices = [poll.options[choiceIndex]];
      } else if (poll.type === "multiple") {
        if (!choices) {
          return this.createGeneralError(
            "Missing Choices",
            'Please provide your choices using the `choices` parameter (e.g., "1,3,5" for options 1, 3, and 5).'
          );
        }

        const choiceNumbers = choices.split(",").map((c) => c.trim());
        const selectedChoices: string[] = [];

        for (const choiceNum of choiceNumbers) {
          const choiceIndex = parseInt(choiceNum) - 1;
          if (choiceIndex < 0 || choiceIndex >= poll.options.length) {
            return this.createGeneralError(
              "Invalid Choice",
              `Choice ${choiceNum} is invalid. Please choose numbers between 1 and ${poll.options.length}.`
            );
          }
          selectedChoices.push(poll.options[choiceIndex]);
        }

        voteData.choices = selectedChoices;
      } else if (poll.type === "rating") {
        if (rating === null || rating === undefined) {
          return this.createGeneralError(
            "Missing Rating",
            "Please provide a rating using the `rating` parameter (1-5)."
          );
        }

        if (rating < 1 || rating > 5) {
          return this.createGeneralError("Invalid Rating", "Rating must be between 1 and 5.");
        }

        voteData.rating = rating;
      } else if (poll.type === "ranked") {
        if (!ranking) {
          return this.createGeneralError(
            "Missing Ranking",
            'Please provide your ranking using the `ranking` parameter (e.g., "1,3,2" to rank option 1 first, option 3 second, option 2 third).'
          );
        }

        const rankingNumbers = ranking.split(",").map((r) => r.trim());
        if (rankingNumbers.length !== poll.options.length) {
          return this.createGeneralError(
            "Invalid Ranking",
            `Please rank all ${poll.options.length} options in order of preference.`
          );
        }

        const rankedChoices: string[] = [];
        for (const rankNum of rankingNumbers) {
          const rankIndex = parseInt(rankNum) - 1;
          if (rankIndex < 0 || rankIndex >= poll.options.length) {
            return this.createGeneralError(
              "Invalid Ranking",
              `Ranking ${rankNum} is invalid. Please use numbers between 1 and ${poll.options.length}.`
            );
          }
          rankedChoices.push(poll.options[rankIndex]);
        }

        voteData.ranking = rankedChoices;
      }

      // Submit vote
      const voteResponse = await fetch(`${pollsApiUrl}/api/polls/${this.guild.id}/${pollId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          userId: this.user.id,
          username: this.user.username,
          ...voteData,
        }),
      });

      if (!voteResponse.ok) {
        throw new Error(`API request failed: ${voteResponse.status}`);
      }

      const voteResult = (await voteResponse.json()) as any;

      if (!voteResult.success) {
        return this.createGeneralError("Vote Error", voteResult.error || "Failed to submit vote");
      }

      // Create success embed
      const typeEmojis = {
        single: "🔘",
        multiple: "☑️",
        rating: "⭐",
        ranked: "📊",
      };

      const embed = new EmbedBuilder()
        .setTitle("🗳️ Vote Submitted Successfully")
        .setDescription(`Your vote has been recorded for: **${poll.question}**`)
        .setColor("#00ff00")
        .addFields(
          {
            name: "📊 Poll Type",
            value: `${typeEmojis[poll.type]} ${poll.type.charAt(0).toUpperCase() + poll.type.slice(1)}`,
            inline: true,
          },
          {
            name: "🆔 Poll ID",
            value: `\`${poll.id}\``,
            inline: true,
          },
          {
            name: "⏰ Time Left",
            value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Vote by ${this.user.username}`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add vote details based on type
      if (poll.type === "single") {
        const choiceIndex = poll.options.indexOf(voteData.choices[0]);
        embed.addFields({
          name: "✅ Your Choice",
          value: `**${choiceIndex + 1}.** ${voteData.choices[0]}`,
          inline: false,
        });
      } else if (poll.type === "multiple") {
        const choicesText = voteData.choices
          .map((choice: string) => {
            const choiceIndex = poll.options.indexOf(choice);
            return `**${choiceIndex + 1}.** ${choice}`;
          })
          .join("\n");

        embed.addFields({
          name: "✅ Your Choices",
          value: choicesText,
          inline: false,
        });
      } else if (poll.type === "rating") {
        const stars = "⭐".repeat(voteData.rating);
        embed.addFields({
          name: "⭐ Your Rating",
          value: `${stars} (${voteData.rating}/5)`,
          inline: false,
        });
      } else if (poll.type === "ranked") {
        const rankingText = voteData.ranking
          .map((choice: string, index: number) => {
            const choiceIndex = poll.options.indexOf(choice);
            return `**${index + 1}.** ${choice} (Option ${choiceIndex + 1})`;
          })
          .join("\n");

        embed.addFields({
          name: "📊 Your Ranking",
          value: rankingText,
          inline: false,
        });
      }

      // Add vote change information
      if (poll.allowChanges) {
        embed.addFields({
          name: "🔄 Vote Changes",
          value: "You can change your vote by using this command again with different choices.",
          inline: false,
        });
      }

      embed.addFields({
        name: "📱 Next Steps",
        value:
          "• Use `/poll-results` to view current results\n" +
          "• Use `/poll-list` to see all active polls\n" +
          "• Share the poll ID with others to encourage voting!",
        inline: false,
      });

      await this.logCommandUsage("poll-vote", {
        pollId: poll.id,
        pollType: poll.type,
        hasVoted: true,
        voteData: poll.anonymous ? "hidden" : voteData,
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error executing poll-vote command:", error);
      return this.createGeneralError("Error", "An error occurred while submitting your vote. Please try again.");
    }
  }
}

export default new VotePollCommand();

export const builder = new SlashCommandBuilder()
  .setName("poll-vote")
  .setDescription("Vote on a poll")
  .setDefaultMemberPermissions("0")
  .addStringOption((option) => option.setName("poll-id").setDescription("ID of the poll to vote on").setRequired(true))
  .addStringOption((option) =>
    option
      .setName("choices")
      .setDescription('Your choices (e.g., "1" for single, "1,3,5" for multiple)')
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("rating")
      .setDescription("Your rating (1-5, for rating polls)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(5)
  )
  .addStringOption((option) =>
    option.setName("ranking").setDescription('Your ranking (e.g., "1,3,2" for ranked choice polls)').setRequired(false)
  );
