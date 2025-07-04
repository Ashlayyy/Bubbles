import type { GuildTextBasedChannel, Message } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import {
  expandAlias,
  parseDuration,
  ResponseBuilder,
  type CommandConfig,
  type CommandResponse,
} from "../_core/index.js";
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
    const usersInput = this.getStringOption("users");
    const listAttachment = this.getAttachmentOption("list");
    const contains = this.getStringOption("contains");
    const botsOnly = this.getBooleanOption("bots");
    const humansOnly = this.getBooleanOption("humans");
    const embedsOnly = this.getBooleanOption("embeds");
    const attachmentsOnly = this.getBooleanOption("attachments");
    const skipConfirm = this.getBooleanOption("confirm") ?? false;
    const reasonInput = this.getStringOption("reason") ?? "No reason provided";

    // New advanced filters
    const regexPattern = this.getStringOption("regex");
    const beforeStr = this.getStringOption("before");
    const afterStr = this.getStringOption("after");
    const linksOnly = this.getBooleanOption("links");
    const attachmentType = this.getStringOption("atype"); // image|video|audio|file

    try {
      // Validation: conflicting filters
      if (botsOnly && humansOnly) {
        return new ResponseBuilder()
          .error("Filter Conflict")
          .content("Cannot filter for both bots and humans only.")
          .ephemeral()
          .build();
      }

      if (regexPattern) {
        try {
          // Validate regex at parse time

          new RegExp(regexPattern, "i");
        } catch (err) {
          return new ResponseBuilder()
            .error("Invalid Regex", `The provided regex pattern is invalid: ${(err as Error).message}`)
            .ephemeral()
            .build();
        }
      }

      // Build array of filter user IDs
      const filterIds = new Set<string>();
      if (targetUser) filterIds.add(targetUser.id);
      if (usersInput) {
        usersInput
          .split(/[\s,]+/)
          .map((id) => id.trim())
          .filter((id) => /^\d{17,20}$/.test(id))
          .forEach((id) => filterIds.add(id));
      }

      if (listAttachment) {
        const contentType = listAttachment.contentType ?? "";
        const fileName = listAttachment.name;
        const isTxtOrCsv = /text\/(plain|csv)/i.test(contentType) || /\.(txt|csv)$/i.test(fileName);

        if (!isTxtOrCsv) {
          return new ResponseBuilder()
            .error("Unsupported File", "Only .txt/.csv attachments allowed for users list.")
            .ephemeral()
            .build();
        }

        try {
          const txt = await (await fetch(listAttachment.url)).text();
          txt
            .split(/[\s,\n]+/)
            .map((id) => id.trim())
            .filter((id) => /^\d{17,20}$/.test(id))
            .forEach((id) => filterIds.add(id));
        } catch {
          return new ResponseBuilder()
            .error("Download Failed", "Could not read attachment for users list.")
            .ephemeral()
            .build();
        }
      }

      // Expand alias with moderator context (can't reliably target multiple)
      const reason = await expandAlias(reasonInput, {
        guild: this.guild,
        user: this.user,
        moderator: this.user,
      });

      // Fetch messages - ensure we have a guild text channel
      const channel = this.interaction.channel as GuildTextBasedChannel;
      const fetched = new Map<string, Message>();
      let lastId: string | undefined;
      while (fetched.size < amount) {
        const remaining = amount - fetched.size;
        const batch = await channel.messages.fetch({ limit: Math.min(remaining, 100), before: lastId });
        if (batch.size === 0) break;
        batch.forEach((m) => fetched.set(m.id, m));
        lastId = Array.from(batch.values()).pop()?.id;
        if (!lastId) break;
      }

      let messagesToDelete = Array.from(fetched.values());

      // Apply filters
      if (filterIds.size > 0) {
        messagesToDelete = messagesToDelete.filter((msg) => filterIds.has(msg.author.id));
      }

      if (contains) {
        const searchTerm = contains.toLowerCase();
        messagesToDelete = messagesToDelete.filter((msg) => msg.content.toLowerCase().includes(searchTerm));
      }

      if (regexPattern) {
        const pattern = new RegExp(regexPattern, "i");
        messagesToDelete = messagesToDelete.filter((msg) => pattern.test(msg.content));
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

      if (linksOnly) {
        const linkRegex = /(https?:\/\/\S+)/i;
        messagesToDelete = messagesToDelete.filter((msg) => linkRegex.test(msg.content));
      }

      if (attachmentType) {
        const type = attachmentType;
        messagesToDelete = messagesToDelete.filter((msg) => {
          if (msg.attachments.size === 0) return false;
          return Array.from(msg.attachments.values()).some((att) => {
            const ct = att.contentType ?? "";
            const url = att.url.toLowerCase();
            switch (type) {
              case "image":
                return ct.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(url);
              case "video":
                return ct.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(url);
              case "audio":
                return ct.startsWith("audio/") || /\.(mp3|wav|flac|ogg|m4a)$/i.test(url);
              case "file":
                // Any attachment – fallback true
                return true;
              default:
                return false;
            }
          });
        });
      }

      // Filter out messages older than 14 days (Discord limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messagesToDelete = messagesToDelete.filter((msg) => msg.createdTimestamp > twoWeeksAgo);

      // Helper to parse date or relative duration (returns ms timestamp)
      const parseDateOrDuration = (input: string): number | null => {
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
          const ts = Date.parse(`${input}T00:00:00Z`);
          return Number.isNaN(ts) ? null : ts;
        }

        const durationSec = parseDuration(input);
        if (durationSec !== null) {
          return Date.now() - durationSec * 1000;
        }

        return null;
      };

      const beforeTs = beforeStr ? parseDateOrDuration(beforeStr) : null;
      const afterTs = afterStr ? parseDateOrDuration(afterStr) : null;

      // Date filters (must come after others to avoid extra parsing)
      if (beforeTs !== null) {
        messagesToDelete = messagesToDelete.filter((msg) => msg.createdTimestamp <= beforeTs);
      }

      if (afterTs !== null) {
        messagesToDelete = messagesToDelete.filter((msg) => msg.createdTimestamp >= afterTs);
      }

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
            usersInput,
            userCount: filterIds.size,
            contains,
            botsOnly,
            humansOnly,
            embedsOnly,
            attachmentsOnly,
            regexPattern,
            beforeStr,
            afterStr,
            linksOnly,
            attachmentType,
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
      if (usersInput) activeFilters.push("Users list provided");
      if (contains) activeFilters.push(`Contains: "${contains}"`);
      if (botsOnly) activeFilters.push("Bots only");
      if (humansOnly) activeFilters.push("Humans only");
      if (embedsOnly) activeFilters.push("Embeds only");
      if (attachmentsOnly) activeFilters.push("Attachments only");
      if (regexPattern) activeFilters.push(`Regex: \\${regexPattern}\\`);
      if (beforeStr) activeFilters.push(`Before: ${beforeStr}`);
      if (afterStr) activeFilters.push(`After: ${afterStr}`);
      if (linksOnly) activeFilters.push("Links only");
      if (attachmentType) activeFilters.push(`Attachments: ${attachmentType}`);

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
      .setDescription("Number of messages to delete (1-10000)")
      .setMinValue(1)
      .setMaxValue(10000)
      .setRequired(true)
  )
  .addUserOption((option) =>
    option.setName("user").setDescription("Only delete messages from this user").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("users").setDescription("User IDs separated by space/comma/newline").setRequired(false)
  )
  .addAttachmentOption((opt) =>
    opt.setName("list").setDescription("Attachment (.txt/.csv) with user IDs").setRequired(false)
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
  .addStringOption((option) => option.setName("reason").setDescription("Reason for purging").setRequired(false))
  .addStringOption((opt) =>
    opt.setName("regex").setDescription("Regex pattern to match message content").setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("before")
      .setDescription("Delete messages before date (YYYY-MM-DD) or duration ago (e.g., 7d)")
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("after").setDescription("Delete messages after date (YYYY-MM-DD) or duration ago").setRequired(false)
  )
  .addBooleanOption((opt) => opt.setName("links").setDescription("Only messages containing links").setRequired(false))
  .addStringOption((opt) =>
    opt
      .setName("atype")
      .setDescription("Attachment type filter")
      .addChoices(
        { name: "image", value: "image" },
        { name: "video", value: "video" },
        { name: "audio", value: "audio" },
        { name: "file", value: "file" }
      )
      .setRequired(false)
  );

// Utility function to chunk arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
