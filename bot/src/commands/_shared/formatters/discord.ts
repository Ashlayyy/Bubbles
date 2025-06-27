import type { Channel, Guild, GuildMember, Role, User } from "discord.js";

/**
 * Format a user mention with fallback display
 */
export function formatUser(user: User): string {
  return `<@${user.id}> (${user.username})`;
}

/**
 * Format a guild member mention with fallback display
 */
export function formatMember(member: GuildMember): string {
  return `<@${member.id}> (${member.displayName})`;
}

/**
 * Format a role mention with fallback display
 */
export function formatRole(role: Role): string {
  return `<@&${role.id}> (${role.name})`;
}

/**
 * Format a channel mention with fallback display
 */
export function formatChannel(channel: Channel): string {
  if (!("name" in channel)) return `<#${channel.id}>`;
  return `<#${channel.id}> (${channel.name})`;
}

/**
 * Format a guild name
 */
export function formatGuild(guild: Guild): string {
  return `${guild.name} (${guild.id})`;
}

/**
 * Format a timestamp for Discord
 */
export function formatTimestamp(date: Date, style: "t" | "T" | "d" | "D" | "f" | "F" | "R" = "f"): string {
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:${style}>`;
}

/**
 * Format time ago (relative time)
 */
export function formatTimeAgo(date: Date): string {
  return formatTimestamp(date, "R");
}

/**
 * Format account age
 */
export function formatAccountAge(user: User): string {
  const now = new Date();
  const accountAge = now.getTime() - user.createdAt.getTime();
  const days = Math.floor(accountAge / (1000 * 60 * 60 * 24));
  return `${days} days old`;
}

/**
 * Format join age for guild members
 */
export function formatJoinAge(member: GuildMember): string {
  if (!member.joinedAt) return "Unknown";
  const now = new Date();
  const joinAge = now.getTime() - member.joinedAt.getTime();
  const days = Math.floor(joinAge / (1000 * 60 * 60 * 24));
  return `${days} days ago`;
}

/**
 * Escape markdown characters in text
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_`~|])/g, "\\$1");
}

/**
 * Create inline code block
 */
export function inlineCode(text: string): string {
  return `\`${text.replace(/`/g, "\\`")}\``;
}

/**
 * Create code block with optional language
 */
export function codeBlock(text: string, language = ""): string {
  return `\`\`\`${language}\n${text.replace(/```/g, "\\`\\`\\`")}\n\`\`\``;
}

/**
 * Pluralize a word based on count
 */
export function pluralize(word: string, count: number, suffix = "s"): string {
  return count === 1 ? word : word + suffix;
}
