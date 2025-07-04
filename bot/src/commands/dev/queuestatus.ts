import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

interface QueueHealth {
  overall: boolean;
  protocols: Record<string, unknown>;
  redis: boolean;
  discord: boolean;
  websocket: boolean;
  overloaded: boolean;
  timestamp: number;
}

interface QueueMetrics {
  workers: { activeWorkers: number };
  queues: Record<string, unknown>;
  message: string;
}

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

  protected execute(): Promise<CommandResponse> {
    this.validateDevPermissions();

    const queueService = this.client.queueService;

    if (!queueService) {
      const embed = new EmbedBuilder()
        .setTitle("🔧 Queue System Status")
        .setColor("Red")
        .setDescription("❌ **Queue service not initialized**\nThe unified queue service is not available.")
        .addFields({ name: "Status", value: "❌ Not Running", inline: true })
        .setTimestamp();

      return Promise.resolve({ embeds: [embed], ephemeral: true });
    }

    const isReady = queueService.isReady();

    let health: QueueHealth;
    let metrics: QueueMetrics;

    try {
      health = queueService.getSystemHealth();
      metrics = queueService.getMetrics();
    } catch (_error) {
      const embed = new EmbedBuilder()
        .setTitle("🔧 Queue System Status")
        .setColor("Red")
        .setDescription("❌ **Error retrieving queue status**\nFailed to get health or metrics data.")
        .addFields({ name: "Status", value: "❌ Error", inline: true })
        .setTimestamp();

      return Promise.resolve({ embeds: [embed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("🔧 Unified Queue System Status")
      .setColor(isReady ? "Green" : "Orange")
      .addFields(
        { name: "Queue Service", value: isReady ? "✅ Ready" : "❌ Not Ready", inline: true },
        {
          name: "System Health",
          value: health.overall ? "✅ Healthy" : "❌ Unhealthy",
          inline: true,
        },
        {
          name: "Redis Connection",
          value: health.redis ? "✅ Connected" : "❌ Disconnected",
          inline: true,
        },
        {
          name: "Discord API",
          value: health.discord ? "✅ Available" : "❌ Unavailable",
          inline: true,
        },
        {
          name: "WebSocket",
          value: health.websocket ? "✅ Connected" : "❌ Disconnected",
          inline: true,
        },
        {
          name: "System Load",
          value: health.overloaded ? "⚠️ Overloaded" : "✅ Normal",
          inline: true,
        },
        {
          name: "Queue Metrics",
          value: [`**Active Workers:** ${metrics.workers.activeWorkers}`, `**Status:** ${metrics.message}`].join("\n"),
          inline: false,
        }
      )
      .setFooter({ text: "Queue system migrated to BullMQ" })
      .setTimestamp();

    if (!isReady) {
      embed.setDescription(
        "⚠️ **Queue system not ready**\nThe unified processor may still be initializing or experiencing issues."
      );
    } else {
      embed.setDescription("✅ Unified queue system is operating normally with BullMQ integration.");
    }

    return Promise.resolve({ embeds: [embed], ephemeral: true });
  }
}

export default new QueueStatusCommand();

export const builder = new SlashCommandBuilder()
  .setName("queue-status")
  .setDescription("[DEV] Check the status of the queue system")
  .setDefaultMemberPermissions(0);
