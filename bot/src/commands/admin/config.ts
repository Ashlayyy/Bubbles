import { SlashCommandBuilder } from "discord.js";

import { getGuildConfig, updateGuildConfig } from "../../database/GuildConfig.js";
import logger from "../../logger.js";
import { cacheService } from "../../services/cacheService.js";
import { i18nService } from "../../services/i18nService.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

export class ConfigCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "config",
      description: "Server configuration",
      category: "admin",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const interaction = this.interaction as import("discord.js").ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    if (group === "language") {
      if (subcommand === "set") {
        return await this.handleSetLanguage();
      }
      // Default to get for unknown/missing sub
      return await this.handleGetLanguage();
    }

    // Log which subcommand was used (string-only per user preference)
    logger.info(`/config ${subcommand} invoked`);

    // Minimal ephemeral acknowledgement
    return { content: `✅ /config ${subcommand} used`, ephemeral: true };
  }

  private async handleGetLanguage(): Promise<CommandResponse> {
    const cacheKey = `guild:language:${this.guild.id}`;
    const oneHourMs = 60 * 60 * 1000;

    try {
      let lang = await cacheService.get<string>(cacheKey);
      if (!lang) {
        const config = await getGuildConfig(this.guild.id);
        lang = (config.preferredLanguage || "en").toLowerCase();
        await cacheService.set(cacheKey, lang, oneHourMs);
      }

      logger.info(`/config language get for guild ${this.guild.id}: ${lang}`);
      return this.createAdminInfo("Current Language", `This server's language is '${lang}'.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get language for guild ${this.guild.id}: ${message}`);
      return this.createAdminError(
        "Language Read Failed",
        "An error occurred while fetching the language. Please try again."
      );
    }
  }

  private async handleSetLanguage(): Promise<CommandResponse> {
    const lang = (this.getStringOption("lang", true) || "en").toLowerCase();

    try {
      const available = i18nService.getAvailableLanguages();
      if (!available.includes(lang)) {
        return this.createAdminError(
          "Unsupported Language",
          `Language '${lang}' is not available. Available: ${available.join(", ")}`
        );
      }

      await updateGuildConfig(this.guild.id, { preferredLanguage: lang });

      // Cache language for 1 hour (TTL in ms)
      await cacheService.set(`guild:language:${this.guild.id}`, lang, 60 * 60 * 1000);

      logger.info(`/config language set to ${lang} for guild ${this.guild.id}`);

      return this.createAdminSuccess("Language Updated", `This server's language is now '${lang}'.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to set language '${lang}' for guild ${this.guild.id}: ${message}`);
      return this.createAdminError(
        "Language Update Failed",
        "An error occurred while updating the language. Please try again."
      );
    }
  }
}

export default new ConfigCommand();

export const builder = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Server configuration")
  .setDefaultMemberPermissions(0)
  .addSubcommandGroup((g) =>
    g
      .setName("language")
      .setDescription("Language settings")
      .addSubcommand((s) => s.setName("get").setDescription("Show current server language"))
      .addSubcommand((s) =>
        s
          .setName("set")
          .setDescription("Set server language")
          .addStringOption((o) => o.setName("lang").setDescription("Language code (e.g., en)").setRequired(true))
      )
  );
