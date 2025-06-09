import { PermissionsBitField, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("server")
    .setDescription("ADMIN ONLY: Get server information for permission management")
    .addSubcommand((sub) =>
      sub
        .setName("roles")
        .setDescription("List all server roles with their IDs")
        .addBooleanOption((opt) => opt.setName("manageable").setDescription("Show only manageable roles"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("users")
        .setDescription("List server users with their IDs")
        .addIntegerOption((opt) =>
          opt.setName("limit").setDescription("Number of users to show (max 25)").setMinValue(1).setMaxValue(25)
        )
        .addStringOption((opt) => opt.setName("filter").setDescription("Filter users by name/username"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("commands")
        .setDescription("List all bot commands")
        .addStringOption((opt) =>
          opt
            .setName("category")
            .setDescription("Filter by command category")
            .addChoices(
              { name: "All", value: "all" },
              { name: "General", value: "general" },
              { name: "Admin", value: "admin" },
              { name: "Music", value: "music" },
              { name: "Developer", value: "dev" }
            )
        )
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();

    if (!interaction.guild) {
      await interaction.followUp({
        content: "❌ This command can only be used in a server.",
      });
      return;
    }

    try {
      switch (subcommand) {
        case "roles": {
          const manageableOnly = interaction.options.getBoolean("manageable") ?? false;

          await interaction.guild.roles.fetch();
          const roles = interaction.guild.roles.cache
            .filter((role) => {
              if (manageableOnly) {
                return role.editable && !role.managed && role.name !== "@everyone";
              }
              return role.name !== "@everyone";
            })
            .sort((a, b) => b.position - a.position);

          if (roles.size === 0) {
            await interaction.followUp({
              content: "❌ No roles found.",
            });
            return;
          }

          const roleList = roles
            .map(
              (role) =>
                `**${role.name}** - \`${role.id}\`${role.managed ? " (Bot Role)" : ""}${!role.editable ? " (Higher than bot)" : ""}`
            )
            .slice(0, 25); // Discord embed field limit

          const embed = client.genEmbed({
            title: `🎭 Server Roles ${manageableOnly ? "(Manageable Only)" : ""}`,
            description: `Found ${roles.size} role${roles.size === 1 ? "" : "s"}`,
            fields: [
              {
                name: "Roles",
                value: roleList.join("\n") || "No roles to display",
                inline: false,
              },
            ],
            footer: {
              text: roles.size > 25 ? `Showing first 25 of ${roles.size} roles` : `Total: ${roles.size} roles`,
            },
          });

          await interaction.followUp({
            embeds: [embed],
          });
          break;
        }

        case "users": {
          const limit = interaction.options.getInteger("limit") ?? 25;
          const filter = interaction.options.getString("filter");

          try {
            await interaction.guild.members.fetch(); // Fetch all members

            let members = interaction.guild.members.cache;

            if (filter) {
              const filterLower = filter.toLowerCase();
              members = members.filter(
                (member) =>
                  member.user.username.toLowerCase().includes(filterLower) ||
                  member.user.displayName.toLowerCase().includes(filterLower) ||
                  member.displayName.toLowerCase().includes(filterLower)
              );
            }

            const filteredMembers = members
              .filter((member) => !member.user.bot)
              .sort((a, b) => a.user.username.localeCompare(b.user.username));

            if (filteredMembers.size === 0) {
              await interaction.followUp({
                content: "❌ No users found matching your criteria.",
              });
              return;
            }

            // Create embed fields for pagination (one user per field for better readability)
            const userFields = filteredMembers.first(limit).map((member) => ({
              name: `👤 ${member.displayName}`,
              value: `**Username:** @${member.user.username}\n**ID:** \`${member.user.id}\`\n**Joined:** <t:${Math.floor((member.joinedTimestamp ?? 0) / 1000)}:R>`,
              inline: true,
            }));

            // Create the embed with user data (ephemeral)
            const embed = client.genEmbed({
              title: `👥 Server Users${filter ? ` (Filtered: "${filter}")` : ""}`,
              description: `Found ${filteredMembers.size} user${filteredMembers.size === 1 ? "" : "s"}${filteredMembers.size > limit ? ` (showing first ${limit})` : ""}`,
              fields: userFields.slice(0, 25), // Discord's embed field limit
              footer: {
                text: `Total members: ${interaction.guild.memberCount} | Non-bot members: ${filteredMembers.size}`,
              },
            });

            await interaction.followUp({
              embeds: [embed],
            });
          } catch (error) {
            logger.error("Error in server users command:", error);

            const errorMessage =
              "❌ Failed to fetch server members. This may be due to missing permissions or Discord API issues.";

            await interaction.followUp({
              content: errorMessage,
            });
            return;
          }
          break;
        }

        case "commands": {
          const category = interaction.options.getString("category") ?? "all";

          const commands = Array.from(client.commands.values());
          const filteredCommands = category === "all" ? commands : commands.filter((cmd) => cmd.category === category);

          const commandsByCategory = new Map<string, typeof commands>();

          for (const command of filteredCommands) {
            const cat = command.category || "uncategorized";
            if (!commandsByCategory.has(cat)) {
              commandsByCategory.set(cat, []);
            }
            const categoryCommands = commandsByCategory.get(cat);
            if (categoryCommands) {
              categoryCommands.push(command);
            }
          }

          const fields = [];
          for (const [cat, cmds] of commandsByCategory) {
            const commandList = cmds
              .sort((a, b) => a.builder.name.localeCompare(b.builder.name))
              .map((cmd) => `\`${cmd.builder.name}\` - ${cmd.defaultPermissions.level}`)
              .join("\n");

            fields.push({
              name: `📁 ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${cmds.length})`,
              value: commandList || "No commands",
              inline: false,
            });
          }

          const embed = client.genEmbed({
            title: "🤖 Bot Commands",
            description: `Available commands${category !== "all" ? ` in ${category} category` : ""}`,
            fields: fields.slice(0, 25), // Discord limit
            footer: {
              text: `Total commands: ${filteredCommands.length}`,
            },
          });

          await interaction.followUp({
            embeds: [embed],
          });
          break;
        }

        default: {
          await interaction.followUp({
            content: "❌ Unknown subcommand",
          });
        }
      }
    } catch (error) {
      logger.error("Error in server command", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "❌ An unexpected error occurred.",
        });
      } else {
        await interaction.reply({
          content: "❌ An unexpected error occurred.",
          ephemeral: true,
        });
      }
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.Administrator],
      isConfigurable: true,
    },
  }
);
