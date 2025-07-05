import type { EmbedField } from "discord.js";
import { EmbedBuilder } from "discord.js";
import kebabCaseFn from "lodash/kebabCase.js";

import {
  deleteGuildConfig,
  getGuildConfig,
  defaults as guildConfigDefaults,
  descriptions as guildConfigDescriptions,
  setGoodbyeChannel,
  setWelcomeChannel,
  updateGuildConfig,
} from "../../database/GuildConfig.js";
import type Client from "../../structures/Client.js";
import type { GuildChatInputCommandInteraction } from "../../structures/Command.js";

const kebabCase = kebabCaseFn;

/* -------------------------------------------------------------------------- */
/*   SIMPLE CHANNEL HANDLERS                                                   */
/* -------------------------------------------------------------------------- */

export async function handleSetWelcomeChannel(interaction: GuildChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel("channel", true);
  await interaction.deferReply({ ephemeral: true });
  await setWelcomeChannel(interaction.guildId, channel.id);
  await interaction.editReply({ content: `Set welcome channel to <#${channel.id}>` });
}

export async function handleSetGoodbyeChannel(interaction: GuildChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel("channel", true);
  await interaction.deferReply({ ephemeral: true });
  await setGoodbyeChannel(interaction.guildId, channel.id);
  await interaction.editReply({ content: `Set goodbye channel to <#${channel.id}>` });
}

/* -------------------------------------------------------------------------- */
/*   DISPLAY ALL SETTINGS                                                     */
/* -------------------------------------------------------------------------- */

export async function displayCurrentSettings(
  client: Client,
  interaction: GuildChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
  const currentGuildConfig = await getGuildConfig(interaction.guildId);

  type SettingValue = number | string | boolean | Record<string, unknown> | null;

  const visibleSettings = Object.keys(guildConfigDefaults).filter((s) => s !== "greetings");
  const settingsFieldArr: EmbedField[] = visibleSettings.map((setting) => {
    // Extract value as unknown then process
    const tempVal = (currentGuildConfig as Record<string, unknown>)[setting];
    let currentValue: SettingValue;

    if (Array.isArray(tempVal)) {
      currentValue = `[ ${(tempVal as unknown[]).map((v) => String(v)).join(", ")} ]`;
    } else {
      currentValue = tempVal as SettingValue;
    }

    const settingDisplayValue = getSettingDisplayValue({ name: setting, value: currentValue });

    return {
      name: `${setting}: \`${settingDisplayValue}\``,
      value: guildConfigDescriptions[setting] ?? "No description available",
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.guild?.name ?? "Unknown Guild"} • Settings`)
    .setColor(0x3498db)
    .addFields(settingsFieldArr);

  await interaction.followUp({ embeds: [embed], ephemeral: true });
}

interface SettingData {
  name: string;
  value: number | string | boolean | Record<string, unknown> | null;
}

function getSettingDisplayValue(settingData: SettingData): string {
  const { name, value } = settingData;
  if (value === null) return "Not Set";

  switch (name) {
    case "welcomeChannelId":
    case "goodbyeChannelId":
      return typeof value === "string" && value !== "" ? `<#${value}>` : "Not Set";

    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/* -------------------------------------------------------------------------- */
/*   UPDATE / RESET SETTINGS                                                  */
/* -------------------------------------------------------------------------- */

export async function changeSetting(
  interaction: GuildChatInputCommandInteraction,
  setting: string,
  value: unknown
): Promise<void> {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
  await updateGuildConfig(interaction.guildId, { [setting]: value } as Record<string, unknown>);
  await interaction.followUp({ content: `Updated \`${kebabCase(setting)}\` to \`${String(value)}\`` });
}

export async function resetSettings(interaction: GuildChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
  await deleteGuildConfig(interaction.guildId);
  // recreate defaults
  await getGuildConfig(interaction.guildId);
  await interaction.followUp({ content: "Reset guild settings to defaults." });
}

/* -------------------------------------------------------------------------- */
/*   LOGGING HELP                                                             */
/* -------------------------------------------------------------------------- */

export async function handleLoggingHelp(interaction: GuildChatInputCommandInteraction): Promise<void> {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🗂️ New Comprehensive Logging System")
    .setDescription(
      "Logging has been redesigned. Use `/logging setup` to configure." +
        "\nMore commands: `/logging status`, `/logging channels`, `/logging toggle`."
    );
  await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
}
