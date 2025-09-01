import type { Interaction } from "discord.js";
import { handleGiveawayInteraction } from "../../commands/admin/giveaway.js";
import { handlePollInteraction } from "../../commands/moderation/poll.js";
import { handleTicketButtonInteraction } from "../../functions/discord/ticketManager.js";
import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", async (interaction: Interaction) => {
  // Handle button interactions
  if (interaction.isButton()) {
    if (!interaction.inGuild()) return;

    // Skip wizard-specific buttons that are handled by their own collectors
    if (
      interaction.customId.startsWith("report_") ||
      interaction.customId.startsWith("logging_") ||
      interaction.customId.startsWith("welcome_") ||
      interaction.customId.startsWith("appeals_") ||
      interaction.customId.startsWith("reactionroles_") ||
      interaction.customId.startsWith("automod_") ||
      interaction.customId.startsWith("compliment_")
    ) {
      logger.debug(`Wizard button ${interaction.customId} handled by setup wizard, skipping global handler`);
      return;
    }

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

    // Handle ticket functionality (but exclude setup wizard interactions)
    if (
      interaction.customId.startsWith("ticket_") &&
      !interaction.customId.startsWith("ticket_enable_threads") &&
      !interaction.customId.startsWith("ticket_disable_threads") &&
      !interaction.customId.startsWith("ticket_create_panel")
    ) {
      await handleTicketButtonInteraction(interaction);
      return;
    }

    // Future button interaction logic will go here.
  }

  // Handle channel select menu interactions
  if (interaction.isChannelSelectMenu()) {
    if (!interaction.inGuild()) return;

    // Handle ticket setup channel selection (exclude from global handler)
    if (interaction.customId === "ticket_channel_select") {
      // This is handled by the setup wizard collector
      return;
    }
  }

  // Handle role select menu interactions
  if (interaction.isRoleSelectMenu()) {
    if (!interaction.inGuild()) return;

    // Future role select menu logic will go here.
  }
});
