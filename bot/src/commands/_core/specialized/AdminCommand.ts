import type { GuildMember } from "discord.js";
import { BaseCommand } from "../BaseCommand.js";
import type { CommandConfig } from "../types.js";

export abstract class AdminCommand extends BaseCommand {
  constructor(config: CommandConfig) {
    super({
      ...config,
      guildOnly: true, // All admin commands are guild-only
      category: "admin",
    });
  }

  // Admin-specific utility methods

  /**
   * Check if user has server management permissions
   */
  protected hasServerManagementPerms(member: GuildMember): boolean {
    return member.permissions.has("ManageGuild");
  }

  /**
   * Check if user has moderation permissions
   */
  protected hasModerationPerms(member: GuildMember): boolean {
    return member.permissions.has("ModerateMembers");
  }

  /**
   * Check if user has message management permissions
   */
  protected hasMessageManagementPerms(member: GuildMember): boolean {
    return member.permissions.has("ManageMessages");
  }

  /**
   * Check if user has role management permissions
   */
  protected hasRoleManagementPerms(member: GuildMember): boolean {
    return member.permissions.has("ManageRoles");
  }

  /**
   * Check if user has channel management permissions
   */
  protected hasChannelManagementPerms(member: GuildMember): boolean {
    return member.permissions.has("ManageChannels");
  }

  /**
   * Check if user is server owner
   */
  protected isServerOwner(member: GuildMember): boolean {
    return member.id === this.guild.ownerId;
  }

  /**
   * Check if user is bot developer
   */
  protected isDeveloper(userId: string): boolean {
    const developers = process.env.DEVELOPER_USER_IDS?.split(",") ?? [];
    return developers.includes(userId);
  }

  /**
   * Validate admin action permissions
   */
  protected validateAdminPerms(requiredPerms: string[] = []): void {
    const member = this.member;

    // Developers and server owner bypass all checks
    if (this.isDeveloper(member.user.id) || this.isServerOwner(member)) {
      return;
    }

    // Check specific required permissions
    for (const perm of requiredPerms) {
      if (!member.permissions.has(perm as keyof typeof import("discord.js").PermissionFlagsBits)) {
        throw new Error(`You need the \`${perm}\` permission to use this command.`);
      }
    }
  }

  /**
   * Create admin success response
   */
  protected createAdminSuccess(title: string, description: string) {
    return this.responseBuilder.success(title, description).ephemeral(true).build();
  }

  /**
   * Create admin error response
   */
  protected createAdminError(title: string, description: string) {
    return this.responseBuilder.error(title, description).ephemeral(true).build();
  }

  /**
   * Create admin info response
   */
  protected createAdminInfo(title: string, description: string) {
    return this.responseBuilder.info(title, description).ephemeral(true).build();
  }
}
