import { bullMQRegistry } from "@shared/queue";
import { SlashCommandBuilder, type User } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { type CommandConfig, type CommandResponse, type SlashCommandInteraction } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

interface BulkQueueJob {
  id: string | number;
}
interface BulkModerationQueue {
  add(name: string, data: Record<string, unknown>): Promise<BulkQueueJob>;
}

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
        default:
          throw new Error("Unknown subcommand");
      }
    } catch (error: unknown) {
      const errMsg = this.safeErrorMessage(error);
      return this.createModerationError("bulk moderation", { username: "N/A", id: "unknown" } as User, errMsg);
    }
  }

  private async handleBulkBan(): Promise<CommandResponse> {
    const userIds = this.getStringOption("users", true);
    const reason = this.getStringOption("reason", true);
    const deleteMessages = this.getBooleanOption("delete-messages") ?? false;
    const _silent = this.getBooleanOption("silent") ?? false;

    const userIdList = userIds.split(/[,\s]+/).filter((id) => id.trim().length > 0);

    if (userIdList.length === 0) {
      return this.createModerationError(
        "bulk ban",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.noValidUserIds")
      );
    }

    if (userIdList.length > 100) {
      return this.createModerationError(
        "bulk ban",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.maxUsersBan")
      );
    }

    try {
      // Queue the bulk ban operation
      const queue = bullMQRegistry.getQueue("bulk-moderation") as unknown as BulkModerationQueue;
      const job = await queue.add("BULK_BAN", {
        type: "BULK_BAN",
        guildId: this.guild.id,
        userIds: userIdList,
        reason,
        deleteMessages,
        moderatorId: this.user.id,
        id: `bulk_ban_${String(Date.now())}`,
        timestamp: Date.now(),
      });

      const embed = this.client.genEmbed({
        title: await this.t("moderation:bulk.queue.ban.title"),
        description: await this.t("moderation:bulk.queue.ban.description", { count: userIdList.length }),
        color: 0x3498db,
        fields: [
          {
            name: await this.t("moderation:bulk.fields.jobId"),
            value: String(job.id),
            inline: true,
          },
          {
            name: await this.t("moderation:bulk.fields.usersToProcess"),
            value: userIdList.length.toString(),
            inline: true,
          },
          {
            name: await this.t("moderation:bulk.fields.reason"),
            value: reason,
            inline: false,
          },
        ],
        footer: { text: await this.t("moderation:bulk.footer.checkAuditLog") },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error: unknown) {
      const errMsg = this.safeErrorMessage(error);
      return this.createModerationError(
        "bulk ban",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.failedToQueueBan", { error: errMsg })
      );
    }
  }

  private async handleBulkKick(): Promise<CommandResponse> {
    const userIds = this.getStringOption("users", true);
    const reason = this.getStringOption("reason", true);
    const _silent = this.getBooleanOption("silent") ?? false;

    const userIdList = userIds.split(/[,\s]+/).filter((id) => id.trim().length > 0);

    if (userIdList.length === 0) {
      return this.createModerationError(
        "bulk kick",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.noValidUserIds")
      );
    }

    if (userIdList.length > 100) {
      return this.createModerationError(
        "bulk kick",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.maxUsersKick")
      );
    }

    try {
      // Queue the bulk kick operation
      const queue = bullMQRegistry.getQueue("bulk-moderation") as unknown as BulkModerationQueue;
      const job = await queue.add("BULK_KICK", {
        type: "BULK_KICK",
        guildId: this.guild.id,
        userIds: userIdList,
        reason,
        moderatorId: this.user.id,
        id: `bulk_kick_${String(Date.now())}`,
        timestamp: Date.now(),
      });

      const embed = this.client.genEmbed({
        title: await this.t("moderation:bulk.queue.kick.title"),
        description: await this.t("moderation:bulk.queue.kick.description", { count: userIdList.length }),
        color: 0x3498db,
        fields: [
          {
            name: await this.t("moderation:bulk.fields.jobId"),
            value: String(job.id),
            inline: true,
          },
          {
            name: await this.t("moderation:bulk.fields.usersToProcess"),
            value: userIdList.length.toString(),
            inline: true,
          },
          {
            name: await this.t("moderation:bulk.fields.reason"),
            value: reason,
            inline: false,
          },
        ],
        footer: { text: await this.t("moderation:bulk.footer.checkAuditLog") },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error: unknown) {
      const errMsg = this.safeErrorMessage(error);
      return this.createModerationError(
        "bulk kick",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.failedToQueueKick", { error: errMsg })
      );
    }
  }

  private async handleBulkTimeout(): Promise<CommandResponse> {
    const userIds = this.getStringOption("users", true);
    const reason = this.getStringOption("reason", true);
    const durationStr = this.getStringOption("duration", true);
    const _silent = this.getBooleanOption("silent") ?? false;

    const userIdList = userIds.split(/[,\s]+/).filter((id) => id.trim().length > 0);

    if (userIdList.length === 0) {
      return this.createModerationError(
        "bulk timeout",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.noValidUserIds")
      );
    }

    if (userIdList.length > 100) {
      return this.createModerationError(
        "bulk timeout",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.maxUsersTimeout")
      );
    }

    const duration = this.parseDuration(durationStr);
    if (!duration) {
      return this.createModerationError(
        "bulk timeout",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.invalidDurationFormat")
      );
    }

    if (duration < 60 || duration > 2419200) {
      return this.createModerationError(
        "bulk timeout",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.durationRange")
      );
    }

    try {
      // Queue the bulk timeout operation
      const queue = bullMQRegistry.getQueue("bulk-moderation") as unknown as BulkModerationQueue;
      const job = await queue.add("BULK_TIMEOUT", {
        type: "BULK_TIMEOUT",
        guildId: this.guild.id,
        userIds: userIdList,
        reason,
        duration,
        moderatorId: this.user.id,
        id: `bulk_timeout_${String(Date.now())}`,
        timestamp: Date.now(),
      });

      const embed = this.client.genEmbed({
        title: await this.t("moderation:bulk.queue.timeout.title"),
        description: await this.t("moderation:bulk.queue.timeout.description", { count: userIdList.length }),
        color: 0x3498db,
        fields: [
          {
            name: await this.t("moderation:bulk.fields.jobId"),
            value: String(job.id),
            inline: true,
          },
          {
            name: await this.t("moderation:bulk.fields.usersToProcess"),
            value: userIdList.length.toString(),
            inline: true,
          },
          {
            name: await this.t("moderation:bulk.fields.duration"),
            value: durationStr,
            inline: true,
          },
          {
            name: await this.t("moderation:bulk.fields.reason"),
            value: reason,
            inline: false,
          },
        ],
        footer: { text: await this.t("moderation:bulk.footer.checkAuditLog") },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error: unknown) {
      const errMsg = this.safeErrorMessage(error);
      return this.createModerationError(
        "bulk timeout",
        { username: "N/A", id: "unknown" } as User,
        await this.t("moderation:bulk.errors.failedToQueueTimeout", { error: errMsg })
      );
    }
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

  private safeErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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
      .addBooleanOption((option) => option.setName("delete-messages").setDescription("Delete messages from the users"))
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
  );
