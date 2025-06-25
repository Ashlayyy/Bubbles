import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import Client from "../../../structures/Client.js";
import Command from "../../../structures/Command.js";
import { PermissionLevel } from "../../../structures/PermissionTypes.js";

export default new Command(
  new ContextMenuCommandBuilder().setName("Add Reaction Role").setType(ApplicationCommandType.Message),
  async (_client: Client, interaction) => {
    if (!interaction.isMessageContextMenuCommand()) return;

    // Check if the message is in the current guild
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ This command can only be used in servers.",
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`add-reaction-role-modal-${interaction.targetMessage.id}`)
      .setTitle("Add Reaction Role");

    const emojiInput = new TextInputBuilder()
      .setCustomId("emoji")
      .setLabel("Emoji")
      .setPlaceholder("Enter an emoji (e.g., 😀 or :custom_emoji:)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const roleInput = new TextInputBuilder()
      .setCustomId("role")
      .setLabel("Role ID or Name")
      .setPlaceholder("Enter role name or ID")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput)
    );

    await interaction.showModal(modal);
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
