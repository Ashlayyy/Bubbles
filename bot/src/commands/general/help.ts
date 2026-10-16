import { SlashCommandBuilder } from "discord.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

/**
 * Help Command - Display help information about commands and features
 */
export class HelpCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "help",
      description: "Get help with commands and features",
      category: "general",
      ephemeral: false,
      guildOnly: false, // Help can work in DMs too
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const commandName = this.getStringOption("command");
    const category = this.getStringOption("category");

    if (commandName) {
      return await Promise.resolve(this.handleSpecificCommand(commandName));
    } else if (category) {
      return await Promise.resolve(this.handleCategory(category));
    } else {
      return await Promise.resolve(this.handleGeneralHelp());
    }
  }

  private handleSpecificCommand(commandName: string): CommandResponse {
    try {
      const command = this.client.commands.get(commandName);

      if (!command) {
        return this.createGeneralError("Command Not Found", `No command found with the name \`${commandName}\`.`);
      }

      // Build detailed command help
      const helpText = [
        `**Description:** Command help for \`${commandName}\``,
        `**Category:** ${command.category}`,
        `**Usage:** \`/${commandName}\``,
      ].join("\n\n");

      return this.createGeneralInfo(`Help: ${commandName}`, helpText);
    } catch (error) {
      throw new Error(`Failed to get command help: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private handleCategory(category: string): CommandResponse {
    try {
      const commands = this.client.commands.filter((cmd) => cmd.category === category);

      if (commands.size === 0) {
        return this.createGeneralError("Category Not Found", `No commands found in category \`${category}\`.`);
      }

      const commandList = commands.map((cmd) => {
        return `• \`/${cmd.category}\` - Command in ${category} category`;
      });

      return this.createGeneralInfo(`Help: ${category} Commands`, commandList.join("\n"));
    } catch (error) {
      throw new Error(`Failed to get category help: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private handleGeneralHelp(): CommandResponse {
    try {
      const helpText = [
        "**🤖 Bubbles Discord Bot**",
        "",
        "Welcome to Bubbles! Here are the main command categories:",
        "",
        "📋 **General Commands**",
        "• `/help` - Show this help message",
        "• `/userinfo` - Get information about a user",
        "• `/serverinfo` - Get information about the server",
        "",
        "⚡ **Moderation Commands**",
        "• `/ban` - Ban a user from the server",
        "• `/kick` - Kick a user from the server",
        "• `/warn` - Warn a user",
        "• `/case` - View moderation case details",
        "",
        "🎵 **Music Commands**",
        "• `/play` - Play music in a voice channel",
        "• `/pause` - Pause the current track",
        "• `/skip` - Skip the current track",
        "",
        "⚙️ **Admin Commands**",
        "• `/config` - Configure server settings",
        "• `/automod` - Manage automod settings",
        "• `/appeals` - Manage appeals system",
        "",
        "Use `/help command:<command-name>` for detailed help on a specific command.",
        "Use `/help category:<category-name>` to see all commands in a category.",
      ];

      return this.createGeneralInfo("Bot Help", helpText.join("\n"));
    } catch (error) {
      throw new Error(`Failed to generate help: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

// Export the command instance
export default new HelpCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Get help with commands and features")
  .setDefaultMemberPermissions(0)
  .addStringOption((option) =>
    option.setName("command").setDescription("Get help for a specific command").setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName("category")
      .setDescription("Get help for a command category")
      .setRequired(false)
      .addChoices(
        { name: "General", value: "general" },
        { name: "Moderation", value: "moderation" },
        { name: "Music", value: "music" },
        { name: "Admin", value: "admin" },
        { name: "Developer", value: "dev" }
      )
  );
