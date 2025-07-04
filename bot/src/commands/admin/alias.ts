import { SlashCommandBuilder } from "discord.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse, SlashCommandInteraction } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * Alias Command - Manage quick response aliases
 */
class AliasCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "alias",
      description: "Manage quick response aliases",
      category: "admin",
      permissions: {
        level: PermissionLevel.MODERATOR,
        isConfigurable: true,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const subcommand = (this.interaction as SlashCommandInteraction).options.getSubcommand();

    try {
      switch (subcommand) {
        case "create":
          return await this.handleCreate();
        case "use":
          return await this.handleUse();
        case "list":
          return await this.handleList();
        case "delete":
          return await this.handleDelete();
        case "edit":
          return await this.handleEdit();
        default:
          return {
            content: "❌ Unknown subcommand",
            ephemeral: true,
          };
      }
    } catch (error) {
      logger.error("Error in alias command:", error);
      return {
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleCreate(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true).toUpperCase();
    const content = this.getStringOption("content", true);
    const category = this.getStringOption("category") ?? "GENERAL";

    // Check if alias already exists
    const existing = await prisma.alias.findUnique({
      where: { guildId_name: { guildId: this.guild.id, name } },
    });

    if (existing) {
      return {
        content: `❌ Alias **${name}** already exists. Use \`/alias edit\` to modify it.`,
        ephemeral: true,
      };
    }

    // Create the alias
    await prisma.alias.create({
      data: {
        guildId: this.guild.id,
        name,
        content,
        category,
        createdBy: this.user.id,
      },
    });

    // Notify API of alias creation
    const customClient = this.client as any as Client;
    if (customClient.queueService) {
      try {
        customClient.queueService.processRequest({
          type: "ALIAS_UPDATE",
          data: {
            guildId: this.guild.id,
            action: "CREATE_ALIAS",
            aliasName: name,
            content: content,
            category: category,
            updatedBy: this.user.id,
          },
          source: "rest",
          userId: this.user.id,
          guildId: this.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify API of alias creation:", error);
      }
    }

    return {
      content: `✅ Created alias **${name}**\n\n📝 **Content:** ${content}\n🏷️ **Category:** ${category}\n\n💡 *Use it with \`/alias use ${name}\`*`,
      ephemeral: true,
    };
  }

  private async handleUse(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true).toUpperCase();
    const user = this.getUserOption("user");

    // Get the alias
    const alias = await prisma.alias.findUnique({
      where: { guildId_name: { guildId: this.guild.id, name } },
    });

    if (!alias) {
      return {
        content: `❌ Alias **${name}** not found. Use \`/alias list\` to see available aliases.`,
        ephemeral: true,
      };
    }

    // Process variables in content
    let content = alias.content;
    if (user) {
      content = content.replace(/\{user\}/g, `<@${user.id}>`);
    }
    content = content.replace(/\{server\}/g, this.guild.name);
    content = content.replace(/\{moderator\}/g, `<@${this.user.id}>`);

    // Update usage count
    await prisma.alias.update({
      where: { id: alias.id },
      data: { usageCount: { increment: 1 } },
    });

    // Send the alias content
    return {
      content,
      ephemeral: false,
    };
  }

  private async handleList(): Promise<CommandResponse> {
    const category = this.getStringOption("category");

    const aliases = await prisma.alias.findMany({
      where: {
        guildId: this.guild.id,
        ...(category && { category }),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    if (aliases.length === 0) {
      return {
        content: `📝 No aliases found${category ? ` in category **${category}**` : ""}.\n\n💡 *Create one with \`/alias create\`*`,
        ephemeral: true,
      };
    }

    // Group by category
    const grouped: Record<string, typeof aliases> = {};
    for (const alias of aliases) {
      const category = alias.category;
      grouped[category] = grouped[category] ?? [];
      grouped[category].push(alias);
    }

    const embed = this.client.genEmbed({
      title: `📝 Server Aliases${category ? ` - ${category}` : ""}`,
      description: `Found ${aliases.length} alias${aliases.length !== 1 ? "es" : ""}`,
      fields: Object.entries(grouped).map(([cat, catAliases]) => ({
        name: `🏷️ ${cat}`,
        value: catAliases
          .map((alias: (typeof aliases)[0]) => `**${alias.name}** (used ${alias.usageCount} times)`)
          .join("\n"),
        inline: false,
      })),
      footer: { text: "Use /alias use <name> to use an alias" },
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleDelete(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true).toUpperCase();

    const alias = await prisma.alias.findUnique({
      where: { guildId_name: { guildId: this.guild.id, name } },
    });

    if (!alias) {
      return {
        content: `❌ Alias **${name}** not found.`,
        ephemeral: true,
      };
    }

    await prisma.alias.delete({
      where: { id: alias.id },
    });

    // Notify API of alias deletion
    const customClient = this.client as any as Client;
    if (customClient.queueService) {
      try {
        customClient.queueService.processRequest({
          type: "ALIAS_UPDATE",
          data: {
            guildId: this.guild.id,
            action: "DELETE_ALIAS",
            aliasName: name,
            updatedBy: this.user.id,
          },
          source: "rest",
          userId: this.user.id,
          guildId: this.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify API of alias deletion:", error);
      }
    }

    return {
      content: `✅ Deleted alias **${name}**`,
      ephemeral: true,
    };
  }

  private async handleEdit(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true).toUpperCase();
    const content = this.getStringOption("content", true);

    const alias = await prisma.alias.findUnique({
      where: { guildId_name: { guildId: this.guild.id, name } },
    });

    if (!alias) {
      return {
        content: `❌ Alias **${name}** not found.`,
        ephemeral: true,
      };
    }

    await prisma.alias.update({
      where: { id: alias.id },
      data: { content },
    });

    // Notify API of alias edit
    const customClient = this.client as any as Client;
    if (customClient.queueService) {
      try {
        customClient.queueService.processRequest({
          type: "ALIAS_UPDATE",
          data: {
            guildId: this.guild.id,
            action: "EDIT_ALIAS",
            aliasName: name,
            newContent: content,
            updatedBy: this.user.id,
          },
          source: "rest",
          userId: this.user.id,
          guildId: this.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify API of alias edit:", error);
      }
    }

    return {
      content: `✅ Updated alias **${name}**\n\n📝 **New content:** ${content}`,
      ephemeral: true,
    };
  }
}

// Export the command instance
export default new AliasCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
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
  );
