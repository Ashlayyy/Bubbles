import type { ReactionRole } from "@prisma/client";
import { ApplicationCommandType, ContextMenuCommandBuilder, EmbedBuilder } from "discord.js";
import { getReactionRolesByMessage } from "../../../database/ReactionRoles.js";
import Command from "../../../structures/Command.js";
import { PermissionLevel } from "../../../structures/PermissionTypes.js";

export default new Command(
  new ContextMenuCommandBuilder().setName("List Reaction Roles").setType(ApplicationCommandType.Message),
  async (client, interaction) => {
    if (!interaction.isMessageContextMenuCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    const message = interaction.targetMessage;
    const roles = await getReactionRolesByMessage(message.id);

    if (roles.length === 0) {
      await interaction.followUp({
        content: "No reaction roles are configured for that message.",
      });
      return;
    }

    const roleMentions = roles
      .map((r: ReactionRole) => {
        const emoji = client.emojis.cache.get(r.emoji) ?? r.emoji;
        return `${emoji} -> <@&${r.roleIds[0]}>`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Configured Reaction Roles")
      .setDescription(roleMentions)
      .setColor("Blue")
      .setFooter({ text: `Message ID: ${message.id}` });

    await interaction.followUp({ embeds: [embed] });
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
