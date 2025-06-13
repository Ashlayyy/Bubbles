import type { Job } from "bull";
import type { ConfigUpdateJob } from "../../../../shared/src/types/queue.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

export class ConfigProcessor extends BaseProcessor<ConfigUpdateJob> {
  constructor(client: Client) {
    super(client, "ConfigProcessor");
  }

  getJobType(): string {
    return "config-update";
  }

  processJob(job: Job<ConfigUpdateJob>): ProcessorResult {
    const data = job.data;
    this.logStart(data.id, `Update config ${data.configKey}`);

    try {
      // For now, just log the config update - you can implement actual config updates later
      this.logSuccess(data.id, `Would update config ${data.configKey} to: ${JSON.stringify(data.configValue)}`);

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
