const { Queue, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

// Load environment variables
require('dotenv').config({ path: '../.env' });

console.log('=== BullMQ Debug Script ===');
console.log('Environment variables:');
console.log('REDIS_HOST:', process.env.REDIS_HOST);
console.log('REDIS_PORT:', process.env.REDIS_PORT);
console.log(
	'REDIS_PASSWORD:',
	process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]'
);
console.log('DISABLE_QUEUES:', process.env.DISABLE_QUEUES);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('');

// Test 1: Direct IORedis connection (like the working test)
console.log('=== Test 1: Direct IORedis Connection ===');
const directConnection = new IORedis({
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT || '6379', 10),
	password: process.env.REDIS_PASSWORD || undefined,
	db: 0,
	maxRetriesPerRequest: null,
	enableReadyCheck: true,
	connectTimeout: 60_000,
	commandTimeout: 60_000,
	enableOfflineQueue: true,
	lazyConnect: true,
	keepAlive: 30000,
	family: 4,
	showFriendlyErrorStack: true,
});

directConnection.on('connect', () => console.log('[Direct] Redis connected'));
directConnection.on('ready', () => console.log('[Direct] Redis ready'));
directConnection.on('error', (err) =>
	console.error('[Direct] Redis error:', err.message)
);
directConnection.on('close', () => console.warn('[Direct] Redis closed'));
directConnection.on('reconnecting', (delay) =>
	console.log(`[Direct] Redis reconnecting in ${delay}ms`)
);

// Test 2: BullMQ connection (like the bot uses)
console.log('\n=== Test 2: BullMQ Connection ===');
const bullMQConnection = new IORedis({
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT || '6379', 10),
	password: process.env.REDIS_PASSWORD || undefined,
	db: 0,
	maxRetriesPerRequest: null,
	enableReadyCheck: true,
	connectTimeout: 60_000,
	commandTimeout: 60_000,
	enableOfflineQueue: true,
	lazyConnect: true,
	keepAlive: 30000,
	family: 4,
	showFriendlyErrorStack: true,
});

bullMQConnection.on('connect', () => console.log('[BullMQ] Redis connected'));
bullMQConnection.on('ready', () => console.log('[BullMQ] Redis ready'));
bullMQConnection.on('error', (err) =>
	console.error('[BullMQ] Redis error:', err.message)
);
bullMQConnection.on('close', () => console.warn('[BullMQ] Redis closed'));
bullMQConnection.on('reconnecting', (delay) =>
	console.log(`[BullMQ] Redis reconnecting in ${delay}ms`)
);

// Test 3: BullMQ Events connection
console.log('\n=== Test 3: BullMQ Events Connection ===');
const eventsConnection = new IORedis({
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT || '6379', 10),
	password: process.env.REDIS_PASSWORD || undefined,
	db: 0,
	maxRetriesPerRequest: null,
	enableReadyCheck: true,
	connectTimeout: 30_000,
	commandTimeout: 0, // No timeout for blocking commands
	enableOfflineQueue: true,
	lazyConnect: true,
	keepAlive: 30000,
	family: 4,
	showFriendlyErrorStack: true,
});

eventsConnection.on('connect', () => console.log('[Events] Redis connected'));
eventsConnection.on('ready', () => console.log('[Events] Redis ready'));
eventsConnection.on('error', (err) =>
	console.error('[Events] Redis error:', err.message)
);
eventsConnection.on('close', () => console.warn('[Events] Redis closed'));
eventsConnection.on('reconnecting', (delay) =>
	console.log(`[Events] Redis reconnecting in ${delay}ms`)
);

async function runTests() {
	try {
		console.log('\n=== Running Connection Tests ===');

		// Test direct connection
		console.log('\n1. Testing direct connection...');
		await directConnection.ping();
		console.log('✓ Direct connection ping successful');

		// Test BullMQ connection
		console.log('\n2. Testing BullMQ connection...');
		await bullMQConnection.ping();
		console.log('✓ BullMQ connection ping successful');

		// Test events connection
		console.log('\n3. Testing events connection...');
		await eventsConnection.ping();
		console.log('✓ Events connection ping successful');

		// Test Queue creation
		console.log('\n4. Testing Queue creation...');
		const testQueue = new Queue('test-queue', {
			connection: bullMQConnection,
			defaultJobOptions: {
				removeOnComplete: 100,
				removeOnFail: 50,
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 2_000,
				},
			},
		});
		console.log('✓ Queue created successfully');

		// Test QueueEvents creation
		console.log('\n5. Testing QueueEvents creation...');
		const testQueueEvents = new QueueEvents('test-queue', {
			connection: eventsConnection,
		});
		console.log('✓ QueueEvents created successfully');

		// Test job addition
		console.log('\n6. Testing job addition...');
		const job = await testQueue.add('test-job', { data: 'test' });
		console.log('✓ Job added successfully:', job.id);

		// Test job processing
		console.log('\n7. Testing job processing...');
		const worker = testQueue.process('test-job', async (job) => {
			console.log('✓ Job processed:', job.data);
			return 'success';
		});

		// Wait for job to complete
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Cleanup
		console.log('\n8. Cleaning up...');
		await worker.close();
		await testQueue.close();
		await testQueueEvents.close();
		await directConnection.disconnect();
		await bullMQConnection.disconnect();
		await eventsConnection.disconnect();

		console.log('\n=== All Tests Passed! ===');
		console.log(
			"The issue is likely in the bot's initialization timing or environment loading."
		);
	} catch (error) {
		console.error('\n=== Test Failed ===');
		console.error('Error:', error.message);
		console.error('Stack:', error.stack);

		// Cleanup on error
		try {
			await directConnection.disconnect();
			await bullMQConnection.disconnect();
			await eventsConnection.disconnect();
		} catch (cleanupError) {
			console.error('Cleanup error:', cleanupError.message);
		}
	}
}

// Run tests after a short delay to ensure connections are ready
setTimeout(runTests, 1000);
