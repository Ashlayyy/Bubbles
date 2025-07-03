import type Client from "../Client.js";
import LogManager from "../LogManager.js";
import ModerationManager from "../ModerationManager.js";

export function initializeManagers(client: Client): { logManager: LogManager; moderationManager: ModerationManager } {
  const logManager = new LogManager(client);
  const moderationManager = new ModerationManager(client, logManager);

  return { logManager, moderationManager };
}
