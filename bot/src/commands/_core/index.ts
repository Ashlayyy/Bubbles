// Core base classes
export { BaseCommand } from "./BaseCommand.js";

// Core types (selective to avoid duplicates)
export type {
  CommandBuilder,
  CommandConfig,
  CommandContext,
  CommandInteraction,
  CommandMiddleware,
  CommandPermissionConfig,
  CommandResponse,
  CommandResult,
  ConfigurationOptions,
  DecoratorMetadata,
  ModerationOptions,
  ModerationResponse,
  SlashCommandInteraction,
  ValidationRule,
  ValidationSchema,
} from "./types.js";

// Error handling
export { CommandError, createSystemError, createUserError, handleCommandError } from "./errors.js";

// Specialized command bases
export { AdminCommand } from "./specialized/AdminCommand.js";
export { DevCommand } from "./specialized/DevCommand.js";
export { GeneralCommand } from "./specialized/GeneralCommand.js";
export { ModerationCommand } from "./specialized/ModerationCommand.js";

// Response building
export { ResponseBuilder } from "../_shared/responses/ResponseBuilder.js";

// Duration utilities
export {
  formatDuration,
  formatDurationShort,
  parseDuration,
  validateDuration,
} from "../_shared/formatters/duration.js";
export type { Duration } from "../_shared/formatters/duration.js";

// Evidence parsing
export { formatEvidence, getEvidenceCount, parseEvidence } from "../_shared/parsers/evidence.js";
export type { ParsedEvidence } from "../_shared/parsers/evidence.js";

// Alias handling
export { expandAlias, getGuildAliases, looksLikeAlias, searchAliases } from "../_shared/parsers/alias.js";
export type { AliasExpansionContext } from "../_shared/parsers/alias.js";

// Discord formatting
export {
  codeBlock,
  escapeMarkdown,
  formatAccountAge,
  formatChannel,
  formatGuild,
  formatJoinAge,
  formatMember,
  formatRole,
  formatTimeAgo,
  formatTimestamp,
  formatUser,
  inlineCode,
  pluralize,
} from "../_shared/formatters/discord.js";
