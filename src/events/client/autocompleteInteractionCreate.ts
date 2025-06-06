import type { AutocompleteInteraction } from "discord.js";

import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  logger.verbose("AutocompleteInteraction created!", { interaction });

  const client = await Client.get();

  // Get command
  const command = client.commands.get(interaction.commandName);

  // If command name is not valid, do nothing
  if (!command) return;

  try {
    // Handle built-in autocomplete for permissions command
    if (interaction.commandName === "permissions") {
      await handlePermissionsAutocomplete(interaction, client);
    } else if (interaction.commandName === "server") {
      await handleServerAutocomplete(interaction, client);
    }
  } catch (error) {
    logger.error("Error handling autocomplete:", error);
  }
});

async function handlePermissionsAutocomplete(interaction: AutocompleteInteraction, client: Client) {
  const focusedOption = interaction.options.getFocused(true);

  switch (focusedOption.name) {
    case "command": {
      const commandNames = Array.from(client.commands.keys());
      const filtered = commandNames
        .filter((name) => name.toLowerCase().includes(focusedOption.value.toLowerCase()))
        .slice(0, 25);

      await interaction.respond(filtered.map((name) => ({ name, value: name })));
      break;
    }

    case "roles": {
      if (!interaction.guild) return;

      try {
        await interaction.guild.roles.fetch();
        const roles = interaction.guild.roles.cache
          .filter((role) => {
            return role.name !== "@everyone" && role.name.toLowerCase().includes(focusedOption.value.toLowerCase());
          })
          .sort((a, b) => b.position - a.position)
          .first(25);

        await interaction.respond(
          roles.map((role) => ({
            name: `${role.name} (${role.id})`,
            value: role.id,
          }))
        );
      } catch (error) {
        logger.error("Error fetching roles for autocomplete:", error);
        await interaction.respond([]);
      }
      break;
    }

    case "users": {
      if (!interaction.guild) return;

      try {
        // Add timeout protection for autocomplete
        const fetchPromise = interaction.guild.members.fetch({ limit: 100 }); // Smaller limit for autocomplete
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Autocomplete timeout"));
          }, 3000); // 3 second timeout for autocomplete
        });

        await Promise.race([fetchPromise, timeoutPromise]);

        const members = interaction.guild.members.cache
          .filter((member) => {
            return (
              !member.user.bot &&
              (member.user.username.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
                member.displayName.toLowerCase().includes(focusedOption.value.toLowerCase()))
            );
          })
          .sort((a, b) => a.user.username.localeCompare(b.user.username))
          .first(25);

        await interaction.respond(
          members.map((member) => ({
            name: `${member.displayName} (@${member.user.username})`,
            value: member.user.id,
          }))
        );
      } catch (error) {
        logger.error("Error fetching users for autocomplete:", error);
        await interaction.respond([]);
      }
      break;
    }

    default:
      await interaction.respond([]);
  }
}

async function handleServerAutocomplete(interaction: AutocompleteInteraction, client: Client) {
  const focusedOption = interaction.options.getFocused(true);

  switch (focusedOption.name) {
    case "filter": {
      if (!interaction.guild) return;

      try {
        // Add timeout protection for autocomplete
        const fetchPromise = interaction.guild.members.fetch({ limit: 100 }); // Smaller limit for autocomplete
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Autocomplete timeout"));
          }, 3000); // 3 second timeout for autocomplete
        });

        await Promise.race([fetchPromise, timeoutPromise]);

        const members = interaction.guild.members.cache
          .filter((member) => !member.user.bot)
          .sort((a, b) => a.user.username.localeCompare(b.user.username))
          .first(25);

        const suggestions = members
          .map((member) => member.user.username)
          .filter((username) => username.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .slice(0, 25);

        await interaction.respond(suggestions.map((username) => ({ name: username, value: username })));
      } catch (error) {
        logger.error("Error fetching users for autocomplete:", error);
        await interaction.respond([]);
      }
      break;
    }

    default:
      await interaction.respond([]);
  }
}
