// Simple in-memory mutex to avoid concurrent moderation actions on the same user
// In multi-process deployments replace this with Redis or DB-level locks.

export class MutexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MutexError";
  }
}

const activeKeys: Set<string> = new Set<string>();

export const ModerationMutex = {
  acquire(guildId: string, userId: string): void {
    const key = `${guildId}:${userId}`;
    if (activeKeys.has(key)) {
      throw new MutexError("Another moderation action is currently processing for this user. Please wait.");
    }
    activeKeys.add(key);
  },

  release(guildId: string, userId: string): void {
    const key = `${guildId}:${userId}`;
    activeKeys.delete(key);
  },
};

export default ModerationMutex;
