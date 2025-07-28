import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
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
    await interaction.reply({
      content: "❌ This command must be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const config = await getGuildConfig(interaction.guild.id);

  const wizardEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📝 Report System Setup Wizard")
    .setDescription(
      "Welcome to the **Report System Setup Wizard**!\n\n" +
        "Follow the steps below to configure the report system for your server.\n\n" +
        "• **Select Report Channel** – Where users can submit reports.\n" +
        "• **Set Ping Role** – Role to ping when reports are submitted.\n" +
        "• **Create Report Panel** – Post the report submission panel in the configured channel."
    )
    .addFields(
      {
        name: "Current Settings",
        value:
          `• Channel: ${config.reportChannelId ? `<#${config.reportChannelId}>` : "Not set"}` +
          `\n• Ping Role: ${config.reportPingRoleId ? `<@&${config.reportPingRoleId}>` : "Not set"}`,
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select a channel (dropdown below).\n" +
          "2. Set a ping role if desired.\n" +
          "3. Press **Create Panel** when ready.",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Channel select menu
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("report_channel_select")
    .setPlaceholder("Select report channel")
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  // Role select menu
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("report_role_select")
    .setPlaceholder("Select ping role (optional)")
    .setMinValues(0)
    .setMaxValues(1);

  const panelButton = new ButtonBuilder()
    .setCustomId("report_create_panel")
    .setLabel("Create Panel")
    .setStyle(ButtonStyle.Success);

  const components = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect),
    new ActionRowBuilder<ButtonBuilder>().addComponents(panelButton),
  ];

  // Check interaction state before replying
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ embeds: [wizardEmbed], components: components, ephemeral: true });
  } else if (interaction.deferred) {
    await interaction.editReply({ embeds: [wizardEmbed], components: components });
  } else {
    // If already replied, send a follow-up
    await interaction.followUp({ embeds: [wizardEmbed], components: components, ephemeral: true });
  }

  const collector = interaction.channel?.createMessageComponentCollector({
    time: 300000, // 5 minutes
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector?.on("collect", (component) => {
    void (async () => {
      try {
        if (component.isChannelSelectMenu() && component.customId === "report_channel_select") {
          const selectedChannelId = component.values[0];
          if (!selectedChannelId) {
            await component.reply({ content: "❌ No channel selected.", ephemeral: true });
            return;
          }
          await applyReportChannel(client, component, selectedChannelId);
        } else if (component.isRoleSelectMenu() && component.customId === "report_role_select") {
          const selectedRoleId = component.values[0] ?? null;
          await applyReportPingRole(client, component, selectedRoleId);
        } else {
          await component.reply({
            content: "❌ Unknown component interaction. Please try again.",
            ephemeral: true,
          });
        }
      } catch (error) {
        logger.error("Report wizard error:", error);
        if (!component.replied && !component.deferred) {
          await component.reply({ content: "❌ An error occurred.", ephemeral: true });
        } else if (component.deferred) {
          await component.editReply({ content: "❌ An error occurred." });
        } else if (component.replied) {
          await component.followUp({ content: "❌ An error occurred.", ephemeral: true });
        }
      }
    })();
  });

  collector?.on("end", () => {
    // Disable components after timeout
    const disabledComponents = [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        ChannelSelectMenuBuilder.from(channelSelect).setDisabled(true)
      ),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        RoleSelectMenuBuilder.from(roleSelect).setDisabled(true)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(ButtonBuilder.from(panelButton).setDisabled(true)),
    ];

    void interaction.editReply({ components: disabledComponents }).catch(() => {
      // Ignore errors if message was deleted
    });
  });
}

async function applyReportChannel(
  _client: Client,
  interaction: ChannelSelectMenuInteraction,
  channelId: string
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "❌ Please select a text channel.", ephemeral: true });
    return;
  }

  // Check bot permissions in the selected channel
  const botMember = interaction.guild.members.me;
  if (!botMember) {
    await interaction.reply({ content: "❌ Bot user not found in guild.", ephemeral: true });
    return;
  }

  const perms = channel.permissionsFor(botMember);
  if (!perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    await interaction.reply({
      content: `❌ I need **View Channel**, **Send Messages**, and **Embed Links** in <#${channel.id}> to work properly.`,
      ephemeral: true,
    });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { reportChannelId: channel.id });
    await interaction.reply({ content: `✅ Report channel set to <#${channel.id}>`, ephemeral: true });
  } catch (error) {
    logger.error("Error updating report channel:", error);
    await interaction.reply({
      content: "❌ Failed to update report channel. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyReportPingRole(
  _client: Client,
  interaction: RoleSelectMenuInteraction,
  roleId: string | null
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  // Validate role if one was selected
  if (roleId) {
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      await interaction.reply({ content: "❌ Selected role not found.", ephemeral: true });
      return;
    }

    // Check if bot can mention the role
    const botMember = interaction.guild.members.me;
    if (botMember && !botMember.permissions.has(PermissionFlagsBits.MentionEveryone)) {
      await interaction.reply({
        content: "❌ I need the **Mention Everyone** permission to ping roles.",
        ephemeral: true,
      });
      return;
    }
  }

  try {
    await updateGuildConfig(interaction.guild.id, { reportPingRoleId: roleId });
    await interaction.reply({
      content: roleId ? `✅ Ping role set to <@&${roleId}>` : "✅ Ping role cleared.",
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error updating report ping role:", error);
    await interaction.reply({
      content: "❌ Failed to update ping role. Please try again.",
      ephemeral: true,
    });
  }
}
