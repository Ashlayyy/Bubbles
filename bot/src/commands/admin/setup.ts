import { SlashCommandBuilder, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";

import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";
import { startReportWizard } from "../_shared/report-setup.js";
import { startSetupWizard as startAutoModWizard } from "./automod-setup.js";
import { startLoggingWizard } from "./logging.js";
import { startTicketWizard } from "./ticket-setup.js";

const MODULE_CHOICES = ["tickets", "automod", "reports", "logging"] as const;

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

  // Autocomplete for the `module` option
  public async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    try {
      const focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name !== "module") {
        await interaction.respond([]);
        return;
      }

      const value = String(focusedOption.value).toLowerCase();
      let matched = MODULE_CHOICES.filter((m) => m.includes(value)).slice(0, 25);

      // Discord requires 1-25 choices; fallback to full list if none matched
      if (matched.length === 0) {
        matched = MODULE_CHOICES.slice(0, 25);
      }

      console.debug("/setup autocomplete", { value, matched });

      await interaction.respond(matched.map((m) => ({ name: m, value: m })));
    } catch (err) {
      console.error("Autocomplete error:", err);
    }
  }

  protected async execute(): Promise<CommandResponse> {
    // Ensure the user has guild management perms
    this.validateAdminPerms(["ManageGuild"]);

    const moduleName = this.getStringOption("module", true) as SetupModule;

    switch (moduleName) {
      case "tickets":
        await startTicketWizard(this.client, this.interaction as ChatInputCommandInteraction);
      case "automod":
        await startAutoModWizard(this.client, this.interaction as ChatInputCommandInteraction);
      case "reports":
        await startReportWizard(this.client, this.interaction as ChatInputCommandInteraction);
      case "logging":
        await startLoggingWizard(this.client, this.interaction as ChatInputCommandInteraction);
      default:
        return {
          content: `❌ Unknown module: ${moduleName}`,
          ephemeral: true,
        };
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
