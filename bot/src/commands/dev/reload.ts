import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { createRequire } from "node:module";

import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

const require = createRequire(import.meta.url);

class ReloadCommand extends DevCommand {
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
    this.validateDevPermissions();

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

    this.client.commands.clear();
    this.client.commandCategories.length = 0;
    this.invalidateModules((key) => key.includes("/commands/") && !key.includes("/_core/") && !key.includes("/_shared/"));

    const { commands, commandCategories } = await (this.client as any).commandLoader.loadCommands();

    commands.forEach((command: any, name: string) => this.client.commands.set(name, command));
    this.client.commandCategories.push(...commandCategories);

    logger.info(`Reloaded ${commands.size} commands across ${commandCategories.length} categories`);
  }

  private async reloadEvents(): Promise<void> {
    logger.info("Reloading events...");

    this.client.removeAllListeners();
    this.invalidateModules((key) => key.includes("/events/"));
    await (this.client as any).eventLoader.loadEvents(this.client);

    logger.info("Events reloaded successfully");
  }

  private invalidateModules(filter: (key: string) => boolean): void {
    const moduleKeys = Object.keys(require.cache);
    const matched = moduleKeys.filter(filter);

    for (const moduleKey of matched) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete require.cache[moduleKey];
    }

    logger.debug(`Invalidated ${matched.length} modules from cache`);
  }
}

export default new ReloadCommand();

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
