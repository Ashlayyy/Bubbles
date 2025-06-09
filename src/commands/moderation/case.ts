import { SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("case")
    .setDescription("Manage moderation cases")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View a specific case")
        .addIntegerOption((opt) => opt.setName("number").setDescription("Case number to view").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("history")
        .setDescription("View a user's moderation history")
        .addUserOption((opt) => opt.setName("user").setDescription("User to view history for").setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName("limit").setDescription("Number of cases to show (default: 10)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("note")
        .setDescription("Add a note to a case")
        .addIntegerOption((opt) => opt.setName("number").setDescription("Case number").setRequired(true))
        .addStringOption((opt) => opt.setName("note").setDescription("Note to add").setRequired(true))
        .addBooleanOption((opt) =>
          opt.setName("internal").setDescription("Make this note internal (staff-only)").setRequired(false)
        )
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "view": {
          const caseNumber = interaction.options.getInteger("number", true);

          const case_ = await client.moderationManager.getCase(interaction.guild.id, caseNumber);

          if (!case_) {
            await interaction.reply({
              content: `❌ Case #${caseNumber} not found.`,
              ephemeral: true,
            });
            return;
          }

          const embed = client.genEmbed({
            title: `📋 Case #${case_.caseNumber}`,
            color: case_.type === "BAN" ? 0xe74c3c : case_.type === "WARN" ? 0xf1c40f : 0x3498db,
            fields: [
              { name: "👤 User", value: `<@${case_.userId}>`, inline: true },
              { name: "👮 Moderator", value: `<@${case_.moderatorId}>`, inline: true },
              { name: "⚖️ Action", value: case_.type, inline: true },
              { name: "📝 Reason", value: case_.reason || "No reason provided", inline: false },
              { name: "📊 Severity", value: case_.severity, inline: true },
              { name: "🔢 Points", value: case_.points.toString(), inline: true },
              { name: "📅 Created", value: `<t:${Math.floor(case_.createdAt.getTime() / 1000)}:F>`, inline: true },
            ],
            footer: { text: `Case ID: ${case_.id}` },
          });

          if (case_.duration) {
            embed.addFields({ name: "⏱️ Duration", value: formatDuration(case_.duration), inline: true });
          }

          if (case_.evidence.length > 0) {
            embed.addFields({ name: "🔍 Evidence", value: case_.evidence.join("\n"), inline: false });
          }

          if (case_.publicNote) {
            embed.addFields({ name: "📄 Public Note", value: case_.publicNote, inline: false });
          }

          if (case_.staffNote) {
            embed.addFields({ name: "🔒 Staff Note", value: case_.staffNote, inline: false });
          }

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case "history": {
          const targetUser = interaction.options.getUser("user", true);
          const limit = interaction.options.getInteger("limit") ?? 10;

          const cases = await client.moderationManager.getUserHistory(interaction.guild.id, targetUser.id, limit);

          if (cases.length === 0) {
            await interaction.reply({
              content: `📝 **${targetUser.tag}** has no moderation history.`,
              ephemeral: true,
            });
            return;
          }

          const points = await client.moderationManager.getInfractionPoints(interaction.guild.id, targetUser.id);

          const embed = client.genEmbed({
            title: `📋 Moderation History - ${targetUser.tag}`,
            description: `**Total Points:** ${points}\n**Total Cases:** ${cases.length}`,
            fields: cases.map((case_) => ({
              name: `Case #${case_.caseNumber} - ${case_.type}`,
              value: `${case_.reason || "No reason"}\n<t:${Math.floor(case_.createdAt.getTime() / 1000)}:R>`,
              inline: true,
            })),
            footer: { text: `Showing last ${Math.min(limit, cases.length)} cases` },
          });

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case "note": {
          const caseNumber = interaction.options.getInteger("number", true);
          const note = interaction.options.getString("note", true);
          const isInternal = interaction.options.getBoolean("internal") ?? false;

          const case_ = await client.moderationManager.getCase(interaction.guild.id, caseNumber);

          if (!case_) {
            await interaction.reply({
              content: `❌ Case #${caseNumber} not found.`,
              ephemeral: true,
            });
            return;
          }

          await client.moderationManager.addCaseNote(case_.id, interaction.user.id, note, isInternal);

          await interaction.reply({
            content: `✅ Added ${isInternal ? "internal" : "public"} note to case #${caseNumber}.`,
            ephemeral: true,
          });
          break;
        }

        default: {
          await interaction.reply({
            content: "❌ Unknown subcommand",
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      await interaction.reply({
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.MODERATOR,
      isConfigurable: true,
    },
  }
);

function formatDuration(seconds: number): string {
  const units = [
    { name: "day", seconds: 86400 },
    { name: "hour", seconds: 3600 },
    { name: "minute", seconds: 60 },
  ];

  for (const unit of units) {
    const count = Math.floor(seconds / unit.seconds);
    if (count > 0) {
      return `${count} ${unit.name}${count !== 1 ? "s" : ""}`;
    }
  }

  return `${seconds} second${seconds !== 1 ? "s" : ""}`;
}
