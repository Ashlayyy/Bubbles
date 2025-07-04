import { BaseCommand } from "../BaseCommand.js";
import type { CommandConfig, CommandResponse } from "../types.js";

export abstract class GeneralCommand extends BaseCommand {
  constructor(config: CommandConfig) {
    super({
      ...config,
      category: "general",
    });
  }

  // General command utility methods

  /**
   * Create general success response
   */
  protected createGeneralSuccess(title: string, description?: string): CommandResponse {
    return this.responseBuilder
      .success(title, description)
      .ephemeral(false) // General commands usually want public responses
      .build();
  }

  /**
   * Create general error response
   */
  protected createGeneralError(title: string, description?: string): CommandResponse {
    return this.responseBuilder.error(title, description).ephemeral(true).build();
  }

  /**
   * Create general info response
   */
  protected createGeneralInfo(title: string, description?: string): CommandResponse {
    return this.responseBuilder.info(title, description).ephemeral(false).build();
  }

  /**
   * Log general command usage
   */
  protected async logCommandUsage(commandName: string, additionalData?: Record<string, any>): Promise<void> {
    try {
      await this.client.logManager.log(this.guild.id, "COMMAND_USAGE", {
        userId: this.user.id,
        channelId: this.channel.id,
        metadata: { commandName, ...additionalData },
      });
    } catch (_error) {
      // Don't throw on logging errors, just silently continue
    }
  }

  /**
   * Check if user has basic permissions for command
   */
  protected validateBasicPermissions(): void {
    // Most general commands don't need special permissions
    // But this can be overridden by specific commands if needed
  }

  /**
   * Format user display name safely
   */
  protected formatUserDisplay(user: { displayName?: string; username?: string }): string {
    return user.displayName ?? user.username ?? "Unknown User";
  }

  /**
   * Create paginated response helper
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
}
