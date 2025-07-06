import { BaseCommand } from "../BaseCommand.js";
import type { CommandConfig, CommandResponse } from "../types.js";

export abstract class PublicCommand extends BaseCommand {
  constructor(config: CommandConfig) {
    super({
      ...config,
      category: config.category ?? "public",
    });
  }

  // Public command utility methods

  /**
   * Create public success response
   */
  protected createPublicSuccess(title: string, description?: string): CommandResponse {
    return this.responseBuilder
      .success(title, description)
      .ephemeral(false) // Public commands usually want public responses
      .build();
  }

  /**
   * Create public error response
   */
  protected createPublicError(title: string, description?: string): CommandResponse {
    return this.responseBuilder.error(title, description).ephemeral(true).build();
  }

  /**
   * Create public info response
   */
  protected createPublicInfo(title: string, description?: string): CommandResponse {
    return this.responseBuilder.info(title, description).ephemeral(false).build();
  }

  /**
   * Create public warning response
   */
  protected createPublicWarning(title: string, description?: string): CommandResponse {
    return this.responseBuilder.warning(title, description).ephemeral(false).build();
  }

  /**
   * Log public command usage
   */
  protected async logCommandUsage(commandName: string, additionalData?: Record<string, any>): Promise<void> {
    try {
      await this.client.logManager.log(this.guild.id, "COMMAND_USAGE", {
        userId: this.user.id,
        channelId: this.channel.id,
        metadata: { commandName, category: "public", ...additionalData },
      });
    } catch (_error) {
      // Don't throw on logging errors, just silently continue
    }
  }

  /**
   * Check if user has basic permissions for command
   * Public commands should be accessible to everyone
   */
  protected validateBasicPermissions(): void {
    // Public commands don't need special permissions by default
    // Individual commands can override this if they need specific checks
  }

  /**
   * Format user display name safely
   */
  protected formatUserDisplay(user: { displayName?: string; username?: string }): string {
    return user.displayName ?? user.username ?? "Unknown User";
  }

  /**
   * Create paginated response helper for public commands
   */
  protected createPaginatedInfo(title: string, items: string[], itemsPerPage = 10): CommandResponse {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const currentPage = 1; // Start with first page

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = items.slice(startIndex, endIndex);

    const description =
      currentItems.join("\n") + (totalPages > 1 ? `\n\nPage ${String(currentPage)} of ${String(totalPages)}` : "");

    return this.responseBuilder.info(title, description).ephemeral(false).build();
  }

  /**
   * Create interactive button response for public commands
   */
  protected createInteractiveResponse(title: string, description: string, components: any[]): CommandResponse {
    return {
      embeds: [this.responseBuilder.info(title, description).build().embeds?.[0]].filter(Boolean),
      components,
      ephemeral: false,
    };
  }

  /**
   * Handle custom cooldown for public commands
   */
  protected async checkCustomCooldown(_commandName: string, _cooldownSeconds = 5): Promise<boolean> {
    // Use the built-in cooldown system from BaseCommand
    return await this.cooldown(this.interaction);
  }
}
