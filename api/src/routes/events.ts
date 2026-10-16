import { Router, type Request, type Response } from 'express';
import { eventStore } from '../services/eventStore.js';

const router = Router();

async function getEvents(req: Request, res: Response) {
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
}

router.get('/', getEvents);
router.get('/:guildId', getEvents);

export default router;
