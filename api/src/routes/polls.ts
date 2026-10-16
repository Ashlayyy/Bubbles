import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireUniversalPermissions } from '../middleware/permissions.js';
import { validateZod } from '../validation/zodValidate.js';
import { z } from 'zod';
import {
	getPolls,
	getPoll,
	createPoll,
	updatePoll,
	deletePoll,
	voteOnPoll,
	closePoll,
	getPollStatistics,
} from '../controllers/pollController.js';

const router = express.Router();

// Validation schemas
const createPollSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	type: z.enum(['single', 'multiple', 'ranked', 'rating']),
	options: z.array(z.any()).min(2),
	settings: z.any().optional(),
	anonymous: z.boolean().optional(),
	multiSelect: z.boolean().optional(),
	maxChoices: z.number().positive().optional(),
	endTime: z.string().datetime().optional(),
});

const updatePollSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	settings: z.any().optional(),
	anonymous: z.boolean().optional(),
	multiSelect: z.boolean().optional(),
	maxChoices: z.number().positive().optional(),
	endTime: z.string().datetime().optional(),
	status: z.enum(['active', 'closed']).optional(),
});

const voteSchema = z.object({
	userId: z.string(),
	choices: z.array(z.string()).optional(),
	ranking: z.any().optional(),
	rating: z.number().min(1).max(5).optional(),
});

// Poll management routes
router.get(
	'/guilds/:guildId/polls',
	authenticateToken,
	requireUniversalPermissions(['VIEW_POLLS']),
	getPolls
);

router.get(
	'/guilds/:guildId/polls/:pollId',
	authenticateToken,
	requireUniversalPermissions(['VIEW_POLLS']),
	getPoll
);

router.post(
	'/guilds/:guildId/polls',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_POLLS']),
	validateZod(createPollSchema),
	createPoll
);

router.put(
	'/guilds/:guildId/polls/:pollId',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_POLLS']),
	validateZod(updatePollSchema),
	updatePoll
);

router.delete(
	'/guilds/:guildId/polls/:pollId',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_POLLS']),
	deletePoll
);

router.post(
	'/guilds/:guildId/polls/:pollId/vote',
	authenticateToken,
	requireUniversalPermissions(['USE_POLLS']),
	validateZod(voteSchema),
	voteOnPoll
);

router.post(
	'/guilds/:guildId/polls/:pollId/close',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_POLLS']),
	closePoll
);

router.get(
	'/guilds/:guildId/polls/statistics',
	authenticateToken,
	requireUniversalPermissions(['VIEW_POLLS']),
	getPollStatistics
);

export default router;
