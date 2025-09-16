import Redis from 'ioredis';
import { logger } from '@/utils/logger';

const redisUrl = process.env.REDIS_URL || '';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

if (process.env.REDIS_URL) {
  redis.on('connect', () => {
    logger.info({ service: 'redis' }, '✅ Redis conectado');
  });

  redis.on('error', (error) => {
    logger.error({ service: 'redis', err: error }, '❌ Redis connection error');
  });

  redis
    .connect()
    .then(async () => {
      try {
        await redis.ping();
      } catch (error) {
        logger.error({ service: 'redis', err: error }, '❌ Redis ping falhou após conexão');
      }
    })
    .catch((error) => {
      logger.error({ service: 'redis', err: error }, '❌ Redis initial connection error');
    });
} else if (process.env.NODE_ENV !== 'test') {
  logger.warn('⚠️ REDIS_URL não configurada - Redis desativado');
}

export default redis;
