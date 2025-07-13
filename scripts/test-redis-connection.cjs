#!/usr/bin/env node

/**
 * Test script to verify Redis connection works properly
 * Run with: node scripts/test-redis-connection.js
 */

import { config } from 'dotenv';
import Redis from 'ioredis';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
config({ path: resolve(__dirname, '../.env') });

console.log('🔧 Testing Redis connection...');
console.log(`Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
console.log(`Redis Port: ${process.env.REDIS_PORT || '6379'}`);
console.log(
	`Redis Password: ${process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]'}`
);

// Test the fixed configuration
const redis = new Redis({
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT || '6379'),
	password: process.env.REDIS_PASSWORD || undefined, // Use undefined instead of empty string
	db: parseInt(process.env.REDIS_DB || '0'),
	maxRetriesPerRequest: null,
	enableReadyCheck: true,
	connectTimeout: 10_000,
	commandTimeout: 10_000,
	enableOfflineQueue: false,
	lazyConnect: true,
	keepAlive: 30000,
	family: 4,
	showFriendlyErrorStack: true,
});

let connectionReady = false;

redis.on('connect', () => {
	console.log('✅ Redis connection established');
});

redis.on('ready', () => {
	console.log('✅ Redis ready for commands');
	connectionReady = true;
});

redis.on('error', (err) => {
	console.error('❌ Redis connection error:', err.message);
});

redis.on('close', () => {
	console.log('⚠️ Redis connection closed');
});

// Test a simple operation
async function testConnection() {
	try {
		// Wait for connection to be ready
		if (!connectionReady) {
			console.log('⏳ Waiting for Redis connection to be ready...');
			await new Promise((resolve) => {
				const checkReady = () => {
					if (connectionReady) {
						resolve();
					} else {
						setTimeout(checkReady, 100);
					}
				};
				checkReady();
			});
		}

		console.log('🧪 Testing PING command...');
		const result = await redis.ping();
		console.log(`✅ PING successful: ${result}`);

		console.log('🧪 Testing SET/GET commands...');
		await redis.set('test:connection', 'success');
		const value = await redis.get('test:connection');
		console.log(`✅ SET/GET successful: ${value}`);

		// Clean up
		await redis.del('test:connection');
		console.log('🧹 Cleaned up test key');

		console.log('🎉 All Redis tests passed!');
	} catch (error) {
		console.error('❌ Redis test failed:', error.message);
	} finally {
		await redis.quit();
		console.log('👋 Redis connection closed');
		process.exit(0);
	}
}

// Start the test after a short delay
setTimeout(testConnection, 1000);
