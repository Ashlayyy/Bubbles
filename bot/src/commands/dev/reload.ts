import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { BaseCommand } from "../_core/BaseCommand.js";

export const builder = new SlashCommandBuilder()
  .setName("reload")
  .setDescription("[DEV] Hot-reload commands and events")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("What to reload")
      .setRequired(false)
      .addChoices(
        { name: "commands", value: "commands" },
        { name: "events", value: "events" },
        { name: "all", value: "all" }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export default class ReloadCommand extends BaseCommand {
  enabledOnDev = true;

  async run(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
    // Only allow in development mode
    if (!client.devMode) {
      await interaction.reply({
        content: "❌ This command is only available in development mode!",
        ephemeral: true,
      });
      return;
    }

    const type = interaction.options.getString("type") ?? "all";

    await interaction.deferReply({ ephemeral: true });

    try {
      logger.info(`Dev reload requested by ${interaction.user.tag}: ${type}`);

      if (type === "commands" || type === "all") {
        await this.reloadCommands(client);
      }

      if (type === "events" || type === "all") {
        await this.reloadEvents(client);
      }

      await interaction.editReply({
        content: `✅ Successfully reloaded: **${type}**`,
      });

      logger.info(`Dev reload completed: ${type}`);
    } catch (error) {
      logger.error("Dev reload failed:", error);
      await interaction.editReply({
        content: `❌ Reload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  private async reloadCommands(client: Client): Promise<void> {
    logger.info("Reloading commands...");

    // Clear existing commands
    client.commands.clear();
    client.commandCategories.length = 0;

    // Invalidate module cache for command files
    this.invalidateCommandModules();

    // Reload commands using the command loader
    const { commands, commandCategories } = await client.commandLoader.loadCommands();

    // Update client collections
    commands.forEach((command, name) => client.commands.set(name, command));
    client.commandCategories.push(...commandCategories);

    logger.info(`Reloaded ${commands.size} commands across ${commandCategories.length} categories`);
  }

  private async reloadEvents(client: Client): Promise<void> {
    logger.info("Reloading events...");

    // Remove all existing listeners
    client.removeAllListeners();

    // Invalidate module cache for event files
    this.invalidateEventModules();

    // Reload events using the event loader
    await client.eventLoader.loadEvents(client);

    logger.info("Events reloaded successfully");
  }

  private invalidateCommandModules(): void {
    // Get all loaded modules and invalidate command-related ones
    const moduleCache = require.cache;
    if (!moduleCache) return;

    const moduleKeys = Object.keys(moduleCache);
    const commandModules = moduleKeys.filter(
      (key) => key.includes("/commands/") && !key.includes("/_core/") && !key.includes("/_shared/")
    );

    for (const moduleKey of commandModules) {
      if (moduleCache[moduleKey]) {
        delete moduleCache[moduleKey];
      }
    }

    logger.debug(`Invalidated ${commandModules.length} command modules from cache`);
  }

  private invalidateEventModules(): void {
    // Get all loaded modules and invalidate event-related ones
    const moduleCache = require.cache;
    if (!moduleCache) return;

    const moduleKeys = Object.keys(moduleCache);
    const eventModules = moduleKeys.filter((key) => key.includes("/events/"));

    for (const moduleKey of eventModules) {
      if (moduleCache[moduleKey]) {
        delete moduleCache[moduleKey];
      }
    }

    logger.debug(`Invalidated ${eventModules.length} event modules from cache`);
  }
}
