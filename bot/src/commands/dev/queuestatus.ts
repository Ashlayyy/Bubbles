import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

interface BullMQSystemHealth {
  overall: boolean;
  queues: Record<string, any>;
  timestamp: number;
}

type BullMQMetrics = Record<
  string,
  | {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    }
  | { error: string }
>;

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
        .setDescription("❌ **Queue service not initialized**\nThe BullMQ queue service is not available.")
        .addFields({ name: "Status", value: "❌ Not Running", inline: true })
        .setTimestamp();

      return { embeds: [embed], ephemeral: true };
    }

    const isReady = queueService.isReady();

    let health: BullMQSystemHealth;
    let metrics: BullMQMetrics;

    try {
      health = await queueService.getSystemHealth();
      metrics = await queueService.getAllQueueMetrics();
    } catch (_error) {
      const embed = new EmbedBuilder()
        .setTitle("🔧 Queue System Status")
        .setColor("Red")
        .setDescription("❌ **Error retrieving queue status**\nFailed to get health or metrics data.")
        .addFields({ name: "Status", value: "❌ Error", inline: true })
        .setTimestamp();

      return { embeds: [embed], ephemeral: true };
    }

    // Calculate total active jobs across all queues
    let totalActive = 0;
    let totalWaiting = 0;
    let totalFailed = 0;
    let hasErrors = false;

    const queueStatusFields: { name: string; value: string; inline: boolean }[] = [];

    for (const [queueName, queueMetrics] of Object.entries(metrics)) {
      if ("error" in queueMetrics) {
        hasErrors = true;
        queueStatusFields.push({
          name: `❌ ${queueName}`,
          value: `Error: ${queueMetrics.error}`,
          inline: true,
        });
      } else {
        totalActive += queueMetrics.active;
        totalWaiting += queueMetrics.waiting;
        totalFailed += queueMetrics.failed;

        const status = queueMetrics.active > 0 ? "🟡" : queueMetrics.waiting > 0 ? "🟠" : "🟢";
        queueStatusFields.push({
          name: `${status} ${queueName}`,
          value: [
            `Active: ${queueMetrics.active}`,
            `Waiting: ${queueMetrics.waiting}`,
            `Failed: ${queueMetrics.failed}`,
          ].join("\n"),
          inline: true,
        });
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🔧 BullMQ Queue System Status")
      .setColor(isReady && health.overall ? "Green" : hasErrors ? "Red" : "Orange")
      .addFields(
        { name: "Queue Service", value: isReady ? "✅ Ready" : "❌ Not Ready", inline: true },
        {
          name: "System Health",
          value: health.overall ? "✅ Healthy" : "❌ Unhealthy",
          inline: true,
        },
        {
          name: "Dead Letter Queue",
          value: queueService.deadLetterQueue ? "✅ Available" : "❌ Not Available",
          inline: true,
        },
        {
          name: "Total Active Jobs",
          value: totalActive.toString(),
          inline: true,
        },
        {
          name: "Total Waiting Jobs",
          value: totalWaiting.toString(),
          inline: true,
        },
        {
          name: "Total Failed Jobs",
          value: totalFailed.toString(),
          inline: true,
        },
        ...queueStatusFields
      )
      .setFooter({ text: "Powered by BullMQ" })
      .setTimestamp();

    if (!isReady || !health.overall) {
      embed.setDescription(
        "⚠️ **Queue system issues detected**\nSome queues may be experiencing problems or still initializing."
      );
    } else {
      embed.setDescription("✅ BullMQ queue system is operating normally.");
    }

    return { embeds: [embed], ephemeral: true };
  }
}

export default new QueueStatusCommand();

export const builder = new SlashCommandBuilder()
  .setName("queue-status")
  .setDescription("[DEV] Check the status of the queue system")
  .setDefaultMemberPermissions(0);
