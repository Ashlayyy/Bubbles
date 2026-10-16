import { ApplicationCommandType } from "discord.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", async (interaction) => {
  if (interaction.isUserContextMenuCommand()) {
    const client = interaction.client as Client;
    const command = client.commands.get(interaction.commandName);

    if (command && command.builder.toJSON().type === ApplicationCommandType.User) {
      await client.runCommand(command, interaction);
    } else {
      logger.error(`Could not find user context menu command with name "${interaction.commandName}"`);
    }
  }
});
