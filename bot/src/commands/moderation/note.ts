import { SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("note")
    .setDescription("Add a note about a user")
    .addUserOption((option) => option.setName("user").setDescription("The user to add a note about").setRequired(true))
    .addStringOption((option) => option.setName("content").setDescription("The note content").setRequired(true))
    .addBooleanOption((option) =>
      option
        .setName("internal")
        .setDescription("Make this note internal (staff-only, default: false)")
        .setRequired(false)
    )
    .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false)),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const targetUser = interaction.options.getUser("user", true);
    let content = interaction.options.getString("content", true);
    const isInternal = interaction.options.getBoolean("internal") ?? false;
    const silent = interaction.options.getBoolean("silent") ?? false;

    try {
      // Check if content is an alias and expand it
      const aliasName = content.toUpperCase();
      const alias = await prisma.alias.findUnique({
        where: { guildId_name: { guildId: interaction.guild.id, name: aliasName } },
      });

      if (alias) {
        // Expand alias content with variables
        content = alias.content;
        content = content.replace(/\{user\}/g, `<@${targetUser.id}>`);
        content = content.replace(/\{server\}/g, interaction.guild.name);
        content = content.replace(/\{moderator\}/g, `<@${interaction.user.id}>`);

        // Update usage count
        await prisma.alias.update({
          where: { id: alias.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Execute the note using the moderation system
      const case_ = await client.moderationManager.note(
        interaction.guild,
        targetUser.id,
        interaction.user.id,
        content,
        isInternal,
        !silent
      );

      const noteType = isInternal ? "internal" : "public";
      const notificationStatus = silent ? " (silent)" : "";

      await interaction.reply({
        content: `📝 Added ${noteType} note about **${targetUser.tag}**.\n📋 **Case #${case_.caseNumber}** created${notificationStatus}.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Failed to add note about **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
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
