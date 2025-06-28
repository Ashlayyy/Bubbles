import type { GuildTextBasedChannel } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, ResponseBuilder, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Purge Command - Delete multiple messages at once
 */
export class PurgeCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "purge",
      description: "Delete multiple messages at once",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
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

    if (!this.interaction.channel?.isTextBased()) {
      return new ResponseBuilder()
        .error("Channel Error")
        .content("This command can only be used in text channels.")
        .ephemeral()
        .build();
    }

    const amount = this.getIntegerOption("amount", true);
    const targetUser = this.getUserOption("user");
    const contains = this.getStringOption("contains");
    const botsOnly = this.getBooleanOption("bots");
    const humansOnly = this.getBooleanOption("humans");
    const embedsOnly = this.getBooleanOption("embeds");
    const attachmentsOnly = this.getBooleanOption("attachments");
    const skipConfirm = this.getBooleanOption("confirm") ?? false;
    const reasonInput = this.getStringOption("reason") ?? "No reason provided";

    try {
      // Validation: conflicting filters
      if (botsOnly && humansOnly) {
        return new ResponseBuilder()
          .error("Filter Conflict")
          .content("Cannot filter for both bots and humans only.")
          .ephemeral()
          .build();
      }

      // Expand alias if needed - handle nullable targetUser
      const reason = targetUser
        ? await expandAlias(reasonInput, {
            guild: this.guild,
            user: targetUser,
            moderator: this.user,
          })
        : await expandAlias(reasonInput, {
            guild: this.guild,
            user: this.user, // Use moderator as fallback when no target user
            moderator: this.user,
          });

      // Fetch messages - ensure we have a guild text channel
      const channel = this.interaction.channel as GuildTextBasedChannel;
      const messages = await channel.messages.fetch({ limit: Math.min(amount, 100) });
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
        return this.createModerationError(
          "purge",
          this.user, // Use moderator as target since no specific user
          `❌ No messages found matching the specified criteria.\n\n` +
            `💡 **Tips:**\n` +
            `• Try adjusting your filters\n` +
            `• Check if messages are older than 14 days (Discord limitation)\n` +
            `• Ensure the target user has sent messages recently\n\n` +
            `📖 **Examples:**\n` +
            `• \`/purge amount:10\` - Delete last 10 messages\n` +
            `• \`/purge amount:50 user:@username\` - Delete last 50 messages from user`
        );
      }

      // Safety check: large purge confirmation
      if (messagesToDelete.length > 50 && !skipConfirm) {
        return new ResponseBuilder()
          .error("Confirmation Required")
          .content(
            `⚠️ **WARNING**: You are about to delete **${messagesToDelete.length} messages**.\n\n` +
              `**This action cannot be undone!**\n\n` +
              `💡 **To proceed:** Run the command again with \`confirm:True\`\n` +
              `🛡️ **Safety tip:** Consider using smaller batches for better control.`
          )
          .ephemeral()
          .build();
      }

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
            await channel.bulkDelete(chunk);
          }
          deletedCount += chunk.length;
        }
      }

      // Log the purge action
      await this.client.logManager.log(this.guild.id, "MESSAGE_BULK_DELETE", {
        channelId: channel.id,
        executorId: this.user.id,
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
      const embed = this.client.genEmbed({
        title: "🧹 Purge Complete",
        color: 0x00ff00,
        fields: [
          {
            name: "📊 Summary",
            value: [
              `**Messages Deleted:** ${deletedCount}`,
              `**Channel:** <#${channel.id}>`,
              `**Moderator:** ${this.user}`,
              `**Reason:** ${reason}`,
            ].join("\n"),
            inline: false,
          },
        ],
        timestamp: new Date(),
      });

      // Add filter information if any were used
      const activeFilters: string[] = [];
      if (targetUser) activeFilters.push(`User: ${targetUser.tag}`);
      if (contains) activeFilters.push(`Contains: "${contains}"`);
      if (botsOnly) activeFilters.push("Bots only");
      if (humansOnly) activeFilters.push("Humans only");
      if (embedsOnly) activeFilters.push("Embeds only");
      if (attachmentsOnly) activeFilters.push("Attachments only");

      if (activeFilters.length > 0) {
        embed.addFields({
          name: "🔍 Filters Applied",
          value: activeFilters.join("\n"),
          inline: true,
        });
      }

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      return this.createModerationError(
        "purge",
        this.user, // Use moderator as target since no specific user
        `${error instanceof Error ? error.message : "Unknown error"}\n\n` +
          `💡 **Common solutions:**\n` +
          `• Check if you have manage messages permission\n` +
          `• Verify the bot has delete messages permission\n` +
          `• Ensure messages aren't older than 14 days\n` +
          `• Try purging smaller amounts at once\n\n` +
          `📖 **Need help?** Contact an administrator.`
      );
    }
  }
}

// Export the command instance
export default new PurgeCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
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
  .addStringOption((option) => option.setName("reason").setDescription("Reason for purging").setRequired(false));

// Utility function to chunk arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
