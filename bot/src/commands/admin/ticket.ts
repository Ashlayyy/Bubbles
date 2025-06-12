import {
  ActionRowBuilder,
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

import { getGuildConfig } from "../../database/GuildConfig.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

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

    if (!ticketsCategory) {
      ticketsCategory = await interaction.guild.channels.create({
        name: "🎫│Support Tickets",
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });
    }

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

    let ticket;

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

async function getTicketInfo(_client: Client, _interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Implement ticket info functionality
}

async function addUserToTicket(_client: Client, _interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Implement add user to ticket functionality
}

async function removeUserFromTicket(_client: Client, _interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Implement remove user from ticket functionality
}

export default new Command(
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ticket system management")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new support ticket")
        .addStringOption((option) =>
          option
            .setName("category")
            .setDescription("Ticket category")
            .setRequired(true)
            .addChoices(
              { name: "General Support", value: "general" },
              { name: "Technical Issue", value: "technical" },
              { name: "Report User", value: "report" },
              { name: "Suggestion", value: "suggestion" }
            )
        )
        .addStringOption((option) =>
          option.setName("title").setDescription("Brief description of your issue").setRequired(true).setMaxLength(100)
        )
        .addStringOption((option) =>
          option.setName("description").setDescription("Detailed description of your issue").setMaxLength(1000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("close")
        .setDescription("Close a ticket")
        .addStringOption((option) => option.setName("reason").setDescription("Reason for closing").setMaxLength(500))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("claim")
        .setDescription("Claim/assign a ticket to yourself")
        .addIntegerOption((option) =>
          option.setName("ticket").setDescription("Ticket number to claim (auto-detect if not specified)")
        )
        .addBooleanOption((option) => option.setName("silent").setDescription("Claim silently without notification"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("assign")
        .setDescription("Assign a ticket to a staff member")
        .addIntegerOption((option) => option.setName("ticket").setDescription("Ticket number").setRequired(true))
        .addUserOption((option) => option.setName("staff").setDescription("Staff member to assign").setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List tickets")
        .addStringOption((option) =>
          option
            .setName("status")
            .setDescription("Filter by status")
            .addChoices(
              { name: "Open", value: "OPEN" },
              { name: "Pending", value: "PENDING" },
              { name: "Closed", value: "CLOSED" }
            )
        )
        .addUserOption((option) => option.setName("user").setDescription("Filter by user"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Get ticket information")
        .addIntegerOption((option) => option.setName("ticket").setDescription("Ticket number").setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add user to ticket")
        .addUserOption((option) => option.setName("user").setDescription("User to add").setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove user from ticket")
        .addUserOption((option) => option.setName("user").setDescription("User to remove").setRequired(true))
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "create":
        await createTicket(client, interaction);
        break;
      case "close":
        await closeTicket(client, interaction);
        break;
      case "claim":
        await claimTicket(client, interaction);
        break;
      case "assign":
        await assignTicket(client, interaction);
        break;
      case "list":
        await listTickets(client, interaction);
        break;
      case "info":
        await getTicketInfo(client, interaction);
        break;
      case "add":
        await addUserToTicket(client, interaction);
        break;
      case "remove":
        await removeUserFromTicket(client, interaction);
        break;
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
