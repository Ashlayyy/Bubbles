import type { Job } from "bull";
import type { GiveawayJob } from "../../../../shared/src/types/queue.js";
import { endGiveaway } from "../../commands/moderation/giveaway.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

export class GiveawayProcessor extends BaseProcessor<GiveawayJob> {
  constructor(client: Client) {
    super(client, "GiveawayProcessor");
  }

  getJobType(): string {
    return "giveaway";
  }

  async processJob(job: Job<GiveawayJob>): Promise<ProcessorResult> {
    const data = job.data;
    this.logStart(data.id, `Processing giveaway job: ${data.type}`);

    try {
      switch (data.type) {
        case "END_GIVEAWAY":
          await endGiveaway(this.client, data.giveawayDbId);
          break;
        case "REROLL_GIVEAWAY":
          // Reroll logic would go here if needed
          logger.info(`Reroll giveaway job received for ${data.giveawayId}`);
          break;
        default:
          throw new Error(`Unknown giveaway job type: ${data.type}`);
      }

      return this.success(`Giveaway job ${data.type} completed successfully`);
    } catch (error) {
      return this.failure(`Failed to process giveaway job: ${error}`, error);
    }
  }
}
