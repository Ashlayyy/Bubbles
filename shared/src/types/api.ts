// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Authentication types
export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  email?: string;
  guilds?: Guild[];
}

export interface Guild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  permissions: string;
  memberCount?: number;
  onlineCount?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: number;
}

// Dashboard types
export interface ServerStats {
  memberCount: number;
  onlineCount: number;
  channelCount: number;
  roleCount: number;
  botUptime: number;
  messageCount24h?: number;
  moderationCases24h?: number;
}

export interface ActivityFeedItem {
  id: string;
  type: 'member_join' | 'member_leave' | 'message_delete' | 'moderation' | 'music';
  timestamp: number;
  userId?: string;
  username?: string;
  description: string;
  details?: any;
}

// Moderation types
export interface ModerationCase {
  id: string;
  type: 'ban' | 'kick' | 'timeout' | 'warn' | 'unban';
  targetUserId: string;
  targetUsername: string;
  moderatorId: string;
  moderatorUsername: string;
  reason?: string;
  duration?: number;
  timestamp: number;
  active: boolean;
  guildId: string;
}

export interface ModerationActionRequest {
  type: 'ban' | 'kick' | 'timeout' | 'unban';
  userId: string;
  reason?: string;
  duration?: number; // for timeout in minutes
}

// Music types
export interface Track {
  title: string;
  artist: string;
  duration: number;
  url: string;
  thumbnail?: string;
  requestedBy: string;
}

export interface MusicState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTrack?: Track;
  queue: Track[];
  volume: number;
  position: number;
  duration: number;
}

export interface MusicActionRequest {
  action: 'play' | 'pause' | 'skip' | 'stop' | 'volume';
  query?: string; // for play
  volume?: number; // for volume (0-100)
}

// WebSocket event types
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: number;
  guildId?: string;
}

// Error types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ValidationError[];
} 