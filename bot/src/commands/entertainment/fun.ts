import { EmbedBuilder, SlashCommandBuilder, type GuildMember } from "discord.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { PublicCommand } from "../_core/specialized/PublicCommand.js";

interface FunCommandData {
  type: "eightball" | "dice" | "coinflip" | "random_user" | "random_number" | "choose" | "rate" | "ship";
  question?: string;
  sides?: number;
  min?: number;
  max?: number;
  options?: string;
  user1?: GuildMember;
  user2?: GuildMember;
  thing?: string;
}

/**
 * Fun Command - Various fun and entertainment commands
 */
export class FunCommand extends PublicCommand {
  constructor() {
    const config: CommandConfig = {
      name: "fun",
      description: "Various fun and entertainment commands",
      category: "entertainment",
      ephemeral: false,
      guildOnly: false,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      return this.createPublicError("Invalid Command", "This command only works as a slash command.");
    }

    const subcommand = (this.interaction as any).options.getSubcommand();

    switch (subcommand) {
      case "eightball":
        return await this.handleEightBall();
      case "dice":
        return await this.handleDice();
      case "coinflip":
        return await this.handleCoinFlip();
      case "random_user":
        return await this.handleRandomUser();
      case "random_number":
        return await this.handleRandomNumber();
      case "choose":
        return await this.handleChoose();
      case "rate":
        return await this.handleRate();
      case "ship":
        return await this.handleShip();
      default:
        return this.createPublicError("Unknown Command", "Unknown fun command. Please try again.");
    }
  }

  private async handleEightBall(): Promise<CommandResponse> {
    const question = this.getStringOption("question", true);

    const responses = [
      "It is certain",
      "It is decidedly so",
      "Without a doubt",
      "Yes definitely",
      "You may rely on it",
      "As I see it, yes",
      "Most likely",
      "Outlook good",
      "Yes",
      "Signs point to yes",
      "Reply hazy, try again",
      "Ask again later",
      "Better not tell you now",
      "Cannot predict now",
      "Concentrate and ask again",
      "Don't count on it",
      "My reply is no",
      "My sources say no",
      "Outlook not so good",
      "Very doubtful",
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    const embed = new EmbedBuilder()
      .setTitle("🎱 Magic 8-Ball")
      .setDescription(`**Question:** ${question}\n**Answer:** ${randomResponse}`)
      .setColor("#4B0082")
      .setTimestamp()
      .setFooter({ text: `Asked by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

    await this.logCommandUsage("eightball", { question, answer: randomResponse });

    return { embeds: [embed] };
  }

  private async handleDice(): Promise<CommandResponse> {
    const sides = this.getIntegerOption("sides") ?? 6;

    if (sides < 2 || sides > 100) {
      return this.createPublicError("Invalid Dice", "Dice must have between 2 and 100 sides!");
    }

    const result = Math.floor(Math.random() * sides) + 1;
    const emoji = this.getDiceEmoji(sides);

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} Dice Roll`)
      .setDescription(`**Sides:** ${sides}\n**Result:** ${result}`)
      .setColor("#FF6B6B")
      .setTimestamp()
      .setFooter({ text: `Rolled by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

    await this.logCommandUsage("dice", { sides, result });

    return { embeds: [embed] };
  }

  private async handleCoinFlip(): Promise<CommandResponse> {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    const emoji = result === "Heads" ? "🟡" : "⚪";

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} Coin Flip`)
      .setDescription(`**Result:** ${result}`)
      .setColor(result === "Heads" ? "#FFD700" : "#C0C0C0")
      .setTimestamp()
      .setFooter({ text: `Flipped by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

    await this.logCommandUsage("coinflip", { result });

    return { embeds: [embed] };
  }

  private async handleRandomUser(): Promise<CommandResponse> {
    const members = await this.guild.members.fetch();
    const randomMember = members.random();

    if (!randomMember) {
      return this.createPublicError("No Members", "No members found in this server.");
    }

    const embed = new EmbedBuilder()
      .setTitle("🎲 Random User")
      .setDescription(`**Selected:** ${randomMember.user.username}`)
      .setColor("#4ECDC4")
      .setThumbnail(randomMember.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: `Requested by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

    await this.logCommandUsage("random_user", { selectedUserId: randomMember.id });

    return { embeds: [embed] };
  }

  private async handleRandomNumber(): Promise<CommandResponse> {
    const min = this.getIntegerOption("min") ?? 1;
    const max = this.getIntegerOption("max") ?? 100;

    if (min >= max) {
      return this.createPublicError("Invalid Range", "Minimum value must be less than maximum value!");
    }

    const result = Math.floor(Math.random() * (max - min + 1)) + min;

    const embed = new EmbedBuilder()
      .setTitle("🔢 Random Number")
      .setDescription(`**Range:** ${min} - ${max}\n**Result:** ${result}`)
      .setColor("#FF9F43")
      .setTimestamp()
      .setFooter({ text: `Generated for ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

    await this.logCommandUsage("random_number", { min, max, result });

    return { embeds: [embed] };
  }

  private async handleChoose(): Promise<CommandResponse> {
    const options = this.getStringOption("options", true);
    const choices = options
      .split(",")
      .map((choice) => choice.trim())
      .filter((choice) => choice.length > 0);

    if (choices.length < 2) {
      return this.createPublicError("Not Enough Options", "Please provide at least 2 options separated by commas!");
    }

    const chosen = choices[Math.floor(Math.random() * choices.length)];

    const embed = new EmbedBuilder()
      .setTitle("🤔 Choose")
      .setDescription(`**Options:** ${choices.join(", ")}\n**I choose:** ${chosen}`)
      .setColor("#A55EEA")
      .setTimestamp()
      .setFooter({ text: `Chosen for ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

    await this.logCommandUsage("choose", { options: choices, chosen });

    return { embeds: [embed] };
  }

  private async handleRate(): Promise<CommandResponse> {
    const thing = this.getStringOption("thing", true);
    const rating = Math.floor(Math.random() * 11); // 0-10

    let emoji = "😐";
    let color = 0x95a5a6;

    if (rating >= 8) {
      emoji = "😍";
      color = 0x2ecc71;
    } else if (rating >= 6) {
      emoji = "😊";
      color = 0xf39c12;
    } else if (rating >= 4) {
      emoji = "😐";
      color = 0x95a5a6;
    } else {
      emoji = "😞";
      color = 0xe74c3c;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} Rate`)
      .setDescription(`**Item:** ${thing}\n**Rating:** ${rating}/10`)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: `Rated for ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

    await this.logCommandUsage("rate", { thing, rating });

    return { embeds: [embed] };
  }

  private async handleShip(): Promise<CommandResponse> {
    const user1 = this.getUserOption("user1", true);
    const user2 = this.getUserOption("user2", true);

    if (user1.id === user2.id) {
      return this.createPublicError("Same User", "You can't ship a user with themselves!");
    }

    const compatibility = Math.floor(Math.random() * 101); // 0-100
    const shipName = this.generateShipName(user1.username, user2.username);

    let emoji = "💔";
    let color = 0xe74c3c;
    let description = "It's not meant to be...";

    if (compatibility >= 80) {
      emoji = "💕";
      color = 0xe91e63;
      description = "Perfect match! 💖";
    } else if (compatibility >= 60) {
      emoji = "💝";
      color = 0x9b59b6;
      description = "Great compatibility! 💕";
    } else if (compatibility >= 40) {
      emoji = "💙";
      color = 0x3498db;
      description = "Could work out! 💙";
    } else if (compatibility >= 20) {
      emoji = "💛";
      color = 0xf1c40f;
      description = "Friendship material! 💛";
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} Ship`)
      .setDescription(
        `**${user1.username}** + **${user2.username}** = **${shipName}**\n\n` +
          `**Compatibility:** ${compatibility}%\n` +
          `**Status:** ${description}`
      )
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: `Shipped by ${this.user.username}`, iconURL: this.user.displayAvatarURL() });

    await this.logCommandUsage("ship", { user1Id: user1.id, user2Id: user2.id, compatibility, shipName });

    return { embeds: [embed] };
  }

  private getDiceEmoji(sides: number): string {
    const emojiMap: Record<number, string> = {
      4: "🎲",
      6: "🎲",
      8: "🎲",
      10: "🎲",
      12: "🎲",
      20: "🎲",
    };
    return emojiMap[sides] || "🎲";
  }

  private generateShipName(name1: string, name2: string): string {
    const half1 = name1.substring(0, Math.ceil(name1.length / 2));
    const half2 = name2.substring(Math.floor(name2.length / 2));
    return half1 + half2;
  }
}

export default new FunCommand();

export const builder = new SlashCommandBuilder()
  .setName("fun")
  .setDescription("Various fun and entertainment commands")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("eightball")
      .setDescription("Ask the magic 8-ball a question")
      .addStringOption((option) => option.setName("question").setDescription("Your question").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("dice")
      .setDescription("Roll a dice")
      .addIntegerOption((option) =>
        option.setName("sides").setDescription("Number of sides (2-100)").setMinValue(2).setMaxValue(100)
      )
  )
  .addSubcommand((subcommand) => subcommand.setName("coinflip").setDescription("Flip a coin"))
  .addSubcommand((subcommand) => subcommand.setName("random_user").setDescription("Pick a random user from the server"))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("random_number")
      .setDescription("Generate a random number")
      .addIntegerOption((option) => option.setName("min").setDescription("Minimum value (default: 1)"))
      .addIntegerOption((option) => option.setName("max").setDescription("Maximum value (default: 100)"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("choose")
      .setDescription("Let me choose for you")
      .addStringOption((option) =>
        option.setName("options").setDescription("Options separated by commas").setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rate")
      .setDescription("Rate something out of 10")
      .addStringOption((option) => option.setName("thing").setDescription("What to rate").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ship")
      .setDescription("Ship two users together")
      .addUserOption((option) => option.setName("user1").setDescription("First user").setRequired(true))
      .addUserOption((option) => option.setName("user2").setDescription("Second user").setRequired(true))
  );
