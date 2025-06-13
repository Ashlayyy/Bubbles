import { SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { LOG_CATEGORIES } from "../../structures/LogManager.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("logging")
    .setDescription("Configure comprehensive server logging")
    .addSubcommand((sub) => sub.setName("status").setDescription("View current logging configuration"))
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("Enable all standard log types (optionally include high-volume events)")
        .addStringOption((opt) => {
          opt.setName("category").setDescription("Enable only a specific log category").setRequired(false);

          // Dynamically add choices for each category (Discord limitation 25 choices)
          const categories = Object.keys(LOG_CATEGORIES).slice(0, 25);
          for (const cat of categories) {
            opt.addChoices({ name: cat, value: cat });
          }

          return opt;
        })
        .addBooleanOption((opt) =>
          opt
            .setName("include_high_volume")
            .setDescription("Also enable high-volume / spam-prone events")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable all logging")),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "status": {
          // Show current configuration
          const settings = await client.logManager.getSettings(interaction.guild.id);
          const totalLogTypes = Object.keys(LOG_CATEGORIES).reduce(
            (sum, category) => sum + LOG_CATEGORIES[category as keyof typeof LOG_CATEGORIES].length,
            0
          );

          const enabledCount = settings.enabledLogTypes.length;
          const disabledCount = totalLogTypes - enabledCount;

          const embed = client.genEmbed({
            title: "📊 Logging System Status",
            description: `Comprehensive server logging configuration`,
            color: enabledCount > 0 ? 0x2ecc71 : 0xe74c3c,
            fields: [
              {
                name: "📈 Overview",
                value: [
                  `**Total Log Types:** ${totalLogTypes}`,
                  `**Enabled:** ${enabledCount} (${Math.round((enabledCount / totalLogTypes) * 100)}%)`,
                  `**Disabled:** ${disabledCount}`,
                  `**Status:** ${enabledCount > 0 ? "🟢 Active" : "🔴 Inactive"}`,
                ].join("\n"),
                inline: true,
              },
              {
                name: "📍 Channel Routing",
                value:
                  Object.keys(settings.channelRouting).length > 0
                    ? Object.entries(settings.channelRouting)
                        .slice(0, 5)
                        .map(([logType, channelId]) => `**${logType}:** <#${channelId}>`)
                        .join("\n") +
                      (Object.keys(settings.channelRouting).length > 5
                        ? `\n... and ${Object.keys(settings.channelRouting).length - 5} more`
                        : "")
                    : "No channels configured",
                inline: true,
              },
            ],
          });

          // Add category breakdown
          const categoryStatus = Object.entries(LOG_CATEGORIES)
            .map(([category, types]) => {
              const categoryEnabled = types.filter((type: string) => settings.enabledLogTypes.includes(type));
              const percentage = Math.round((categoryEnabled.length / types.length) * 100);
              const statusIcon = percentage === 100 ? "🟢" : percentage > 0 ? "🟡" : "🔴";

              return `${statusIcon} **${category}**: ${categoryEnabled.length}/${types.length} (${percentage}%)`;
            })
            .join("\n");

          embed.addFields({
            name: "📋 Category Breakdown",
            value: categoryStatus,
            inline: false,
          });

          // Add ignored lists if any
          const ignoredInfo = [];
          if (settings.ignoredUsers.length > 0) {
            ignoredInfo.push(`**Users:** ${settings.ignoredUsers.length} ignored`);
          }
          if (settings.ignoredRoles.length > 0) {
            ignoredInfo.push(`**Roles:** ${settings.ignoredRoles.length} ignored`);
          }
          if (settings.ignoredChannels.length > 0) {
            ignoredInfo.push(`**Channels:** ${settings.ignoredChannels.length} ignored`);
          }

          if (ignoredInfo.length > 0) {
            embed.addFields({
              name: "🚫 Ignored Items",
              value: ignoredInfo.join("\n"),
              inline: true,
            });
          }

          // Add quick setup info if needed
          if (enabledCount === 0) {
            embed.addFields({
              name: "🚀 Quick Setup",
              value: "Use `/logging setup` to quickly configure logging channels",
              inline: false,
            });
          }

          await interaction.followUp({
            embeds: [embed],
          });
          break;
        }

        case "enable": {
          const includeHV = interaction.options.getBoolean("include_high_volume") ?? false;
          const category = interaction.options.getString("category");

          if (category) {
            const typesReadonly = LOG_CATEGORIES[category as keyof typeof LOG_CATEGORIES];
            const types = Array.from(typesReadonly);

            await client.logManager.enableLogTypes(interaction.guild.id, types);

            await interaction.followUp({
              content: `✅ Enabled **${category}** category (\`${types.length}\` log types).\nUse \`/logging status\` to verify.`,
            });
          } else {
            if (includeHV) {
              // Enable absolutely everything
              await client.logManager.enableAllLogTypes(interaction.guild.id);
            } else {
              // Enable everything except high-volume events
              // Build list of HV types
              const highVolumeSet = new Set<string>([...LOG_CATEGORIES.HIGH_VOLUME]);

              const enable = Object.values(LOG_CATEGORIES)
                .flat()
                .filter((t) => !highVolumeSet.has(t as string));

              await client.logManager.enableLogTypes(interaction.guild.id, enable);
            }

            await interaction.followUp({
              content: `✅ **Logging enabled!**\n\n${
                includeHV ? "All" : "Standard (non high-volume)"
              } events will now be logged.\n\n💡 *Use \`/logging status\` to verify and \`/settings high-volume-events enable\` if you later want the spam-prone events.*`,
            });
          }
          break;
        }

        case "disable": {
          // Disable all logging
          await client.logManager.disableAllLogTypes(interaction.guild.id);
          await interaction.followUp({
            content: `❌ **All logging disabled.**\n\n⚠️ No events will be logged until you re-enable them with \`/logging enable\`.`,
          });
          break;
        }
      }
    } catch (error) {
      console.error("Error executing logging command:", error);
      await interaction.followUp({
        content: "An error occurred while executing the command. Please try again later.",
      });
    }
  }
);
