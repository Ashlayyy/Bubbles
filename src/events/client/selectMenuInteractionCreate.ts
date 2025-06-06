import type { EmbedField } from "discord.js";

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

          await interaction.editReply({
            content: `✅ Removed reaction: ${removedReaction.emoji}`,
            components: [],
          });

          return;
        }

        logger.error(new ReferenceError("Could not match customId of select menu to one of this bot's!"));
      }
    }
  }
});
