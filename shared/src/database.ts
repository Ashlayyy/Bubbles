// Database client and types for shared use
import { PrismaClient, Prisma } from '@prisma/client';

// Create and export a configured Prisma client instance
export const createPrismaClient = (options?: Prisma.PrismaClientOptions) => {
	return new PrismaClient(options);
};

// Re-export all Prisma types and utilities
export * from '@prisma/client';

// Export a default client instance
export const prisma = new PrismaClient();
