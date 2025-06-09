import type { AutocompleteInteraction, Interaction } from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isAutocomplete()) return;

  const client = interaction.client as Client;

  try {
    if (interaction.commandName === "permissions") {
      await handlePermissionsAutocomplete(interaction, client);
    } else if (interaction.commandName === "server") {
      await handleServerAutocomplete(interaction, client);
    } else if (interaction.commandName === "rbac") {
      await handleRbacAutocomplete(interaction, client);
    }
  } catch (error) {
    logger.error("Error in autocomplete handler:", error);
  }
});

async function handlePermissionsAutocomplete(interaction: AutocompleteInteraction, client: Client) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === "command") {
    const commands = client.commands.map((cmd) => cmd.builder.name);
    const filtered = commands.filter((choice) => choice.startsWith(focusedOption.value)).slice(0, 25);
    await interaction.respond(filtered.map((choice) => ({ name: choice, value: choice })));
  }
}

async function handleServerAutocomplete(interaction: AutocompleteInteraction, client: Client) {
  // This can be expanded for other options if needed
}

async function handleRbacAutocomplete(interaction: AutocompleteInteraction, client: Client) {
  const group = interaction.options.getSubcommandGroup();
  const focusedOption = interaction.options.getFocused(true);
  const guildId = interaction.guildId;

  if (!guildId) return;

  if (focusedOption.name === "role") {
    const roles = await prisma.customRole.findMany({ where: { guildId, name: { startsWith: focusedOption.value } } });
    await interaction.respond(roles.map((role) => ({ name: role.name, value: role.name })).slice(0, 25));
  } else if (focusedOption.name === "permission") {
    const allPermissions = client.commands.map((c) => `command.${c.builder.name}`);
    allPermissions.push("command.*"); // Add wildcard option

    if (group === "role") {
      const roleName = interaction.options.getString("role");
      if (roleName) {
        const role = await prisma.customRole.findUnique({ where: { guildId_name: { guildId, name: roleName } } });
        if (role) {
          // For 'remove', suggest only permissions the role has
          if (interaction.options.getSubcommand() === "permission_remove") {
            const filtered = role.permissions.filter((p) => p.startsWith(focusedOption.value));
            await interaction.respond(filtered.map((p) => ({ name: p, value: p })).slice(0, 25));
            return;
          }
        }
      }
    }

    // For 'add' or if no role context, suggest all possible permissions
    const filtered = allPermissions.filter((p) => p.startsWith(focusedOption.value));
    await interaction.respond(filtered.map((p) => ({ name: p, value: p })).slice(0, 25));
  }
}
