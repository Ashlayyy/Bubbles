import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type RoleSelectMenuInteraction,
} from "discord.js";

import { getGuildConfig, updateGuildConfig } from "../../database/GuildConfig.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";

// ----- Setup Wizard -----
export async function startReportWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command must be used in a server.", ephemeral: true });
    return;
  }

  const config = await getGuildConfig(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setColor(0xff4757)
    .setTitle("🚨 Report System Setup Wizard")
    .setDescription(
      "Select the destination channel for new reports and the role that should be pinged when a report arrives."
    )
    .addFields({
      name: "Current Settings",
      value:
        `• Channel: ${config.reportChannelId ? `<#${config.reportChannelId}>` : "Not set"}` +
        `\n• Ping Role: ${config.reportPingRoleId ? `<@&${config.reportPingRoleId}>` : "Not set"}`,
      inline: false,
    })
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("report_channel_select")
    .setPlaceholder("Select report channel")
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("report_role_select")
    .setPlaceholder("Select ping role (optional)")
    .setMinValues(0)
    .setMaxValues(1);

  const components = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect),
  ];

  await interaction.reply({ embeds: [embed], components, ephemeral: true });

  const collector = interaction.channel?.createMessageComponentCollector({
    time: 300000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector?.on("collect", (component) => {
    void (async () => {
      try {
        if (component.isChannelSelectMenu() && component.customId === "report_channel_select") {
          const selectedChannelId = component.values[0];
          await applyReportChannel(client, component, selectedChannelId);
        }
        if (component.isRoleSelectMenu() && component.customId === "report_role_select") {
          const selectedRoleId = component.values[0] ?? null;
          await applyReportPingRole(client, component, selectedRoleId);
        }
      } catch (err) {
        logger.error("Report setup wizard error:", err);
        if (!component.replied && !component.deferred) {
          await component.reply({ content: "❌ An error occurred.", ephemeral: true });
        }
      }
    })();
  });
}

async function applyReportChannel(
  _client: Client,
  interaction: ChannelSelectMenuInteraction,
  channelId: string
): Promise<void> {
  if (!interaction.guild) return;

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "❌ Please select a text channel.", ephemeral: true });
    return;
  }

  await updateGuildConfig(interaction.guild.id, { reportChannelId: channel.id });

  await interaction.reply({ content: `✅ Report channel set to <#${channel.id}>`, ephemeral: true });
}

async function applyReportPingRole(
  _client: Client,
  interaction: RoleSelectMenuInteraction,
  roleId: string | null
): Promise<void> {
  if (!interaction.guild) return;

  await updateGuildConfig(interaction.guild.id, { reportPingRoleId: roleId });
  await interaction.reply({
    content: roleId ? `✅ Ping role set to <@&${roleId}>` : "✅ Ping role cleared.",
    ephemeral: true,
  });
}
