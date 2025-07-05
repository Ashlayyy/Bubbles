// Database client and types for shared use
import { PrismaClient } from '@prisma/client';

// Derive the accepted options type from the PrismaClient constructor so that the
// code stays compatible across Prisma major versions (the public name of this
// type has changed between versions).
export type PrismaClientOptions = ConstructorParameters<typeof PrismaClient>[0];

// Create and export a configured Prisma client instance
export const createPrismaClient = (options?: PrismaClientOptions) => {
	return new PrismaClient(options);
};

// Re-export all Prisma types and utilities
export * from '@prisma/client';

// Export a default client instance
export const prisma = new PrismaClient();
