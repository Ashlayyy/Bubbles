import type { Giveaway } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
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

// Store active giveaways in memory for quick access
const activeGiveaways = new Map<string, Giveaway>();

export default new Command(
  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create and manage giveaways")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new giveaway")
        .addStringOption((opt) =>
          opt.setName("prize").setDescription("What is being given away").setRequired(true).setMaxLength(200)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Duration in minutes (minimum: 1, max: 10080 = 1 week)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10080)
        )
        .addIntegerOption((opt) =>
          opt.setName("winners").setDescription("Number of winners (default: 1)").setMinValue(1).setMaxValue(20)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Additional description or requirements").setMaxLength(500)
        )
        .addRoleOption((opt) => opt.setName("required_role").setDescription("Role required to enter"))
        .addRoleOption((opt) => opt.setName("blocked_role").setDescription("Role that cannot enter"))
        .addIntegerOption((opt) =>
          opt.setName("minimum_level").setDescription("Minimum user level to enter (if level system is active)")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("end")
        .setDescription("End a giveaway early")
        .addStringOption((opt) =>
          opt.setName("giveaway_id").setDescription("Giveaway ID to end").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reroll")
        .setDescription("Reroll winners for a giveaway")
        .addStringOption((opt) =>
          opt.setName("giveaway_id").setDescription("Giveaway ID to reroll").setRequired(true).setAutocomplete(true)
        )
        .addIntegerOption((opt) => opt.setName("winners").setDescription("Number of new winners to select"))
    )
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List active giveaways in this server")),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "create":
        await handleCreateGiveaway(client, interaction);
        break;
      case "end":
        await handleEndGiveaway(client, interaction);
        break;
      case "reroll":
        await handleRerollGiveaway(client, interaction);
        break;
      case "list":
        await handleListGiveaways(client, interaction);
        break;
    }
  },
  {
    permissions: {
      level: PermissionLevel.MODERATOR,
      isConfigurable: true,
    },
  }
);

async function handleCreateGiveaway(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const prize = interaction.options.getString("prize", true);
  const duration = interaction.options.getInteger("duration", true);
  const winners = interaction.options.getInteger("winners") ?? 1;
  const description = interaction.options.getString("description");
  const requiredRole = interaction.options.getRole("required_role");
  const blockedRole = interaction.options.getRole("blocked_role");
  const minimumLevel = interaction.options.getInteger("minimum_level");

  try {
    const endsAt = new Date(Date.now() + duration * 60 * 1000);
    const giveawayId = generateGiveawayId();

    // Create giveaway in database
    const giveaway: Giveaway = await prisma.giveaway.create({
      data: {
        guildId: interaction.guild.id,
        channelId: interaction.channel?.id ?? "",
        messageId: "temp", // Will update after message is sent
        giveawayId,
        hostId: interaction.user.id,
        title: `🎉 ${prize}`,
        description,
        prize,
        winnersCount: winners,
        requiredRoles: requiredRole ? [requiredRole.id] : [],
        blockedRoles: blockedRole ? [blockedRole.id] : [],
        minimumLevel,
        endsAt,
      },
    });

    // Create embed
    const embed = createGiveawayEmbed(giveaway, interaction.user.displayAvatarURL());

    // Create enter button
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveaway.id}`)
        .setLabel("🎉 Enter Giveaway")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`giveaway_entries_${giveaway.id}`)
        .setLabel("👥 View Entries")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });

    // Update database with message ID
    const reply = await interaction.fetchReply();
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { messageId: reply.id },
    });

    // Store in memory for quick access
    activeGiveaways.set(giveaway.id, { ...giveaway, messageId: reply.id });

    // Schedule automatic ending
    setTimeout(
      () => {
        void (async () => {
          try {
            await endGiveaway(client, giveaway.id);
          } catch (error) {
            logger.warn(`Failed to end giveaway ${giveaway.id} automatically:`, error);
          }
        })();
      },
      duration * 60 * 1000
    );

    // Log giveaway creation
    await client.logManager.log(interaction.guild.id, "GIVEAWAY_CREATE", {
      userId: interaction.user.id,
      channelId: interaction.channel?.id,
      metadata: {
        giveawayId: giveaway.giveawayId,
        prize,
        duration,
        winners,
        endsAt: giveaway.endsAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error creating giveaway:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to create giveaway. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function handleEndGiveaway(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const giveawayId = interaction.options.getString("giveaway_id", true);

  try {
    const giveaway = await prisma.giveaway.findFirst({
      where: {
        giveawayId,
        guildId: interaction.guild.id,
        isActive: true,
      },
    });

    if (!giveaway) {
      await interaction.reply({
        content: "❌ Giveaway not found or already ended.",
        ephemeral: true,
      });
      return;
    }

    await endGiveaway(client, giveaway.id);

    await interaction.reply({
      content: `✅ Giveaway **${giveaway.prize}** has been ended early.`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error ending giveaway:", error);
    await interaction.reply({
      content: "❌ Failed to end giveaway. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleRerollGiveaway(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const giveawayId = interaction.options.getString("giveaway_id", true);
  const newWinnerCount = interaction.options.getInteger("winners");

  try {
    const giveaway = await prisma.giveaway.findFirst({
      where: {
        giveawayId,
        guildId: interaction.guild.id,
        hasEnded: true,
      },
      include: {
        entries: true,
      },
    });

    if (!giveaway) {
      await interaction.reply({
        content: "❌ Giveaway not found or hasn't ended yet.",
        ephemeral: true,
      });
      return;
    }

    const winnersToSelect = newWinnerCount ?? giveaway.winnersCount;
    const eligibleEntries = giveaway.entries;

    if (eligibleEntries.length === 0) {
      await interaction.reply({
        content: "❌ No entries found for this giveaway.",
        ephemeral: true,
      });
      return;
    }

    // Select new winners
    const newWinners = selectRandomWinners(
      eligibleEntries.map((e) => e.userId),
      winnersToSelect
    );

    // Update database
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { winners: newWinners },
    });

    // Create winner announcement embed
    const embed = new EmbedBuilder()
      .setTitle("🎉 Giveaway Rerolled!")
      .setDescription(`**Prize:** ${giveaway.prize}`)
      .setColor(0xf1c40f)
      .addFields({
        name: "🏆 New Winners",
        value: newWinners.length > 0 ? newWinners.map((id) => `<@${id}>`).join("\n") : "No valid winners",
        inline: false,
      })
      .setTimestamp();

    // Try to update original message
    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(giveaway.messageId);
        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      logger.warn("Failed to update original giveaway message:", error);
    }

    await interaction.reply({
      content: `✅ Giveaway **${giveaway.prize}** has been rerolled with ${newWinners.length} winner(s).`,
      ephemeral: true,
    });

    // Log reroll
    await client.logManager.log(interaction.guild.id, "GIVEAWAY_REROLL", {
      userId: interaction.user.id,
      metadata: {
        giveawayId: giveaway.giveawayId,
        newWinners,
        rerolledBy: interaction.user.id,
      },
    });
  } catch (error) {
    logger.error("Error rerolling giveaway:", error);
    await interaction.reply({
      content: "❌ Failed to reroll giveaway. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleListGiveaways(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    const giveaways = await prisma.giveaway.findMany({
      where: {
        guildId: interaction.guild.id,
        isActive: true,
      },
      orderBy: {
        endsAt: "asc",
      },
      take: 10,
    });

    const embed = new EmbedBuilder().setTitle("🎉 Active Giveaways").setColor(0x3498db).setTimestamp();

    if (giveaways.length === 0) {
      embed.setDescription("No active giveaways in this server.");
    } else {
      const giveawayList = giveaways
        .map((g) => {
          const endsTimestamp = Math.floor(g.endsAt.getTime() / 1000);
          return `**${g.prize}** (ID: \`${g.giveawayId}\`)\n🏆 ${g.winnersCount} winner(s) • 👥 ${g.totalEntries} entries\n⏰ Ends <t:${endsTimestamp}:R>`;
        })
        .join("\n\n");

      embed.setDescription(giveawayList);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error listing giveaways:", error);
    await interaction.reply({
      content: "❌ Failed to list giveaways. Please try again.",
      ephemeral: true,
    });
  }
}

// Helper functions
function generateGiveawayId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createGiveawayEmbed(giveaway: Giveaway, hostAvatarURL: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("🎉 GIVEAWAY 🎉")
    .setDescription(`**${giveaway.prize}**`)
    .setColor(0xf1c40f)
    .setTimestamp(giveaway.endsAt)
    .setFooter({
      text: `Giveaway ID: ${giveaway.giveawayId} • Ends`,
      iconURL: hostAvatarURL,
    });

  // Add additional description if provided
  if (giveaway.description) {
    embed.addFields({
      name: "📋 Description",
      value: giveaway.description,
      inline: false,
    });
  }

  // Add requirements
  const requirements = [];
  if (giveaway.requiredRoles.length > 0) {
    requirements.push(`🎭 Required role: <@&${giveaway.requiredRoles[0]}>`);
  }
  if (giveaway.blockedRoles.length > 0) {
    requirements.push(`🚫 Cannot have role: <@&${giveaway.blockedRoles[0]}>`);
  }
  if (giveaway.minimumLevel) {
    requirements.push(`📊 Minimum level: ${giveaway.minimumLevel}`);
  }

  embed.addFields(
    {
      name: "🏆 Winners",
      value: giveaway.winnersCount.toString(),
      inline: true,
    },
    {
      name: "👥 Entries",
      value: giveaway.totalEntries.toString(),
      inline: true,
    },
    {
      name: "👑 Host",
      value: `<@${giveaway.hostId}>`,
      inline: true,
    }
  );

  if (requirements.length > 0) {
    embed.addFields({
      name: "📋 Requirements",
      value: requirements.join("\n"),
      inline: false,
    });
  }

  return embed;
}

async function endGiveaway(client: Client, giveawayDbId: string): Promise<void> {
  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayDbId },
      include: { entries: true },
    });

    if (!giveaway || !giveaway.isActive) return;

    // Select winners
    const winners = selectRandomWinners(
      giveaway.entries.map((e) => e.userId),
      giveaway.winnersCount
    );

    // Update database
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        isActive: false,
        hasEnded: true,
        endedAt: new Date(),
        winners,
      },
    });

    // Create winner announcement embed
    const embed = new EmbedBuilder()
      .setTitle("🎉 Giveaway Ended!")
      .setDescription(`**Prize:** ${giveaway.prize}`)
      .setColor(0x2ecc71)
      .addFields({
        name: "🏆 Winners",
        value: winners.length > 0 ? winners.map((id) => `<@${id}>`).join("\n") : "No valid winners",
        inline: false,
      })
      .setTimestamp();

    // Try to update original message and announce winners
    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(giveaway.messageId);

        // Update original message to show it ended
        const endedEmbed = createGiveawayEmbed(giveaway, "");
        endedEmbed.setColor(0x95a5a6);
        endedEmbed.setTitle("🎉 GIVEAWAY ENDED 🎉");

        await message.edit({
          embeds: [endedEmbed],
          components: [], // Remove buttons
        });

        // Send winner announcement
        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      logger.warn("Failed to update giveaway message:", error);
    }

    // Clean up memory
    activeGiveaways.delete(giveaway.id);

    logger.info(`Giveaway ${giveaway.giveawayId} ended with ${winners.length} winners`);
  } catch (error) {
    logger.error("Error ending giveaway:", error);
  }
}

function selectRandomWinners(userIds: string[], count: number): string[] {
  if (userIds.length === 0) return [];

  const shuffled = userIds.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, userIds.length));
}

// Handle button interactions for giveaways
export async function handleGiveawayInteraction(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith("giveaway_")) return;
  if (!interaction.guild) return;

  const [, action, giveawayDbId] = interaction.customId.split("_");

  switch (action) {
    case "enter":
      await handleGiveawayEntry(interaction, giveawayDbId);
      break;
    case "entries":
      await handleViewEntries(interaction, giveawayDbId);
      break;
  }
}

async function handleGiveawayEntry(interaction: ButtonInteraction, giveawayDbId: string): Promise<void> {
  if (!interaction.guild) return;

  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayDbId },
    });

    if (!giveaway?.isActive) {
      await interaction.reply({
        content: "❌ This giveaway is no longer active.",
        ephemeral: true,
      });
      return;
    }

    // Check if giveaway has ended
    if (new Date() > giveaway.endsAt) {
      await interaction.reply({
        content: "❌ This giveaway has already ended.",
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;

    // Check requirements
    if (giveaway.requiredRoles.length > 0) {
      const hasRequiredRole = giveaway.requiredRoles.some((roleId) => member.roles.cache.has(roleId));
      if (!hasRequiredRole) {
        const requiredRole = interaction.guild.roles.cache.get(giveaway.requiredRoles[0]);
        await interaction.reply({
          content: `❌ You need the **${requiredRole?.name ?? "required"}** role to enter this giveaway.`,
          ephemeral: true,
        });
        return;
      }
    }

    if (giveaway.blockedRoles.length > 0) {
      const hasBlockedRole = giveaway.blockedRoles.some((roleId) => member.roles.cache.has(roleId));
      if (hasBlockedRole) {
        const blockedRole = interaction.guild.roles.cache.get(giveaway.blockedRoles[0]);
        await interaction.reply({
          content: `❌ Users with the **${blockedRole?.name ?? "blocked"}** role cannot enter this giveaway.`,
          ephemeral: true,
        });
        return;
      }
    }

    // Check if already entered
    const existingEntry = await prisma.giveawayEntry.findUnique({
      where: {
        giveawayId_userId: {
          giveawayId: giveaway.id,
          userId: interaction.user.id,
        },
      },
    });

    if (existingEntry) {
      // Remove entry
      await prisma.giveawayEntry.delete({
        where: { id: existingEntry.id },
      });

      await prisma.giveaway.update({
        where: { id: giveaway.id },
        data: { totalEntries: { decrement: 1 } },
      });

      await interaction.reply({
        content: "🗑️ You have left the giveaway.",
        ephemeral: true,
      });
    } else {
      // Add entry
      await prisma.giveawayEntry.create({
        data: {
          giveawayId: giveaway.id,
          userId: interaction.user.id,
          guildId: interaction.guild.id,
        },
      });

      await prisma.giveaway.update({
        where: { id: giveaway.id },
        data: { totalEntries: { increment: 1 } },
      });

      await interaction.reply({
        content: "🎉 You have entered the giveaway! Good luck!",
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error("Error handling giveaway entry:", error);
    await interaction.reply({
      content: "❌ Failed to process giveaway entry. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleViewEntries(interaction: ButtonInteraction, giveawayDbId: string): Promise<void> {
  if (!interaction.guild) return;

  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayDbId },
      include: { entries: true },
    });

    if (!giveaway) {
      await interaction.reply({
        content: "❌ Giveaway not found.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`👥 Giveaway Entries: ${giveaway.prize}`)
      .setColor(0x3498db)
      .addFields({
        name: "📊 Statistics",
        value: [
          `**Total Entries:** ${giveaway.totalEntries}`,
          `**Winners to Select:** ${giveaway.winnersCount}`,
          `**Chance per Entry:** ${giveaway.totalEntries > 0 ? Math.round((giveaway.winnersCount / giveaway.totalEntries) * 100) : 0}%`,
        ].join("\n"),
        inline: false,
      })
      .setTimestamp();

    if (giveaway.entries.length > 0) {
      const userList = giveaway.entries
        .slice(0, 20)
        .map((entry, index) => `${index + 1}. <@${entry.userId}>`)
        .join("\n");

      embed.addFields({
        name: `📋 Entries (showing ${Math.min(giveaway.entries.length, 20)}/${giveaway.entries.length})`,
        value: userList,
        inline: false,
      });

      if (giveaway.entries.length > 20) {
        embed.setFooter({ text: `and ${giveaway.entries.length - 20} more entries...` });
      }
    } else {
      embed.setDescription("No entries yet. Be the first to enter!");
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error viewing giveaway entries:", error);
    await interaction.reply({
      content: "❌ Failed to view giveaway entries. Please try again.",
      ephemeral: true,
    });
  }
}
