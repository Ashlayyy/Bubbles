import { SlashCommandBuilder } from "discord.js";

import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * PingCommand – shows the bot's current WebSocket latency.
 */
class PingCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "ping",
      description: "Shows the ping of the bot.",
      category: "admin",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    // Require administrator permission (matches legacy behaviour)
    this.validateAdminPerms(["Administrator"]);

    // Ensure async function has an await to satisfy linter
    await Promise.resolve();

    const latency = this.client.ws.ping;

    return this.responseBuilder.info("🏓 Pong!", `Latency: \`${latency} ms\``).ephemeral(true).build();
  }
}

// Export the command instance
export default new PingCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Shows the ping of the bot.")
  .setDefaultMemberPermissions(0);
