import { bullMQRegistry } from "@shared/queue";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

export class BullMQDebugCommand extends DevCommand {
  constructor() {
    super({
      name: "bullmq-debug",
      description: "Debug BullMQ connection and queue status",
      category: "dev",
    });
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const subcommand = this.getStringOption("subcommand", true);

    try {
      switch (subcommand) {
        case "status":
          return await this.showStatus();
        case "test":
          return await this.testQueue();
        case "reset":
          return await this.resetConnections();
        default:
          return {
            content: "❌ Unknown subcommand",
            ephemeral: true,
          };
      }
    } catch (error) {
      console.error("Error in bullmq-debug command:", error);
      return {
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async showStatus(): Promise<CommandResponse> {
    const status = bullMQRegistry.getConnectionStatus();

    const embed = new EmbedBuilder()
      .setTitle("🔧 BullMQ Connection Status")
      .setColor(status.isAvailable ? 0x00ff00 : 0xff0000)
      .addFields(
        {
          name: "Connection Status",
          value: status.isAvailable ? "✅ Available" : "❌ Not Available",
          inline: true,
        },
        {
          name: "Initialized",
          value: status.initialized ? "✅ Yes" : "❌ No",
          inline: true,
        },
        {
          name: "Connection Attempts",
          value: `${status.connectionAttempts}/${status.maxConnectionAttempts}`,
          inline: true,
        },
        {
          name: "Main Connection",
          value: status.mainConnectionStatus,
          inline: true,
        },
        {
          name: "Events Connection",
          value: status.eventsConnectionStatus,
          inline: true,
        },
        {
          name: "Active Queues",
          value: status.queueCount.toString(),
          inline: true,
        },
        {
          name: "Active Events",
          value: status.eventsCount.toString(),
          inline: true,
        }
      )
      .setTimestamp();

    if (status.lastError) {
      embed.addFields({
        name: "Last Error",
        value: `\`\`\`${status.lastError}\`\`\``,
        inline: false,
      });
    }

    return { embeds: [embed] };
  }

  private async testQueue(): Promise<CommandResponse> {
    try {
      const queue = bullMQRegistry.getQueue("debug-test");

      if (!queue) {
        return {
          content: "❌ Cannot create test queue - Redis not available",
          ephemeral: true,
        };
      }

      // Add a test job
      const job = await queue.add("test-job", {
        timestamp: Date.now(),
        message: "Debug test job with consumer",
      });

      // Create a temporary worker to process the job
      const { Worker } = await import("bullmq");
      const worker = new Worker(
        "debug-test",
        async (job) => {
          console.log(`[BullMQ Debug] Processing job ${job.id}...`);
          console.log(`[BullMQ Debug] Job data:`, job.data);

          // Simulate work with a delay
          await new Promise((resolve) => setTimeout(resolve, 3000));

          console.log(`[BullMQ Debug] Job ${job.id} completed!`);
          return { processed: true, timestamp: Date.now() };
        },
        {
          connection: queue.connection,
          concurrency: 1,
        }
      );

      // Set up worker event listeners
      worker.on("completed", (job, result) => {
        console.log(`[BullMQ Debug] Worker completed job ${job?.id}:`, result);
      });

      worker.on("failed", (job, err) => {
        console.error(`[BullMQ Debug] Worker failed job ${job?.id}:`, err.message);
      });

      // Close worker after a delay to allow job processing
      setTimeout(() => {
        worker
          .close()
          .then(() => {
            console.log("[BullMQ Debug] Worker closed");
          })
          .catch((error: unknown) => {
            console.error("[BullMQ Debug] Error closing worker:", error);
          });
      }, 5000);

      return {
        content: `✅ Test job added successfully!\nJob ID: \`${job.id}\`\nQueue: \`debug-test\`\n\n🔄 Worker started - job will be processed in ~3 seconds and removed from queue.`,
      };
    } catch (error) {
      console.error("[BullMQ Debug] Test failed:", error);
      return {
        content: `❌ Test failed: ${error instanceof Error ? error.message : String(error)}`,
        ephemeral: true,
      };
    }
  }

  private async resetConnections(): Promise<CommandResponse> {
    try {
      // Shutdown existing connections
      await bullMQRegistry.shutdown();

      // Force re-initialization by calling isAvailable
      bullMQRegistry.isAvailable();

      const status = bullMQRegistry.getConnectionStatus();

      return {
        content: `🔄 Connections reset!\nNew status: ${status.isAvailable ? "✅ Available" : "❌ Not Available"}`,
      };
    } catch (error) {
      console.error("[BullMQ Debug] Reset failed:", error);
      return {
        content: `❌ Reset failed: ${error instanceof Error ? error.message : String(error)}`,
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new BullMQDebugCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("bullmq-debug")
  .setDescription("Debug BullMQ connection and queue status")
  .addSubcommand((subcommand) => subcommand.setName("status").setDescription("Show BullMQ connection status"))
  .addSubcommand((subcommand) => subcommand.setName("test").setDescription("Test queue operations"))
  .addSubcommand((subcommand) => subcommand.setName("reset").setDescription("Reset BullMQ connections"));
