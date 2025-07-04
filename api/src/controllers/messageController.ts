import type { Response } from 'express';
import { createLogger, QUEUE_NAMES } from '../types/shared.js';
import type { SendMessageJob, ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { discordApi } from '../services/discordApiService.js';
import { getDiscordEventForwarder } from '../services/discordEventForwarder.js';

const logger = createLogger('api-messages');

export const sendMessage = async (req: AuthRequest, res: Response) => {
	try {
		const {
			channelId,
			content,
			embeds,
			components,
			files,
			flags,
			message_reference,
			allowed_mentions,
			guildId,
		} = req.body;

		// Basic validation
		if (!channelId || (!content && !embeds && !files)) {
			return res.failure(
				'Channel ID and at least one of content, embeds, or files are required',
				400
			);
		}

		if (content && content.length > 2000) {
			return res.failure('Message content cannot exceed 2000 characters', 400);
		}

		// Prepare message options
		const messageOptions = {
			...(content && { content }),
			...(embeds && { embeds }),
			...(components && { components }),
			...(files && { files }),
			...(flags && { flags }),
			...(message_reference && { message_reference }),
			...(allowed_mentions && { allowed_mentions }),
		};

		// Send message directly via Discord API
		const sentMessage = await discordApi.sendMessage(channelId, messageOptions);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'MESSAGE_CREATE',
				data: sentMessage,
				channelId,
				guildId,
				userId: req.user?.id,
				timestamp: Date.now(),
			});
		}

		logger.info(`Sent message ${sentMessage.id} to channel ${channelId}`);

		res.success(sentMessage);
	} catch (error) {
		logger.error('Error in sendMessage controller:', error);
		res.failure('Failed to send message', 500);
	}
};

export const getChannels = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		if (!guildId) {
			return res.failure('Guild ID is required', 400);
		}

		// Use Discord API to get real channels
		const channels = await discordApi.getGuildChannels(guildId);

		logger.info(`Fetched ${channels.length} channels for guild: ${guildId}`);

		res.success(channels);
	} catch (error) {
		logger.error('Error fetching channels:', error);
		res.failure('Failed to fetch channels from Discord', 500);
	}
};

// ============================================================================
// ENHANCED MESSAGE OPERATIONS
// ============================================================================

export const getMessages = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;
		const { limit = 50, before, after } = req.query;

		if (!channelId) {
			return res.failure('Channel ID is required', 400);
		}

		const messages = await discordApi.getChannelMessages(
			channelId,
			Number(limit),
			before as string
		);

		logger.info(
			`Fetched ${messages.length} messages from channel: ${channelId}`
		);

		res.success(messages);
	} catch (error) {
		logger.error('Error fetching messages:', error);
		res.failure('Failed to fetch messages', 500);
	}
};

export const getMessage = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;

		if (!channelId || !messageId) {
			return res.failure('Channel ID and Message ID are required', 400);
		}

		const message = await discordApi.getMessage(channelId, messageId);

		res.success(message);
	} catch (error) {
		logger.error('Error fetching message:', error);
		res.failure('Message not found', 404);
	}
};

export const editMessage = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;
		const { content, embeds, components, flags, allowed_mentions } = req.body;

		if (!channelId || !messageId) {
			return res.failure('Channel ID and Message ID are required', 400);
		}

		const editOptions = {
			...(content && { content }),
			...(embeds && { embeds }),
			...(components && { components }),
			...(flags && { flags }),
			...(allowed_mentions && { allowed_mentions }),
		};

		const editedMessage = await discordApi.editMessage(
			channelId,
			messageId,
			editOptions
		);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'MESSAGE_UPDATE',
				data: editedMessage,
				channelId,
				timestamp: Date.now(),
			});
		}

		logger.info(`Edited message ${messageId} in channel ${channelId}`);

		res.success(editedMessage);
	} catch (error) {
		logger.error('Error editing message:', error);
		res.failure('Failed to edit message', 500);
	}
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;
		const { reason } = req.body;

		if (!channelId || !messageId) {
			return res.failure('Channel ID and Message ID are required', 400);
		}

		await discordApi.deleteMessage(channelId, messageId, reason);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'MESSAGE_DELETE',
				data: { id: messageId, channel_id: channelId },
				channelId,
				timestamp: Date.now(),
			});
		}

		logger.info(`Deleted message ${messageId} in channel ${channelId}`);

		res.success({ message: 'Message deleted successfully' });
	} catch (error) {
		logger.error('Error deleting message:', error);
		res.failure('Failed to delete message', 500);
	}
};

export const bulkDeleteMessages = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;
		const { messageIds, reason } = req.body;

		if (!channelId || !messageIds || !Array.isArray(messageIds)) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID and message IDs array are required',
			} as ApiResponse);
		}

		if (messageIds.length > 100) {
			return res.status(400).json({
				success: false,
				error: 'Cannot delete more than 100 messages at once',
			} as ApiResponse);
		}

		await discordApi.bulkDeleteMessages(channelId, messageIds, reason);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'MESSAGE_DELETE_BULK',
				data: { ids: messageIds, channel_id: channelId },
				channelId,
				timestamp: Date.now(),
			});
		}

		logger.info(
			`Bulk deleted ${messageIds.length} messages in channel ${channelId}`
		);

		res.json({
			success: true,
			message: `Successfully deleted ${messageIds.length} messages`,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error bulk deleting messages:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to bulk delete messages',
		} as ApiResponse);
	}
};

// ============================================================================
// REACTION OPERATIONS
// ============================================================================

export const addReaction = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;
		const { emoji } = req.body;

		if (!channelId || !messageId || !emoji) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID, Message ID, and emoji are required',
			} as ApiResponse);
		}

		await discordApi.addReaction(channelId, messageId, emoji);

		logger.info(`Added reaction ${emoji} to message ${messageId}`);

		res.json({
			success: true,
			message: 'Reaction added successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error adding reaction:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to add reaction',
		} as ApiResponse);
	}
};

export const removeReaction = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;
		const { emoji, userId } = req.body;

		if (!channelId || !messageId || !emoji) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID, Message ID, and emoji are required',
			} as ApiResponse);
		}

		await discordApi.removeReaction(channelId, messageId, emoji, userId);

		logger.info(`Removed reaction ${emoji} from message ${messageId}`);

		res.json({
			success: true,
			message: 'Reaction removed successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error removing reaction:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to remove reaction',
		} as ApiResponse);
	}
};

export const getReactions = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId, emoji } = req.params;
		const { after, limit = 25 } = req.query;

		if (!channelId || !messageId || !emoji) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID, Message ID, and emoji are required',
			} as ApiResponse);
		}

		const users = await discordApi.getReactions(
			channelId,
			messageId,
			emoji,
			after as string,
			Number(limit)
		);

		res.json({
			success: true,
			data: users,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching reactions:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch reactions',
		} as ApiResponse);
	}
};

export const deleteAllReactions = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;
		const { emoji } = req.query;

		if (!channelId || !messageId) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID and Message ID are required',
			} as ApiResponse);
		}

		await discordApi.deleteAllReactions(channelId, messageId, emoji as string);

		logger.info(`Deleted all reactions from message ${messageId}`);

		res.json({
			success: true,
			message: 'All reactions deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting all reactions:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete reactions',
		} as ApiResponse);
	}
};

// ============================================================================
// PIN OPERATIONS
// ============================================================================

export const pinMessage = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;
		const { reason } = req.body;

		if (!channelId || !messageId) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID and Message ID are required',
			} as ApiResponse);
		}

		await discordApi.pinMessage(channelId, messageId, reason);

		logger.info(`Pinned message ${messageId} in channel ${channelId}`);

		res.json({
			success: true,
			message: 'Message pinned successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error pinning message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to pin message',
		} as ApiResponse);
	}
};

export const unpinMessage = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;
		const { reason } = req.body;

		if (!channelId || !messageId) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID and Message ID are required',
			} as ApiResponse);
		}

		await discordApi.unpinMessage(channelId, messageId, reason);

		logger.info(`Unpinned message ${messageId} in channel ${channelId}`);

		res.json({
			success: true,
			message: 'Message unpinned successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error unpinning message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to unpin message',
		} as ApiResponse);
	}
};

export const getPinnedMessages = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;

		if (!channelId) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID is required',
			} as ApiResponse);
		}

		const pinnedMessages = await discordApi.getPinnedMessages(channelId);

		res.json({
			success: true,
			data: pinnedMessages,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching pinned messages:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch pinned messages',
		} as ApiResponse);
	}
};

// ============================================================================
// THREAD OPERATIONS
// ============================================================================

export const startThreadFromMessage = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { channelId, messageId } = req.params;
		const { name, auto_archive_duration, rate_limit_per_user } = req.body;

		if (!channelId || !messageId || !name) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID, Message ID, and thread name are required',
			} as ApiResponse);
		}

		const threadOptions = {
			name,
			...(auto_archive_duration && { auto_archive_duration }),
			...(rate_limit_per_user && { rate_limit_per_user }),
		};

		const thread = await discordApi.startThreadFromMessage(
			channelId,
			messageId,
			threadOptions
		);

		logger.info(`Started thread ${thread.id} from message ${messageId}`);

		res.json({
			success: true,
			data: thread,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error starting thread from message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to start thread',
		} as ApiResponse);
	}
};

export const startThread = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;
		const {
			name,
			auto_archive_duration,
			type,
			invitable,
			rate_limit_per_user,
			message,
		} = req.body;

		if (!channelId || !name) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID and thread name are required',
			} as ApiResponse);
		}

		const threadOptions = {
			name,
			...(auto_archive_duration && { auto_archive_duration }),
			...(type && { type }),
			...(invitable !== undefined && { invitable }),
			...(rate_limit_per_user && { rate_limit_per_user }),
			...(message && { message }),
		};

		const thread = await discordApi.startThreadWithoutMessage(
			channelId,
			threadOptions
		);

		logger.info(`Started thread ${thread.id} in channel ${channelId}`);

		res.json({
			success: true,
			data: thread,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error starting thread:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to start thread',
		} as ApiResponse);
	}
};

export const joinThread = async (req: AuthRequest, res: Response) => {
	try {
		const { threadId } = req.params;

		if (!threadId) {
			return res.status(400).json({
				success: false,
				error: 'Thread ID is required',
			} as ApiResponse);
		}

		await discordApi.joinThread(threadId);

		logger.info(`Joined thread ${threadId}`);

		res.json({
			success: true,
			message: 'Successfully joined thread',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error joining thread:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to join thread',
		} as ApiResponse);
	}
};

export const leaveThread = async (req: AuthRequest, res: Response) => {
	try {
		const { threadId } = req.params;

		if (!threadId) {
			return res.status(400).json({
				success: false,
				error: 'Thread ID is required',
			} as ApiResponse);
		}

		await discordApi.leaveThread(threadId);

		logger.info(`Left thread ${threadId}`);

		res.json({
			success: true,
			message: 'Successfully left thread',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error leaving thread:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to leave thread',
		} as ApiResponse);
	}
};

export const addThreadMember = async (req: AuthRequest, res: Response) => {
	try {
		const { threadId, userId } = req.params;

		if (!threadId || !userId) {
			return res.status(400).json({
				success: false,
				error: 'Thread ID and User ID are required',
			} as ApiResponse);
		}

		await discordApi.addThreadMember(threadId, userId);

		logger.info(`Added user ${userId} to thread ${threadId}`);

		res.json({
			success: true,
			message: 'User added to thread successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error adding user to thread:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to add user to thread',
		} as ApiResponse);
	}
};

export const removeThreadMember = async (req: AuthRequest, res: Response) => {
	try {
		const { threadId, userId } = req.params;

		if (!threadId || !userId) {
			return res.status(400).json({
				success: false,
				error: 'Thread ID and User ID are required',
			} as ApiResponse);
		}

		await discordApi.removeThreadMember(threadId, userId);

		logger.info(`Removed user ${userId} from thread ${threadId}`);

		res.json({
			success: true,
			message: 'User removed from thread successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error removing user from thread:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to remove user from thread',
		} as ApiResponse);
	}
};

export const getThreadMembers = async (req: AuthRequest, res: Response) => {
	try {
		const { threadId } = req.params;
		const { with_member, after, limit = 100 } = req.query;

		if (!threadId) {
			return res.status(400).json({
				success: false,
				error: 'Thread ID is required',
			} as ApiResponse);
		}

		const members = await discordApi.listThreadMembers(
			threadId,
			with_member === 'true',
			after as string,
			Number(limit)
		);

		res.json({
			success: true,
			data: members,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching thread members:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch thread members',
		} as ApiResponse);
	}
};

export const getActiveThreads = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		if (!guildId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID is required',
			} as ApiResponse);
		}

		const threads = await discordApi.getActiveThreads(guildId);

		res.json({
			success: true,
			data: threads,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching active threads:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch active threads',
		} as ApiResponse);
	}
};

export const getArchivedThreads = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;
		const { type = 'public', before, limit = 50 } = req.query;

		if (!channelId) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID is required',
			} as ApiResponse);
		}

		let threads;
		switch (type) {
			case 'private':
				threads = await discordApi.getPrivateArchivedThreads(
					channelId,
					before as string,
					Number(limit)
				);
				break;
			case 'joined':
				threads = await discordApi.getJoinedPrivateArchivedThreads(
					channelId,
					before as string,
					Number(limit)
				);
				break;
			default:
				threads = await discordApi.getPublicArchivedThreads(
					channelId,
					before as string,
					Number(limit)
				);
		}

		res.json({
			success: true,
			data: threads,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching archived threads:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch archived threads',
		} as ApiResponse);
	}
};

// ============================================================================
// CROSSPOST OPERATIONS
// ============================================================================

export const crosspostMessage = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId, messageId } = req.params;

		if (!channelId || !messageId) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID and Message ID are required',
			} as ApiResponse);
		}

		const crosspostedMessage = await discordApi.crosspostMessage(
			channelId,
			messageId
		);

		logger.info(`Crossposted message ${messageId} in channel ${channelId}`);

		res.json({
			success: true,
			data: crosspostedMessage,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error crossposting message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to crosspost message',
		} as ApiResponse);
	}
};
