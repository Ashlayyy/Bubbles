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

    // Get command options using typed methods
    const userInput = this.getStringOption("user", true);
    const reasonInput = this.getStringOption("reason") ?? "No reason provided";
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Resolve user ID and tag
      let userId: string;
      let userTag = userInput;

      // Check if it's a user ID (numeric)
      if (/^\d{17,19}$/.test(userInput)) {
        userId = userInput;
        try {
          const user = await this.client.users.fetch(userId);
          userTag = user.tag;
        } catch {
          userTag = `Unknown User (${userId})`;
        }
      } else {
        // Try to find by username in ban list
        const bans = await this.guild.bans.fetch();
        const bannedUser = bans.find(
          (ban) =>
            ban.user.username.toLowerCase() === userInput.toLowerCase() ||
            ban.user.tag.toLowerCase() === userInput.toLowerCase()
        );

        if (!bannedUser) {
          throw new Error(`Could not find banned user with username: **${userInput}**`);
        }

        userId = bannedUser.user.id;
        userTag = bannedUser.user.tag;
      }

      // Check if user is actually banned
      try {
        await this.guild.bans.fetch(userId);
      } catch {
        throw new Error(`**${userTag}** is not banned from this server.`);
      }

      // Expand alias with automatic variable substitution (use resolved user)
      // Try to get the real user object first, fallback to partial object
      let userForAlias: User;
      try {
        userForAlias = await this.client.users.fetch(userId);
      } catch {
        // Create a minimal user-like object for alias expansion when user fetch fails
        userForAlias = {
          id: userId,
          username: userTag.split("#")[0] || userTag,
          discriminator: userTag.includes("#") ? userTag.split("#")[1] : "0000",
          tag: userTag,
        } as User;
      }

      const reason = await expandAlias(reasonInput, {
        guild: this.guild,
        user: userForAlias,
        moderator: this.user,
      });

      // Execute the unban using existing moderation manager
      const case_ = await this.client.moderationManager.moderate(this.guild, {
        type: "UNBAN",
        userId,
        moderatorId: this.user.id,
        reason,
        severity: "MEDIUM",
        points: 0, // No points for unbans
        notifyUser: !silent,
      });

      // Use the new ResponseBuilder for consistent formatting
      return new ResponseBuilder()
        .success("Unban Applied")
        .content(`**${userTag}** has been unbanned from this server.\n📋 **Case #${case_.caseNumber}** created.`)
        .ephemeral()
        .build();
    } catch (error) {
      throw new Error(`Failed to unban user: ${error instanceof Error ? error.message : "Unknown error"}`);
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
