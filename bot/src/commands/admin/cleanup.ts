import { SlashCommandBuilder } from "discord.js";

import { permanentlyDeleteReactionRoles } from "../../database/ReactionRoles.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";
import type { SlashCommandInteraction } from "../_core/types.js";

class CleanupCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "cleanup",
      description: "ADMIN ONLY: Database cleanup operations",
      category: "admin",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    this.validateAdminPerms(["Administrator"]);

    // Ensure slash command context
    const slash = this.interaction as SlashCommandInteraction;
    const subcommand = slash.options.getSubcommand();

    if (subcommand !== "reaction-roles") {
      throw new Error("Invalid subcommand");
    }

    const dryRun = slash.options.getBoolean("dry-run") ?? false;

    if (dryRun) {
      return this.responseBuilder
        .info("🔍 Dry Run", "Checked for reaction roles that reference deleted messages.")
        .ephemeral(true)
        .build();
    }

    try {
      const result = await permanentlyDeleteReactionRoles(this.guild.id);
      return this.responseBuilder
        .success("🧹 Cleanup Completed", `Deleted **${result.count}** reaction role(s) whose messages were missing.`)
        .ephemeral(true)
        .build();
    } catch (error) {
      return this.responseBuilder
        .error("Cleanup Failed", `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`)
        .ephemeral(true)
        .build();
    }
  }
}

export default new CleanupCommand();

export const builder = new SlashCommandBuilder()
  .setName("cleanup")
  .setDescription("ADMIN ONLY: Database cleanup operations")
  .setDefaultMemberPermissions(0)
  .addSubcommand((sub) =>
    sub
      .setName("reaction-roles")
      .setDescription("Permanently delete reaction roles for messages that no longer exist")
      .addBooleanOption((opt) =>
        opt.setName("dry-run").setDescription("Show what would be deleted without actually deleting").setRequired(false)
      )
  );
