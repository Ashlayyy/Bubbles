import type {
  Attachment,
  CategoryChannel,
  ForumChannel,
  GuildChannel,
  GuildMember,
  MediaChannel,
  NewsChannel,
  Role,
  StageChannel,
  TextChannel,
  User,
  VoiceChannel,
} from "discord.js";
import { MessageFlags } from "discord.js";

import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { cooldownStore } from "../../utils/CooldownStore.js";
import { ResponseBuilder } from "../_shared/responses/ResponseBuilder.js";
import { CommandError, handleCommandError } from "./errors.js";
import type {
  CommandConfig,
  CommandContext,
  CommandInteraction,
  CommandResponse,
  CommandResult,
  SlashCommandInteraction,
} from "./types.js";

export abstract class BaseCommand {
  protected readonly config: CommandConfig;
  protected context!: CommandContext;
  protected responseBuilder: ResponseBuilder;

  // Compatibility properties for legacy system
  private _category?: string;
  public builder: any; // Will be set by the command loading system
  public defaultPermissions: any; // Will be derived from config
  public enabledOnDev = true;

  constructor(config: CommandConfig) {
    this.config = config;
    this.responseBuilder = new ResponseBuilder();

    // Set up compatibility properties
    this.defaultPermissions = config.permissions ?? { level: PermissionLevel.PUBLIC };
    this.enabledOnDev = true; // BaseCommand instances are enabled by default
  }

  // Compatibility getter/setter for category
  get category(): string {
    return this._category ?? this.config.category ?? "unknown";
  }

  set category(category: string) {
    this._category = category;
  }

  // Abstract method that must be implemented by subclasses
  // Can return either a Promise or direct value for flexibility
  protected abstract execute(
    ...args: any[]
  ): Promise<CommandResult | CommandResponse | undefined> | CommandResult | CommandResponse | undefined;

  // Main execution method called by the command handler
  async run(client: Client, interaction: CommandInteraction): Promise<void> {
    try {
      // Build command context
      this.context = this.buildContext(client, interaction);

      // Run middleware chain
      await this.runMiddleware();

      // Auto-defer if configured
      if (this.shouldAutoDefer() && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({
          flags: this.config.ephemeral ? MessageFlags.Ephemeral : undefined,
        });
      }

      // Execute the command (handle both sync and async)
      const result = await Promise.resolve(this.execute());

      // Handle the result (undefined means no response should be sent)
      if (result !== undefined) {
        await this.handleResult(result);
      }
    } catch (error) {
      await this.handleError(error as Error);
    }
  }

  // Context building
  protected buildContext(client: Client, interaction: CommandInteraction): CommandContext {
    if (!interaction.guild) {
      throw new CommandError("This command can only be used in a server.", "GUILD_ONLY");
    }

    const channel = interaction.channel;
    if (!channel) {
      throw new CommandError("This command cannot be used in this type of channel.", "INVALID_CHANNEL");
    }

    // Properly type the member and channel
    const member = interaction.member as GuildMember;
    const typedChannel = channel as
      | TextChannel
      | VoiceChannel
      | CategoryChannel
      | NewsChannel
      | StageChannel
      | ForumChannel
      | MediaChannel;

    return {
      client,
      interaction,
      guild: interaction.guild,
      member,
      user: interaction.user,
      channel: typedChannel,
    };
  }

  // Middleware execution
  protected async runMiddleware(): Promise<void> {
    // Permission checking
    this.checkPermissions();

    // Owner-only validation
    if (this.config.ownerOnly && !process.env.DEVELOPER_USER_IDS?.split(",").includes(this.context.user.id)) {
      throw new CommandError("This command is restricted to the bot owner.", "OWNER_ONLY");
    }

    // Cooldown checking
    await this.checkCooldown();
  }

  // Permission checking
  protected checkPermissions(): void {
    if (!this.config.permissions?.discordPermissions) return;

    const member = this.context.member;
    const hasPermissions = this.config.permissions.discordPermissions.every((permission) =>
      member.permissions.has(permission)
    );

    if (!hasPermissions) {
      throw new CommandError("You don't have permission to use this command.", "INSUFFICIENT_PERMISSIONS", true);
    }
  }

  // Cooldown checking
  protected async checkCooldown(): Promise<void> {
    if (!this.config.cooldown) return;

    const consumed = await cooldownStore.requestToken({
      userId: this.context.user.id,
      guildId: this.context.guild.id,
      commandName: this.config.name,
      cooldownMs: this.config.cooldown,
    });

    if (!consumed) {
      const remaining = await cooldownStore.getRemaining(this.context.user.id, this.config.name);
      throw new CommandError(
        `Please wait ${(remaining / 1000).toFixed(1)}s before using this command again.`,
        "COOLDOWN",
        true
      );
    }
  }

  // Helper method for manual cooldown checking
  protected async cooldown(interaction: CommandInteraction): Promise<boolean> {
    if (!this.config.cooldown) return true;

    return await cooldownStore.requestToken({
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
      commandName: this.config.name,
      cooldownMs: this.config.cooldown,
    });
  }

  // Auto-defer logic
  protected shouldAutoDefer(): boolean {
    // Can be overridden by subclasses or decorators
    return true;
  }

  // Result handling
  protected async handleResult(result: CommandResult | CommandResponse): Promise<void> {
    let response: CommandResponse;

    if ("success" in result) {
      // CommandResult
      if (!result.success && result.error) {
        throw result.error;
      }
      if (!result.response) return;
      response = result.response;
    } else {
      // CommandResponse
      response = result;
    }

    await this.sendResponse(response);
  }

  // Response sending
  protected async sendResponse(response: CommandResponse): Promise<void> {
    const interaction = this.context.interaction;
    const isEphemeral = response.ephemeral ?? this.config.ephemeral;

    const baseOptions = {
      content: response.content,
      embeds: response.embeds,
      components: response.components,
      files: response.files,
    };

    try {
      if (interaction.deferred) {
        // editReply doesn't support ephemeral flag
        await interaction.editReply(baseOptions);
      } else if (!interaction.replied) {
        await interaction.reply({
          ...baseOptions,
          flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
        });
      } else {
        await interaction.followUp({
          ...baseOptions,
          flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
        });
      }
    } catch (error) {
      logger.error(`Failed to send response for command ${this.config.name}: ${error}`);

      // Try to send a more specific error message
      try {
        let errorMessage = "❌ An error occurred while processing your command.";

        if (error instanceof Error) {
          if (error.message.includes("Missing Permissions")) {
            errorMessage = "❌ I don't have the required permissions to perform this action.";
          } else if (error.message.includes("Unknown Message")) {
            errorMessage = "❌ The message was deleted or I can't access it.";
          } else if (error.message.includes("Invalid Form Body")) {
            errorMessage = "❌ Invalid input provided. Please check your selection.";
          } else if (error.message.includes("Cannot send an empty message")) {
            errorMessage = "❌ The response was empty. Please try again.";
          }
        }

        const errorResponse = {
          content: errorMessage,
          ephemeral: true,
        };

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply(errorResponse);
        } else if (interaction.deferred) {
          await interaction.editReply(errorResponse);
        } else {
          await interaction.followUp(errorResponse);
        }
      } catch (secondaryError) {
        logger.error(`Failed to send error message for command ${this.config.name}:`, secondaryError);
      }
    }
  }

  // Error handling
  protected async handleError(error: Error): Promise<void> {
    const commandError = handleCommandError(error, this.config.name);

    const response = new ResponseBuilder().error("Command Error", commandError.message).ephemeral(true).build();

    try {
      await this.sendResponse(response);
    } catch (sendError) {
      logger.error(`Failed to send error response for command ${this.config.name}:`, sendError);
    }
  }

  // Getters for easy access to context properties
  get client(): Client {
    return this.context.client;
  }

  get interaction(): CommandInteraction {
    return this.context.interaction;
  }

  get guild() {
    return this.context.guild;
  }

  get member() {
    return this.context.member;
  }

  get user() {
    return this.context.user;
  }

  get channel() {
    return this.context.channel;
  }

  // Utility methods for slash command options
  protected isSlashCommand(): boolean {
    return this.interaction.isChatInputCommand();
  }

  protected isMessageContextMenu(): boolean {
    return this.interaction.isMessageContextMenuCommand();
  }

  protected isUserContextMenu(): boolean {
    return this.interaction.isUserContextMenuCommand();
  }

  // Helper methods for getting slash command options with proper typing
  protected getStringOption(name: string, required: true): string;
  protected getStringOption(name: string, required?: false): string | null;
  protected getStringOption(name: string, _required = false): string | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getString(name, _required);
  }

  protected getUserOption(name: string, required: true): User;
  protected getUserOption(name: string, required?: false): User | null;
  protected getUserOption(name: string, required = false): User | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getUser(name, required);
  }

  protected getBooleanOption(name: string, required: true): boolean;
  protected getBooleanOption(name: string, required?: false): boolean | null;
  protected getBooleanOption(name: string, required = false): boolean | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getBoolean(name, required);
  }

  protected getNumberOption(name: string, required: true): number;
  protected getNumberOption(name: string, required?: false): number | null;
  protected getNumberOption(name: string, required = false): number | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getNumber(name, required);
  }

  protected getIntegerOption(name: string, required: true): number;
  protected getIntegerOption(name: string, required?: false): number | null;
  protected getIntegerOption(name: string, required = false): number | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getInteger(name, required);
  }

  protected getRoleOption(name: string, required: true): Role;
  protected getRoleOption(name: string, required?: false): Role | null;
  protected getRoleOption(name: string, required = false): Role | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getRole(name, required) as Role | null;
  }

  protected getChannelOption(name: string, required: true): GuildChannel;
  protected getChannelOption(name: string, required?: false): GuildChannel | null;
  protected getChannelOption(name: string, required = false): GuildChannel | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getChannel(name, required) as GuildChannel | null;
  }

  protected getMemberOption(name: string, required: true): GuildMember;
  protected getMemberOption(name: string, required?: false): GuildMember | null;
  protected getMemberOption(name: string, required = false): GuildMember | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getMember(name) as GuildMember | null;
  }

  protected getAttachmentOption(name: string, required: true): Attachment;
  protected getAttachmentOption(name: string, required?: false): Attachment | null;
  protected getAttachmentOption(name: string, required = false): Attachment | null {
    if (!this.isSlashCommand()) return null;
    return (this.interaction as SlashCommandInteraction).options.getAttachment(name, required);
  }
}
