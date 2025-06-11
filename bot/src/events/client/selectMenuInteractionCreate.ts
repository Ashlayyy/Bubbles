import type { EmbedField } from "discord.js";

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
            if ("description" in command.builder) {
              return {
                name: `\`${command.builder.name}\``,
                value: command.builder.description,
                inline: true,
              };
            }
            return {
              name: `\`${command.builder.name}\``,
              value: "No description available.",
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
          return;
        }

        logger.error(new ReferenceError("Could not match customId of select menu to one of this bot's!"));
      }
    }
  }
});
