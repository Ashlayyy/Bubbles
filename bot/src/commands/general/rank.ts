import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

function xpForLevel(level: number): number {
  return level * level * 100;
}

class RankCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "rank",
      description: "Show your server rank and XP",
      category: "general",
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const target = this.getUserOption("user") ?? this.user;
    const row = await prisma.userXp.findUnique({
      where: { guildId_userId: { guildId: this.guild.id, userId: target.id } },
    });

    if (!row) {
      return this.createGeneralInfo(
        "No rank yet",
        `${this.formatUserDisplay(target)} has not earned XP in this server yet.`
      );
    }

    const higher = await prisma.userXp.count({
      where: { guildId: this.guild.id, xp: { gt: row.xp } },
    });
    const rank = higher + 1;
    const xpToNext = Math.max(0, xpForLevel(row.level + 1) - row.xp);

    const embed = new EmbedBuilder()
      .setTitle(`${this.formatUserDisplay(target)}'s rank`)
      .setColor(0x5865f2)
      .addFields(
        { name: "Level", value: String(row.level), inline: true },
        { name: "XP", value: String(row.xp), inline: true },
        { name: "Rank", value: `#${String(rank)}`, inline: true },
        { name: "Messages", value: String(row.messages), inline: true },
        { name: "XP to next level", value: String(xpToNext), inline: true }
      )
      .setTimestamp();

    await this.logCommandUsage("rank", { target: target.id });
    return { embeds: [embed], ephemeral: false };
  }
}

export default new RankCommand();

export const builder = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("Show your server rank and XP")
  .setDefaultMemberPermissions(0)
  .addUserOption((opt) => opt.setName("user").setDescription("Member to inspect (defaults to you)"));
