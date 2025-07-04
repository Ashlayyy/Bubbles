import { Router } from 'express';
import { eventStore } from '../services/eventStore.js';

const router = Router();

router.get('/:guildId?', async (req, res) => {
	const { guildId } = req.params;
	const { type, limit } = req.query as { type?: string; limit?: string };

	try {
		const events = await eventStore.getDiscordEvents({
			guildId,
			type,
			limit: limit ? parseInt(limit, 10) : undefined,
		});
		res.json({ success: true, events });
	} catch (error) {
		res.status(500).json({ success: false, error: 'Failed to fetch events' });
	}
});

export default router;
