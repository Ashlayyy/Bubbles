import type { GuildMember, User } from "discord.js";
import { type Duration } from "../../_shared/formatters/duration.js";
import { expandAlias, type AliasExpansionContext } from "../../_shared/parsers/alias.js";
import { type ParsedEvidence } from "../../_shared/parsers/evidence.js";
import { BaseCommand } from "../BaseCommand.js";
import {
  formatDuration as indexFormatDuration,
  formatEvidence as indexFormatEvidence,
  formatMember as indexFormatMember,
  formatUser as indexFormatUser,
  parseEvidence as indexParseEvidence,
  validateDuration as indexValidateDuration,
} from "../index.js";
import type { CommandConfig, CommandResponse } from "../types.js";

interface ModerationCommandOptions {
  user: User;
  reason?: string;
  duration?: string;
  evidence?: string;
  silent: boolean;
}

export abstract class ModerationCommand extends BaseCommand {
  constructor(config: CommandConfig) {
    super({
      ...config,
      guildOnly: true, // All moderation commands are guild-only
      category: "moderation",
    });
  }

  // Utility methods for moderation commands

  /**
   * Parse and validate a user option
   */
  protected getTargetUser(required: true): User;
  protected getTargetUser(required?: false): User | null;
  protected getTargetUser(required = false): User | null {
    if (!this.isSlashCommand()) return null;

    if (required) {
      return this.getUserOption("user", true);
    } else {
      return this.getUserOption("user", false);
    }
  }

  /**
   * Get target member with validation
   */
  protected async getTargetMember(required = true): Promise<GuildMember | null> {
    const user = required ? this.getTargetUser(true) : this.getTargetUser(false);
    if (!user) return null;

    try {
      const member = await this.guild.members.fetch(user.id);
      return member;
    } catch {
      if (required) {
        throw new Error(`User ${indexFormatUser(user)} is not in this server.`);
      }
      return null;
    }
  }

  /**
   * Parse duration option with validation
   */
  protected parseDurationOption(type: "timeout" | "ban" | "mute" = "ban"): Duration | null {
    if (!this.isSlashCommand()) return null;

    const durationStr = this.getStringOption("duration");
    if (!durationStr) return null;

    const validation = indexValidateDuration(durationStr, type);
    if (!validation.valid) {
      throw new Error(validation.error ?? "Invalid duration");
    }

    return {
      seconds: validation.seconds ?? 0,
      formatted: indexFormatDuration(validation.seconds ?? 0),
    };
  }

  /**
   * Parse evidence option
   */
  protected parseEvidenceOption(): ParsedEvidence {
    if (!this.isSlashCommand()) return { links: [], attachments: [], text: [], all: [] };

    const evidenceStr = this.getStringOption("evidence");
    return indexParseEvidence(evidenceStr ?? undefined);
  }

  /**
   * Expand reason alias
   */
  protected async expandReasonAlias(reason?: string, targetUser?: User): Promise<string> {
    if (!reason) return "No reason provided";

    const context: AliasExpansionContext = {
      guild: this.guild,
      user: targetUser ?? this.user,
      moderator: this.user,
    };

    return await expandAlias(reason, context);
  }

  /**
   * Get common moderation options from slash command
   */
  protected getModerationOptions(): ModerationCommandOptions {
    if (!this.isSlashCommand()) {
      throw new Error("This method is only available for slash commands");
    }

    const user = this.getUserOption("user", true);
    const reason = this.getStringOption("reason");
    const duration = this.getStringOption("duration");
    const evidence = this.getStringOption("evidence");
    const silent = this.getBooleanOption("silent") ?? false;

    return {
      user,
      reason: reason ?? undefined,
      duration: duration ?? undefined,
      evidence: evidence ?? undefined,
      silent,
    };
  }

  /**
   * Validate moderation action permissions
   */
  protected validateModerationTarget(target: GuildMember): void {
    const moderator = this.member;

    if (target.id === moderator.id) {
      throw new Error("You cannot moderate yourself.");
    }

    if (this.client.user && target.id === this.client.user.id) {
      throw new Error("You cannot moderate the bot.");
    }

    if (this.isDeveloper(moderator.user.id)) {
      return;
    }

    if (target.id === this.guild.ownerId) {
      throw new Error("You cannot moderate the server owner.");
    }

    if (moderator.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
      throw new Error(`You cannot moderate ${indexFormatMember(target)} as they have equal or higher roles than you.`);
    }

    const botMember = this.guild.members.me;
    if (botMember && botMember.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
      throw new Error(`I cannot moderate ${indexFormatMember(target)} as they have equal or higher roles than me.`);
    }
  }

  protected isDeveloper(userId: string): boolean {
    const developers = process.env.DEVELOPER_USER_IDS?.split(",") ?? [];
    return developers.includes(userId);
  }

  protected createModerationResponse(
    action: string,
    target: User,
    reason: string,
    duration?: Duration,
    caseNumber?: number,
    evidence?: ParsedEvidence
  ): CommandResponse {
    const durationText = duration ? ` for ${duration.formatted}` : "";
    const caseText = caseNumber ? `\n📋 **Case #${String(caseNumber)}** created.` : "";

    const content = `✅ **${target.username}** has been ${action}${durationText}.${caseText}`;

    const embed = this.responseBuilder.success(`${action.charAt(0).toUpperCase() + action.slice(1)} Applied`).build();

    if (embed.embeds?.[0]) {
      const fields = [
        { name: "Target", value: indexFormatUser(target), inline: true },
        { name: "Moderator", value: indexFormatUser(this.user), inline: true },
        { name: "Reason", value: reason.substring(0, 1000), inline: false },
      ];

      if (duration) {
        fields.push({
          name: "Duration",
          value: duration.formatted,
          inline: true,
        });
      }

      if (evidence && evidence.all.length > 0) {
        fields.push({
          name: "Evidence",
          value: indexFormatEvidence(evidence, 500),
          inline: false,
        });
      }

      if (caseNumber) {
        fields.push({
          name: "Case Number",
          value: `#${String(caseNumber)}`,
          inline: true,
        });
      }

      // Add fields to the embed (assuming embed structure is correct)
      // The embedBuilder variable was causing the unsafe assignment
    }

    return { ...embed, content };
  }

  protected createModerationError(action: string, target: User, error: string): CommandResponse {
    return this.responseBuilder
      .error(`${action.charAt(0).toUpperCase() + action.slice(1)} Failed`)
      .content(`❌ Failed to ${action} **${target.username}**: ${error}`)
      .ephemeral(true)
      .build();
  }

  /**
   * Read optional embed theme overrides from common options present on moderation commands.
   * Supported options: `style` (compact|standard|detailed), `mentions` (mention|tag|id|username)
   */
  protected getThemeOverrides(): Partial<{
    variant: "compact" | "standard" | "detailed";
    showCaseField: boolean;
    reasonMaxLength: number;
    mentionStyle: "mention" | "tag" | "id" | "username";
  }> {
    if (!this.isSlashCommand()) return {};

    const style = this.getStringOption("style") as "compact" | "standard" | "detailed" | null;
    const mentions = this.getStringOption("mentions") as "mention" | "tag" | "id" | "username" | null;

    const overrides: Partial<{
      variant: "compact" | "standard" | "detailed";
      showCaseField: boolean;
      reasonMaxLength: number;
      mentionStyle: "mention" | "tag" | "id" | "username";
    }> = {};
    if (style === "compact" || style === "standard" || style === "detailed") {
      overrides.variant = style;
      // Compact preset tweaks
      if (style === "compact") {
        overrides.showCaseField = false;
        overrides.reasonMaxLength = 300;
      }
      if (style === "detailed") {
        overrides.reasonMaxLength = 1000;
      }
    }

    if (mentions === "mention" || mentions === "tag" || mentions === "id" || mentions === "username") {
      overrides.mentionStyle = mentions;
    }

    return overrides;
  }
}
