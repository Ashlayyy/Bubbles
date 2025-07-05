import { createPrismaClient } from '../../../shared/src/database';
import { createLogger } from '../types/shared.js';

const logger = createLogger('database-service');

// Shared Prisma client instance
let prisma: any | null = null;

export const initializePrisma = async (): Promise<any> => {
	if (prisma) {
		return prisma;
	}

	try {
		prisma = createPrismaClient();

		// Test the connection
		await prisma.$connect();
		logger.info('✅ Database connected successfully');

		return prisma;
	} catch (error) {
		logger.error('❌ Failed to connect to database:', error);
		throw error;
	}
};

export const getPrismaClient = (): any => {
	if (!prisma) {
		throw new Error(
			'Prisma client not initialized. Call initializePrisma() first.'
		);
	}
	return prisma;
};

export const closePrisma = async (): Promise<void> => {
	if (prisma) {
		await prisma.$disconnect();
		prisma = null;
		logger.info('Database connection closed');
	}
};

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
	try {
		if (!prisma) {
			return false;
		}

		// Use Mongo-specific ping command if available, otherwise fall back to a simple SQL query
		if (typeof prisma.$runCommandRaw === 'function') {
			// MongoDB provider
			await prisma.$runCommandRaw({ ping: 1 });
		} else if (typeof prisma.$queryRaw === 'function') {
			// SQL providers
			await prisma.$queryRaw`SELECT 1`;
		}
		return true;
	} catch (error) {
		logger.error('Database health check failed:', error);
		return false;
	}
};

// Export the initialized prisma instance for direct use
export { prisma };
