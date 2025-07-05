import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('entertainment-controller');

// Default builders
const defaultGameSettings = {
	enabled: true,
	allowedChannels: [],
	triviaEnabled: true,
	triviaReward: 10,
};

// Get game configurations
export const getGameConfigs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const config = await prisma.gameSettings.findUnique({ where: { guildId } });
		return res.success(config || defaultGameSettings);
	} catch (error) {
		logger.error('Error fetching game configs:', error);
		return res.failure('Failed to fetch game configurations', 500);
	}
};

// Update game settings
export const updateGameSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const gameSettings = req.body;
		const prisma = getPrismaClient();

		// Keep only allowed keys
		const sanitized = {
			enabled: gameSettings.enabled,
			allowedChannels: gameSettings.allowedChannels,
			triviaEnabled: gameSettings.triviaEnabled,
			triviaReward: gameSettings.triviaReward,
		};

		const updated = await prisma.gameSettings.upsert({
			where: { guildId },
			update: { ...sanitized, updatedAt: new Date() },
			create: { guildId, ...defaultGameSettings, ...sanitized },
		});

		return res.success({
			message: 'Game settings updated successfully',
			data: updated,
		});
	} catch (error) {
		logger.error('Error updating game settings:', error);
		return res.failure('Failed to update game settings', 500);
	}
};

// Economy uses same GameSettings
export const getEconomySettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const settings = await prisma.gameSettings.findUnique({
			where: { guildId },
		});
		return res.success(settings || defaultGameSettings);
	} catch (error) {
		logger.error('Error fetching economy settings:', error);
		return res.failure('Failed to fetch economy settings', 500);
	}
};

export const updateEconomySettings = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const economySettings = req.body;
		const prisma = getPrismaClient();

		// Keep only allowed keys
		const sanitized = {
			enabled: economySettings.enabled,
			allowedChannels: economySettings.allowedChannels,
			triviaEnabled: economySettings.triviaEnabled,
			triviaReward: economySettings.triviaReward,
		};

		const updated = await prisma.gameSettings.upsert({
			where: { guildId },
			update: { ...sanitized, updatedAt: new Date() },
			create: { guildId, ...defaultGameSettings, ...sanitized },
		});

		return res.success({
			message: 'Economy settings updated successfully',
			data: updated,
		});
	} catch (error) {
		logger.error('Error updating economy settings:', error);
		return res.failure('Failed to update economy settings', 500);
	}
};

// Get trivia questions
export const getTriviaQuestions = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { category, difficulty, page = 1, limit = 50 } = req.query;
		const prisma = getPrismaClient();

		const where: any = { OR: [{ guildId }, { guildId: null }] };
		if (category) where.category = category as string;
		if (difficulty) where.difficulty = difficulty as string;

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		const [questions, total] = await Promise.all([
			prisma.triviaQuestion.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
			}),
			prisma.triviaQuestion.count({ where }),
		]);

		return res.success({
			questions,
			pagination: {
				page: parseInt(page as string),
				limit: take,
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching trivia questions:', error);
		return res.failure('Failed to fetch trivia questions', 500);
	}
};

// Add trivia question
export const addTriviaQuestion = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();
		const data = req.body;

		const question = await prisma.triviaQuestion.create({
			data: { ...data, guildId, createdBy: req.user?.id || 'unknown' },
		});
		return res.success(
			{
				message: 'Trivia question added successfully',
				data: question,
			},
			201
		);
	} catch (error) {
		logger.error('Error adding trivia question:', error);
		return res.failure('Failed to add trivia question', 500);
	}
};
