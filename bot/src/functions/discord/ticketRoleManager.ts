import { Guild, GuildMember, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { getGuildConfig } from "../../database/GuildConfig.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";

interface TicketRoleConfig {
  supportRoles: string[];
  autoAddRoles: string[];
  persistentRoles: string[];
  categorySpecificRoles: Record<string, string[]>;
  temporaryRoles: string[];
  roleHierarchy: Record<string, number>;
}

interface RoleAssignmentOptions {
  ticketId: string;
  category?: string;
  persistent?: boolean;
  temporary?: boolean;
  duration?: number; // in milliseconds
}

export class TicketRoleManager {
  private guild: Guild;
  private config: TicketRoleConfig;

  constructor(guild: Guild) {
    this.guild = guild;
    this.config = {
      supportRoles: [],
      autoAddRoles: [],
      persistentRoles: [],
      categorySpecificRoles: {},
      temporaryRoles: [],
      roleHierarchy: {},
    };
  }

  /**
   * Initialize role configuration from database
   */
  async initialize(): Promise<void> {
    try {
      const guildConfig = await getGuildConfig(this.guild.id);

      // Load ticket role configuration
      const ticketRoleConfig = await prisma.ticketRoleConfig.findUnique({
        where: { guildId: this.guild.id },
        include: {
          supportRoles: true,
          categoryRoles: true,
          temporaryRoles: true,
        },
      });

      if (ticketRoleConfig) {
        this.config = {
          supportRoles: ticketRoleConfig.supportRoles.map((r) => r.roleId),
          autoAddRoles: ticketRoleConfig.autoAddRoles || [],
          persistentRoles: ticketRoleConfig.persistentRoles || [],
          categorySpecificRoles: ticketRoleConfig.categoryRoles.reduce<Record<string, string[]>>((acc, cr) => {
            acc[cr.category] = cr.roleIds;
            return acc;
          }, {}),
          temporaryRoles: ticketRoleConfig.temporaryRoles.map((r) => r.roleId),
          roleHierarchy:
            ticketRoleConfig.roleHierarchy &&
            typeof ticketRoleConfig.roleHierarchy === "object" &&
            !Array.isArray(ticketRoleConfig.roleHierarchy)
              ? (ticketRoleConfig.roleHierarchy as Record<string, number>)
              : {},
        };
      }

      // Fallback to legacy configuration
      if (guildConfig.ticketAccessRoleId) {
        this.config.supportRoles.push(guildConfig.ticketAccessRoleId);
      }

      logger.info(`Initialized ticket role manager for guild ${this.guild.id}`, {
        supportRoles: this.config.supportRoles.length,
        autoAddRoles: this.config.autoAddRoles.length,
        persistentRoles: this.config.persistentRoles.length,
      });
    } catch (error) {
      logger.error("Failed to initialize ticket role manager:", error);
    }
  }

  /**
   * Get all staff members who should have access to tickets
   */
  async getStaffMembers(): Promise<GuildMember[]> {
    const staffMembers = new Set<GuildMember>();

    // Add members with support roles
    for (const roleId of this.config.supportRoles) {
      const role = this.guild.roles.cache.get(roleId);
      if (role) {
        role.members.forEach((member) => staffMembers.add(member));
      }
    }

    // Add members with permission-based access
    const guildConfig = await getGuildConfig(this.guild.id);
    if (guildConfig.ticketAccessType === "permission" && guildConfig.ticketAccessPermission) {
      const permissionFlag =
        PermissionFlagsBits[guildConfig.ticketAccessPermission as keyof typeof PermissionFlagsBits];
      if (permissionFlag) {
        this.guild.members.cache.forEach((member) => {
          if (member.permissions.has(permissionFlag)) {
            staffMembers.add(member);
          }
        });
      }
    }

    return Array.from(staffMembers);
  }

  /**
   * Get permission overwrites for a ticket channel
   */
  async getTicketPermissions(
    options: RoleAssignmentOptions
  ): Promise<{ id: string; allow: PermissionsBitField; deny?: PermissionsBitField }[]> {
    const permissions: { id: string; allow: PermissionsBitField; deny?: PermissionsBitField }[] = [];

    // Deny @everyone access
    permissions.push({
      id: this.guild.id,
      allow: new PermissionsBitField(),
      deny: new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
    });

    // Add support roles
    for (const roleId of this.config.supportRoles) {
      const role = this.guild.roles.cache.get(roleId);
      if (role) {
        permissions.push({
          id: roleId,
          allow: new PermissionsBitField([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.UseExternalEmojis,
            PermissionFlagsBits.AddReactions,
          ]),
        });
      }
    }

    // Add category-specific roles
    if (options.category && this.config.categorySpecificRoles[options.category]) {
      for (const roleId of this.config.categorySpecificRoles[options.category]) {
        const role = this.guild.roles.cache.get(roleId);
        if (role) {
          permissions.push({
            id: roleId,
            allow: new PermissionsBitField([
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ]),
          });
        }
      }
    }

    // Add auto-add roles
    for (const roleId of this.config.autoAddRoles) {
      const role = this.guild.roles.cache.get(roleId);
      if (role) {
        permissions.push({
          id: roleId,
          allow: new PermissionsBitField([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ]),
        });
      }
    }

    return permissions;
  }

  /**
   * Assign roles to staff members for a ticket
   */
  async assignRolesToStaff(staffIds: string[], options: RoleAssignmentOptions): Promise<void> {
    try {
      const assignments: {
        userId: string;
        roleId: string;
        ticketId: string;
        isPersistent: boolean;
        expiresAt?: Date;
      }[] = [];

      for (const userId of staffIds) {
        const member = this.guild.members.cache.get(userId);
        if (!member) continue;

        // Assign auto-add roles
        for (const roleId of this.config.autoAddRoles) {
          const role = this.guild.roles.cache.get(roleId);
          if (role && !member.roles.cache.has(roleId)) {
            try {
              await member.roles.add(role, `Auto-assigned for ticket ${options.ticketId}`);

              assignments.push({
                userId,
                roleId,
                ticketId: options.ticketId,
                isPersistent: this.config.persistentRoles.includes(roleId),
                expiresAt: options.temporary && options.duration ? new Date(Date.now() + options.duration) : undefined,
              });

              logger.info(`Assigned role ${role.name} to ${member.user.tag} for ticket ${options.ticketId}`);
            } catch (error) {
              logger.error(`Failed to assign role ${role.name} to ${member.user.tag}:`, error);
            }
          }
        }

        // Assign category-specific roles
        if (options.category && this.config.categorySpecificRoles[options.category]) {
          for (const roleId of this.config.categorySpecificRoles[options.category]) {
            const role = this.guild.roles.cache.get(roleId);
            if (role && !member.roles.cache.has(roleId)) {
              try {
                await member.roles.add(role, `Category-specific role for ticket ${options.ticketId}`);

                assignments.push({
                  userId,
                  roleId,
                  ticketId: options.ticketId,
                  isPersistent: this.config.persistentRoles.includes(roleId),
                  expiresAt:
                    options.temporary && options.duration ? new Date(Date.now() + options.duration) : undefined,
                });

                logger.info(`Assigned category role ${role.name} to ${member.user.tag} for ticket ${options.ticketId}`);
              } catch (error) {
                logger.error(`Failed to assign category role ${role.name} to ${member.user.tag}:`, error);
              }
            }
          }
        }
      }

      // Save assignments to database
      if (assignments.length > 0) {
        await prisma.ticketRoleAssignment.createMany({
          data: assignments,
        });
      }
    } catch (error) {
      logger.error("Failed to assign roles to staff:", error);
    }
  }

  /**
   * Remove roles from staff members when ticket is closed
   */
  async removeRolesFromStaff(ticketId: string): Promise<void> {
    try {
      // Get all role assignments for this ticket
      const assignments = await prisma.ticketRoleAssignment.findMany({
        where: {
          ticketId,
          isPersistent: false, // Only remove non-persistent roles
        },
      });

      for (const assignment of assignments) {
        const member = this.guild.members.cache.get(assignment.userId);
        const role = this.guild.roles.cache.get(assignment.roleId);

        if (member && role && member.roles.cache.has(assignment.roleId)) {
          try {
            await member.roles.remove(role, `Ticket ${ticketId} closed`);
            logger.info(`Removed role ${role.name} from ${member.user.tag} (ticket ${ticketId} closed)`);
          } catch (error) {
            logger.error(`Failed to remove role ${role.name} from ${member.user.tag}:`, error);
          }
        }
      }

      // Remove assignments from database
      await prisma.ticketRoleAssignment.deleteMany({
        where: {
          ticketId,
          isPersistent: false,
        },
      });
    } catch (error) {
      logger.error("Failed to remove roles from staff:", error);
    }
  }

  /**
   * Clean up expired temporary roles
   */
  async cleanupExpiredRoles(): Promise<void> {
    try {
      const expiredAssignments = await prisma.ticketRoleAssignment.findMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      for (const assignment of expiredAssignments) {
        const member = this.guild.members.cache.get(assignment.userId);
        const role = this.guild.roles.cache.get(assignment.roleId);

        if (member && role && member.roles.cache.has(assignment.roleId)) {
          try {
            await member.roles.remove(role, "Temporary role expired");
            logger.info(`Removed expired role ${role.name} from ${member.user.tag}`);
          } catch (error) {
            logger.error(`Failed to remove expired role ${role.name} from ${member.user.tag}:`, error);
          }
        }
      }

      // Remove expired assignments from database
      await prisma.ticketRoleAssignment.deleteMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      if (expiredAssignments.length > 0) {
        logger.info(`Cleaned up ${expiredAssignments.length} expired role assignments`);
      }
    } catch (error) {
      logger.error("Failed to cleanup expired roles:", error);
    }
  }

  /**
   * Update role configuration
   */
  async updateConfiguration(newConfig: Partial<TicketRoleConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...newConfig };

      // Update database
      await prisma.ticketRoleConfig.upsert({
        where: { guildId: this.guild.id },
        update: {
          autoAddRoles: this.config.autoAddRoles,
          persistentRoles: this.config.persistentRoles,
          roleHierarchy: this.config.roleHierarchy,
        },
        create: {
          guildId: this.guild.id,
          autoAddRoles: this.config.autoAddRoles,
          persistentRoles: this.config.persistentRoles,
          roleHierarchy: this.config.roleHierarchy,
        },
      });

      // Update support roles
      if (newConfig.supportRoles) {
        await prisma.ticketSupportRole.deleteMany({
          where: { configId: this.guild.id },
        });

        if (newConfig.supportRoles.length > 0) {
          await prisma.ticketSupportRole.createMany({
            data: newConfig.supportRoles.map((roleId) => ({
              configId: this.guild.id,
              roleId,
            })),
          });
        }
      }

      // Update category-specific roles
      if (newConfig.categorySpecificRoles) {
        await prisma.ticketCategoryRole.deleteMany({
          where: { configId: this.guild.id },
        });

        const categoryRoleData = Object.entries(newConfig.categorySpecificRoles).map(([category, roleIds]) => ({
          configId: this.guild.id,
          category,
          roleIds,
        }));

        if (categoryRoleData.length > 0) {
          await prisma.ticketCategoryRole.createMany({
            data: categoryRoleData,
          });
        }
      }

      logger.info(`Updated ticket role configuration for guild ${this.guild.id}`);
    } catch (error) {
      logger.error("Failed to update role configuration:", error);
      throw error;
    }
  }

  /**
   * Get role statistics
   */
  async getRoleStatistics(): Promise<{
    totalSupportRoles: number;
    totalStaffMembers: number;
    activeAssignments: number;
    expiredAssignments: number;
    categoryRoles: Record<string, number>;
  }> {
    try {
      const staffMembers = await this.getStaffMembers();

      const [activeAssignments, expiredAssignments] = await Promise.all([
        prisma.ticketRoleAssignment.count({
          where: {
            userId: { in: staffMembers.map((m) => m.id) },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
        prisma.ticketRoleAssignment.count({
          where: {
            userId: { in: staffMembers.map((m) => m.id) },
            expiresAt: { lte: new Date() },
          },
        }),
      ]);

      const categoryRoles = Object.entries(this.config.categorySpecificRoles).reduce((acc, [category, roleIds]) => {
        acc[category] = roleIds.length;
        return acc;
      }, {});

      return {
        totalSupportRoles: this.config.supportRoles.length,
        totalStaffMembers: staffMembers.length,
        activeAssignments,
        expiredAssignments,
        categoryRoles,
      };
    } catch (error) {
      logger.error("Failed to get role statistics:", error);
      return {
        totalSupportRoles: 0,
        totalStaffMembers: 0,
        activeAssignments: 0,
        expiredAssignments: 0,
        categoryRoles: {},
      };
    }
  }

  /**
   * Check if a member has ticket access
   */
  async hasTicketAccess(member: GuildMember, category?: string): Promise<boolean> {
    // Check support roles
    for (const roleId of this.config.supportRoles) {
      if (member.roles.cache.has(roleId)) {
        return true;
      }
    }

    // Check category-specific roles
    if (category && this.config.categorySpecificRoles[category]) {
      for (const roleId of this.config.categorySpecificRoles[category]) {
        if (member.roles.cache.has(roleId)) {
          return true;
        }
      }
    }

    // Check permission-based access
    const guildConfig = await getGuildConfig(this.guild.id);
    if (guildConfig.ticketAccessType === "permission" && guildConfig.ticketAccessPermission) {
      const permissionFlag =
        PermissionFlagsBits[guildConfig.ticketAccessPermission as keyof typeof PermissionFlagsBits];
      if (permissionFlag && member.permissions.has(permissionFlag)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create a ticket role manager instance
 */
export function createTicketRoleManager(guild: Guild): TicketRoleManager {
  return new TicketRoleManager(guild);
}

/**
 * Initialize ticket role manager for a guild
 */
export async function initializeTicketRoleManager(guild: Guild): Promise<TicketRoleManager> {
  const manager = new TicketRoleManager(guild);
  await manager.initialize();
  return manager;
}
