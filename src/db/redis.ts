import { Redis } from 'ioredis';

let redis: Redis;

const getRedisConnection = () => {
    if (redis) return redis;

    if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    } else {
        redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null,
        });
    }

    redis.on('error', (err: any) => {
        console.error('❌ [Redis Error]:', err.message);
    });

    return redis;
};

export const redisConnection = getRedisConnection();
