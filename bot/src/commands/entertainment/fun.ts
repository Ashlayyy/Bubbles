import { EmbedBuilder, GuildMember, SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { type CommandConfig, type CommandResponse, PublicCommand } from "../_core/index.js";

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
 * Fun Command - Collection of entertaining and interactive commands
 */
export class FunCommand extends PublicCommand {
  constructor() {
    const config: CommandConfig = {
      name: "fun",
      description: "Collection of fun and entertaining commands",
      category: "entertainment",
      permissions: {
        level: PermissionLevel.PUBLIC,
        isConfigurable: true,
      },
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.interaction.guild || !this.interaction.isChatInputCommand()) {
      return {};
    }

    const subcommand = this.interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "eightball":
          return await this.handleEightBall();
        case "dice":
          return await this.handleDice();
        case "coinflip":
          return await this.handleCoinFlip();
        case "random-user":
          return await this.handleRandomUser();
        case "random-number":
          return await this.handleRandomNumber();
        case "choose":
          return await this.handleChoose();
        case "rate":
          return await this.handleRate();
        case "ship":
          return await this.handleShip();
        default:
          await this.interaction.reply({
            content: "❌ Unknown subcommand!",
            ephemeral: true,
          });
          return {};
      }
    } catch (error) {
      console.error("Error in fun command:", error);
      await this.interaction.reply({
        content: "❌ Something went wrong while executing the command.",
        ephemeral: true,
      });
      return {};
    }
  }

  private async handleEightBall(): Promise<CommandResponse> {
    const question = this.getStringOption("question", true);

    const responses = [
      // Positive responses
      "🟢 It is certain",
      "🟢 Without a doubt",
      "🟢 Yes definitely",
      "🟢 You may rely on it",
      "🟢 As I see it, yes",
      "🟢 Most likely",
      "🟢 Outlook good",
      "🟢 Yes",
      "🟢 Signs point to yes",

      // Neutral responses
      "🟡 Reply hazy, try again",
      "🟡 Ask again later",
      "🟡 Better not tell you now",
      "🟡 Cannot predict now",
      "🟡 Concentrate and ask again",

      // Negative responses
      "🔴 Don't count on it",
      "🔴 My reply is no",
      "🔴 My sources say no",
      "🔴 Outlook not so good",
      "🔴 Very doubtful",
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle("🎱 Magic 8-Ball")
      .addFields(
        { name: "❓ Question", value: question, inline: false },
        { name: "🔮 Answer", value: randomResponse, inline: false }
      )
      .setFooter({ text: `Asked by ${this.interaction.user.displayName}` })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async handleDice(): Promise<CommandResponse> {
    const sides = this.getIntegerOption("sides") || 6;
    const count = this.getIntegerOption("count") || 1;

    if (count > 10) {
      await this.interaction.reply({
        content: "❌ You can only roll up to 10 dice at once!",
        ephemeral: true,
      });
      return {};
    }

    const results: number[] = [];
    let total = 0;

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      results.push(roll);
      total += roll;
    }

    const diceEmoji = this.getDiceEmoji(sides);
    const resultText =
      results.length === 1 ? `**${results[0]}**` : `${results.map((r) => `**${r}**`).join(" + ")} = **${total}**`;

    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle(`${diceEmoji} Dice Roll`)
      .addFields(
        { name: "🎲 Roll", value: `${count}d${sides}`, inline: true },
        { name: "🎯 Result", value: resultText, inline: true }
      )
      .setFooter({ text: `Rolled by ${this.interaction.user.displayName}` })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async handleCoinFlip(): Promise<CommandResponse> {
    const isHeads = Math.random() < 0.5;
    const result = isHeads ? "Heads" : "Tails";
    const emoji = isHeads ? "🪙" : "⚡";

    const embed = new EmbedBuilder()
      .setColor(isHeads ? 0xfbbf24 : 0x6b7280)
      .setTitle("🪙 Coin Flip")
      .setDescription(`${emoji} **${result}**`)
      .setFooter({ text: `Flipped by ${this.interaction.user.displayName}` })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async handleRandomUser(): Promise<CommandResponse> {
    const members = await this.interaction.guild!.members.fetch();
    const humanMembers = members.filter((member) => !member.user.bot);

    if (humanMembers.size === 0) {
      await this.interaction.reply({
        content: "❌ No human members found in this server!",
        ephemeral: true,
      });
      return {};
    }

    const randomMember = humanMembers.random()!;

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("🎲 Random User Picker")
      .setDescription(`🎯 **${randomMember.displayName}** has been chosen!`)
      .setThumbnail(randomMember.user.displayAvatarURL())
      .addFields(
        { name: "👤 User", value: `<@${randomMember.id}>`, inline: true },
        { name: "📅 Joined", value: randomMember.joinedAt?.toDateString() || "Unknown", inline: true }
      )
      .setFooter({ text: `Picked by ${this.interaction.user.displayName}` })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async handleRandomNumber(): Promise<CommandResponse> {
    const min = this.getIntegerOption("min") || 1;
    const max = this.getIntegerOption("max") || 100;

    if (min >= max) {
      await this.interaction.reply({
        content: "❌ Minimum value must be less than maximum value!",
        ephemeral: true,
      });
      return {};
    }

    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

    const embed = new EmbedBuilder()
      .setColor(0x06b6d4)
      .setTitle("🔢 Random Number Generator")
      .addFields(
        { name: "📊 Range", value: `${min} - ${max}`, inline: true },
        { name: "🎯 Result", value: `**${randomNumber}**`, inline: true }
      )
      .setFooter({ text: `Generated by ${this.interaction.user.displayName}` })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async handleChoose(): Promise<CommandResponse> {
    const options = this.getStringOption("options", true);
    const choices = options
      .split(",")
      .map((choice) => choice.trim())
      .filter((choice) => choice.length > 0);

    if (choices.length < 2) {
      await this.interaction.reply({
        content: "❌ Please provide at least 2 options separated by commas!",
        ephemeral: true,
      });
      return {};
    }

    if (choices.length > 20) {
      await this.interaction.reply({
        content: "❌ Please provide no more than 20 options!",
        ephemeral: true,
      });
      return {};
    }

    const randomChoice = choices[Math.floor(Math.random() * choices.length)];

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🤔 Choice Picker")
      .addFields(
        { name: "📝 Options", value: choices.map((choice, i) => `${i + 1}. ${choice}`).join("\n"), inline: false },
        { name: "🎯 I choose", value: `**${randomChoice}**`, inline: false }
      )
      .setFooter({ text: `Chosen by ${this.interaction.user.displayName}` })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async handleRate(): Promise<CommandResponse> {
    const thing = this.getStringOption("thing", true);
    const rating = Math.floor(Math.random() * 11); // 0-10

    const ratingEmojis = ["💀", "😢", "😞", "😕", "😐", "🙂", "😊", "😄", "😍", "🤩", "✨"];
    const emoji = ratingEmojis[rating];

    const descriptions = [
      "Absolutely terrible!",
      "Really bad...",
      "Pretty bad",
      "Not great",
      "Meh, it's okay",
      "Not bad!",
      "Pretty good!",
      "Really good!",
      "Amazing!",
      "Incredible!",
      "PERFECT! ✨",
    ];

    const embed = new EmbedBuilder()
      .setColor(rating >= 7 ? 0x10b981 : rating >= 4 ? 0xf59e0b : 0xef4444)
      .setTitle("⭐ Rating Machine")
      .addFields(
        { name: "📝 Item", value: thing, inline: false },
        { name: "⭐ Rating", value: `${emoji} **${rating}/10** - ${descriptions[rating]}`, inline: false }
      )
      .setFooter({ text: `Rated by ${this.interaction.user.displayName}` })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async handleShip(): Promise<CommandResponse> {
    const user1 = this.getMemberOption("user1", true);
    const user2 = this.getMemberOption("user2", true);

    if (!user1 || !user2) {
      await this.interaction.reply({
        content: "❌ Please mention two valid users!",
        ephemeral: true,
      });
      return {};
    }

    if (user1.id === user2.id) {
      await this.interaction.reply({
        content: "❌ You can't ship someone with themselves!",
        ephemeral: true,
      });
      return {};
    }

    // Generate a "compatibility" score based on user IDs for consistency
    const combined = user1.id + user2.id;
    const hash = combined.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const compatibility = hash % 101; // 0-100

    const shipName = this.generateShipName(user1.displayName, user2.displayName);

    const hearts = "💖".repeat(Math.floor(compatibility / 10));
    const emptyHearts = "🤍".repeat(10 - Math.floor(compatibility / 10));
    const heartBar = hearts + emptyHearts;

    let description: string;
    if (compatibility >= 90) description = "Perfect match! 💕";
    else if (compatibility >= 75) description = "Great compatibility! 💖";
    else if (compatibility >= 50) description = "Good potential! 💝";
    else if (compatibility >= 25) description = "Could work... 💛";
    else description = "Not looking good... 💔";

    const embed = new EmbedBuilder()
      .setColor(compatibility >= 75 ? 0xf43f5e : compatibility >= 50 ? 0xf59e0b : 0x6b7280)
      .setTitle("💕 Love Calculator")
      .setDescription(`**${user1.displayName}** + **${user2.displayName}** = **${shipName}**`)
      .addFields({
        name: "💖 Compatibility",
        value: `${heartBar}\n**${compatibility}%** - ${description}`,
        inline: false,
      })
      .setFooter({ text: `Shipped by ${this.interaction.user.displayName}` })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private getDiceEmoji(sides: number): string {
    const emojiMap: Record<number, string> = {
      4: "🔺",
      6: "🎲",
      8: "🎯",
      10: "🔟",
      12: "🎲",
      20: "🎮",
    };
    return emojiMap[sides] || "🎲";
  }

  private generateShipName(name1: string, name2: string): string {
    const clean1 = name1.replace(/[^a-zA-Z]/g, "").toLowerCase();
    const clean2 = name2.replace(/[^a-zA-Z]/g, "").toLowerCase();

    const part1 = clean1.slice(0, Math.ceil(clean1.length / 2));
    const part2 = clean2.slice(Math.floor(clean2.length / 2));

    return (part1 + part2).charAt(0).toUpperCase() + (part1 + part2).slice(1);
  }
}

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("fun")
  .setDescription("Collection of fun and entertaining commands")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("eightball")
      .setDescription("Ask the magic 8-ball a question")
      .addStringOption((option) =>
        option
          .setName("question")
          .setDescription("Your question for the magic 8-ball")
          .setRequired(true)
          .setMaxLength(200)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("dice")
      .setDescription("Roll dice")
      .addIntegerOption((option) =>
        option
          .setName("sides")
          .setDescription("Number of sides on the dice (default: 6)")
          .setMinValue(2)
          .setMaxValue(100)
      )
      .addIntegerOption((option) =>
        option
          .setName("count")
          .setDescription("Number of dice to roll (default: 1, max: 10)")
          .setMinValue(1)
          .setMaxValue(10)
      )
  )
  .addSubcommand((subcommand) => subcommand.setName("coinflip").setDescription("Flip a coin"))
  .addSubcommand((subcommand) => subcommand.setName("random-user").setDescription("Pick a random user from the server"))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("random-number")
      .setDescription("Generate a random number")
      .addIntegerOption((option) =>
        option.setName("min").setDescription("Minimum value (default: 1)").setMinValue(-1000000).setMaxValue(1000000)
      )
      .addIntegerOption((option) =>
        option.setName("max").setDescription("Maximum value (default: 100)").setMinValue(-1000000).setMaxValue(1000000)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("choose")
      .setDescription("Pick randomly from a list of options")
      .addStringOption((option) =>
        option
          .setName("options")
          .setDescription('Options separated by commas (e.g., "pizza, burgers, tacos")')
          .setRequired(true)
          .setMaxLength(500)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rate")
      .setDescription("Rate something from 0 to 10")
      .addStringOption((option) =>
        option.setName("thing").setDescription("What do you want to rate?").setRequired(true).setMaxLength(100)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ship")
      .setDescription("Calculate compatibility between two users")
      .addUserOption((option) => option.setName("user1").setDescription("First user").setRequired(true))
      .addUserOption((option) => option.setName("user2").setDescription("Second user").setRequired(true))
  );
