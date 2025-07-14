import type { ChatInputCommandInteraction } from "discord.js";
import type Client from "../../../structures/Client.js";
import { handleMessageCreate } from "../reactionroles.js";

// Export only the wizard function - no standalone command
export async function startReactionRolesWizard(
  client: Client,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Delegate to the new Discord-native wizard
  // Cast interaction to the expected type for handleMessageCreate
  // (GuildChatInputCommandInteraction is a superset of ChatInputCommandInteraction)
  await handleMessageCreate(client, interaction as any);
}
