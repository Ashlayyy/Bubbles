# Queue System Documentation

## Overview

The bot uses a modular queue processing system built on Bull.js and Redis. This allows for reliable, scalable processing of various bot actions including moderation, music, configuration updates, and more.

## Architecture

### Core Components

- **QueueProcessor**: Main coordinator that manages all processors
- **BaseProcessor**: Abstract base class for all event processors
- **Individual Processors**: Modular processors for specific event types

### Current Processors

- **ModerationProcessor**: Handles ban, kick, timeout, unban actions
- **MusicProcessor**: Handles music playback controls (play, pause, stop, etc.)
- **ConfigProcessor**: Handles configuration updates

## Adding New Queue Event Types

Adding a new queue event type is simple and requires only 3 steps:

### Step 1: Define Job Type (in shared/src/types/queue.ts)

```typescript
export interface MyCustomJob extends BaseJob {
  type: "MY_CUSTOM_ACTION";
  customData: string;
  optionalField?: number;
}

// Add to union type
export type BotCommandJob = SendMessageJob | ModerationActionJob | MusicActionJob | ConfigUpdateJob | MyCustomJob;
```

### Step 2: Create Processor

```typescript
// bot/src/queue/processors/MyCustomProcessor.ts
import type { Job } from "bull";
import type { MyCustomJob } from "../../../../shared/src/types/queue.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

export class MyCustomProcessor extends BaseProcessor<MyCustomJob> {
  constructor(client: Client) {
    super(client, "MyCustomProcessor");
  }

  getJobType(): string {
    return "my-custom-action";
  }

  async processJob(job: Job<MyCustomJob>): Promise<ProcessorResult> {
    const data = job.data;
    this.logStart(data.id, `Processing custom action: ${data.customData}`);

    try {
      // Your custom logic here
      await this.doCustomWork(data);

      this.logSuccess(data.id, "Custom action completed");
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

  private async doCustomWork(data: MyCustomJob): Promise<void> {
    // Implement your custom logic
  }
}
```

### Step 3: Register Processor

```typescript
// In bot/src/queue/processor.ts, add to initializeProcessors():
private initializeProcessors(): void {
  this.processors = [
    new ModerationProcessor(this.client),
    new MusicProcessor(this.client),
    new ConfigProcessor(this.client),
    new MyCustomProcessor(this.client), // Add your processor here
  ];
}
```

That's it! Your new queue event type is now ready to use.

## Usage Examples

### Adding Jobs to Queue

```typescript
import queueManager from "./queue/manager.js";
import { QUEUE_NAMES } from "../../shared/src/types/queue.js";

const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);

// Add a moderation job
await queue.add("moderation-action", {
  id: "unique-job-id",
  timestamp: Date.now(),
  type: "BAN_USER",
  guildId: "123456789",
  targetUserId: "987654321",
  reason: "Spam",
});

// Add a custom job
await queue.add("my-custom-action", {
  id: "another-unique-id",
  timestamp: Date.now(),
  type: "MY_CUSTOM_ACTION",
  customData: "some data",
});
```

### Error Handling

All processors automatically handle errors and provide structured results. Failed jobs are logged and can be retried based on the queue configuration.

### Monitoring

- Jobs are logged with structured information
- Queue statistics are available through `queueManager.getQueueStats()`
- Failed jobs are retained for debugging (configurable)

## Configuration

Queue configuration is handled in `shared/src/queue/config.ts`:

- Redis connection settings
- Job retry policies
- Job retention policies
- Backoff strategies

## Benefits of This Architecture

1. **Modularity**: Each event type has its own processor
2. **Scalability**: Easy to add new event types without touching existing code
3. **Reliability**: Built on Bull.js with retry mechanisms and error handling
4. **Maintainability**: Clear separation of concerns
5. **Extensibility**: Simple 3-step process to add new functionality
