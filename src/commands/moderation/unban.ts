import { SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user from the server")
    .addStringOption((option) =>
      option.setName("user").setDescription("User ID or username to unban").setRequired(true)
    )
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the unban").setRequired(false))
    .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false)),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const userInput = interaction.options.getString("user", true);
    let reason = interaction.options.getString("reason") ?? "No reason provided";
    const silent = interaction.options.getBoolean("silent") ?? false;

    try {
      // Check if reason is an alias and expand it
      if (reason !== "No reason provided") {
        const aliasName = reason.toUpperCase();
        const alias = await prisma.alias.findUnique({
          where: { guildId_name: { guildId: interaction.guild.id, name: aliasName } },
        });

        if (alias) {
          // For unban, we need to resolve user info first to use in alias variables
          let userId: string;

          // Check if it's a user ID (numeric)
          if (/^\d{17,19}$/.test(userInput)) {
            userId = userInput;
          } else {
            // Try to find by username in ban list
            const bans = await interaction.guild.bans.fetch();
            const bannedUser = bans.find(
              (ban) =>
                ban.user.username.toLowerCase() === userInput.toLowerCase() ||
                ban.user.tag.toLowerCase() === userInput.toLowerCase()
            );

            if (!bannedUser) {
              await interaction.reply({
                content: `❌ Could not find banned user with username: **${userInput}**`,
                ephemeral: true,
              });
              return;
            }

            userId = bannedUser.user.id;
          }

          // Expand alias content with variables
          reason = alias.content;
          reason = reason.replace(/\{user\}/g, `<@${userId}>`);
          reason = reason.replace(/\{server\}/g, interaction.guild.name);
          reason = reason.replace(/\{moderator\}/g, `<@${interaction.user.id}>`);

          // Update usage count
          await prisma.alias.update({
            where: { id: alias.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      // Try to resolve user ID (if not already done above)
      let userId: string;
      let userTag = userInput;

      // Check if it's a user ID (numeric)
      if (/^\d{17,19}$/.test(userInput)) {
        userId = userInput;
        try {
          const user = await client.users.fetch(userId);
          userTag = user.tag;
        } catch {
          userTag = `Unknown User (${userId})`;
        }
      } else {
        // Try to find by username in ban list
        const bans = await interaction.guild.bans.fetch();
        const bannedUser = bans.find(
          (ban) =>
            ban.user.username.toLowerCase() === userInput.toLowerCase() ||
            ban.user.tag.toLowerCase() === userInput.toLowerCase()
        );

        if (!bannedUser) {
          await interaction.reply({
            content: `❌ Could not find banned user with username: **${userInput}**`,
            ephemeral: true,
          });
          return;
        }

        userId = bannedUser.user.id;
        userTag = bannedUser.user.tag;
      }

      // Check if user is actually banned
      try {
        await interaction.guild.bans.fetch(userId);
      } catch {
        await interaction.reply({
          content: `❌ **${userTag}** is not banned from this server.`,
          ephemeral: true,
        });
        return;
      }

      // Execute the unban using the moderation system
      const case_ = await client.moderationManager.moderate(interaction.guild, {
        type: "UNBAN",
        userId,
        moderatorId: interaction.user.id,
        reason,
        severity: "MEDIUM",
        points: 0, // No points for unbans
        notifyUser: !silent,
      });

      await interaction.reply({
        content: `✅ **${userTag}** has been unbanned.\n📋 **Case #${case_.caseNumber}** created.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Failed to unban user: ${error instanceof Error ? error.message : "Unknown error"}`,
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
