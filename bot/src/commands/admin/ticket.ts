import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type CategoryChannel,
  type ChatInputCommandInteraction,
  type GuildMember,
  type TextChannel,
} from "discord.js";

import type { Ticket as DbTicket } from "@shared/database";
import camelCaseFn from "lodash/camelCase.js";
import kebabCaseFn from "lodash/kebabCase.js";
import { getGuildConfig } from "../../database/GuildConfig.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse, SlashCommandInteraction } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

// Helper function to sanitize username for channel/thread names
function sanitizeUsername(username: string): string {
  // Remove special characters and limit length
  return username
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .toLowerCase()
    .substring(0, 20); // Limit to 20 chars to keep total name reasonable
}

// Helper function to detect current ticket from channel/thread
async function detectCurrentTicket(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channel) return null;

  // Method 1: Direct channel/thread lookup
  const directTicket = await prisma.ticket.findFirst({
    where: {
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      status: { in: ["OPEN", "PENDING"] },
    },
  });

  if (directTicket) return directTicket;

  // Method 2: Parse thread name for ticket number
  if (interaction.channel.isThread()) {
    const threadName = interaction.channel.name;
    const ticketNumberRegex = /(\d{4})/;
    const ticketNumberMatch = ticketNumberRegex.exec(threadName);
    if (ticketNumberMatch) {
      const ticketNumber = parseInt(ticketNumberMatch[1]);
      return await prisma.ticket.findFirst({
        where: {
          guildId: interaction.guild.id,
          ticketNumber,
          status: { in: ["OPEN", "PENDING"] },
        },
      });
    }
  }

  // Method 3: Parse channel name for ticket number
  if (interaction.channel.type === ChannelType.GuildText) {
    const channelName = interaction.channel.name;
    const ticketNumberRegex = /ticket-(\d{4})/;
    const ticketNumberMatch = ticketNumberRegex.exec(channelName);
    if (ticketNumberMatch) {
      const ticketNumber = parseInt(ticketNumberMatch[1]);
      return await prisma.ticket.findFirst({
        where: {
          guildId: interaction.guild.id,
          ticketNumber,
          status: { in: ["OPEN", "PENDING"] },
        },
      });
    }
  }

  return null;
}

// Helper functions converted from class methods
async function createTicket(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const category = interaction.options.getString("category", true);
  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description");

  try {
    // Check if user already has an open ticket
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        status: { in: ["OPEN", "PENDING"] },
      },
    });

    if (existingTicket) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Ticket Already Exists")
            .setDescription(
              `You already have an open ticket: #${existingTicket.ticketNumber}\n<#${existingTicket.channelId}>`
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // Get next ticket number
    const lastTicket = await prisma.ticket.findFirst({
      where: { guildId: interaction.guild.id },
      orderBy: { ticketNumber: "desc" },
    });
    const ticketNumber = (lastTicket?.ticketNumber ?? 0) + 1;

    // Find or create tickets category
    let ticketsCategory = interaction.guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase().includes("ticket")
    ) as CategoryChannel | undefined;

    ticketsCategory ??= await interaction.guild.channels.create({
      name: "🎫│Support Tickets",
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });

    // Create ticket channel with enhanced naming
    const sanitizedUsername = sanitizeUsername(interaction.user.username);
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${ticketNumber.toString().padStart(4, "0")}-${sanitizedUsername}`,
      type: ChannelType.GuildText,
      parent: ticketsCategory.id,
      topic: `${category.toUpperCase()} | ${title} | Created by ${interaction.user.tag}`,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
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
        ...(client.user
          ? [
              {
                id: client.user.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ManageMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
            ]
          : []),
      ],
    });

    // Create ticket in database
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        channelId: ticketChannel.id,
        category: category.toUpperCase(),
        title,
        description,
      },
    });

    // Create ticket embed and control panel
    const ticketEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🎫 Ticket #${ticketNumber.toString().padStart(4, "0")}`)
      .addFields(
        { name: "👤 Created by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "📝 Category", value: category.charAt(0).toUpperCase() + category.slice(1), inline: true },
        { name: "📋 Title", value: title, inline: false }
      )
      .setTimestamp();

    if (description) {
      ticketEmbed.addFields({ name: "📄 Description", value: description, inline: false });
    }

    ticketEmbed.addFields(
      { name: "🆔 Status", value: "🟢 Open", inline: true },
      { name: "👨‍💼 Assigned", value: "❌ Unassigned", inline: true }
    );

    const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    const config = await getGuildConfig(interaction.guild.id);
    await ticketChannel.send({
      content: config.ticketOnCallRoleId
        ? `<@${interaction.user.id}> Welcome to your support ticket!\n||<@&${String(config.ticketOnCallRoleId)}>||`
        : `<@${interaction.user.id}> Welcome to your support ticket!`,
      embeds: [ticketEmbed],
      components: [controlRow],
    });

    // Send confirmation to user
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Ticket Created")
          .setDescription(`Your ticket has been created: <#${ticketChannel.id}>`)
          .addFields(
            { name: "🎫 Ticket Number", value: `#${ticketNumber.toString().padStart(4, "0")}`, inline: true },
            { name: "📝 Category", value: category.charAt(0).toUpperCase() + category.slice(1), inline: true }
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    // Log ticket creation
    await client.logManager.log(interaction.guild.id, "TICKET_CREATE", {
      userId: interaction.user.id,
      channelId: interaction.channel?.id ?? "",
      metadata: {
        ticketId: ticket.id,
        ticketNumber,
        category,
        title,
        channelId: ticketChannel.id,
      },
    });
  } catch (error) {
    logger.error("Error creating ticket:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to create ticket. Please try again or contact an administrator.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function closeTicket(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel) return;

  const reason = interaction.options.getString("reason") ?? "No reason provided";

  try {
    // Find ticket by channel ID
    const ticket = await prisma.ticket.findFirst({
      where: {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        status: { in: ["OPEN", "PENDING"] },
      },
    });

    if (!ticket) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Not a Ticket Channel")
            .setDescription("This command can only be used in an active ticket channel.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // Check permissions - only ticket creator, staff, or admins can close
    const isTicketOwner = ticket.userId === interaction.user.id;
    const isStaff = (interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageChannels);

    if (!isTicketOwner && !isStaff) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Permission Denied")
            .setDescription("Only the ticket creator or staff members can close tickets.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // Update ticket status in database
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "CLOSED",
        closedBy: interaction.user.id,
        closedAt: new Date(),
        closedReason: reason,
      },
    });

    // Create closure embed
    const closureEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔒 Ticket Closed")
      .addFields(
        { name: "👤 Closed by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "🎫 Ticket", value: `#${ticket.ticketNumber.toString().padStart(4, "0")}`, inline: true }
      )
      .setTimestamp();

    // Add reason field if provided
    if (reason && reason !== "No reason provided") {
      closureEmbed.addFields({ name: "📝 Reason", value: reason, inline: false });
    }

    await interaction.reply({
      embeds: [closureEmbed],
    });

    // Log ticket closure
    await client.logManager.log(interaction.guild.id, "TICKET_CLOSE", {
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      metadata: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        reason,
        closedBy: interaction.user.id,
      },
    });

    // Archive/delete channel after delay
    setTimeout(() => {
      (interaction.channel as TextChannel).delete().catch(logger.error);
    }, 10000);
  } catch (error) {
    logger.error("Error closing ticket:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to close ticket. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function claimTicket(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const ticketNumber = interaction.options.getInteger("ticket");
  const silent = interaction.options.getBoolean("silent");

  try {
    // Check if user has staff permissions
    const isStaff = (interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageChannels);
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

    let ticket: DbTicket | null;

    // If ticket number provided, find by number
    if (ticketNumber) {
      ticket = await prisma.ticket.findFirst({
        where: {
          guildId: interaction.guild.id,
          ticketNumber,
          status: { in: ["OPEN", "PENDING"] },
        },
      });

      if (!ticket) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("❌ Ticket Not Found")
              .setDescription(`No open ticket found with number #${ticketNumber.toString().padStart(4, "0")}.`)
              .setTimestamp(),
          ],
          ephemeral: true,
        });
        return;
      }
    } else {
      // Try to detect current ticket
      ticket = await detectCurrentTicket(interaction);

      if (!ticket) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("❌ Ticket Not Found")
              .setDescription(
                "Could not detect a ticket in this channel. Please specify a ticket number:\n" +
                  "`/ticket claim ticket:1234`"
              )
              .setTimestamp(),
          ],
          ephemeral: true,
        });
        return;
      }
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
    const shouldBeSilent = silent ?? Boolean(config.ticketSilentClaim);

    // Update ticket assignment
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedTo: interaction.user.id,
        status: "PENDING",
      },
    });

    // Try to update the original ticket embed in the channel
    const ticketChannel = interaction.guild.channels.cache.get(ticket.channelId);
    if (ticketChannel?.isTextBased() && "messages" in ticketChannel) {
      try {
        const messages = await ticketChannel.messages.fetch({ limit: 10 });
        const ticketMessage = messages.find(
          (msg) =>
            msg.author.bot &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title?.includes(`Ticket #${ticket.ticketNumber.toString().padStart(4, "0")}`)
        );

        if (ticketMessage) {
          const embed = ticketMessage.embeds[0];
          const updatedEmbed = new EmbedBuilder().setColor(embed.color ?? 0x3498db).setTitle(embed.title ?? "Ticket");

          if (embed.timestamp) {
            updatedEmbed.setTimestamp(new Date(embed.timestamp));
          }

          embed.fields.forEach((field) => {
            if (field.name === "🆔 Status") {
              updatedEmbed.addFields({ name: field.name, value: "🟡 Pending", inline: field.inline });
            } else if (field.name === "👨‍💼 Assigned") {
              updatedEmbed.addFields({ name: field.name, value: `<@${interaction.user.id}>`, inline: field.inline });
            } else {
              updatedEmbed.addFields({ name: field.name, value: field.value, inline: field.inline });
            }
          });

          // Update buttons to disable claim button
          const updatedComponents = ticketMessage.components.map((row) => {
            if (row.type === ComponentType.ActionRow) {
              // Action Row
              const newButtons = row.components.map((component) => {
                if (component.type === ComponentType.Button && component.customId?.startsWith("ticket_claim_")) {
                  // Button
                  return ButtonBuilder.from(component).setDisabled(true);
                } else if (component.type === ComponentType.Button) {
                  return ButtonBuilder.from(component);
                }
                return component;
              });
              return new ActionRowBuilder<ButtonBuilder>().addComponents(newButtons as ButtonBuilder[]);
            }
            return row;
          });

          await ticketMessage.edit({
            embeds: [updatedEmbed],
            components: updatedComponents,
          });
        }
      } catch (error) {
        logger.warn("Failed to update ticket embed:", error);
      }
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Ticket Claimed")
          .setDescription(`You have successfully claimed ticket #${ticket.ticketNumber.toString().padStart(4, "0")}.`)
          .addFields(
            { name: "🎫 Ticket", value: `<#${ticket.channelId}>`, inline: true },
            { name: "👤 Assigned to", value: `<@${interaction.user.id}>`, inline: true },
            { name: "🤫 Silent Claim", value: shouldBeSilent ? "Yes" : "No", inline: true }
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    // Notify in ticket channel only if not silent
    if (!shouldBeSilent) {
      const ticketChannel = interaction.guild.channels.cache.get(ticket.channelId);
      if (ticketChannel?.isTextBased() && "send" in ticketChannel) {
        await ticketChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle("👨‍💼 Ticket Claimed")
              .setDescription(`This ticket has been claimed by <@${interaction.user.id}>.`)
              .setTimestamp(),
          ],
        });
      }
    }

    // Log ticket claim
    await client.logManager.log(interaction.guild.id, "TICKET_CLAIM", {
      userId: interaction.user.id,
      channelId: interaction.channel?.id,
      metadata: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        claimedBy: interaction.user.id,
        silent: shouldBeSilent,
      },
    });
  } catch (error) {
    logger.error("Error claiming ticket:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to claim ticket. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function assignTicket(_client: Client, _interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Implement ticket assignment functionality
}

async function listTickets(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const statusFilter = interaction.options.getString("status") as "OPEN" | "PENDING" | "CLOSED" | null;
  const userFilter = interaction.options.getUser("user");

  try {
    interface TicketWhereClause {
      guildId: string;
      status?: "OPEN" | "PENDING" | "CLOSED";
      userId?: string;
    }

    const whereClause: TicketWhereClause = {
      guildId: interaction.guild.id,
    };

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    if (userFilter) {
      whereClause.userId = userFilter.id;
    }

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    if (tickets.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle("📝 No Tickets Found")
            .setDescription("No tickets match your search criteria.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder().setColor(0x3498db).setTitle("🎫 Ticket List").setTimestamp();

    const ticketList = tickets
      .map((ticket) => {
        const statusEmoji = {
          OPEN: "🟢",
          PENDING: "🟡",
          CLOSED: "🔴",
        }[ticket.status];

        return [
          `**#${ticket.ticketNumber.toString().padStart(4, "0")}** ${statusEmoji} ${ticket.status}`,
          `└ **${ticket.title}** by <@${ticket.userId}>`,
          `└ ${ticket.category} • <#${ticket.channelId}>`,
        ].join("\n");
      })
      .join("\n\n");

    embed.setDescription(ticketList);

    if (statusFilter) {
      embed.addFields({ name: "📊 Filter", value: `Status: ${statusFilter}`, inline: true });
    }

    if (userFilter) {
      embed.addFields({
        name: "👤 User Filter",
        value: `<@${userFilter.id}>`,
        inline: true,
      });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error listing tickets:", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to retrieve tickets. Please try again.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }
}

async function getTicketInfo(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const ticketId = interaction.options.getString("ticket-id");
  let ticket: DbTicket | null;

  if (ticketId) {
    // Look up by ID or number
    const isNumeric = /^\d+$/.test(ticketId);
    if (isNumeric) {
      const ticketNumber = parseInt(ticketId);
      ticket = await prisma.ticket.findFirst({
        where: { guildId: interaction.guild.id, ticketNumber },
      });
    } else {
      ticket = await prisma.ticket.findFirst({
        where: { guildId: interaction.guild.id, id: ticketId },
      });
    }
  } else {
    // Auto-detect from current channel
    ticket = await detectCurrentTicket(interaction);
  }

  if (!ticket) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Ticket Not Found")
          .setDescription("Could not find the specified ticket.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  // Get message count
  const messageCount = await prisma.ticketMessage.count({
    where: { ticketId: ticket.id },
  });

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🎫 Ticket #${ticket.ticketNumber.toString().padStart(4, "0")}`)
    .addFields(
      { name: "📝 Title", value: ticket.title, inline: true },
      { name: "📋 Category", value: ticket.category, inline: true },
      { name: "🆔 Status", value: ticket.status, inline: true },
      { name: "👤 Creator", value: `<@${ticket.userId}>`, inline: true },
      { name: "📍 Channel", value: `<#${ticket.channelId}>`, inline: true },
      { name: "💬 Messages", value: messageCount.toString(), inline: true },
      { name: "📅 Created", value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:F>`, inline: false }
    )
    .setTimestamp();

  if (ticket.description) {
    embed.addFields({ name: "📄 Description", value: ticket.description, inline: false });
  }

  if (ticket.assignedTo) {
    embed.addFields({ name: "👨‍💼 Assigned", value: `<@${ticket.assignedTo}>`, inline: true });
  }

  if (ticket.closedAt) {
    embed.addFields({
      name: "🔒 Closed",
      value: `<t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:F>`,
      inline: true,
    });
  }

  if (ticket.closedReason) {
    embed.addFields({ name: "📝 Close Reason", value: ticket.closedReason, inline: false });
  }

  await interaction.reply({ embeds: [embed] });
}

async function generateTranscript(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });

  const ticketId = interaction.options.getString("ticket-id");
  const format = interaction.options.getString("format") as "html" | "txt" | "both" | null;
  const theme = interaction.options.getString("theme") as "light" | "dark" | null;

  let ticket: DbTicket | null;

  if (ticketId) {
    // Look up by ID or number
    const isNumeric = /^\d+$/.test(ticketId);
    if (isNumeric) {
      const ticketNumber = parseInt(ticketId);
      ticket = await prisma.ticket.findFirst({
        where: { guildId: interaction.guild.id, ticketNumber },
      });
    } else {
      ticket = await prisma.ticket.findFirst({
        where: { guildId: interaction.guild.id, id: ticketId },
      });
    }
  } else {
    // Auto-detect from current channel
    ticket = await detectCurrentTicket(interaction);
  }

  if (!ticket) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Ticket Not Found")
          .setDescription("Could not find the specified ticket.")
          .setTimestamp(),
      ],
    });
    return;
  }

  try {
    // Import transcript generator
    const { generateTicketTranscript } = await import("../../functions/discord/ticketTranscript.js");

    const result = await generateTicketTranscript(interaction.guild, ticket.id, {
      format: format ?? "html",
      theme: theme ?? "light",
      includeAttachments: true,
      includeEmbeds: true,
    });

    const files: AttachmentBuilder[] = [];
    if (result.html) files.push(result.html);
    if (result.txt) files.push(result.txt);

    await interaction.editReply({
      embeds: [result.embed],
      files,
    });
  } catch (error) {
    logger.error("Error generating transcript:", error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Transcript Generation Failed")
          .setDescription("Failed to generate transcript. Please try again later.")
          .setTimestamp(),
      ],
    });
  }
}

async function addUserToTicket(_client: Client, _interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Implement add user to ticket functionality
}

async function removeUserFromTicket(_client: Client, _interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Implement remove user from ticket functionality
}

// Ticket-related setting keys from GuildConfig
const ticketSettings = [
  "ticketChannelId",
  "ticketCategoryId",
  "useTicketThreads",
  "ticketOnCallRoleId",
  "ticketSilentClaim",
  "ticketAccessType",
  "ticketAccessRoleId",
  "ticketAccessPermission",
  "ticketLogChannelId",
] as const;

const kebabCase = kebabCaseFn;
const camelCase = camelCaseFn;

/**
 * Ticket Command - Manage support tickets
 */
export class TicketCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "ticket",
      description: "ADMIN ONLY: Manage support tickets",
      category: "admin",
      permissions: {
        level: PermissionLevel.ADMIN,
        discordPermissions: [PermissionFlagsBits.Administrator],
        isConfigurable: true,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const subcommand = (this.interaction as SlashCommandInteraction).options.getSubcommand();

    try {
      switch (subcommand) {
        case "close":
          return await this.handleClose();
        case "add":
          return await this.handleAdd();
        case "remove":
          return await this.handleRemove();
        case "list":
          return await this.handleList();
        case "transcript":
          return await this.handleTranscript();
        default:
          return {
            content: "❌ Unknown subcommand",
            ephemeral: true,
          };
      }
    } catch (error) {
      logger.error("Error in ticket command:", error);
      return {
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleClose(): Promise<CommandResponse> {
    const reason = this.getStringOption("reason") ?? "No reason provided";
    const channel = this.interaction.channel as TextChannel;

    try {
      // Check if this is a ticket channel
      const ticket = await prisma.ticket.findFirst({
        where: {
          guildId: this.guild.id,
          channelId: channel.id,
          status: "OPEN",
        },
      });

      if (!ticket) {
        return {
          content: "❌ This is not an active ticket channel.",
          ephemeral: true,
        };
      }

      // Update ticket status
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedBy: this.user.id,
          closeReason: reason,
        },
      });

      // Create transcript if configured
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: this.guild.id },
      });

      let transcriptSent = false;
      if (guildConfig?.ticketLogChannelId) {
        const logChannel = this.guild.channels.cache.get(guildConfig.ticketLogChannelId) as TextChannel;
        if (logChannel) {
          try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = Array.from(messages.values())
              .reverse()
              .map((msg) => `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}`)
              .join("\n");

            const transcriptEmbed = new EmbedBuilder()
              .setColor(0x95a5a6)
              .setTitle("🎫 Ticket Closed")
              .setDescription(`Ticket in <#${channel.id}> has been closed.`)
              .addFields(
                { name: "Ticket ID", value: ticket.id, inline: true },
                { name: "Opened By", value: `<@${ticket.userId}>`, inline: true },
                { name: "Closed By", value: `<@${this.user.id}>`, inline: true },
                { name: "Reason", value: reason, inline: false }
              )
              .setTimestamp();

            await logChannel.send({ embeds: [transcriptEmbed] });
            transcriptSent = true;
          } catch (error) {
            logger.error("Failed to send transcript:", error);
          }
        }
      }

      // Send closure message
      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle("🎫 Ticket Closed")
        .setDescription("This ticket has been closed and will be deleted in 10 seconds.")
        .addFields(
          { name: "Closed By", value: this.user.toString(), inline: true },
          { name: "Reason", value: reason, inline: true },
          { name: "Transcript", value: transcriptSent ? "✅ Saved to logs" : "❌ Not available", inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // Delete the channel after 10 seconds
      setTimeout(async () => {
        try {
          await channel.delete();
        } catch (error) {
          logger.error("Failed to delete ticket channel:", error);
        }
      }, 10000);

      // Log ticket closure
      await this.client.logManager.log(this.guild.id, "TICKET_CLOSED", {
        userId: this.user.id,
        metadata: {
          ticketId: ticket.id,
          channelId: channel.id,
          reason,
          openedBy: ticket.userId,
        },
      });

      return {
        content: "✅ Ticket closed successfully. Channel will be deleted in 10 seconds.",
        ephemeral: true,
      };
    } catch (error) {
      logger.error("Error closing ticket:", error);
      return {
        content: `❌ Failed to close ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleAdd(): Promise<CommandResponse> {
    const user = this.getUserOption("user", true);
    const channel = this.interaction.channel as TextChannel;

    try {
      // Check if this is a ticket channel
      const ticket = await prisma.ticket.findFirst({
        where: {
          guildId: this.guild.id,
          channelId: channel.id,
          status: "OPEN",
        },
      });

      if (!ticket) {
        return {
          content: "❌ This is not an active ticket channel.",
          ephemeral: true,
        };
      }

      // Add user to ticket channel
      await channel.permissionOverwrites.create(user, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ User Added to Ticket")
        .setDescription(`${user} has been added to this ticket.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // Log user addition
      await this.client.logManager.log(this.guild.id, "TICKET_USER_ADDED", {
        userId: this.user.id,
        metadata: {
          ticketId: ticket.id,
          channelId: channel.id,
          addedUser: user.id,
        },
      });

      return {
        content: `✅ Successfully added ${user} to the ticket.`,
        ephemeral: true,
      };
    } catch (error) {
      logger.error("Error adding user to ticket:", error);
      return {
        content: `❌ Failed to add user to ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleRemove(): Promise<CommandResponse> {
    const user = this.getUserOption("user", true);
    const channel = this.interaction.channel as TextChannel;

    try {
      // Check if this is a ticket channel
      const ticket = await prisma.ticket.findFirst({
        where: {
          guildId: this.guild.id,
          channelId: channel.id,
          status: "OPEN",
        },
      });

      if (!ticket) {
        return {
          content: "❌ This is not an active ticket channel.",
          ephemeral: true,
        };
      }

      // Don't remove the ticket owner
      if (user.id === ticket.userId) {
        return {
          content: "❌ Cannot remove the ticket owner from their own ticket.",
          ephemeral: true,
        };
      }

      // Remove user from ticket channel
      await channel.permissionOverwrites.delete(user);

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("❌ User Removed from Ticket")
        .setDescription(`${user} has been removed from this ticket.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // Log user removal
      await this.client.logManager.log(this.guild.id, "TICKET_USER_REMOVED", {
        userId: this.user.id,
        metadata: {
          ticketId: ticket.id,
          channelId: channel.id,
          removedUser: user.id,
        },
      });

      return {
        content: `✅ Successfully removed ${user} from the ticket.`,
        ephemeral: true,
      };
    } catch (error) {
      logger.error("Error removing user from ticket:", error);
      return {
        content: `❌ Failed to remove user from ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleList(): Promise<CommandResponse> {
    try {
      const tickets = await prisma.ticket.findMany({
        where: { guildId: this.guild.id },
        orderBy: { createdAt: "desc" },
        take: 25, // Discord embed field limit
      });

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🎫 Support Tickets")
        .setTimestamp()
        .setFooter({ text: `Server: ${this.guild.name}` });

      if (tickets.length === 0) {
        embed.setDescription("❌ No tickets found for this server.");
        return { embeds: [embed], ephemeral: true };
      }

      const openTickets = tickets.filter((t) => t.status === "OPEN");
      const closedTickets = tickets.filter((t) => t.status === "CLOSED");

      embed.setDescription(
        `**${openTickets.length}** open ticket${openTickets.length === 1 ? "" : "s"}, ` +
          `**${closedTickets.length}** closed ticket${closedTickets.length === 1 ? "" : "s"}`
      );

      // Show open tickets first
      if (openTickets.length > 0) {
        const openList = openTickets
          .slice(0, 10)
          .map((ticket) => {
            const channel = this.guild.channels.cache.get(ticket.channelId);
            return `**${ticket.id}** - ${channel ? `<#${ticket.channelId}>` : "Deleted Channel"} - <@${ticket.userId}>`;
          })
          .join("\n");

        embed.addFields({
          name: "🟢 Open Tickets",
          value: openList,
          inline: false,
        });
      }

      // Show recent closed tickets
      if (closedTickets.length > 0) {
        const closedList = closedTickets
          .slice(0, 10)
          .map((ticket) => {
            const closedDate = ticket.closedAt ? `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:R>` : "Unknown";
            return `**${ticket.id}** - <@${ticket.userId}> - Closed ${closedDate}`;
          })
          .join("\n");

        embed.addFields({
          name: "🔴 Recent Closed Tickets",
          value: closedList,
          inline: false,
        });
      }

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error listing tickets:", error);
      return {
        content: `❌ Failed to list tickets: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleTranscript(): Promise<CommandResponse> {
    const ticketId = this.getStringOption("ticket_id", true);

    try {
      const ticket = await prisma.ticket.findFirst({
        where: {
          guildId: this.guild.id,
          id: ticketId,
        },
      });

      if (!ticket) {
        return {
          content: `❌ Ticket with ID \`${ticketId}\` not found.`,
          ephemeral: true,
        };
      }

      const channel = this.guild.channels.cache.get(ticket.channelId) as TextChannel;
      if (!channel) {
        return {
          content: "❌ Ticket channel no longer exists.",
          ephemeral: true,
        };
      }

      // Fetch messages and create transcript
      const messages = await channel.messages.fetch({ limit: 100 });
      const transcript = Array.from(messages.values())
        .reverse()
        .map((msg) => `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📋 Ticket Transcript")
        .setDescription(`Transcript for ticket **${ticketId}**`)
        .addFields(
          { name: "Ticket ID", value: ticket.id, inline: true },
          { name: "Opened By", value: `<@${ticket.userId}>`, inline: true },
          { name: "Status", value: ticket.status, inline: true },
          { name: "Created", value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:F>`, inline: true }
        )
        .setTimestamp();

      if (ticket.closedAt) {
        embed.addFields(
          { name: "Closed", value: `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:F>`, inline: true },
          { name: "Closed By", value: ticket.closedBy ? `<@${ticket.closedBy}>` : "Unknown", inline: true }
        );
      }

      // Send transcript as file if it's too long
      if (transcript.length > 1000) {
        const buffer = Buffer.from(transcript, "utf8");
        return {
          embeds: [embed],
          files: [
            {
              attachment: buffer,
              name: `transcript-${ticketId}.txt`,
            },
          ],
          ephemeral: true,
        };
      } else {
        embed.addFields({
          name: "📝 Messages",
          value: transcript || "No messages found",
          inline: false,
        });

        return { embeds: [embed], ephemeral: true };
      }
    } catch (error) {
      logger.error("Error generating transcript:", error);
      return {
        content: `❌ Failed to generate transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new TicketCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("ADMIN ONLY: Manage support tickets")
  .addSubcommand((sub) =>
    sub
      .setName("close")
      .setDescription("Close the current ticket")
      .addStringOption((opt) => opt.setName("reason").setDescription("Reason for closing the ticket"))
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a user to the current ticket")
      .addUserOption((opt) => opt.setName("user").setDescription("User to add to the ticket").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a user from the current ticket")
      .addUserOption((opt) => opt.setName("user").setDescription("User to remove from the ticket").setRequired(true))
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List all tickets in this server"))
  .addSubcommand((sub) =>
    sub
      .setName("transcript")
      .setDescription("Get transcript of a ticket")
      .addStringOption((opt) =>
        opt.setName("ticket_id").setDescription("ID of the ticket to get transcript for").setRequired(true)
      )
  );
