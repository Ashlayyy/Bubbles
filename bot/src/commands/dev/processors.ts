import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("processors").setDescription("DEV ONLY: Check processor system status and stats"),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const { ProcessorFactory } = await import("../../queue/processors/ProcessorFactory.js");
      const processorFactory = new ProcessorFactory(client);

      const stats = processorFactory.getProcessorStats();
      const availableJobTypes = processorFactory.getAvailableJobTypes();

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

      // Add processor details
      if (stats.processors && stats.processors.length > 0) {
        for (const processor of stats.processors.slice(0, 5)) {
          // Limit to 5 to avoid embed limits
          embed.addFields({
            name: `🔄 ${processor.processorName}`,
            value: [`**Job Types:** ${processor.totalJobTypes}`, `**Handles:** ${processor.jobTypes.join(", ")}`].join(
              "\n"
            ),
            inline: true,
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });

      // Clean up
      processorFactory.shutdown();
    } catch (error) {
      console.error("Error checking processor status:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Processor System Error")
        .setColor(0xff0000)
        .setDescription(`Failed to check processor status: ${error instanceof Error ? error.message : "Unknown error"}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.DEVELOPER,
      isConfigurable: false,
    },
  }
);
