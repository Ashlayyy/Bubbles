import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { pollApiService } from "../../services/pollApiService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class CreatePollCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "poll-create",
      description: "Create a new poll",
      category: "polls",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const question = this.getStringOption("question", true);
    const option1 = this.getStringOption("option1", true);
    const option2 = this.getStringOption("option2", true);
    const option3 = this.getStringOption("option3");
    const option4 = this.getStringOption("option4");
    const option5 = this.getStringOption("option5");
    const duration = this.getIntegerOption("duration");
    const multipleChoice = this.getBooleanOption("multiple-choice") || false;

    try {
      // Check if API service is configured
      if (!pollApiService.isConfigured()) {
        return this.createGeneralError("Service Unavailable", "Poll service is not properly configured.");
      }

      // Prepare options array
      const options = [option1, option2, option3, option4, option5]
        .filter((text): text is string => text !== null && text !== undefined)
        .map((text) => ({ text }));

      if (options.length < 2) {
        return this.createGeneralError("Invalid Options", "You must provide at least 2 options for a poll.");
      }

      // Prepare poll data
      const pollData = {
        question,
        options,
        allowMultipleVotes: multipleChoice,
        duration: duration || undefined,
        channelId: this.channel.id,
      };

      // Create poll using the API service
      const result = await pollApiService.createPoll(this.guild.id, pollData);

      if (!result.success) {
        return this.createGeneralError("Poll Creation Error", result.error || "Failed to create poll");
      }

      const poll = result.data!;

      // Create poll embed
      const embed = new EmbedBuilder()
        .setTitle("📊 Poll Created")
        .setDescription(`**${poll.question}**`)
        .setColor("#3498db")
        .setTimestamp();

      // Add options to embed
      poll.options.forEach((option, index) => {
        const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"][index];
        embed.addFields({
          name: `${emoji} Option ${index + 1}`,
          value: option.text,
          inline: true,
        });
      });

      // Add poll info
      embed.addFields(
        {
          name: "🗳️ Poll Type",
          value: poll.allowMultipleVotes ? "Multiple Choice" : "Single Choice",
          inline: true,
        },
        {
          name: "📊 Total Votes",
          value: poll.totalVotes.toString(),
          inline: true,
        },
        {
          name: "🆔 Poll ID",
          value: `\`${poll.id}\``,
          inline: true,
        }
      );

      if (poll.endTime) {
        embed.addFields({
          name: "⏰ Ends At",
          value: `<t:${Math.floor(new Date(poll.endTime).getTime() / 1000)}:R>`,
          inline: true,
        });
      }

      embed.addFields({
        name: "📱 How to Vote",
        value: `Use \`/poll-vote\` with poll ID \`${poll.id}\` to vote!`,
        inline: false,
      });

      // Log command usage
      logger.info("Poll created successfully", {
        pollId: poll.id,
        question: poll.question,
        optionCount: poll.options.length,
        allowMultipleVotes: poll.allowMultipleVotes,
        duration: duration,
        userId: this.user.id,
        guildId: this.guild.id,
      });

      return { embeds: [embed] };
    } catch (error) {
      logger.error("Error executing poll-create command:", error);
      return this.createGeneralError("Error", "An error occurred while creating the poll. Please try again.");
    }
  }
}

export default new CreatePollCommand();

export const builder = new SlashCommandBuilder()
  .setName("poll-create")
  .setDescription("Create a new poll")
  .addStringOption((option) =>
    option.setName("question").setDescription("The poll question").setRequired(true).setMaxLength(200)
  )
  .addStringOption((option) =>
    option.setName("option1").setDescription("First option").setRequired(true).setMaxLength(100)
  )
  .addStringOption((option) =>
    option.setName("option2").setDescription("Second option").setRequired(true).setMaxLength(100)
  )
  .addStringOption((option) =>
    option.setName("option3").setDescription("Third option").setRequired(false).setMaxLength(100)
  )
  .addStringOption((option) =>
    option.setName("option4").setDescription("Fourth option").setRequired(false).setMaxLength(100)
  )
  .addStringOption((option) =>
    option.setName("option5").setDescription("Fifth option").setRequired(false).setMaxLength(100)
  )
  .addIntegerOption((option) =>
    option
      .setName("duration")
      .setDescription("Duration in minutes (optional)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10080)
  )
  .addBooleanOption((option) =>
    option.setName("multiple-choice").setDescription("Allow multiple choices (default: false)").setRequired(false)
  );
