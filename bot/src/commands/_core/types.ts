import type {
  CategoryChannel,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  ForumChannel,
  Guild,
  GuildMember,
  MediaChannel,
  NewsChannel,
  PermissionResolvable,
  StageChannel,
  TextChannel,
  User,
  VoiceChannel,
} from "discord.js";
import type Client from "../../structures/Client.js";
import type { PermissionLevel } from "../../structures/PermissionTypes.js";

// Core command types
export type CommandInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;
export type SlashCommandInteraction = ChatInputCommandInteraction;

export interface CommandContext {
  client: Client;
  interaction: CommandInteraction;
  guild: Guild;
  member: GuildMember;
  user: User;
  channel: TextChannel | VoiceChannel | CategoryChannel | NewsChannel | StageChannel | ForumChannel | MediaChannel;
}

export interface CommandPermissionConfig {
  level: PermissionLevel;
  discordPermissions?: PermissionResolvable[];
  roles?: string[];
  users?: string[];
  isConfigurable?: boolean;
}

export interface CommandConfig {
  name: string;
  description: string;
  category?: string;
  permissions?: CommandPermissionConfig;
  cooldown?: number;
  ownerOnly?: boolean;
  guildOnly?: boolean;
  ephemeral?: boolean;
}

export interface CommandResponse {
  content?: string;
  embeds?: any[];
  components?: any[];
  files?: any[];
  ephemeral?: boolean;
}

export interface CommandResult {
  success: boolean;
  response?: CommandResponse;
  error?: Error;
}

// Moderation-specific types
export interface ModerationOptions {
  user: User;
  reason?: string;
  duration?: string;
  evidence?: string;
  silent: boolean;
}

export interface ModerationResponse extends CommandResponse {
  caseNumber?: number;
}

// Duration type
export interface Duration {
  seconds: number;
  formatted: string;
}

// Evidence types
export interface ParsedEvidence {
  links: string[];
  attachments: string[];
  text: string[];
  all: string[];
}

// Alias expansion context
export interface AliasExpansionContext {
  guild: Guild;
  user: User;
  moderator: User;
}

// Command builder and decorator types
export interface CommandBuilder {
  name: string;
  description: string;
  options?: any[];
}

export interface DecoratorMetadata {
  permissions?: CommandPermissionConfig;
  cooldown?: number;
  category?: string;
}

export interface ValidationRule {
  name: string;
  validator: (value: any) => boolean | string;
}

export interface ValidationSchema {
  rules: ValidationRule[];
}

export interface CommandMiddleware {
  name: string;
  execute: (context: CommandContext) => Promise<void> | void;
}

export interface ConfigurationOptions {
  autoDefer?: boolean;
  ephemeral?: boolean;
  allowInDMs?: boolean;
}
