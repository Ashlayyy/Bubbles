import type { ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { prisma } from "../../../database/index.js";
import logger from "../../../logger.js";
import { levelingSettingsService } from "../../../services/levelingSettingsService.js";
import type Client from "../../../structures/Client.js";
import { WIZARD_COLORS } from "./WizardComponents.js";

export async function startLevelingWizard(_client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "❌ This command must be used in a server.", ephemeral: true });
    return;
  }

  const guildId = guild.id;
  const settings = await levelingSettingsService.getSettings(guildId);

  const embed = new EmbedBuilder()
    .setColor(WIZARD_COLORS.PRIMARY)
    .setTitle("🧪 Leveling Setup Wizard")
    .setDescription("Configure the leveling system. Use the buttons below to navigate. Changes are saved immediately.")
    .addFields(
      { name: "Status", value: settings.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
      { name: "XP/message", value: String(settings.xpPerMessage), inline: true },
      { name: "Cooldown", value: `${String(settings.xpCooldown)}s`, inline: true },
      {
        name: "Level-up",
        value: `Msg: ${settings.levelUpMessage ? "Custom" : "Default"}\nChannel: ${
          settings.levelUpChannel ? `<#${settings.levelUpChannel}>` : "Same channel"
        }`,
        inline: false,
      },
      {
        name: "Ignore",
        value: `Channels: ${String(settings.ignoredChannels.length)}\nRoles: ${String(settings.ignoredRoles.length)}`,
        inline: true,
      },
      {
        name: "Multipliers",
        value: `Roles: ${String(settings.multiplierRoles.length)}\nStack: ${settings.stackMultipliers ? "Yes" : "No"}`,
        inline: true,
      }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("lvl_toggle").setStyle(ButtonStyle.Primary).setLabel("Enable/Disable"),
    new ButtonBuilder().setCustomId("lvl_xp_rate").setStyle(ButtonStyle.Secondary).setLabel("Set XP/message"),
    new ButtonBuilder().setCustomId("lvl_cooldown").setStyle(ButtonStyle.Secondary).setLabel("Set Cooldown")
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("lvl_levelup_message").setStyle(ButtonStyle.Secondary).setLabel("Level-up Message"),
    new ButtonBuilder().setCustomId("lvl_levelup_channel").setStyle(ButtonStyle.Secondary).setLabel("Level-up Channel")
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("lvl_ignore").setStyle(ButtonStyle.Secondary).setLabel("Ignore Channels/Roles"),
    new ButtonBuilder().setCustomId("lvl_multipliers").setStyle(ButtonStyle.Secondary).setLabel("Role Multipliers")
  );

  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("lvl_rewards").setStyle(ButtonStyle.Success).setLabel("Manage Rewards"),
    new ButtonBuilder().setCustomId("lvl_close").setStyle(ButtonStyle.Danger).setLabel("Close Wizard")
  );

  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4], ephemeral: true });
  } else {
    await interaction.editReply({ embeds: [embed], components: [row1, row2, row3, row4] });
  }

  const msg = await interaction.fetchReply();
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", (btn: ButtonInteraction) => {
    void (async () => {
      try {
        if (btn.customId === "lvl_close") {
          collector.stop("closed");
          await btn.update({ components: [] });
          return;
        }
        if (btn.customId === "lvl_toggle") {
          await levelingSettingsService.updateSettings(guildId, { enabled: !settings.enabled });
          await btn.deferUpdate();
          await startLevelingWizard(_client, interaction);
          return;
        }
        if (btn.customId === "lvl_xp_rate") {
          await btn.showModal({
            customId: "lvl_xp_modal",
            title: "Set XP per Message",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    customId: "xp",
                    label: "XP per message (1-100)",
                    style: 1,
                    minLength: 1,
                    maxLength: 3,
                    required: true,
                    value: String(settings.xpPerMessage),
                  },
                ],
              },
            ],
          } as any);
          const submitted = (await interaction
            .awaitModalSubmit({ time: 60_000, filter: (i) => i.customId === "lvl_xp_modal" })
            .catch(() => null)) as unknown as ModalSubmitInteraction | null;
          if (submitted) {
            const val = parseInt(submitted.fields.getTextInputValue("xp"), 10);
            if (Number.isFinite(val) && val >= 1 && val <= 100) {
              await levelingSettingsService.updateSettings(guildId, { xpPerMessage: val });
              await submitted.reply({ content: "✅ Updated XP per message.", ephemeral: true });
              await startLevelingWizard(_client, interaction);
            } else {
              await submitted.reply({ content: "❌ Enter a number between 1 and 100.", ephemeral: true });
            }
          }
          return;
        }
        if (btn.customId === "lvl_cooldown") {
          await btn.showModal({
            customId: "lvl_cd_modal",
            title: "Set XP Cooldown (seconds)",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    customId: "cd",
                    label: "Cooldown 0-300 seconds",
                    style: 1,
                    minLength: 1,
                    maxLength: 3,
                    required: true,
                    value: String(settings.xpCooldown),
                  },
                ],
              },
            ],
          } as any);
          const submitted = (await interaction
            .awaitModalSubmit({ time: 60_000, filter: (i) => i.customId === "lvl_cd_modal" })
            .catch(() => null)) as unknown as ModalSubmitInteraction | null;
          if (submitted) {
            const val = parseInt(submitted.fields.getTextInputValue("cd"), 10);
            if (Number.isFinite(val) && val >= 0 && val <= 300) {
              await levelingSettingsService.updateSettings(guildId, { xpCooldown: val });
              await submitted.reply({ content: "✅ Updated cooldown.", ephemeral: true });
              await startLevelingWizard(_client, interaction);
            } else {
              await submitted.reply({ content: "❌ Enter a number between 0 and 300.", ephemeral: true });
            }
          }
          return;
        }
        if (btn.customId === "lvl_levelup_message") {
          await btn.showModal({
            customId: "lvl_msg_modal",
            title: "Set Level-up Message",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    customId: "msg",
                    label: "Message (supports {user}, {level}, {xp})",
                    style: 2,
                    minLength: 0,
                    maxLength: 500,
                    required: false,
                    value: settings.levelUpMessage ?? "",
                  },
                ],
              },
            ],
          } as any);
          const submitted = (await interaction
            .awaitModalSubmit({ time: 60_000, filter: (i) => i.customId === "lvl_msg_modal" })
            .catch(() => null)) as unknown as ModalSubmitInteraction | null;
          if (submitted) {
            const val = submitted.fields.getTextInputValue("msg");
            const normalized = val && val.trim().length > 0 ? val : null;
            await levelingSettingsService.updateSettings(guildId, { levelUpMessage: normalized });
            await submitted.reply({ content: "✅ Updated level-up message.", ephemeral: true });
            await startLevelingWizard(_client, interaction);
          }
          return;
        }
        if (btn.customId === "lvl_levelup_channel") {
          const select = new StringSelectMenuBuilder()
            .setCustomId("lvl_channel_select")
            .setPlaceholder("Select a text channel or 'same channel'")
            .addOptions(new StringSelectMenuOptionBuilder().setLabel("Same channel").setValue("same"));
          guild.channels.cache
            .filter((ch) => ch.isTextBased())
            .forEach((ch) => select.addOptions(new StringSelectMenuOptionBuilder().setLabel(ch.name).setValue(ch.id)));

          await btn.update({
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
          });

          const selection = (await msg
            .awaitMessageComponent({
              componentType: ComponentType.StringSelect,
              time: 60_000,
              filter: (i) => i.customId === "lvl_channel_select" && i.user.id === interaction.user.id,
            })
            .catch(() => null)) as unknown as StringSelectMenuInteraction | null;
          if (selection) {
            const picked = selection.values[0];
            await levelingSettingsService.updateSettings(guildId, {
              levelUpChannel: picked === "same" ? null : picked,
            });
            await selection.update({ content: "✅ Updated level-up channel.", components: [] });
            await startLevelingWizard(_client, interaction);
          }
          return;
        }
        if (btn.customId === "lvl_ignore") {
          // Simple toggles via select menus could be implemented here. For brevity show counts managed elsewhere.
          await btn.reply({ content: "Tip: Use this wizard again to adjust ignore lists.", ephemeral: true });
          return;
        }
        if (btn.customId === "lvl_multipliers") {
          await btn.reply({
            content: "Tip: Role multipliers can be adjusted in a future advanced screen.",
            ephemeral: true,
          });
          return;
        }
        if (btn.customId === "lvl_rewards") {
          await showRewardsManager(interaction, guildId);
          return;
        }
      } catch (err) {
        logger.error("Leveling wizard error:", err);
        try {
          await btn.reply({ content: "❌ An error occurred.", ephemeral: true });
        } catch (replyErr) {
          logger.debug("Wizard reply failed:", replyErr);
        }
      }
    })();
  });
}

async function showRewardsManager(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const rewards = await prisma.levelReward.findMany({ where: { guildId }, orderBy: { level: "asc" } });
  const lines = rewards.length
    ? rewards
        .map((r) => `Level ${r.level} → <@&${r.roleId}>${r.removeOnDemotion ? " (remove on demotion)" : ""}`)
        .join("\n")
    : "No rewards configured.";

  const embed = new EmbedBuilder()
    .setColor(WIZARD_COLORS.INFO)
    .setTitle("🎁 Level Rewards")
    .setDescription(lines)
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("rw_add").setLabel("Add Reward").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("rw_remove").setLabel("Remove Reward").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("rw_clear").setLabel("Clear All").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("rw_back").setLabel("Back").setStyle(ButtonStyle.Secondary)
  );

  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  } else {
    await interaction.editReply({ embeds: [embed], components: [row] });
  }

  const msg = await interaction.fetchReply();
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 3 * 60 * 1000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", (btn: ButtonInteraction) => {
    void (async () => {
      try {
        if (btn.customId === "rw_back") {
          await btn.deferUpdate();
          await startLevelingWizard(interaction.client as unknown as Client, interaction);
          return;
        }
        if (btn.customId === "rw_add") {
          await btn.showModal({
            customId: "rw_add_modal",
            title: "Add Reward",
            components: [
              {
                type: 1,
                components: [{ type: 4, customId: "level", label: "Level (1-1000)", style: 1, required: true }],
              },
              {
                type: 1,
                components: [
                  { type: 4, customId: "role", label: "Role ID", style: 1, required: true },
                  { type: 4, customId: "remove", label: "Remove on demotion? (yes/no)", style: 1, required: false },
                ],
              },
            ],
          } as any);
          const submitted = await interaction
            .awaitModalSubmit({ time: 60_000, filter: (i) => i.customId === "rw_add_modal" })
            .catch(() => null);
          if (submitted) {
            const lvl = parseInt(submitted.fields.getTextInputValue("level"), 10);
            const roleId = submitted.fields.getTextInputValue("role");
            const demote = (submitted.fields.getTextInputValue("remove") || "no").toLowerCase().startsWith("y");
            if (Number.isFinite(lvl) && lvl >= 1 && lvl <= 1000 && roleId) {
              await prisma.levelReward.create({ data: { guildId, level: lvl, roleId, removeOnDemotion: demote } });
              await submitted.reply({ content: "✅ Reward added.", ephemeral: true });
              await showRewardsManager(interaction, guildId);
            } else {
              await submitted.reply({ content: "❌ Invalid inputs.", ephemeral: true });
            }
          }
          return;
        }
        if (btn.customId === "rw_remove") {
          await btn.showModal({
            customId: "rw_remove_modal",
            title: "Remove Reward",
            components: [
              { type: 1, components: [{ type: 4, customId: "level", label: "Level (optional)", style: 1 }] },
              { type: 1, components: [{ type: 4, customId: "role", label: "Role ID (optional)", style: 1 }] },
            ],
          } as any);
          const submitted = await interaction
            .awaitModalSubmit({ time: 60_000, filter: (i) => i.customId === "rw_remove_modal" })
            .catch(() => null);
          if (submitted) {
            const lvl = submitted.fields.getTextInputValue("level");
            const roleId = submitted.fields.getTextInputValue("role");
            if (!lvl && !roleId) {
              await submitted.reply({ content: "❌ Provide either a level or a role ID.", ephemeral: true });
            } else {
              await prisma.levelReward.deleteMany({
                where: { guildId, ...(lvl ? { level: parseInt(lvl, 10) } : {}), ...(roleId ? { roleId } : {}) },
              });
              await submitted.reply({ content: "✅ Reward(s) removed.", ephemeral: true });
              await showRewardsManager(interaction, guildId);
            }
          }
          return;
        }
        if (btn.customId === "rw_clear") {
          await prisma.levelReward.deleteMany({ where: { guildId } });
          await btn.reply({ content: "✅ All rewards cleared.", ephemeral: true });
          await showRewardsManager(interaction, guildId);
          return;
        }
      } catch (err) {
        logger.error("Rewards manager error:", err);
        try {
          await btn.reply({ content: "❌ An error occurred.", ephemeral: true });
        } catch (replyErr) {
          logger.debug("Rewards reply failed:", replyErr);
        }
      }
    })();
  });
}
