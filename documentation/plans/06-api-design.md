# API Design & Specifications

## 🎯 API Overview

**Base URL**: `http://localhost:3001/api/v1`  
**Authentication**: JWT Bearer tokens  
**Content Type**: `application/json`  
**Rate Limiting**: 100 requests per 15 minutes per IP

---

## 🔐 Authentication Endpoints

### POST /auth/login

Discord OAuth login initiation.

**Request:**

```typescript
// Redirects to Discord OAuth
// No body required
```

**Response:**

```typescript
{
  "success": true,
  "redirectUrl": "https://discord.com/api/oauth2/authorize?..."
}
```

### POST /auth/callback

Discord OAuth callback handler.

**Request:**

```typescript
{
  "code": "string",      // OAuth code from Discord
  "state": "string"      // CSRF protection token
}
```

**Response:**

```typescript
{
  "success": true,
  "user": {
    "id": "123456789",
    "username": "username",
    "discriminator": "1234",
    "avatar": "avatar_hash",
    "email": "user@example.com"
  },
  "token": "jwt_token_here",
  "expiresIn": 604800    // 7 days in seconds
}
```

### POST /auth/logout

Logout and invalidate token.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:**

```typescript
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /auth/me

Get current user information.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:**

```typescript
{
  "success": true,
  "user": {
    "id": "123456789",
    "username": "username",
    "discriminator": "1234",
    "avatar": "avatar_hash",
    "email": "user@example.com",
    "guilds": ["guild_id_1", "guild_id_2"]
  }
}
```

---

## 🏠 Server Management Endpoints

### GET /servers

Get user's accessible servers.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:**

```typescript
{
  "success": true,
  "servers": [
    {
      "id": "guild_id",
      "name": "Server Name",
      "icon": "icon_hash",
      "owner": false,
      "permissions": ["ADMINISTRATOR", "MANAGE_GUILD"],
      "botPresent": true,
      "memberCount": 1250
    }
  ]
}
```

### GET /servers/:id

Get specific server details.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:**

```typescript
{
  "success": true,
  "server": {
    "id": "guild_id",
    "name": "Server Name",
    "icon": "icon_hash",
    "description": "Server description",
    "memberCount": 1250,
    "onlineCount": 892,
    "channels": [
      {
        "id": "channel_id",
        "name": "general",
        "type": "GUILD_TEXT",
        "position": 0
      }
    ],
    "roles": [
      {
        "id": "role_id",
        "name": "@everyone",
        "color": 0,
        "position": 0,
        "permissions": "permissions_string"
      }
    ]
  }
}
```

### GET /servers/:id/stats

Get server analytics and statistics.

**Query Parameters:**

```
?period=7d&metrics=members,messages,activity
```

**Response:**

```typescript
{
  "success": true,
  "stats": {
    "period": "7d",
    "memberGrowth": {
      "current": 1250,
      "previous": 1180,
      "change": 70,
      "changePercent": 5.93
    },
    "messageStats": {
      "totalMessages": 15420,
      "averagePerDay": 2203,
      "topChannels": [
        {
          "channelId": "channel_id",
          "channelName": "general",
          "messageCount": 3450
        }
      ]
    },
    "activityData": [
      {
        "date": "2024-01-15",
        "activeMembers": 234,
        "messages": 1250,
        "joins": 12,
        "leaves": 5
      }
    ]
  }
}
```

---

## ⚖️ Moderation Endpoints

### GET /servers/:id/cases

Get moderation cases with filtering and pagination.

**Query Parameters:**

```
?page=1&limit=50&type=BAN&status=ACTIVE&userId=123456789
```

**Response:**

```typescript
{
  "success": true,
  "cases": [
    {
      "id": "case_id",
      "caseNumber": 123,
      "type": "BAN",
      "userId": "123456789",
      "username": "username",
      "moderatorId": "moderator_id",
      "moderatorName": "ModeratorName",
      "reason": "Violation of server rules",
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:30:00Z",
      "expiresAt": null,
      "evidence": ["message_id_1", "message_id_2"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 245,
    "totalPages": 5
  }
}
```

### GET /servers/:id/cases/:caseId

Get specific moderation case details.

**Response:**

```typescript
{
  "success": true,
  "case": {
    "id": "case_id",
    "caseNumber": 123,
    "type": "BAN",
    "userId": "123456789",
    "username": "username",
    "discriminator": "1234",
    "avatar": "avatar_hash",
    "moderatorId": "moderator_id",
    "moderatorName": "ModeratorName",
    "reason": "Violation of server rules",
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z",
    "expiresAt": null,
    "evidence": [
      {
        "type": "MESSAGE",
        "messageId": "message_id",
        "content": "Offensive message content",
        "channelId": "channel_id",
        "channelName": "general",
        "timestamp": "2024-01-15T10:25:00Z"
      }
    ],
    "notes": [
      {
        "id": "note_id",
        "content": "User has been warned before",
        "authorId": "moderator_id",
        "authorName": "ModeratorName",
        "createdAt": "2024-01-15T10:28:00Z"
      }
    ]
  }
}
```

### POST /servers/:id/cases

Create new moderation case.

**Request:**

```typescript
{
  "type": "BAN",
  "userId": "123456789",
  "reason": "Violation of server rules - spam",
  "duration": null,           // null for permanent, number for temporary (hours)
  "evidence": ["message_id_1", "message_id_2"],
  "notes": "User has been warned multiple times",
  "deleteMessages": true      // For bans - delete recent messages
}
```

**Response:**

```typescript
{
  "success": true,
  "case": {
    "id": "case_id",
    "caseNumber": 124,
    "type": "BAN",
    "status": "PENDING"
  },
  "jobId": "queue_job_id"     // For tracking execution
}
```

### POST /servers/:id/moderation/ban

Ban user from server.

**Request:**

```typescript
{
  "userId": "123456789",
  "reason": "Violation of server rules",
  "deleteMessageDays": 1,     // 0-7 days of messages to delete
  "createCase": true          // Whether to create moderation case
}
```

**Response:**

```typescript
{
  "success": true,
  "message": "User ban initiated",
  "jobId": "queue_job_id"
}
```

### POST /servers/:id/moderation/kick

Kick user from server.

**Request:**

```typescript
{
  "userId": "123456789",
  "reason": "Disruptive behavior",
  "createCase": true
}
```

### POST /servers/:id/moderation/timeout

Timeout user (Discord timeout).

**Request:**

```typescript
{
  "userId": "123456789",
  "duration": 3600,           // Duration in seconds (max 28 days)
  "reason": "Spamming messages",
  "createCase": true
}
```

### POST /servers/:id/moderation/unban

Unban user from server.

**Request:**

```typescript
{
  "userId": "123456789",
  "reason": "Appeal approved",
  "updateCase": true          // Update existing case status
}
```

---

## 🎵 Music Control Endpoints

### GET /servers/:id/music/status

Get current music player status.

**Response:**

```typescript
{
  "success": true,
  "status": {
    "playing": true,
    "paused": false,
    "volume": 50,
    "repeat": "OFF",          // OFF, TRACK, QUEUE
    "shuffle": false,
    "currentTrack": {
      "title": "Song Title",
      "artist": "Artist Name",
      "duration": 180000,     // Duration in milliseconds
      "position": 45000,      // Current position in milliseconds
      "thumbnail": "thumbnail_url",
      "requestedBy": {
        "id": "user_id",
        "username": "username"
      }
    },
    "voiceChannel": {
      "id": "voice_channel_id",
      "name": "Music"
    }
  }
}
```

### GET /servers/:id/music/queue

Get current music queue.

**Response:**

```typescript
{
  "success": true,
  "queue": [
    {
      "id": "track_id",
      "title": "Song Title",
      "artist": "Artist Name",
      "duration": 180000,
      "thumbnail": "thumbnail_url",
      "requestedBy": {
        "id": "user_id",
        "username": "username"
      },
      "position": 1
    }
  ],
  "totalDuration": 1800000,   // Total queue duration in milliseconds
  "trackCount": 10
}
```

### POST /servers/:id/music/play

Add track to queue or play immediately.

**Request:**

```typescript
{
  "query": "song title or URL",
  "playNow": false,           // Skip queue and play immediately
  "requestedBy": "user_id"
}
```

**Response:**

```typescript
{
  "success": true,
  "track": {
    "id": "track_id",
    "title": "Song Title",
    "artist": "Artist Name",
    "duration": 180000,
    "addedToQueue": true,
    "position": 5
  },
  "jobId": "queue_job_id"
}
```

### POST /servers/:id/music/skip

Skip current track.

**Request:**

```typescript
{
  "requestedBy": "user_id"
}
```

### POST /servers/:id/music/pause

Pause/resume playback.

**Request:**

```typescript
{
  "paused": true,             // true to pause, false to resume
  "requestedBy": "user_id"
}
```

### POST /servers/:id/music/volume

Set playback volume.

**Request:**

```typescript
{
  "volume": 75,               // 0-100
  "requestedBy": "user_id"
}
```

### POST /servers/:id/music/repeat

Set repeat mode.

**Request:**

```typescript
{
  "mode": "TRACK",            // OFF, TRACK, QUEUE
  "requestedBy": "user_id"
}
```

### POST /servers/:id/music/shuffle

Toggle shuffle mode.

**Request:**

```typescript
{
  "enabled": true,
  "requestedBy": "user_id"
}
```

### DELETE /servers/:id/music/queue/:trackId

Remove track from queue.

**Response:**

```typescript
{
  "success": true,
  "message": "Track removed from queue"
}
```

---

## 📞 Appeals Endpoints

### GET /servers/:id/appeals

Get appeals list with filtering.

**Query Parameters:**

```
?status=PENDING&page=1&limit=20
```

**Response:**

```typescript
{
  "success": true,
  "appeals": [
    {
      "id": "appeal_id",
      "caseId": "case_id",
      "caseNumber": 123,
      "userId": "123456789",
      "username": "username",
      "type": "BAN",
      "status": "PENDING",
      "reason": "I believe this ban was unfair...",
      "evidence": "Evidence text or URLs",
      "submittedAt": "2024-01-15T10:30:00Z",
      "reviewedBy": null,
      "reviewedAt": null,
      "response": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### POST /servers/:id/appeals

Submit new appeal.

**Request:**

```typescript
{
  "caseId": "case_id",
  "reason": "I believe this punishment was unfair because...",
  "evidence": "Screenshots or additional context",
  "contactEmail": "user@example.com"
}
```

**Response:**

```typescript
{
  "success": true,
  "appeal": {
    "id": "appeal_id",
    "status": "PENDING",
    "submittedAt": "2024-01-15T10:30:00Z"
  }
}
```

### PUT /servers/:id/appeals/:appealId

Update appeal status (moderator only).

**Request:**

```typescript
{
  "status": "APPROVED",       // APPROVED, DENIED
  "response": "Appeal has been reviewed and approved...",
  "action": "UNBAN"           // UNBAN, REDUCE_SENTENCE, NO_ACTION
}
```

---

## ⚙️ Configuration Endpoints

### GET /servers/:id/config

Get server configuration.

**Response:**

```typescript
{
  "success": true,
  "config": {
    "moderation": {
      "autoModEnabled": true,
      "logChannelId": "log_channel_id",
      "muteRoleId": "mute_role_id",
      "escalationEnabled": true,
      "appealChannelId": "appeal_channel_id"
    },
    "music": {
      "enabled": true,
      "djRoleId": "dj_role_id",
      "maxQueueSize": 100,
      "maxTrackDuration": 600000,
      "allowNSFW": false
    },
    "logging": {
      "enabled": true,
      "channels": {
        "moderation": "mod_log_channel_id",
        "music": "music_log_channel_id",
        "member": "member_log_channel_id"
      }
    },
    "permissions": {
      "adminRoles": ["admin_role_id"],
      "moderatorRoles": ["mod_role_id"],
      "djRoles": ["dj_role_id"]
    }
  }
}
```

### PUT /servers/:id/config

Update server configuration.

**Request:**

```typescript
{
  "moderation": {
    "autoModEnabled": false,
    "logChannelId": "new_log_channel_id"
  },
  "music": {
    "maxQueueSize": 50
  }
}
```

---

## 📊 Dashboard Endpoints

### GET /servers/:id/dashboard

Get dashboard overview data.

**Response:**

```typescript
{
  "success": true,
  "dashboard": {
    "stats": {
      "memberCount": 1250,
      "onlineCount": 892,
      "botUptime": 3600000,
      "totalCases": 245,
      "activeCases": 12,
      "queuedTracks": 5
    },
    "recentActivity": [
      {
        "type": "MEMBER_JOIN",
        "userId": "user_id",
        "username": "username",
        "timestamp": "2024-01-15T10:30:00Z"
      },
      {
        "type": "CASE_CREATED",
        "caseId": "case_id",
        "caseNumber": 124,
        "type": "BAN",
        "timestamp": "2024-01-15T10:25:00Z"
      }
    ],
    "musicStatus": {
      "playing": true,
      "currentTrack": "Song Title - Artist Name"
    }
  }
}
```

---

## 🚨 Error Responses

All endpoints may return these error responses:

### 400 Bad Request

```typescript
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": [
    {
      "field": "userId",
      "message": "User ID is required"
    }
  ]
}
```

### 401 Unauthorized

```typescript
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden

```typescript
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Insufficient permissions for this action"
}
```

### 404 Not Found

```typescript
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Server not found or bot not present"
}
```

### 429 Too Many Requests

```typescript
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Too many requests",
  "retryAfter": 900000        // Milliseconds until retry allowed
}
```

### 500 Internal Server Error

```typescript
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "requestId": "request_id"   // For debugging
}
```

---

## 🔄 Queue Job Tracking

Many endpoints return a `jobId` for tracking asynchronous operations:

### GET /jobs/:jobId

Track job status.

**Response:**

```typescript
{
  "success": true,
  "job": {
    "id": "job_id",
    "status": "COMPLETED",    // PENDING, PROCESSING, COMPLETED, FAILED
    "progress": 100,          // 0-100
    "result": {
      "success": true,
      "message": "User banned successfully"
    },
    "error": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:15Z"
  }
}
```

## 📚 Related Documentation

- [[01-architecture-overview]] - System overview
- [[02-service-breakdown]] - Service specifications
- [[07-message-queue-patterns]] - Queue event patterns
- [[08-development-workflow]] - Development process
