import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireUniversalPermissions } from '../middleware/permissions.js';
import { validateZod } from '../validation/zodValidate.js';
import { z } from 'zod';
import {
	getUserEconomy,
	getEconomyLeaderboard,
	addCurrency,
	transferCurrency,
	claimDaily,
	getShopItems,
	createShopItem,
	purchaseShopItem,
	getEconomyStatistics,
} from '../controllers/economyController.js';

const router = express.Router();

// Validation schemas
const addCurrencySchema = z.object({
	amount: z.number().positive(),
	reason: z.string().optional(),
});

const transferCurrencySchema = z.object({
	fromUserId: z.string(),
	toUserId: z.string(),
	amount: z.number().positive(),
	reason: z.string().optional(),
});

const createShopItemSchema = z.object({
	itemId: z.string(),
	name: z.string(),
	description: z.string().optional(),
	price: z.number().positive(),
	category: z.string().optional(),
	stock: z.number().optional(),
});

const purchaseShopItemSchema = z.object({
	userId: z.string(),
	quantity: z.number().positive().optional(),
});

// User economy routes
router.get(
	'/guilds/:guildId/users/:userId',
	authenticateToken,
	requireUniversalPermissions(['VIEW_ECONOMY']),
	getUserEconomy
);
router.get(
	'/guilds/:guildId/leaderboard',
	authenticateToken,
	requireUniversalPermissions(['VIEW_ECONOMY']),
	getEconomyLeaderboard
);
router.get(
	'/guilds/:guildId/statistics',
	authenticateToken,
	requireUniversalPermissions(['VIEW_ECONOMY']),
	getEconomyStatistics
);

// Currency management routes
router.post(
	'/guilds/:guildId/users/:userId/add',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_ECONOMY']),
	validateZod(addCurrencySchema),
	addCurrency
);
router.post(
	'/guilds/:guildId/transfer',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_ECONOMY']),
	validateZod(transferCurrencySchema),
	transferCurrency
);
router.post(
	'/guilds/:guildId/users/:userId/daily',
	authenticateToken,
	requireUniversalPermissions(['USE_ECONOMY']),
	claimDaily
);

// Shop routes
router.get(
	'/guilds/:guildId/shop',
	authenticateToken,
	requireUniversalPermissions(['VIEW_ECONOMY']),
	getShopItems
);
router.post(
	'/guilds/:guildId/shop',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_ECONOMY']),
	validateZod(createShopItemSchema),
	createShopItem
);
router.post(
	'/guilds/:guildId/shop/:itemId/purchase',
	authenticateToken,
	requireUniversalPermissions(['USE_ECONOMY']),
	validateZod(purchaseShopItemSchema),
	purchaseShopItem
);

export default router;
