import { Collection } from "discord.js";
import { BaseCommand } from "../../commands/_core/BaseCommand.js";
import { forNestedDirsFiles, importDefaultESM } from "../../functions/general/fs.js";
import { camel2Display } from "../../functions/general/strings.js";
import logger from "../../logger.js";
import Command, { isCommand } from "../Command.js";

export interface CommandMetadata {
  lazy?: boolean;
  filePath?: string;
}

export class CommandLoader {
  private commands = new Collection<string, BaseCommand | Command>();
  private commandCategories: string[] = [];
  private lazyCommands = new Map<string, string>(); // commandName -> filePath
  private devMode: boolean;

  constructor(devMode: boolean) {
    this.devMode = devMode;
  }

  async loadCommands(): Promise<{ commands: Collection<string, BaseCommand | Command>; commandCategories: string[] }> {
    logger.info("Loading commands");

    const commandsDir = this.devMode ? "./src/commands" : "./build/bot/src/commands";
    const loadedCommandFiles = new Set<string>();

    const processCommandFile = async (commandFilePath: string, category: string) => {
      if (loadedCommandFiles.has(commandFilePath)) {
        return;
      }

      // Skip helper directories
      if (category === "_core" || category === "_shared") {
        return;
      }

      if (category === "dev" && !this.devMode) {
        logger.error(new Error(`Development only commands are present in production environment`));
        process.exit(1);
      }

      // Check for lazy loading metadata
      const command = await importDefaultESM(commandFilePath, isCommand);
      const metadata = (command as BaseCommand & { metadata?: CommandMetadata }).metadata;

      if (metadata?.lazy) {
        // Store for lazy loading
        const commandName = await this.getCommandName(command, category, commandFilePath);
        this.lazyCommands.set(commandName, commandFilePath);
        logger.debug(`\t\t${commandName} (lazy)`);
        loadedCommandFiles.add(commandFilePath);
        return;
      }

      // Load immediately
      await this.loadSingleCommand(command, category, commandFilePath);
      loadedCommandFiles.add(commandFilePath);
    };

    // Load top-level command categories
    await forNestedDirsFiles(commandsDir, processCommandFile);

    // Load context menu commands
    const contextMenuDir = `${commandsDir}/context`;
    await forNestedDirsFiles(contextMenuDir, processCommandFile);

    logger.debug("Successfully loaded commands");
    return { commands: this.commands, commandCategories: this.commandCategories };
  }

  private async loadSingleCommand(
    command: BaseCommand | Command,
    category: string,
    commandFilePath: string
  ): Promise<void> {
    command.category = category;

    const commandName = await this.getCommandName(command, category, commandFilePath);

    // Add category to list
    if (category !== "context" && category !== "message" && category !== "user") {
      if (!this.commandCategories.includes(category)) {
        logger.debug(`\t${camel2Display(category)}`);
        this.commandCategories.push(category);
      }
    }

    this.commands.set(commandName, command);
    logger.debug(`\t\t${commandName}`);
  }

  private async getCommandName(
    command: BaseCommand | Command,
    category: string,
    commandFilePath: string
  ): Promise<string> {
    if (command instanceof BaseCommand) {
      try {
        // Import builder for BaseCommand
        const path = await import("path");
        const url = await import("url");
        const normalizedPath = commandFilePath.replace(/\\/g, "/");
        const absolutePath = path.resolve(normalizedPath);
        const fileUrl = url.pathToFileURL(absolutePath).href;

        const module = (await import(fileUrl)) as { builder?: { name?: string; toJSON?: () => unknown } };
        const builder = module.builder;
        if (builder && typeof builder.toJSON === "function") {
          (command as BaseCommand & { builder: unknown }).builder = builder;
          return builder.name ?? `${category}-basecommand-${this.commands.size}`;
        } else {
          logger.warn(`BaseCommand at ${commandFilePath} has no valid builder export`);
          return `${category}-basecommand-${this.commands.size}`;
        }
      } catch (error) {
        logger.warn(`Failed to load builder for BaseCommand at ${commandFilePath}:`, error);
        return `${category}-basecommand-${this.commands.size}`;
      }
    } else {
      return command.builder.name;
    }
  }

  async loadLazyCommand(commandName: string): Promise<BaseCommand | Command | null> {
    const filePath = this.lazyCommands.get(commandName);
    if (!filePath) return null;

    try {
      const command = await importDefaultESM(filePath, isCommand);
      // Determine category from file path
      const pathParts = filePath.split("/");
      const category = pathParts[pathParts.length - 2] ?? "unknown";

      await this.loadSingleCommand(command, category, filePath);
      this.lazyCommands.delete(commandName); // Remove from lazy map

      return command;
    } catch (error) {
      logger.error(`Failed to lazy load command ${commandName}:`, error);
      return null;
    }
  }

  getCommand(commandName: string): BaseCommand | Command | null {
    return this.commands.get(commandName) ?? null;
  }

  async getOrLoadCommand(commandName: string): Promise<BaseCommand | Command | null> {
    const existing = this.getCommand(commandName);
    if (existing) return existing;

    // Try lazy loading
    return await this.loadLazyCommand(commandName);
  }
}
