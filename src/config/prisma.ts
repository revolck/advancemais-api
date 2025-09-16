import { PrismaClient } from '@prisma/client';

// Prefer an IPv4-compatible connection string if provided
// This allows deployments in environments without IPv6 support
let datasourceUrl = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL || '';

// Ensure pooling params if not present in connection string
if (datasourceUrl && !datasourceUrl.includes('connection_limit')) {
  const separator = datasourceUrl.includes('?') ? '&' : '?';
  datasourceUrl += `${separator}pgbouncer=true&connection_limit=5`;
}

// Create a singleton Prisma client so that the connection pool is shared
// across the entire application runtime. When pooling parameters aren't
// provided via the connection string, fallback to a max of 5 connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const client = new PrismaClient({
    datasourceUrl,
    log: [{ emit: 'event', level: 'error' }],
  });
  if (process.env.NODE_ENV !== 'test') {
    client
      .$connect()
      .then(() => console.log('✅ Prisma conectado'))
      .catch((err) => console.error('❌ Erro ao conectar ao Prisma', err));
  }

  client.$on('error', (e) => {
    console.error('🔥 Prisma error', e);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
