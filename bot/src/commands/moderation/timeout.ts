import { SlashCommandBuilder, type User } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, parseDuration, parseEvidence, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";
import { buildModSuccess } from "../_shared/ModResponseBuilder.js";

/**
 * Timeout Command - Timeout a user (mute them temporarily)
 */
export class TimeoutCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "timeout",
      description: "Timeout a user (mute them temporarily)",
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

    const singleUser = this.getUserOption("user");
    const idsInput = this.getStringOption("users");
    const listAttachment = this.getAttachmentOption("list");

    const durationStr = this.getStringOption("duration", true);
    const reasonInput = this.getStringOption("reason") ?? "No reason provided";
    const evidenceStr = this.getStringOption("evidence");
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Parse duration first for early validation
      const duration = parseDuration(durationStr);
      if (duration === null) {
        return this.createModerationError(
          "timeout",
          this.user,
          `❌ Invalid duration format: **${durationStr}**\n\n` +
            `**Correct format examples:**\n` +
            `• \`30m\` - 30 minutes\n` +
            `• \`2h\` - 2 hours\n` +
            `• \`1d\` - 1 day\n` +
            `• \`7d\` - 7 days\n\n` +
            `**Allowed units:** s(econds), m(inutes), h(ours), d(ays), w(eeks)`
        );
      }

      // Discord timeout limit is 28 days
      const maxDuration = 28 * 24 * 60 * 60; // 28 days in seconds
      if (duration > maxDuration) {
        return this.createModerationError(
          "timeout",
          this.user,
          `❌ Timeout duration cannot exceed **28 days**.\n\n` +
            `**Requested:** ${this.formatDuration(duration)}\n` +
            `**Maximum allowed:** 28 days\n\n` +
            `💡 **Tip:** For longer punishments, consider using \`/ban\` with a duration.`
        );
      }

      // Build target ID list
      const idSet = new Set<string>();
      if (singleUser) idSet.add(singleUser.id);
      if (idsInput) {
        idsInput
          .split(/[\s,]+/)
          .map((id) => id.trim())
          .filter((id) => /^\d{17,20}$/.test(id))
          .forEach((id) => idSet.add(id));
      }

      if (listAttachment) {
        const contentType = listAttachment.contentType ?? "";
        const fileName = listAttachment.name;
        const isTxtOrCsv = /text\/(plain|csv)/i.test(contentType) || /\.(txt|csv)$/i.test(fileName);

        if (!isTxtOrCsv) {
          return this.createModerationError("timeout", this.user, "Unsupported attachment type. Only .txt/.csv");
        }

        try {
          const txt = await (await fetch(listAttachment.url)).text();
          txt
            .split(/[\s,\n]+/)
            .map((id) => id.trim())
            .filter((id) => /^\d{17,20}$/.test(id))
            .forEach((id) => idSet.add(id));
        } catch {
          return this.createModerationError("timeout", this.user, "Failed to download or parse attachment");
        }
      }

      const targetIds = Array.from(idSet);

      if (targetIds.length === 0) {
        return this.createModerationError("timeout", this.user, "No valid target IDs provided.");
      }

      let success = 0;
      let failed = 0;

      // Offload to queue when many IDs
      if (targetIds.length > 25 && this.client.queueService?.isReady()) {
        for (const id of targetIds) {
          const fetched: User | null = await this.client.users.fetch(id).catch(() => null);
          const displayUser = fetched ?? ({ id, username: "Unknown" } as User);

          const resolvedReason = await expandAlias(reasonInput, {
            guild: this.guild,
            user: displayUser,
            moderator: this.user,
          });

          void this.client.queueService.processRequest({
            type: "TIMEOUT_USER",
            data: { targetUserId: id, reason: resolvedReason, duration },
            source: "internal",
            userId: this.user.id,
            guildId: this.guild.id,
          });
        }

        return buildModSuccess({
          title: "Timeout Queued",
          target: this.user,
          moderator: this.user,
          reason: `Queued ${targetIds.length} users for timeout`,
        });
      }

      for (const id of targetIds) {
        const member = await this.guild.members.fetch(id).catch(() => null);
        if (!member) {
          failed++;
          continue;
        }

        try {
          this.validateModerationTarget(member);
        } catch {
          failed++;
          continue;
        }

        const fetchedUser: User | null = await this.client.users.fetch(id).catch(() => null);
        const displayUser = fetchedUser ?? ({ id, username: "Unknown" } as User);

        const reason = await expandAlias(reasonInput, {
          guild: this.guild,
          user: displayUser,
          moderator: this.user,
        });

        const evidence = parseEvidence(evidenceStr ?? undefined);

        await this.client.moderationManager.timeout(
          this.guild,
          id,
          this.user.id,
          duration,
          reason,
          evidence.all.length > 0 ? evidence.all : undefined,
          !silent,
          {
            interactionId: this.interaction.id,
            commandName: this.interaction.commandName,
            interactionLatency: Date.now() - this.interaction.createdTimestamp,
          }
        );

        success++;
      }

      return buildModSuccess({
        title: "Timeout Complete",
        target: this.user,
        moderator: this.user,
        reason: `Timed out ${success}/${targetIds.length} users (${failed} failed).`,
        duration,
        notified: !silent,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("hierarchy")) {
        return this.createModerationError(
          "timeout",
          this.user,
          `❌ Cannot timeout **${this.user.username}**\n\n` +
            `**Reason:** User has equal or higher permissions than you.\n\n` +
            `💡 **Tip:** Only users with lower roles can be timed out.`
        );
      }

      throw new Error(`Failed to timeout: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private formatDuration(seconds: number): string {
    const units = [
      { name: "week", seconds: 604800 },
      { name: "day", seconds: 86400 },
      { name: "hour", seconds: 3600 },
      { name: "minute", seconds: 60 },
    ];

    for (const unit of units) {
      const count = Math.floor(seconds / unit.seconds);
      if (count > 0) {
        return `${String(count)} ${unit.name}${count !== 1 ? "s" : ""}`;
      }
    }

    return `${String(seconds)} second${seconds !== 1 ? "s" : ""}`;
  }
}

// Export the command instance
export default new TimeoutCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Timeout a user (mute them temporarily)")
  .addStringOption((option) =>
    option.setName("duration").setDescription("Duration (e.g., 1d, 3h, 30m) - max 28 days").setRequired(true)
  )
  .addUserOption((option) => option.setName("user").setDescription("The user to timeout").setRequired(false))
  .addStringOption((opt) =>
    opt.setName("users").setDescription("User IDs separated by space/comma/newline to timeout").setRequired(false)
  )
  .addAttachmentOption((opt) =>
    opt.setName("list").setDescription("Attachment (.txt/.csv) with user IDs").setRequired(false)
  )
  .addStringOption((option) => option.setName("reason").setDescription("Reason for the timeout").setRequired(false))
  .addStringOption((option) =>
    option.setName("evidence").setDescription("Evidence links (comma-separated)").setRequired(false)
  )
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
