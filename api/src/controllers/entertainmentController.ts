import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';

const logger = createLogger('entertainment-controller');

// Get game configurations
export const getGameConfigs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		// TODO: Implement actual game configs fetching
		const mockGameConfigs = {
			trivia: {
				enabled: true,
				channelId: '123456789',
				difficulty: 'MEDIUM',
				categories: ['GENERAL', 'GAMING', 'SCIENCE'],
				rewardPoints: 10,
				timeLimit: 30000, // 30 seconds
				cooldown: 300000, // 5 minutes
			},
			wordGame: {
				enabled: true,
				channelId: '987654321',
				wordList: 'CUSTOM',
				rewardPoints: 5,
				timeLimit: 60000, // 1 minute
			},
			guessNumber: {
				enabled: false,
				channelId: null,
				minNumber: 1,
				maxNumber: 100,
				rewardPoints: 15,
				maxAttempts: 5,
			},
			rockPaperScissors: {
				enabled: true,
				channelId: '456789123',
				rewardPoints: 3,
				allowBetting: true,
			},
			dailyReward: {
				enabled: true,
				baseReward: 50,
				streakMultiplier: 1.1,
				maxStreak: 30,
			},
		};

		res.json({
			success: true,
			data: mockGameConfigs,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching game configs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch game configurations',
		} as ApiResponse);
	}
};

// Update game settings
export const updateGameSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const gameSettings = req.body;

		// TODO: Implement actual game settings updating
		res.json({
			success: true,
			data: gameSettings,
			message: 'Game settings updated successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating game settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update game settings',
		} as ApiResponse);
	}
};

// Get economy settings
export const getEconomySettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		// TODO: Implement actual economy settings fetching
		const mockEconomySettings = {
			enabled: true,
			currencyName: 'Coins',
			currencySymbol: '🪙',
			startingBalance: 100,
			dailyReward: {
				enabled: true,
				amount: 50,
				cooldown: 86400000, // 24 hours
			},
			workCommand: {
				enabled: true,
				minReward: 10,
				maxReward: 50,
				cooldown: 3600000, // 1 hour
				jobs: ['programmer', 'teacher', 'chef', 'artist', 'musician', 'gamer'],
			},
			gambling: {
				enabled: true,
				minBet: 1,
				maxBet: 1000,
				houseEdge: 0.05, // 5%
			},
			shop: {
				enabled: true,
				items: [
					{
						id: 'item_001',
						name: 'VIP Role',
						description: '7-day VIP access',
						price: 500,
						roleId: '123456789',
						duration: 604800000, // 7 days
					},
					{
						id: 'item_002',
						name: 'Custom Color',
						description: 'Custom role color for 30 days',
						price: 300,
						type: 'COLOR_ROLE',
						duration: 2592000000, // 30 days
					},
				],
			},
			leaderboard: {
				enabled: true,
				updateInterval: 3600000, // 1 hour
				showTop: 10,
			},
		};

		res.json({
			success: true,
			data: mockEconomySettings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching economy settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch economy settings',
		} as ApiResponse);
	}
};

// Update economy settings
export const updateEconomySettings = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const economySettings = req.body;

		// TODO: Implement actual economy settings updating
		res.json({
			success: true,
			data: economySettings,
			message: 'Economy settings updated successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating economy settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update economy settings',
		} as ApiResponse);
	}
};

// Get trivia questions
export const getTriviaQuestions = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { category, difficulty, page = 1, limit = 50 } = req.query;

		// TODO: Implement actual trivia questions fetching
		const mockQuestions = [
			{
				id: 'trivia_001',
				category: 'GENERAL',
				difficulty: 'EASY',
				question: 'What is the capital of France?',
				correctAnswer: 'Paris',
				incorrectAnswers: ['London', 'Berlin', 'Madrid'],
				explanation: 'Paris has been the capital of France since 508 AD.',
				createdAt: Date.now() - 2592000000,
				createdBy: '123456789',
				timesUsed: 45,
			},
			{
				id: 'trivia_002',
				category: 'SCIENCE',
				difficulty: 'MEDIUM',
				question: 'What is the chemical symbol for gold?',
				correctAnswer: 'Au',
				incorrectAnswers: ['Go', 'Gd', 'Ag'],
				explanation: 'Au comes from the Latin word "aurum" meaning gold.',
				createdAt: Date.now() - 1296000000,
				createdBy: '987654321',
				timesUsed: 23,
			},
		];

		res.json({
			success: true,
			data: {
				questions: mockQuestions,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total: 2,
					pages: 1,
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching trivia questions:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch trivia questions',
		} as ApiResponse);
	}
};

// Add trivia question
export const addTriviaQuestion = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const questionData = req.body;

		// TODO: Implement actual trivia question creation
		const newQuestion = {
			id: `trivia_${Date.now()}`,
			...questionData,
			createdAt: Date.now(),
			createdBy: req.user?.id,
			timesUsed: 0,
		};

		res.status(201).json({
			success: true,
			data: newQuestion,
			message: 'Trivia question added successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error adding trivia question:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to add trivia question',
		} as ApiResponse);
	}
};
