import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder, User } from "discord.js";
import logger from "../../logger.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class XpManagementCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "xp",
      description: "Manage user XP and levels (Admin only)",
      category: "leveling",
      permissions: {
        level: PermissionLevel.ADMIN,
        discordPermissions: [PermissionsBitField.Flags.Administrator],
        isConfigurable: true,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const action = this.getStringOption("action") || "view";
    const guildId = this.guild.id;

    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      if (action === "view") {
        const user = this.getUserOption("user");
        if (!user) {
          return this.createGeneralError("Invalid Input", "Please specify a user to view.");
        }
        return await this.viewUserXP(customApiUrl, guildId, user);
      } else if (action === "add") {
        const user = this.getUserOption("user");
        const amount = this.getIntegerOption("amount");
        const reason = this.getStringOption("reason") || "Manual XP addition by admin";

        if (!user || !amount) {
          return this.createGeneralError("Invalid Input", "Please specify both user and amount.");
        }

        if (amount < 1 || amount > 100000) {
          return this.createGeneralError("Invalid Amount", "Amount must be between 1 and 100,000 XP.");
        }

        return await this.addXP(customApiUrl, guildId, user, amount, reason);
      } else if (action === "remove") {
        const user = this.getUserOption("user");
        const amount = this.getIntegerOption("amount");
        const reason = this.getStringOption("reason") || "Manual XP removal by admin";

        if (!user || !amount) {
          return this.createGeneralError("Invalid Input", "Please specify both user and amount.");
        }

        if (amount < 1 || amount > 100000) {
          return this.createGeneralError("Invalid Amount", "Amount must be between 1 and 100,000 XP.");
        }

        return await this.removeXP(customApiUrl, guildId, user, amount, reason);
      } else if (action === "set-level") {
        const user = this.getUserOption("user");
        const level = this.getIntegerOption("level");
        const reason = this.getStringOption("reason") || "Manual level set by admin";

        if (!user || level === null) {
          return this.createGeneralError("Invalid Input", "Please specify both user and level.");
        }

        if (level < 0 || level > 1000) {
          return this.createGeneralError("Invalid Level", "Level must be between 0 and 1000.");
        }

        return await this.setLevel(customApiUrl, guildId, user, level, reason);
      } else if (action === "reset") {
        const user = this.getUserOption("user");
        const reason = this.getStringOption("reason") || "XP reset by admin";

        if (!user) {
          return this.createGeneralError("Invalid Input", "Please specify a user to reset.");
        }

        return await this.resetUser(customApiUrl, guildId, user, reason);
      } else if (action === "bulk-add") {
        const role = this.getRoleOption("role");
        const amount = this.getIntegerOption("amount");
        const reason = this.getStringOption("reason") || "Bulk XP addition by admin";

        if (!role || !amount) {
          return this.createGeneralError("Invalid Input", "Please specify both role and amount.");
        }

        if (amount < 1 || amount > 10000) {
          return this.createGeneralError(
            "Invalid Amount",
            "Amount must be between 1 and 10,000 XP for bulk operations."
          );
        }

        return await this.bulkAddXP(customApiUrl, guildId, role.id, amount, reason);
      } else if (action === "leaderboard-reset") {
        return await this.resetLeaderboard(customApiUrl, guildId);
      }

      return this.createGeneralError("Invalid Action", "Unknown action specified.");
    } catch (error) {
      logger.error("Error in XP management command:", error);
      return this.createGeneralError("Error", "An error occurred while managing XP. Please try again later.");
    }
  }

  private async viewUserXP(apiUrl: string, guildId: string, user: User): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/users/${user.id}`, {
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return this.createGeneralError("No Data", `${user.username} hasn't gained any XP in this server yet.`);
      }
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to fetch user data.");
    }

    const userData = data.data;

    const embed = new EmbedBuilder()
      .setTitle("📊 User XP Management")
      .setColor("#4CAF50")
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: `Requested by ${this.user.username}`,
        iconURL: this.user.displayAvatarURL(),
      });

    // User info
    embed.addFields({
      name: "👤 User Information",
      value: [
        `**User:** ${user}`,
        `**Current Level:** ${userData.level}`,
        `**Total XP:** ${userData.totalXP?.toLocaleString() || 0}`,
        `**Messages:** ${userData.messageCount?.toLocaleString() || 0}`,
        `**Voice Time:** ${Math.floor((userData.voiceTime || 0) / 60)} minutes`,
      ].join("\n"),
      inline: false,
    });

    // XP breakdown
    const level = Number(userData.level);
    const totalXP = Number(userData.totalXP);
    const currentLevelXP = this.calculateLevelXP(level);
    const nextLevelXP = this.calculateLevelXP(level + 1);
    const progressXP = totalXP - currentLevelXP;
    const neededXP = nextLevelXP - currentLevelXP;

    embed.addFields({
      name: "📈 Level Progress",
      value: [
        `**XP for Level ${level}:** ${currentLevelXP.toLocaleString()}`,
        `**XP for Level ${level + 1}:** ${nextLevelXP.toLocaleString()}`,
        `**Progress:** ${progressXP.toLocaleString()} / ${neededXP.toLocaleString()}`,
        `**Percentage:** ${Math.floor((progressXP / neededXP) * 100)}%`,
      ].join("\n"),
      inline: false,
    });

    // Management options
    embed.addFields({
      name: "⚙️ Management Options",
      value: [
        "`/leveling xp action:add user:@user amount:500` - Add XP",
        "`/leveling xp action:remove user:@user amount:100` - Remove XP",
        "`/leveling xp action:set-level user:@user level:10` - Set level",
        "`/leveling xp action:reset user:@user` - Reset to level 0",
      ].join("\n"),
      inline: false,
    });

    await this.logCommandUsage("xp", { action: "view", targetUserId: user.id, guildId });
    return { embeds: [embed], ephemeral: true };
  }

  private async addXP(
    apiUrl: string,
    guildId: string,
    user: User,
    amount: number,
    reason: string
  ): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/users/${user.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "add_xp",
        amount,
        reason,
        moderatorId: this.user.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to add XP.");
    }

    const result = data.data;
    let successMessage = `Successfully added **${amount.toLocaleString()}** XP to ${user}.\n\n`;
    successMessage += `**New Total:** ${result.newXP?.toLocaleString() || "Unknown"} XP\n`;
    successMessage += `**New Level:** ${result.newLevel || "Unknown"}`;

    if (result.leveledUp) {
      successMessage += `\n\n🎉 **Level Up!** ${user.username} reached level **${result.newLevel}**!`;
    }

    await this.logCommandUsage("xp", { action: "add", targetUserId: user.id, amount, reason, guildId });
    return this.createGeneralSuccess("XP Added", successMessage);
  }

  private async removeXP(
    apiUrl: string,
    guildId: string,
    user: User,
    amount: number,
    reason: string
  ): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/users/${user.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "remove_xp",
        amount,
        reason,
        moderatorId: this.user.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to remove XP.");
    }

    const result = data.data;
    let successMessage = `Successfully removed **${amount.toLocaleString()}** XP from ${user}.\n\n`;
    successMessage += `**New Total:** ${result.newXP?.toLocaleString() || "Unknown"} XP\n`;
    successMessage += `**New Level:** ${result.newLevel || "Unknown"}`;

    if (result.leveledDown) {
      successMessage += `\n\n📉 **Level Down!** ${user.username} dropped to level **${result.newLevel}**.`;
    }

    await this.logCommandUsage("xp", { action: "remove", targetUserId: user.id, amount, reason, guildId });
    return this.createGeneralSuccess("XP Removed", successMessage);
  }

  private async setLevel(
    apiUrl: string,
    guildId: string,
    user: User,
    level: number,
    reason: string
  ): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/users/${user.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "set_level",
        level,
        reason,
        moderatorId: this.user.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to set level.");
    }

    const result = data.data;
    const requiredXP = this.calculateLevelXP(level);

    let successMessage = `Successfully set ${user}'s level to **${level}**.\n\n`;
    successMessage += `**New XP:** ${requiredXP.toLocaleString()}\n`;
    successMessage += `**Previous Level:** ${result.oldLevel || "Unknown"}`;

    await this.logCommandUsage("xp", { action: "set-level", targetUserId: user.id, level, reason, guildId });
    return this.createGeneralSuccess("Level Set", successMessage);
  }

  private async resetUser(apiUrl: string, guildId: string, user: User, reason: string): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/users/${user.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "reset",
        reason,
        moderatorId: this.user.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to reset user.");
    }

    const result = data.data;

    let successMessage = `Successfully reset ${user}'s progress.\n\n`;
    successMessage += `**Previous Level:** ${result.oldLevel || "Unknown"}\n`;
    successMessage += `**Previous XP:** ${result.oldXP?.toLocaleString() || "Unknown"}\n`;
    successMessage += `**New Status:** Level 0 (0 XP)`;

    await this.logCommandUsage("xp", { action: "reset", targetUserId: user.id, reason, guildId });
    return this.createGeneralSuccess("User Reset", successMessage);
  }

  private async bulkAddXP(
    apiUrl: string,
    guildId: string,
    roleId: string,
    amount: number,
    reason: string
  ): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/bulk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "add_xp_role",
        roleId,
        amount,
        reason,
        moderatorId: this.user.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to perform bulk operation.");
    }

    const result = data.data;

    let successMessage = `Successfully added **${amount.toLocaleString()}** XP to all users with <@&${roleId}>.\n\n`;
    successMessage += `**Users Affected:** ${result.affectedUsers || 0}\n`;
    successMessage += `**Level Ups:** ${result.levelUps || 0}\n`;
    successMessage += `**Total XP Distributed:** ${((result.affectedUsers || 0) * amount).toLocaleString()}`;

    await this.logCommandUsage("xp", {
      action: "bulk-add",
      roleId,
      amount,
      reason,
      affectedUsers: result.affectedUsers,
      guildId,
    });
    return this.createGeneralSuccess("Bulk XP Added", successMessage);
  }

  private async resetLeaderboard(apiUrl: string, guildId: string): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/reset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        moderatorId: this.user.id,
        reason: "Full leaderboard reset by admin",
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to reset leaderboard.");
    }

    const result = data.data;

    let successMessage = `⚠️ **LEADERBOARD RESET COMPLETE** ⚠️\n\n`;
    successMessage += `All user progress has been reset to Level 0.\n\n`;
    successMessage += `**Users Affected:** ${result.affectedUsers || 0}\n`;
    successMessage += `**Total XP Cleared:** ${result.totalXPCleared?.toLocaleString() || 0}`;

    await this.logCommandUsage("xp", { action: "leaderboard-reset", affectedUsers: result.affectedUsers, guildId });
    return this.createGeneralSuccess("Leaderboard Reset", successMessage);
  }

  private calculateLevelXP(level: number): number {
    // Standard leveling formula: level^2 * 100
    return Math.floor(Math.pow(level, 2) * 100);
  }
}

export default new XpManagementCommand();

export const builder = new SlashCommandBuilder()
  .setName("xp")
  .setDescription("Manage user XP and levels (Admin only)")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("Action to perform")
      .setRequired(true)
      .addChoices(
        { name: "View User", value: "view" },
        { name: "Add XP", value: "add" },
        { name: "Remove XP", value: "remove" },
        { name: "Set Level", value: "set-level" },
        { name: "Reset User", value: "reset" },
        { name: "Bulk Add XP (Role)", value: "bulk-add" },
        { name: "Reset Leaderboard", value: "leaderboard-reset" }
      )
  )
  .addUserOption((option) => option.setName("user").setDescription("User to manage"))
  .addIntegerOption((option) =>
    option
      .setName("amount")
      .setDescription("Amount of XP (1-100,000 for individual, 1-10,000 for bulk)")
      .setMinValue(1)
      .setMaxValue(100000)
  )
  .addIntegerOption((option) =>
    option.setName("level").setDescription("Level to set (0-1000)").setMinValue(0).setMaxValue(1000)
  )
  .addRoleOption((option) => option.setName("role").setDescription("Role for bulk operations"))
  .addStringOption((option) => option.setName("reason").setDescription("Reason for the action (for audit log)"));
