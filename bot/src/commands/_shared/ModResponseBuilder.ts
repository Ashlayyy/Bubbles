import { User } from "discord.js";
import type { CommandResponse } from "../_core/types.js";
import { ResponseBuilder } from "./responses/ResponseBuilder.js";

interface ModResponseOptions {
  /** Title used for the embed (already prefixed with ✅ by ResponseBuilder.success) */
  title: string;
  /** Target user */
  target: Pick<User, "username" | "id"> | { username: string; id: string };
  /** Moderator executing the command */
  moderator: Pick<User, "username" | "id"> | { username: string; id: string };
  /** Optional reason */
  reason?: string;
  /** Optional duration in seconds */
  duration?: number;
  /** Whether the DM notification was sent */
  notified?: boolean;
  /** Case number if a moderation case was created / updated */
  caseNumber?: number;
  /** Set to true when we updated & resolved an existing case instead of creating a new one */
  resolved?: boolean;
}

/**
 * Build a success response for a moderation action using a consistent layout.
 */
export function buildModSuccess(options: ModResponseOptions): CommandResponse {
  const { title, target, moderator, reason, duration, notified = false, caseNumber, resolved } = options;

  const lines: string[] = [];

  // Target line first
  lines.push(`👤 **Target:** ${target.username}`);

  // Case line if applicable (insert after target)
  if (typeof caseNumber !== "undefined") {
    const caseLine = resolved
      ? `📋 **Case #${String(caseNumber)}** updated & resolved`
      : `📋 **Case #${String(caseNumber)}** created`;
    lines.push(caseLine);
  }

  if (reason && reason !== "No reason provided") {
    lines.push(`📝 **Reason:** ${reason}`);
  }

  if (typeof duration === "number" && duration > 0) {
    lines.push(`⏱️ **Duration:** ${formatDuration(duration)}`);
  }

  if (notified) {
    lines.push(`📨 User was notified via DM`);
  }

  lines.push(`👮 **Moderator:** ${moderator.username}`);

  return new ResponseBuilder().success(title).content(lines.join("\n")).ephemeral().build();
}

/**
 * Convert seconds → friendly string (d/h/m/s).
 */
function formatDuration(seconds: number): string {
  const units = [
    { name: "year", seconds: 365 * 24 * 60 * 60 },
    { name: "month", seconds: 30 * 24 * 60 * 60 },
    { name: "week", seconds: 7 * 24 * 60 * 60 },
    { name: "day", seconds: 24 * 60 * 60 },
    { name: "hour", seconds: 60 * 60 },
    { name: "minute", seconds: 60 },
  ];

  for (const unit of units) {
    const count = Math.floor(seconds / unit.seconds);
    if (count > 0) {
      return `${String(count)} ${unit.name}${count !== 1 ? "s" : ""}`;
    }
  }

  return `${String(seconds)} second${seconds !== 1 ? "s" : ""}`;
}

/**
 * Build a standardized error response for moderation commands.
 */
export function buildModError(action: string, target: { username: string }, description: string): CommandResponse {
  return new ResponseBuilder()
    .error(`${action.charAt(0).toUpperCase() + action.slice(1)} Failed`)
    .content(`❌ **${target.username}**\n\n${description}`)
    .ephemeral()
    .build();
}
