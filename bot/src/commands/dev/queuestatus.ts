import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

class QueueStatusCommand extends DevCommand {
  constructor() {
    const config: CommandConfig = {
      name: "queue-status",
      description: "[DEV] Check the status of the queue system",
      category: "dev",
      ephemeral: true,
      guildOnly: false,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    this.validateDevPermissions();

    const queueService = this.client.queueService;

    if (!queueService) {
      const embed = new EmbedBuilder()
        .setTitle("🔧 Queue System Status")
        .setColor("Red")
        .setDescription("❌ **Queue service not initialized**\nThe unified queue service is not available.")
        .addFields({ name: "Status", value: "❌ Not Running", inline: true })
        .setTimestamp();

      return { embeds: [embed], ephemeral: true };
    }

    const isReady = queueService.isReady();
    const health = await queueService.getHealth();
    const metrics = queueService.getMetrics();

    const embed = new EmbedBuilder()
      .setTitle("🔧 Unified Queue System Status")
      .setColor(isReady ? "Green" : "Orange")
      .addFields(
        { name: "Queue Service", value: isReady ? "✅ Ready" : "❌ Not Ready", inline: true },
        {
          name: "WebSocket Protocol",
          value: health.protocols.websocket.healthy ? "✅ Healthy" : "❌ Unhealthy",
          inline: true,
        },
        {
          name: "Queue Protocol",
          value: health.protocols.queue.healthy ? "✅ Healthy" : "❌ Unhealthy",
          inline: true,
        },
        {
          name: "System Metrics",
          value: [
            `**REST Requests:** ${metrics.restRequests}`,
            `**WebSocket Messages:** ${metrics.websocketMessages}`,
            `**Queue Jobs:** ${metrics.queueJobs}`,
            `**Duplicate Operations:** ${metrics.duplicateOperations}`,
            `**Protocol Failures:** ${metrics.totalProtocolFailures}`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "Cross-Protocol Performance",
          value: [
            `**REST→WebSocket Delay:** ${metrics.restToWebSocketDelay.toFixed(2)}ms`,
            `**Queue→WebSocket Delay:** ${metrics.queueToWebSocketDelay.toFixed(2)}ms`,
            `**WebSocket Fallbacks:** ${metrics.websocketFallbackToQueue}`,
            `**Queue Fallbacks:** ${metrics.queueFallbackToWebSocket}`,
          ].join("\n"),
          inline: false,
        }
      )
      .setFooter({ text: "Unified system handles cross-protocol request routing" })
      .setTimestamp();

    if (!isReady) {
      embed.setDescription(
        "⚠️ **Queue system not ready**\nThe unified processor may still be initializing or experiencing issues."
      );
    } else {
      embed.setDescription("✅ Unified queue system is operating normally with multi-protocol support.");
    }

    return { embeds: [embed], ephemeral: true };
  }
}

export default new QueueStatusCommand();

export const builder = new SlashCommandBuilder()
  .setName("queue-status")
  .setDescription("[DEV] Check the status of the queue system")
  .setDefaultMemberPermissions(0);
