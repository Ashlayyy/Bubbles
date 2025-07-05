import { PermissionsBitField, SlashCommandBuilder, type User } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, parseEvidence, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";
import { buildModSuccess } from "../_shared/ModResponseBuilder.js";

/**
 * Kick Command - Kicks a user from the server
 */
export class KickCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "kick",
      description: "Kick a user from the server",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [PermissionsBitField.Flags.KickMembers],
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

    const reasonInput = this.getStringOption("reason") ?? "No reason provided";
    const evidenceStr = this.getStringOption("evidence");
    const silent = this.getBooleanOption("silent") ?? false;

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
        return this.createModerationError("kick", this.user, "Unsupported attachment type. Only .txt or .csv allowed.");
      }

      try {
        const txt = await (await fetch(listAttachment.url)).text();
        txt
          .split(/[\s,\n]+/)
          .map((id) => id.trim())
          .filter((id) => /^\d{17,20}$/.test(id))
          .forEach((id) => idSet.add(id));
      } catch {
        return this.createModerationError("kick", this.user, "Failed to download or parse attachment");
      }
    }

    const targetIds = Array.from(idSet);

    if (targetIds.length === 0) {
      return this.createModerationError("kick", this.user, "No valid target user IDs provided.");
    }

    try {
      let success = 0;
      let failed = 0;

      for (const id of targetIds) {
        const fetched: User | null = await this.client.users.fetch(id).catch(() => null);
        const displayUser = fetched ?? ({ id, username: "Unknown" } as User);

        // Check member presence
        const member = await this.guild.members.fetch(id).catch(() => null);
        if (!member) {
          failed++;
          continue;
        }

        // Validate hierarchy etc.
        try {
          this.validateModerationTarget(member);
        } catch {
          failed++;
          continue;
        }

        // Expand alias with per-user context
        const reason = await expandAlias(reasonInput, {
          guild: this.guild,
          user: displayUser,
          moderator: this.user,
        });

        const evidence = parseEvidence(evidenceStr ?? undefined);

        await this.client.moderationManager.kick(
          this.guild,
          id,
          this.user.id,
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
        title: "Kick Complete",
        target: this.user,
        moderator: this.user,
        reason: `Kicked ${success}/${targetIds.length} users (${failed} failed).`,
        notified: !silent,
      });
    } catch (error) {
      return this.createModerationError("kick", this.user, error instanceof Error ? error.message : "Unknown error");
    }
  }
}

// Export the command instance
export default new KickCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a user from the server")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addUserOption((option) => option.setName("user").setDescription("The user to kick").setRequired(false))
  .addStringOption((opt) =>
    opt.setName("users").setDescription("User IDs separated by space/comma/newline to kick").setRequired(false)
  )
  .addAttachmentOption((opt) =>
    opt.setName("list").setDescription("Attachment (.txt/.csv) with user IDs").setRequired(false)
  )
  .addStringOption((option) =>
    option.setName("reason").setDescription("Reason for the kick (or alias name)").setRequired(false)
  )
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
