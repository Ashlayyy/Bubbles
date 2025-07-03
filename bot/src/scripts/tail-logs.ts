#!/usr/bin/env node

import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

interface TailOptions {
  follow: boolean;
  lines: number;
  logFile?: string;
  pretty: boolean;
  filter?: string;
}

/**
 * Interactive log tail CLI with pino-pretty formatting
 */
class LogTailer {
  private options: TailOptions;

  constructor(options: Partial<TailOptions> = {}) {
    this.options = {
      follow: true,
      lines: 50,
      pretty: true,
      ...options,
    };
  }

  async start(): Promise<void> {
    console.log("🔍 Bubbles Bot Log Tailer");
    console.log("========================\n");

    const logFile = this.options.logFile || this.findLogFile();

    if (!logFile || !existsSync(logFile)) {
      console.error(`❌ Log file not found: ${logFile || "auto-detect failed"}`);
      console.error("Available options:");
      console.error("  --file <path>     Specify log file path");
      console.error("  --no-follow       Don't follow new entries");
      console.error("  --lines <n>       Number of lines to show (default: 50)");
      console.error("  --no-pretty       Disable pretty formatting");
      console.error("  --filter <term>   Filter logs by term");
      process.exit(1);
    }

    console.log(`📂 Tailing: ${logFile}`);
    console.log(`📊 Mode: ${this.options.follow ? "follow" : "static"} | Lines: ${this.options.lines}`);

    if (this.options.filter) {
      console.log(`🔍 Filter: ${this.options.filter}`);
    }

    console.log(""); // Empty line before logs

    if (this.options.pretty) {
      await this.tailWithPretty(logFile);
    } else {
      await this.tailRaw(logFile);
    }
  }

  private findLogFile(): string | null {
    const possiblePaths = [
      resolve(__dirname, "../logs/bot.log"),
      resolve(__dirname, "../logs/combined.log"),
      resolve(__dirname, "../logs/app.log"),
      resolve(__dirname, "../../logs/bot.log"),
      resolve(__dirname, "../../logs/combined.log"),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  }

  private async tailWithPretty(logFile: string): Promise<void> {
    const tailArgs = this.options.follow
      ? ["-f", "-n", this.options.lines.toString(), logFile]
      : ["-n", this.options.lines.toString(), logFile];

    const tail = spawn("tail", tailArgs);
    const pinoPretty = spawn("npx", ["pino-pretty", "--colorize"], {
      stdio: ["pipe", "inherit", "inherit"],
    });

    // Pipe tail output through pino-pretty
    tail.stdout.pipe(pinoPretty.stdin);

    // Handle filtering if specified
    if (this.options.filter) {
      const grep = spawn("grep", [this.options.filter], {
        stdio: ["pipe", "pipe", "inherit"],
      });

      tail.stdout.pipe(grep.stdin);
      grep.stdout.pipe(pinoPretty.stdin);
    }

    // Handle process termination
    process.on("SIGINT", () => {
      console.log("\n👋 Stopping log tail...");
      tail.kill();
      pinoPretty.kill();
      process.exit(0);
    });

    tail.on("error", (error) => {
      console.error("❌ Failed to start tail:", error.message);
      process.exit(1);
    });

    pinoPretty.on("error", (error) => {
      console.error("❌ Failed to start pino-pretty:", error.message);
      console.log("💡 Install pino-pretty: npm install -g pino-pretty");
      process.exit(1);
    });
  }

  private async tailRaw(logFile: string): Promise<void> {
    const tailArgs = this.options.follow
      ? ["-f", "-n", this.options.lines.toString(), logFile]
      : ["-n", this.options.lines.toString(), logFile];

    let tail = spawn("tail", tailArgs, { stdio: "inherit" });

    // Handle filtering if specified
    if (this.options.filter) {
      tail = spawn("tail", tailArgs);
      const grep = spawn("grep", [this.options.filter], {
        stdio: ["pipe", "inherit", "inherit"],
      });

      tail.stdout.pipe(grep.stdin);
    }

    // Handle process termination
    process.on("SIGINT", () => {
      console.log("\n👋 Stopping log tail...");
      tail.kill();
      process.exit(0);
    });

    tail.on("error", (error) => {
      console.error("❌ Failed to start tail:", error.message);
      process.exit(1);
    });
  }
}

// CLI argument parsing
function parseArgs(): Partial<TailOptions> {
  const args = process.argv.slice(2);
  const options: Partial<TailOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--file":
      case "-f":
        options.logFile = args[++i];
        break;
      case "--no-follow":
        options.follow = false;
        break;
      case "--lines":
      case "-n":
        options.lines = parseInt(args[++i], 10) || 50;
        break;
      case "--no-pretty":
        options.pretty = false;
        break;
      case "--filter":
        options.filter = args[++i];
        break;
      case "--help":
      case "-h":
        console.log("Bubbles Bot Log Tailer");
        console.log("");
        console.log("Usage: npm run logs [options]");
        console.log("");
        console.log("Options:");
        console.log("  --file <path>     Specify log file path");
        console.log("  --no-follow       Don't follow new entries");
        console.log("  --lines <n>       Number of lines to show (default: 50)");
        console.log("  --no-pretty       Disable pretty formatting");
        console.log("  --filter <term>   Filter logs by term");
        console.log("  --help            Show this help");
        process.exit(0);
        break;
    }
  }

  return options;
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const tailer = new LogTailer(options);
  tailer.start().catch(console.error);
}

export { LogTailer };
