import type { GuildMember } from "discord.js";
import { PermissionsBitField } from "discord.js";

import { prisma } from "../database/index.js";
import logger from "../logger.js";
import { cacheService } from "../services/cacheService.js";
import Client from "./Client.js";
import type { CommandPermissionConfig, PermissionCheckResult } from "./PermissionTypes.js";
import { AuditAction, PermissionLevel } from "./PermissionTypes.js";

// Proper TypeScript interfaces for database models
interface CommandPermissionDB {
  id: string;
  guildId: string;
  commandName: string;
  permissionLevel: string;
  discordPermissions: string[];
  requiredRoles: string[];
  allowedUsers: string[];
  deniedUsers: string[];
  isConfigurable: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface MaintenanceModeDB {
  id: string;
  guildId: string;
  isEnabled: boolean;
  allowedUsers: string[];
  reason: string | null;
  enabledBy: string;
  enabledAt: Date;
}

interface PermissionAuditLogDB {
  id: string;
  guildId: string;
  commandName: string | null;
  action: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  userId: string;
  reason: string | null;
  timestamp: Date;
}

interface CacheEntry<T> {
  data: T | null;
  timestamp: number;
}

export default class PermissionManager {
  private permissionCache = new Map<string, CacheEntry<CommandPermissionDB>>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Main permission checking method
   */
  async checkPermission(member: GuildMember, commandName: string, guildId: string): Promise<PermissionCheckResult> {
    try {
      // Check maintenance mode first
      if (await this.isMaintenanceMode(guildId)) {
        const maintenanceData = await this.getMaintenanceMode(guildId);
        if (
          maintenanceData &&
          Array.isArray(maintenanceData.allowedUsers) &&
          !maintenanceData.allowedUsers.includes(member.user.id)
        ) {
          return { allowed: false, reason: "Server is in maintenance mode" };
        }
      }

      // Developer bypass - developers can use any command regardless of permissions
      if (this.isDeveloper(member.user.id)) {
        return { allowed: true, bypassedBy: "developer" };
      }

      // Get permission config for this command
      const permissionConfig = await this.getCommandPermission(guildId, commandName);

      // If no custom config, use command defaults
      if (!permissionConfig) {
        return await this.checkDefaultPermissions(member, commandName);
      }

      // Check if user is explicitly denied
      if (Array.isArray(permissionConfig.deniedUsers) && permissionConfig.deniedUsers.includes(member.user.id)) {
        await this.logPermissionDenied(guildId, commandName, member.user.id, "User explicitly denied");
        return { allowed: false, reason: "You are explicitly denied access to this command" };
      }

      // Check if user is explicitly allowed
      if (Array.isArray(permissionConfig.allowedUsers) && permissionConfig.allowedUsers.includes(member.user.id)) {
        return { allowed: true, bypassedBy: "owner" };
      }

      // Check custom roles
      const assignments = await prisma.customRoleAssignment.findMany({
        where: { userId: member.user.id, guildId },
      });
      const roleIds = assignments.map((a: { roleId: string }) => a.roleId);
      const roles = await prisma.customRole.findMany({
        where: { id: { in: roleIds } },
      });

      const memberPermissions = new Set<string>();
      roles.forEach((role) => {
        role.permissions.forEach((p) => memberPermissions.add(p));
      });

      if (memberPermissions.has(`command.${commandName}`) || memberPermissions.has("command.*")) {
        return { allowed: true };
      }

      // Check permission level
      switch (permissionConfig.permissionLevel as PermissionLevel) {
        case PermissionLevel.DEVELOPER:
          if (this.isDeveloper(member.user.id)) {
            return { allowed: true, bypassedBy: "developer" };
          }
          break;

        case PermissionLevel.OWNER:
          if (member.guild.ownerId === member.user.id) {
            return { allowed: true, bypassedBy: "owner" };
          }
          break;

        case PermissionLevel.ADMIN:
          if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return { allowed: true };
          }
          break;

        case PermissionLevel.MODERATOR:
          if (
            this.checkDiscordPermissions(member, permissionConfig.discordPermissions) ||
            this.checkRequiredRoles(member, permissionConfig.requiredRoles)
          ) {
            return { allowed: true };
          }
          break;

        case PermissionLevel.PUBLIC:
          return { allowed: true };

        case PermissionLevel.CUSTOM:
          if (this.checkRequiredRoles(member, permissionConfig.requiredRoles)) {
            return { allowed: true };
          }
          break;
      }

      await this.logPermissionDenied(guildId, commandName, member.user.id, "Insufficient permissions");
      return { allowed: false, reason: "You don't have permission to use this command" };
    } catch (error) {
      logger.error("Error checking permissions", error);
      return { allowed: false, reason: "Permission check failed" };
    }
  }

  /**
   * Check default permissions based on command category
   */
  private async checkDefaultPermissions(member: GuildMember, commandName: string): Promise<PermissionCheckResult> {
    try {
      // Developer bypass - developers can use any command regardless of permissions
      if (this.isDeveloper(member.user.id)) {
        return { allowed: true, bypassedBy: "developer" };
      }

      const client = await Client.get();
      const command = client.commands.get(commandName);

      if (!command) {
        return { allowed: false, reason: "Command not found" };
      }

      // Use existing category-based logic as fallback
      switch (command.category) {
        case "admin":
        case "context":
        case "message":
          if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return { allowed: true };
          }
          break;
        case "dev":
          if (this.isDeveloper(member.user.id)) {
            return { allowed: true, bypassedBy: "developer" };
          }
          break;
        default:
          return { allowed: true };
      }

      return { allowed: false, reason: "You don't have permission to use this command" };
    } catch (error) {
      logger.error("Error checking default permissions", error);
      return { allowed: false, reason: "Permission check failed" };
    }
  }

  /**
   * Check if user has required Discord permissions
   */
  private checkDiscordPermissions(member: GuildMember, permissions?: string[]): boolean {
    if (!permissions || permissions.length === 0) return false;

    try {
      const permissionFlags = permissions.map((p) => BigInt(p));
      return member.permissions.has(permissionFlags);
    } catch (error) {
      logger.error("Error checking Discord permissions", error);
      return false;
    }
  }

  /**
   * Check if user has required roles
   */
  private checkRequiredRoles(member: GuildMember, roleIds?: string[]): boolean {
    if (!roleIds || roleIds.length === 0) return false;
    return roleIds.some((roleId) => member.roles.cache.has(roleId));
  }

  /**
   * Check if user is a developer
   */
  private isDeveloper(userId: string): boolean {
    const developers = process.env.DEVELOPER_USER_IDS?.split(",") ?? [];
    return developers.includes(userId);
  }

  /**
   * Get command permission from database or cache
   */
  async getCommandPermission(guildId: string, commandName: string): Promise<CommandPermissionDB | null> {
    const cacheKey = `${guildId}-${commandName}`;
    const cached = this.permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const permission = await prisma.commandPermission.findUnique({
        where: { guildId_commandName: { guildId, commandName } },
      });

      this.permissionCache.set(cacheKey, {
        data: permission as CommandPermissionDB | null,
        timestamp: Date.now(),
      });

      return permission as CommandPermissionDB | null;
    } catch (error) {
      logger.error("Error getting command permission", error);
      return null;
    }
  }

  /**
   * Set command permission
   */
  async setCommandPermission(
    guildId: string,
    commandName: string,
    config: CommandPermissionConfig,
    changedBy: string
  ): Promise<void> {
    try {
      const existing = await this.getCommandPermission(guildId, commandName);

      await prisma.commandPermission.upsert({
        where: { guildId_commandName: { guildId, commandName } },
        update: {
          permissionLevel: config.level,
          discordPermissions: config.discordPermissions?.map((p) => String(Number(p))) ?? [],
          requiredRoles: config.requiredRoles ?? [],
          allowedUsers: config.allowedUsers ?? [],
          deniedUsers: config.deniedUsers ?? [],
          isConfigurable: config.isConfigurable ?? true,
          updatedAt: new Date(),
          createdBy: changedBy,
        },
        create: {
          guildId,
          commandName,
          permissionLevel: config.level,
          discordPermissions: config.discordPermissions?.map((p) => String(Number(p))) ?? [],
          requiredRoles: config.requiredRoles ?? [],
          allowedUsers: config.allowedUsers ?? [],
          deniedUsers: config.deniedUsers ?? [],
          isConfigurable: config.isConfigurable ?? true,
          createdBy: changedBy,
        },
      });

      // Log the change
      await this.logPermissionChange(guildId, AuditAction.UPDATE, existing, config, changedBy, commandName);

      // Clear cache
      this.clearPermissionCache(guildId, commandName);
    } catch (error) {
      logger.error("Error setting command permission", error);
      throw error;
    }
  }

  /**
   * Reset command permission to default
   */
  async resetCommandPermission(guildId: string, commandName: string, changedBy: string): Promise<void> {
    try {
      const existing = await this.getCommandPermission(guildId, commandName);

      if (existing) {
        await prisma.commandPermission.delete({
          where: { guildId_commandName: { guildId, commandName } },
        });

        await this.logPermissionChange(guildId, AuditAction.DELETE, existing, null, changedBy, commandName);
        this.clearPermissionCache(guildId, commandName);
      }
    } catch (error) {
      logger.error("Error resetting command permission", error);
      throw error;
    }
  }

  /**
   * Check if guild is in maintenance mode
   */
  async isMaintenanceMode(guildId: string): Promise<boolean> {
    try {
      const maintenance = await prisma.maintenanceMode.findUnique({
        where: { guildId },
      });
      return (maintenance as MaintenanceModeDB | null)?.isEnabled ?? false;
    } catch (error) {
      logger.error("Error checking maintenance mode", error);
      return false;
    }
  }

  /**
   * Get maintenance mode data
   */
  async getMaintenanceMode(guildId: string): Promise<MaintenanceModeDB | null> {
    try {
      const result = await prisma.maintenanceMode.findUnique({
        where: { guildId },
      });
      return result as MaintenanceModeDB | null;
    } catch (error) {
      logger.error("Error getting maintenance mode", error);
      return null;
    }
  }

  /**
   * Enable maintenance mode
   */
  async enableMaintenanceMode(guildId: string, reason: string, enabledBy: string): Promise<void> {
    try {
      await prisma.maintenanceMode.upsert({
        where: { guildId },
        update: {
          isEnabled: true,
          reason,
          enabledBy,
          enabledAt: new Date(),
        },
        create: {
          guildId,
          isEnabled: true,
          allowedUsers: [enabledBy], // Person who enabled it can always bypass
          reason,
          enabledBy,
          enabledAt: new Date(),
        },
      });

      await this.logPermissionChange(guildId, AuditAction.MAINTENANCE_ENABLED, null, { reason }, enabledBy);
    } catch (error) {
      logger.error("Error enabling maintenance mode", error);
      throw error;
    }
  }

  /**
   * Disable maintenance mode
   */
  async disableMaintenanceMode(guildId: string, disabledBy: string): Promise<void> {
    try {
      await prisma.maintenanceMode.delete({
        where: { guildId },
      });

      await this.logPermissionChange(guildId, AuditAction.MAINTENANCE_DISABLED, null, null, disabledBy);
    } catch (error) {
      logger.error("Error disabling maintenance mode", error);
      throw error;
    }
  }

  /**
   * Log permission changes for audit trail
   */
  private async logPermissionChange(
    guildId: string,
    action: AuditAction,
    oldValue: CommandPermissionDB | CommandPermissionConfig | null,
    newValue: CommandPermissionConfig | { reason: string } | null,
    userId: string,
    commandName?: string
  ): Promise<void> {
    try {
      await prisma.permissionAuditLog.create({
        data: {
          guildId,
          commandName,
          action,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          userId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error logging permission change", error);
    }
  }

  /**
   * Log permission denied events
   */
  private async logPermissionDenied(
    guildId: string,
    commandName: string,
    userId: string,
    reason: string
  ): Promise<void> {
    try {
      await prisma.permissionAuditLog.create({
        data: {
          guildId,
          commandName,
          action: AuditAction.PERMISSION_DENIED,
          userId,
          reason,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error logging permission denied", error);
    }
  }

  /**
   * Clear permission cache
   */
  private clearPermissionCache(guildId: string, commandName: string): void {
    const cacheKey = `${guildId}-${commandName}`;
    this.permissionCache.delete(cacheKey);
  }

  /**
   * Get audit log entries
   */
  async getAuditLog(guildId: string, limit = 50, commandName?: string): Promise<PermissionAuditLogDB[]> {
    try {
      const result = await prisma.permissionAuditLog.findMany({
        where: {
          guildId,
          ...(commandName && { commandName }),
        },
        orderBy: { timestamp: "desc" },
        take: limit,
      });
      return result as PermissionAuditLogDB[];
    } catch (error) {
      logger.error("Error getting audit log", error);
      return [];
    }
  }

  /**
   * Check command permission with caching
   */
  static async checkCommandPermission(guildId: string, command: string): Promise<any> {
    const cacheKey = `permissions:command:${guildId}:${command}`;

    try {
      // Try cache first
      const cached = await cacheService.get<any>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Fetch from database
      const permission = await prisma.commandPermission.findUnique({
        where: {
          guildId_commandName: {
            guildId,
            commandName: command,
          },
        },
      });

      // Cache result (TTL: 5 minutes)
      cacheService.set(cacheKey, permission, 5 * 60 * 1000);
      return permission;
    } catch (error) {
      logger.error(`Error checking command permission for ${guildId}:${command}:`, error);
      return null;
    }
  }

  /**
   * Get custom roles with caching
   */
  static async getCustomRoles(guildId: string): Promise<any[]> {
    const cacheKey = `permissions:customroles:${guildId}`;

    try {
      // Try cache first
      const cached = await cacheService.get<any[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const roles = await prisma.customRole.findMany({
        where: { guildId },
        include: { assignments: true },
      });

      // Cache result (TTL: 5 minutes)
      cacheService.set(cacheKey, roles, 5 * 60 * 1000);
      return roles;
    } catch (error) {
      logger.error(`Error getting custom roles for ${guildId}:`, error);
      return [];
    }
  }

  /**
   * Check maintenance mode with caching
   */
  static async isMaintenanceMode(): Promise<boolean> {
    const cacheKey = "permissions:maintenance:global";

    try {
      // Try cache first
      const cached = await cacheService.get<boolean>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Fetch from database
      const maintenance = await prisma.maintenanceMode.findUnique({
        where: { id: "global" },
      });

      const isEnabled = maintenance?.isEnabled ?? false;

      // Cache result with shorter TTL since this is critical (1 minute)
      cacheService.set(cacheKey, isEnabled, 60 * 1000);
      return isEnabled;
    } catch (error) {
      logger.error("Error checking maintenance mode:", error);
      return false;
    }
  }

  /**
   * Invalidate permission caches for a guild
   */
  static async invalidatePermissionCache(guildId: string): Promise<void> {
    cacheService.invalidatePattern(`permissions:.*:${guildId}.*`);
  }
}
