import type { Job } from "bull";
import type { ModerationActionJob } from "../../../../shared/src/types/queue.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

export class ModerationProcessor extends BaseProcessor<ModerationActionJob> {
  constructor(client: Client) {
    super(client, "ModerationProcessor");
  }

  getJobType(): string {
    return "moderation-action";
  }

  async processJob(job: Job<ModerationActionJob>): Promise<ProcessorResult> {
    const data = job.data;
    this.logStart(data.id, `${data.type} for user ${data.targetUserId}`);

    try {
      const guild = await this.client.guilds.fetch(data.guildId ?? "").catch(() => null);
      if (!guild) {
        throw new Error(`Guild ${data.guildId} not found`);
      }

      switch (data.type) {
        case "BAN_USER": {
          await guild.members.ban(data.targetUserId, { reason: data.reason });
          this.logSuccess(data.id, `Banned user ${data.targetUserId} from guild ${data.guildId}`);
          break;
        }
        case "KICK_USER": {
          const member = await guild.members.fetch(data.targetUserId).catch(() => null);
          if (!member) {
            throw new Error(`Member ${data.targetUserId} not found in guild ${data.guildId}`);
          }
          await member.kick(data.reason);
          this.logSuccess(data.id, `Kicked user ${data.targetUserId} from guild ${data.guildId}`);
          break;
        }
        case "TIMEOUT_USER": {
          const member = await guild.members.fetch(data.targetUserId).catch(() => null);
          if (!member) {
            throw new Error(`Member ${data.targetUserId} not found in guild ${data.guildId}`);
          }
          if (data.duration) {
            await member.timeout(data.duration, data.reason);
            this.logSuccess(data.id, `Timed out user ${data.targetUserId} for ${data.duration}ms`);
          } else {
            throw new Error("Duration is required for timeout action");
          }
          break;
        }
        case "UNBAN_USER": {
          await guild.members.unban(data.targetUserId, data.reason);
          this.logSuccess(data.id, `Unbanned user ${data.targetUserId} from guild ${data.guildId}`);
          break;
        }
        default: {
          throw new Error(`Unknown moderation action type: ${data.type}`);
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
