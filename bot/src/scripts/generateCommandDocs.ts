#!/usr/bin/env node

import { Collection } from "discord.js";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { BaseCommand } from "../commands/_core/BaseCommand.js";
import { forNestedDirsFiles, importDefaultESM } from "../functions/general/fs.js";
import { camel2Display } from "../functions/general/strings.js";
import type Command from "../structures/Command.js";
import { isCommand } from "../structures/Command.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

interface CommandInfo {
  name: string;
  description: string;
  category: string;
  options: {
    name: string;
    description: string;
    type: string;
    required: boolean;
  }[];
  permissions?: string[];
  examples?: string[];
}

/**
 * Generate markdown documentation for all commands
 */
async function generateCommandDocs(): Promise<void> {
  console.log("🔍 Scanning commands...");

  const commands = new Collection<string, BaseCommand | Command>();
  const commandsByCategory = new Map<string, CommandInfo[]>();

  const commandsDir = "./src/commands";
  const loadedCommandFiles = new Set<string>();

  const processCommandFile = async (commandFilePath: string, category: string) => {
    if (loadedCommandFiles.has(commandFilePath)) {
      return;
    }

    // Skip helper directories
    if (category === "_core" || category === "_shared") {
      return;
    }

    try {
      const command = await importDefaultESM(commandFilePath, isCommand);
      command.category = category;

      let commandInfo: CommandInfo;
      let commandName: string;

      if (command instanceof BaseCommand) {
        // For BaseCommand, import the builder
        const path = await import("path");
        const url = await import("url");
        const normalizedPath = commandFilePath.replace(/\\/g, "/");
        const absolutePath = path.resolve(normalizedPath);
        const fileUrl = url.pathToFileURL(absolutePath).href;

        const module = (await import(fileUrl)) as {
          builder?: { name?: string; description?: string; options?: unknown[]; toJSON?: () => unknown };
        };
        const builder = module.builder;

        if (builder && typeof builder.toJSON === "function") {
          const builderData = builder.toJSON() as { name: string; description: string; options?: unknown[] };
          commandName = builderData.name;

          commandInfo = {
            name: builderData.name,
            description: builderData.description || "No description provided",
            category: camel2Display(category),
            options: (builderData.options || []).map((opt: any) => ({
              name: opt.name ?? "unknown",
              description: opt.description ?? "No description",
              type: getOptionTypeName(opt.type),
              required: opt.required ?? false,
            })),
          };
        } else {
          commandName = `${category}-basecommand-${commands.size}`;
          commandInfo = {
            name: commandName,
            description: "No description provided",
            category: camel2Display(category),
            options: [],
          };
        }
      } else {
        // Legacy Command
        commandName = command.builder.name;
        const builderData = command.builder.toJSON() as { name: string; description: string; options?: unknown[] };

        commandInfo = {
          name: builderData.name,
          description: builderData.description || "No description provided",
          category: camel2Display(category),
          options: (builderData.options || []).map((opt: any) => ({
            name: opt.name ?? "unknown",
            description: opt.description ?? "No description",
            type: getOptionTypeName(opt.type),
            required: opt.required ?? false,
          })),
        };
      }

      commands.set(commandName, command);

      // Group by category
      if (!commandsByCategory.has(commandInfo.category)) {
        commandsByCategory.set(commandInfo.category, []);
      }
      commandsByCategory.get(commandInfo.category)!.push(commandInfo);

      loadedCommandFiles.add(commandFilePath);
      console.log(`  ✓ ${commandInfo.name} (${commandInfo.category})`);
    } catch (error) {
      console.error(`  ✗ Failed to load ${commandFilePath}:`, error);
    }
  };

  // Load commands from all directories
  await forNestedDirsFiles(commandsDir, processCommandFile);

  // Load context menu commands
  const contextMenuDir = `${commandsDir}/context`;
  await forNestedDirsFiles(contextMenuDir, processCommandFile);

  console.log(`\n📝 Generating documentation for ${commands.size} commands...`);

  // Generate markdown
  const markdown = generateMarkdown(commandsByCategory);

  // Ensure output directory exists
  const outputDir = resolve(__dirname, "../../../documentation/generated");
  mkdirSync(outputDir, { recursive: true });

  // Write to file
  const outputPath = resolve(outputDir, "commands.md");
  writeFileSync(outputPath, markdown, "utf-8");

  console.log(`✅ Documentation generated: ${outputPath}`);
}

function getOptionTypeName(type: number): string {
  const typeNames: Record<number, string> = {
    1: "SUB_COMMAND",
    2: "SUB_COMMAND_GROUP",
    3: "STRING",
    4: "INTEGER",
    5: "BOOLEAN",
    6: "USER",
    7: "CHANNEL",
    8: "ROLE",
    9: "MENTIONABLE",
    10: "NUMBER",
    11: "ATTACHMENT",
  };
  return typeNames[type] || `UNKNOWN(${type})`;
}

function generateMarkdown(commandsByCategory: Map<string, CommandInfo[]>): string {
  const lines: string[] = [];

  lines.push("# Bot Commands Documentation");
  lines.push("");
  lines.push(`*Generated on ${new Date().toISOString()}*`);
  lines.push("");

  // Table of contents
  lines.push("## Table of Contents");
  lines.push("");
  for (const [category] of Array.from(commandsByCategory.entries()).sort()) {
    lines.push(`- [${category}](#${category.toLowerCase().replace(/\s+/g, "-")})`);
  }
  lines.push("");

  // Commands by category
  for (const [category, commands] of Array.from(commandsByCategory.entries()).sort()) {
    lines.push(`## ${category}`);
    lines.push("");

    for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`### \`/${cmd.name}\``);
      lines.push("");
      lines.push(cmd.description);
      lines.push("");

      if (cmd.options.length > 0) {
        lines.push("**Options:**");
        lines.push("");
        lines.push("| Name | Type | Required | Description |");
        lines.push("|------|------|----------|-------------|");

        for (const option of cmd.options) {
          const required = option.required ? "✅" : "❌";
          lines.push(`| \`${option.name}\` | ${option.type} | ${required} | ${option.description} |`);
        }
        lines.push("");
      }

      if (cmd.permissions && cmd.permissions.length > 0) {
        lines.push("**Required Permissions:**");
        lines.push("");
        for (const perm of cmd.permissions) {
          lines.push(`- ${perm}`);
        }
        lines.push("");
      }

      if (cmd.examples && cmd.examples.length > 0) {
        lines.push("**Examples:**");
        lines.push("");
        for (const example of cmd.examples) {
          lines.push(`\`\`\`${example}\`\`\``);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateCommandDocs().catch(console.error);
}

export { generateCommandDocs };
