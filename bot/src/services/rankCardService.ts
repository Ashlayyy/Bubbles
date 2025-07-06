import { createCanvas, loadImage } from "canvas";
import { AttachmentBuilder, User } from "discord.js";
import logger from "../logger.js";
import { levelingService } from "./levelingService.js";

export interface RankCardConfig {
  // Background customization
  backgroundImage?: string;
  backgroundColor?: string;
  backgroundGradient?: {
    colors: string[];
    direction: "horizontal" | "vertical" | "diagonal";
  };

  // Text customization
  usernameColor?: string;
  levelColor?: string;
  xpColor?: string;
  rankColor?: string;
  font?: string;

  // Progress bar customization
  progressBarFilled?: string;
  progressBarEmpty?: string;
  progressBarBackground?: string;
  progressBarBorder?: string;

  // Layout options
  avatarSize?: number;
  avatarBorder?: string;
  showRank?: boolean;
  showLevel?: boolean;
  showProgress?: boolean;
  showXP?: boolean;

  // Custom elements
  overlayOpacity?: number;
  cornerRadius?: number;
  showBadges?: boolean;
}

export class RankCardService {
  private static instance: RankCardService;
  private defaultConfig: RankCardConfig = {
    backgroundColor: "#2C2F33",
    usernameColor: "#FFFFFF",
    levelColor: "#FFD700",
    xpColor: "#B9BBBE",
    rankColor: "#7289DA",
    font: "Arial",
    progressBarFilled: "#FFD700",
    progressBarEmpty: "#484B51",
    progressBarBackground: "#36393F",
    progressBarBorder: "#FFD700",
    avatarSize: 128,
    avatarBorder: "#FFD700",
    showRank: true,
    showLevel: true,
    showProgress: true,
    showXP: true,
    overlayOpacity: 0.8,
    cornerRadius: 15,
    showBadges: true,
  };

  static getInstance(): RankCardService {
    if (!RankCardService.instance) {
      RankCardService.instance = new RankCardService();
    }
    return RankCardService.instance;
  }

  /**
   * Generate a custom rank card image for a user
   */
  async generateRankCard(
    user: User,
    guildId: string,
    rank: number,
    config?: Partial<RankCardConfig>
  ): Promise<AttachmentBuilder> {
    try {
      const finalConfig = { ...this.defaultConfig, ...config };

      // Get user's XP data
      const userData = await levelingService.getUserXP(guildId, user.id);
      const { xp: totalXP, level } = userData;

      // Calculate progress to next level
      const currentLevelXP = this.calculateLevelXP(level);
      const nextLevelXP = this.calculateLevelXP(level + 1);
      const progressXP = totalXP - currentLevelXP;
      const neededXP = nextLevelXP - currentLevelXP;
      const progressPercent = Math.min(100, Math.max(0, (progressXP / neededXP) * 100));

      // Create canvas (similar to your image dimensions)
      const canvas = createCanvas(1400, 400);
      const ctx = canvas.getContext("2d");

      // Draw background
      await this.drawBackground(ctx, canvas, finalConfig);

      // Load and draw user avatar
      await this.drawAvatar(ctx, user, finalConfig);

      // Draw user info text
      this.drawUserInfo(ctx, user, level, totalXP, rank, finalConfig);

      // Draw progress bar
      this.drawProgressBar(ctx, progressPercent, progressXP, neededXP, finalConfig);

      // Draw badges/decorations
      if (finalConfig.showBadges) {
        await this.drawBadges(ctx, level, totalXP, finalConfig);
      }

      // Convert to attachment
      const buffer = canvas.toBuffer("image/png");
      const attachment = new AttachmentBuilder(buffer, { name: `rank-${user.id}.png` });

      return attachment;
    } catch (error) {
      logger.error("Error generating rank card:", error);
      throw new Error("Failed to generate rank card");
    }
  }

  private async drawBackground(ctx: any, canvas: any, config: RankCardConfig): Promise<void> {
    // Apply corner radius
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, config.cornerRadius || 0);
    ctx.clip();

    if (config.backgroundImage) {
      try {
        const bgImage = await loadImage(config.backgroundImage);
        ctx.globalAlpha = config.overlayOpacity || 1;
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      } catch (error) {
        logger.warn("Failed to load background image, using color fallback");
        this.drawColorBackground(ctx, canvas, config);
      }
    } else if (config.backgroundGradient) {
      this.drawGradientBackground(ctx, canvas, config);
    } else {
      this.drawColorBackground(ctx, canvas, config);
    }

    // Add overlay if background image is used
    if (config.backgroundImage && config.overlayOpacity && config.overlayOpacity < 1) {
      ctx.fillStyle = `rgba(44, 47, 51, ${1 - config.overlayOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  private drawColorBackground(ctx: any, canvas: any, config: RankCardConfig): void {
    ctx.fillStyle = config.backgroundColor || "#2C2F33";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private drawGradientBackground(ctx: any, canvas: any, config: RankCardConfig): void {
    if (!config.backgroundGradient) return;

    let gradient;
    const { colors, direction } = config.backgroundGradient;

    switch (direction) {
      case "horizontal":
        gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        break;
      case "vertical":
        gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        break;
      case "diagonal":
        gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        break;
      default:
        gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    }

    colors.forEach((color, index) => {
      gradient.addColorStop(index / (colors.length - 1), color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private async drawAvatar(ctx: any, user: User, config: RankCardConfig): Promise<void> {
    try {
      const avatarURL = user.displayAvatarURL({ extension: "png", size: 256 });
      const avatar = await loadImage(avatarURL);

      const size = config.avatarSize || 128;
      const x = 50;
      const y = (400 - size) / 2; // Center vertically

      // Draw avatar border
      if (config.avatarBorder) {
        ctx.strokeStyle = config.avatarBorder;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw avatar (circular)
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, x, y, size, size);
      ctx.restore();
    } catch (error) {
      logger.warn("Failed to load user avatar, using placeholder");
      // Draw placeholder avatar
      const size = config.avatarSize || 128;
      const x = 50;
      const y = (400 - size) / 2;

      ctx.fillStyle = "#36393F";
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawUserInfo(
    ctx: any,
    user: User,
    level: number,
    totalXP: number,
    rank: number,
    config: RankCardConfig
  ): void {
    const startX = 220; // After avatar

    // Username
    ctx.font = "bold 48px " + (config.font || "Arial");
    ctx.fillStyle = config.usernameColor || "#FFFFFF";
    ctx.fillText(user.displayName, startX, 100);

    // Level (large, right side)
    if (config.showLevel) {
      ctx.font = "bold 120px " + (config.font || "Arial");
      ctx.fillStyle = config.levelColor || "#FFD700";
      ctx.textAlign = "right";
      ctx.fillText(`LEVEL ${level}`, 1350, 150);
      ctx.textAlign = "left";
    }

    // Rank
    if (config.showRank) {
      ctx.font = "bold 32px " + (config.font || "Arial");
      ctx.fillStyle = config.rankColor || "#7289DA";
      ctx.textAlign = "right";
      ctx.fillText(`RANK #${rank}`, 1350, 200);
      ctx.textAlign = "left";
    }

    // XP info
    if (config.showXP) {
      ctx.font = "28px " + (config.font || "Arial");
      ctx.fillStyle = config.xpColor || "#B9BBBE";
      ctx.fillText(`${totalXP.toLocaleString()} XP`, startX, 150);
    }
  }

  private drawProgressBar(
    ctx: any,
    progressPercent: number,
    progressXP: number,
    neededXP: number,
    config: RankCardConfig
  ): void {
    if (!config.showProgress) return;

    const barX = 220;
    const barY = 320;
    const barWidth = 900;
    const barHeight = 30;
    const barRadius = 15;

    // Background
    ctx.fillStyle = config.progressBarBackground || "#36393F";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, barRadius);
    ctx.fill();

    // Empty progress bar
    ctx.fillStyle = config.progressBarEmpty || "#484B51";
    ctx.beginPath();
    ctx.roundRect(barX + 2, barY + 2, barWidth - 4, barHeight - 4, barRadius - 2);
    ctx.fill();

    // Filled progress
    const fillWidth = Math.max(0, (barWidth - 4) * (progressPercent / 100));
    if (fillWidth > 0) {
      ctx.fillStyle = config.progressBarFilled || "#FFD700";
      ctx.beginPath();
      ctx.roundRect(barX + 2, barY + 2, fillWidth, barHeight - 4, barRadius - 2);
      ctx.fill();
    }

    // Border
    if (config.progressBarBorder) {
      ctx.strokeStyle = config.progressBarBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, barRadius);
      ctx.stroke();
    }

    // XP text overlay
    ctx.font = "bold 20px " + (config.font || "Arial");
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(`${progressXP.toLocaleString()} / ${neededXP.toLocaleString()} XP`, barX + barWidth / 2, barY + 22);
    ctx.textAlign = "left";

    // Progress percentage
    ctx.font = "16px " + (config.font || "Arial");
    ctx.fillStyle = config.xpColor || "#B9BBBE";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.floor(progressPercent)}%`, barX + barWidth, barY - 10);
    ctx.textAlign = "left";
  }

  private async drawBadges(ctx: any, level: number, totalXP: number, config: RankCardConfig): Promise<void> {
    // Add level milestone badges
    const badges = this.getLevelBadges(level, totalXP);

    let badgeX = 220;
    const badgeY = 180;
    const badgeSize = 32;

    for (const badge of badges) {
      // Draw badge background
      ctx.fillStyle = badge.color;
      ctx.beginPath();
      ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw badge emoji/icon
      ctx.font = "20px Arial";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText(badge.emoji, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 7);
      ctx.textAlign = "left";

      badgeX += badgeSize + 10;
    }
  }

  private getLevelBadges(level: number, totalXP: number): { emoji: string; color: string; name: string }[] {
    const badges: { emoji: string; color: string; name: string }[] = [];

    if (level >= 5) badges.push({ emoji: "🌟", color: "#FFD700", name: "Rising Star" });
    if (level >= 10) badges.push({ emoji: "🚀", color: "#FF6B6B", name: "Rocket" });
    if (level >= 20) badges.push({ emoji: "👑", color: "#9B59B6", name: "Royal" });
    if (level >= 50) badges.push({ emoji: "💎", color: "#3498DB", name: "Diamond" });
    if (level >= 100) badges.push({ emoji: "🔥", color: "#E74C3C", name: "Legendary" });

    if (totalXP >= 100000) badges.push({ emoji: "⚡", color: "#F1C40F", name: "High Energy" });

    return badges.slice(0, 5); // Max 5 badges
  }

  private calculateLevelXP(level: number): number {
    return Math.floor(Math.pow(level, 2) * 100);
  }
}

export const rankCardService = RankCardService.getInstance();
