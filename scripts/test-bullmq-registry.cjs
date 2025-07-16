#!/usr/bin/env node

/**
 * Simple test script to verify BullMQ registry connection logic
 */

const { config } = require('dotenv');
const { resolve } = require('path');

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

console.log('🔧 Testing BullMQ Registry Connection Logic...');
console.log(`Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
console.log(`Redis Port: ${process.env.REDIS_PORT || '6379'}`);
console.log(
	`Redis Password: ${process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]'}`
);

// Import the BullMQ registry
const { bullMQRegistry } = require('../shared/src/queue/bullmq.js');

async function testRegistry() {
	try {
		console.log('\n🧪 Testing BullMQ Registry...');

		// Check initial status
		console.log('Initial status:', bullMQRegistry.getConnectionStatus());

		// Check availability
		const isAvailable = bullMQRegistry.isAvailable();
		console.log('Is available:', isAvailable);

		// Wait a bit and check again
		console.log('\n⏳ Waiting 3 seconds for connections to establish...');
		await new Promise((resolve) => setTimeout(resolve, 3000));

		console.log('Status after wait:', bullMQRegistry.getConnectionStatus());
		console.log('Is available after wait:', bullMQRegistry.isAvailable());

		if (bullMQRegistry.isAvailable()) {
			console.log('\n✅ BullMQ Registry is working correctly!');

			// Test queue creation
			console.log('\n🧪 Testing queue creation...');
			const testQueue = bullMQRegistry.getQueue('test-queue');
			if (testQueue) {
				console.log('✅ Test queue created successfully');

				// Clean up
				await testQueue.close();
				console.log('✅ Test queue closed');
			} else {
				console.log('❌ Failed to create test queue');
			}
		} else {
			console.log('\n❌ BullMQ Registry is not available');
		}
	} catch (error) {
		console.error('❌ Test failed:', error.message);
	} finally {
		// Cleanup
		await bullMQRegistry.shutdown();
		console.log('\n👋 BullMQ Registry shutdown complete');
		process.exit(0);
	}
}

// Run the test
testRegistry();
