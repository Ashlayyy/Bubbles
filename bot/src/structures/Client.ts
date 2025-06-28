import type {
  ChatInputCommandInteraction,
  EmbedData,
  EmbedField,
  GuildMember,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  Colors,
  Client as DiscordClient,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} from "discord.js";

import type { BotConfig } from "../botConfig.js";
import { getConfigFile } from "../botConfig.js";
import { BaseCommand } from "../commands/_core/BaseCommand.js";
import { getGuildConfig } from "../database/GuildConfig.js";
import { connect as connectToDB } from "../database/index.js";
import { isDevEnvironment } from "../functions/general/environment.js";
import { forNestedDirsFiles, importDefaultESM } from "../functions/general/fs.js";
import { camel2Display, isOnlyDigits } from "../functions/general/strings.js";
import logger from "../logger.js";
import { UnifiedQueueService } from "../services/unifiedQueueService.js";
import { WebSocketService } from "../services/websocketService.js";
import Command, { isCommand } from "./Command.js";
import { EventEmitterType, eventEmitterTypeFromDir, isBaseEvent } from "./Event.js";
import LogManager from "./LogManager.js";
import ModerationManager from "./ModerationManager.js";
import PermissionManager from "./PermissionManager.js";

export enum DiscordAPIAction {
  /** Update commands. Will NOT remove commands with names that are no longer in use! */
  Register = 0,
  /** Reset commands to empty. */
  Reset = 1,
}

interface SendMultiPageEmbedOptions {
  maxFieldsPerEmbed: number;
  otherEmbedData: Partial<Omit<EmbedData, "fields">>;
  otherReplyOptions: Partial<Omit<InteractionReplyOptions & InteractionUpdateOptions, "embeds" | "components">>;
}

export default class Client extends DiscordClient {
  /** Singleton instance */
  private static instance?: Client;
  readonly config: BotConfig;
  readonly version: string;
  /** Development mode enables additional features & ensures environment variable requirements are properly set */
  readonly devMode: boolean;
  private started = false;
  /** All loaded commands from disk, indexed by command name */
  readonly commands: Collection<string, BaseCommand | Command> = new Collection<string, BaseCommand | Command>();
  readonly commandCategories: string[] = [];

  // Add the managers
  readonly logManager: LogManager;
  readonly moderationManager: ModerationManager;

  // WebSocket service for API communication
  public wsService: WebSocketService | null = null;
  // Queue service for unified queue processing
  public queueService: UnifiedQueueService | null = null;
  // Health service for monitoring
  public healthService: any = null;

  /** Get/Generate singleton instance */
  static async get() {
    if (!Client.instance) {
      Client.instance = new this();

      try {
        /* Would like these two to be in constructor, but await is not allowed in constructor */
        await Client.instance.loadEvents();
        await Client.instance.loadCommands();
      } catch (error) {
        logger.error(error);
        logger.error(new Error("Could not load bot files!"));
        process.exit(1);
      }

      logger.info("*** DISCORD.JS BOT: CONSTRUCTION DONE ***");
    }
    return Client.instance;
  }

  private constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
      allowedMentions: { repliedUser: false },
      // Shard configuration - ShardingManager will automatically set this when running in shard mode
      // When running directly, it will use internal sharding if needed
    });

    try {
      logger.info("*** DISCORD.JS BOT: CONSTRUCTION ***");

      this.devMode = isDevEnvironment();
      logger.info(`Loading in ${this.devMode ? "DEVELOPMENT" : "PRODUCTION"} MODE`);

      this.version = process.env.npm_package_version ?? "UNKNOWN";
      logger.verbose(`Bot version: ${this.version}`);

      logger.verbose("Verifying environment variables are set in a valid form... ");

      // Always required environment variables
      /* eslint-disable @typescript-eslint/no-unnecessary-condition */
      if (process.env.DISCORD_TOKEN === undefined)
        throw new ReferenceError("DISCORD_TOKEN environment variable was not set!");
      if (process.env.DB_URL === undefined) throw new ReferenceError("DB_URL environment variable was not set!");
      if (process.env.DISCORD_CLIENT_ID === undefined) {
        throw new ReferenceError("DISCORD_CLIENT_ID environment variable was not set!");
      } else {
        // Validate form of DISCORD_CLIENT_ID
        if (!isOnlyDigits(process.env.DISCORD_CLIENT_ID)) {
          throw new TypeError("DISCORD_CLIENT_ID environment variable must contain only digits!");
        }
      }
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */

      // Development environment variables
      if (this.devMode) {
        if (process.env.TEST_GUILD_ID === undefined) {
          throw new ReferenceError("TEST_GUILD_ID environment variable was not set!");
        } else {
          // Validate form of TEST_GUILD_ID
          if (!isOnlyDigits(process.env.TEST_GUILD_ID)) {
            throw new TypeError("TEST_GUILD_ID environment variable must contain only digits!");
          }
        }
      }
      logger.verbose("Successfully verified that environment variables are set in a valid form!");
      logger.warn(
        "Note that environment variable *values* can NOT be verified. They may still error at first use if the value(s) are invalid!"
      );

      logger.info("Loading config file");
      this.config = getConfigFile();
      logger.info(`Loaded config for "${this.config.name}"`);

      // Initialize managers
      logger.info("Initializing managers");
      this.logManager = new LogManager(this);
      this.moderationManager = new ModerationManager(this, this.logManager);

      // Initialize WebSocket service for API communication
      this.wsService = null; // Will be initialized after login
    } catch (error) {
      logger.error(error);
      logger.error(new Error("Could not construct bot!"));
      process.exit(1);
    }
  }

  /** Start bot by connecting to external server(s). Namely, Discord itself */
  async start(): Promise<void> {
    if (this.started) {
      logger.warn("Client is already started. Do not need to call `Client.start()` again.");
      return;
    }

    try {
      if (this.devMode) await this.manageDiscordAPICommands(DiscordAPIAction.Register);

      await connectToDB();

      // Initialize cache and batch services
      logger.info("Initializing cache and batch operation services...");
      const { cacheService } = await import("../services/cacheService.js");
      const { batchOperationManager } = await import("../services/batchOperationManager.js");

      // Warm up cache with current guilds if any
      const guildIds = this.guilds.cache.map((guild) => guild.id);
      if (guildIds.length > 0) {
        logger.info(`Warming up cache for ${guildIds.length} guilds...`);
        cacheService.warmup(guildIds);
      }

      logger.info("Logging into Discord... ");
      await this.login(process.env.DISCORD_TOKEN);

      // Start queue processing
      logger.info("Starting queue processors...");
      await this.startQueueProcessors();

      // Initialize WebSocket service for API communication
      try {
        logger.info("Initializing WebSocket service for API communication...");
        const { WebSocketService } = await import("../services/websocketService.js");
        const { DiscordEventForwarder } = await import("../services/discordEventForwarder.js");

        this.wsService = new WebSocketService(this);

        // Set up error handling
        this.wsService.on("auth_failed", (error: unknown) => {
          logger.error("Failed to authenticate WebSocket service:", error);
        });

        // Connect WebSocket service
        this.wsService.connect();

        // Set up Discord event forwarding
        new DiscordEventForwarder(this, this.wsService);

        logger.info("WebSocket service initialized and event forwarding setup complete");
      } catch (error) {
        logger.error("Failed to initialize WebSocket service:", error);
        logger.warn("Bot will continue without API WebSocket connection");
      }

      // Initialize health service
      try {
        logger.info("Initializing health monitoring service...");
        const { BotHealthService } = await import("../services/healthService.js");
        this.healthService = BotHealthService.getInstance(this);
        logger.info("Health monitoring service initialized");
      } catch (error) {
        logger.error("Failed to initialize health service:", error);
        logger.warn("Bot will continue without health monitoring");
      }

      this.started = true;

      // Log cache statistics after startup
      const stats = cacheService.getStats();
      logger.info(
        `Cache service ready - Memory entries: ${stats.memoryEntries}, Redis connected: ${stats.redisConnected}`
      );
    } catch (error) {
      logger.error(error);
      logger.error(new Error("Could not start the bot! Make sure your environment variables are valid!"));
      process.exit(1);
    }
  }

  /** Start queue processors */
  private async startQueueProcessors(): Promise<void> {
    try {
      const { UnifiedQueueService } = await import("../services/unifiedQueueService.js");
      const queueService = new UnifiedQueueService(this);
      await queueService.initialize();

      // Store reference for access throughout the application
      this.queueService = queueService;

      logger.info("Unified Queue Service initialization completed");
    } catch (error) {
      logger.error("Failed to initialize unified queue service:", error);
      logger.warn("Bot will continue with fallback mode for queue operations");
    }
  }

  /** Load slash commands */
  private async loadCommands(): Promise<void> {
    logger.info("Loading commands");

    const commandsDir = this.devMode ? "./src/commands" : "./build/bot/src/commands";

    // Use a Set to avoid duplicates if a command is somehow in multiple places
    const loadedCommandFiles = new Set<string>();

    const processCommandFile = async (commandFilePath: string, category: string) => {
      if (loadedCommandFiles.has(commandFilePath)) {
        return; // Already loaded this file, skip.
      }

      // Skip helper directories that contain base classes and utilities
      if (category === "_core" || category === "_shared") {
        return;
      }

      if (category === "dev" && !this.devMode) {
        logger.error(new Error(`Development only commands are present in production environment`));
        process.exit(1);
      }

      const command = await importDefaultESM(commandFilePath, isCommand);

      // Set category for both command types
      command.category = category;

      // Handle command name and builder
      let commandName: string;
      if (command instanceof BaseCommand) {
        // For BaseCommand, we need to import the builder separately
        try {
          // Convert file path to proper import URL for ES modules (same approach as importDefaultESM)
          const path = await import("path");
          const url = await import("url");
          const normalizedPath = commandFilePath.replace(/\\/g, "/");
          const absolutePath = path.resolve(normalizedPath);
          const fileUrl = url.pathToFileURL(absolutePath).href;

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const module = await import(fileUrl);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const builder = module.builder;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (builder && typeof builder.toJSON === "function") {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            command.builder = builder;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            commandName = (builder.name as string) || `${category}-basecommand-${this.commands.size}`;
          } else {
            logger.warn(`BaseCommand at ${commandFilePath} has no valid builder export`);
            commandName = `${category}-basecommand-${this.commands.size}`;
          }
        } catch (error) {
          logger.warn(`Failed to load builder for BaseCommand at ${commandFilePath}:`, error);
          commandName = `${category}-basecommand-${this.commands.size}`;
        }
      } else {
        // For legacy Command instances, the builder is already attached
        commandName = command.builder.name;
      }

      // Only add slash command categories to the user-facing list
      if (category !== "context" && category !== "message" && category !== "user") {
        if (!this.commandCategories.includes(category)) {
          logger.debug(`\t${camel2Display(category)}`);
          this.commandCategories.push(category);
        }
      }

      this.commands.set(commandName, command);
      loadedCommandFiles.add(commandFilePath);

      logger.debug(`\t\t${commandName}`);
    };

    // Load top-level command categories (admin, general, etc.)
    await forNestedDirsFiles(commandsDir, processCommandFile);

    // Load context menu command categories (message, user)
    const contextMenuDir = `${commandsDir}/context`;
    await forNestedDirsFiles(contextMenuDir, processCommandFile);

    logger.debug("Successfully loaded commands");
  }

  /**
   * Manage this bots registered commands with the Discord API.
   *
   * This should typically ONLY BE RUN MANUALLY via npm scripts.
   *
   * Options are in {@link DiscordAPIAction}
   *
   * If `devMode` property is false, will register commands to all guilds/servers this bot is in (
   * {@link https://discordjs.guide/interactions/slash-commands.html#global-commands may take up to 1 hour to register changes})
   */
  async manageDiscordAPICommands(action: DiscordAPIAction): Promise<void> {
    let actionDescriptor: string;
    let commandDataArr: RESTPostAPIApplicationCommandsJSONBody[];
    switch (action) {
      case DiscordAPIAction.Register: {
        if (this.commands.size < 1) {
          throw new Error(`Must run Client.loadCommands() first (runs in constructor)!`);
        }

        actionDescriptor = "register";
        // Only register BaseCommand instances with valid builders
        const commandsToRegister = this.commands.filter((command) => {
          // Only include BaseCommand instances that have valid builders and are enabled
          if (command instanceof BaseCommand) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return command.enabledOnDev && command.builder && typeof command.builder.toJSON === "function";
          }
          // Skip all legacy Command instances
          return false;
        });

        const skippedCommands = this.commands.filter((command) => {
          if (command instanceof BaseCommand) {
            // Count BaseCommand instances without builders or disabled as "skipped"
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return !command.enabledOnDev || !command.builder || typeof command.builder.toJSON !== "function";
          } else {
            // All legacy Command instances are skipped
            return true;
          }
        });

        if (skippedCommands.size > 0) {
          logger.info(
            `Skipping ${skippedCommands.size} commands (legacy Command instances and disabled/invalid BaseCommand instances)`
          );

          // Log which legacy commands are being skipped
          const legacyCommands = this.commands.filter((command) => !(command instanceof BaseCommand));
          if (legacyCommands.size > 0) {
            logger.warn(`Legacy Command instances not registered: ${Array.from(legacyCommands.keys()).join(", ")}`);
            logger.warn(`These commands need to be migrated to BaseCommand structure to register with Discord.`);
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        commandDataArr = commandsToRegister.map((command) => {
          // All commands in this array are BaseCommand instances due to filtering above
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return (command as BaseCommand).builder.toJSON();
        });

        logger.info("Registering commands with Discord API", {
          commands: { raw: this.commands, json: commandDataArr },
        });
        break;
      }
      case DiscordAPIAction.Reset: {
        actionDescriptor = "reset";
        commandDataArr = [];

        logger.info("Resetting commands with Discord API");
        break;
      }
      default: {
        throw new Error(`Invalid action type!`);
      }
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
      // Environment variables are validated in constructor, so they're guaranteed to exist
      const clientId = process.env.DISCORD_CLIENT_ID;
      const testGuildId = process.env.TEST_GUILD_ID;

      if (!clientId || !testGuildId) {
        throw new Error("DISCORD_CLIENT_ID and TEST_GUILD_ID must be set in the environment variables");
      }

      if (this.devMode) {
        logger.info(`\tDEVELOPMENT MODE. Only working in guild with "TEST_GUILD_ID" environment variable`);

        const fullRoute = Routes.applicationGuildCommands(clientId, testGuildId);

        await rest.put(fullRoute, {
          body: commandDataArr,
        });
      } else {
        logger.info(
          "\tPRODUCTION MODE. Working on all server(s) this bot is in. Can take up to one hour to register changes"
        );

        const fullRoute = Routes.applicationCommands(clientId);

        await rest.put(fullRoute, {
          body: commandDataArr,
        });
      }

      logger.info(
        `\tSuccessfully ${actionDescriptor} ${
          this.devMode ? "test guild development" : "global production"
        } commands with Discord API!`
      );
    } catch (error) {
      logger.error(error);
      logger.error(new Error(`Errored attempting to ${actionDescriptor} commands with Discord API!`));
    }
  }

  /** Load events */
  private async loadEvents(): Promise<void> {
    logger.info("Loading events");

    const eventsDir = this.devMode ? "./src/events" : "./build/bot/src/events";
    console.log(eventsDir);
    const eventEmitterTypes: EventEmitterType[] = [];
    await forNestedDirsFiles(eventsDir, async (eventFilePath, dir, file) => {
      // Validate directory
      const eventEmitterType = eventEmitterTypeFromDir(dir);
      if (!eventEmitterTypes.includes(eventEmitterType)) {
        logger.debug(`\t${camel2Display(EventEmitterType[eventEmitterType])}`);
        eventEmitterTypes.push(eventEmitterType);
      }

      // Load module
      const event = await importDefaultESM(eventFilePath, isBaseEvent);
      const eventFileName = file.replace(/\.[^/.]+$/, "");

      // Bind event to its corresponding event emitter
      if (eventEmitterType === EventEmitterType.Client && event.isClient()) {
        event.bindToEventEmitter(this);
      } else if (eventEmitterType === EventEmitterType.Prisma && event.isPrisma()) {
        event.bindToEventEmitter();
      } else {
        throw new Error(
          `Event file does not match expected emitter type ("${EventEmitterType[eventEmitterType]}"): "${eventFileName}"` +
            `. ` +
            `This file probably belongs in a different directory (i.e. ...events/client instead of ...events/prisma)`
        );
      }

      // Log now to signify loading this file is complete
      if (event.event !== eventFileName) {
        logger.debug(`\t\t"${eventFileName}" -> ${event.event}`);
      } else {
        logger.debug(`\t\t${eventFileName}`);
      }
    });
    logger.debug("Successfully loaded events");
  }

  /** Generate embed with default values and check for
   * {@link https://discordjs.guide/popular-topics/embeds.html#embed-limits valid data}
   */
  genEmbed(data: Partial<EmbedData> = {}): EmbedBuilder {
    logger.verbose("Generating embed");

    // Check for invalid entries
    if (data.title !== undefined && data.title.length > 256) {
      logger.warn("Had to shorten an embed title.", { embedTitle: data.title });
      data.title = data.title.substring(0, 256 - 3) + "...";
    }
    if (data.description !== undefined && data.description.length > 4096) {
      logger.warn("Had to shorten an embed description.", { embedDescription: data.description });
      data.description = data.description.substring(0, 4096 - 3) + "...";
    }
    if (data.fields !== undefined) {
      // Cannot have more than 25 fields in one embed
      if (data.fields.length > 25) {
        logger.warn("Had to shorten an embed's fields.", { embedFields: data.fields });
        data.fields = data.fields.slice(0, 25);
      }
      data.fields.forEach((f) => {
        if (f.name.length > 256) {
          logger.warn("Had to shorten an embed field name.", { embedFieldName: f.name });
          f.name = f.name.substring(0, 256 - 3) + "...";
        }
        if (f.value.length > 1024) {
          logger.warn("Had to shorten an embed field value.", { embedFieldValue: f.value });
          f.value = f.value.substring(0, 1024 - 3) + "...";
        }
      });
    }
    if (data.footer?.text !== undefined && data.footer.text.length > 2048) {
      logger.warn("Had to shorten an embed footer text.", { embedFooterText: data.footer.text });
      data.footer.text = data.footer.text.substring(0, 2048 - 3) + "...";
    }
    if (data.author?.name !== undefined && data.author.name.length > 256) {
      logger.warn("Had to shorten an embed author name.", { embedAuthorName: data.author.name });
      data.author.name = data.author.name.substring(0, 256 - 3) + "...";
    }

    // Generate base embed
    const embed = new EmbedBuilder(data);

    // Add in default values
    if (data.color === undefined) embed.setColor(Colors.DarkBlue);
    if (data.footer === undefined) embed.setFooter({ text: `${this.config.name}@${this.version}` });

    return embed;
  }

  async sendMultiPageEmbed(
    interaction: ChatInputCommandInteraction,
    embedFields: EmbedField[],
    options: Partial<SendMultiPageEmbedOptions> = {}
  ) {
    logger.verbose("Called Client.sendMultiPageEmbed().", { interaction, embedFields, options });

    // Constants
    const backId = `${this.config.name}-back-button`;
    const forwardId = `${this.config.name}-forward-button`;
    const backButton = new ButtonBuilder({
      style: ButtonStyle.Secondary,
      label: "Back",
      emoji: "⬅️",
      customId: backId,
    });
    const forwardButton = new ButtonBuilder({
      style: ButtonStyle.Secondary,
      label: "Forward",
      emoji: "➡️",
      customId: forwardId,
    });

    // Set defaults if needed
    const maxFieldsPerEmbed = options.maxFieldsPerEmbed ?? 5;
    const otherEmbedData = options.otherEmbedData ?? {};
    const otherReplyOptions = options.otherReplyOptions ?? {};

    const canFitOnOnePage = embedFields.length <= maxFieldsPerEmbed;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logger.verbose(`Using ${Math.ceil(embedFields.length / maxFieldsPerEmbed)} page${canFitOnOnePage ? "" : "s"}.`);

    const originalTitle = (() => {
      if (otherEmbedData.title !== undefined) {
        if (otherEmbedData.title.length > 256) {
          logger.warn("Had to shorten an embed title.", { embedTitle: otherEmbedData.title });
          return otherEmbedData.title.substring(0, 256 - 3) + "...";
        }

        return otherEmbedData.title;
      }

      return "";
    })();

    const genReplyOptions = (startIndex: number) => {
      // Generate embed data

      const limitedEmbedFields = embedFields.slice(startIndex, startIndex + maxFieldsPerEmbed);

      const fullEmbedData = otherEmbedData as Partial<EmbedData>;
      fullEmbedData.fields = limitedEmbedFields;

      if (canFitOnOnePage) {
        fullEmbedData.title = originalTitle;
      } else {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        const titlePageSubstr = `${startIndex + 1}-${startIndex + limitedEmbedFields.length} out of ${embedFields.length}`;
        if (originalTitle.length > 0) {
          fullEmbedData.title = `${originalTitle} (${titlePageSubstr})`;
        } else {
          fullEmbedData.title = titlePageSubstr;
        }
      }

      // Generate reply options

      const fullReplyOptions = otherReplyOptions as Partial<InteractionReplyOptions & InteractionUpdateOptions>;
      fullReplyOptions.embeds = [this.genEmbed(fullEmbedData)];

      if (startIndex === 0) {
        fullReplyOptions.components = canFitOnOnePage
          ? []
          : [new ActionRowBuilder<ButtonBuilder>({ components: [forwardButton] })];
      } else {
        fullReplyOptions.components = [
          new ActionRowBuilder<ButtonBuilder>({
            components: [
              // back button if it isn't the start
              ...(startIndex ? [backButton] : []),
              // forward button if it isn't the end
              ...(startIndex + maxFieldsPerEmbed < embedFields.length ? [forwardButton] : []),
            ],
          }),
        ];
      }

      return fullReplyOptions;
    };

    // Send the embed with the first `maxFieldsPerEmbed` fields
    const embedMessage = await interaction.followUp(genReplyOptions(0));

    // Ignore if there is only one page of fields (no need for all of this)
    if (!canFitOnOnePage) {
      // Collect button interactions (when a user clicks a button)
      const collector = embedMessage.createMessageComponentCollector();

      let i = 0;
      collector.on("collect", (componentInteraction) => {
        // Increase/decrease index
        if (componentInteraction.customId === forwardId) {
          logger.verbose("Someone clicked forward on multi-page embed", { embedMessage, collector });
          i += maxFieldsPerEmbed;
        }
        if (componentInteraction.customId === backId) {
          logger.verbose("Someone clicked back on multi-page embed", { embedMessage, collector });
          i -= maxFieldsPerEmbed;
        }

        // Respond to component interaction by updating message with new embed
        componentInteraction.update(genReplyOptions(i)).catch((e: unknown) => {
          if (e instanceof Error) {
            throw e;
          } else {
            throw new Error(`Could not update message component collector: ${String(e)}`);
          }
        });
      });
    }

    return embedMessage;
  }

  async runCommand(
    command: Command | BaseCommand,
    interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction
  ): Promise<void> {
    // Handle BaseCommand instances
    if (command instanceof BaseCommand) {
      await command.run(this, interaction);
      return;
    }

    // Handle legacy Command instances
    const legacyCommand = command;

    // For now, all commands should assume we are in a guild.
    // Subject to change.
    if (!interaction.inGuild()) {
      logger.warn(`Tried to run \`/${legacyCommand.builder.name}\` command outside of a server/guild`);
      await interaction.reply({
        content: "This bot only supports commands in a server/guild!",
        flags: 64 /* MessageFlags.Ephemeral */,
      });
      return;
    }

    // Check command permissions using new permission system
    const permissionManager = new PermissionManager();

    const permissionResult = await permissionManager.checkPermission(
      interaction.member as GuildMember,
      legacyCommand.builder.name,
      interaction.guildId
    );

    if (!permissionResult.allowed) {
      await interaction.reply({
        content: `❌ You don't have permission to use this command.`,
        flags: 64 /* MessageFlags.Ephemeral */,
      });
      return;
    }

    // Keep existing music channel restrictions
    if (legacyCommand.category === "music") {
      try {
        const guildConfig = await getGuildConfig(interaction.guildId);
        const musicChannelId = guildConfig.musicChannelId;

        if (musicChannelId !== "" && interaction.channelId !== musicChannelId) {
          const musicChannelName =
            (await interaction.guild?.channels.fetch(musicChannelId))?.name ?? "MUSIC_CHANNEL_NAME";

          await interaction.reply({
            content: `Must enter music commands in ${musicChannelName}!`,
            flags: 64 /* MessageFlags.Ephemeral */,
          });
          return;
        }
      } catch (error) {
        logger.error("Error fetching guild config for music channel check:", error);
        // Continue without music channel restriction if config fetch fails
      }
    }

    logger.info(
      `Guild "${interaction.guild?.name ?? "NO NAME"}" [id: ${interaction.guildId}] ran \`/${legacyCommand.builder.name}\` command`
    );
    try {
      await legacyCommand.run(this, interaction);
    } catch (error: unknown) {
      logger.error("Command execution error:", error);
      const errorReply = {
        content: `There was an error while executing the \`${legacyCommand.builder.name}\` command!`,
        flags: 64 /* MessageFlags.Ephemeral */,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp(errorReply)
          .catch((e: unknown) => logger.error("Error sending followup error message:", e));
      } else {
        await interaction
          .reply(errorReply)
          .catch((e: unknown) => logger.error("Error sending reply error message:", e));
      }
    }
  }

  /** Gracefully shut down the bot */
  async shutdown(): Promise<void> {
    logger.info("Shutting down bot...");

    try {
      // Shutdown cache and batch services first
      const { cacheService } = await import("../services/cacheService.js");
      const { batchOperationManager } = await import("../services/batchOperationManager.js");

      logger.info("Flushing batch operations...");
      await batchOperationManager.shutdown();

      logger.info("Shutting down cache service...");
      await cacheService.shutdown();

      // Disconnect WebSocket service
      if (this.wsService) {
        logger.info("Disconnecting WebSocket service...");
        this.wsService.disconnect();
      }

      // Disconnect from Discord
      await this.destroy();

      // Disconnect from database
      const { disconnect } = await import("../database/index.js");
      await disconnect();

      logger.info("Bot shutdown complete");
    } catch (error) {
      logger.error("Error during shutdown:", error);
    }
  }
}
