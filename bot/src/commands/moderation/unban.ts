import { PermissionsBitField, SlashCommandBuilder, User } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, ResponseBuilder, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Unban Command - Removes a ban from a user
 */
export class UnbanCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "unban",
      description: "Remove a ban from a user",
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

    const userInput = this.getStringOption("user", true);
    const reasonInput = this.getStringOption("reason") ?? "No reason provided";
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Resolve user ID and tag with better validation
      let userId: string;
      let userTag = userInput;
      let resolvedUser: User | null = null;

      // Check if it's a user ID (numeric)
      if (/^\d{17,19}$/.test(userInput)) {
        userId = userInput;
        try {
          resolvedUser = await this.client.users.fetch(userId);
          userTag = resolvedUser.username;
        } catch {
          // User not found, but ID format is valid - continue with ID
          userTag = `Unknown User (${userId})`;
        }
      } else {
        // Try to find by username in ban list
        try {
          const bans = await this.guild.bans.fetch();
          const bannedUser = bans.find(
            (ban) =>
              ban.user.username.toLowerCase() === userInput.toLowerCase() ||
              ban.user.tag.toLowerCase() === userInput.toLowerCase()
          );

          if (!bannedUser) {
            return this.createModerationError(
              "unban",
              { username: userInput, id: "unknown" } as User,
              `❌ Could not find banned user: **${userInput}**\n\n` +
                `💡 **Tips:**\n` +
                `• Use the exact username or user ID\n` +
                `• Check \`/lookup bans\` to see all banned users\n` +
                `• User IDs are more reliable than usernames\n\n` +
                `📖 **Example:** \`/unban user:123456789012345678\``
            );
          }

          userId = bannedUser.user.id;
          userTag = bannedUser.user.username;
          resolvedUser = bannedUser.user;
        } catch (fetchError) {
          return this.createModerationError(
            "unban",
            { username: userInput, id: "unknown" } as User,
            `❌ Failed to fetch ban list: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}\n\n` +
              `💡 **Tip:** The bot may not have permission to view bans.`
          );
        }
      }

      // Check if user is actually banned
      try {
        await this.guild.bans.fetch(userId);
      } catch {
        return this.createModerationError(
          "unban",
          resolvedUser ?? ({ username: userTag, id: userId } as User),
          `❌ **${userTag}** is not banned from this server.\n\n` +
            `💡 **Tips:**\n` +
            `• Double-check the username or user ID\n` +
            `• Use \`/lookup bans\` to see all banned users\n` +
            `• The user may have already been unbanned`
        );
      }

      // Create user object for alias expansion
      const userForAlias =
        resolvedUser ??
        ({
          id: userId,
          username: userTag.includes("(") ? "Unknown User" : userTag,
          discriminator: "0000",
          tag: userTag.includes("(") ? userTag : `${userTag}#0000`,
        } as User);

      // Expand alias with automatic variable substitution
      const reason = await expandAlias(reasonInput, {
        guild: this.guild,
        user: userForAlias,
        moderator: this.user,
      });

      // Execute the unban using moderation manager
      const case_ = await this.client.moderationManager.moderate(this.guild, {
        type: "UNBAN",
        userId,
        moderatorId: this.user.id,
        reason,
        severity: "MEDIUM",
        points: 0, // No points for unbans
        notifyUser: !silent,
      });

      // Success response with better formatting
      return new ResponseBuilder()
        .success("Unban Applied")
        .content(
          `✅ **${userTag}** has been unbanned from this server.\n\n` +
            `📋 **Case #${String(case_.caseNumber)}** created\n` +
            (reason !== "No reason provided" ? `📝 **Reason:** ${reason}\n` : "") +
            (!silent ? `📨 User was notified via DM` : `🔕 Silent unban (user not notified)`)
        )
        .ephemeral()
        .build();
    } catch (error) {
      return this.createModerationError(
        "unban",
        { username: userInput, id: "unknown" } as User,
        `${error instanceof Error ? error.message : "Unknown error"}\n\n` +
          `💡 **Common solutions:**\n` +
          `• Verify the user ID or username is correct\n` +
          `• Check if you have ban permissions\n` +
          `• Use \`/lookup bans\` to see banned users\n\n` +
          `📖 **Need help?** Contact an administrator.`
      );
    }
  }
}

// Export the command instance
export default new UnbanCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Remove a ban from a user")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addStringOption((option) => option.setName("user").setDescription("User ID or username to unban").setRequired(true))
  .addStringOption((option) =>
    option.setName("reason").setDescription("Reason for the unban (or alias name)").setRequired(false)
  )
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
