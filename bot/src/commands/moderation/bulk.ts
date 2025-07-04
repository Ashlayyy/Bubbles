import { SlashCommandBuilder, type User } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { type CommandConfig, type CommandResponse, type SlashCommandInteraction } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Bulk Moderation Command - Perform mass moderation actions
 */
export class BulkCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "bulk",
      description: "Perform bulk moderation actions on multiple users",
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
        case "ban":
          return await this.handleBulkBan();
        case "kick":
          return await this.handleBulkKick();
        case "timeout":
          return await this.handleBulkTimeout();
        case "warn":
          return await this.handleBulkWarn();
        case "unban":
          return await this.handleBulkUnban();
        default:
          throw new Error("Unknown subcommand");
      }
    } catch (error) {
      return this.createModerationError(
        "bulk moderation",
        { username: "N/A", id: "unknown" } as User,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async handleBulkBan(): Promise<CommandResponse> {
    const userIds = this.getStringOption("users", true);
    const reason = this.getStringOption("reason", true);
    const deleteDays = this.getIntegerOption("delete-days") ?? 1;
    const silent = this.getBooleanOption("silent") ?? false;

    const userIdList = userIds.split(/[,\s]+/).filter((id) => id.trim().length > 0);

    if (userIdList.length === 0) {
      return this.createModerationError(
        "bulk ban",
        { username: "N/A", id: "unknown" } as User,
        "No valid user IDs provided."
      );
    }

    if (userIdList.length > 10) {
      return this.createModerationError(
        "bulk ban",
        { username: "N/A", id: "unknown" } as User,
        "Maximum 10 users can be banned at once for safety."
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as { userId: string; reason: string }[],
    };

    for (const userId of userIdList) {
      try {
        const user = await this.client.users.fetch(userId);
        const member = await this.guild.members.fetch(userId).catch(() => null);

        if (member) {
          this.validateModerationTarget(member);
        }

        const case_ = await this.client.moderationManager.ban(
          this.guild,
          userId,
          this.user.id,
          reason,
          undefined, // Permanent ban
          undefined,
          !silent,
          {
            interactionId: this.interaction.id,
            commandName: this.interaction.commandName,
            interactionLatency: Date.now() - this.interaction.createdTimestamp,
          }
        );

        results.successful.push(`${user.username} (Case #${case_.caseNumber})`);
      } catch (error) {
        results.failed.push({
          userId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const embed = this.client.genEmbed({
      title: "🔨 Bulk Ban Results",
      color: results.failed.length === 0 ? 0x2ecc71 : 0xf39c12,
      fields: [
        {
          name: "✅ Successful Bans",
          value: results.successful.length > 0 ? results.successful.join("\n") : "None",
          inline: false,
        },
        {
          name: "❌ Failed Bans",
          value:
            results.failed.length > 0 ? results.failed.map((f) => `<@${f.userId}>: ${f.reason}`).join("\n") : "None",
          inline: false,
        },
      ],
      footer: { text: `Processed ${userIdList.length} users` },
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleBulkKick(): Promise<CommandResponse> {
    const userIds = this.getStringOption("users", true);
    const reason = this.getStringOption("reason", true);
    const silent = this.getBooleanOption("silent") ?? false;

    const userIdList = userIds.split(/[,\s]+/).filter((id) => id.trim().length > 0);

    if (userIdList.length === 0) {
      return this.createModerationError(
        "bulk kick",
        { username: "N/A", id: "unknown" } as User,
        "No valid user IDs provided."
      );
    }

    if (userIdList.length > 10) {
      return this.createModerationError(
        "bulk kick",
        { username: "N/A", id: "unknown" } as User,
        "Maximum 10 users can be kicked at once for safety."
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as { userId: string; reason: string }[],
    };

    for (const userId of userIdList) {
      try {
        const user = await this.client.users.fetch(userId);
        const member = await this.guild.members.fetch(userId);

        this.validateModerationTarget(member);

        const case_ = await this.client.moderationManager.kick(
          this.guild,
          userId,
          this.user.id,
          reason,
          undefined,
          !silent,
          {
            interactionId: this.interaction.id,
            commandName: this.interaction.commandName,
            interactionLatency: Date.now() - this.interaction.createdTimestamp,
          }
        );

        results.successful.push(`${user.username} (Case #${case_.caseNumber})`);
      } catch (error) {
        results.failed.push({
          userId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const embed = this.client.genEmbed({
      title: "👢 Bulk Kick Results",
      color: results.failed.length === 0 ? 0x2ecc71 : 0xf39c12,
      fields: [
        {
          name: "✅ Successful Kicks",
          value: results.successful.length > 0 ? results.successful.join("\n") : "None",
          inline: false,
        },
        {
          name: "❌ Failed Kicks",
          value:
            results.failed.length > 0 ? results.failed.map((f) => `<@${f.userId}>: ${f.reason}`).join("\n") : "None",
          inline: false,
        },
      ],
      footer: { text: `Processed ${userIdList.length} users` },
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleBulkTimeout(): Promise<CommandResponse> {
    const userIds = this.getStringOption("users", true);
    const reason = this.getStringOption("reason", true);
    const duration = this.getStringOption("duration", true);
    const silent = this.getBooleanOption("silent") ?? false;

    const userIdList = userIds.split(/[,\s]+/).filter((id) => id.trim().length > 0);

    if (userIdList.length === 0) {
      return this.createModerationError(
        "bulk timeout",
        { username: "N/A", id: "unknown" } as User,
        "No valid user IDs provided."
      );
    }

    if (userIdList.length > 10) {
      return this.createModerationError(
        "bulk timeout",
        { username: "N/A", id: "unknown" } as User,
        "Maximum 10 users can be timed out at once for safety."
      );
    }

    const parsedDuration = this.parseDuration(duration);
    if (!parsedDuration) {
      return this.createModerationError(
        "bulk timeout",
        { username: "N/A", id: "unknown" } as User,
        "Invalid duration format. Use: 30s, 5m, 2h, 1d, etc."
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as { userId: string; reason: string }[],
    };

    for (const userId of userIdList) {
      try {
        const user = await this.client.users.fetch(userId);
        const member = await this.guild.members.fetch(userId);

        this.validateModerationTarget(member);

        const case_ = await this.client.moderationManager.timeout(
          this.guild,
          userId,
          this.user.id,
          parsedDuration,
          reason,
          undefined,
          !silent,
          {
            interactionId: this.interaction.id,
            commandName: this.interaction.commandName,
            interactionLatency: Date.now() - this.interaction.createdTimestamp,
          }
        );

        results.successful.push(`${user.username} (Case #${case_.caseNumber})`);
      } catch (error) {
        results.failed.push({
          userId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const embed = this.client.genEmbed({
      title: "⏰ Bulk Timeout Results",
      color: results.failed.length === 0 ? 0x2ecc71 : 0xf39c12,
      fields: [
        {
          name: "✅ Successful Timeouts",
          value: results.successful.length > 0 ? results.successful.join("\n") : "None",
          inline: false,
        },
        {
          name: "❌ Failed Timeouts",
          value:
            results.failed.length > 0 ? results.failed.map((f) => `<@${f.userId}>: ${f.reason}`).join("\n") : "None",
          inline: false,
        },
      ],
      footer: { text: `Processed ${userIdList.length} users | Duration: ${duration}` },
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleBulkWarn(): Promise<CommandResponse> {
    const userIds = this.getStringOption("users", true);
    const reason = this.getStringOption("reason", true);
    const silent = this.getBooleanOption("silent") ?? false;

    const userIdList = userIds.split(/[,\s]+/).filter((id) => id.trim().length > 0);

    if (userIdList.length === 0) {
      return this.createModerationError(
        "bulk warn",
        { username: "N/A", id: "unknown" } as User,
        "No valid user IDs provided."
      );
    }

    if (userIdList.length > 10) {
      return this.createModerationError(
        "bulk warn",
        { username: "N/A", id: "unknown" } as User,
        "Maximum 10 users can be warned at once for safety."
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as { userId: string; reason: string }[],
    };

    for (const userId of userIdList) {
      try {
        const user = await this.client.users.fetch(userId);
        const member = await this.guild.members.fetch(userId).catch(() => null);

        if (member) {
          this.validateModerationTarget(member);
        }

        const case_ = await this.client.moderationManager.warn(
          this.guild,
          userId,
          this.user.id,
          reason,
          undefined,
          1,
          !silent,
          {
            interactionId: this.interaction.id,
            commandName: this.interaction.commandName,
            interactionLatency: Date.now() - this.interaction.createdTimestamp,
          }
        );

        results.successful.push(`${user.username} (Case #${case_.caseNumber})`);
      } catch (error) {
        results.failed.push({
          userId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const embed = this.client.genEmbed({
      title: "⚠️ Bulk Warn Results",
      color: results.failed.length === 0 ? 0x2ecc71 : 0xf39c12,
      fields: [
        {
          name: "✅ Successful Warnings",
          value: results.successful.length > 0 ? results.successful.join("\n") : "None",
          inline: false,
        },
        {
          name: "❌ Failed Warnings",
          value:
            results.failed.length > 0 ? results.failed.map((f) => `<@${f.userId}>: ${f.reason}`).join("\n") : "None",
          inline: false,
        },
      ],
      footer: { text: `Processed ${userIdList.length} users` },
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleBulkUnban(): Promise<CommandResponse> {
    const userIds = this.getStringOption("users", true);
    const reason = this.getStringOption("reason") ?? "Bulk unban";

    const userIdList = userIds.split(/[,\s]+/).filter((id) => id.trim().length > 0);

    if (userIdList.length === 0) {
      return this.createModerationError(
        "bulk unban",
        { username: "N/A", id: "unknown" } as User,
        "No valid user IDs provided."
      );
    }

    if (userIdList.length > 10) {
      return this.createModerationError(
        "bulk unban",
        { username: "N/A", id: "unknown" } as User,
        "Maximum 10 users can be unbanned at once for safety."
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as { userId: string; reason: string }[],
    };

    for (const userId of userIdList) {
      try {
        const user = await this.client.users.fetch(userId);

        await this.guild.members.unban(userId, reason);

        results.successful.push(user.username);
      } catch (error) {
        results.failed.push({
          userId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const embed = this.client.genEmbed({
      title: "🔓 Bulk Unban Results",
      color: results.failed.length === 0 ? 0x2ecc71 : 0xf39c12,
      fields: [
        {
          name: "✅ Successful Unbans",
          value: results.successful.length > 0 ? results.successful.join("\n") : "None",
          inline: false,
        },
        {
          name: "❌ Failed Unbans",
          value:
            results.failed.length > 0 ? results.failed.map((f) => `<@${f.userId}>: ${f.reason}`).join("\n") : "None",
          inline: false,
        },
      ],
      footer: { text: `Processed ${userIdList.length} users` },
    });

    return { embeds: [embed], ephemeral: true };
  }

  private parseDuration(durationStr: string): number | null {
    const regex = /^(\d+)([smhdwy])$/;
    const match = regex.exec(durationStr);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      case "w":
        return value * 604800;
      case "y":
        return value * 31536000;
      default:
        return null;
    }
  }
}

// Export the command instance
export default new BulkCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("bulk")
  .setDescription("Perform bulk moderation actions on multiple users")
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ban")
      .setDescription("Ban multiple users at once")
      .addStringOption((option) =>
        option.setName("users").setDescription("Comma-separated list of user IDs").setRequired(true)
      )
      .addStringOption((option) => option.setName("reason").setDescription("Reason for the ban").setRequired(true))
      .addIntegerOption((option) =>
        option.setName("delete-days").setDescription("Days of messages to delete (0-7)").setMinValue(0).setMaxValue(7)
      )
      .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the users"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("kick")
      .setDescription("Kick multiple users at once")
      .addStringOption((option) =>
        option.setName("users").setDescription("Comma-separated list of user IDs").setRequired(true)
      )
      .addStringOption((option) => option.setName("reason").setDescription("Reason for the kick").setRequired(true))
      .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the users"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("timeout")
      .setDescription("Timeout multiple users at once")
      .addStringOption((option) =>
        option.setName("users").setDescription("Comma-separated list of user IDs").setRequired(true)
      )
      .addStringOption((option) => option.setName("reason").setDescription("Reason for the timeout").setRequired(true))
      .addStringOption((option) =>
        option.setName("duration").setDescription("Duration (e.g., 30s, 5m, 2h, 1d)").setRequired(true)
      )
      .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the users"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("warn")
      .setDescription("Warn multiple users at once")
      .addStringOption((option) =>
        option.setName("users").setDescription("Comma-separated list of user IDs").setRequired(true)
      )
      .addStringOption((option) => option.setName("reason").setDescription("Reason for the warning").setRequired(true))
      .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the users"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("unban")
      .setDescription("Unban multiple users at once")
      .addStringOption((option) =>
        option.setName("users").setDescription("Comma-separated list of user IDs").setRequired(true)
      )
      .addStringOption((option) => option.setName("reason").setDescription("Reason for the unban"))
  );
