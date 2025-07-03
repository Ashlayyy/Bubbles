import i18next from "i18next";
import Backend from "i18next-fs-backend";
import { resolve } from "path";
import { fileURLToPath } from "url";
import logger from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

export class I18nService {
  private static instance: I18nService | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await i18next.use(Backend).init({
        lng: "en", // default language
        fallbackLng: "en",
        debug: process.env.NODE_ENV === "development",

        backend: {
          loadPath: resolve(__dirname, "../locales/{{lng}}/{{ns}}.json"),
          addPath: resolve(__dirname, "../locales/{{lng}}/{{ns}}.missing.json"),
        },

        ns: ["common", "commands", "errors", "moderation"],
        defaultNS: "common",

        interpolation: {
          escapeValue: false, // not needed for Discord
        },

        returnEmptyString: false,
        returnNull: false,
      });

      this.initialized = true;
      logger.info("i18n service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize i18n service:", error);
      throw error;
    }
  }

  /**
   * Get translation for a key with optional interpolation
   */
  t(key: string, options?: { [key: string]: unknown }, lng?: string): string {
    if (!this.initialized) {
      logger.warn("i18n service not initialized, returning key as fallback");
      return key;
    }

    return i18next.t(key, { ...options, lng });
  }

  /**
   * Get translation for a guild's preferred language
   */
  async tForGuild(guildId: string, key: string, options?: { [key: string]: unknown }): Promise<string> {
    if (!this.initialized) {
      logger.warn("i18n service not initialized, returning key as fallback");
      return key;
    }

    // Get guild's preferred language from database
    const preferredLanguage = await this.getGuildLanguage(guildId);
    return this.t(key, options, preferredLanguage);
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    if (!this.initialized) {
      return ["en"];
    }
    return i18next.languages || ["en"];
  }

  /**
   * Change language for the current instance
   */
  async changeLanguage(lng: string): Promise<void> {
    if (!this.initialized) {
      logger.warn("i18n service not initialized");
      return;
    }

    await i18next.changeLanguage(lng);
  }

  /**
   * Get guild's preferred language from database
   */
  private async getGuildLanguage(guildId: string): Promise<string> {
    try {
      const { getGuildConfig } = await import("../database/GuildConfig.js");
      const guildConfig = await getGuildConfig(guildId);
      return guildConfig.preferredLanguage ?? "en";
    } catch (error) {
      logger.error(`Failed to get guild language for ${guildId}:`, error);
      return "en";
    }
  }
}

// Export singleton instance
export const i18nService = I18nService.getInstance();
