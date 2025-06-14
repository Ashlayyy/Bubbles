# Queue System Documentation

## Overview

The bot uses a modular queue processing system built on Bull.js and Redis. This system now includes **comprehensive fallback mechanisms** that allow the bot to operate even when Redis is unavailable.

## Key Features

- **Redis-based queuing** for reliable, scalable processing
- **Automatic fallback mode** when Redis is unavailable
- **Comprehensive error handling** with graceful degradation
- **Connection health monitoring** and automatic retry logic
- **Modular processor architecture** for easy extensibility

## Architecture

### Core Components

- **QueueProcessor**: Main coordinator that manages all processors with fallback support
- **BaseProcessor**: Abstract base class for all event processors
- **QueueService**: Service layer with Redis connection management and fallback logic
- **QueueManager**: Handles Redis connections and queue lifecycle with health monitoring
- **Individual Processors**: Modular processors for specific event types

### Current Processors

- **ModerationProcessor**: Handles ban, kick, timeout, unban actions
- **MusicProcessor**: Handles music playback controls (play, pause, stop, etc.)
- **ConfigProcessor**: Handles configuration updates

## Fallback Mechanism

### How It Works

1. **Primary Mode (Redis Available)**:

   - Actions are queued in Redis
   - Queue processors handle execution asynchronously
   - Full retry logic and persistence

2. **Fallback Mode (Redis Unavailable)**:
   - Queue operations fail gracefully
   - Actions are executed directly via Discord API
   - Logging indicates fallback mode is active
   - Bot continues normal operation

### Automatic Detection

The system automatically detects Redis availability:

- Connection health is monitored continuously
- First queue operation tests Redis connection
- Failed operations trigger fallback mode
- No manual intervention required

## Error Handling

### QueueService Level

- Tests Redis connection before each operation
- Throws meaningful errors when Redis is unavailable
- Caches connection state to avoid repeated checks
- Provides fallback status information

### ModerationManager Level

- Catches queue failures automatically
- Falls back to direct Discord API execution
- Logs both queue attempts and fallback executions
- Maintains full functionality regardless of Redis state

### Processor Level

- Graceful startup even when Redis is unavailable
- Comprehensive error logging
- Connection testing during initialization
- Status reporting for debugging

## Usage Examples

### Checking Queue Status

```typescript
// Check if Redis is available
const isAvailable = await queueService.isRedisAvailable();

// Get queue statistics (works in both modes)
const stats = await queueService.getQueueStats();
```

### Development Command

Use `/queue-status` command (dev-only) to check:

- Redis connection status
- Queue processor state
- Fallback mode status
- Queue statistics

## Configuration

### Environment Variables

```env
REDIS_HOST=localhost       # Redis server host
REDIS_PORT=6379           # Redis server port
REDIS_PASSWORD=           # Redis password (optional)
```

### Redis Connection Options

- **Connection timeout**: 5 seconds
- **Command timeout**: 5 seconds
- **Lazy connection**: Enabled (delays connection until first use)
- **Auto-retry**: Enabled with exponential backoff
- **Health monitoring**: Continuous connection state tracking

## Adding New Queue Event Types

Adding a new queue event type requires 3 steps:

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
      // Your processing logic here
      await this.doCustomAction(data);

      return this.logSuccess(data.id, "Custom action completed");
    } catch (error) {
      return this.logError(data.id, "Custom action failed", error);
    }
  }

  private async doCustomAction(data: MyCustomJob): Promise<void> {
    // Implementation here
  }
}
```

### Step 3: Register Processor

```typescript
// In bot/src/queue/processor.ts, add to initializeProcessors():
this.processors = [
  new ModerationProcessor(this.client),
  new MusicProcessor(this.client),
  new ConfigProcessor(this.client),
  new MyCustomProcessor(this.client), // Add your processor
];
```

### Step 4: Add Service Method (Optional)

```typescript
// In bot/src/services/queueService.ts
async addMyCustomAction(data: Omit<MyCustomJob, "id" | "timestamp">): Promise<string> {
  const jobId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const job = {
    ...data,
    id: jobId,
    timestamp: Date.now(),
  };

  try {
    const redisAvailable = await this.checkRedisConnection();

    if (!redisAvailable) {
      logger.warn(`Redis unavailable - cannot queue custom action: ${job.type}`);
      throw new Error("Redis connection failed");
    }

    const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);
    await queue.add("my-custom-action", job);
    logger.info(`Added custom action job: ${job.type}`);

    return jobId;
  } catch (error) {
    logger.error(`Failed to queue custom action: ${job.type}`, error);
    throw error;
  }
}
```

## Monitoring and Debugging

### Logs to Watch For

**Normal Operation (Redis Available)**:

```
[INFO] Redis connection verified - queue system active
[INFO] Queue processors started successfully
[INFO] Added moderation action job: KICK_USER for user 123456789
```

**Fallback Mode (Redis Unavailable)**:

```
[WARN] Redis connection failed - queue system will use fallback mode
[WARN] Queue failed for KICK, falling back to direct execution
[INFO] Successfully executed KICK directly (fallback mode)
```

**Redis Connection Issues**:

```
[WARN] Redis connection error: connect ECONNREFUSED 127.0.0.1:6379
[INFO] Queue system will operate in fallback mode
```

### Health Checks

1. **`/queue-status` command**: Real-time queue system status
2. **Bot logs**: Connection state and fallback mode activation
3. **Queue statistics**: Job counts and processing status
4. **Error rates**: Failed queue operations vs. successful fallbacks

## Performance Considerations

### Redis Mode

- **Pros**: Persistence, retry logic, distributed processing
- **Cons**: Network dependency, potential latency
- **Best for**: Production environments with Redis infrastructure

### Fallback Mode

- **Pros**: No external dependencies, immediate execution
- **Cons**: No persistence, no retry logic, single-point execution
- **Best for**: Development environments or Redis outages

### Hybrid Operation

The system seamlessly transitions between modes based on Redis availability, providing the best of both worlds with automatic failover.

## Troubleshooting

### Common Issues

1. **"Redis connection failed"**

   - Check if Redis/Memurai is running
   - Verify REDIS_HOST and REDIS_PORT environment variables
   - Bot will continue in fallback mode

2. **"Queue processors not starting"**

   - Check Redis connection
   - Review startup logs for specific errors
   - System will operate in fallback mode

3. **Actions not being processed**

   - In Redis mode: Check queue processor status
   - In fallback mode: Actions execute immediately
   - Use `/queue-status` to diagnose

4. **Performance issues**
   - Redis mode: Check Redis memory and connection limits
   - Fallback mode: Normal - no queuing overhead
   - Monitor logs for excessive fallback usage

### Recovery

The system is designed to be self-healing:

- Redis reconnection is automatic
- Queue processors restart when Redis comes back online
- No manual intervention required
- Fallback mode ensures continuous operation

## Security Considerations

- Redis password authentication supported via `REDIS_PASSWORD`
- Connection timeouts prevent hanging connections
- Error messages don't expose sensitive Redis details
- Fallback mode maintains same permission checks as queued mode
