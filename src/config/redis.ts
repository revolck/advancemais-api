import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || '', { lazyConnect: true });

if (process.env.REDIS_URL) {
  redis
    .connect()
    .catch((err) => console.error('Redis connection error:', err));
}

export default redis;
