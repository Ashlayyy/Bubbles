import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { batchOperationManager } from "../../services/batchOperationManager.js";
import { cacheService } from "../../services/cacheService.js";
import type Client from "../../structures/Client.js";
import Command, {
  type GuildChatInputCommandInteraction,
  type GuildMessageContextMenuCommandInteraction,
} from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
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
    .addSubcommand((sub) => sub.setName("flush").setDescription("Force flush all batch operations")),

  async (client: Client, interaction: GuildChatInputCommandInteraction | GuildMessageContextMenuCommandInteraction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) {
      await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({ ephemeral: true });

    try {
      switch (subcommand) {
        case "stats":
          await handleStats(interaction);
          break;
        case "clear":
          await handleClear(interaction);
          break;
        case "warmup":
          await handleWarmup(client, interaction);
          break;
        case "batch":
          await handleBatchStats(interaction);
          break;
        case "flush":
          await handleFlush(interaction);
          break;
      }
    } catch (error) {
      console.error("Error in cache command:", error);
      await interaction.editReply({
        content: "❌ An error occurred while executing the cache command.",
      });
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.DEVELOPER,
    },
  }
);

async function handleStats(interaction: GuildChatInputCommandInteraction): Promise<void> {
  const stats = cacheService.getStats();

  // Calculate performance metrics
  const efficiency = stats.hitRate;
  const efficiencyColor = efficiency >= 80 ? "🟢" : efficiency >= 60 ? "🟡" : "🔴";
  const efficiencyStatus = efficiency >= 80 ? "Excellent" : efficiency >= 60 ? "Good" : "Needs Improvement";

  const embed = new EmbedBuilder()
    .setColor(efficiency >= 80 ? 0x2ecc71 : efficiency >= 60 ? 0xf39c12 : 0xe74c3c)
    .setTitle("🚀 Cache Performance Statistics")
    .setDescription(`${efficiencyColor} **Cache Status:** ${efficiencyStatus}`)
    .addFields(
      {
        name: "📊 Hit/Miss Statistics",
        value:
          `**Total Hits:** ${stats.totalHits.toLocaleString()}\n` +
          `**Total Misses:** ${stats.totalMisses.toLocaleString()}\n` +
          `**Hit Rate:** ${stats.hitRate.toFixed(2)}%`,
        inline: true,
      },
      {
        name: "💾 Memory Usage",
        value:
          `**Memory Entries:** ${stats.memoryEntries.toLocaleString()}\n` +
          `**Redis Connected:** ${stats.redisConnected ? "✅ Yes" : "❌ No"}`,
        inline: true,
      },
      {
        name: "⚡ Performance Impact",
        value:
          `**DB Queries Avoided:** ${stats.totalHits.toLocaleString()}\n` +
          `**Estimated Time Saved:** ${(stats.totalHits * 0.05).toFixed(2)}s\n` +
          `**Load Reduction:** ${stats.hitRate.toFixed(1)}%`,
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: "Cache statistics reset on bot restart" });

  // Add performance recommendations
  if (stats.hitRate < 60) {
    embed.addFields({
      name: "💡 Recommendations",
      value:
        "• Consider increasing cache TTL values\n" +
        "• Check if cache keys are being invalidated too frequently\n" +
        "• Review query patterns for optimization opportunities",
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleClear(interaction: GuildChatInputCommandInteraction): Promise<void> {
  const pattern = interaction.options.getString("pattern");

  try {
    if (pattern) {
      await cacheService.deletePattern(pattern);

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle("🧹 Cache Pattern Cleared")
        .setDescription(`Successfully cleared cache entries matching pattern: \`${pattern}\``)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
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

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
    await interaction.editReply({
      content: "❌ Failed to clear cache. Check logs for details.",
    });
  }
}

async function handleWarmup(client: Client, interaction: GuildChatInputCommandInteraction): Promise<void> {
  try {
    // Get list of guilds the bot is in
    const guildIds = client.guilds.cache.map((guild) => guild.id);

    if (guildIds.length === 0) {
      await interaction.editReply({
        content: "❌ No guilds found to warm up cache for.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🔥 Cache Warmup Started")
      .setDescription(`Starting cache warmup for ${guildIds.length} guilds...`)
      .addFields({
        name: "📋 Process",
        value: "• Loading guild configurations\n• Caching frequently accessed data\n• Pre-loading moderation settings",
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Start warmup process
    await cacheService.warmup(guildIds);

    const completedEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Cache Warmup Completed")
      .setDescription(`Successfully warmed up cache for ${guildIds.length} guilds.`)
      .addFields({
        name: "🚀 Performance Impact",
        value: "• Faster command responses\n• Reduced database load\n• Improved user experience",
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [completedEmbed] });
  } catch (error) {
    console.error("Error during cache warmup:", error);
    await interaction.editReply({
      content: "❌ Cache warmup failed. Check logs for details.",
    });
  }
}

async function handleBatchStats(interaction: GuildChatInputCommandInteraction): Promise<void> {
  const stats = batchOperationManager.getStats();

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("📦 Batch Operation Statistics")
    .setDescription("Current status of batch database operations")
    .addFields({
      name: "🗃️ Moderation Logs",
      value:
        `**Pending:** ${stats.moderationLogs.pending}\n` +
        `**Batch Size:** ${stats.moderationLogs.flushSize}\n` +
        `**Flush Interval:** ${stats.moderationLogs.flushInterval / 1000}s\n` +
        `**Last Flush:** <t:${Math.floor(stats.moderationLogs.lastFlush / 1000)}:R>`,
      inline: false,
    })
    .setTimestamp();

  // Add warning if too many pending operations
  if (stats.moderationLogs.pending > 100) {
    embed.addFields({
      name: "⚠️ Warning",
      value: `High number of pending operations (${stats.moderationLogs.pending}). Consider manual flush.`,
      inline: false,
    });
    embed.setColor(0xf39c12);
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleFlush(interaction: GuildChatInputCommandInteraction): Promise<void> {
  try {
    await batchOperationManager.forceFlushAll();

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("💾 Batch Operations Flushed")
      .setDescription("Successfully flushed all pending batch operations to database.")
      .addFields({
        name: "✅ Completed",
        value: "• Moderation logs written to database\n• Batch queues cleared\n• Performance optimized",
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error flushing batch operations:", error);
    await interaction.editReply({
      content: "❌ Failed to flush batch operations. Check logs for details.",
    });
  }
}
