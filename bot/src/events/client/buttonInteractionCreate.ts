import type { Interaction } from "discord.js";
import { handlePollInteraction } from "../../commands/moderation/poll.js";
import { handleTicketButtonInteraction } from "../../functions/discord/ticketManager.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  // Handle poll button interactions
  if (interaction.customId.startsWith("poll_")) {
    await handlePollInteraction(interaction);
    return;
  }

  // Handle ticket creation
  if (interaction.customId === "create_ticket") {
    await handleTicketButtonInteraction(interaction);
    return;
  }

  // Handle other ticket interactions (close, priority, etc.)
  if (interaction.customId.startsWith("ticket_")) {
    await handleTicketButtonInteraction(interaction);
    return;
  }

  // Future button interaction logic will go here.
});
