import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

async function testRedis() {
    console.log('Testing Redis Connection...');
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.error('No REDIS_URL found in process.env');
        process.exit(1);
    }

    console.log(`Connecting to: ${redisUrl}`);
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

    redis.on('error', (err) => {
        console.error('Redis connection error:', err);
        process.exit(1);
    });

    try {
        const ping = await redis.ping();
        console.log(`Redis connection successful! Ping response: ${ping}`);
        process.exit(0);
    } catch (error) {
        console.error('Redis Ping failed:', error);
        process.exit(1);
    }
}

testRedis();
