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

    // Handle automod setup wizard button interactions
    if (
      interaction.customId.startsWith("automod_wizard_") ||
      interaction.customId.startsWith("preset_") ||
      interaction.customId.startsWith("custom_") ||
      interaction.customId.startsWith("protection_")
    ) {
      // The automod setup wizard handles its own button interactions via collectors
      // This is just a fallback in case the collector times out
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup automod` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Handle logging configuration button interactions
    if (interaction.customId.startsWith("logging_") || interaction.customId.startsWith("channel_config_")) {
      const { handleLoggingButtonInteraction } = await import("../../commands/admin/setup-wizards/logging-setup.js");
      await handleLoggingButtonInteraction(interaction);
      return;
    }

    // Handle welcome setup wizard button interactions
    if (interaction.customId.startsWith("welcome_") || interaction.customId.startsWith("goodbye_")) {
      // The welcome setup wizard handles its own button interactions via collectors
      // This is just a fallback in case the collector times out
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup welcome` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Handle appeals setup wizard button interactions
    if (interaction.customId.startsWith("appeals_")) {
      // The appeals setup wizard handles its own button interactions via collectors
      // This is just a fallback in case the collector times out
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup appeals` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Handle reaction roles setup wizard button interactions
    if (interaction.customId.startsWith("reactionroles_")) {
      // The reaction roles setup wizard handles its own button interactions via collectors
      // This is just a fallback in case the collector times out
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup reactionroles` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Future button interaction logic will go here.
  }

  // Handle channel select menu interactions
  if (interaction.isChannelSelectMenu()) {
    if (!interaction.inGuild()) return;

    // Handle logging channel selection
    if (interaction.customId.startsWith("logging_channel_select_")) {
      const { handleLoggingButtonInteraction } = await import("../../commands/admin/setup-wizards/logging-setup.js");
      await handleLoggingButtonInteraction(interaction);
      return;
    }

    // Handle report setup channel selection
    if (interaction.customId === "report_channel_select") {
      // The report setup wizard handles its own interactions via collectors
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup reports` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Handle ticket setup channel selection
    if (interaction.customId === "ticket_channel_select") {
      // The ticket setup wizard handles its own interactions via collectors
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup tickets` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Handle welcome setup channel selection
    if (interaction.customId === "welcome_channel_select" || interaction.customId === "goodbye_channel_select") {
      // The welcome setup wizard handles its own interactions via collectors
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup welcome` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Handle appeals setup channel selection
    if (interaction.customId === "appeals_channel_select") {
      // The appeals setup wizard handles its own interactions via collectors
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup appeals` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Handle reaction roles setup channel selection
    if (interaction.customId === "reactionroles_channel_select") {
      // The reaction roles setup wizard handles its own interactions via collectors
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup reactionroles` to start a new one.",
        ephemeral: true,
      });
      return;
    }
  }

  // Handle role select menu interactions
  if (interaction.isRoleSelectMenu()) {
    if (!interaction.inGuild()) return;

    // Handle report setup role selection
    if (interaction.customId === "report_role_select") {
      // The report setup wizard handles its own interactions via collectors
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup reports` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    // Handle welcome setup role selection
    if (interaction.customId === "welcome_auto_role_select") {
      // The welcome setup wizard handles its own interactions via collectors
      await interaction.reply({
        content: "❌ This setup wizard has expired. Please use `/setup welcome` to start a new one.",
        ephemeral: true,
      });
      return;
    }
  }
});
