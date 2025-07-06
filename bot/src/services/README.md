# API Services Architecture

This directory contains the centralized API client and domain-specific services for the Discord bot. This architecture replaces scattered `fetch` calls throughout the codebase with a clean, typed, and maintainable solution.

## 🏗️ Architecture Overview

```
bot/src/services/
├── apiClient.ts          # Core HTTP client with auth, rate limiting, error handling
├── giveawayApiService.ts # Giveaway operations (create, list, enter, etc.)
├── levelingApiService.ts # Leveling operations (XP, levels, rewards, etc.)
├── pollApiService.ts     # Poll operations (create, vote, results, etc.)
├── reminderApiService.ts # Reminder operations (create, list, cancel, etc.)
├── musicApiService.ts    # Music operations (play, queue, controls, etc.)
├── economyApiService.ts  # Economy operations (balance, daily, shop, etc.)
└── index.ts             # Centralized exports and utilities
```

## 🚀 Key Benefits

| **Before (Raw Fetch)**      | **After (API Services)**   |
| --------------------------- | -------------------------- |
| 25+ lines of boilerplate    | 2 lines of clean code      |
| Manual auth headers         | Automatic authentication   |
| No rate limiting            | Built-in rate limiting     |
| Inconsistent error handling | Centralized error handling |
| No TypeScript types         | Full type safety           |
| Repeated code everywhere    | DRY principle              |

## 📚 Usage Examples

### Basic Import

```typescript
import { giveawayApiService, levelingApiService } from "../../services/index.js";
```

### Before vs After Comparison

#### ❌ Before (Raw Fetch)

```typescript
// 25+ lines of boilerplate code
const apiUrl = process.env.API_URL || "http://localhost:3001";
const response = await fetch(`${apiUrl}/api/giveaways/${guildId}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.API_TOKEN}`,
  },
  body: JSON.stringify(giveawayData),
});

if (!response.ok) {
  throw new Error(`API request failed: ${response.status}`);
}

const result = (await response.json()) as any;
if (!result.success) {
  return this.createAdminError("Error", result.error || "Failed to create giveaway");
}
```

#### ✅ After (API Service)

```typescript
// 2 clean lines
const result = await giveawayApiService.createGiveaway(guildId, giveawayData);
if (!result.success) return this.createAdminError("Error", result.error);
```

### Giveaway Service Example

```typescript
import { giveawayApiService } from "../../services/index.js";

// Create a giveaway
const result = await giveawayApiService.createGiveaway(guildId, {
  title: "Free Nitro",
  prize: "Discord Nitro Classic",
  winnerCount: 1,
  endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});

// List giveaways
const giveaways = await giveawayApiService.listGiveaways(guildId, {
  page: 1,
  limit: 10,
  status: "active",
});

// Enter a giveaway
const entry = await giveawayApiService.enterGiveaway(guildId, giveawayId, {
  userId: user.id,
  username: user.username,
});
```

### Economy Service Example

```typescript
import { economyApiService } from "../../services/index.js";

// Claim daily reward
const daily = await economyApiService.claimDaily(guildId, {
  userId: user.id,
  username: user.username,
});

// Get user balance
const userData = await economyApiService.getUserData(guildId, userId);

// Transfer money
const transfer = await economyApiService.transferMoney(guildId, {
  fromUserId: senderId,
  toUserId: recipientId,
  amount: 1000,
  reason: "Gift",
});
```

### Leveling Service Example

```typescript
import { levelingApiService } from "../../services/index.js";

// Get leaderboard
const leaderboard = await levelingApiService.getLeaderboard(guildId, 1, 10);

// Update user XP
const user = await levelingApiService.updateUserXp(guildId, userId, {
  amount: 50,
  reason: "Message sent",
});

// Create level reward
const reward = await levelingApiService.createReward(guildId, {
  level: 10,
  roleId: "123456789",
  removeOthers: false,
});
```

## 🔧 Error Handling

All API services return a consistent response format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

### Standard Error Handling Pattern

```typescript
const result = await someApiService.someMethod(params);

if (!result.success) {
  return this.createGeneralError("Operation Failed", result.error || "Unknown error occurred");
}

const data = result.data!; // TypeScript knows this is safe now
// Continue with success logic...
```

## 🛠️ Configuration

The API client automatically handles:

- **Authentication**: Uses `API_TOKEN` environment variable
- **Base URL**: Uses `API_URL` environment variable (defaults to `http://localhost:3001`)
- **Rate Limiting**: Built-in throttling and retry logic
- **Error Handling**: Consistent error responses across all services
- **Logging**: Automatic request/response logging

### Environment Variables Required

```env
API_URL=http://localhost:3001
API_TOKEN=your_api_token_here
```

## 🔍 Utility Functions

```typescript
import { areAllApiServicesConfigured, getApiServicesStatus } from "../../services/index.js";

// Check if all services are configured
const allConfigured = areAllApiServicesConfigured();

// Get detailed status of each service
const status = getApiServicesStatus();
console.log(status);
// {
//   core: true,
//   giveaway: true,
//   leveling: true,
//   poll: true,
//   reminder: true,
//   music: true,
//   economy: true
// }
```

## 📝 Migration Guide

### 1. Replace Raw Fetch Calls

Find patterns like:

```typescript
const response = await fetch(`${process.env.API_URL}/api/...`, { ... });
```

Replace with:

```typescript
const result = await appropriateApiService.methodName(...);
```

### 2. Update Error Handling

Replace manual error checks with the standardized pattern:

```typescript
if (!result.success) {
  return this.createGeneralError("Error", result.error);
}
```

### 3. Use TypeScript Types

Import and use the provided TypeScript interfaces:

```typescript
import type { GiveawayData, CreateGiveawayRequest } from "../../services/index.js";
```

## 🎯 Best Practices

1. **Always check `isConfigured()`** before making API calls in critical paths
2. **Use the typed interfaces** for better development experience
3. **Handle errors consistently** using the standard pattern
4. **Import from the index file** for consistency
5. **Prefer specific error messages** over generic ones

## 🔄 Future Enhancements

- Add request/response interceptors for metrics
- Implement caching for frequently accessed data
- Add request deduplication for identical concurrent requests
- Create mock services for testing

---

This architecture provides a solid foundation for scalable, maintainable API interactions throughout the Discord bot.
