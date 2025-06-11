import type { PermissionResolvable } from "discord.js";

export enum PermissionLevel {
  PUBLIC = "PUBLIC",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
  OWNER = "OWNER",
  DEVELOPER = "DEVELOPER",
  CUSTOM = "CUSTOM",
}

export interface CommandPermissionConfig {
  level: PermissionLevel;
  discordPermissions?: PermissionResolvable[];
  requiredRoles?: string[];
  allowedUsers?: string[];
  deniedUsers?: string[];
  isConfigurable?: boolean;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  bypassedBy?: "maintenance" | "developer" | "owner";
}

export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  MAINTENANCE_ENABLED = "MAINTENANCE_ENABLED",
  MAINTENANCE_DISABLED = "MAINTENANCE_DISABLED",
}
