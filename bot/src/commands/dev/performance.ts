import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { performanceMonitor } from "../../services/performanceMonitor.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("performance")
  .setDescription("View bot performance metrics")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Type of performance data to view")
      .setRequired(false)
      .addChoices(
        { name: "Overview", value: "overview" },
        { name: "Event Summary", value: "events" },
        { name: "Slow Events", value: "slow" },
        { name: "Real-time Stats", value: "realtime" }
      )
  );

class PerformanceCommand extends DevCommand {
  constructor() {
    const config: CommandConfig = {
      name: "performance",
      description: "View bot performance metrics",
      category: "dev",
      ephemeral: true,
      guildOnly: false,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    this.validateDevPermissions();

    if (!this.isSlashCommand()) {
      throw new Error("This command must be run as a slash command.");
    }

    const slash = this.interaction as any;
    const type = slash.options.getString("type") || "overview";

    switch (type) {
      case "overview":
        return await this.showOverview();
      case "events":
        return await this.showEventSummary();
      case "slow":
        return await this.showSlowEvents();
      case "realtime":
        return await this.showRealTimeStats();
      default:
        throw new Error("Unknown performance type");
    }
  }

  private async showOverview(): Promise<CommandResponse> {
    const summary = performanceMonitor.getOverallSummary();
    const realTimeStats = performanceMonitor.getRealTimeStats();

    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Performance Overview")
      .setColor(0x00ff00)
      .setTimestamp()
      .addFields(
        {
          name: "📊 Overall Stats",
          value: `**Total Events:** ${realTimeStats.totalEvents}\n**Average Time:** ${Math.round(realTimeStats.averageProcessingTime)}ms\n**Slow Events:** ${realTimeStats.slowEvents} (${Math.round(realTimeStats.slowEventPercentage)}%)`,
          inline: false,
        },
        {
          name: "📈 Top Event Types",
          value:
            summary
              .slice(0, 5)
              .map((s) => `**${s.eventType}:** ${s.totalEvents} events, ${Math.round(s.averageProcessingTime)}ms avg`)
              .join("\n") || "No events recorded",
          inline: false,
        }
      );

    return { embeds: [embed], ephemeral: true };
  }

  private async showEventSummary(): Promise<CommandResponse> {
    const summary = performanceMonitor.getOverallSummary();

    if (summary.length === 0) {
      return { content: "No performance data available.", ephemeral: true };
    }

    const embed = new EmbedBuilder().setTitle("📊 Event Performance Summary").setColor(0x0099ff).setTimestamp();

    // Create fields for each event type
    const fields = summary.slice(0, 10).map((s) => ({
      name: `📝 ${s.eventType}`,
      value: `**Events:** ${s.totalEvents}\n**Avg Time:** ${Math.round(s.averageProcessingTime)}ms\n**Slow:** ${s.slowEvents} (${Math.round(s.slowEventPercentage)}%)\n**Last:** <t:${Math.floor(s.lastEventTime / 1000)}:R>`,
      inline: true,
    }));

    embed.addFields(fields);

    return { embeds: [embed], ephemeral: true };
  }

  private async showSlowEvents(): Promise<CommandResponse> {
    const slowEvents = performanceMonitor.getSlowestEvents(10);

    if (slowEvents.length === 0) {
      return { content: "No slow events detected.", ephemeral: true };
    }

    const embed = new EmbedBuilder().setTitle("⚠️ Slow Events Detected").setColor(0xff0000).setTimestamp();

    const fields = slowEvents.map((event, index) => ({
      name: `${index + 1}. ${event.eventType}`,
      value: `**Time:** ${event.processingTime}ms\n**Guild:** ${event.guildId || "N/A"}\n**User:** ${event.userId || "N/A"}\n**Time:** <t:${Math.floor(event.timestamp / 1000)}:R>`,
      inline: true,
    }));

    embed.addFields(fields);

    return { embeds: [embed], ephemeral: true };
  }

  private async showRealTimeStats(): Promise<CommandResponse> {
    const stats = performanceMonitor.getRealTimeStats();
    const slowEvents = performanceMonitor.getSlowestEvents(5);

    const embed = new EmbedBuilder()
      .setTitle("⚡ Real-time Performance Stats")
      .setColor(0x00ff00)
      .setTimestamp()
      .addFields({
        name: "📊 Current Stats",
        value: `**Total Events:** ${stats.totalEvents}\n**Average Time:** ${Math.round(stats.averageProcessingTime)}ms\n**Slow Events:** ${stats.slowEvents}\n**Slow Percentage:** ${Math.round(stats.slowEventPercentage)}%`,
        inline: false,
      });

    if (slowEvents.length > 0) {
      embed.addFields({
        name: "🐌 Recent Slow Events",
        value: slowEvents.map((event) => `**${event.eventType}:** ${event.processingTime}ms`).join("\n"),
        inline: false,
      });
    }

    return { embeds: [embed], ephemeral: true };
  }
}

export default new PerformanceCommand();
