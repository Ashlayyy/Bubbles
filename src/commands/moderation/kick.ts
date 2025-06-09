import { SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption((option) => option.setName("user").setDescription("The user to kick").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the kick").setRequired(false))
    .addStringOption((option) =>
      option.setName("evidence").setDescription("Evidence links (comma-separated)").setRequired(false)
    )
    .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false)),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const evidence =
      interaction.options
        .getString("evidence")
        ?.split(",")
        .map((s) => s.trim()) ?? [];
    const silent = interaction.options.getBoolean("silent") ?? false;

    try {
      // Get the moderation manager from client
      const moderationManager = client.moderationManager;

      // Execute the kick - the system handles everything automatically!
      const case_ = await moderationManager.kick(
        interaction.guild,
        targetUser.id,
        interaction.user.id,
        reason,
        evidence.length > 0 ? evidence : undefined
      );

      // If silent, update the case to not notify user
      if (silent) {
        await moderationManager.updateCaseNotification(case_.id, false);
      }

      // Simple success response
      await interaction.reply({
        content: `✅ **${targetUser.tag}** has been kicked.\n📋 **Case #${case_.caseNumber}** created.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Failed to kick **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.MODERATOR,
      isConfigurable: true,
    },
  }
);
