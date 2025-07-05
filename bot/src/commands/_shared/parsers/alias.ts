import { prisma } from "../../../database/index.js";
import type { AliasExpansionContext } from "../../_core/types.js";

export type { AliasExpansionContext };

/**
 * Check if a string looks like an alias (typically uppercase, short)
 */
export function looksLikeAlias(text: string): boolean {
  // Simple heuristic: if it's all uppercase and relatively short, it might be an alias
  return /^[A-Z_]{2,20}$/.test(text);
}

/**
 * Expand an alias with variable substitution
 */
export async function expandAlias(input: string, context: AliasExpansionContext): Promise<string> {
  // If it doesn't look like an alias, return as-is
  if (!looksLikeAlias(input)) {
    return input;
  }

  try {
    const alias = await prisma.alias.findUnique({
      where: {
        guildId_name: {
          guildId: context.guild.id,
          name: input.toUpperCase(),
        },
      },
    });

    if (!alias) {
      return input; // Return original if no alias found
    }

    // Expand alias content with variables
    let expanded = alias.content;
    expanded = expanded.replace(/\{user\}/g, `<@${context.user.id}>`);
    expanded = expanded.replace(/\{server\}/g, context.guild.name);
    expanded = expanded.replace(/\{moderator\}/g, `<@${context.moderator.id}>`);

    // Update usage count
    await prisma.alias.update({
      where: { id: alias.id },
      data: { usageCount: { increment: 1 } },
    });

    return expanded;
  } catch (_error) {
    // If there's an error, return the original input
    return input;
  }
}

/**
 * Get all aliases for a guild
 */
export async function getGuildAliases(guildId: string) {
  try {
    return await prisma.alias.findMany({
      where: { guildId },
      select: {
        name: true,
        content: true,
        usageCount: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

/**
 * Search aliases by name or content
 */
export async function searchAliases(guildId: string, query: string) {
  try {
    return await prisma.alias.findMany({
      where: {
        guildId,
        OR: [{ name: { contains: query, mode: "insensitive" } }, { content: { contains: query, mode: "insensitive" } }],
      },
      select: {
        name: true,
        content: true,
        usageCount: true,
      },
      take: 10,
    });
  } catch {
    return [];
  }
}
