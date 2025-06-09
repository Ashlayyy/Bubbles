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
  const subcommand = interaction.options.getSubcommand();

  if (focusedOption.name === "command") {
    const commands = client.commands.map((cmd) => cmd.builder.name);
    const filtered = commands.filter((choice) => choice.startsWith(focusedOption.value)).slice(0, 25);
    await interaction.respond(filtered.map((choice) => ({ name: choice, value: choice })));
  } else if (focusedOption.name === "value" && subcommand === "quick-set") {
    const type = interaction.options.getString("type");

    switch (type) {
      case "effective-level": {
        const levels = ["PUBLIC", "MODERATOR", "ADMIN", "OWNER", "DEVELOPER"];
        const filtered = levels.filter((level) => level.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await interaction.respond(filtered.map((level) => ({ name: level, value: level })));
        break;
      }

      case "custom-role": {
        if (!interaction.guildId || !interaction.guild) return;
        try {
          // Get both custom roles and Discord roles
          const customRoles = await prisma.customRole.findMany({
            where: {
              guildId: interaction.guildId,
              name: { contains: focusedOption.value, mode: "insensitive" },
            },
            take: 15,
          });

          // Get Discord roles
          await interaction.guild.roles.fetch();
          const discordRoles = interaction.guild.roles.cache
            .filter(
              (role) =>
                role.name !== "@everyone" &&
                !role.managed &&
                role.name.toLowerCase().includes(focusedOption.value.toLowerCase())
            )
            .first(10);

          const suggestions = [
            ...customRoles.map((role) => ({
              name: `🛡️ ${role.name} (Custom Role)`,
              value: role.id,
            })),
            ...Array.from(discordRoles.values()).map((role) => ({
              name: `👥 ${role.name} (Discord Role)`,
              value: role.id,
            })),
          ];

          await interaction.respond(suggestions.slice(0, 25));
        } catch (error) {
          logger.error("Error fetching roles for autocomplete:", error);
          await interaction.respond([]);
        }
        break;
      }

      case "discord-permission": {
        const discordPermissions = [
          "Administrator",
          "ManageGuild",
          "ManageRoles",
          "ManageChannels",
          "ManageMessages",
          "ManageNicknames",
          "ManageEmojisAndStickers",
          "KickMembers",
          "BanMembers",
          "ModerateMembers",
          "ViewAuditLog",
          "SendMessages",
          "SendMessagesInThreads",
          "CreatePublicThreads",
          "CreatePrivateThreads",
          "EmbedLinks",
          "AttachFiles",
          "AddReactions",
          "UseExternalEmojis",
          "UseExternalStickers",
          "MentionEveryone",
          "ReadMessageHistory",
          "UseSlashCommands",
          "Connect",
          "Speak",
          "MuteMembers",
          "DeafenMembers",
          "MoveMembers",
          "UseVAD",
        ];
        const filtered = discordPermissions
          .filter((perm) => perm.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .slice(0, 25);
        await interaction.respond(filtered.map((perm) => ({ name: perm, value: perm })));
        break;
      }

      case "users": {
        if (!interaction.guild) return;
        try {
          // Search for users by username/display name
          const members = await interaction.guild.members.fetch();
          const filtered = members
            .filter(
              (member) =>
                !member.user.bot &&
                (member.user.username.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
                  member.displayName.toLowerCase().includes(focusedOption.value.toLowerCase()))
            )
            .first(25);

          await interaction.respond(
            Array.from(filtered.values()).map((member) => ({
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

      default: {
        await interaction.respond([]);
      }
    }
  } else if (focusedOption.name === "value" && subcommand === "bulk-set") {
    const target = interaction.options.getString("target");

    if (target === "category") {
      // Suggest available command categories
      const categories = [...new Set(client.commands.map((cmd) => cmd.category))];
      const filtered = categories.filter((cat) => cat.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
      await interaction.respond(filtered.map((cat) => ({ name: cat, value: cat })));
    } else if (target === "commands") {
      // Suggest command names (comma-separated support)
      const commands = client.commands.map((cmd) => cmd.builder.name);
      const currentInput = focusedOption.value;
      const lastCommaIndex = currentInput.lastIndexOf(",");

      if (lastCommaIndex >= 0) {
        // User is typing after a comma, suggest next command
        const prefix = currentInput.substring(0, lastCommaIndex + 1);
        const currentCommand = currentInput.substring(lastCommaIndex + 1).trim();
        const filtered = commands.filter((cmd) => cmd.startsWith(currentCommand)).slice(0, 25);
        await interaction.respond(filtered.map((cmd) => ({ name: cmd, value: `${prefix}${cmd}` })));
      } else {
        // First command
        const filtered = commands.filter((cmd) => cmd.startsWith(currentInput)).slice(0, 25);
        await interaction.respond(filtered.map((cmd) => ({ name: cmd, value: cmd })));
      }
    }
  } else if (focusedOption.name === "permission" && subcommand === "bulk-set") {
    const type = interaction.options.getString("type");

    switch (type) {
      case "effective-level": {
        const levels = ["PUBLIC", "MODERATOR", "ADMIN", "OWNER", "DEVELOPER"];
        const filtered = levels.filter((level) => level.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await interaction.respond(filtered.map((level) => ({ name: level, value: level })));
        break;
      }
      case "custom-role": {
        if (!interaction.guildId || !interaction.guild) return;
        try {
          // Get both custom roles and Discord roles
          const customRoles = await prisma.customRole.findMany({
            where: {
              guildId: interaction.guildId,
              name: { contains: focusedOption.value, mode: "insensitive" },
            },
            take: 15,
          });

          // Get Discord roles
          await interaction.guild.roles.fetch();
          const discordRoles = interaction.guild.roles.cache
            .filter(
              (role) =>
                role.name !== "@everyone" &&
                !role.managed &&
                role.name.toLowerCase().includes(focusedOption.value.toLowerCase())
            )
            .first(10);

          const suggestions = [
            ...customRoles.map((role) => ({
              name: `🛡️ ${role.name} (Custom Role)`,
              value: role.id,
            })),
            ...Array.from(discordRoles.values()).map((role) => ({
              name: `👥 ${role.name} (Discord Role)`,
              value: role.id,
            })),
          ];

          await interaction.respond(suggestions.slice(0, 25));
        } catch (error) {
          logger.error("Error fetching roles for bulk-set autocomplete:", error);
          await interaction.respond([]);
        }
        break;
      }
      default: {
        await interaction.respond([]);
      }
    }
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
