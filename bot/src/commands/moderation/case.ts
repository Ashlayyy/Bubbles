import { SlashCommandBuilder, type User } from "discord.js";
import { prisma } from "../../database/index.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import {
  formatDuration,
  type CommandConfig,
  type CommandResponse,
  type SlashCommandInteraction,
} from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Case Command - Manage moderation cases
 */
export class CaseCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "case",
      description: "Manage moderation cases",
      category: "moderation",
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
        case "view":
          return await this.handleViewCase();
        case "history":
          return await this.handleUserHistory();
        case "note":
          return await this.handleAddNote();
        case "edit":
          return await this.handleEditCase();
        case "delete":
          return await this.handleDeleteCase();
        default:
          throw new Error("Unknown subcommand");
      }
    } catch (error) {
      return this.createModerationError(
        "case management",
        { username: "N/A", id: "unknown" } as User,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async handleViewCase(): Promise<CommandResponse> {
    const caseNumber = this.getIntegerOption("number", true);

    const case_ = await this.client.moderationManager.getCase(this.guild.id, caseNumber);

    if (!case_) {
      return this.createModerationError(
        "case lookup",
        { username: "N/A", id: "unknown" } as User,
        `Case #${caseNumber} not found.`
      );
    }

    const embed = this.client.genEmbed({
      title: `📋 Case #${case_.caseNumber}`,
      color: case_.type === "BAN" ? 0xe74c3c : case_.type === "WARN" ? 0xf1c40f : 0x3498db,
      fields: [
        { name: "👤 User", value: `<@${case_.userId}>`, inline: true },
        { name: "👮 Moderator", value: `<@${case_.moderatorId}>`, inline: true },
        { name: "⚖️ Action", value: case_.type, inline: true },
        { name: "📝 Reason", value: case_.reason ?? "No reason provided", inline: false },
        { name: "📊 Severity", value: case_.severity, inline: true },
        { name: "🔢 Points", value: String(case_.points), inline: true },
        {
          name: "📅 Created",
          value: `<t:${Math.floor(case_.createdAt.getTime() / 1000)}:F>`,
          inline: true,
        },
      ],
      footer: { text: `Case ID: ${case_.id}` },
    });

    if (case_.duration) {
      embed.addFields({ name: "⏱️ Duration", value: formatDuration(case_.duration), inline: true });
    }

    if (case_.evidence.length > 0) {
      embed.addFields({ name: "🔍 Evidence", value: case_.evidence.join("\n"), inline: false });
    }

    if (case_.publicNote) {
      embed.addFields({ name: "📄 Public Note", value: case_.publicNote, inline: false });
    }

    if (case_.staffNote) {
      embed.addFields({ name: "🔒 Staff Note", value: case_.staffNote, inline: false });
    }

    return { embeds: [embed], ephemeral: true };
  }

  private async handleUserHistory(): Promise<CommandResponse> {
    const targetUser = this.getUserOption("user", true);
    const limit = this.getIntegerOption("limit") ?? 10;

    const cases = await this.client.moderationManager.getUserHistory(this.guild.id, targetUser.id, limit);

    if (cases.length === 0) {
      return this.createModerationError(
        "history lookup",
        targetUser,
        `**${targetUser.username}** has no moderation history.`
      );
    }

    const points = await this.client.moderationManager.getInfractionPoints(this.guild.id, targetUser.id);

    const embed = this.client.genEmbed({
      title: `📋 Moderation History - ${targetUser.username}`,
      description: `**Total Points:** ${points}\n**Total Cases:** ${cases.length}`,
      fields: cases.map((case_) => ({
        name: `Case #${case_.caseNumber} - ${case_.type}`,
        value: `${case_.reason ?? "No reason"}\n<t:${Math.floor(case_.createdAt.getTime() / 1000)}:R>`,
        inline: true,
      })),
      footer: { text: `Showing last ${Math.min(limit, cases.length)} cases` },
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleAddNote(): Promise<CommandResponse> {
    const caseNumber = this.getIntegerOption("number", true);
    const note = this.getStringOption("note", true);

    const case_ = await this.client.moderationManager.getCase(this.guild.id, caseNumber);

    if (!case_) {
      return this.createModerationError(
        "case lookup",
        { username: "N/A", id: "unknown" } as User,
        `Case #${caseNumber} not found.`
      );
    }

    await this.client.moderationManager.addCaseNote(case_.id, this.user.id, note);

    return this.createModerationResponse(
      "note added",
      { username: "Case", id: "system" } as User,
      `Added note to case #${caseNumber}.`
    );
  }

  private async handleEditCase(): Promise<CommandResponse> {
    const caseNumber = this.getIntegerOption("number", true);
    const newReason = this.getStringOption("reason");
    const newPoints = this.getIntegerOption("points");
    const newSeverity = this.getStringOption("severity");

    if (!newReason && newPoints === null && !newSeverity) {
      return this.createModerationError(
        "edit case",
        { username: "N/A", id: "unknown" } as User,
        "You must provide at least one field to update (reason, points, severity)."
      );
    }

    const case_ = await this.client.moderationManager.getCase(this.guild.id, caseNumber);
    if (!case_) {
      return this.createModerationError(
        "edit case",
        { username: "N/A", id: "unknown" } as User,
        `Case #${caseNumber} not found.`
      );
    }

    await prisma.moderationCase.update({
      where: { id: case_.id },
      data: {
        reason: newReason ?? undefined,
        points: newPoints ?? undefined,
        severity: newSeverity ?? undefined,
      },
    });

    return this.createModerationResponse(
      "case updated",
      { username: "Case", id: "system" } as User,
      `Updated case #${caseNumber}.`
    );
  }

  private async handleDeleteCase(): Promise<CommandResponse> {
    const caseNumber = this.getIntegerOption("number", true);

    const case_ = await this.client.moderationManager.getCase(this.guild.id, caseNumber);
    if (!case_) {
      return this.createModerationError(
        "delete case",
        { username: "N/A", id: "unknown" } as User,
        `Case #${caseNumber} not found.`
      );
    }

    await prisma.moderationCase.update({
      where: { id: case_.id },
      data: {
        isActive: false,
        staffNote: (case_.staffNote ?? "") + `\n[Soft-deleted by ${this.user.id} at ${new Date().toISOString()}]`,
      },
    });

    return this.createModerationResponse(
      "case archived",
      { username: "Case", id: "system" } as User,
      `Archival complete for case #${caseNumber}.`
    );
  }
}

// Export the command instance
export default new CaseCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("case")
  .setDescription("Manage moderation cases")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View a specific case")
      .addIntegerOption((opt) => opt.setName("number").setDescription("Case number to view").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("history")
      .setDescription("View a user's moderation history")
      .addUserOption((opt) => opt.setName("user").setDescription("User to view history for").setRequired(true))
      .addIntegerOption((opt) =>
        opt.setName("limit").setDescription("Number of cases to show (default: 10)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("note")
      .setDescription("Add a note to a case")
      .addIntegerOption((opt) => opt.setName("number").setDescription("Case number").setRequired(true))
      .addStringOption((opt) => opt.setName("note").setDescription("Note to add").setRequired(true))
      .addBooleanOption((opt) =>
        opt.setName("internal").setDescription("Make this note internal (staff-only)").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit a moderation case")
      .addIntegerOption((opt) => opt.setName("number").setDescription("Case number").setRequired(true))
      .addStringOption((opt) => opt.setName("reason").setDescription("New reason").setRequired(false))
      .addIntegerOption((opt) => opt.setName("points").setDescription("New point value").setRequired(false))
      .addStringOption((opt) =>
        opt
          .setName("severity")
          .setDescription("New severity")
          .addChoices(
            { name: "LOW", value: "LOW" },
            { name: "MEDIUM", value: "MEDIUM" },
            { name: "HIGH", value: "HIGH" },
            { name: "CRITICAL", value: "CRITICAL" }
          )
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a moderation case")
      .addIntegerOption((opt) => opt.setName("number").setDescription("Case number").setRequired(true))
  );
