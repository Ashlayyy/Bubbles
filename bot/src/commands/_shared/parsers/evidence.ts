import type { ParsedEvidence } from "../../_core/types.js";

export type { ParsedEvidence };

/**
 * Parse evidence string into categorized evidence
 */
export function parseEvidence(evidenceStr?: string): ParsedEvidence {
  const result: ParsedEvidence = {
    links: [],
    attachments: [],
    text: [],
    all: [],
  };

  if (!evidenceStr) return result;

  const items = evidenceStr
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const item of items) {
    // Check if it's a URL
    if (isValidUrl(item)) {
      result.links.push(item);
      result.all.push(item);
    }
    // Check if it's a Discord attachment URL
    else if (item.includes("discord.com") || item.includes("cdn.discordapp.com")) {
      result.attachments.push(item);
      result.all.push(item);
    }
    // Otherwise treat as text evidence
    else {
      result.text.push(item);
      result.all.push(item);
    }
  }

  return result;
}

/**
 * Format evidence for display in embeds
 */
export function formatEvidence(evidence: ParsedEvidence, maxLength = 1000): string {
  const parts: string[] = [];

  if (evidence.links.length > 0) {
    parts.push(`**Links:** ${evidence.links.join(", ")}`);
  }

  if (evidence.attachments.length > 0) {
    parts.push(`**Attachments:** ${evidence.attachments.length} file(s)`);
  }

  if (evidence.text.length > 0) {
    parts.push(`**Notes:** ${evidence.text.join("; ")}`);
  }

  const result = parts.join("\n");
  return result.length > maxLength ? result.substring(0, maxLength) + "..." : result;
}

/**
 * Get total count of evidence items
 */
export function getEvidenceCount(evidence: ParsedEvidence): number {
  return evidence.all.length;
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}
