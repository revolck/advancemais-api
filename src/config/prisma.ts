import { PrismaClient } from "@prisma/client";

// Prefer an IPv4-compatible connection string if provided
// This allows deployments in environments without IPv6 support
const datasourceUrl =
  process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;

export const prisma = new PrismaClient({
  datasourceUrl,
});
