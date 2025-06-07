import type { EmbedField } from "discord.js";

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { reactionRoleBuilder } from "../../commands/admin/reactionroles.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu()) {
    logger.verbose("SelectMenuInteraction created!", { interaction });
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logger.verbose(`values selected: [${interaction.values}]`);

    // Show user that select menu is loading
    await interaction.deferUpdate().catch((error: unknown) => {
      logger.error(error);
    });

    const client = await Client.get();

    switch (interaction.customId) {
      case "test-select-menu-id": {
        const [choice] = interaction.values;

        const testMenuEmbed = client.genEmbed({
          title: "Test Select Menu",
          description: `You selected: ${choice}`,
        });

        await interaction.editReply({
          embeds: [testMenuEmbed],
        });

        break;
      }
      case `${client.config.name}-help-select-menu`: {
        const [dir] = interaction.values;

        const dirName = dir[0].toUpperCase() + dir.slice(1);

        const commandObjArr: EmbedField[] = client.commands
          .filter((command) => command.category === dir)
          .map((command) => {
            return {
              name: `\`${command.builder.name}\``,
              value: command.builder.description,
              inline: true,
            };
          });

        const helpMenuEmbed = client.genEmbed({
          title: `${dirName} Commands`,
          fields: commandObjArr,
        });

        await interaction.editReply({
          embeds: [helpMenuEmbed],
        });

        break;
      }

      default: {
        // Handle reaction role removal select menus
        if (interaction.customId.startsWith("remove-reaction-select-")) {
          const builderId = interaction.customId.replace("remove-reaction-select-", "");
          const builderData = reactionRoleBuilder.get(builderId);

          if (!builderData) {
            await interaction.editReply({
              content: "❌ Builder session expired. Please start over.",
              components: [],
            });
            return;
          }

          const reactionIndex = parseInt(interaction.values[0], 10);
          const removedReaction = builderData.reactions[reactionIndex];

          if (!removedReaction) {
            await interaction.editReply({
              content: "❌ Invalid reaction selection.",
              components: [],
            });
            return;
          }

          // Remove the reaction from the builder data
          builderData.reactions.splice(reactionIndex, 1);
          builderData.lastActivity = Date.now();

          // Send success message with updated configuration interface
          const successEmbed = client.genEmbed({
            title: "✅ Reaction Removed Successfully!",
            description: `Removed reaction: ${removedReaction.emoji}`,
            color: 0x43b581, // Green color for success
          });

          const configEmbed = client.genEmbed({
            title: "🛠️ Reaction Role Builder",
            description: "Configure your reaction role message using the options below.",
            fields: [
              { name: "📝 Title", value: builderData.title || "*Not set*", inline: true },
              { name: "📄 Description", value: builderData.description ?? "*Not set*", inline: true },
              { name: "🎨 Color", value: builderData.embedColor, inline: true },
              {
                name: "⚡ Reactions",
                value:
                  builderData.reactions.length > 0
                    ? builderData.reactions
                        .map(
                          (r, i: number) => `${(i + 1).toString()}. ${r.emoji} → ${r.roleIds.length.toString()} role(s)`
                        )
                        .join("\n")
                    : "*No reactions added*",
                inline: false,
              },
            ],
            color: parseInt(builderData.embedColor.replace("#", ""), 16),
            footer: {
              text: `Session expires in ${Math.floor((600000 - (Date.now() - builderData.createdAt)) / 60000).toString()} minutes`,
            },
          });

          const configButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`config-title-${builderId}`)
              .setLabel("Set Title")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("📝"),
            new ButtonBuilder()
              .setCustomId(`config-description-${builderId}`)
              .setLabel("Set Description")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("📄"),
            new ButtonBuilder()
              .setCustomId(`config-color-${builderId}`)
              .setLabel("Set Color")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("🎨")
          );

          const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`add-reaction-${builderId}`)
              .setLabel("Add Reaction")
              .setStyle(ButtonStyle.Success)
              .setEmoji("➕"),
            new ButtonBuilder()
              .setCustomId(`remove-reaction-${builderId}`)
              .setLabel("Remove Reaction")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("➖")
              .setDisabled(builderData.reactions.length === 0),
            new ButtonBuilder()
              .setCustomId(`preview-${builderId}`)
              .setLabel("Preview")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("👁️"),
            new ButtonBuilder()
              .setCustomId(`send-${builderId}`)
              .setLabel("Send Message")
              .setStyle(ButtonStyle.Success)
              .setEmoji("📤")
              .setDisabled(builderData.reactions.length === 0),
            new ButtonBuilder()
              .setCustomId(`cancel-builder-${builderId}`)
              .setLabel("Cancel")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("❌")
          );

          await interaction.editReply({
            embeds: [successEmbed, configEmbed],
            components: [configButtons, actionButtons],
          });

          return;
        }

        logger.error(new ReferenceError("Could not match customId of select menu to one of this bot's!"));
      }
    }
  }
});
