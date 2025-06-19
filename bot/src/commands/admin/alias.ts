import { SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("alias")
    .setDescription("Manage quick response aliases")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new alias")
        .addStringOption((opt) => opt.setName("name").setDescription("Alias name (e.g., 'NSFW')").setRequired(true))
        .addStringOption((opt) =>
          opt.setName("content").setDescription("Full text content for the alias").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("category")
            .setDescription("Category for organization")
            .setRequired(false)
            .addChoices(
              { name: "General", value: "GENERAL" },
              { name: "Moderation", value: "MODERATION" },
              { name: "Support", value: "SUPPORT" },
              { name: "Rules", value: "RULES" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("use")
        .setDescription("Use an alias")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("Alias name to use").setRequired(true).setAutocomplete(true)
        )
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Mention a specific user in the response").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all aliases")
        .addStringOption((opt) =>
          opt
            .setName("category")
            .setDescription("Filter by category")
            .setRequired(false)
            .addChoices(
              { name: "General", value: "GENERAL" },
              { name: "Moderation", value: "MODERATION" },
              { name: "Support", value: "SUPPORT" },
              { name: "Rules", value: "RULES" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete an alias")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("Alias name to delete").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing alias")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("Alias name to edit").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) => opt.setName("content").setDescription("New content for the alias").setRequired(true))
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "create": {
          const name = interaction.options.getString("name", true).toUpperCase();
          const content = interaction.options.getString("content", true);
          const category = interaction.options.getString("category") ?? "GENERAL";

          // Check if alias already exists
          const existing = await prisma.alias.findUnique({
            where: { guildId_name: { guildId: interaction.guild.id, name } },
          });

          if (existing) {
            await interaction.reply({
              content: `❌ Alias **${name}** already exists. Use \`/alias edit\` to modify it.`,
              ephemeral: true,
            });
            return;
          }

          // Create the alias
          await prisma.alias.create({
            data: {
              guildId: interaction.guild.id,
              name,
              content,
              category,
              createdBy: interaction.user.id,
            },
          });

          // Notify API of alias creation
          const customClient = client as any as Client;
          if (customClient.queueService) {
            try {
              await customClient.queueService.processRequest({
                type: "ALIAS_UPDATE",
                data: {
                  guildId: interaction.guild.id,
                  action: "CREATE_ALIAS",
                  aliasName: name,
                  content: content,
                  category: category,
                  updatedBy: interaction.user.id,
                },
                source: "rest",
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                requiresReliability: true,
              });
            } catch (error) {
              console.warn("Failed to notify API of alias creation:", error);
            }
          }

          await interaction.reply({
            content: `✅ Created alias **${name}**\n\n📝 **Content:** ${content}\n🏷️ **Category:** ${category}\n\n💡 *Use it with \`/alias use ${name}\`*`,
            ephemeral: true,
          });
          break;
        }

        case "use": {
          const name = interaction.options.getString("name", true).toUpperCase();
          const user = interaction.options.getUser("user");

          // Get the alias
          const alias = await prisma.alias.findUnique({
            where: { guildId_name: { guildId: interaction.guild.id, name } },
          });

          if (!alias) {
            await interaction.reply({
              content: `❌ Alias **${name}** not found. Use \`/alias list\` to see available aliases.`,
              ephemeral: true,
            });
            return;
          }

          // Process variables in content
          let content = alias.content;
          if (user) {
            content = content.replace(/\{user\}/g, `<@${user.id}>`);
          }
          content = content.replace(/\{server\}/g, interaction.guild.name);
          content = content.replace(/\{moderator\}/g, `<@${interaction.user.id}>`);

          // Update usage count
          await prisma.alias.update({
            where: { id: alias.id },
            data: { usageCount: { increment: 1 } },
          });

          // Send the alias content
          await interaction.reply({
            content,
            allowedMentions: { users: user ? [user.id] : [] },
          });
          break;
        }

        case "list": {
          const category = interaction.options.getString("category");

          const aliases = await prisma.alias.findMany({
            where: {
              guildId: interaction.guild.id,
              ...(category && { category }),
            },
            orderBy: [{ category: "asc" }, { name: "asc" }],
          });

          if (aliases.length === 0) {
            await interaction.reply({
              content: `📝 No aliases found${category ? ` in category **${category}**` : ""}.\n\n💡 *Create one with \`/alias create\`*`,
              ephemeral: true,
            });
            return;
          }

          // Group by category
          const grouped = aliases.reduce((acc: Record<string, typeof aliases>, alias: (typeof aliases)[0]) => {
            const category = alias.category;
            acc[category] = acc[category] ?? [];
            acc[category]!.push(alias);
            return acc;
          }, {});

          const embed = client.genEmbed({
            title: `📝 Server Aliases${category ? ` - ${category}` : ""}`,
            description: `Found ${aliases.length.toString()} alias${aliases.length !== 1 ? "es" : ""}`,
            fields: Object.entries(grouped).map(([cat, catAliases]) => ({
              name: `🏷️ ${cat}`,
              value: (catAliases as typeof aliases)
                .map((alias: (typeof aliases)[0]) => `**${alias.name}** (used ${alias.usageCount.toString()} times)`)
                .join("\n"),
              inline: false,
            })),
            footer: { text: "Use /alias use <name> to use an alias" },
          });

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case "delete": {
          const name = interaction.options.getString("name", true).toUpperCase();

          const alias = await prisma.alias.findUnique({
            where: { guildId_name: { guildId: interaction.guild.id, name } },
          });

          if (!alias) {
            await interaction.reply({
              content: `❌ Alias **${name}** not found.`,
              ephemeral: true,
            });
            return;
          }

          await prisma.alias.delete({
            where: { id: alias.id },
          });

          // Notify API of alias deletion
          const customClient = client as any as Client;
          if (customClient.queueService) {
            try {
              await customClient.queueService.processRequest({
                type: "ALIAS_UPDATE",
                data: {
                  guildId: interaction.guild.id,
                  action: "DELETE_ALIAS",
                  aliasName: name,
                  updatedBy: interaction.user.id,
                },
                source: "rest",
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                requiresReliability: true,
              });
            } catch (error) {
              console.warn("Failed to notify API of alias deletion:", error);
            }
          }

          await interaction.reply({
            content: `✅ Deleted alias **${name}**`,
            ephemeral: true,
          });
          break;
        }

        case "edit": {
          const name = interaction.options.getString("name", true).toUpperCase();
          const content = interaction.options.getString("content", true);

          const alias = await prisma.alias.findUnique({
            where: { guildId_name: { guildId: interaction.guild.id, name } },
          });

          if (!alias) {
            await interaction.reply({
              content: `❌ Alias **${name}** not found.`,
              ephemeral: true,
            });
            return;
          }

          await prisma.alias.update({
            where: { id: alias.id },
            data: { content },
          });

          // Notify API of alias edit
          const customClient = client as any as Client;
          if (customClient.queueService) {
            try {
              await customClient.queueService.processRequest({
                type: "ALIAS_UPDATE",
                data: {
                  guildId: interaction.guild.id,
                  action: "EDIT_ALIAS",
                  aliasName: name,
                  newContent: content,
                  updatedBy: interaction.user.id,
                },
                source: "rest",
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                requiresReliability: true,
              });
            } catch (error) {
              console.warn("Failed to notify API of alias edit:", error);
            }
          }

          await interaction.reply({
            content: `✅ Updated alias **${name}**\n\n📝 **New content:** ${content}`,
            ephemeral: true,
          });
          break;
        }

        default: {
          await interaction.reply({
            content: "❌ Unknown subcommand",
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      logger.error("Error in alias command:", error);
      await interaction.reply({
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.MODERATOR,
      isConfigurable: true,
    },
  }
);
