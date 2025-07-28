import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class LevelRewardsCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "rewards",
      description: "Manage level role rewards for the server",
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
    const action = this.getStringOption("action") || "list";
    const guildId = this.guild.id;

    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      if (action === "list") {
        return await this.listRewards(customApiUrl, guildId);
      } else if (action === "add") {
        const level = this.getIntegerOption("level");
        const role = this.getRoleOption("role");
        const removeOnDemotion = this.getBooleanOption("remove-on-demotion") ?? false;

        if (!level || !role) {
          return this.createGeneralError("Invalid Input", "Please specify both level and role.");
        }

        if (level < 1 || level > 1000) {
          return this.createGeneralError("Invalid Level", "Level must be between 1 and 1000.");
        }

        return await this.addReward(customApiUrl, guildId, level, role.id, removeOnDemotion);
      } else if (action === "remove") {
        const level = this.getIntegerOption("level");
        const role = this.getRoleOption("role");

        if (!level && !role) {
          return this.createGeneralError("Invalid Input", "Please specify either level or role to remove.");
        }

        return await this.removeReward(customApiUrl, guildId, level ?? undefined, role?.id);
      } else if (action === "clear") {
        return await this.clearAllRewards(customApiUrl, guildId);
      }

      return this.createGeneralError("Invalid Action", "Unknown action specified.");
    } catch (error) {
      logger.error("Error in level rewards command:", error);
      return this.createGeneralError(
        "Error",
        "An error occurred while managing level rewards. Please try again later."
      );
    }
  }

  private async listRewards(apiUrl: string, guildId: string): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/rewards`, {
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to fetch rewards.");
    }

    const rewards = data.data;

    const embed = new EmbedBuilder()
      .setTitle("🏆 Level Role Rewards")
      .setColor("#FFD700")
      .setTimestamp()
      .setFooter({
        text: `Requested by ${this.user.username}`,
        iconURL: this.user.displayAvatarURL(),
      });

    if (!rewards || rewards.length === 0) {
      embed.setDescription("No level rewards configured for this server.");
      embed.addFields({
        name: "📖 Getting Started",
        value: [
          "`/leveling rewards action:add level:5 role:@Member` - Add role reward",
          "`/leveling rewards action:remove level:5` - Remove reward by level",
          "`/leveling rewards action:clear` - Remove all rewards",
        ].join("\n"),
        inline: false,
      });

      await this.logCommandUsage("rewards", { action: "list", guildId, rewardCount: 0 });
      return { embeds: [embed], ephemeral: true };
    }

    // Sort rewards by level
    rewards.sort((a: any, b: any) => a.level - b.level);

    // Group rewards for display
    const rewardText = rewards
      .map((reward: any) => {
        const roleDisplay = `<@&${reward.roleId}>`;
        const demotionText = reward.removeOnDemotion ? " (removes on demotion)" : "";
        return `**Level ${reward.level}:** ${roleDisplay}${demotionText}`;
      })
      .join("\n");

    // Split into chunks if too long
    const maxLength = 1024;
    if (rewardText.length > maxLength) {
      const chunks = this.chunkText(rewardText, maxLength);
      chunks.forEach((chunk, index) => {
        embed.addFields({
          name: index === 0 ? "🎁 Configured Rewards" : "🎁 Configured Rewards (continued)",
          value: chunk,
          inline: false,
        });
      });
    } else {
      embed.addFields({
        name: "🎁 Configured Rewards",
        value: rewardText,
        inline: false,
      });
    }

    // Add statistics
    const levelRange = rewards.length > 0 ? `${rewards[0].level} - ${rewards[rewards.length - 1].level}` : "None";
    const demotionRewards = rewards.filter((r: any) => r.removeOnDemotion).length;

    embed.addFields({
      name: "📊 Statistics",
      value: [
        `**Total Rewards:** ${rewards.length}`,
        `**Level Range:** ${levelRange}`,
        `**Remove on Demotion:** ${demotionRewards}`,
      ].join("\n"),
      inline: false,
    });

    embed.addFields({
      name: "📖 Quick Commands",
      value: [
        "`/leveling rewards action:add level:10 role:@VIP` - Add reward",
        "`/leveling rewards action:remove level:10` - Remove by level",
        "`/leveling rewards action:remove role:@VIP` - Remove by role",
        "`/leveling rewards action:clear` - Remove all rewards",
      ].join("\n"),
      inline: false,
    });

    await this.logCommandUsage("rewards", { action: "list", guildId, rewardCount: rewards.length });
    return { embeds: [embed], ephemeral: true };
  }

  private async addReward(
    apiUrl: string,
    guildId: string,
    level: number,
    roleId: string,
    removeOnDemotion: boolean
  ): Promise<CommandResponse> {
    // Check if role exists and bot can manage it
    const role = await this.guild.roles.fetch(roleId);
    if (!role) {
      return this.createGeneralError("Invalid Role", "The specified role was not found.");
    }

    const botMember = await this.guild.members.fetch(this.interaction.client.user.id);
    if (role.position >= (botMember.roles.highest.position || 0)) {
      return this.createGeneralError(
        "Permission Error",
        "I cannot manage this role. Please ensure the role is below my highest role in the server settings."
      );
    }

    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/rewards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ level, roleId, removeOnDemotion }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to add reward.");
    }

    await this.logCommandUsage("rewards", { action: "add", level, roleId, removeOnDemotion, guildId });
    return this.createGeneralSuccess(
      "Reward Added",
      `Successfully added <@&${roleId}> as a reward for reaching level **${level}**.${
        removeOnDemotion ? "\n\n⚠️ This role will be removed if the user's level drops below this threshold." : ""
      }`
    );
  }

  private async removeReward(
    apiUrl: string,
    guildId: string,
    level?: number,
    roleId?: string
  ): Promise<CommandResponse> {
    const query = new URLSearchParams();
    if (level) query.append("level", level.toString());
    if (roleId) query.append("roleId", roleId);

    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/rewards?${query}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to remove reward.");
    }

    const removedCount = data.data?.removedCount || 0;
    if (removedCount === 0) {
      return this.createGeneralError("Not Found", "No matching rewards found to remove.");
    }

    await this.logCommandUsage("rewards", { action: "remove", level, roleId, removedCount, guildId });
    return this.createGeneralSuccess(
      "Reward Removed",
      `Successfully removed ${removedCount} reward${removedCount > 1 ? "s" : ""}.${
        level ? ` (Level ${level})` : ""
      }${roleId ? ` (Role <@&${roleId}>)` : ""}`
    );
  }

  private async clearAllRewards(apiUrl: string, guildId: string): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/rewards`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to clear rewards.");
    }

    const removedCount = data.data?.removedCount || 0;
    if (removedCount === 0) {
      return this.createGeneralError("No Rewards", "No rewards found to remove.");
    }

    await this.logCommandUsage("rewards", { action: "clear", removedCount, guildId });
    return this.createGeneralSuccess(
      "Rewards Cleared",
      `Successfully removed all ${removedCount} level reward${removedCount > 1 ? "s" : ""} from this server.`
    );
  }

  private chunkText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const lines = text.split("\n");
    let currentChunk = "";

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
      }
      currentChunk += (currentChunk ? "\n" : "") + line;
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

export default new LevelRewardsCommand();

export const builder = new SlashCommandBuilder()
  .setName("rewards")
  .setDescription("Manage level role rewards for the server")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("Action to perform")
      .setRequired(true)
      .addChoices(
        { name: "List Rewards", value: "list" },
        { name: "Add Reward", value: "add" },
        { name: "Remove Reward", value: "remove" },
        { name: "Clear All Rewards", value: "clear" }
      )
  )
  .addIntegerOption((option) =>
    option.setName("level").setDescription("Level for the reward").setMinValue(1).setMaxValue(1000)
  )
  .addRoleOption((option) => option.setName("role").setDescription("Role to give as reward"))
  .addBooleanOption((option) =>
    option
      .setName("remove-on-demotion")
      .setDescription("Remove role if user's level drops below this level (default: false)")
  );
