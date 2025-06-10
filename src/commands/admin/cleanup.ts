import { SlashCommandBuilder } from "discord.js";

import { permanentlyDeleteReactionRoles } from "../../database/ReactionRoles.js";
import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("cleanup")
    .setDescription("ADMIN ONLY: Database cleanup operations")
    .addSubcommand((sub) =>
      sub
        .setName("reaction-roles")
        .setDescription("Permanently delete soft-deleted reaction roles")
        .addIntegerOption((opt) =>
          opt
            .setName("days")
            .setDescription("Delete records older than this many days (default: 30)")
            .setMinValue(1)
            .setMaxValue(365)
        )
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("Show cleanup statistics")),

  async (_client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "reaction-roles": {
          const days = interaction.options.getInteger("days") ?? 30;

          try {
            const result = await permanentlyDeleteReactionRoles(interaction.guildId, days);

            await interaction.followUp({
              content: `✅ Cleanup completed!\n• Permanently deleted ${result.count.toString()} reaction role records\n• Records older than ${days.toString()} days were removed`,
            });

            logger.info(
              `Cleaned up ${result.count.toString()} reaction role records for guild ${interaction.guildId} (older than ${days.toString()} days)`
            );
          } catch (error) {
            logger.error("Error during reaction role cleanup:", error);
            await interaction.followUp({
              content: "❌ Error occurred during cleanup. Check logs for details.",
            });
          }
          break;
        }

        case "status": {
          // TODO: Add cleanup status information
          await interaction.followUp({
            content: "📊 Cleanup status information will be available in a future update.",
          });
          break;
        }

        default: {
          await interaction.followUp({
            content: "❌ Unknown cleanup operation",
          });
        }
      }
    } catch (error) {
      logger.error("Error in cleanup command:", error);
      await interaction.followUp({
        content: "❌ An unexpected error occurred during cleanup.",
      });
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
