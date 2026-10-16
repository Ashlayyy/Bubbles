import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { BaseCommand } from "../_core/BaseCommand.js";
import type { CommandConfig, CommandResponse } from "../_core/types.js";

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

class ReloadCommand extends BaseCommand {
  enabledOnDev = true;

  constructor() {
    const config: CommandConfig = {
      name: "reload",
      description: "[DEV] Hot-reload commands and events",
      category: "dev",
      ephemeral: true,
      guildOnly: false,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    // Only allow in development mode
    if (!this.client.devMode) {
      return {
        content: "❌ This command is only available in development mode!",
        ephemeral: true,
      };
    }

    const type = this.getStringOption("type") ?? "all";

    try {
      logger.info(`Dev reload requested by ${this.user.tag}: ${type}`);

      if (type === "commands" || type === "all") {
        await this.reloadCommands();
      }

      if (type === "events" || type === "all") {
        await this.reloadEvents();
      }

      logger.info(`Dev reload completed: ${type}`);

      return {
        content: `✅ Successfully reloaded: **${type}**`,
        ephemeral: true,
      };
    } catch (error) {
      logger.error("Dev reload failed:", error);
      return {
        content: `❌ Reload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async reloadCommands(): Promise<void> {
    logger.info("Reloading commands...");

    // Clear existing commands
    this.client.commands.clear();
    this.client.commandCategories.length = 0;

    // Invalidate module cache for command files
    this.invalidateCommandModules();

    // Reload commands using the command loader
    const { commands, commandCategories } = await (this.client as any).commandLoader.loadCommands();

    // Update client collections
    commands.forEach((command: any, name: string) => this.client.commands.set(name, command));
    this.client.commandCategories.push(...commandCategories);

    logger.info(`Reloaded ${commands.size} commands across ${commandCategories.length} categories`);
  }

  private async reloadEvents(): Promise<void> {
    logger.info("Reloading events...");

    // Remove all existing listeners
    this.client.removeAllListeners();

    // Invalidate module cache for event files
    this.invalidateEventModules();

    // Reload events using the event loader
    await (this.client as any).eventLoader.loadEvents(this.client);

    logger.info("Events reloaded successfully");
  }

  private invalidateCommandModules(): void {
    // Get all loaded modules and invalidate command-related ones
    const moduleCache = require.cache;

    const moduleKeys = Object.keys(moduleCache);
    const commandModules = moduleKeys.filter(
      (key) => key.includes("/commands/") && !key.includes("/_core/") && !key.includes("/_shared/")
    );

    for (const moduleKey of commandModules) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete moduleCache[moduleKey];
    }

    logger.debug(`Invalidated ${commandModules.length} command modules from cache`);
  }

  private invalidateEventModules(): void {
    // Get all loaded modules and invalidate event-related ones
    const moduleCache = require.cache;

    const moduleKeys = Object.keys(moduleCache);
    const eventModules = moduleKeys.filter((key) => key.includes("/events/"));

    for (const moduleKey of eventModules) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete moduleCache[moduleKey];
    }

    logger.debug(`Invalidated ${eventModules.length} event modules from cache`);
  }
}

export default new ReloadCommand();
