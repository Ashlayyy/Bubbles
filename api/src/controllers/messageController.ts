import type { Response } from 'express';
import { QueueManager } from '../queue/manager.js';
import { createLogger, QUEUE_NAMES } from '../types/shared.js';
import type { SendMessageJob, ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';

const logger = createLogger('api-messages');
const queueManager = new QueueManager();

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { channelId, content, guildId } = req.body;

    // Basic validation
    if (!channelId || !content) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID and content are required'
      } as ApiResponse);
    }

    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message content cannot exceed 2000 characters'
      } as ApiResponse);
    }

    // Create job for bot
    const job: SendMessageJob = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'SEND_MESSAGE',
      timestamp: Date.now(),
      channelId,
      content,
      guildId,
      userId: req.user?.id
    };

    // Add job to queue
    try {
      const queue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);
      await queue.add('send-message', job, {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
      });

      logger.info(`Message job queued: ${job.id} for channel ${channelId}`);

      res.json({
        success: true,
        message: 'Message queued successfully',
        data: { jobId: job.id }
      } as ApiResponse);

    } catch (queueError) {
      logger.error('Failed to queue message job:', queueError);
      res.status(500).json({
        success: false,
        error: 'Failed to queue message'
      } as ApiResponse);
    }

  } catch (error) {
    logger.error('Error in sendMessage controller:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
};

export const getChannels = async (req: AuthRequest, res: Response) => {
  try {
    const { guildId } = req.params;

    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID is required'
      } as ApiResponse);
    }

    // For Phase 1, return the test guild channels if guildId matches
    const testGuildId = process.env.TEST_GUILD_ID;
    const channels = guildId === testGuildId ? [
      { id: '1380658318174982274', name: 'general', type: 'text' },
      { id: '1380659123456789012', name: 'bot-commands', type: 'text' },
      { id: '1380659987654321098', name: 'testing', type: 'text' }
    ] : [
      { id: '1234567890', name: 'general', type: 'text' },
      { id: '1234567891', name: 'bot-commands', type: 'text' },
      { id: '1234567892', name: 'announcements', type: 'text' }
    ];

    logger.info(`Fetching channels for guild: ${guildId}`);

    res.json({
      success: true,
      data: channels
    } as ApiResponse);

  } catch (error) {
    logger.error('Error fetching channels:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    } as ApiResponse);
  }
}; 