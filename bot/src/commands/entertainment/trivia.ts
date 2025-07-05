import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { prisma } from "../../database/index.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { type CommandConfig, type CommandResponse, PublicCommand } from "../_core/index.js";

interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
}

interface TriviaGame {
  channelId: string;
  guildId: string;
  hostId: string;
  participants: Map<string, TriviaParticipant>;
  currentQuestion: TriviaQuestion | null;
  questionNumber: number;
  totalQuestions: number;
  category: string;
  difficulty: string;
  timeLimit: number;
  isActive: boolean;
  startTime: number;
}

interface TriviaParticipant {
  userId: string;
  username: string;
  score: number;
  correctAnswers: number;
  answered: boolean;
  answerTime?: number;
}

// Store active trivia games
const activeGames = new Map<string, TriviaGame>();

/**
 * Trivia Command - Interactive trivia games with scoring and leaderboards
 */
export class TriviaCommand extends PublicCommand {
  constructor() {
    const config: CommandConfig = {
      name: "trivia",
      description: "Start interactive trivia games with multiple categories and difficulties",
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
        case "start":
          return await this.handleStartTrivia();
        case "stop":
          return await this.handleStopTrivia();
        case "leaderboard":
          return await this.handleLeaderboard();
        case "stats":
          return await this.handleStats();
        default:
          await this.interaction.reply({
            content: "❌ Unknown subcommand!",
            ephemeral: true,
          });
          return {};
      }
    } catch (error) {
      console.error("Error in trivia command:", error);
      await this.interaction.reply({
        content: "❌ Something went wrong while executing the command.",
        ephemeral: true,
      });
      return {};
    }
  }

  private async handleStartTrivia(): Promise<CommandResponse> {
    const channelId = this.interaction.channelId;
    const guildId = this.interaction.guild!.id;

    // Check if there's already an active game in this channel
    if (activeGames.has(channelId)) {
      await this.interaction.reply({
        content: "❌ There's already an active trivia game in this channel!",
        ephemeral: true,
      });
      return {};
    }

    const category = this.getStringOption("category") || "general";
    const difficulty = this.getStringOption("difficulty") || "medium";
    const questionCount = this.getIntegerOption("questions") || 5;
    const timeLimit = this.getIntegerOption("time-limit") || 30;

    // Get trivia questions from database
    const questions = await this.getTriviaQuestions(guildId, category, difficulty, questionCount);

    if (questions.length === 0) {
      await this.interaction.reply({
        content: `❌ No trivia questions found for category "${category}" with difficulty "${difficulty}". Try a different category or add questions first!`,
        ephemeral: true,
      });
      return {};
    }

    // Create new trivia game
    const game: TriviaGame = {
      channelId,
      guildId,
      hostId: this.interaction.user.id,
      participants: new Map(),
      currentQuestion: null,
      questionNumber: 0,
      totalQuestions: Math.min(questions.length, questionCount),
      category,
      difficulty,
      timeLimit,
      isActive: true,
      startTime: Date.now(),
    };

    activeGames.set(channelId, game);

    // Create join button
    const joinButton = new ButtonBuilder()
      .setCustomId(`trivia_join_${channelId}`)
      .setLabel("🎮 Join Game")
      .setStyle(ButtonStyle.Primary);

    const startButton = new ButtonBuilder()
      .setCustomId(`trivia_start_${channelId}`)
      .setLabel("▶️ Start Game")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, startButton);

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle("🧠 Trivia Game Starting!")
      .setDescription(
        `**Category:** ${category.charAt(0).toUpperCase() + category.slice(1)}\n` +
          `**Difficulty:** ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}\n` +
          `**Questions:** ${game.totalQuestions}\n` +
          `**Time per question:** ${timeLimit} seconds\n\n` +
          `Click "Join Game" to participate, then the host can start the game!`
      )
      .addFields(
        { name: "👥 Participants", value: "None yet", inline: true },
        { name: "🎯 Host", value: `<@${this.interaction.user.id}>`, inline: true }
      )
      .setFooter({ text: "Trivia Game • Click join to participate!" })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed], components: [row] });

    // Set up button interactions
    this.setupTriviaInteractions(channelId, questions);

    return {};
  }

  private async handleStopTrivia(): Promise<CommandResponse> {
    const channelId = this.interaction.channelId;
    const game = activeGames.get(channelId);

    if (!game) {
      await this.interaction.reply({
        content: "❌ No active trivia game in this channel!",
        ephemeral: true,
      });
      return {};
    }

    if (
      game.hostId !== this.interaction.user.id &&
      !(this.interaction.member as GuildMember).permissions.has("ManageMessages")
    ) {
      await this.interaction.reply({
        content: "❌ Only the game host or moderators can stop the trivia game!",
        ephemeral: true,
      });
      return {};
    }

    // End the game and show final results
    await this.endTriviaGame(channelId);

    await this.interaction.reply({
      content: "✅ Trivia game stopped!",
      ephemeral: true,
    });

    return {};
  }

  private async handleLeaderboard(): Promise<CommandResponse> {
    const guildId = this.interaction.guild!.id;
    const period = this.getStringOption("period") || "all";

    // Get leaderboard data from database
    const leaderboard = await this.getTriviaLeaderboard(guildId, period);

    if (leaderboard.length === 0) {
      await this.interaction.reply({
        content: "❌ No trivia statistics found for this server!",
        ephemeral: true,
      });
      return {};
    }

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🏆 Trivia Leaderboard")
      .setDescription(`Top players ${period === "all" ? "of all time" : `in the last ${period}`}`)
      .setTimestamp();

    const leaderboardText = leaderboard
      .slice(0, 10)
      .map((entry, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
        return `${medal} <@${entry.userId}> - **${entry.totalScore}** points (${entry.gamesPlayed} games)`;
      })
      .join("\n");

    embed.addFields({ name: "📊 Rankings", value: leaderboardText, inline: false });

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async handleStats(): Promise<CommandResponse> {
    const targetUser = this.getUserOption("user") || this.interaction.user;
    const guildId = this.interaction.guild!.id;

    // Get user stats from database
    const stats = await this.getUserTriviaStats(guildId, targetUser.id);

    if (!stats) {
      await this.interaction.reply({
        content: `❌ No trivia statistics found for ${targetUser.id === this.interaction.user.id ? "you" : targetUser.displayName}!`,
        ephemeral: true,
      });
      return {};
    }

    const accuracy = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
    const avgScore = stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;

    const embed = new EmbedBuilder()
      .setColor(0x06b6d4)
      .setTitle("📊 Trivia Statistics")
      .setDescription(`Statistics for ${targetUser.displayName}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: "🎮 Games Played", value: stats.gamesPlayed.toString(), inline: true },
        { name: "🏆 Total Score", value: stats.totalScore.toString(), inline: true },
        { name: "📈 Average Score", value: avgScore.toString(), inline: true },
        { name: "✅ Correct Answers", value: stats.correctAnswers.toString(), inline: true },
        { name: "❓ Total Questions", value: stats.totalQuestions.toString(), inline: true },
        { name: "🎯 Accuracy", value: `${accuracy}%`, inline: true }
      )
      .setFooter({ text: "Trivia Statistics" })
      .setTimestamp();

    await this.interaction.reply({ embeds: [embed] });
    return {};
  }

  private async setupTriviaInteractions(channelId: string, questions: TriviaQuestion[]) {
    const game = activeGames.get(channelId);
    if (!game) return;

    // Handle button interactions
    const filter = (i: any) => i.customId.startsWith("trivia_") && i.channelId === channelId;
    const collector = this.interaction.channel?.createMessageComponentCollector({
      filter,
      time: 300000, // 5 minutes to join/start
    });

    collector?.on("collect", async (interaction) => {
      try {
        if (interaction.customId === `trivia_join_${channelId}`) {
          await this.handleJoinGame(interaction, game);
        } else if (interaction.customId === `trivia_start_${channelId}`) {
          if (interaction.user.id === game.hostId) {
            await this.startTriviaQuestions(channelId, questions);
            await interaction.update({ content: "🎮 Game started!", embeds: [], components: [] });
          } else {
            await interaction.reply({ content: "❌ Only the host can start the game!", ephemeral: true });
          }
        } else if (interaction.customId.startsWith("trivia_answer_")) {
          await this.handleAnswer(interaction, game);
        }
      } catch (error) {
        console.error("Error in trivia interaction:", error);
      }
    });

    collector?.on("end", () => {
      // Clean up if game wasn't started
      if (activeGames.has(channelId) && game.questionNumber === 0) {
        activeGames.delete(channelId);
      }
    });
  }

  private async handleJoinGame(interaction: any, game: TriviaGame) {
    if (game.participants.has(interaction.user.id)) {
      await interaction.reply({ content: "❌ You're already in the game!", ephemeral: true });
      return;
    }

    game.participants.set(interaction.user.id, {
      userId: interaction.user.id,
      username: interaction.user.displayName,
      score: 0,
      correctAnswers: 0,
      answered: false,
    });

    const participantsList = Array.from(game.participants.values())
      .map((p) => p.username)
      .join(", ");

    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
      { name: "👥 Participants", value: participantsList, inline: true },
      { name: "🎯 Host", value: `<@${game.hostId}>`, inline: true }
    );

    await interaction.update({ embeds: [embed] });
  }

  private async startTriviaQuestions(channelId: string, questions: TriviaQuestion[]) {
    const game = activeGames.get(channelId);
    if (!game || game.participants.size === 0) return;

    for (let i = 0; i < game.totalQuestions && i < questions.length; i++) {
      game.questionNumber = i + 1;
      game.currentQuestion = questions[i];

      // Reset participants' answered status
      game.participants.forEach((p) => {
        p.answered = false;
        p.answerTime = undefined;
      });

      await this.askQuestion(channelId, game);

      // Wait for answers
      await new Promise((resolve) => setTimeout(resolve, game.timeLimit * 1000));

      await this.showQuestionResults(channelId, game);

      // Short break between questions
      if (i < game.totalQuestions - 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    await this.endTriviaGame(channelId);
  }

  private async askQuestion(channelId: string, game: TriviaGame) {
    if (!game.currentQuestion) return;

    const question = game.currentQuestion;
    const buttons = question.options.map((option, index) =>
      new ButtonBuilder()
        .setCustomId(`trivia_answer_${game.channelId}_${index}`)
        .setLabel(`${String.fromCharCode(65 + index)}. ${option}`)
        .setStyle(ButtonStyle.Primary)
    );

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`🧠 Question ${game.questionNumber}/${game.totalQuestions}`)
      .setDescription(question.question)
      .addFields(
        { name: "📚 Category", value: question.category, inline: true },
        { name: "⭐ Difficulty", value: question.difficulty, inline: true },
        { name: "⏱️ Time Limit", value: `${game.timeLimit} seconds`, inline: true }
      )
      .setFooter({ text: "Click a button to answer!" })
      .setTimestamp();

    const channel = this.client.channels.cache.get(channelId);
    if (channel && "send" in channel) {
      await channel.send({ embeds: [embed], components: rows });
    }
  }

  private async handleAnswer(interaction: any, game: TriviaGame) {
    if (!game.currentQuestion || !game.participants.has(interaction.user.id)) {
      await interaction.reply({ content: "❌ You're not in this game!", ephemeral: true });
      return;
    }

    const participant = game.participants.get(interaction.user.id)!;
    if (participant.answered) {
      await interaction.reply({ content: "❌ You've already answered this question!", ephemeral: true });
      return;
    }

    const answerIndex = parseInt(interaction.customId.split("_")[3]);
    const isCorrect = answerIndex === game.currentQuestion.correctAnswer;

    participant.answered = true;
    participant.answerTime = Date.now();

    if (isCorrect) {
      participant.correctAnswers++;
      // Score based on difficulty and speed
      const baseScore =
        game.currentQuestion.difficulty === "easy" ? 10 : game.currentQuestion.difficulty === "medium" ? 15 : 20;
      const speedBonus = Math.max(0, 10 - Math.floor((Date.now() - game.startTime) / 1000));
      participant.score += baseScore + speedBonus;
    }

    await interaction.reply({
      content: isCorrect ? "✅ Correct!" : "❌ Incorrect!",
      ephemeral: true,
    });
  }

  private async showQuestionResults(channelId: string, game: TriviaGame) {
    if (!game.currentQuestion) return;

    const question = game.currentQuestion;
    const correctOption = question.options[question.correctAnswer];

    const participantResults =
      Array.from(game.participants.values())
        .filter((p) => p.answered)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((p, index) => `${index + 1}. ${p.username} - ${p.score} points`)
        .join("\n") || "No one answered";

    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("📊 Question Results")
      .setDescription(`**Correct Answer:** ${String.fromCharCode(65 + question.correctAnswer)}. ${correctOption}`)
      .addFields({ name: "🏆 Current Leaderboard", value: participantResults, inline: false });

    if (question.explanation) {
      embed.addFields({ name: "💡 Explanation", value: question.explanation, inline: false });
    }

    const channel = this.client.channels.cache.get(channelId);
    if (channel && "send" in channel) {
      await channel.send({ embeds: [embed] });
    }
  }

  private async endTriviaGame(channelId: string) {
    const game = activeGames.get(channelId);
    if (!game) return;

    const finalResults = Array.from(game.participants.values()).sort((a, b) => b.score - a.score);

    const resultsText =
      finalResults
        .slice(0, 10)
        .map((p, index) => {
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
          const accuracy = game.totalQuestions > 0 ? Math.round((p.correctAnswers / game.totalQuestions) * 100) : 0;
          return `${medal} ${p.username} - **${p.score}** points (${p.correctAnswers}/${game.totalQuestions} correct, ${accuracy}%)`;
        })
        .join("\n") || "No participants";

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🏆 Trivia Game Complete!")
      .setDescription("Final Results")
      .addFields(
        { name: "📊 Final Leaderboard", value: resultsText, inline: false },
        {
          name: "📈 Game Stats",
          value:
            `**Questions:** ${game.totalQuestions}\n` +
            `**Category:** ${game.category}\n` +
            `**Difficulty:** ${game.difficulty}\n` +
            `**Participants:** ${game.participants.size}`,
          inline: true,
        }
      )
      .setFooter({ text: "Thanks for playing!" })
      .setTimestamp();

    const channel = this.client.channels.cache.get(channelId);
    if (channel && "send" in channel) {
      await channel.send({ embeds: [embed] });
    }

    // Save game results to database
    await this.saveTriviaResults(game);

    activeGames.delete(channelId);
  }

  // Database helper methods
  private async getTriviaQuestions(
    guildId: string,
    category: string,
    difficulty: string,
    count: number
  ): Promise<TriviaQuestion[]> {
    try {
      const questions = await prisma.triviaQuestion.findMany({
        where: {
          guildId,
          category: category === "general" ? undefined : category,
          difficulty: difficulty === "any" ? undefined : difficulty,
          isActive: true,
        },
        take: count * 2, // Get more than needed for randomization
        orderBy: { createdAt: "desc" },
      });

      // Shuffle and return requested count
      const shuffled = questions.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count).map((q) => ({
        id: q.id,
        question: q.question,
        options: [q.correctAnswer, ...(q.wrongAnswers || [])].sort(() => Math.random() - 0.5),
        correctAnswer: 0, // Will be recalculated after shuffling
        category: q.category,
        difficulty: q.difficulty as "easy" | "medium" | "hard",
        explanation: q.explanation || undefined,
      }));
    } catch (error) {
      console.error("Error fetching trivia questions:", error);
      return [];
    }
  }

  private async getTriviaLeaderboard(guildId: string, period: string): Promise<any[]> {
    // Mock implementation - would use actual database queries
    return [];
  }

  private async getUserTriviaStats(guildId: string, userId: string): Promise<any> {
    // Mock implementation - would use actual database queries
    return null;
  }

  private async saveTriviaResults(game: TriviaGame) {
    // Mock implementation - would save to database
    console.log("Saving trivia results for game:", game.channelId);
  }
}

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("trivia")
  .setDescription("Interactive trivia games with multiple categories and difficulties")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("start")
      .setDescription("Start a new trivia game")
      .addStringOption((option) =>
        option
          .setName("category")
          .setDescription("Trivia category")
          .addChoices(
            { name: "General", value: "general" },
            { name: "Science", value: "science" },
            { name: "History", value: "history" },
            { name: "Sports", value: "sports" },
            { name: "Entertainment", value: "entertainment" },
            { name: "Geography", value: "geography" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("difficulty")
          .setDescription("Difficulty level")
          .addChoices(
            { name: "Easy", value: "easy" },
            { name: "Medium", value: "medium" },
            { name: "Hard", value: "hard" },
            { name: "Any", value: "any" }
          )
      )
      .addIntegerOption((option) =>
        option.setName("questions").setDescription("Number of questions (1-20)").setMinValue(1).setMaxValue(20)
      )
      .addIntegerOption((option) =>
        option
          .setName("time-limit")
          .setDescription("Time limit per question in seconds (10-60)")
          .setMinValue(10)
          .setMaxValue(60)
      )
  )
  .addSubcommand((subcommand) => subcommand.setName("stop").setDescription("Stop the current trivia game"))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("leaderboard")
      .setDescription("View trivia leaderboard")
      .addStringOption((option) =>
        option
          .setName("period")
          .setDescription("Time period for leaderboard")
          .addChoices(
            { name: "All Time", value: "all" },
            { name: "This Month", value: "month" },
            { name: "This Week", value: "week" }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stats")
      .setDescription("View trivia statistics")
      .addUserOption((option) => option.setName("user").setDescription("User to view stats for (defaults to yourself)"))
  );
