import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { ProcessorFactoryStats } from "../../queue/processors/ProcessorFactory.js";

import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

class ProcessorsCommand extends DevCommand {
  constructor() {
    const config: CommandConfig = {
      name: "processors",
      description: "DEV ONLY: Check processor system status and stats",
      category: "dev",
      ephemeral: true,
      guildOnly: false,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    this.validateDevPermissions();

    const { ProcessorFactory } = await import("../../queue/processors/ProcessorFactory.js");
    const factory = new ProcessorFactory(this.client);

    try {
      const stats: ProcessorFactoryStats = factory.getProcessorStats();
      const availableJobTypes = factory.getAvailableJobTypes();

      const embed = new EmbedBuilder()
        .setTitle("🔧 Processor System Status")
        .setColor(0x00ff00)
        .setTimestamp()
        .addFields(
          {
            name: "📊 Overview",
            value: [
              `**Total Processors:** ${stats.totalProcessors}`,
              `**Total Job Types:** ${stats.totalJobTypes}`,
              `**Status:** ✅ Online`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "🎯 Available Job Types",
            value:
              availableJobTypes.length > 0 ? `\`\`\`${availableJobTypes.join(", ")}\`\`\`` : "No job types available",
            inline: false,
          }
        );

      for (const processor of stats.processors.slice(0, 5)) {
        embed.addFields({
          name: `🔄 ${processor.processorName}`,
          value: [`**Job Types:** ${processor.totalJobTypes}`, `**Handles:** ${processor.jobTypes.join(", ")}`].join(
            "\n"
          ),
          inline: true,
        });
      }

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Processor System Error")
        .setColor(0xff0000)
        .setDescription(`Failed to check processor status: ${error instanceof Error ? error.message : "Unknown error"}`)
        .setTimestamp();

      return { embeds: [errorEmbed], ephemeral: true };
    } finally {
      factory.shutdown();
    }
  }
}

export default new ProcessorsCommand();

export const builder = new SlashCommandBuilder()
  .setName("processors")
  .setDescription("DEV ONLY: Check processor system status and stats")
  .setDefaultMemberPermissions(0);
