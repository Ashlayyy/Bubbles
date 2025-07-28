import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('economy-controller');

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'ECONOMY_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 9)}`,
	};
}

// Generate unique ID
function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Get user economy data
export const getUserEconomy = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const prisma = getPrismaClient();

		const userEconomy = await prisma.userEconomy.findUnique({
			where: { guildId_userId: { guildId, userId } },
			include: {
				transactions: {
					orderBy: { createdAt: 'desc' },
					take: 10,
				},
			},
		});

		if (!userEconomy) {
			// Create default user economy
			const newUserEconomy = await prisma.userEconomy.create({
				data: {
					guildId,
					userId,
					balance: BigInt(100), // Starting balance
					bank: BigInt(0),
					xp: 0,
					level: 1,
					streak: 0,
					inventory: [],
				},
				include: {
					transactions: true,
				},
			});

			return res.success(newUserEconomy);
		}

		res.success(userEconomy);
	} catch (error) {
		logger.error('Error getting user economy:', error);
		res.failure('Failed to get user economy', 500);
	}
};

// Get guild economy leaderboard
export const getEconomyLeaderboard = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { type = 'balance', limit = 10 } = req.query;
		const prisma = getPrismaClient();

		const orderBy = type === 'level' ? { level: 'desc' } : { balance: 'desc' };

		const leaderboard = await prisma.userEconomy.findMany({
			where: { guildId },
			orderBy: [orderBy, { xp: 'desc' }],
			take: parseInt(limit as string),
		});

		res.success(leaderboard);
	} catch (error) {
		logger.error('Error getting economy leaderboard:', error);
		res.failure('Failed to get economy leaderboard', 500);
	}
};

// Add currency to user
export const addCurrency = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const { amount, reason = 'Admin addition' } = req.body;
		const prisma = getPrismaClient();

		if (!amount || amount <= 0) {
			return res.failure('Amount must be positive', 400);
		}

		const userEconomy = await prisma.userEconomy.upsert({
			where: { guildId_userId: { guildId, userId } },
			update: {
				balance: { increment: BigInt(amount) },
			},
			create: {
				guildId,
				userId,
				balance: BigInt(amount + 100), // Starting balance + amount
				bank: BigInt(0),
				xp: 0,
				level: 1,
				streak: 0,
				inventory: [],
			},
		});

		// Log transaction
		await prisma.economyTransaction.create({
			data: {
				guildId,
				userId,
				type: 'earn',
				amount: BigInt(amount),
				reason,
				metadata: { addedBy: req.user?.id },
			},
		});

		// Broadcast currency update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('currencyAdd', {
				userId,
				amount,
				newBalance: userEconomy.balance.toString(),
				reason,
			})
		);

		logger.info(
			`Added ${amount} currency to user ${userId} in guild ${guildId}`,
			{
				amount,
				reason,
				addedBy: req.user?.id,
			}
		);

		res.success({
			message: 'Currency added successfully',
			newBalance: userEconomy.balance.toString(),
			amount,
		});
	} catch (error) {
		logger.error('Error adding currency:', error);
		res.failure('Failed to add currency', 500);
	}
};

// Transfer currency between users
export const transferCurrency = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { fromUserId, toUserId, amount, reason = 'User transfer' } = req.body;
		const prisma = getPrismaClient();

		if (!amount || amount <= 0) {
			return res.failure('Amount must be positive', 400);
		}

		if (fromUserId === toUserId) {
			return res.failure('Cannot transfer to yourself', 400);
		}

		// Use transaction to ensure atomicity
		const result = await prisma.$transaction(async (tx: any) => {
			// Get sender's economy
			const senderEconomy = await tx.userEconomy.findUnique({
				where: { guildId_userId: { guildId, userId: fromUserId } },
			});

			if (!senderEconomy || senderEconomy.balance < BigInt(amount)) {
				throw new Error('Insufficient funds');
			}

			// Update sender
			const updatedSender = await tx.userEconomy.update({
				where: { guildId_userId: { guildId, userId: fromUserId } },
				data: { balance: { decrement: BigInt(amount) } },
			});

			// Update receiver
			const updatedReceiver = await tx.userEconomy.upsert({
				where: { guildId_userId: { guildId, userId: toUserId } },
				update: { balance: { increment: BigInt(amount) } },
				create: {
					guildId,
					userId: toUserId,
					balance: BigInt(amount + 100), // Starting balance + transfer
					bank: BigInt(0),
					xp: 0,
					level: 1,
					streak: 0,
					inventory: [],
				},
			});

			// Log transactions
			await tx.economyTransaction.createMany({
				data: [
					{
						guildId,
						userId: fromUserId,
						type: 'transfer',
						amount: BigInt(-amount),
						reason: `Transfer to user ${toUserId}: ${reason}`,
						metadata: { toUserId, transferType: 'outgoing' },
					},
					{
						guildId,
						userId: toUserId,
						type: 'transfer',
						amount: BigInt(amount),
						reason: `Transfer from user ${fromUserId}: ${reason}`,
						metadata: { fromUserId, transferType: 'incoming' },
					},
				],
			});

			return { updatedSender, updatedReceiver };
		});

		// Broadcast transfer
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('currencyTransfer', {
				fromUserId,
				toUserId,
				amount,
				reason,
			})
		);

		logger.info(
			`Transferred ${amount} currency from ${fromUserId} to ${toUserId}`,
			{
				guildId,
				amount,
				reason,
			}
		);

		res.success({
			message: 'Currency transferred successfully',
			senderBalance: result.updatedSender.balance.toString(),
			receiverBalance: result.updatedReceiver.balance.toString(),
			amount,
		});
	} catch (error: any) {
		logger.error('Error transferring currency:', error);
		if (error.message === 'Insufficient funds') {
			res.failure('Insufficient funds for transfer', 400);
		} else {
			res.failure('Failed to transfer currency', 500);
		}
	}
};

// Claim daily reward
export const claimDaily = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const prisma = getPrismaClient();

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		const userEconomy = await prisma.userEconomy.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});

		if (!userEconomy) {
			return res.failure('User not found in economy system', 404);
		}

		// Check if already claimed today
		if (userEconomy.lastDaily) {
			const lastDailyDate = new Date(userEconomy.lastDaily);
			const lastDailyDay = new Date(
				lastDailyDate.getFullYear(),
				lastDailyDate.getMonth(),
				lastDailyDate.getDate()
			);

			if (lastDailyDay.getTime() === today.getTime()) {
				const nextDaily = new Date(today);
				nextDaily.setDate(nextDaily.getDate() + 1);
				return res.failure(
					`Daily reward already claimed. Next reward available at: ${nextDaily.toISOString()}`,
					400
				);
			}
		}

		// Calculate streak and reward
		let newStreak = 1;
		if (userEconomy.lastDaily) {
			const yesterday = new Date(today);
			yesterday.setDate(yesterday.getDate() - 1);
			const lastDailyDate = new Date(userEconomy.lastDaily);
			const lastDailyDay = new Date(
				lastDailyDate.getFullYear(),
				lastDailyDate.getMonth(),
				lastDailyDate.getDate()
			);

			if (lastDailyDay.getTime() === yesterday.getTime()) {
				newStreak = userEconomy.streak + 1;
			}
		}

		// Calculate reward based on streak
		const baseReward = 50;
		const streakBonus = Math.min(newStreak * 10, 200); // Max 200 bonus
		const totalReward = baseReward + streakBonus;

		// Update user economy
		const updatedEconomy = await prisma.userEconomy.update({
			where: { guildId_userId: { guildId, userId } },
			data: {
				balance: { increment: BigInt(totalReward) },
				lastDaily: now,
				streak: newStreak,
			},
		});

		// Log transaction
		await prisma.economyTransaction.create({
			data: {
				guildId,
				userId,
				type: 'daily',
				amount: BigInt(totalReward),
				reason: `Daily reward (streak: ${newStreak})`,
				metadata: { streak: newStreak, baseReward, streakBonus },
			},
		});

		// Broadcast daily claim
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('dailyClaim', {
				userId,
				reward: totalReward,
				streak: newStreak,
				newBalance: updatedEconomy.balance.toString(),
			})
		);

		logger.info(
			`User ${userId} claimed daily reward: ${totalReward} (streak: ${newStreak})`,
			{
				guildId,
				userId,
				reward: totalReward,
				streak: newStreak,
			}
		);

		res.success({
			message: 'Daily reward claimed successfully',
			reward: totalReward,
			streak: newStreak,
			baseReward,
			streakBonus,
			newBalance: updatedEconomy.balance.toString(),
		});
	} catch (error) {
		logger.error('Error claiming daily reward:', error);
		res.failure('Failed to claim daily reward', 500);
	}
};

// Get shop items
export const getShopItems = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { category, page = 1, limit = 20 } = req.query;
		const prisma = getPrismaClient();

		const where: any = { guildId, enabled: true };
		if (category) where.category = category;

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		const [items, total] = await Promise.all([
			prisma.economyShop.findMany({
				where,
				orderBy: [{ category: 'asc' }, { name: 'asc' }],
				skip,
				take,
			}),
			prisma.economyShop.count({ where }),
		]);

		res.success({
			items,
			pagination: {
				page: parseInt(page as string),
				limit: take,
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error getting shop items:', error);
		res.failure('Failed to get shop items', 500);
	}
};

// Create shop item
export const createShopItem = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { itemId, name, description, price, category, stock } = req.body;
		const prisma = getPrismaClient();

		if (!itemId || !name || !price || price <= 0) {
			return res.failure('Item ID, name, and positive price are required', 400);
		}

		const item = await prisma.economyShop.create({
			data: {
				guildId,
				itemId,
				name,
				description: description || '',
				price: BigInt(price),
				category: category || 'general',
				stock: stock || null,
				enabled: true,
			},
		});

		logger.info(`Created shop item ${itemId} in guild ${guildId}`, {
			itemId,
			name,
			price,
			category,
		});

		res.success({
			message: 'Shop item created successfully',
			item,
		});
	} catch (error) {
		logger.error('Error creating shop item:', error);
		res.failure('Failed to create shop item', 500);
	}
};

// Purchase shop item
export const purchaseShopItem = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, itemId } = req.params;
		const { userId, quantity = 1 } = req.body;
		const prisma = getPrismaClient();

		if (!userId || quantity <= 0) {
			return res.failure('User ID and positive quantity are required', 400);
		}

		// Use transaction for atomicity
		const result = await prisma.$transaction(async (tx: any) => {
			// Get shop item
			const item = await tx.economyShop.findUnique({
				where: { guildId_itemId: { guildId, itemId } },
			});

			if (!item || !item.enabled) {
				throw new Error('Item not found or disabled');
			}

			// Check stock
			if (item.stock !== null && item.stock < quantity) {
				throw new Error('Insufficient stock');
			}

			const totalCost = item.price * BigInt(quantity);

			// Get user economy
			const userEconomy = await tx.userEconomy.findUnique({
				where: { guildId_userId: { guildId, userId } },
			});

			if (!userEconomy || userEconomy.balance < totalCost) {
				throw new Error('Insufficient funds');
			}

			// Update user balance
			const updatedEconomy = await tx.userEconomy.update({
				where: { guildId_userId: { guildId, userId } },
				data: {
					balance: { decrement: totalCost },
					inventory: {
						push: Array(quantity).fill({
							itemId,
							name: item.name,
							purchasedAt: new Date(),
						}),
					},
				},
			});

			// Update item stock
			if (item.stock !== null) {
				await tx.economyShop.update({
					where: { guildId_itemId: { guildId, itemId } },
					data: { stock: { decrement: quantity } },
				});
			}

			// Log transaction
			await tx.economyTransaction.create({
				data: {
					guildId,
					userId,
					type: 'spend',
					amount: BigInt(-totalCost),
					reason: `Purchased ${quantity}x ${item.name}`,
					metadata: { itemId, quantity, unitPrice: item.price.toString() },
				},
			});

			return { updatedEconomy, item, totalCost };
		});

		// Broadcast purchase
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('shopPurchase', {
				userId,
				itemId,
				quantity,
				totalCost: result.totalCost.toString(),
				newBalance: result.updatedEconomy.balance.toString(),
			})
		);

		logger.info(
			`User ${userId} purchased ${quantity}x ${itemId} for ${result.totalCost}`,
			{
				guildId,
				userId,
				itemId,
				quantity,
				totalCost: result.totalCost.toString(),
			}
		);

		res.success({
			message: 'Item purchased successfully',
			item: result.item.name,
			quantity,
			totalCost: result.totalCost.toString(),
			newBalance: result.updatedEconomy.balance.toString(),
		});
	} catch (error: any) {
		logger.error('Error purchasing shop item:', error);
		if (error.message === 'Item not found or disabled') {
			res.failure('Item not found or disabled', 404);
		} else if (error.message === 'Insufficient stock') {
			res.failure('Insufficient stock', 400);
		} else if (error.message === 'Insufficient funds') {
			res.failure('Insufficient funds', 400);
		} else {
			res.failure('Failed to purchase item', 500);
		}
	}
};

// Get economy statistics
export const getEconomyStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { timeframe = '30d' } = req.query;
		const prisma = getPrismaClient();

		// Calculate date range
		const now = new Date();
		let startDate = new Date();
		switch (timeframe) {
			case '24h':
				startDate.setHours(now.getHours() - 24);
				break;
			case '7d':
				startDate.setDate(now.getDate() - 7);
				break;
			case '30d':
				startDate.setDate(now.getDate() - 30);
				break;
			default:
				startDate.setDate(now.getDate() - 30);
		}

		const [
			totalUsers,
			totalCurrency,
			recentTransactions,
			topEarners,
			transactionVolume,
		] = await Promise.all([
			prisma.userEconomy.count({ where: { guildId } }),
			prisma.userEconomy.aggregate({
				where: { guildId },
				_sum: { balance: true, bank: true },
			}),
			prisma.economyTransaction.count({
				where: { guildId, createdAt: { gte: startDate } },
			}),
			prisma.userEconomy.findMany({
				where: { guildId },
				orderBy: { balance: 'desc' },
				take: 5,
			}),
			prisma.economyTransaction.aggregate({
				where: { guildId, createdAt: { gte: startDate } },
				_sum: { amount: true },
			}),
		]);

		const statistics = {
			timeframe,
			period: {
				start: startDate.toISOString(),
				end: now.toISOString(),
			},
			users: {
				total: totalUsers,
				active: recentTransactions,
			},
			currency: {
				totalInCirculation: (
					totalCurrency._sum.balance || BigInt(0)
				).toString(),
				totalInBank: (totalCurrency._sum.bank || BigInt(0)).toString(),
				totalSupply: (
					(totalCurrency._sum.balance || BigInt(0)) +
					(totalCurrency._sum.bank || BigInt(0))
				).toString(),
			},
			transactions: {
				count: recentTransactions,
				volume: (transactionVolume._sum.amount || BigInt(0)).toString(),
			},
			topEarners: topEarners.map((user: any) => ({
				userId: user.userId,
				balance: user.balance.toString(),
				level: user.level,
			})),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error getting economy statistics:', error);
		res.failure('Failed to get economy statistics', 500);
	}
};
