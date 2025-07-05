import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * Add Reaction Role Context Menu Command
 */
class AddReactionRoleCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "Add Reaction Role",
      description: "Add a reaction role to a message",
      category: "admin",
      permissions: {
        level: PermissionLevel.ADMIN,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.checkIsMessageContextMenu()) {
      throw new Error("This command only supports message context menu format");
    }

    const interaction = this.interaction as MessageContextMenuCommandInteraction;

    const modal = new ModalBuilder()
      .setCustomId(`add-reaction-role-modal-${interaction.targetMessage.id}`)
      .setTitle("Add Reaction Role");

    const emojiInput = new TextInputBuilder()
      .setCustomId("emoji")
      .setLabel("Emoji")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const roleInput = new TextInputBuilder()
      .setCustomId("role")
      .setLabel("Role ID or Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput)
    );

    await interaction.showModal(modal);

    // Return empty response since we're showing a modal
    return {};
  }

  private checkIsMessageContextMenu(): boolean {
    return this.interaction.isMessageContextMenuCommand();
  }
}

// Export the command instance
export default new AddReactionRoleCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Add Reaction Role")
  .setType(ApplicationCommandType.Message);
