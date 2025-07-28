import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextChannel,
  type ThreadChannel,
} from "discord.js";

import { getGuildConfig } from "../../database/GuildConfig.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type LogManager from "../../structures/LogManager.js";
import { logTicketEvent } from "./ticketLogger.js";

// Helper function to sanitize username for channel/thread names
function sanitizeUsername(username: string): string {
  return username
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .toLowerCase()
    .substring(0, 20);
}

// Helper function to get next ticket number for a guild
async function getNextTicketNumber(guildId: string): Promise<number> {
  const lastTicket = await prisma.ticket.findFirst({
    where: { guildId },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });
  return (lastTicket?.ticketNumber ?? 0) + 1;
}

// Helper function to get permission overwrites based on access control configuration
function getTicketAccessPermissions(
  guild: Guild,
  config: {
    ticketAccessType?: string | null;
    ticketAccessRoleId?: string | null;
    ticketAccessPermission?: string | null;
    ticketOnCallRoleId?: string | null;
  },
  category?: string
): { id: string; allow: PermissionsBitField }[] {
  const permissions: { id: string; allow: PermissionsBitField }[] = [];

  // For admin tickets, only add the admin role (ticketAccessRoleId)
  if (category === "admin" && config.ticketAccessRoleId) {
    const adminRole = guild.roles.cache.get(config.ticketAccessRoleId);
    if (adminRole) {
      permissions.push({
        id: adminRole.id,
        allow: new PermissionsBitField([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ]),
      });
    }
    return permissions;
  }

  // For all other tickets, add both the support role and the configurable role
  if (config.ticketAccessType === "role" && config.ticketAccessRoleId) {
    // Role-based access: Only users with the specific role get access
    const role = guild.roles.cache.get(config.ticketAccessRoleId);
    if (role) {
      permissions.push({
        id: role.id,
        allow: new PermissionsBitField([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ]),
      });
    }
  } else if (config.ticketAccessType === "permission" && config.ticketAccessPermission) {
    // Permission-based access: Users with the specific permission get access
    const permissionFlag = PermissionFlagsBits[config.ticketAccessPermission as keyof typeof PermissionFlagsBits];
    if (permissionFlag) {
      const rolesWithPermission = guild.roles.cache.filter((role) => role.permissions.has(permissionFlag));

      rolesWithPermission.forEach((role) => {
        permissions.push({
          id: role.id,
          allow: new PermissionsBitField([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ]),
        });
      });
    }
  } else {
    // Fallback: Default to ManageMessages permission (existing behavior)
    const rolesWithManageMessages = guild.roles.cache.filter((role) =>
      role.permissions.has(PermissionFlagsBits.ManageMessages)
    );

    rolesWithManageMessages.forEach((role) => {
      permissions.push({
        id: role.id,
        allow: new PermissionsBitField([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ]),
      });
    });
  }

  // Add the on-call support role to all non-admin tickets
  if (config.ticketOnCallRoleId) {
    const onCallRole = guild.roles.cache.get(config.ticketOnCallRoleId);
    if (onCallRole) {
      permissions.push({
        id: onCallRole.id,
        allow: new PermissionsBitField([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ]),
      });
    }
  }

  return permissions;
}

export interface TicketCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

// Available ticket categories
const TICKET_CATEGORIES: TicketCategory[] = [
  { id: "general", name: "General Support", description: "General questions and help", emoji: "❓" },
  { id: "admin", name: "Admin Ticket", description: "Use this for admin related issues", emoji: "👨‍💼" },
  { id: "report", name: "Report User", description: "Report rule violations or problematic users", emoji: "🚨" },
  { id: "suggestion", name: "Suggestion", description: "Suggest improvements or new features", emoji: "💡" },
  { id: "technical", name: "Technical Issue", description: "Bot or server technical problems", emoji: "🔧" },
];

export async function handleTicketButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    switch (interaction.customId) {
      case "create_ticket":
        await showTicketCategorySelection(interaction);
        break;
      default:
        // Handle dynamic ticket buttons
        if (interaction.customId.startsWith("ticket_category_")) {
          await handleCategorySelection(interaction);
        } else if (interaction.customId.startsWith("ticket_close_")) {
          await handleTicketClose(interaction);
        } else if (interaction.customId.startsWith("ticket_claim_")) {
          await handleTicketClaim(interaction);
        }
        break;
    }
  } catch (error) {
    logger.error("Error handling ticket button interaction:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to process ticket interaction. Please try again.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  }
}

export async function handleTicketModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    if (interaction.customId.startsWith("ticket_create_")) {
      await handleTicketCreation(interaction);
    } else if (interaction.customId.startsWith("ticket_close_reason_")) {
      await handleTicketCloseWithReason(interaction);
    }
  } catch (error) {
    logger.error("Error handling ticket modal submission:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to process ticket action. Please try again.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  }
}

export async function handleTicketSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    // Handle other select menu interactions here if needed
  } catch (error) {
    logger.error("Error handling ticket select menu:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Failed to process selection. Please try again.",
        ephemeral: true,
      });
    }
  }
}

async function showTicketCategorySelection(interaction: ButtonInteraction): Promise<void> {
  const categoryEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🎫 Select Ticket Category")
    .setDescription("Please select the category that best describes your issue:")
    .setTimestamp();

  const categoryButtons = new ActionRowBuilder<ButtonBuilder>();

  TICKET_CATEGORIES.forEach((category) => {
    categoryButtons.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_category_${category.id}`)
        .setLabel(category.name)
        .setEmoji(category.emoji)
        .setStyle(ButtonStyle.Secondary)
    );
  });

  await interaction.reply({
    embeds: [categoryEmbed],
    components: [categoryButtons],
    ephemeral: true,
  });
}

async function handleCategorySelection(interaction: ButtonInteraction): Promise<void> {
  const categoryId = interaction.customId.replace("ticket_category_", "");
  const category = TICKET_CATEGORIES.find((cat) => cat.id === categoryId);

  if (!category) {
    await interaction.reply({
      content: "❌ Invalid category selected. Please try again.",
      ephemeral: true,
    });
    return;
  }

  // Create modal for ticket details
  const modal = new ModalBuilder()
    .setCustomId(`ticket_create_${categoryId}`)
    .setTitle(`Create ${category.name} Ticket`);

  const subjectInput = new TextInputBuilder()
    .setCustomId("ticket_subject")
    .setLabel("Subject")
    .setPlaceholder("Brief description of your issue")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("ticket_description")
    .setLabel("Description")
    .setPlaceholder("Detailed description of your issue...")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput)
  );

  await interaction.showModal(modal);
}

async function handleTicketCreation(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const categoryId = interaction.customId.replace("ticket_create_", "");
  const category = TICKET_CATEGORIES.find((c) => c.id === categoryId);

  if (!category) {
    await interaction.editReply({
      content: "❌ Invalid ticket category. Please try again.",
    });
    return;
  }

  const subject = interaction.fields.getTextInputValue("ticket_subject");
  const description = interaction.fields.getTextInputValue("ticket_description");

  // Get guild config
  const config = await getGuildConfig(interaction.guild.id);

  if (!config.ticketChannelId) {
    await interaction.editReply({
      content: "❌ Ticket system not configured. Please contact an administrator.",
    });
    return;
  }

  // Check if user already has an open ticket
  const existingTicket = await prisma.ticket.findFirst({
    where: {
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      status: { in: ["OPEN", "PENDING"] },
    },
  });

  if (existingTicket) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle("⚠️ Ticket Already Exists")
          .setDescription(
            `You already have an open ticket: **${existingTicket.title}**\n\n` +
              `Please use your existing ticket or close it before creating a new one.`
          )
          .addFields({
            name: "Existing Ticket",
            value: config.useTicketThreads ? `<#${existingTicket.channelId}>` : `<#${existingTicket.channelId}>`,
            inline: true,
          })
          .setTimestamp(),
      ],
    });
    return;
  }

  try {
    // Create ticket in database first
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: await getNextTicketNumber(interaction.guild.id),
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        channelId: "temp", // Will update after channel/thread creation
        title: subject,
        description,
        category: categoryId,
        status: "OPEN",
      },
    });

    let ticketChannel: ThreadChannel | TextChannel;
    const parentChannel = interaction.guild.channels.cache.get(String(config.ticketChannelId));

    if (!parentChannel?.isTextBased()) {
      await interaction.editReply({
        content: "❌ Ticket channel not found or is not a text channel. Please contact an administrator.",
      });
      return;
    }

    if (config.useTicketThreads) {
      // Create thread - ensure parent is a text channel
      const textParent = parentChannel as TextChannel;
      const thread = await textParent.threads.create({
        name: `🎫│${ticket.ticketNumber.toString().padStart(4, "0")} | ${interaction.user.displayName}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        type: ChannelType.PrivateThread,
        reason: `Ticket created by ${interaction.user.tag} (${interaction.user.id})`,
      });

      // Add user to thread
      await thread.members.add(interaction.user.id);
      ticketChannel = thread;
    } else {
      // Create channel in category
      if (!config.ticketCategoryId) {
        await interaction.editReply({
          content: "❌ Ticket category not configured. Please contact an administrator.",
        });
        return;
      }

      const sanitizedUsername = sanitizeUsername(interaction.user.username);
      const channel = await interaction.guild.channels.create({
        name: `ticket-${ticket.ticketNumber.toString().padStart(4, "0")}-${sanitizedUsername}`,
        type: ChannelType.GuildText,
        parent: String(config.ticketCategoryId),
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          // Allow access based on configured access control
          ...getTicketAccessPermissions(interaction.guild, config, categoryId),
        ],
        reason: `Ticket created by ${interaction.user.tag} (${interaction.user.id})`,
      });

      ticketChannel = channel;
    }

    // Update ticket with actual channel ID
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { channelId: ticketChannel.id },
    });

    // Create ticket embed
    const ticketEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🎫 Ticket #${ticket.ticketNumber.toString().padStart(4, "0")}`)
      .addFields(
        { name: "👤 Created by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "📝 Category", value: `${category.emoji} ${category.name}`, inline: true },
        { name: "📋 Title", value: subject, inline: false }
      )
      .setTimestamp();

    if (description) {
      ticketEmbed.addFields({ name: "📄 Description", value: description, inline: false });
    }

    ticketEmbed.addFields(
      { name: "🆔 Status", value: "🟢 Open", inline: true },
      { name: "👨‍💼 Assigned", value: "❌ Unassigned", inline: true }
    );

    // Create action buttons with claim functionality
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticket.id}`)
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket_claim_${ticket.id}`)
        .setLabel("Claim")
        .setEmoji("✋")
        .setStyle(ButtonStyle.Success)
    );

    // Send welcome message in ticket channel
    await ticketChannel.send({
      content: config.ticketOnCallRoleId
        ? `<@${interaction.user.id}> Welcome to your support ticket!\n<@&${String(config.ticketOnCallRoleId)}>`
        : `<@${interaction.user.id}> Welcome to your support ticket!`,
      embeds: [ticketEmbed],
      components: [actionRow],
      allowedMentions: config.ticketOnCallRoleId
        ? { users: [interaction.user.id], roles: [String(config.ticketOnCallRoleId)] }
        : { users: [interaction.user.id] },
    });

    // Send confirmation to user
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Ticket Created")
          .setDescription(`Your ticket has been created: <#${ticketChannel.id}>`)
          .addFields(
            { name: "🎫 Ticket Number", value: `#${ticket.ticketNumber.toString().padStart(4, "0")}`, inline: true },
            { name: "📝 Category", value: category.name, inline: true }
          )
          .setTimestamp(),
      ],
    });

    // Log ticket creation
    const client = interaction.client as typeof interaction.client & { logManager: LogManager };
    await client.logManager.log(interaction.guild.id, "TICKET_CREATE", {
      userId: interaction.user.id,
      metadata: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        category: category.name,
        title: subject,
        channelId: ticketChannel.id,
      },
    });

    // Log to dedicated ticket logging channel
    await logTicketEvent(interaction.guild, "CREATE", {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: interaction.user.id,
      channelId: ticketChannel.id,
      action: "Ticket created",
      metadata: {
        title: subject,
        category: category.name,
        useThreads: config.useTicketThreads,
      },
    });
  } catch (error) {
    logger.error("Error creating ticket:", error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to create ticket. Please try again or contact an administrator.")
          .setTimestamp(),
      ],
    });
  }
}

async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;

  const member = interaction.member as GuildMember;
  const channel = interaction.channel;

  if (!channel) {
    await interaction.reply({
      content: "❌ Cannot determine ticket channel.",
      ephemeral: true,
    });
    return;
  }

  // Find ticket in database - try by ID first if available, then by channel
  let ticket;

  if (interaction.customId.startsWith("ticket_close_")) {
    const ticketId = interaction.customId.replace("ticket_close_", "");
    ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        guildId: interaction.guild.id,
        status: { in: ["OPEN", "PENDING"] },
      },
    });
  }

  if (!ticket) {
    ticket = await prisma.ticket.findFirst({
      where: {
        guildId: interaction.guild.id,
        channelId: channel.id,
        status: { in: ["OPEN", "PENDING"] },
      },
    });
  }

  if (!ticket) {
    await interaction.reply({
      content: "❌ This doesn't appear to be an active ticket channel.",
      ephemeral: true,
    });
    return;
  }

  // Check permissions (ticket owner or staff)
  const isTicketOwner = ticket.userId === interaction.user.id;
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (!isTicketOwner && !isStaff) {
    await interaction.reply({
      content: "❌ Only the ticket creator or staff can close tickets.",
      ephemeral: true,
    });
    return;
  }

  // Show modal for close reason
  const modal = new ModalBuilder().setCustomId(`ticket_close_reason_${ticket.id}`).setTitle("Close Ticket");

  const reasonInput = new TextInputBuilder()
    .setCustomId("close_reason")
    .setLabel("Reason (Optional)")
    .setPlaceholder("Why are you closing this ticket?")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));

  await interaction.showModal(modal);
}

async function handleTicketCloseWithReason(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) return;

  const ticketId = interaction.customId.replace("ticket_close_reason_", "");
  const rawReason = interaction.fields.getTextInputValue("close_reason").trim();
  const reason = rawReason ? rawReason : null;

  const member = interaction.member as GuildMember;
  const channel = interaction.channel;

  if (!channel) {
    await interaction.reply({
      content: "❌ Cannot determine ticket channel.",
      ephemeral: true,
    });
    return;
  }

  // Find ticket in database by ID
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      guildId: interaction.guild.id,
      status: { in: ["OPEN", "PENDING"] },
    },
  });

  if (!ticket) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Ticket Not Found")
          .setDescription("This ticket is no longer active or has already been closed.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // Re-check permissions (they may have changed since button click)
  const isTicketOwner = ticket.userId === interaction.user.id;
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (!isTicketOwner && !isStaff) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Permission Denied")
          .setDescription("You no longer have permission to close this ticket.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  try {
    // Close ticket with reason
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "CLOSED",
        closedBy: interaction.user.id,
        closedAt: new Date(),
        closedReason: reason,
      },
    });

    const closeEmbed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle("🔒 Ticket Closed")
      .setDescription(`This ticket has been closed by ${interaction.user}.`)
      .addFields(
        { name: "📊 Final Status", value: "Closed", inline: true },
        { name: "🕐 Closed At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();

    // Add reason field if provided
    if (reason) {
      closeEmbed.addFields({ name: "📝 Reason", value: reason, inline: false });
    }

    await interaction.reply({
      embeds: [closeEmbed],
      components: [], // Remove all buttons
    });

    // Send a follow-up message about the archiving
    setTimeout(() => {
      void interaction.followUp({
        content: "🔒 Channel will be archived in 10 seconds.",
        ephemeral: true,
      });
    }, 1000);

    // Remove all users except administrators from the ticket channel
    if (channel.isTextBased() && !channel.isDMBased()) {
      try {
        const textChannel = channel as TextChannel;
        const overwrites = textChannel.permissionOverwrites.cache;

        for (const [id, overwrite] of overwrites) {
          // Skip if it's the bot or a role with administrator permissions
          if (id === interaction.client.user?.id) continue;

          const member = interaction.guild.members.cache.get(id);
          const role = interaction.guild.roles.cache.get(id);

          // Keep administrators
          if (member && member.permissions.has(PermissionFlagsBits.Administrator)) continue;
          if (role && role.permissions.has(PermissionFlagsBits.Administrator)) continue;

          // Remove the overwrite
          await textChannel.permissionOverwrites.delete(id);
        }
      } catch (error) {
        logger.error("Error removing users from ticket channel:", error);
      }
    }

    // Archive thread or log closure after delay
    setTimeout(() => {
      void (async () => {
        try {
          if (channel.isThread()) {
            await (channel as ThreadChannel).setArchived(true, "Ticket closed");
          } else {
            // For regular channels, just log that it's closed
            logger.info(`Ticket channel ${channel.id} closed and ready for manual cleanup`);
          }
        } catch (error) {
          logger.warn(`Failed to archive ticket channel ${channel.id}:`, error);
        }
      })();
    }, 10000); // 10 second delay

    // Log ticket closure
    const client = interaction.client as typeof interaction.client & { logManager: LogManager };
    await client.logManager.log(interaction.guild.id, "TICKET_CLOSE", {
      userId: interaction.user.id,
      channelId: channel.id,
      metadata: {
        ticketId: ticket.id,
        closedBy: interaction.user.id,
        isStaff,
        reason: reason ?? "No reason provided",
      },
    });

    // Log to dedicated ticket logging channel
    await logTicketEvent(interaction.guild, "CLOSE", {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: interaction.user.id,
      channelId: channel.id,
      action: "Ticket closed",
      details: reason ?? "No reason provided",
      metadata: {
        isStaff,
        closedBy: interaction.user.id,
      },
    });
  } catch (error) {
    logger.error("Error closing ticket:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to close ticket. Please try again or contact an administrator.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function handleTicketClaim(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;

  const member = interaction.member as GuildMember;
  const channel = interaction.channel;

  if (!channel) {
    await interaction.reply({
      content: "❌ Cannot determine ticket channel.",
      ephemeral: true,
    });
    return;
  }

  // Check if user has staff permissions
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageChannels);
  if (!isStaff) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Permission Denied")
          .setDescription("Only staff members can claim tickets.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // Extract ticket ID from button custom ID
  const ticketId = interaction.customId.replace("ticket_claim_", "");

  // Find ticket in database
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      guildId: interaction.guild.id,
      status: { in: ["OPEN", "PENDING"] },
    },
  });

  if (!ticket) {
    await interaction.reply({
      content: "❌ This ticket is no longer active or doesn't exist.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.assignedTo) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Ticket Already Claimed")
          .setDescription(`This ticket is already assigned to <@${ticket.assignedTo}>.`)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // Get guild config for silent claim setting
  const config = await getGuildConfig(interaction.guild.id);
  const shouldBeSilent = Boolean(config.ticketSilentClaim);

  // Update ticket assignment
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      assignedTo: interaction.user.id,
      status: "PENDING",
    },
  });

  // Get the category info
  const category = TICKET_CATEGORIES.find((c) => c.id === ticket.category);
  const categoryDisplay = category ? `${category.emoji} ${category.name}` : ticket.category;

  // Update the original embed to show the assigned moderator
  const updatedEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🎫 Ticket #${ticket.ticketNumber.toString().padStart(4, "0")}`)
    .addFields(
      { name: "👤 Created by", value: `<@${ticket.userId}>`, inline: true },
      { name: "📝 Category", value: categoryDisplay, inline: true },
      { name: "📋 Title", value: ticket.title, inline: false }
    )
    .setTimestamp();

  if (ticket.description) {
    updatedEmbed.addFields({ name: "📄 Description", value: ticket.description, inline: false });
  }

  updatedEmbed.addFields(
    { name: "🆔 Status", value: "🟡 Pending", inline: true },
    { name: "👨‍💼 Assigned", value: `<@${interaction.user.id}>`, inline: true }
  );

  // Keep the same buttons but update the message
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_${ticket.id}`)
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticket.id}`)
      .setLabel("Claim")
      .setEmoji("✋")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true) // Disable claim button since it's now claimed
  );

  // Update the original message
  await interaction.update({
    embeds: [updatedEmbed],
    components: [actionRow],
  });

  // Send confirmation in channel only if not silent
  if (!shouldBeSilent && channel.isTextBased() && "send" in channel) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("👨‍💼 Ticket Claimed")
          .setDescription(`This ticket has been claimed by <@${interaction.user.id}>.`)
          .setTimestamp(),
      ],
    });
  }

  // Log ticket claim
  const client = interaction.client as typeof interaction.client & { logManager: LogManager };
  await client.logManager.log(interaction.guild.id, "TICKET_CLAIM", {
    userId: interaction.user.id,
    channelId: channel.id,
    metadata: {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      claimedBy: interaction.user.id,
      silent: shouldBeSilent,
    },
  });

  // Log to dedicated ticket logging channel
  await logTicketEvent(interaction.guild, "CLAIM", {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    userId: interaction.user.id,
    channelId: channel.id,
    action: "Ticket claimed",
    metadata: {
      claimedBy: interaction.user.id,
      silent: shouldBeSilent,
    },
  });
}
