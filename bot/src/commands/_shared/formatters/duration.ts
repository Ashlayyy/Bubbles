export interface Duration {
  seconds: number;
  formatted: string;
}

export interface DurationValidation {
  valid: boolean;
  seconds?: number;
  error?: string;
}

/**
 * Parse a duration string into seconds
 */
export function parseDuration(durationStr: string): number | null {
  const regex = /^(\d+)([smhdw])$/i;
  const match = regex.exec(durationStr.toLowerCase());

  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
    w: 60 * 60 * 24 * 7,
  };

  return value * multipliers[unit];
}

/**
 * Format seconds into a human-readable duration
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
 * Format duration in short form (e.g., "1d", "3h")
 */
export function formatDurationShort(seconds: number): string {
  const units = [
    { name: "w", seconds: 604800 },
    { name: "d", seconds: 86400 },
    { name: "h", seconds: 3600 },
    { name: "m", seconds: 60 },
    { name: "s", seconds: 1 },
  ];

  for (const unit of units) {
    const count = Math.floor(seconds / unit.seconds);
    if (count > 0) {
      return `${count}${unit.name}`;
    }
  }

  return "0s";
}

/**
 * Validate a duration string for specific action types
 */
export function validateDuration(durationStr: string, type: "timeout" | "ban" | "mute" = "ban"): DurationValidation {
  const seconds = parseDuration(durationStr);

  if (seconds === null) {
    return {
      valid: false,
      error: "Invalid duration format. Use format like: 1d, 3h, 30m",
    };
  }

  // Type-specific validations
  if (type === "timeout") {
    const maxTimeout = 28 * 24 * 60 * 60; // 28 days for Discord timeouts
    if (seconds > maxTimeout) {
      return {
        valid: false,
        error: "Timeout duration cannot exceed 28 days",
      };
    }
  }

  // Minimum duration check (1 second)
  if (seconds < 1) {
    return {
      valid: false,
      error: "Duration must be at least 1 second",
    };
  }

  return {
    valid: true,
    seconds,
  };
}
