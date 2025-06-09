import type { Interaction } from "discord.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", (interaction: Interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  // Future button interaction logic will go here.
});
