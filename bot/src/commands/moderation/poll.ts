import type { Poll } from "@shared/database";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

interface PollOption {
  text: string;
  emoji: string;
  votes: Set<string>; // User IDs who voted for this option
}

interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: Date;
  endsAt?: Date;
  allowMultiple: boolean;
  isAnonymous: boolean;
  ended: boolean;
  roleRequirement?: string;
}

// Store active polls in memory (in production, you'd want to use Redis or database)
const activePolls = new Map<string, PollData>();

/**
 * Poll Command - Create interactive polls with progress tracking
 */
export class PollCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "poll",
      description: "Create interactive polls with progress tracking",
      category: "moderation",
      permissions: {
        level: PermissionLevel.PUBLIC,
        isConfigurable: true,
      },
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const question = this.getStringOption("question", true);
    const optionsInput = this.getStringOption("options", true);
    const duration = this.getIntegerOption("duration") ?? 60;
    const anonymous = this.getBooleanOption("anonymous") ?? false;
    const multipleChoice = this.getBooleanOption("multiple_choice") ?? false;
    const requiredRole = this.getRoleOption("role_requirement");

    try {
      // Parse options
      const options = optionsInput
        .split(";")
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);

      if (options.length < 2) {
        return {
          content: "❌ A poll must have at least 2 options. Separate options with semicolons (`;`).",
          ephemeral: true,
        };
      }

      if (options.length > 10) {
        return {
          content: "❌ A poll can have at most 10 options.",
          ephemeral: true,
        };
      }

      const expiresAt = new Date(Date.now() + duration * 60 * 1000);

      // Create poll in database with proper typing
      const poll: Poll = await prisma.poll.create({
        data: {
          guildId: this.guild.id,
          channelId: this.interaction.channel?.id ?? "",
          messageId: "temp", // Will update after message is sent
          createdBy: this.user.id,
          title: question,
          options,
          endsAt: expiresAt,
          allowMultiple: multipleChoice,
          // Store role requirement in votes field as JSON for now
          votes: requiredRole ? { roleRequirement: requiredRole.id } : null,
        },
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📊 Poll")
        .setDescription(`**${question}**`)
        .setTimestamp()
        .setFooter({
          text: `Poll ID: ${poll.id} • Ends`,
          iconURL: this.user.displayAvatarURL(),
        });

      // Add options with progress bars
      const optionText = options
        .map((option, index) => {
          const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"][index];
          return `${emoji} ${option}\n▫️▫️▫️▫️▫️▫️▫️▫️▫️▫️ 0%`;
        })
        .join("\n\n");

      embed.addFields({
        name: "Options",
        value: optionText,
        inline: false,
      });

      embed.addFields(
        {
          name: "⏰ Duration",
          value: `${duration} minute${duration !== 1 ? "s" : ""}`,
          inline: true,
        },
        {
          name: "👥 Total Votes",
          value: "0",
          inline: true,
        },
        {
          name: "⚙️ Settings",
          value: [
            anonymous ? "🔒 Anonymous" : "👤 Public",
            multipleChoice ? "☑️ Multiple Choice" : "1️⃣ Single Choice",
            requiredRole ? `🎭 Role: ${requiredRole.name}` : "🌐 Everyone",
          ].join("\n"),
          inline: true,
        }
      );

      // Create buttons for voting
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let i = 0; i < options.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (let j = i; j < Math.min(i + 5, options.length); j++) {
          const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"][j];
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`poll_vote_${poll.id}_${j}`)
              .setLabel(`${j + 1}. ${options[j].substring(0, 20)}${options[j].length > 20 ? "..." : ""}`)
              .setEmoji(emoji)
              .setStyle(ButtonStyle.Secondary)
          );
        }
        rows.push(row);
      }

      // Add control buttons
      const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_results_${poll.id}`)
          .setLabel("Results")
          .setEmoji("📊")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`poll_end_${poll.id}`)
          .setLabel("End Poll")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      rows.push(controlRow);

      // Create in-memory poll data for voting
      const pollData: PollData = {
        id: poll.id,
        question,
        options: options.map((text, index) => ({
          text,
          emoji: ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"][index],
          votes: new Set<string>(),
        })),
        createdBy: this.user.id,
        createdAt: new Date(),
        endsAt: expiresAt,
        allowMultiple: multipleChoice,
        isAnonymous: anonymous,
        ended: false,
        roleRequirement: requiredRole?.id,
      };

      activePolls.set(poll.id, pollData);

      // Schedule automatic poll ending
      setTimeout(
        () => {
          void (async () => {
            try {
              // Check if poll is still active
              const activePoll: Poll | null = await prisma.poll.findUnique({
                where: { id: poll.id },
              });

              if (activePoll?.isActive) {
                await prisma.poll.update({
                  where: { id: poll.id },
                  data: { isActive: false },
                });

                // End the in-memory poll and update the message
                const memoryPoll = activePolls.get(poll.id);
                if (memoryPoll) {
                  memoryPoll.ended = true;

                  try {
                    const channel = await this.client.channels.fetch(activePoll.channelId);
                    if (channel?.isTextBased()) {
                      const message = await channel.messages.fetch(activePoll.messageId);
                      const endedEmbed = createPollEmbed(memoryPoll, true);
                      await message.edit({
                        embeds: [endedEmbed],
                        components: [], // Remove all buttons
                      });
                    }
                  } catch (editError) {
                    logger.warn(`Failed to edit poll message ${poll.id}:`, editError);
                  }

                  // Clean up memory after 1 hour to prevent memory leaks
                  setTimeout(() => {
                    activePolls.delete(poll.id);
                  }, 3600000); // 1 hour
                }
              }
            } catch (error) {
              logger.warn(`Failed to end poll ${poll.id} automatically:`, error);
            }
          })();
        },
        duration * 60 * 1000
      );

      // Log poll creation
      await this.client.logManager.log(this.guild.id, "POLL_CREATE", {
        userId: this.user.id,
        channelId: this.interaction.channel?.id,
        metadata: {
          pollId: poll.id,
          question,
          optionCount: options.length,
          duration,
          anonymous,
          multipleChoice,
        },
      });

      return {
        embeds: [embed],
        components: rows,
        ephemeral: false,
      };
    } catch (error) {
      logger.error("Error creating poll:", error);
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to create poll. Please try again.")
            .setTimestamp(),
        ],
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new PollCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Create interactive polls with progress tracking")
  .addStringOption((opt) =>
    opt.setName("question").setDescription("The poll question").setRequired(true).setMaxLength(200)
  )
  .addStringOption((opt) =>
    opt
      .setName("options")
      .setDescription("Poll options separated by semicolons (e.g., 'Option 1; Option 2; Option 3')")
      .setRequired(true)
      .setMaxLength(500)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Poll duration in minutes (minimum: 1, default: 60, max: 1440)")
      .setMinValue(1)
      .setMaxValue(1440)
  )
  .addBooleanOption((opt) => opt.setName("anonymous").setDescription("Hide who voted for what (default: false)"))
  .addBooleanOption((opt) =>
    opt.setName("multiple_choice").setDescription("Allow multiple selections (default: false)")
  )
  .addRoleOption((opt) =>
    opt.setName("role_requirement").setDescription("Role required to vote (leave empty for everyone)")
  );

// Keep the existing helper functions for poll interaction handling
async function handleEndPoll(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const pollId = interaction.options.getString("poll_id", true);
  const poll = activePolls.get(pollId);

  if (!poll) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Poll Not Found")
          .setDescription(`No active poll found with ID: \`${pollId}\``)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // Check if user can end the poll
  const member = interaction.member as GuildMember;
  const canEnd = poll.createdBy === interaction.user.id || member.permissions.has("ManageMessages");

  if (!canEnd) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ No Permission")
          .setDescription("Only the poll creator or moderators can end polls.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // End the poll
  poll.ended = true;

  try {
    // Update database
    await prisma.poll.update({
      where: { id: pollId },
      data: { isActive: false },
    });

    // Update the message
    const channel = await client.channels.fetch(interaction.channelId);
    if (channel?.isTextBased()) {
      const messages = await channel.messages.fetch({ limit: 50 });
      const pollMessage = messages.find((msg) => msg.embeds[0]?.footer?.text?.includes(pollId));

      if (pollMessage) {
        const endedEmbed = createPollEmbed(poll, true);
        await pollMessage.edit({
          embeds: [endedEmbed],
          components: [], // Remove all buttons
        });
      }
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Poll Ended")
          .setDescription(`Poll "${poll.question}" has been ended successfully.`)
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    // Clean up memory after 1 hour
    setTimeout(() => {
      activePolls.delete(pollId);
    }, 3600000);
  } catch (error) {
    logger.error("Error ending poll:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to end poll. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function handleShowResults(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const pollId = interaction.options.getString("poll_id", true);
  const poll = activePolls.get(pollId);

  if (!poll) {
    await interaction.reply({
      content: `❌ No active poll found with ID: \`${pollId}\``,
      ephemeral: true,
    });
    return;
  }

  const resultsEmbed = createDetailedResultsEmbed(poll);
  await interaction.reply({ embeds: [resultsEmbed], ephemeral: true });
}

export async function handlePollInteraction(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  if (customId.startsWith("poll_vote_")) {
    const [, , pollId, optionIndexStr] = customId.split("_");
    const optionIndex = parseInt(optionIndexStr, 10);
    const poll = activePolls.get(pollId);

    if (poll) {
      await handleVote(interaction, poll, optionIndex);
    } else {
      await interaction.reply({
        content: "❌ This poll is no longer active.",
        ephemeral: true,
      });
    }
  } else if (customId.startsWith("poll_results_")) {
    const pollId = customId.split("_")[2];
    const poll = activePolls.get(pollId);

    if (poll) {
      await handleResultsButton(interaction, poll);
    } else {
      await interaction.reply({
        content: "❌ This poll is no longer active.",
        ephemeral: true,
      });
    }
  } else if (customId.startsWith("poll_end_")) {
    const pollId = customId.split("_")[2];
    const poll = activePolls.get(pollId);

    if (poll) {
      await handleEndButton(interaction, poll);
    } else {
      await interaction.reply({
        content: "❌ This poll is no longer active.",
        ephemeral: true,
      });
    }
  }
}

async function handleVote(interaction: ButtonInteraction, poll: PollData, optionIndex: number): Promise<void> {
  if (poll.ended) {
    await interaction.reply({
      content: "❌ This poll has ended.",
      ephemeral: true,
    });
    return;
  }

  // Check role requirement
  if (poll.roleRequirement && interaction.member) {
    const member = interaction.member as GuildMember;
    if (!member.roles.cache.has(poll.roleRequirement)) {
      await interaction.reply({
        content: "❌ You don't have the required role to vote in this poll.",
        ephemeral: true,
      });
      return;
    }
  }

  const userId = interaction.user.id;
  const option = poll.options[optionIndex];

  if (!option) {
    await interaction.reply({
      content: "❌ Invalid poll option.",
      ephemeral: true,
    });
    return;
  }

  // Handle voting logic
  const hasVoted = option.votes.has(userId);
  const hasVotedElsewhere = poll.options.some((opt, idx) => idx !== optionIndex && opt.votes.has(userId));

  if (!poll.allowMultiple && hasVotedElsewhere) {
    // Remove previous vote if single choice
    for (const opt of poll.options) {
      opt.votes.delete(userId);
    }
  }

  if (hasVoted) {
    // Remove vote
    option.votes.delete(userId);
    await interaction.reply({
      content: `✅ Removed your vote for "${option.text}"`,
      ephemeral: true,
    });
  } else {
    // Add vote
    option.votes.add(userId);
    await interaction.reply({
      content: `✅ Voted for "${option.text}"`,
      ephemeral: true,
    });
  }

  // Update the poll message
  try {
    const updatedEmbed = createPollEmbed(poll);
    await interaction.message.edit({ embeds: [updatedEmbed] });
  } catch (error) {
    logger.warn("Failed to update poll message:", error);
  }
}

async function handleResultsButton(interaction: ButtonInteraction, poll: PollData): Promise<void> {
  const resultsEmbed = createDetailedResultsEmbed(poll);
  await interaction.reply({ embeds: [resultsEmbed], ephemeral: true });
}

async function handleEndButton(interaction: ButtonInteraction, poll: PollData): Promise<void> {
  // Check if user can end the poll
  const member = interaction.member as GuildMember;
  const canEnd = poll.createdBy === interaction.user.id || member.permissions.has("ManageMessages");

  if (!canEnd) {
    await interaction.reply({
      content: "❌ Only the poll creator or moderators can end polls.",
      ephemeral: true,
    });
    return;
  }

  // End the poll
  poll.ended = true;

  try {
    // Update database
    await prisma.poll.update({
      where: { id: poll.id },
      data: { isActive: false },
    });

    const endedEmbed = createPollEmbed(poll, true);
    await interaction.update({
      embeds: [endedEmbed],
      components: [], // Remove all buttons
    });

    // Clean up memory after 1 hour
    setTimeout(() => {
      activePolls.delete(poll.id);
    }, 3600000);
  } catch (error) {
    logger.error("Error ending poll:", error);
    await interaction.reply({
      content: "❌ Failed to end poll. Please try again.",
      ephemeral: true,
    });
  }
}

function createPollEmbed(poll: PollData, ended = false): EmbedBuilder {
  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes.size, 0);

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x95a5a6 : 0x3498db)
    .setTitle(`📊 Poll${ended ? " (Ended)" : ""}`)
    .setDescription(`**${poll.question}**`)
    .setTimestamp();

  // Create progress bars for options
  const optionText = poll.options
    .map((option, index) => {
      const votes = option.votes.size;
      const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const progressBar = "█".repeat(Math.floor(percentage / 10)) + "░".repeat(10 - Math.floor(percentage / 10));

      return `${option.emoji} ${option.text}\n${progressBar} ${percentage}% (${votes} vote${votes !== 1 ? "s" : ""})`;
    })
    .join("\n\n");

  embed.addFields({
    name: "Options",
    value: optionText || "No options",
    inline: false,
  });

  embed.addFields(
    {
      name: "👥 Total Votes",
      value: totalVotes.toString(),
      inline: true,
    },
    {
      name: "⚙️ Settings",
      value: [
        poll.isAnonymous ? "🔒 Anonymous" : "👤 Public",
        poll.allowMultiple ? "☑️ Multiple Choice" : "1️⃣ Single Choice",
        poll.roleRequirement ? "🎭 Role Required" : "🌐 Everyone",
      ].join("\n"),
      inline: true,
    }
  );

  if (poll.endsAt && !ended) {
    embed.addFields({
      name: "⏰ Ends",
      value: `<t:${Math.floor(poll.endsAt.getTime() / 1000)}:R>`,
      inline: true,
    });
  }

  embed.setFooter({
    text: `Poll ID: ${poll.id}${ended ? " • Ended" : ""}`,
  });

  return embed;
}

function createDetailedResultsEmbed(poll: PollData): EmbedBuilder {
  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes.size, 0);

  const embed = new EmbedBuilder().setColor(0x3498db).setTitle(`📊 Detailed Results: ${poll.question}`).setTimestamp();

  for (const [index, option] of poll.options.entries()) {
    const votes = option.votes.size;
    const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

    let fieldValue = `**${votes} vote${votes !== 1 ? "s" : ""}** (${percentage}%)\n`;

    if (!poll.isAnonymous && votes > 0) {
      const voterList = Array.from(option.votes)
        .slice(0, 10)
        .map((userId) => `<@${userId}>`)
        .join(", ");

      fieldValue += `Voters: ${voterList}${votes > 10 ? ` and ${votes - 10} more...` : ""}`;
    } else if (poll.isAnonymous) {
      fieldValue += "*Anonymous voting enabled*";
    } else {
      fieldValue += "*No votes yet*";
    }

    embed.addFields({
      name: `${option.emoji} ${option.text}`,
      value: fieldValue,
      inline: false,
    });
  }

  embed.setFooter({
    text: `Total votes: ${totalVotes} • Poll ID: ${poll.id}`,
  });

  return embed;
}
