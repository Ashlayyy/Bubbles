import { PermissionsBitField, SlashCommandBuilder, type User } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, parseDuration, parseEvidence, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";
import { buildModSuccess } from "../_shared/ModResponseBuilder.js";
import { ResponseBuilder } from "../_shared/responses/ResponseBuilder.js";

/**
 * MassBan Command - Ban multiple users by IDs
 */
export class MassBanCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "massban",
      description: "Ban multiple users at once via IDs",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [PermissionsBitField.Flags.BanMembers],
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

    const idsInput = this.getStringOption("users", true);
    const reasonInput = this.getStringOption("reason", true);
    const durationStr = this.getStringOption("duration");
    const evidenceStr = this.getStringOption("evidence");
    const silent = this.getBooleanOption("silent") ?? false;
    const listAttachment = this.getAttachmentOption("list");

    // Combine IDs from the text option and (optional) attachment
    const initialIds = idsInput
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter((id) => /^\d{17,20}$/.test(id));

    let attachmentIds: string[] = [];
    if (listAttachment) {
      const contentType = listAttachment.contentType ?? "";
      const fileName = listAttachment.name;

      const isTxtOrCsv = /text\/(plain|csv)/i.test(contentType) || /\.(txt|csv)$/i.test(fileName);

      if (!isTxtOrCsv) {
        return new ResponseBuilder()
          .error("Unsupported File", "Only .txt or .csv files are allowed for the list attachment.")
          .ephemeral()
          .build();
      }

      try {
        const fileRes = await fetch(listAttachment.url);
        const text = await fileRes.text();
        attachmentIds = text
          .split(/[\s,\n]+/)
          .map((id) => id.trim())
          .filter((id) => /^\d{17,20}$/.test(id));
      } catch {
        return new ResponseBuilder()
          .error("Download Failed", "Could not download or read the provided attachment.")
          .ephemeral()
          .build();
      }
    }

    const userIds = Array.from(new Set([...initialIds, ...attachmentIds]));

    if (userIds.length === 0) {
      return this.createModerationError("massban", this.user, "No valid user IDs provided.");
    }

    // Parse duration if provided
    let duration: number | undefined;
    if (durationStr) {
      const d = parseDuration(durationStr);
      if (d === null) {
        return this.createModerationError("massban", this.user, "Invalid duration format.");
      }
      duration = d;
    }

    const evidence = parseEvidence(evidenceStr ?? undefined);

    // Invocation context
    const invocation = {
      interactionId: this.interaction.id,
      commandName: this.interaction.commandName,
      interactionLatency: Date.now() - this.interaction.createdTimestamp,
    };

    // If more than 25 users and queue service ready, off-load to queue
    if (userIds.length > 25 && this.client.queueService?.isReady()) {
      for (const id of userIds) {
        // Resolve alias per-target (if cache allows)
        const fetched: User | null = await this.client.users.fetch(id).catch(() => null);
        const targetUser = this.client.users.cache.get(id) ?? fetched;

        const resolvedReason = await expandAlias(reasonInput, {
          guild: this.guild,
          user: targetUser ?? this.user,
          moderator: this.user,
        });

        void this.client.queueService.processRequest({
          type: "BAN_USER",
          data: {
            targetUserId: id,
            reason: resolvedReason,
            duration,
          },
          source: "internal",
          userId: this.user.id,
          guildId: this.guild.id,
        });
      }

      return new ResponseBuilder()
        .success("Mass Ban Queued", `Queued ${userIds.length} users for banning via queue service.`)
        .ephemeral()
        .build();
    }

    let success = 0;
    let failed = 0;

    for (const id of userIds) {
      try {
        const fetched: User | null = await this.client.users.fetch(id).catch(() => null);
        const targetUser = this.client.users.cache.get(id) ?? fetched;

        await this.client.moderationManager.ban(
          this.guild,
          id,
          this.user.id,
          await expandAlias(reasonInput, {
            guild: this.guild,
            user: targetUser ?? this.user,
            moderator: this.user,
          }),
          duration,
          evidence.all.length > 0 ? evidence.all : undefined,
          !silent,
          invocation
        );
        success++;
      } catch {
        failed++;
      }
    }

    return buildModSuccess({
      title: "Mass Ban Complete",
      target: this.user,
      moderator: this.user,
      reason: `Banned ${success}/${userIds.length} users (${failed} failed).`,
      notified: false,
    });
  }
}

export default new MassBanCommand();

export const builder = new SlashCommandBuilder()
  .setName("massban")
  .setDescription("Ban multiple users by IDs (space or comma separated)")
  .setDefaultMemberPermissions(0)
  .addStringOption((opt) =>
    opt.setName("users").setDescription("User IDs separated by space, comma, or newline").setRequired(true)
  )
  .addStringOption((opt) => opt.setName("reason").setDescription("Reason or alias").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("duration").setDescription("Duration for temp-ban (e.g., 7d) – leave empty for perm").setRequired(false)
  )
  .addStringOption((opt) => opt.setName("evidence").setDescription("Evidence links").setRequired(false))
  .addBooleanOption((opt) => opt.setName("silent").setDescription("Don't DM users").setRequired(false))
  .addAttachmentOption((opt) =>
    opt.setName("list").setDescription("Attachment (.txt/.csv) containing user IDs, one per line").setRequired(false)
  );
