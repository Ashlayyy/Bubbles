import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('poll-controller');

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'POLL_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
	};
}

// Get polls for a guild
export const getPolls = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 20, status = 'all', type, createdBy } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };

		if (status !== 'all') {
			where.status = status as string;
		}

		if (type) {
			where.type = type as string;
		}

		if (createdBy) {
			where.createdBy = createdBy as string;
		}

		// Fetch polls with pagination
		const [polls, total] = await Promise.all([
			prisma.pollAdvanced.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: {
					votes: {
						select: {
							id: true,
							userId: true,
							choices: true,
							ranking: true,
							rating: true,
							votedAt: true,
						},
					},
				},
			}),
			prisma.pollAdvanced.count({ where }),
		]);

		// Format polls with vote counts
		const formattedPolls = polls.map((poll: any) => {
			const voteCount = poll.votes.length;
			const uniqueVoters = new Set(poll.votes.map((vote: any) => vote.userId))
				.size;

			// Calculate results based on poll type
			let results = {};
			if (poll.type === 'single' || poll.type === 'multiple') {
				const choiceCounts: { [key: string]: number } = {};
				poll.votes.forEach((vote: any) => {
					vote.choices.forEach((choice: string) => {
						choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
					});
				});
				results = choiceCounts;
			} else if (poll.type === 'rating') {
				const ratingSum = poll.votes.reduce(
					(sum: number, vote: any) => sum + (vote.rating || 0),
					0
				);
				results = {
					averageRating: voteCount > 0 ? ratingSum / voteCount : 0,
					totalRatings: voteCount,
				};
			}

			return {
				...poll,
				voteCount,
				uniqueVoters,
				results,
				votes: poll.anonymous ? [] : poll.votes, // Hide votes if anonymous
			};
		});

		res.success({
			polls: formattedPolls,
			pagination: {
				page: parseInt(page as string),
				limit: take,
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching polls:', error);
		res.failure('Failed to fetch polls', 500);
	}
};

// Get single poll with detailed results
export const getPoll = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, pollId } = req.params;
		const { includeVotes = false } = req.query;
		const prisma = getPrismaClient();

		const poll = await prisma.pollAdvanced.findFirst({
			where: {
				id: pollId,
				guildId,
			},
			include: {
				votes: includeVotes === 'true' ? true : false,
			},
		});

		if (!poll) {
			return res.failure('Poll not found', 404);
		}

		// Calculate detailed results
		const voteCount = poll.votes ? poll.votes.length : 0;
		const uniqueVoters = poll.votes
			? new Set(poll.votes.map((vote: any) => vote.userId)).size
			: 0;

		let detailedResults = {};
		if (poll.votes) {
			if (poll.type === 'single' || poll.type === 'multiple') {
				const choiceCounts: { [key: string]: number } = {};
				const choicePercentages: { [key: string]: number } = {};

				poll.votes.forEach((vote: any) => {
					vote.choices.forEach((choice: string) => {
						choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
					});
				});

				// Calculate percentages
				Object.keys(choiceCounts).forEach((choice) => {
					choicePercentages[choice] =
						voteCount > 0 ? (choiceCounts[choice] / voteCount) * 100 : 0;
				});

				detailedResults = {
					choiceCounts,
					choicePercentages,
					totalVotes: voteCount,
				};
			} else if (poll.type === 'rating') {
				const ratings = poll.votes.map((vote: any) => vote.rating || 0);
				const ratingSum = ratings.reduce(
					(sum: number, rating: number) => sum + rating,
					0
				);
				const averageRating = voteCount > 0 ? ratingSum / voteCount : 0;

				// Calculate distribution
				const ratingDistribution: { [key: number]: number } = {};
				for (let i = 1; i <= 5; i++) {
					ratingDistribution[i] = ratings.filter((r: any) => r === i).length;
				}

				detailedResults = {
					averageRating: parseFloat(averageRating.toFixed(2)),
					totalRatings: voteCount,
					ratingDistribution,
					median: calculateMedian(ratings),
				};
			} else if (poll.type === 'ranked') {
				// Calculate ranked choice results using instant runoff
				const rankedResults = calculateRankedChoiceResults(
					poll.votes,
					poll.options
				);
				detailedResults = rankedResults;
			}
		}

		const formattedPoll = {
			...poll,
			voteCount,
			uniqueVoters,
			detailedResults,
			votes: poll.anonymous ? [] : poll.votes, // Hide individual votes if anonymous
		};

		res.success(formattedPoll);
	} catch (error) {
		logger.error('Error fetching poll:', error);
		res.failure('Failed to fetch poll', 500);
	}
};

// Create a new poll
export const createPoll = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			title,
			description,
			type,
			options,
			settings = {},
			anonymous = false,
			multiSelect = false,
			maxChoices,
			endTime,
		} = req.body;
		const prisma = getPrismaClient();

		// Validate required fields
		if (
			!title ||
			!type ||
			!options ||
			!Array.isArray(options) ||
			options.length < 2
		) {
			return res.failure(
				'Title, type, and at least 2 options are required',
				400
			);
		}

		// Validate poll type
		if (!['single', 'multiple', 'ranked', 'rating'].includes(type)) {
			return res.failure('Invalid poll type', 400);
		}

		// Validate end time if provided
		let endDate = null;
		if (endTime) {
			endDate = new Date(endTime);
			if (endDate <= new Date()) {
				return res.failure('End time must be in the future', 400);
			}
		}

		// Create poll
		const poll = await prisma.pollAdvanced.create({
			data: {
				guildId,
				createdBy: req.user?.id || 'unknown',
				title,
				description,
				type,
				options,
				settings,
				anonymous,
				multiSelect,
				maxChoices,
				endTime: endDate,
				status: 'active',
			},
		});

		// Broadcast poll creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('pollCreate', poll)
		);

		logger.info(`Created poll '${title}' for guild ${guildId}`, {
			pollId: poll.id,
			type,
		});

		res.success({ message: 'Poll created successfully', data: poll }, 201);
	} catch (error) {
		logger.error('Error creating poll:', error);
		res.failure('Failed to create poll', 500);
	}
};

// Update an existing poll
export const updatePoll = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, pollId } = req.params;
		const updateData = req.body;
		const prisma = getPrismaClient();

		// Check if poll exists
		const existingPoll = await prisma.pollAdvanced.findFirst({
			where: {
				id: pollId,
				guildId,
			},
		});

		if (!existingPoll) {
			return res.failure('Poll not found', 404);
		}

		// Don't allow updating if poll has ended
		if (existingPoll.status === 'closed') {
			return res.failure('Cannot update closed poll', 400);
		}

		// Validate end time if provided
		if (updateData.endTime) {
			const endDate = new Date(updateData.endTime);
			if (endDate <= new Date()) {
				return res.failure('End time must be in the future', 400);
			}
			updateData.endTime = endDate;
		}

		// Update poll
		const updatedPoll = await prisma.pollAdvanced.update({
			where: { id: pollId },
			data: {
				...updateData,
				updatedAt: new Date(),
			},
		});

		// Broadcast poll update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('pollUpdate', updatedPoll)
		);

		logger.info(`Updated poll ${pollId} for guild ${guildId}`);

		res.success({
			message: 'Poll updated successfully',
			data: updatedPoll,
		});
	} catch (error) {
		logger.error('Error updating poll:', error);
		res.failure('Failed to update poll', 500);
	}
};

// Delete a poll
export const deletePoll = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, pollId } = req.params;
		const prisma = getPrismaClient();

		// Check if poll exists
		const existingPoll = await prisma.pollAdvanced.findFirst({
			where: {
				id: pollId,
				guildId,
			},
		});

		if (!existingPoll) {
			return res.failure('Poll not found', 404);
		}

		// Delete poll and its votes (cascade delete)
		await prisma.pollAdvanced.delete({
			where: { id: pollId },
		});

		// Broadcast poll deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('pollDelete', { id: pollId })
		);

		logger.info(`Deleted poll ${pollId} from guild ${guildId}`);

		res.success({ message: 'Poll deleted successfully' });
	} catch (error) {
		logger.error('Error deleting poll:', error);
		res.failure('Failed to delete poll', 500);
	}
};

// Vote on a poll
export const voteOnPoll = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, pollId } = req.params;
		const { userId, choices, ranking, rating } = req.body;
		const prisma = getPrismaClient();

		// Check if poll exists and is active
		const poll = await prisma.pollAdvanced.findFirst({
			where: {
				id: pollId,
				guildId,
			},
			include: {
				votes: {
					where: { userId },
				},
			},
		});

		if (!poll) {
			return res.failure('Poll not found', 404);
		}

		if (poll.status !== 'active') {
			return res.failure('Poll is not active', 400);
		}

		// Check if poll has ended
		if (poll.endTime && poll.endTime <= new Date()) {
			return res.failure('Poll has ended', 400);
		}

		// Validate vote data based on poll type
		if (poll.type === 'single') {
			if (!choices || !Array.isArray(choices) || choices.length !== 1) {
				return res.failure(
					'Single choice polls require exactly one choice',
					400
				);
			}
		} else if (poll.type === 'multiple') {
			if (!choices || !Array.isArray(choices) || choices.length === 0) {
				return res.failure(
					'Multiple choice polls require at least one choice',
					400
				);
			}
			if (poll.maxChoices && choices.length > poll.maxChoices) {
				return res.failure(`Maximum ${poll.maxChoices} choices allowed`, 400);
			}
		} else if (poll.type === 'ranking') {
			if (!ranking || typeof ranking !== 'object') {
				return res.failure('Ranking polls require ranking data', 400);
			}
		} else if (poll.type === 'rating') {
			if (!rating || rating < 1 || rating > 5) {
				return res.failure('Rating must be between 1 and 5', 400);
			}
		}

		// Check if user already voted (for non-anonymous polls or to prevent duplicate votes)
		const existingVote = poll.votes.find((vote: any) => vote.userId === userId);
		if (existingVote) {
			return res.failure('User has already voted', 400);
		}

		// Create vote
		const vote = await prisma.pollVote.create({
			data: {
				pollId,
				userId,
				choices: choices || [],
				ranking,
				rating,
			},
		});

		// Get updated poll with vote counts
		const updatedPoll = await prisma.pollAdvanced.findUnique({
			where: { id: pollId },
			include: {
				votes: {
					select: {
						id: true,
						choices: true,
						rating: true,
						votedAt: true,
						...(poll.anonymous ? {} : { userId: true }),
					},
				},
			},
		});

		const voteCount = updatedPoll?.votes.length || 0;

		// Broadcast vote update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('pollVote', {
				pollId,
				userId: poll.anonymous ? undefined : userId,
				voteCount,
			})
		);

		logger.info(`User ${userId} voted on poll ${pollId}`);

		res.success({
			message: 'Vote recorded successfully',
			data: {
				vote: poll.anonymous ? { id: vote.id, votedAt: vote.votedAt } : vote,
				voteCount,
			},
		});
	} catch (error) {
		logger.error('Error recording vote:', error);
		res.failure('Failed to record vote', 500);
	}
};

// Close a poll
export const closePoll = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, pollId } = req.params;
		const prisma = getPrismaClient();

		// Check if poll exists
		const poll = await prisma.pollAdvanced.findFirst({
			where: {
				id: pollId,
				guildId,
			},
		});

		if (!poll) {
			return res.failure('Poll not found', 404);
		}

		if (poll.status !== 'active') {
			return res.failure('Poll is not active', 400);
		}

		// Close poll
		const closedPoll = await prisma.pollAdvanced.update({
			where: { id: pollId },
			data: {
				status: 'closed',
				updatedAt: new Date(),
			},
		});

		// Broadcast poll closure
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('pollClose', closedPoll)
		);

		logger.info(`Closed poll ${pollId} for guild ${guildId}`);

		res.success({
			message: 'Poll closed successfully',
			data: closedPoll,
		});
	} catch (error) {
		logger.error('Error closing poll:', error);
		res.failure('Failed to close poll', 500);
	}
};

// Get poll statistics
export const getPollStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { timeframe = '30d' } = req.query;
		const prisma = getPrismaClient();

		// Calculate date range
		const now = new Date();
		let startDate = new Date();
		switch (timeframe) {
			case '7d':
				startDate.setDate(now.getDate() - 7);
				break;
			case '30d':
				startDate.setDate(now.getDate() - 30);
				break;
			case '90d':
				startDate.setDate(now.getDate() - 90);
				break;
			default:
				startDate.setDate(now.getDate() - 30);
		}

		const [
			totalPolls,
			activePolls,
			closedPolls,
			totalVotes,
			pollsByType,
			topCreators,
		] = await Promise.all([
			prisma.pollAdvanced.count({
				where: { guildId, createdAt: { gte: startDate } },
			}),
			prisma.pollAdvanced.count({
				where: { guildId, status: 'active' },
			}),
			prisma.pollAdvanced.count({
				where: { guildId, status: 'closed' },
			}),
			prisma.pollVote.count({
				where: {
					poll: { guildId },
					votedAt: { gte: startDate },
				},
			}),
			prisma.pollAdvanced.groupBy({
				by: ['type'],
				where: { guildId, createdAt: { gte: startDate } },
				_count: { type: true },
			}),
			prisma.pollAdvanced.groupBy({
				by: ['createdBy'],
				where: { guildId, createdAt: { gte: startDate } },
				_count: { createdBy: true },
				orderBy: { _count: { createdBy: 'desc' } },
				take: 5,
			}),
		]);

		const statistics = {
			timeframe,
			period: {
				start: startDate.toISOString(),
				end: now.toISOString(),
			},
			overview: {
				totalPolls,
				activePolls,
				closedPolls,
				totalVotes,
				averageVotesPerPoll:
					totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0,
			},
			breakdown: {
				pollTypes: pollsByType.reduce((acc: any, type: any) => {
					acc[type.type] = type._count.type;
					return acc;
				}, {}),
			},
			topCreators: topCreators.map((creator: any) => ({
				userId: creator.createdBy,
				pollCount: creator._count.createdBy,
			})),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching poll statistics:', error);
		res.failure('Failed to fetch poll statistics', 500);
	}
};

// Helper functions
function calculateMedian(numbers: number[]): number {
	const sorted = numbers.sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 0) {
		return (sorted[middle - 1] + sorted[middle]) / 2;
	}

	return sorted[middle];
}

function calculateRankedChoiceResults(votes: any[], options: any[]): any {
	// Simplified instant runoff calculation
	// In a real implementation, this would be more complex
	const rounds: any[] = [];
	let remainingOptions = [...options];
	let currentVotes = votes.map((vote) => ({ ...vote }));

	while (remainingOptions.length > 1) {
		const counts: { [key: string]: number } = {};

		// Count first preferences
		currentVotes.forEach((vote) => {
			if (vote.ranking && typeof vote.ranking === 'object') {
				const firstChoice = Object.keys(vote.ranking)
					.sort((a, b) => vote.ranking[a] - vote.ranking[b])
					.find((choice) => remainingOptions.includes(choice));

				if (firstChoice) {
					counts[firstChoice] = (counts[firstChoice] || 0) + 1;
				}
			}
		});

		rounds.push({ ...counts });

		// Find option with fewest votes to eliminate
		const minVotes = Math.min(...Object.values(counts));
		const toEliminate = Object.keys(counts).find(
			(option) => counts[option] === minVotes
		);

		if (toEliminate) {
			remainingOptions = remainingOptions.filter(
				(option) => option !== toEliminate
			);
		} else {
			break;
		}
	}

	return {
		rounds,
		winner: remainingOptions[0] || null,
	};
}
