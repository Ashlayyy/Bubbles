import type { Job } from "bull";
import { useMainPlayer } from "discord-player";
import type { MusicActionJob } from "../../../../shared/src/types/queue.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

export class MusicProcessor extends BaseProcessor<MusicActionJob> {
  constructor(client: Client) {
    super(client, "MusicProcessor");
  }

  getJobType(): string {
    return "music-action";
  }

  async processJob(job: Job<MusicActionJob>): Promise<ProcessorResult> {
    const data = job.data;
    this.logStart(data.id, `${data.type} action`);

    try {
      const player = useMainPlayer();

      // Get guild from the job data
      if (!data.guildId) {
        throw new Error("Guild ID is required for music actions");
      }

      const guild = await this.client.guilds.fetch(data.guildId).catch(() => null);
      if (!guild) {
        throw new Error(`Guild ${data.guildId} not found`);
      }

      const queue = player.nodes.get(guild.id);

      switch (data.type) {
        case "PLAY_MUSIC": {
          // This would need more context like voice channel, etc.
          // For now, just validate the query is provided
          if (!data.query) {
            throw new Error("Query is required for play music action");
          }
          this.logSuccess(data.id, `Play music request processed: ${data.query}`);
          break;
        }
        case "PAUSE_MUSIC": {
          if (!queue) {
            throw new Error("No active music queue found");
          }
          queue.node.setPaused(true);
          this.logSuccess(data.id, "Music paused");
          break;
        }
        case "SKIP_MUSIC": {
          if (!queue) {
            throw new Error("No active music queue found");
          }
          const success = queue.node.skip();
          if (success) {
            this.logSuccess(data.id, "Music skipped");
          } else {
            throw new Error("Failed to skip track");
          }
          break;
        }
        case "STOP_MUSIC": {
          if (!queue) {
            throw new Error("No active music queue found");
          }
          queue.delete();
          this.logSuccess(data.id, "Music stopped and queue cleared");
          break;
        }
        case "SET_VOLUME": {
          if (!queue) {
            throw new Error("No active music queue found");
          }
          if (data.volume === undefined || data.volume < 0 || data.volume > 100) {
            throw new Error("Volume must be between 0 and 100");
          }
          queue.node.setVolume(data.volume);
          this.logSuccess(data.id, `Volume set to: ${data.volume}%`);
          break;
        }
        default: {
          throw new Error(`Unknown music action type: ${data.type}`);
        }
      }

      return { success: true, jobId: data.id };
    } catch (error) {
      this.logError(data.id, error);
      return {
        success: false,
        jobId: data.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
