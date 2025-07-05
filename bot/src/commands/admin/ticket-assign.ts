import type { Prisma } from "@prisma/client";
import { SlashCommandBuilder } from "discord.js";
import { prisma } from "../../database/index.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { type CommandConfig, type CommandResponse, type SlashCommandInteraction } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * Ticket Assignment Command - Advanced ticket assignment and management
 */
export class TicketAssignCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "ticket-assign",
      description: "Advanced ticket assignment and management",
      category: "admin",
      permissions: {
        level: PermissionLevel.MODERATOR,
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
        case "assign":
          return await this.handleAssign();
        case "unassign":
          return await this.handleUnassign();
        case "reassign":
          return await this.handleReassign();
        case "auto-assign":
          return await this.handleAutoAssign();
        case "list-assigned":
          return await this.handleListAssigned();
        default:
          throw new Error("Unknown subcommand");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.createAdminError("Ticket Assignment Error", errorMessage);
    }
  }

  private async handleAssign(): Promise<CommandResponse> {
    const ticketNumber = this.getIntegerOption("ticket", true);
    const assigneeId = this.getStringOption("assignee", true);
    const reason = this.getStringOption("reason");

    // Validate ticket exists
    const ticket = await prisma.ticket.findFirst({
      where: {
        guildId: this.guild.id,
        ticketNumber,
        status: { in: ["OPEN", "PENDING"] },
      },
    });

    if (!ticket) {
      return this.createAdminError(
        "Ticket Not Found",
        `Ticket #${ticketNumber.toString().padStart(4, "0")} not found or already closed.`
      );
    }

    // Validate assignee is a member
    const assignee = await this.guild.members.fetch(assigneeId).catch(() => null);
    if (!assignee) {
      return this.createAdminError("Invalid Assignee", "Assignee is not a member of this server.");
    }

    // Check if assignee has appropriate permissions
    if (!assignee.permissions.has("ManageChannels")) {
      return this.createAdminError("Insufficient Permissions", "Assignee must have Manage Channels permission.");
    }

    // Update ticket
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedTo: assigneeId,
        status: "PENDING",
      },
    });

    const embed = this.client.genEmbed({
      title: "✅ Ticket Assigned",
      description: `Ticket #${ticketNumber.toString().padStart(4, "0")} has been assigned.`,
      color: 0x2ecc71,
      fields: [
        { name: "🎫 Ticket", value: `<#${ticket.channelId}>`, inline: true },
        { name: "👤 Assigned to", value: `<@${assigneeId}>`, inline: true },
        { name: "👮 Assigned by", value: `<@${this.user.id}>`, inline: true },
        { name: "📝 Reason", value: reason ?? "No reason provided", inline: false },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleUnassign(): Promise<CommandResponse> {
    const ticketNumber = this.getIntegerOption("ticket", true);
    const reason = this.getStringOption("reason");

    const ticket = await prisma.ticket.findFirst({
      where: {
        guildId: this.guild.id,
        ticketNumber,
        status: { in: ["OPEN", "PENDING"] },
      },
    });

    if (!ticket) {
      return this.createAdminError(
        "Ticket Not Found",
        `Ticket #${ticketNumber.toString().padStart(4, "0")} not found or already closed.`
      );
    }

    if (!ticket.assignedTo) {
      return this.createAdminError("Ticket Not Assigned", "This ticket is not currently assigned.");
    }

    const previousAssignee = ticket.assignedTo;

    // Update ticket
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedTo: null,
        status: "OPEN",
      },
    });

    const embed = this.client.genEmbed({
      title: "🔄 Ticket Unassigned",
      description: `Ticket #${ticketNumber.toString().padStart(4, "0")} has been unassigned.`,
      color: 0xf39c12,
      fields: [
        { name: "🎫 Ticket", value: `<#${ticket.channelId}>`, inline: true },
        { name: "👤 Previous Assignee", value: `<@${previousAssignee}>`, inline: true },
        { name: "👮 Unassigned by", value: `<@${this.user.id}>`, inline: true },
        { name: "📝 Reason", value: reason ?? "No reason provided", inline: false },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleReassign(): Promise<CommandResponse> {
    const ticketNumber = this.getIntegerOption("ticket", true);
    const newAssigneeId = this.getStringOption("assignee", true);
    const reason = this.getStringOption("reason");

    const ticket = await prisma.ticket.findFirst({
      where: {
        guildId: this.guild.id,
        ticketNumber,
        status: { in: ["OPEN", "PENDING"] },
      },
    });

    if (!ticket) {
      return this.createAdminError(
        "Ticket Not Found",
        `Ticket #${ticketNumber.toString().padStart(4, "0")} not found or already closed.`
      );
    }

    // Validate new assignee
    const newAssignee = await this.guild.members.fetch(newAssigneeId).catch(() => null);
    if (!newAssignee) {
      return this.createAdminError("Invalid Assignee", "New assignee is not a member of this server.");
    }

    if (!newAssignee.permissions.has("ManageChannels")) {
      return this.createAdminError("Insufficient Permissions", "New assignee must have Manage Channels permission.");
    }

    const previousAssignee = ticket.assignedTo;

    // Update ticket
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedTo: newAssigneeId,
      },
    });

    const embed = this.client.genEmbed({
      title: "🔄 Ticket Reassigned",
      description: `Ticket #${ticketNumber.toString().padStart(4, "0")} has been reassigned.`,
      color: 0x3498db,
      fields: [
        { name: "🎫 Ticket", value: `<#${ticket.channelId}>`, inline: true },
        { name: "👤 Previous Assignee", value: previousAssignee ? `<@${previousAssignee}>` : "None", inline: true },
        { name: "👤 New Assignee", value: `<@${newAssigneeId}>`, inline: true },
        { name: "👮 Reassigned by", value: `<@${this.user.id}>`, inline: true },
        { name: "📝 Reason", value: reason ?? "No reason provided", inline: false },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleAutoAssign(): Promise<CommandResponse> {
    const category = this.getStringOption("category");

    // Find available staff members
    const staffMembers = this.guild.members.cache.filter(
      (member) => member.permissions.has("ManageChannels") && !member.user.bot
    );

    if (staffMembers.size === 0) {
      return this.createAdminError("No Staff Available", "No staff members found with appropriate permissions.");
    }

    // Find unassigned tickets
    const whereClause: Prisma.TicketWhereInput = {
      guildId: this.guild.id,
      status: { in: ["OPEN", "PENDING"] },
      assignedTo: null,
    };

    if (category) {
      whereClause.category = category.toUpperCase();
    }

    const unassignedTickets = await prisma.ticket.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
    });

    if (unassignedTickets.length === 0) {
      return this.createAdminError("No Unassigned Tickets", "No unassigned tickets found matching the criteria.");
    }

    const staffArray = Array.from(staffMembers.values());
    const assignments: { ticketId: string; assigneeId: string; ticketNumber: number }[] = [];

    // Distribute tickets among staff members
    for (let i = 0; i < unassignedTickets.length; i++) {
      const ticket = unassignedTickets[i];
      const assignee = staffArray[i % staffArray.length];

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedTo: assignee.id,
          status: "PENDING",
        },
      });

      assignments.push({
        ticketId: ticket.id,
        assigneeId: assignee.id,
        ticketNumber: ticket.ticketNumber,
      });
    }

    const embed = this.client.genEmbed({
      title: "🤖 Auto Assignment Complete",
      description: `Successfully assigned **${assignments.length}** tickets to staff members.`,
      color: 0x2ecc71,
      fields: [
        { name: "👥 Staff Members", value: staffArray.map((m) => m.user.username).join(", "), inline: false },
        {
          name: "📊 Assignments",
          value: assignments
            .map((a) => `#${a.ticketNumber.toString().padStart(4, "0")} → <@${a.assigneeId}>`)
            .join("\n"),
          inline: false,
        },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleListAssigned(): Promise<CommandResponse> {
    const assigneeId = this.getStringOption("assignee");
    const status = this.getStringOption("status");

    const whereClause: Prisma.TicketWhereInput = {
      guildId: this.guild.id,
    };

    if (assigneeId) {
      whereClause.assignedTo = assigneeId;
    } else {
      whereClause.assignedTo = { not: null };
    }

    if (status) {
      whereClause.status = status;
    }

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (tickets.length === 0) {
      return this.createAdminError("No Assigned Tickets", "No assigned tickets found matching the criteria.");
    }

    const embed = this.client.genEmbed({
      title: "📋 Assigned Tickets",
      description: `Found **${tickets.length}** assigned tickets:`,
      color: 0x3498db,
      fields: tickets.map((ticket) => ({
        name: `#${ticket.ticketNumber.toString().padStart(4, "0")} - ${ticket.title}`,
        value: `**Assignee:** <@${ticket.assignedTo}>\n**Status:** ${ticket.status}\n**Category:** ${ticket.category}\n**Created:** <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`,
        inline: true,
      })),
    });

    return { embeds: [embed], ephemeral: true };
  }
}

// Export the command instance
export default new TicketAssignCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("ticket-assign")
  .setDescription("Advanced ticket assignment and management")
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("assign")
      .setDescription("Assign a ticket to a staff member")
      .addIntegerOption((option) => option.setName("ticket").setDescription("Ticket number").setRequired(true))
      .addStringOption((option) =>
        option.setName("assignee").setDescription("User ID to assign the ticket to").setRequired(true)
      )
      .addStringOption((option) => option.setName("reason").setDescription("Reason for assignment"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("unassign")
      .setDescription("Unassign a ticket")
      .addIntegerOption((option) => option.setName("ticket").setDescription("Ticket number").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("Reason for unassignment"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("reassign")
      .setDescription("Reassign a ticket to a different staff member")
      .addIntegerOption((option) => option.setName("ticket").setDescription("Ticket number").setRequired(true))
      .addStringOption((option) => option.setName("assignee").setDescription("New assignee user ID").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("Reason for reassignment"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("auto-assign")
      .setDescription("Automatically assign unassigned tickets to available staff")
      .addStringOption((option) => option.setName("category").setDescription("Filter by ticket category"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list-assigned")
      .setDescription("List assigned tickets")
      .addStringOption((option) => option.setName("assignee").setDescription("Filter by assignee user ID"))
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
  );
