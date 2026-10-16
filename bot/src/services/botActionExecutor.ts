import type { AutoModerationRule, Guild, GuildMember, TextBasedChannel, VoiceBasedChannel } from "discord.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";
import type { MusicStatusSnapshot } from "./musicService.js";

export interface BotAction {
  command: string;
  data: Record<string, unknown>;
  guildId?: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

const MUSIC_UNAVAILABLE = "Music player is not ready yet. Wait for the bot to finish starting.";

export function normalizeIncomingAction(message: {
  type?: string;
  event?: string;
  data?: unknown;
  guildId?: string;
}): BotAction | null {
  const raw = message.data;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.command === "string" && obj.command.length > 0) {
    const inner =
      obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
        ? (obj.data as Record<string, unknown>)
        : obj;
    const guildId = String(inner.guildId ?? obj.guildId ?? message.guildId ?? "");
    return {
      command: obj.command,
      data: { ...inner, guildId: inner.guildId ?? obj.guildId ?? message.guildId },
      guildId,
    };
  }

  const type =
    (typeof obj.type === "string" && obj.type !== "CUSTOM_COMMAND" ? obj.type : undefined) ??
    (typeof message.event === "string" ? message.event : undefined);
  if (!type || type === "UNKNOWN" || type === "EXECUTE_COMMAND") {
    return null;
  }

  const guildId = String(obj.guildId ?? message.guildId ?? "");
  return {
    command: type,
    data: { ...obj, guildId: obj.guildId ?? message.guildId },
    guildId,
  };
}

export function normalizeQueueJob(raw: Record<string, unknown>, jobId: string): BotAction {
  const nested =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : {};
  const command =
    (typeof raw.command === "string" && raw.command) ||
    (raw.type === "CUSTOM_COMMAND" && typeof nested.command === "string" && nested.command) ||
    (typeof raw.type === "string" && raw.type !== "CUSTOM_COMMAND" && raw.type) ||
    (typeof nested.type === "string" && nested.type) ||
    "UNKNOWN";

  const mapped = command === "REMINDER" ? "SEND_MESSAGE" : command;
  const guildId = String(nested.guildId ?? raw.guildId ?? "");

  return {
    command: mapped,
    guildId,
    data: {
      ...raw,
      ...nested,
      id: raw.id ?? jobId,
      timestamp: raw.timestamp ?? Date.now(),
      guildId,
      channelId: nested.channelId ?? raw.channelId,
      content: nested.content ?? raw.content,
      embeds: nested.embeds ?? raw.embeds,
      targetUserId: nested.targetUserId ?? nested.userId ?? raw.targetUserId ?? raw.userId,
      userId: nested.userId ?? nested.targetUserId ?? raw.userId ?? raw.targetUserId,
      reason: nested.reason ?? raw.reason,
      duration: nested.duration ?? raw.duration,
      messageId: nested.messageId ?? raw.messageId,
      roleId: nested.roleId ?? raw.roleId,
      roleIds: nested.roleIds ?? raw.roleIds,
    },
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function executeBotAction(client: Client, action: BotAction): Promise<ActionResult> {
  const command = action.command.toUpperCase();
  const data = action.data;
  const guildId = asString(data.guildId) ?? action.guildId;

  try {
    if (isMusicCommand(command)) {
      return await executeMusic(client, command, data, guildId);
    }

    switch (command) {
      case "SEND_MESSAGE":
      case "SCHEDULED_MESSAGE":
        return await sendMessage(client, data);
      case "EDIT_MESSAGE":
        return await editMessage(client, data);
      case "DELETE_MESSAGE":
      case "BULK_DELETE_MESSAGES":
        return await deleteMessage(client, data);
      case "BAN_USER":
      case "QUICK_BAN":
      case "BULK_BAN":
        return await banUser(client, data, guildId);
      case "UNBAN_USER":
      case "SCHEDULED_UNBAN":
        return await unbanUser(client, data, guildId);
      case "KICK_USER":
      case "INSTANT_KICK":
      case "BULK_KICK":
        return await kickUser(client, data, guildId);
      case "TIMEOUT_USER":
      case "IMMEDIATE_TIMEOUT":
        return await timeoutUser(client, data, guildId);
      case "LEAVE_GUILD":
        return await leaveGuild(client, guildId);
      case "UPDATE_CONFIG":
      case "GUILD_CONFIG_UPDATE":
      case "SETTINGS_SYNC":
        return await updateConfig(data, guildId);
      case "ROLE_ASSIGNMENT":
      case "REACTION_ROLE_ADD":
      case "MASS_ROLE_UPDATE":
        return await assignRole(client, data, guildId);
      case "TIMED_ROLE_REMOVE":
        return await removeRole(client, data, guildId);
      case "GET_MEMBER_COUNT":
      case "GET_ONLINE_MEMBERS":
      case "GET_VOICE_STATUS":
        return await getGuildPresence(client, guildId);
      case "GET_AUTOMOD_RULES":
        return await getAutoModRules(client, guildId);
      case "TOGGLE_AUTOMOD_RULE":
      case "UPDATE_AUTOMOD_RULE":
        return await toggleAutoModRule(client, data, guildId);
      default:
        logger.warn(`Unknown bot command: ${command}`);
        return { success: false, error: `Unknown bot command: ${command}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to execute ${command}:`, error);
    return { success: false, error: message };
  }
}

async function sendMessage(client: Client, data: Record<string, unknown>): Promise<ActionResult> {
  const channelId = asString(data.channelId);
  if (!channelId) {
    return { success: false, error: "channelId is required" };
  }
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("send" in channel)) {
    return { success: false, error: "Channel is not a text channel" };
  }
  const sent = await (channel as TextBasedChannel & { send: Function }).send({
    content: asString(data.content),
    embeds: Array.isArray(data.embeds) ? data.embeds : undefined,
    components: Array.isArray(data.components) ? data.components : undefined,
  });
  return { success: true, data: { messageId: sent.id, channelId } };
}

async function editMessage(client: Client, data: Record<string, unknown>): Promise<ActionResult> {
  const channelId = asString(data.channelId);
  const messageId = asString(data.messageId);
  if (!channelId || !messageId) {
    return { success: false, error: "channelId and messageId are required" };
  }
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    return { success: false, error: "Channel is not a text channel" };
  }
  const message = await channel.messages.fetch(messageId);
  await message.edit({
    content: asString(data.content),
    embeds: Array.isArray(data.embeds) ? (data.embeds as never) : undefined,
  });
  return { success: true, data: { messageId, channelId } };
}

async function deleteMessage(client: Client, data: Record<string, unknown>): Promise<ActionResult> {
  const channelId = asString(data.channelId);
  const messageId = asString(data.messageId);
  if (!channelId || !messageId) {
    return { success: false, error: "channelId and messageId are required" };
  }
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    return { success: false, error: "Channel is not a text channel" };
  }
  const message = await channel.messages.fetch(messageId);
  await message.delete();
  return { success: true, data: { messageId, channelId } };
}

async function fetchGuild(client: Client, guildId?: string): Promise<Guild> {
  if (!guildId) {
    throw new Error("guildId is required");
  }
  return client.guilds.fetch(guildId);
}

function targetUserId(data: Record<string, unknown>): string | undefined {
  return asString(data.targetUserId) ?? asString(data.userId);
}

async function banUser(client: Client, data: Record<string, unknown>, guildId?: string): Promise<ActionResult> {
  const userId = targetUserId(data);
  if (!userId) {
    return { success: false, error: "userId is required" };
  }
  const guild = await fetchGuild(client, guildId);
  await guild.members.ban(userId, {
    reason: asString(data.reason) ?? "No reason provided",
    deleteMessageSeconds: (asNumber(data.deleteMessageDays) ?? 0) * 24 * 60 * 60,
  });
  return { success: true, data: { userId, guildId } };
}

async function unbanUser(client: Client, data: Record<string, unknown>, guildId?: string): Promise<ActionResult> {
  const userId = targetUserId(data);
  if (!userId) {
    return { success: false, error: "userId is required" };
  }
  const guild = await fetchGuild(client, guildId);
  await guild.members.unban(userId, asString(data.reason) ?? "No reason provided");
  return { success: true, data: { userId, guildId } };
}

async function kickUser(client: Client, data: Record<string, unknown>, guildId?: string): Promise<ActionResult> {
  const userId = targetUserId(data);
  if (!userId) {
    return { success: false, error: "userId is required" };
  }
  const guild = await fetchGuild(client, guildId);
  const member = await guild.members.fetch(userId);
  await member.kick(asString(data.reason) ?? "No reason provided");
  return { success: true, data: { userId, guildId } };
}

async function timeoutUser(client: Client, data: Record<string, unknown>, guildId?: string): Promise<ActionResult> {
  const userId = targetUserId(data);
  if (!userId) {
    return { success: false, error: "userId is required" };
  }
  const duration = asNumber(data.duration) ?? 300;
  const maxSeconds = 28 * 24 * 60 * 60;
  const durationMs = duration <= maxSeconds ? duration * 1000 : duration;
  const guild = await fetchGuild(client, guildId);
  const member = await guild.members.fetch(userId);
  await member.timeout(durationMs, asString(data.reason) ?? "No reason provided");
  return { success: true, data: { userId, guildId, durationMs } };
}

async function leaveGuild(client: Client, guildId?: string): Promise<ActionResult> {
  const guild = await fetchGuild(client, guildId);
  await guild.leave();
  return { success: true, data: { guildId } };
}

async function updateConfig(data: Record<string, unknown>, guildId?: string): Promise<ActionResult> {
  if (!guildId) {
    return { success: false, error: "guildId is required" };
  }
  const { updateGuildConfig } = await import("../database/GuildConfig.js");
  const configKey = asString(data.configKey);
  if (configKey) {
    await updateGuildConfig(guildId, { [configKey]: data.configValue } as never);
    return { success: true, data: { guildId, configKey } };
  }
  const updates = (data.updates && typeof data.updates === "object" ? data.updates : data) as Record<string, unknown>;
  const { id: _id, guildId: _gid, command: _cmd, timestamp: _ts, type: _type, ...rest } = updates;
  await updateGuildConfig(guildId, rest as never);
  return { success: true, data: { guildId } };
}

async function assignRole(client: Client, data: Record<string, unknown>, guildId?: string): Promise<ActionResult> {
  const userId = targetUserId(data);
  const roleIds = (Array.isArray(data.roleIds) ? data.roleIds : [data.roleId]).filter(
    (id): id is string => typeof id === "string"
  );
  if (!userId || roleIds.length === 0) {
    return { success: false, error: "userId and roleId(s) are required" };
  }
  const guild = await fetchGuild(client, guildId);
  const member = await guild.members.fetch(userId);
  await member.roles.add(roleIds, asString(data.reason) ?? "Dashboard role assignment");
  return { success: true, data: { userId, roleIds, guildId } };
}

async function removeRole(client: Client, data: Record<string, unknown>, guildId?: string): Promise<ActionResult> {
  const userId = targetUserId(data);
  const roleId = asString(data.roleId);
  if (!userId || !roleId) {
    return { success: false, error: "userId and roleId are required" };
  }
  const guild = await fetchGuild(client, guildId);
  const member = await guild.members.fetch(userId);
  await member.roles.remove(roleId, asString(data.reason) ?? "Dashboard role removal");
  return { success: true, data: { userId, roleId, guildId } };
}

async function getGuildPresence(client: Client, guildId?: string): Promise<ActionResult> {
  const guild = await fetchGuild(client, guildId);
  await guild.members.fetch().catch(() => undefined);
  const online = guild.members.cache.filter((member: GuildMember) => member.presence?.status && member.presence.status !== "offline").size;
  const voiceChannels = guild.channels.cache
    .filter((channel): channel is VoiceBasedChannel => channel.isVoiceBased())
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      userLimit: channel.userLimit,
      memberCount: channel.members.filter((member) => !member.user.bot).size,
      members: channel.members
        .filter((member) => !member.user.bot)
        .map((member) => ({
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          avatar: member.user.displayAvatarURL(),
        })),
    }));
  return {
    success: true,
    data: {
      guildId,
      memberCount: guild.memberCount,
      onlineMembers: online,
      channelCount: guild.channels.cache.size,
      roleCount: guild.roles.cache.size,
      voiceChannels,
      usersInVoice: voiceChannels.reduce((sum, channel) => sum + channel.memberCount, 0),
    },
  };
}

function isMusicCommand(command: string): boolean {
  return (
    command === "PLAY_MUSIC" ||
    command === "PAUSE_MUSIC" ||
    command === "RESUME_MUSIC" ||
    command === "SKIP_MUSIC" ||
    command === "STOP_MUSIC" ||
    command === "SET_VOLUME" ||
    command === "SET_REPEAT" ||
    command === "SHUFFLE_QUEUE" ||
    command === "CLEAR_QUEUE" ||
    command === "GET_NOW_PLAYING" ||
    command === "GET_QUEUE_STATUS"
  );
}

async function executeMusic(
  client: Client,
  command: string,
  data: Record<string, unknown>,
  guildId?: string
): Promise<ActionResult> {
  const music = client.musicService;
  if (!music?.isReady) {
    return { success: false, error: MUSIC_UNAVAILABLE };
  }
  if (!guildId) {
    return { success: false, error: "guildId is required" };
  }

  let status: MusicStatusSnapshot;
  switch (command) {
    case "PLAY_MUSIC": {
      const query = asString(data.query) ?? asString(data.url) ?? asString(data.title);
      if (!query) {
        return { success: false, error: "query is required" };
      }
      status = await music.play({
        guildId,
        query,
        voiceChannelId: asString(data.voiceChannelId) ?? asString(data.channelId),
        userId: asString(data.userId) ?? asString(data.requestedBy),
        textChannelId: asString(data.textChannelId),
        volume: asNumber(data.volume),
      });
      break;
    }
    case "PAUSE_MUSIC":
      status = await music.pause(guildId);
      break;
    case "RESUME_MUSIC":
      status = await music.resume(guildId);
      break;
    case "SKIP_MUSIC":
      status = await music.skip(guildId);
      break;
    case "STOP_MUSIC":
      status = await music.stop(guildId);
      break;
    case "SET_VOLUME":
      status = await music.setVolume(guildId, asNumber(data.volume) ?? 50);
      break;
    case "SET_REPEAT":
      status = await music.setRepeat(guildId, asString(data.mode) ?? asString(data.repeat) ?? "OFF");
      break;
    case "SHUFFLE_QUEUE":
      status = await music.shuffle(guildId);
      break;
    case "CLEAR_QUEUE":
      status = await music.clear(guildId);
      break;
    case "GET_NOW_PLAYING":
    case "GET_QUEUE_STATUS":
      status = music.getStatus(guildId) ?? music.emptyStatus();
      break;
    default:
      return { success: false, error: `Unknown music command: ${command}` };
  }

  return { success: true, data: status };
}

function serializeAutoModRule(rule: AutoModerationRule) {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    triggerType: rule.triggerType,
    eventType: rule.eventType,
    actions: rule.actions.map((action) => ({ type: action.type, metadata: action.metadata })),
    exemptRoles: [...rule.exemptRoles.keys()],
    exemptChannels: [...rule.exemptChannels.keys()],
  };
}

async function getAutoModRules(client: Client, guildId?: string): Promise<ActionResult> {
  const guild = await fetchGuild(client, guildId);
  const rules = await guild.autoModerationRules.fetch();
  return {
    success: true,
    data: {
      rules: rules.map((rule) => serializeAutoModRule(rule)),
    },
  };
}

async function toggleAutoModRule(
  client: Client,
  data: Record<string, unknown>,
  guildId?: string
): Promise<ActionResult> {
  const ruleId = asString(data.ruleId) ?? asString(data.id);
  if (!ruleId) {
    return { success: false, error: "ruleId is required" };
  }
  const guild = await fetchGuild(client, guildId);
  const rule = await guild.autoModerationRules.fetch(ruleId);
  const enabled = typeof data.enabled === "boolean" ? data.enabled : !rule.enabled;
  const updated = await rule.edit({ enabled });
  return { success: true, data: serializeAutoModRule(updated) };
}
