import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || "", { lazyConnect: true });

if (process.env.REDIS_URL) {
  redis
    .connect()
    .then(async () => {
      try {
        await redis.ping();
        console.log("✅ Redis conectado");
      } catch (err) {
        console.error("❌ Redis ping falhou:", err);
      }
    })
    .catch((err) => console.error("Redis connection error:", err));
} else {
  console.warn("⚠️ REDIS_URL não configurada - Redis desativado");
}

export default redis;
