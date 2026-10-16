import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type CategoryChannel,
  type TextChannel,
} from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse, SlashCommandInteraction } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

// Helper function to sanitize username for channel/thread names
function sanitizeUsername(username: string): string {
  return username
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .toLowerCase()
    .substring(0, 20);
}

/**
 * Ticket Command - Manage support tickets
 */
export class TicketCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "ticket",
      description: "Manage support tickets",
      category: "admin",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [PermissionFlagsBits.ManageChannels],
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
        case "create":
          return await this.handleCreate();
        case "close":
          return await this.handleClose();
        case "claim":
          return await this.handleClaim();
        case "add":
          return await this.handleAdd();
        case "remove":
          return await this.handleRemove();
        case "list":
          return await this.handleList();
        case "transcript":
          return await this.handleTranscript();
        case "info":
          return await this.handleInfo();
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

  private async handleCreate(): Promise<CommandResponse> {
    const category = this.getStringOption("category", true);
    const title = this.getStringOption("title", true);
    const description = this.getStringOption("description");

    try {
      // Check if user already has an open ticket
      const existingTicket = await prisma.ticket.findFirst({
        where: {
          guildId: this.guild.id,
          userId: this.user.id,
          status: { in: ["OPEN", "PENDING"] },
        },
      });

      if (existingTicket) {
        return {
          content: `❌ You already have an open ticket: #${existingTicket.ticketNumber}\n<#${existingTicket.channelId}>`,
          ephemeral: true,
        };
      }

      // Get next ticket number
      const lastTicket = await prisma.ticket.findFirst({
        where: { guildId: this.guild.id },
        orderBy: { ticketNumber: "desc" },
      });
      const ticketNumber = (lastTicket?.ticketNumber ?? 0) + 1;

      // Find or create tickets category
      let ticketsCategory = this.guild.channels.cache.find(
        (channel) => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase().includes("ticket")
      ) as CategoryChannel | undefined;

      ticketsCategory ??= await this.guild.channels.create({
        name: "🎫│Support Tickets",
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: this.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });

      // Create ticket channel with enhanced naming
      const sanitizedUsername = sanitizeUsername(this.user.username);
      const ticketChannel = await this.guild.channels.create({
        name: `ticket-${ticketNumber.toString().padStart(4, "0")}-${sanitizedUsername}`,
        type: ChannelType.GuildText,
        parent: ticketsCategory.id,
        topic: `${category.toUpperCase()} | ${title} | Created by ${this.user.tag}`,
        permissionOverwrites: [
          {
            id: this.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: this.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          ...(this.client.user
            ? [
                {
                  id: this.client.user.id,
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
          guildId: this.guild.id,
          userId: this.user.id,
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
        .setDescription(description || "No description provided")
        .addFields(
          { name: "👤 Created by", value: `<@${this.user.id}>`, inline: true },
          { name: "📋 Category", value: category.toUpperCase(), inline: true },
          { name: "📅 Created", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setTimestamp();

      const closeButton = new ButtonBuilder()
        .setCustomId(`ticket_close_${ticket.id}`)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒");

      const claimButton = new ButtonBuilder()
        .setCustomId(`ticket_claim_${ticket.id}`)
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("👋");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton, claimButton);

      await ticketChannel.send({
        embeds: [ticketEmbed],
        components: [row],
      });

      // Log ticket creation
      await this.client.logManager.log(this.guild.id, "TICKET_CREATE", {
        userId: this.user.id,
        metadata: {
          ticketId: ticket.id,
          channelId: ticketChannel.id,
          category,
          title,
        },
      });

      return {
        content: `✅ Ticket created successfully: <#${ticketChannel.id}>`,
        ephemeral: true,
      };
    } catch (error) {
      logger.error("Error creating ticket:", error);
      return {
        content: `❌ Failed to create ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleClaim(): Promise<CommandResponse> {
    const channel = this.interaction.channel as TextChannel;

    try {
      // Check if this is a ticket channel
      const ticket = await prisma.ticket.findFirst({
        where: {
          guildId: this.guild.id,
          channelId: channel.id,
          status: { in: ["OPEN", "PENDING"] },
        },
      });

      if (!ticket) {
        return {
          content: "❌ This is not an active ticket channel.",
          ephemeral: true,
        };
      }

      // Check if already claimed
      if (ticket.assignedTo) {
        const assignee = await this.guild.members.fetch(ticket.assignedTo).catch(() => null);
        if (assignee) {
          return {
            content: `❌ This ticket is already claimed by ${assignee}.`,
            ephemeral: true,
          };
        }
      }

      // Claim the ticket
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedTo: this.user.id,
          status: "PENDING",
        },
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Ticket Claimed")
        .setDescription(`${this.user} has claimed this ticket and will assist you.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // Log ticket claim
      await this.client.logManager.log(this.guild.id, "TICKET_CLAIM", {
        userId: this.user.id,
        metadata: {
          ticketId: ticket.id,
          channelId: channel.id,
        },
      });

      return {
        content: "✅ Successfully claimed the ticket.",
        ephemeral: true,
      };
    } catch (error) {
      logger.error("Error claiming ticket:", error);
      return {
        content: `❌ Failed to claim ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleInfo(): Promise<CommandResponse> {
    const channel = this.interaction.channel as TextChannel;

    try {
      // Check if this is a ticket channel
      const ticket = await prisma.ticket.findFirst({
        where: {
          guildId: this.guild.id,
          channelId: channel.id,
        },
      });

      if (!ticket) {
        return {
          content: "❌ This is not a ticket channel.",
          ephemeral: true,
        };
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🎫 Ticket #${ticket.ticketNumber.toString().padStart(4, "0")}`)
        .setDescription(ticket.description || "No description provided")
        .addFields(
          { name: "👤 Created by", value: `<@${ticket.userId}>`, inline: true },
          { name: "📋 Category", value: ticket.category, inline: true },
          {
            name: "📅 Created",
            value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:F>`,
            inline: true,
          },
          { name: "📊 Status", value: ticket.status, inline: true }
        )
        .setTimestamp();

      if (ticket.assignedTo) {
        embed.addFields({ name: "👮 Assigned to", value: `<@${ticket.assignedTo}>`, inline: true });
      }

      if (ticket.closedAt) {
        embed.addFields(
          { name: "🔒 Closed", value: `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:F>`, inline: true },
          { name: "👮 Closed by", value: ticket.closedBy ? `<@${ticket.closedBy}>` : "Unknown", inline: true }
        );
      }

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error getting ticket info:", error);
      return {
        content: `❌ Failed to get ticket info: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleClose(): Promise<CommandResponse> {
    const channel = this.interaction.channel as TextChannel;
    const ticketId = this.getStringOption("ticket_id");
    const reason = this.getStringOption("reason");

    try {
      // Find ticket by ID if provided, otherwise by channel
      let ticket;

      if (ticketId) {
        ticket = await prisma.ticket.findFirst({
          where: {
            id: ticketId,
            guildId: this.guild.id,
            status: { in: ["OPEN", "PENDING"] },
          },
        });
      } else {
        // Check if this is a ticket channel
        ticket = await prisma.ticket.findFirst({
          where: {
            guildId: this.guild.id,
            channelId: channel.id,
            status: { in: ["OPEN", "PENDING"] },
          },
        });
      }

      if (!ticket) {
        return {
          content: ticketId
            ? `❌ Could not find an active ticket with ID \`${ticketId}\`.`
            : "❌ This is not an active ticket channel.",
          ephemeral: true,
        };
      }

      // Check permissions (ticket owner or staff)
      const isTicketOwner = ticket.userId === this.user.id;
      const isStaff = this.member.permissions.has(PermissionFlagsBits.ManageMessages);

      if (!isTicketOwner && !isStaff) {
        return {
          content: "❌ Only the ticket creator or staff can close tickets.",
          ephemeral: true,
        };
      }

      // Close ticket
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "CLOSED",
          closedBy: this.user.id,
          closedAt: new Date(),
          closedReason: reason,
        },
      });

      // Remove all users except administrators from the ticket channel
      const ticketChannel = this.guild.channels.cache.get(ticket.channelId) as TextChannel;
      if (ticketChannel) {
        try {
          // Get all permission overwrites
          const overwrites = ticketChannel.permissionOverwrites.cache;

          for (const [id, overwrite] of overwrites) {
            // Skip if it's the bot or a role with administrator permissions
            if (id === this.client.user?.id) continue;

            const member = this.guild.members.cache.get(id);
            const role = this.guild.roles.cache.get(id);

            // Keep administrators
            if (member && member.permissions.has(PermissionFlagsBits.Administrator)) continue;
            if (role && role.permissions.has(PermissionFlagsBits.Administrator)) continue;

            // Remove the overwrite
            await ticketChannel.permissionOverwrites.delete(id);
          }
        } catch (error) {
          logger.error("Error removing users from ticket channel:", error);
        }
      }

      const closeEmbed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle("🔒 Ticket Closed")
        .setDescription(`This ticket has been closed by ${this.user}.`)
        .addFields(
          { name: "📊 Final Status", value: "Closed", inline: true },
          { name: "🕐 Closed At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setTimestamp();

      if (reason) {
        closeEmbed.addFields({ name: "📝 Reason", value: reason, inline: false });
      }

      await channel.send({ embeds: [closeEmbed] });

      // Archive the channel after a delay
      setTimeout(() => {
        void (async () => {
          try {
            if (ticketChannel) {
              // Try to archive as thread first, if it's a thread
              if (ticketChannel.isThread()) {
                await (ticketChannel as any).setArchived(true, "Ticket closed");
              } else {
                // For regular channels, we could move to a closed category or just leave as is
                // For now, we'll just log that it's closed
                logger.info(`Ticket channel ${ticketChannel.id} closed and ready for manual cleanup`);
              }
            }
          } catch (error) {
            logger.error("Error archiving ticket channel:", error);
          }
        })();
      }, 10000); // 10 second delay

      // Log ticket closure
      await this.client.logManager.log(this.guild.id, "TICKET_CLOSE", {
        userId: this.user.id,
        metadata: {
          ticketId: ticket.id,
          channelId: channel.id,
          closedBy: this.user.id,
          isStaff,
          reason: reason ?? "No reason provided",
        },
      });

      return {
        content: "✅ Ticket closed successfully. Channel will be archived in 10 seconds.",
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
          status: { in: ["OPEN", "PENDING"] },
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
          status: { in: ["OPEN", "PENDING"] },
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
        take: 25,
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
            return `**#${ticket.ticketNumber.toString().padStart(4, "0")}** - ${channel ? `<#${ticket.channelId}>` : "Deleted Channel"} - <@${ticket.userId}>`;
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
            return `**#${ticket.ticketNumber.toString().padStart(4, "0")}** - <@${ticket.userId}> - Closed ${closedDate}`;
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
    const ticketId = this.getStringOption("ticket_id");
    const channel = this.interaction.channel as TextChannel;

    try {
      // Find ticket by ID if provided, otherwise by channel
      let ticket;

      if (ticketId) {
        ticket = await prisma.ticket.findFirst({
          where: {
            id: ticketId,
            guildId: this.guild.id,
          },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
        });
      } else {
        // Check if this is a ticket channel
        ticket = await prisma.ticket.findFirst({
          where: {
            guildId: this.guild.id,
            channelId: channel.id,
          },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
        });
      }

      if (!ticket) {
        return {
          content: ticketId ? `❌ Could not find ticket with ID \`${ticketId}\`.` : "❌ This is not a ticket channel.",
          ephemeral: true,
        };
      }

      // Create transcript from stored messages
      const transcript = ticket.messages
        .map((msg) => {
          const timestamp = new Date(msg.createdAt).toISOString();
          const author = msg.isSystemMsg ? "System" : `<@${msg.userId}>`;
          return `[${timestamp}] ${author}: ${msg.content || "No content"}`;
        })
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📋 Ticket Transcript")
        .setDescription(`Transcript for ticket **#${ticket.ticketNumber.toString().padStart(4, "0")}**`)
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
              name: `transcript-${ticket.ticketNumber.toString().padStart(4, "0")}.txt`,
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
  .setDescription("Manage support tickets")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new support ticket")
      .addStringOption((opt) => opt.setName("category").setDescription("Category of the ticket").setRequired(true))
      .addStringOption((opt) => opt.setName("title").setDescription("Title of the ticket").setRequired(true))
      .addStringOption((opt) => opt.setName("description").setDescription("Description of the ticket (optional)"))
  )
  .addSubcommand((sub) =>
    sub
      .setName("close")
      .setDescription("Close the current ticket")
      .addStringOption((opt) =>
        opt
          .setName("ticket_id")
          .setDescription("ID of the ticket to close (leave empty to close current channel ticket)")
      )
      .addStringOption((opt) => opt.setName("reason").setDescription("Reason for closing the ticket"))
  )
  .addSubcommand((sub) => sub.setName("claim").setDescription("Claim the current ticket"))
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
        opt
          .setName("ticket_id")
          .setDescription("ID of the ticket to get transcript for (leave empty for current channel ticket)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) => sub.setName("info").setDescription("Get information about the current ticket"));
