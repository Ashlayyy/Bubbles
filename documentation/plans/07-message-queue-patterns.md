# Message Queue Patterns & Events

## 🎯 Queue Architecture Overview

The message queue system uses **Redis + Bull** to enable asynchronous communication between services. Each service acts as both producer and consumer depending on the operation.

### Queue Types

- **Command Queues**: Send commands from API to Bot
- **Event Queues**: Broadcast events from Bot to API
- **Notification Queues**: Cross-service notifications
- **Scheduled Queues**: Delayed/recurring tasks

---

## 📊 Queue Structure

### Queue Naming Convention

```typescript
const QUEUES = {
  // Command queues (API → Bot)
  BOT_COMMANDS: "bot:commands",
  BOT_MODERATION: "bot:moderation",
  BOT_MUSIC: "bot:music",
  BOT_CONFIG: "bot:config",

  // Event queues (Bot → API)
  DISCORD_EVENTS: "discord:events",
  MODERATION_EVENTS: "moderation:events",
  MUSIC_EVENTS: "music:events",

  // Cross-service
  NOTIFICATIONS: "notifications",
  WEBHOOKS: "webhooks",
  ANALYTICS: "analytics",

  // Scheduled tasks
  SCHEDULED_TASKS: "scheduled:tasks",
  CLEANUP_TASKS: "cleanup:tasks",
} as const;
```

### Message Structure

All queue messages follow a consistent structure:

```typescript
interface BaseQueueMessage {
  id: string; // Unique message ID
  type: string; // Message type
  timestamp: Date; // When message was created
  source: "api" | "bot" | "frontend"; // Origin service
  guildId?: string; // Discord server ID
  userId?: string; // User who triggered action
  requestId?: string; // For tracking requests
  priority?: "low" | "normal" | "high"; // Message priority
  data: unknown; // Message-specific payload
}
```

---

## 🤖 Bot Commands (API → Bot)

### Discord Actions

#### SEND_MESSAGE

Send message to Discord channel.

```typescript
interface SendMessageCommand extends BaseQueueMessage {
  type: "SEND_MESSAGE";
  data: {
    channelId: string;
    content?: string;
    embeds?: DiscordEmbed[];
    components?: DiscordComponent[];
    files?: DiscordAttachment[];
    reply?: {
      messageId: string;
      failIfNotExists?: boolean;
    };
  };
}
```

#### SEND_DM

Send direct message to user.

```typescript
interface SendDMCommand extends BaseQueueMessage {
  type: "SEND_DM";
  data: {
    userId: string;
    content?: string;
    embeds?: DiscordEmbed[];
    reason?: string; // For audit logs
  };
}
```

### Moderation Commands

#### BAN_USER

Ban user from server.

```typescript
interface BanUserCommand extends BaseQueueMessage {
  type: "BAN_USER";
  data: {
    userId: string;
    reason: string;
    deleteMessageDays: number; // 0-7 days
    duration?: number; // null = permanent, number = hours
    moderatorId: string;
    caseId?: string; // Link to moderation case
    notifyUser: boolean;
    createCase: boolean;
  };
}
```

#### KICK_USER

Kick user from server.

```typescript
interface KickUserCommand extends BaseQueueMessage {
  type: "KICK_USER";
  data: {
    userId: string;
    reason: string;
    moderatorId: string;
    caseId?: string;
    notifyUser: boolean;
    createCase: boolean;
  };
}
```

#### TIMEOUT_USER

Timeout user (Discord's timeout feature).

```typescript
interface TimeoutUserCommand extends BaseQueueMessage {
  type: "TIMEOUT_USER";
  data: {
    userId: string;
    duration: number; // Duration in seconds (max 28 days)
    reason: string;
    moderatorId: string;
    caseId?: string;
    notifyUser: boolean;
    createCase: boolean;
  };
}
```

#### UNBAN_USER

Remove ban from user.

```typescript
interface UnbanUserCommand extends BaseQueueMessage {
  type: "UNBAN_USER";
  data: {
    userId: string;
    reason: string;
    moderatorId: string;
    caseId?: string; // Update existing case
    notifyUser: boolean;
  };
}
```

### Music Commands

#### PLAY_MUSIC

Add track to music queue.

```typescript
interface PlayMusicCommand extends BaseQueueMessage {
  type: "PLAY_MUSIC";
  data: {
    query: string; // Search query or URL
    requestedBy: string; // User ID
    voiceChannelId?: string; // Connect to specific voice channel
    playNext: boolean; // Add to front of queue
    playNow: boolean; // Skip current and play immediately
  };
}
```

#### SKIP_MUSIC

Skip current track.

```typescript
interface SkipMusicCommand extends BaseQueueMessage {
  type: "SKIP_MUSIC";
  data: {
    requestedBy: string;
    skipCount: number; // Number of tracks to skip (default: 1)
  };
}
```

#### PAUSE_MUSIC

Pause/resume music playback.

```typescript
interface PauseMusicCommand extends BaseQueueMessage {
  type: "PAUSE_MUSIC";
  data: {
    paused: boolean; // true = pause, false = resume
    requestedBy: string;
  };
}
```

#### SET_VOLUME

Set music player volume.

```typescript
interface SetVolumeCommand extends BaseQueueMessage {
  type: "SET_VOLUME";
  data: {
    volume: number; // 0-100
    requestedBy: string;
  };
}
```

#### SET_REPEAT

Set repeat mode.

```typescript
interface SetRepeatCommand extends BaseQueueMessage {
  type: "SET_REPEAT";
  data: {
    mode: "OFF" | "TRACK" | "QUEUE";
    requestedBy: string;
  };
}
```

### Configuration Commands

#### UPDATE_CONFIG

Update bot configuration.

```typescript
interface UpdateConfigCommand extends BaseQueueMessage {
  type: "UPDATE_CONFIG";
  data: {
    config: Partial<GuildConfig>;
    updatedBy: string;
    section?: string; // Specific config section updated
  };
}
```

#### RELOAD_COMMANDS

Reload bot commands.

```typescript
interface ReloadCommandsCommand extends BaseQueueMessage {
  type: "RELOAD_COMMANDS";
  data: {
    commandNames?: string[]; // Specific commands to reload
    global: boolean; // Reload global commands
  };
}
```

---

## 📡 Discord Events (Bot → API)

### Member Events

#### MEMBER_JOINED

User joined the server.

```typescript
interface MemberJoinedEvent extends BaseQueueMessage {
  type: "MEMBER_JOINED";
  data: {
    user: {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
      bot: boolean;
    };
    member: {
      joinedAt: Date;
      roles: string[]; // Role IDs
      nickname?: string;
      pending: boolean; // Membership screening
    };
    inviteCode?: string; // Invite used to join
  };
}
```

#### MEMBER_LEFT

User left the server.

```typescript
interface MemberLeftEvent extends BaseQueueMessage {
  type: "MEMBER_LEFT";
  data: {
    user: {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
    };
    member: {
      joinedAt: Date;
      roles: string[];
      nickname?: string;
    };
    reason: "LEFT" | "KICKED" | "BANNED"; // How they left
  };
}
```

#### MEMBER_UPDATED

Member information changed.

```typescript
interface MemberUpdatedEvent extends BaseQueueMessage {
  type: "MEMBER_UPDATED";
  data: {
    userId: string;
    changes: {
      nickname?: { old?: string; new?: string };
      roles?: { added: string[]; removed: string[] };
      timeout?: { old?: Date; new?: Date };
    };
  };
}
```

### Message Events

#### MESSAGE_DELETED

Message was deleted.

```typescript
interface MessageDeletedEvent extends BaseQueueMessage {
  type: "MESSAGE_DELETED";
  data: {
    messageId: string;
    channelId: string;
    authorId?: string; // May be unknown if not cached
    content?: string; // May be unknown if not cached
    deletedBy?: string; // Who deleted it (if known)
    timestamp: Date;
  };
}
```

#### MESSAGE_EDITED

Message was edited.

```typescript
interface MessageEditedEvent extends BaseQueueMessage {
  type: "MESSAGE_EDITED";
  data: {
    messageId: string;
    channelId: string;
    authorId: string;
    oldContent?: string;
    newContent: string;
    editedAt: Date;
  };
}
```

#### MESSAGE_BULK_DELETED

Multiple messages deleted.

```typescript
interface MessageBulkDeletedEvent extends BaseQueueMessage {
  type: "MESSAGE_BULK_DELETED";
  data: {
    messageIds: string[];
    channelId: string;
    deletedBy?: string;
    count: number;
  };
}
```

### Server Events

#### CHANNEL_CREATED

New channel created.

```typescript
interface ChannelCreatedEvent extends BaseQueueMessage {
  type: "CHANNEL_CREATED";
  data: {
    channel: {
      id: string;
      name: string;
      type: ChannelType;
      position: number;
      parentId?: string;
    };
    createdBy?: string;
  };
}
```

#### ROLE_CREATED

New role created.

```typescript
interface RoleCreatedEvent extends BaseQueueMessage {
  type: "ROLE_CREATED";
  data: {
    role: {
      id: string;
      name: string;
      color: number;
      position: number;
      permissions: string;
      mentionable: boolean;
      hoist: boolean;
    };
    createdBy?: string;
  };
}
```

---

## ⚖️ Moderation Events (Bot → API)

### Case Events

#### CASE_CREATED

New moderation case created.

```typescript
interface CaseCreatedEvent extends BaseQueueMessage {
  type: "CASE_CREATED";
  data: {
    case: {
      id: string;
      caseNumber: number;
      type: "BAN" | "KICK" | "TIMEOUT" | "WARN" | "NOTE";
      userId: string;
      moderatorId: string;
      reason: string;
      duration?: number;
      status: "ACTIVE" | "EXPIRED" | "REVOKED";
      evidence?: string[];
    };
  };
}
```

#### CASE_UPDATED

Moderation case updated.

```typescript
interface CaseUpdatedEvent extends BaseQueueMessage {
  type: "CASE_UPDATED";
  data: {
    caseId: string;
    changes: {
      status?: { old: string; new: string };
      reason?: { old: string; new: string };
      duration?: { old?: number; new?: number };
    };
    updatedBy: string;
  };
}
```

### Action Events

#### MODERATION_ACTION_COMPLETED

Moderation action was executed.

```typescript
interface ModerationActionCompletedEvent extends BaseQueueMessage {
  type: "MODERATION_ACTION_COMPLETED";
  data: {
    action: "BAN" | "KICK" | "TIMEOUT" | "UNBAN";
    userId: string;
    success: boolean;
    error?: string;
    caseId?: string;
    executedBy: string;
    timestamp: Date;
  };
}
```

#### AUTOMOD_TRIGGERED

Automatic moderation triggered.

```typescript
interface AutomodTriggeredEvent extends BaseQueueMessage {
  type: "AUTOMOD_TRIGGERED";
  data: {
    rule: string; // Which automod rule triggered
    userId: string;
    channelId: string;
    messageId?: string;
    action: "DELETE" | "TIMEOUT" | "WARN";
    severity: "LOW" | "MEDIUM" | "HIGH";
    content?: string; // Triggering content
  };
}
```

---

## 🎵 Music Events (Bot → API)

### Playback Events

#### MUSIC_STARTED

Music playback started.

```typescript
interface MusicStartedEvent extends BaseQueueMessage {
  type: "MUSIC_STARTED";
  data: {
    track: {
      id: string;
      title: string;
      artist: string;
      duration: number;
      thumbnail?: string;
      url: string;
      requestedBy: string;
    };
    voiceChannelId: string;
    queuePosition: number;
    totalQueueSize: number;
  };
}
```

#### MUSIC_ENDED

Track finished playing.

```typescript
interface MusicEndedEvent extends BaseQueueMessage {
  type: "MUSIC_ENDED";
  data: {
    trackId: string;
    reason: "FINISHED" | "SKIPPED" | "STOPPED" | "ERROR";
    duration: number; // How long it played
    nextTrackId?: string;
  };
}
```

#### MUSIC_PAUSED

Playback paused/resumed.

```typescript
interface MusicPausedEvent extends BaseQueueMessage {
  type: "MUSIC_PAUSED";
  data: {
    paused: boolean;
    requestedBy: string;
    currentPosition: number; // Position when paused
  };
}
```

### Queue Events

#### TRACK_ADDED

Track added to queue.

```typescript
interface TrackAddedEvent extends BaseQueueMessage {
  type: "TRACK_ADDED";
  data: {
    track: {
      id: string;
      title: string;
      artist: string;
      duration: number;
      thumbnail?: string;
      url: string;
      requestedBy: string;
    };
    position: number; // Position in queue
    totalQueueSize: number;
    addedAt: Date;
  };
}
```

#### QUEUE_CLEARED

Music queue was cleared.

```typescript
interface QueueClearedEvent extends BaseQueueMessage {
  type: "QUEUE_CLEARED";
  data: {
    clearedBy: string;
    trackCount: number; // How many tracks were removed
  };
}
```

---

## 🔔 Notification Events (Cross-Service)

### User Notifications

#### USER_NOTIFICATION

Send notification to specific user.

```typescript
interface UserNotificationEvent extends BaseQueueMessage {
  type: "USER_NOTIFICATION";
  data: {
    targetUserId: string;
    notification: {
      id: string;
      type: "SUCCESS" | "INFO" | "WARNING" | "ERROR";
      title: string;
      message: string;
      actionUrl?: string;
      actionText?: string;
      persistent: boolean; // Should it persist across sessions
      expiresAt?: Date;
    };
  };
}
```

#### BROADCAST_NOTIFICATION

Send notification to all connected users for a guild.

```typescript
interface BroadcastNotificationEvent extends BaseQueueMessage {
  type: "BROADCAST_NOTIFICATION";
  data: {
    targetGuildId?: string; // null = all guilds
    targetRoles?: string[]; // Only users with these roles
    notification: {
      type: "ANNOUNCEMENT" | "MAINTENANCE" | "UPDATE";
      title: string;
      message: string;
      priority: "LOW" | "NORMAL" | "HIGH";
      channels?: ("DASHBOARD" | "DISCORD")[];
    };
  };
}
```

---

## 📅 Scheduled Events

### Recurring Tasks

#### SCHEDULED_TASK

Execute scheduled task.

```typescript
interface ScheduledTaskEvent extends BaseQueueMessage {
  type: "SCHEDULED_TASK";
  data: {
    taskType: "CLEANUP" | "BACKUP" | "ANALYTICS" | "REMINDERS";
    taskData: unknown;
    schedule: {
      cron?: string; // Cron expression
      interval?: number; // Interval in milliseconds
      runOnce?: boolean; // One-time task
    };
    nextRun?: Date;
  };
}
```

#### CLEANUP_EXPIRED_CASES

Clean up expired moderation cases.

```typescript
interface CleanupExpiredCasesEvent extends BaseQueueMessage {
  type: "CLEANUP_EXPIRED_CASES";
  data: {
    guildId?: string; // Specific guild or all
    caseTypes: string[]; // Which case types to clean up
    expiredBefore: Date; // Clean up cases expired before this date
  };
}
```

---

## 🔄 Queue Processing Patterns

### Command Processing Flow

```typescript
// 1. API receives HTTP request
// 2. Validate request and permissions
// 3. Create command message
// 4. Publish to appropriate queue
// 5. Return job ID to client

const commandFlow = async (req: Request, res: Response) => {
  try {
    // Validate and prepare command
    const command: BanUserCommand = {
      id: generateId(),
      type: "BAN_USER",
      timestamp: new Date(),
      source: "api",
      guildId: req.params.guildId,
      userId: req.user.id,
      requestId: req.headers["x-request-id"],
      data: req.body,
    };

    // Publish to queue
    const job = await botCommandQueue.add(command.type, command, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 10,
      removeOnFail: 5,
    });

    res.json({ success: true, jobId: job.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

### Event Processing Flow

```typescript
// 1. Bot detects Discord event
// 2. Create event message
// 3. Publish to event queue
// 4. API consumes event
// 5. Update database and broadcast via WebSocket

const eventFlow = async (discordEvent: GuildMemberAddEvent) => {
  const event: MemberJoinedEvent = {
    id: generateId(),
    type: "MEMBER_JOINED",
    timestamp: new Date(),
    source: "bot",
    guildId: discordEvent.guild.id,
    data: {
      user: {
        id: discordEvent.user.id,
        username: discordEvent.user.username,
        discriminator: discordEvent.user.discriminator,
        avatar: discordEvent.user.avatar,
        bot: discordEvent.user.bot,
      },
      member: {
        joinedAt: discordEvent.joinedAt,
        roles: discordEvent.roles.cache.map((r) => r.id),
        nickname: discordEvent.nickname,
        pending: discordEvent.pending,
      },
    },
  };

  await discordEventQueue.add(event.type, event);
};
```

### Error Handling & Retries

```typescript
// Queue configuration with retry logic
const queueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 10,
    removeOnFail: 5,
  },
  settings: {
    stalledInterval: 30000, // Check for stalled jobs
    maxStalledCount: 1, // Max stalled retries
  },
};

// Job failure handling
queue.on("failed", (job, error) => {
  logger.error("Job failed", {
    jobId: job.id,
    jobType: job.name,
    error: error.message,
    attempts: job.opts.attempts,
    failedReason: job.failedReason,
  });

  // Send to dead letter queue if all retries exhausted
  if (job.attemptsMade >= job.opts.attempts) {
    deadLetterQueue.add("failed_job", {
      originalJob: job.data,
      error: error.message,
      failedAt: new Date(),
    });
  }
});
```

## 📚 Related Documentation

- [[01-architecture-overview]] - System overview
- [[02-service-breakdown]] - Service specifications
- [[06-api-design]] - API specifications
- [[03-technology-stack]] - Technology setup
