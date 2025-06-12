import { Router } from 'express';
import queueManager from '../queue/manager.js';
import { QUEUE_NAMES } from '../../../shared/src/types/queue.js';

const router = Router();

// Test route to add a job to the queue
router.post('/test-queue', async (req, res) => {
  try {
    const botCommandsQueue = queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);
    
    const testJob = {
      type: 'SEND_MESSAGE' as const,
      id: `test-${Date.now()}`,
      timestamp: Date.now(),
      channelId: req.body.channelId || 'test-channel',
      content: req.body.message || 'This is a test message from the API!',
      guildId: req.body.guildId || 'test-guild'
    };

    const job = await botCommandsQueue.add('send-message', testJob);
    
    res.status(201).json({
      success: true,
      message: 'Test job added to the bot commands queue.',
      jobId: job.id,
      jobData: testJob
    });
  } catch (error) {
    console.error('Failed to add job to queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add job to queue.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get queue stats
router.get('/queue-stats', async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats(QUEUE_NAMES.BOT_COMMANDS);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue stats.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
