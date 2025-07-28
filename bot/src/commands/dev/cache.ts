import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { batchOperationManager } from "../../services/batchOperationManager.js";
import { cacheService } from "../../services/cacheService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";
import type { SlashCommandInteraction } from "../_core/types.js";

class CacheCommand extends DevCommand {
  constructor() {
    const config: CommandConfig = {
      name: "cache",
      description: "🚀 Monitor and manage the caching system",
      category: "dev",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    this.validateDevPermissions();

    if (!this.isSlashCommand()) {
      throw new Error("This command must be run as a slash command.");
    }

    const slash = this.interaction as SlashCommandInteraction;
    const sub = slash.options.getSubcommand();

    switch (sub) {
      case "stats":
        return this.handleStats();
      case "clear":
        return await this.handleClear();
      case "warmup":
        return await this.handleWarmup();
      case "batch":
        return this.handleBatchStats();
      case "flush":
        return await this.handleFlush();
      default:
        throw new Error("Unknown subcommand");
    }
  }

  private buildEmbed(color: number, title: string, description: string): EmbedBuilder {
    return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
  }

  private async handleStats(): Promise<CommandResponse> {
    const stats = await cacheService.getStats();

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🚀 Cache Performance Statistics")
      .setDescription("📊 **Redis-backed Cache Status:** Active")
      .addFields(
        {
          name: "💾 Cache Storage",
          value:
            `**Total Keys:** ${stats.totalKeys.toLocaleString()}\n` +
            `**Memory Usage:** ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
          inline: true,
        },
        {
          name: "⚡ Performance Impact",
          value: `**Cache Type:** Redis (Persistent)\n` + `**Process Shared:** Yes\n` + `**TTL Support:** Yes`,
          inline: true,
        },
        {
          name: "🔧 Cache Features",
          value:
            "• JSON serialization\n" +
            "• Automatic TTL management\n" +
            "• Pattern-based invalidation\n" +
            "• Cross-process sharing",
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({ text: "Redis cache - persistent across restarts" });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleClear(): Promise<CommandResponse> {
    const slash = this.interaction as SlashCommandInteraction;
    const pattern = slash.options.getString("pattern");

    try {
      if (pattern) {
        await cacheService.invalidatePattern(pattern);

        const embed = this.buildEmbed(
          0xf39c12,
          "🧹 Cache Pattern Cleared",
          `Successfully cleared cache entries matching pattern: \`${pattern}\``
        );

        return { embeds: [embed], ephemeral: true };
      } else {
        await cacheService.clear();

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🧹 All Caches Cleared")
          .setDescription("Successfully cleared all cache entries. Performance may be slower until cache rebuilds.")
          .addFields({
            name: "⚠️ Warning",
            value: "Cache will rebuild automatically as data is accessed. Expect temporary performance impact.",
            inline: false,
          })
          .setTimestamp();

        return { embeds: [embed], ephemeral: true };
      }
    } catch (error) {
      return this.createDevError("Failed to clear cache", String(error));
    }
  }

  private async handleWarmup(): Promise<CommandResponse> {
    const guildIds = this.client.guilds.cache.map((g) => g.id);

    if (guildIds.length === 0) {
      return this.createDevError("No guilds", "❌ No guilds found to warm up cache for.");
    }

    const startEmbed = this.buildEmbed(
      0x3498db,
      "🔥 Cache Warmup Started",
      `Starting cache warmup for ${String(guildIds.length)} guilds...`
    ).addFields({
      name: "📋 Process",
      value: "• Loading guild configurations\n• Caching frequently accessed data\n• Pre-loading moderation settings",
      inline: false,
    });

    // Send initial embed (auto-deferred already) via follow-up in BaseCommand? to simplify we only return final embed after warmup.

    // Warm up cache for each guild
    for (const guildId of guildIds) {
      await cacheService.warmUp(guildId);
    }

    await Promise.resolve();

    const completedEmbed = this.buildEmbed(
      0x2ecc71,
      "✅ Cache Warmup Completed",
      `Successfully warmed up cache for ${String(guildIds.length)} guilds.`
    ).addFields({
      name: "🚀 Performance Impact",
      value: "• Faster command responses\n• Reduced database load\n• Improved user experience",
      inline: false,
    });

    return { embeds: [startEmbed, completedEmbed], ephemeral: true };
  }

  private handleBatchStats(): CommandResponse {
    const stats = batchOperationManager.getStats();

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle("📦 Batch Operation Statistics")
      .setDescription("Current status of batch database operations")
      .addFields({
        name: "🗃️ Moderation Logs",
        value:
          `**Pending:** ${String(stats.moderationLogs.pending)}\n` +
          `**Batch Size:** ${String(stats.moderationLogs.flushSize)}\n` +
          `**Flush Interval:** ${String(stats.moderationLogs.flushInterval / 1000)}s\n` +
          `**Last Flush:** <t:${String(Math.floor(stats.moderationLogs.lastFlush / 1000))}:R>`,
        inline: false,
      })
      .setTimestamp();

    if (stats.moderationLogs.pending > 100) {
      embed.addFields({
        name: "⚠️ Warning",
        value: `High number of pending operations (${String(stats.moderationLogs.pending)}). Consider manual flush.`,
        inline: false,
      });
      embed.setColor(0xf39c12);
    }

    return { embeds: [embed], ephemeral: true };
  }

  private async handleFlush(): Promise<CommandResponse> {
    try {
      await batchOperationManager.forceFlushAll();

      const embed = this.buildEmbed(
        0x2ecc71,
        "💾 Batch Operations Flushed",
        "Successfully flushed all pending batch operations to database."
      ).addFields({
        name: "✅ Completed",
        value: "• Moderation logs written to database\n• Batch queues cleared\n• Performance optimized",
        inline: false,
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      return this.createDevError("Failed to flush batch operations", String(error));
    }
  }
}

export default new CacheCommand();

export const builder = new SlashCommandBuilder()
  .setName("cache")
  .setDescription("🚀 Monitor and manage the caching system")
  .addSubcommand((sub) => sub.setName("stats").setDescription("View cache performance statistics"))
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Clear all caches")
      .addStringOption((opt) =>
        opt.setName("pattern").setDescription("Optional pattern to clear specific cache keys").setRequired(false)
      )
  )
  .addSubcommand((sub) => sub.setName("warmup").setDescription("Warm up cache for active guilds"))
  .addSubcommand((sub) => sub.setName("batch").setDescription("View batch operation statistics"))
  .addSubcommand((sub) => sub.setName("flush").setDescription("Force flush all batch operations"));
