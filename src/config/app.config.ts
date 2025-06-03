export const appConfig = () => ({
  app: {
    name: process.env.APP_NAME || 'AdvancedMais API',
    version: process.env.APP_VERSION || '1.0.0',
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV || 'development',
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60000,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },
  security: {
    argon2: {
      memoryCost: parseInt(process.env.ARGON2_MEMORY_COST, 10) || 65536,
      timeCost: parseInt(process.env.ARGON2_TIME_COST, 10) || 3,
      parallelism: parseInt(process.env.ARGON2_PARALLELISM, 10) || 4,
    },
  },
});
