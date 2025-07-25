# Discord Event Logging vs Moderation Logging

## 🔄 **System Separation**

Your logging system is now properly separated into two distinct systems:

### 1. **Discord Event Logging** (`DiscordEventLog`)
**Purpose**: Capture ALL Discord events for audit trails and analytics
- `MESSAGE_CREATE`, `MESSAGE_DELETE`, `MESSAGE_UPDATE`
- `MEMBER_JOIN`, `MEMBER_LEAVE`, `MEMBER_UPDATE`
- `CHANNEL_CREATE`, `ROLE_UPDATE`, `REACTION_ADD`
- All other Discord Gateway events

### 2. **Moderation Action Logging** (`ModerationActionLog`)
**Purpose**: Track ONLY moderation actions taken by staff/automod
- `WARN`, `KICK`, `BAN`, `TIMEOUT`, `UNBAN`
- Linked to `ModerationCase` records
- Staff accountability and audit trails

## 💰 **Retention & Pricing System**

### **Retention Tiers** (`DiscordEventRetention`)

| Tier | Retention | Storage Limit | Cost |
|------|-----------|---------------|------|
| **FREE** | 3 days | 10,000 events | Free |
| **PREMIUM** | 14 days | 100,000 events | $X/month |
| **ENTERPRISE** | 90 days | Unlimited | $Y/month |

### **How Retention Works**
```typescript
interface RetentionPolicy {
  guildId: string;
  currentTier: "FREE" | "PREMIUM" | "ENTERPRISE";
  
  // Auto-calculated expiration
  expiresAt: Date; // createdAt + retention period
  
  // Event filtering
  enabledEventTypes: string[]; // Empty = all enabled
  disabledEventTypes: string[]; // Specific exclusions
}
```

### **Cleanup Process**
- **Automatic cleanup job** runs daily
- Deletes events where `expiresAt < now()`
- Respects storage limits (FIFO when limit exceeded)
- Efficient with compound indexes

## 🔧 **Migration Strategy**

### **Current Issue**
Your `ModerationLog` contains both:
- ✅ Actual moderation actions (`MOD_WARN`, `MOD_BAN`)
- ❌ High-volume Discord events (`MESSAGE_CREATE`, `MESSAGE_DELETE`)

### **Migration Steps**
1. **Create new tables** (✅ Done)
2. **Update LogManager** to route events properly:
   ```typescript
   // Discord events → DiscordEventLog
   logManager.logDiscordEvent(guildId, "MESSAGE_CREATE", data);
   
   // Moderation actions → ModerationActionLog
   logManager.logModerationAction(guildId, "WARN", data);
   ```
3. **Migrate existing data** (if needed)
4. **Remove old ModerationLog** usage

## 🏗️ **Implementation Changes Needed**

### **1. Update LogManager.ts**
```typescript
class LogManager {
  // For Discord events (with retention)
  async logDiscordEvent(guildId: string, eventType: string, data: DiscordEventData) {
    const retention = await this.getRetentionPolicy(guildId);
    const expiresAt = this.calculateExpiration(retention, eventType);
    
    await prisma.discordEventLog.create({
      data: {
        guildId,
        eventType,
        ...data,
        retentionTier: retention.currentTier,
        expiresAt,
      }
    });
  }
  
  // For moderation actions (permanent)
  async logModerationAction(guildId: string, actionType: string, data: ModerationActionData) {
    await prisma.moderationActionLog.create({
      data: {
        guildId,
        actionType,
        ...data,
      }
    });
  }
}
```

### **2. Event Routing Logic**
```typescript
const DISCORD_EVENTS = [
  "MESSAGE_CREATE", "MESSAGE_DELETE", "MESSAGE_UPDATE",
  "MEMBER_JOIN", "MEMBER_LEAVE", "MEMBER_UPDATE",
  "CHANNEL_CREATE", "CHANNEL_DELETE", "ROLE_UPDATE",
  // ... all Discord Gateway events
];

const MODERATION_ACTIONS = [
  "WARN", "KICK", "BAN", "UNBAN", "TIMEOUT", "UNTIMEOUT",
  "NOTE", "CASE_CREATE", "CASE_UPDATE"
];

// Route to appropriate logging system
if (DISCORD_EVENTS.includes(eventType)) {
  await logManager.logDiscordEvent(guildId, eventType, data);
} else if (MODERATION_ACTIONS.includes(eventType)) {
  await logManager.logModerationAction(guildId, eventType, data);
}
```

## 📊 **UserInfractions Explained**

The `UserInfractions` model is a **point-based escalation system**:

### **Purpose**
- **Automatic escalation**: More violations = harsher punishments
- **Point decay**: Points reduce over time (configurable)
- **Strike system**: Major infractions = permanent strikes
- **Temporary restrictions**: Time-based punishments

### **How It Works**
```typescript
interface UserInfractions {
  totalPoints: number;    // Accumulated violation points
  strikes: number;        // Major infractions (permanent)
  lastIncident: Date;     // When last violation occurred
  pointDecay: {           // Automatic point reduction
    rate: number;         // Points removed per day
    minPoints: number;    // Never go below this
  };
  restrictions: [         // Active temporary punishments
    {
      type: "MUTE" | "CHANNEL_BAN" | "SLOW_MODE";
      channelId?: string;
      expiresAt: Date;
    }
  ];
}
```

### **Example Flow**
1. **Spam warning**: +5 points
2. **Reaches 15 points**: Auto-timeout 1 hour
3. **Reaches 30 points**: Auto-timeout 24 hours
4. **Reaches 50 points**: Auto-ban + 1 strike
5. **Points decay**: -1 point per day after 7 days

## 🎯 **Next Steps**

1. **Test the new schema**: `npx prisma format && npx prisma validate`
2. **Update LogManager** to use new routing logic
3. **Create retention policy setup** in your bot admin commands
4. **Add cleanup job** for expired events
5. **Build premium features** around extended retention

This separation gives you:
- ✅ **Clean moderation audit trails**
- ✅ **Monetizable storage features**
- ✅ **Better performance** (separate high/low volume data)
- ✅ **Compliance ready** (data retention policies)