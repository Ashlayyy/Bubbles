import type { Interaction } from "discord.js";
import { handleGiveawayInteraction } from "../../commands/general/giveaway.js";
import { handlePollInteraction } from "../../commands/moderation/poll.js";
import { handleTicketButtonInteraction } from "../../functions/discord/ticketManager.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", async (interaction: Interaction) => {
  // Handle button interactions
  if (interaction.isButton()) {
    if (!interaction.inGuild()) return;

    // Handle giveaway button interactions
    if (interaction.customId.startsWith("giveaway_")) {
      await handleGiveawayInteraction(interaction);
      return;
    }

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

    // Handle logging configuration button interactions
    if (interaction.customId.startsWith("logging_") || interaction.customId.startsWith("channel_config_")) {
      const { handleLoggingButtonInteraction } = await import("../../commands/admin/logging.js");
      await handleLoggingButtonInteraction(interaction);
      return;
    }

    // Future button interaction logic will go here.
  }

  // Handle channel select menu interactions
  if (interaction.isChannelSelectMenu()) {
    if (!interaction.inGuild()) return;

    // Handle logging channel selection
    if (interaction.customId.startsWith("logging_channel_select_")) {
      const { handleLoggingButtonInteraction } = await import("../../commands/admin/logging.js");
      await handleLoggingButtonInteraction(interaction);
      return;
    }
  }
});
