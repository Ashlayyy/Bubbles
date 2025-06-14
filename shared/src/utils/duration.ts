/**
 * Parse duration string (e.g., "1d", "3h", "30m") into seconds
 */
export function parseDuration(durationStr: string): number | null {
  const regex = /^(\d+)([smhdw])$/;
  const match = regex.exec(durationStr);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
    w: 60 * 60 * 24 * 7,
  };

  return value * multipliers[unit as keyof typeof multipliers];
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  const units = [
    { name: "week", seconds: 604800 },
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

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
} 