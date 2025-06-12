import { PermissionsBitField, SlashCommandBuilder } from "discord.js";

import { permanentlyDeleteReactionRoles } from "../../database/ReactionRoles.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("cleanup")
    .setDescription("ADMIN ONLY: Database cleanup operations")
    .setDefaultMemberPermissions(0)
    .addSubcommand((sub) =>
      sub
        .setName("reaction-roles")
        .setDescription("Permanently delete reaction roles for messages that no longer exist")
        .addBooleanOption((opt) =>
          opt
            .setName("dry-run")
            .setDescription("Show what would be deleted without actually deleting")
            .setRequired(false)
        )
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "reaction-roles") {
      const dryRun = interaction.options.getBoolean("dry-run") ?? false;

      try {
        if (dryRun) {
          await interaction.followUp({
            content: "🔍 **Dry run mode** - Checking for reaction roles to clean up...",
          });
          // Add dry run logic here
        } else {
          const result = await permanentlyDeleteReactionRoles(interaction.guildId);
          await interaction.followUp({
            content: `🧹 **Cleanup completed!** Deleted ${result.count.toString()} reaction role(s) for messages that no longer exist.`,
          });
        }
      } catch (error) {
        await interaction.followUp({
          content: `❌ Error during cleanup: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.Administrator],
      isConfigurable: true,
    },
  }
);
