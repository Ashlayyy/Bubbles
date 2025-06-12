import type { Poll } from "@prisma/client";
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
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

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

export default new Command(
  new SlashCommandBuilder()
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
    ),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const question = interaction.options.getString("question", true);
    const optionsInput = interaction.options.getString("options", true);
    const duration = interaction.options.getInteger("duration") ?? 60;
    const anonymous = interaction.options.getBoolean("anonymous") ?? false;
    const multipleChoice = interaction.options.getBoolean("multiple_choice") ?? false;
    const requiredRole = interaction.options.getRole("role_requirement");

    try {
      // Parse options
      const options = optionsInput
        .split(";")
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);

      if (options.length < 2) {
        await interaction.reply({
          content: "❌ A poll must have at least 2 options. Separate options with semicolons (`;`).",
          ephemeral: true,
        });
        return;
      }

      if (options.length > 10) {
        await interaction.reply({
          content: "❌ A poll can have at most 10 options.",
          ephemeral: true,
        });
        return;
      }

      const expiresAt = new Date(Date.now() + duration * 60 * 1000);

      // Create poll in database with proper typing
      const poll: Poll = await prisma.poll.create({
        data: {
          guildId: interaction.guild.id,
          channelId: interaction.channel?.id ?? "",
          messageId: "temp", // Will update after message is sent
          createdBy: interaction.user.id,
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
          iconURL: interaction.user.displayAvatarURL(),
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
          value: `${duration.toString()} minute${duration !== 1 ? "s" : ""}`,
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
              .setCustomId(`poll_vote_${poll.id}_${j.toString()}`)
              .setLabel(`${(j + 1).toString()}. ${options[j].substring(0, 20)}${options[j].length > 20 ? "..." : ""}`)
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
        createdBy: interaction.user.id,
        createdAt: new Date(),
        endsAt: expiresAt,
        allowMultiple: multipleChoice,
        isAnonymous: anonymous,
        ended: false,
        roleRequirement: requiredRole?.id,
      };

      activePolls.set(poll.id, pollData);

      await interaction.reply({
        embeds: [embed],
        components: rows,
      });

      // Update the database with the actual message ID
      const reply = await interaction.fetchReply();
      await prisma.poll.update({
        where: { id: poll.id },
        data: { messageId: reply.id },
      });

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
                    const channel = await client.channels.fetch(activePoll.channelId);
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

      // Log poll creation - logManager is always defined in Client
      await client.logManager.log(interaction.guild.id, "POLL_CREATE", {
        userId: interaction.user.id,
        channelId: interaction.channel?.id,
        metadata: {
          pollId: poll.id,
          question,
          optionCount: options.length,
          duration,
          anonymous,
          multipleChoice,
        },
      });
    } catch (error) {
      logger.error("Error creating poll:", error);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to create poll. Please try again.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.PUBLIC,
      isConfigurable: true,
    },
  }
);

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

  if (poll.ended) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("⚠️ Poll Already Ended")
          .setDescription("This poll has already ended.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // End the poll
  poll.ended = true;

  const embed = createPollEmbed(poll, true);

  await interaction.reply({
    embeds: [embed],
    ephemeral: false,
  });

  // Log poll end - logManager is always defined in Client
  if (interaction.guild) {
    await client.logManager.log(interaction.guild.id, "POLL_END", {
      userId: interaction.user.id,
      metadata: {
        pollId,
        endedBy: interaction.user.id,
        totalVotes: poll.options.reduce((sum, opt) => sum + opt.votes.size, 0),
      },
    });
  }
}

async function handleShowResults(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const pollId = interaction.options.getString("poll_id", true);
  const poll = activePolls.get(pollId);

  if (!poll) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Poll Not Found")
          .setDescription(`No poll found with ID: \`${pollId}\``)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  const resultsEmbed = createDetailedResultsEmbed(poll);

  await interaction.reply({
    embeds: [resultsEmbed],
    ephemeral: true,
  });
}

// Handle button interactions
export async function handlePollInteraction(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith("poll_")) return;

  const [, action, pollId, optionIndex] = interaction.customId.split("_");

  // For now, use in-memory polls only. Database integration would need more complex handling
  const poll = activePolls.get(pollId);

  if (!poll) {
    await interaction.reply({
      content: "❌ This poll is no longer available.",
      ephemeral: true,
    });
    return;
  }

  if (poll.ended) {
    await interaction.reply({
      content: "❌ This poll has ended and no longer accepts votes.",
      ephemeral: true,
    });
    return;
  }

  switch (action) {
    case "vote":
      await handleVote(interaction, poll, parseInt(optionIndex, 10));
      break;
    case "results":
      await handleResultsButton(interaction, poll);
      break;
    case "end":
      await handleEndButton(interaction, poll);
      break;
  }
}

async function handleVote(interaction: ButtonInteraction, poll: PollData, optionIndex: number): Promise<void> {
  const userId = interaction.user.id;

  // Validate option index bounds
  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    await interaction.reply({
      content: "❌ Invalid poll option.",
      ephemeral: true,
    });
    return;
  }

  // Check role requirement
  if (poll.roleRequirement) {
    const member = interaction.member as GuildMember;
    if (!member.roles.cache.has(poll.roleRequirement)) {
      const guild = interaction.guild;
      const requiredRole = guild?.roles.cache.get(poll.roleRequirement);
      await interaction.reply({
        content: `❌ You need the **${requiredRole?.name ?? "required"}** role to vote in this poll.`,
        ephemeral: true,
      });
      return;
    }
  }

  const option = poll.options[optionIndex];

  // Check if user already voted for this option
  const hasVotedForThis = option.votes.has(userId);

  if (!poll.allowMultiple) {
    // Single choice: remove from all other options first
    poll.options.forEach((opt) => opt.votes.delete(userId));
  }

  if (hasVotedForThis) {
    // Remove vote
    option.votes.delete(userId);
    await interaction.reply({
      content: `🗳️ Removed your vote for **${option.text}**`,
      ephemeral: true,
    });
  } else {
    // Add vote
    option.votes.add(userId);
    await interaction.reply({
      content: `✅ Voted for **${option.text}**`,
      ephemeral: true,
    });
  }

  // Update the poll embed
  try {
    const updatedEmbed = createPollEmbed(poll);
    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: interaction.message.components,
    });
  } catch (error) {
    // Silently fail embed update
    logger.warn("Failed to update poll embed:", error);
  }
}

async function handleResultsButton(interaction: ButtonInteraction, poll: PollData): Promise<void> {
  const resultsEmbed = createDetailedResultsEmbed(poll);
  await interaction.reply({
    embeds: [resultsEmbed],
    ephemeral: true,
  });
}

async function handleEndButton(interaction: ButtonInteraction, poll: PollData): Promise<void> {
  const member = interaction.member as GuildMember;
  const canEnd = poll.createdBy === interaction.user.id || member.permissions.has("ManageMessages");

  if (!canEnd) {
    await interaction.reply({
      content: "❌ Only the poll creator or moderators can end polls.",
      ephemeral: true,
    });
    return;
  }

  poll.ended = true;
  const endedEmbed = createPollEmbed(poll, true);

  // Update database to mark poll as inactive
  try {
    await prisma.poll.update({
      where: { id: poll.id },
      data: { isActive: false },
    });
  } catch (error) {
    logger.warn(`Failed to update database for ended poll ${poll.id}:`, error);
  }

  await interaction.update({
    embeds: [endedEmbed],
    components: [], // Remove all buttons
  });

  // Clean up memory after 1 hour to prevent memory leaks
  setTimeout(() => {
    activePolls.delete(poll.id);
  }, 3600000); // 1 hour
}

// Helper functions
function createPollEmbed(poll: PollData, ended = false): EmbedBuilder {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.size, 0);

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${poll.question}`)
    .setColor(ended ? 0x95a5a6 : 0x3498db)
    .setAuthor({
      name: ended ? "Poll Ended" : "Active Poll",
      iconURL: ended ? "https://cdn.discordapp.com/emojis/1234567890.png" : undefined,
    })
    .setTimestamp();

  // Add options with vote counts and progress bars
  const optionsText = poll.options
    .map((option, index) => {
      const voteCount = option.votes.size;
      const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

      // Create progress bar
      const barLength = 15;
      const filledLength = Math.round((percentage / 100) * barLength);
      const progressBar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

      return `${option.emoji} **${option.text}**\n\`${progressBar}\` ${percentage}% (${voteCount} vote${voteCount === 1 ? "" : "s"})`;
    })
    .join("\n\n");

  embed.setDescription(optionsText || "No options available");

  // Add poll info
  const infoFields = [];

  infoFields.push({
    name: "📊 Total Votes",
    value: totalVotes.toString(),
    inline: true,
  });

  infoFields.push({
    name: "👤 Created by",
    value: `<@${poll.createdBy}>`,
    inline: true,
  });

  if (poll.endsAt && !ended) {
    infoFields.push({
      name: "⏰ Ends",
      value: `<t:${Math.floor(poll.endsAt.getTime() / 1000)}:R>`,
      inline: true,
    });
  }

  if (poll.allowMultiple) {
    infoFields.push({
      name: "ℹ️ Multiple Choice",
      value: "You can vote for multiple options",
      inline: false,
    });
  }

  embed.addFields(infoFields);

  embed.setFooter({
    text: `Poll ID: ${poll.id} | ${ended ? "Ended" : "Click buttons to vote"}`,
  });

  return embed;
}

function createDetailedResultsEmbed(poll: PollData): EmbedBuilder {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.size, 0);

  const embed = new EmbedBuilder().setTitle(`📊 Detailed Results: ${poll.question}`).setColor(0x2ecc71).setTimestamp();

  poll.options.forEach((option, index) => {
    const voteCount = option.votes.size;
    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

    let fieldValue = `**Votes:** ${voteCount} (${percentage}%)\n`;

    if (!poll.isAnonymous && voteCount > 0) {
      const voters = Array.from(option.votes)
        .slice(0, 10) // Limit to first 10 voters
        .map((userId) => `<@${userId}>`)
        .join(", ");

      fieldValue += `**Voters:** ${voters}`;

      if (voteCount > 10) {
        fieldValue += ` and ${voteCount - 10} more...`;
      }
    }

    embed.addFields({
      name: `${option.emoji} ${option.text}`,
      value: fieldValue,
      inline: false,
    });
  });

  embed.addFields(
    {
      name: "📊 Total Votes",
      value: totalVotes.toString(),
      inline: true,
    },
    {
      name: "👤 Created by",
      value: `<@${poll.createdBy}>`,
      inline: true,
    },
    {
      name: "📅 Created",
      value: `<t:${Math.floor(poll.createdAt.getTime() / 1000)}:R>`,
      inline: true,
    }
  );

  if (poll.ended) {
    embed.setAuthor({ name: "📋 Poll Results (Ended)" });
  } else {
    embed.setAuthor({ name: "📋 Poll Results (Active)" });
  }

  embed.setFooter({ text: `Poll ID: ${poll.id}` });

  return embed;
}
