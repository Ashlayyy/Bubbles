import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete multiple messages at once")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1-1000)")
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option.setName("user").setDescription("Only delete messages from this user").setRequired(false)
    )
    .addStringOption((option) =>
      option.setName("contains").setDescription("Only delete messages containing this text").setRequired(false)
    )
    .addBooleanOption((option) =>
      option.setName("bots").setDescription("Only delete messages from bots").setRequired(false)
    )
    .addBooleanOption((option) =>
      option.setName("humans").setDescription("Only delete messages from humans").setRequired(false)
    )
    .addBooleanOption((option) =>
      option.setName("embeds").setDescription("Only delete messages with embeds").setRequired(false)
    )
    .addBooleanOption((option) =>
      option.setName("attachments").setDescription("Only delete messages with attachments").setRequired(false)
    )
    .addBooleanOption((option) =>
      option.setName("confirm").setDescription("Skip confirmation prompt (use with caution)").setRequired(false)
    )
    .addStringOption((option) => option.setName("reason").setDescription("Reason for purging").setRequired(false)),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild || !interaction.channel) return;

    // Check if channel is text-based
    if (!interaction.channel.isTextBased()) {
      await interaction.reply({
        content: "❌ This command can only be used in text channels.",
        ephemeral: true,
      });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user");
    const contains = interaction.options.getString("contains");
    const botsOnly = interaction.options.getBoolean("bots");
    const humansOnly = interaction.options.getBoolean("humans");
    const embedsOnly = interaction.options.getBoolean("embeds");
    const attachmentsOnly = interaction.options.getBoolean("attachments");
    const skipConfirm = interaction.options.getBoolean("confirm") ?? false;
    let reason = interaction.options.getString("reason") ?? "No reason provided";

    try {
      // Check if reason is an alias and expand it
      if (reason !== "No reason provided") {
        const aliasName = reason.toUpperCase();
        const alias = await prisma.alias.findUnique({
          where: { guildId_name: { guildId: interaction.guild.id, name: aliasName } },
        });

        if (alias) {
          // Expand alias content with variables
          reason = alias.content;
          reason = reason.replace(/\{user\}/g, targetUser ? `<@${targetUser.id}>` : "N/A");
          reason = reason.replace(/\{server\}/g, interaction.guild.name);
          reason = reason.replace(/\{moderator\}/g, `<@${interaction.user.id}>`);

          // Update usage count
          await prisma.alias.update({
            where: { id: alias.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      // Validation: conflicting filters
      if (botsOnly && humansOnly) {
        await interaction.reply({
          content: "❌ Cannot filter for both bots and humans only.",
          ephemeral: true,
        });
        return;
      }

      // Fetch messages
      const messages = await interaction.channel.messages.fetch({ limit: Math.min(amount, 100) });
      let messagesToDelete = Array.from(messages.values());

      // Apply filters
      if (targetUser) {
        messagesToDelete = messagesToDelete.filter((msg) => msg.author.id === targetUser.id);
      }

      if (contains) {
        const searchTerm = contains.toLowerCase();
        messagesToDelete = messagesToDelete.filter((msg) => msg.content.toLowerCase().includes(searchTerm));
      }

      if (botsOnly) {
        messagesToDelete = messagesToDelete.filter((msg) => msg.author.bot);
      }

      if (humansOnly) {
        messagesToDelete = messagesToDelete.filter((msg) => !msg.author.bot);
      }

      if (embedsOnly) {
        messagesToDelete = messagesToDelete.filter((msg) => msg.embeds.length > 0);
      }

      if (attachmentsOnly) {
        messagesToDelete = messagesToDelete.filter((msg) => msg.attachments.size > 0);
      }

      // Filter out messages older than 14 days (Discord limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messagesToDelete = messagesToDelete.filter((msg) => msg.createdTimestamp > twoWeeksAgo);

      if (messagesToDelete.length === 0) {
        await interaction.reply({
          content: "❌ No messages found matching the specified criteria.",
          ephemeral: true,
        });
        return;
      }

      // Safety check: large purge confirmation
      if (messagesToDelete.length > 50 && !skipConfirm) {
        await interaction.reply({
          content: `⚠️ **WARNING**: You are about to delete **${messagesToDelete.length} messages**.\n\nThis action cannot be undone. Run the command again with \`confirm:True\` to proceed.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Store information before deletion for logging
      const deletedInfo = messagesToDelete.map((msg) => ({
        id: msg.id,
        author: msg.author.tag,
        authorId: msg.author.id,
        content: msg.content.substring(0, 500), // Limit content length
        createdAt: msg.createdAt,
        attachments: msg.attachments.map((att) => att.url),
        embeds: msg.embeds.length,
      }));

      // Perform bulk delete
      let deletedCount = 0;
      const bulkDeletable = messagesToDelete.filter(
        (msg) => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
      );

      if (bulkDeletable.length > 0) {
        // Use bulk delete for eligible messages
        const chunks = chunkArray(bulkDeletable, 100); // Discord limit is 100 per bulk delete

        for (const chunk of chunks) {
          if (chunk.length === 1) {
            await chunk[0].delete();
          } else {
            await interaction.channel.bulkDelete(chunk);
          }
          deletedCount += chunk.length;
        }
      }

      // Log the purge action
      await client.logManager.log(interaction.guild.id, "MESSAGE_BULK_DELETE", {
        channelId: interaction.channel.id,
        executorId: interaction.user.id,
        reason,
        metadata: {
          deletedCount,
          filters: {
            user: targetUser?.tag,
            contains,
            botsOnly,
            humansOnly,
            embedsOnly,
            attachmentsOnly,
          },
          deletedMessages: deletedInfo.slice(0, 10), // Only log first 10 for space
        },
      });

      // Create summary embed
      const embed = client.genEmbed({
        title: "🗑️ Messages Purged",
        color: 0xe74c3c,
        fields: [
          { name: "📊 Count", value: deletedCount.toString(), inline: true },
          { name: "👤 Moderator", value: interaction.user.tag, inline: true },
          { name: "📝 Reason", value: reason, inline: false },
        ],
        timestamp: new Date(),
      });

      // Add filter information
      const filters: string[] = [];
      if (targetUser) filters.push(`User: ${targetUser.tag}`);
      if (contains) filters.push(`Contains: "${contains}"`);
      if (botsOnly) filters.push("Bots only");
      if (humansOnly) filters.push("Humans only");
      if (embedsOnly) filters.push("Embeds only");
      if (attachmentsOnly) filters.push("Attachments only");

      if (filters.length > 0) {
        embed.addFields({ name: "🔍 Filters Applied", value: filters.join("\n"), inline: false });
      }

      await interaction.editReply({ embeds: [embed] });

      // Send summary to channel (auto-delete after 10 seconds)
      const summaryMessage = await interaction.channel.send({
        content: `🗑️ **${deletedCount} messages** deleted by ${interaction.user} - ${reason}`,
      });

      setTimeout(() => {
        summaryMessage.delete().catch(() => {
          // Ignore deletion errors (message may already be deleted)
        });
      }, 10000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await interaction.editReply({
        content: `❌ Failed to purge messages: ${errorMessage}`,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.MODERATOR,
      isConfigurable: true,
      discordPermissions: [PermissionFlagsBits.ManageMessages],
    },
  }
);

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
