#!/usr/bin/env node

/**
 * Simple Redis test to verify connection works with BullMQ-like configuration
 */

const { config } = require('dotenv');
const { resolve } = require('path');
const IORedis = require('ioredis');

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

console.log('🔧 Testing Redis Connection with BullMQ-like Configuration...');
console.log(`Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
console.log(`Redis Port: ${process.env.REDIS_PORT || '6379'}`);
console.log(
	`Redis Password: ${process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]'}`
);

async function testRedisConnections() {
	try {
		// Test 1: Main connection (like BullMQ main connection)
		console.log('\n🧪 Test 1: Main Connection (BullMQ-like config)...');
		const mainConnection = new IORedis({
			host: process.env.REDIS_HOST || 'localhost',
			port: parseInt(process.env.REDIS_PORT || '6379', 10),
			password: process.env.REDIS_PASSWORD || undefined,
			db: 0,
			maxRetriesPerRequest: null,
			enableReadyCheck: true,
			connectTimeout: 100_000,
			commandTimeout: 60_000,
			enableOfflineQueue: true,
			lazyConnect: true,
			keepAlive: 30000,
			family: 4,
			showFriendlyErrorStack: true,
		});

		mainConnection.on('connect', () => console.log('[Main] Redis connected'));
		mainConnection.on('ready', () => console.log('[Main] Redis ready'));
		mainConnection.on('error', (err) =>
			console.error('[Main] Redis error:', err.message)
		);
		mainConnection.on('close', () => console.warn('[Main] Redis closed'));

		// Test 2: Events connection (like BullMQ events connection with fixed timeout)
		console.log('\n🧪 Test 2: Events Connection (Fixed BullMQ-like config)...');
		const eventsConnection = new IORedis({
			host: process.env.REDIS_HOST || 'localhost',
			port: parseInt(process.env.REDIS_PORT || '6379', 10),
			password: process.env.REDIS_PASSWORD || undefined,
			db: 0,
			maxRetriesPerRequest: null,
			enableReadyCheck: true,
			connectTimeout: 100_000,
			commandTimeout: 30_000, // Fixed: Use 30s timeout instead of 0
			enableOfflineQueue: true,
			lazyConnect: true,
			keepAlive: 30000,
			family: 4,
			showFriendlyErrorStack: true,
		});

		eventsConnection.on('connect', () =>
			console.log('[Events] Redis connected')
		);
		eventsConnection.on('ready', () => console.log('[Events] Redis ready'));
		eventsConnection.on('error', (err) =>
			console.error('[Events] Redis error:', err.message)
		);
		eventsConnection.on('close', () => console.warn('[Events] Redis closed'));

		// Wait for connections to establish
		console.log('\n⏳ Waiting for connections to establish...');
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Test main connection
		console.log('\n🧪 Testing main connection...');
		const mainPing = await mainConnection.ping();
		console.log('✅ Main connection ping successful:', mainPing);

		// Test events connection
		console.log('\n🧪 Testing events connection...');
		const eventsPing = await eventsConnection.ping();
		console.log('✅ Events connection ping successful:', eventsPing);

		// Test basic operations
		console.log('\n🧪 Testing basic operations...');
		await mainConnection.set('test:key', 'test:value');
		const value = await mainConnection.get('test:key');
		console.log('✅ SET/GET successful:', value);

		// Clean up
		await mainConnection.del('test:key');
		console.log('✅ Cleanup successful');

		console.log('\n🎉 All Redis tests passed!');
		console.log('✅ The BullMQ configuration should now work correctly');
	} catch (error) {
		console.error('\n❌ Test failed:', error.message);
		console.error('Stack:', error.stack);
	} finally {
		// Cleanup
		try {
			await mainConnection?.disconnect();
			await eventsConnection?.disconnect();
			console.log('\n👋 Connections closed');
		} catch (error) {
			console.error('Cleanup error:', error.message);
		}
		process.exit(0);
	}
}

// Run the test
testRedisConnections();
