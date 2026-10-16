import type {
  Awaitable,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  UserContextMenuCommandInteraction,
} from "discord.js";

import { BaseCommand } from "../commands/_core/BaseCommand.js";
import Client from "./Client.js";
import type { CommandPermissionConfig } from "./PermissionTypes.js";
import { PermissionLevel } from "./PermissionTypes.js";

// ChatInputCommandInteraction<"raw" | "cached"> means that ChatInputCommandInteraction.inGuild() is true
export type GuildChatInputCommandInteraction = ChatInputCommandInteraction<"raw" | "cached">;
export type GuildMessageContextMenuCommandInteraction = MessageContextMenuCommandInteraction<"raw" | "cached">;
export type GuildUserContextMenuCommandInteraction = UserContextMenuCommandInteraction<"raw" | "cached">;

type RunFunction = (
  client: Client,
  interaction:
    | GuildChatInputCommandInteraction
    | GuildMessageContextMenuCommandInteraction
    | GuildUserContextMenuCommandInteraction
) => Awaitable<unknown>;

type Builder =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | ContextMenuCommandBuilder;

interface CommandOptions {
  ephemeral?: boolean;
  permissions?: CommandPermissionConfig;
  enabledOnDev?: boolean;
}

// Updated function to recognize both old and new command instances
export function isCommand(input: unknown): input is Command | BaseCommand {
  // Check for new BaseCommand instances
  if (input instanceof BaseCommand) {
    return true;
  }

  // Check for old Command instances
  return (
    input instanceof Object &&
    "_category" in input &&
    (typeof input._category === "string" || typeof input._category === "undefined") &&
    "builder" in input &&
    "run" in input &&
    input.run instanceof Function
  );
}

// Legacy Command class - keeping for backward compatibility during migration
export default class Command {
  private _category?: string;
  readonly builder: Builder;
  readonly run: RunFunction;
  readonly ephemeral: boolean;
  readonly defaultPermissions: CommandPermissionConfig;
  readonly enabledOnDev: boolean;

  constructor(builder: Builder, run: RunFunction, options: CommandOptions = {}) {
    this.builder = builder;
    this.run = run;
    this.ephemeral = options.ephemeral ?? false;
    this.defaultPermissions = options.permissions ?? { level: PermissionLevel.PUBLIC };
    this.enabledOnDev = options.enabledOnDev ?? true;
  }

  get category(): string {
    if (this._category) return this._category;

    throw new TypeError("Command: category has not been set!");
  }

  set category(category: string) {
    if (this._category !== undefined) {
      throw new TypeError("Command: category has already been set!");
    } else {
      this._category = category;
    }
  }
}
