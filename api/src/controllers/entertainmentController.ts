import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
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
		return res.json({
			success: true,
			data: config || defaultGameSettings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching game configs:', error);
		return res.status(500).json({
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

		return res.json({
			success: true,
			data: updated,
			message: 'Game settings updated successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating game settings:', error);
		return res.status(500).json({
			success: false,
			error: 'Failed to update game settings',
		} as ApiResponse);
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
		return res.json({
			success: true,
			data: settings || defaultGameSettings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching economy settings:', error);
		return res.status(500).json({
			success: false,
			error: 'Failed to fetch economy settings',
		} as ApiResponse);
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

		return res.json({
			success: true,
			data: updated,
			message: 'Economy settings updated successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating economy settings:', error);
		return res.status(500).json({
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

		return res.json({
			success: true,
			data: {
				questions,
				pagination: {
					page: parseInt(page as string),
					limit: take,
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching trivia questions:', error);
		return res.status(500).json({
			success: false,
			error: 'Failed to fetch trivia questions',
		} as ApiResponse);
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
		return res.status(201).json({
			success: true,
			data: question,
			message: 'Trivia question added successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error adding trivia question:', error);
		return res.status(500).json({
			success: false,
			error: 'Failed to add trivia question',
		} as ApiResponse);
	}
};
