import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";

import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";
import { startReportWizard } from "../_shared/report-setup.js";
import { startAppealsWizard } from "./setup-wizards/appeals-setup.js";
import { startSetupWizard as startAutoModWizard } from "./setup-wizards/automod-setup.js";
import { startLoggingWizard } from "./setup-wizards/logging-setup.js";
import { startTicketWizard } from "./setup-wizards/ticket-setup.js";
import { startWelcomeWizard } from "./setup-wizards/welcome-setup.js";

const MODULE_CHOICES = ["tickets", "automod", "reports", "logging", "welcome", "appeals", "reactionroles"] as const;

type SetupModule = (typeof MODULE_CHOICES)[number];

class SetupCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "setup",
      description: "Configure various modules via interactive wizards",
      category: "admin",
      guildOnly: true,
      ephemeral: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse | undefined> {
    // Ensure the user has guild management perms
    this.validateAdminPerms(["ManageGuild"]);

    const moduleName = this.getStringOption("module", true) as SetupModule;

    try {
      // Wizards handle their own reply/defer logic. Do NOT reply/defer here.
      switch (moduleName) {
        case "tickets":
          await startTicketWizard(this.client, this.interaction as ChatInputCommandInteraction);
          break;
        case "automod":
          await startAutoModWizard(this.client, this.interaction as ChatInputCommandInteraction);
          break;
        case "reports":
          await startReportWizard(this.client, this.interaction as ChatInputCommandInteraction);
          break;
        case "logging":
          await startLoggingWizard(this.client, this.interaction as ChatInputCommandInteraction);
          break;
        case "welcome":
          await startWelcomeWizard(this.client, this.interaction as ChatInputCommandInteraction);
          break;
        case "appeals":
          await startAppealsWizard(this.client, this.interaction as ChatInputCommandInteraction);
          break;
        default:
          return {
            content: `❌ Unknown module: ${moduleName}`,
            ephemeral: true,
          };
      }

      // Return undefined to prevent the command framework from sending a response
      // since the wizards handle their own responses
      return undefined;
    } catch (error) {
      logger.error(`Error starting ${moduleName} setup wizard:`, error);

      // Provide more specific error messages
      let errorMessage = `❌ Failed to start ${moduleName} setup wizard. Please try again.`;

      if (error instanceof Error) {
        if (error.message.includes("Missing Permissions")) {
          errorMessage = `❌ I don't have the required permissions to set up ${moduleName}.`;
        } else if (error.message.includes("Unknown Channel")) {
          errorMessage = `❌ One of the channels specified for ${moduleName} setup no longer exists.`;
        } else if (error.message.includes("Unknown Role")) {
          errorMessage = `❌ One of the roles specified for ${moduleName} setup no longer exists.`;
        }
      }

      // If the interaction is not replied or deferred, return an error message
      if (!this.interaction.replied && !this.interaction.deferred) {
        return {
          content: errorMessage,
          ephemeral: true,
        };
      }

      // Return undefined to prevent double responses
      return undefined;
    }
  }

  // Disable auto-defer; the specific wizard will handle initial reply itself
  protected shouldAutoDefer(): boolean {
    return false;
  }
}

export default new SetupCommand();

export const builder = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Open an interactive setup wizard for various modules")
  .addStringOption((opt) =>
    opt.setName("module").setDescription("Which module to configure").setRequired(true).setAutocomplete(true)
  )
  .setDefaultMemberPermissions(0);
