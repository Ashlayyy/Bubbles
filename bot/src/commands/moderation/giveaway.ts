import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type GuildMember,
} from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import { QueueService } from "../../services/QueueService.js";
import type Client from "../../structures/Client.js";
import Command, { type GuildChatInputCommandInteraction } from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage server giveaways")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new giveaway")
        .addStringOption((opt) =>
          opt.setName("prize").setDescription("What is being given away").setRequired(true).setMaxLength(256)
        )
        .addIntegerOption(
          (opt) =>
            opt
              .setName("duration")
              .setDescription("Duration in hours")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(168) // 1 week
        )
        .addIntegerOption((opt) =>
          opt.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(20)
        )
        .addStringOption((opt) =>
          opt
            .setName("requirements")
            .setDescription("Requirements to enter (e.g., 'Must be level 5+')")
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a giveaway early")
        .addStringOption((opt) =>
          opt.setName("giveaway_id").setDescription("ID of the giveaway to end").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Reroll a giveaway to pick new winners")
        .addStringOption((opt) =>
          opt.setName("giveaway_id").setDescription("ID of the giveaway to reroll").setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List active giveaways")),

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
      discordPermissions: [PermissionFlagsBits.ManageMessages],
    },
  }
);

async function handleCreateGiveaway(client: Client, interaction: GuildChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel) return;

  const prize = interaction.options.getString("prize", true);
  const duration = interaction.options.getInteger("duration", true);
  const winners = interaction.options.getInteger("winners") ?? 1;
  const requirements = interaction.options.getString("requirements");

  try {
    // Create giveaway ID
    const giveawayId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const endsAt = new Date(Date.now() + duration * 60 * 60 * 1000);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle("🎉 GIVEAWAY 🎉")
      .setDescription(`**Prize:** ${prize}`)
      .setColor(0xf39c12)
      .addFields(
        { name: "⏰ Ends", value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
        { name: "👑 Winner(s)", value: winners.toString(), inline: true },
        { name: "🎫 Entries", value: "0", inline: true }
      )
      .setTimestamp(endsAt)
      .setFooter({ text: `Giveaway ID: ${giveawayId} • Ends` });

    if (requirements) {
      embed.addFields({ name: "📋 Requirements", value: requirements, inline: false });
    }

    // Create button
    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveawayId}`)
        .setLabel("🎉 Enter Giveaway")
        .setStyle(ButtonStyle.Primary)
    );

    const response = await interaction.reply({
      content: "🎉 **GIVEAWAY TIME!** 🎉",
      embeds: [embed],
      components: [button],
    });

    const message = await response.fetch();

    // Store in database
    const giveaway = await prisma.giveaway.create({
      data: {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        messageId: message.id,
        giveawayId,
        hostId: interaction.user.id,
        title: "🎉 GIVEAWAY 🎉",
        prize,
        winnersCount: winners,
        requirements,
        endsAt,
        totalEntries: 0,
      },
    });

    // Schedule giveaway ending using queue system
    const queueService = QueueService.getInstance();
    await queueService.addGiveawayJob(
      {
        type: "END_GIVEAWAY",
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        giveawayId,
        giveawayDbId: giveaway.id,
        messageId: message.id,
        channelId: interaction.channel.id,
      },
      {
        delay: duration * 60 * 60 * 1000, // Convert hours to milliseconds
      }
    );

    // Log giveaway creation
    await client.logManager.log(interaction.guild.id, "GIVEAWAY_CREATE", {
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      metadata: {
        giveawayId,
        giveawayDbId: giveaway.id,
        prize,
        duration,
        winners,
        requirements,
        messageId: message.id,
        endsAt: endsAt.toISOString(),
      },
    });

    logger.info(`Giveaway created: ${giveawayId} in guild ${interaction.guild.id} by ${interaction.user.id}`);
  } catch (error) {
    logger.error("Failed to create giveaway:", error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("❌ Error")
      .setDescription("Failed to create giveaway. Please try again.")
      .setTimestamp();

    if (interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

async function handleListGiveaways(client: Client, interaction: GuildChatInputCommandInteraction): Promise<void> {
  try {
    const giveaways = await prisma.giveaway.findMany({
      where: {
        guildId: interaction.guild?.id || "",
        isActive: true,
        hasEnded: false,
      },
      orderBy: { endsAt: "asc" },
      take: 10, // Limit to 10 giveaways
    });

    if (giveaways.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("📋 Active Giveaways")
            .setDescription("No active giveaways found.")
            .addFields({
              name: "💡 How to Use",
              value: "Use `/giveaway create` to start a new giveaway!",
              inline: false,
            })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📋 Active Giveaways")
      .setDescription(`Found ${giveaways.length} active giveaway${giveaways.length === 1 ? "" : "s"}`)
      .setTimestamp();

    giveaways.forEach((giveaway) => {
      embed.addFields({
        name: `🎉 ${giveaway.giveawayId}`,
        value: `**Prize:** ${giveaway.prize}\n**Entries:** ${giveaway.totalEntries}\n**Ends:** <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>\n**Channel:** <#${giveaway.channelId}>`,
        inline: true,
      });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Failed to list giveaways:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to list giveaways. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function handleEndGiveaway(client: Client, interaction: GuildChatInputCommandInteraction): Promise<void> {
  const giveawayId = interaction.options.getString("giveaway_id", true);

  try {
    const giveaway = await prisma.giveaway.findFirst({
      where: {
        giveawayId,
        guildId: interaction.guild!.id,
        isActive: true,
        hasEnded: false,
      },
      include: {
        entries: true,
      },
    });

    if (!giveaway) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Giveaway Not Found")
            .setDescription(`No active giveaway found with ID: \`${giveawayId}\``)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // Check permissions (host or moderator)
    const member = interaction.member as GuildMember;
    const isHost = giveaway.hostId === interaction.user.id;
    const isModerator = member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!isHost && !isModerator) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Permission Denied")
            .setDescription("Only the giveaway host or moderators can end giveaways early.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    await endGiveaway(client, giveaway.id);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Giveaway Ended")
          .setDescription(`Successfully ended giveaway \`${giveawayId}\``)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Failed to end giveaway:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to end giveaway. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function handleRerollGiveaway(client: Client, interaction: GuildChatInputCommandInteraction): Promise<void> {
  const giveawayId = interaction.options.getString("giveaway_id", true);

  try {
    const giveaway = await prisma.giveaway.findFirst({
      where: {
        giveawayId,
        guildId: interaction.guild!.id,
        hasEnded: true,
      },
      include: {
        entries: true,
      },
    });

    if (!giveaway) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Giveaway Not Found")
            .setDescription(`No ended giveaway found with ID: \`${giveawayId}\``)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // Check permissions (host or moderator)
    const member = interaction.member as GuildMember;
    const isHost = giveaway.hostId === interaction.user.id;
    const isModerator = member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!isHost && !isModerator) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Permission Denied")
            .setDescription("Only the giveaway host or moderators can reroll giveaways.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    if (giveaway.entries.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ No Entries")
            .setDescription("Cannot reroll a giveaway with no entries.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // Select new winners
    const winners = selectWinners(
      giveaway.entries.map((e) => e.userId),
      giveaway.winnersCount
    );

    // Update database
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { winners },
    });

    // Update the message
    const channel = await client.channels.fetch(giveaway.channelId);
    if (channel?.isTextBased()) {
      try {
        const message = await channel.messages.fetch(giveaway.messageId);
        const embed = createGiveawayEndedEmbed(giveaway, winners);
        await message.edit({ embeds: [embed], components: [] });
      } catch (error) {
        logger.warn(`Failed to update giveaway message: ${error}`);
      }
    }

    // Announce reroll
    const winnersText = winners.map((id) => `<@${id}>`).join(", ");
    const rerollEmbed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("🎲 Giveaway Rerolled!")
      .setDescription(`**Prize:** ${giveaway.prize}\n**New Winner${winners.length === 1 ? "" : "s"}:** ${winnersText}`)
      .setFooter({ text: `Giveaway ID: ${giveaway.giveawayId}` })
      .setTimestamp();

    const rerollChannel = await client.channels.fetch(giveaway.channelId);
    if (rerollChannel?.isTextBased()) {
      await rerollChannel.send({ embeds: [rerollEmbed] });
    }

    // Log the reroll
    await client.logManager.log(interaction.guild!.id, "GIVEAWAY_REROLL", {
      userId: interaction.user.id,
      channelId: interaction.channelId,
      metadata: {
        giveawayId: giveaway.giveawayId,
        giveawayDbId: giveaway.id,
        oldWinners: giveaway.winners,
        newWinners: winners,
      },
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Giveaway Rerolled")
          .setDescription(
            `Successfully rerolled giveaway \`${giveawayId}\`\n**New Winner${winners.length === 1 ? "" : "s"}:** ${winnersText}`
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Failed to reroll giveaway:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to reroll giveaway. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

// Button interaction handler
export async function handleGiveawayInteraction(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith("giveaway_")) return;
  if (!interaction.guild) return;

  const [, action, giveawayId] = interaction.customId.split("_");

  if (action === "enter") {
    await handleGiveawayEntry(interaction, giveawayId);
  }
}

async function handleGiveawayEntry(interaction: ButtonInteraction, giveawayId: string): Promise<void> {
  try {
    const giveaway = await prisma.giveaway.findFirst({
      where: {
        giveawayId,
        guildId: interaction.guild!.id,
        isActive: true,
        hasEnded: false,
      },
      include: {
        entries: {
          where: { userId: interaction.user.id },
        },
      },
    });

    if (!giveaway) {
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

    // Check if user already entered
    if (giveaway.entries.length > 0) {
      await interaction.reply({
        content: "❌ You have already entered this giveaway.",
        ephemeral: true,
      });
      return;
    }

    // TODO: Add requirement checking here (roles, levels, etc.)
    // For now, allow all users to enter

    // Add entry to database
    await prisma.giveawayEntry.create({
      data: {
        giveawayId: giveaway.id,
        userId: interaction.user.id,
        guildId: interaction.guild!.id,
      },
    });

    // Update entry count
    const updatedGiveaway = await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        totalEntries: { increment: 1 },
      },
    });

    // Update the embed with new entry count
    try {
      const embed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY 🎉")
        .setDescription(`**Prize:** ${giveaway.prize}`)
        .setColor(0xf39c12)
        .addFields(
          { name: "⏰ Ends", value: `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: "👑 Winner(s)", value: giveaway.winnersCount.toString(), inline: true },
          { name: "🎫 Entries", value: updatedGiveaway.totalEntries.toString(), inline: true }
        )
        .setTimestamp(giveaway.endsAt)
        .setFooter({ text: `Giveaway ID: ${giveaway.giveawayId} • Ends` });

      if (giveaway.requirements) {
        embed.addFields({ name: "📋 Requirements", value: giveaway.requirements, inline: false });
      }

      await interaction.update({ embeds: [embed] });
    } catch (error) {
      logger.warn(`Failed to update giveaway embed: ${error}`);
      await interaction.reply({
        content: "✅ Successfully entered the giveaway!",
        ephemeral: true,
      });
    }

    logger.info(`User ${interaction.user.id} entered giveaway ${giveawayId} in guild ${interaction.guild!.id}`);
  } catch (error) {
    logger.error("Failed to handle giveaway entry:", error);
    await interaction.reply({
      content: "❌ Failed to enter giveaway. Please try again.",
      ephemeral: true,
    });
  }
}

// Utility functions
export async function endGiveaway(client: Client, giveawayDbId: string): Promise<void> {
  try {
    const giveaway = await prisma.giveaway.findFirst({
      where: {
        id: giveawayDbId,
        isActive: true,
        hasEnded: false,
      },
      include: {
        entries: true,
      },
    });

    if (!giveaway) {
      logger.warn(`Attempted to end non-existent or already ended giveaway: ${giveawayDbId}`);
      return;
    }

    // Select winners
    const winners = selectWinners(
      giveaway.entries.map((e) => e.userId),
      giveaway.winnersCount
    );

    // Update database
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        hasEnded: true,
        isActive: false,
        endedAt: new Date(),
        winners,
      },
    });

    // Update the message
    const channel = await client.channels.fetch(giveaway.channelId);
    if (channel?.isTextBased()) {
      try {
        const message = await channel.messages.fetch(giveaway.messageId);
        const embed = createGiveawayEndedEmbed(giveaway, winners);
        await message.edit({ embeds: [embed], components: [] });

        // Announce winners
        if (winners.length > 0) {
          const winnersText = winners.map((id) => `<@${id}>`).join(", ");
          const announceEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("🎊 Giveaway Ended!")
            .setDescription(
              `**Prize:** ${giveaway.prize}\n**Winner${winners.length === 1 ? "" : "s"}:** ${winnersText}\n\nCongratulations! 🎉`
            )
            .setFooter({ text: `Giveaway ID: ${giveaway.giveawayId}` })
            .setTimestamp();

          await channel.send({ content: winnersText, embeds: [announceEmbed] });
        } else {
          const noWinnerEmbed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("😔 Giveaway Ended")
            .setDescription(`**Prize:** ${giveaway.prize}\n\nNo valid entries were found. Better luck next time!`)
            .setFooter({ text: `Giveaway ID: ${giveaway.giveawayId}` })
            .setTimestamp();

          await channel.send({ embeds: [noWinnerEmbed] });
        }
      } catch (error) {
        logger.error(`Failed to update giveaway message: ${error}`);
      }
    }

    // Log the ending
    await client.logManager.log(giveaway.guildId, "GIVEAWAY_END", {
      channelId: giveaway.channelId,
      metadata: {
        giveawayId: giveaway.giveawayId,
        giveawayDbId: giveaway.id,
        totalEntries: giveaway.entries.length,
        winners,
        endedBy: "system",
      },
    });

    logger.info(`Giveaway ${giveaway.giveawayId} ended with ${winners.length} winner(s)`);
  } catch (error) {
    logger.error(`Failed to end giveaway ${giveawayDbId}:`, error);
  }
}

function selectWinners(userIds: string[], count: number): string[] {
  if (userIds.length === 0) return [];
  if (userIds.length <= count) return [...userIds];

  const shuffled = [...userIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

function createGiveawayEndedEmbed(
  giveaway: {
    prize: string;
    totalEntries: number;
    giveawayId: string;
    requirements?: string | null;
  },
  winners: string[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("🎉 GIVEAWAY ENDED 🎉")
    .setDescription(`**Prize:** ${giveaway.prize}`)
    .setColor(0x95a5a6)
    .addFields(
      { name: "⏰ Ended", value: `<t:${Math.floor(new Date().getTime() / 1000)}:R>`, inline: true },
      { name: "🎫 Total Entries", value: giveaway.totalEntries.toString(), inline: true },
      {
        name: "👑 Winner(s)",
        value: winners.length > 0 ? winners.map((id) => `<@${id}>`).join(", ") : "No winners",
        inline: false,
      }
    )
    .setFooter({ text: `Giveaway ID: ${giveaway.giveawayId} • Ended` })
    .setTimestamp();

  if (giveaway.requirements) {
    embed.addFields({ name: "📋 Requirements", value: giveaway.requirements, inline: false });
  }

  return embed;
}
