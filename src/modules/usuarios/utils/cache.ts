import { invalidateCache, invalidateCacheByPrefix } from '@/utils/cache';
import { prisma } from '@/config/prisma';

export async function invalidateUserCache(
  usuario: { authId?: string; id?: string } | string | null,
) {
  let id: string | undefined;

  if (typeof usuario === 'string') {
    id = usuario;
  } else {
    id = usuario?.id;
  }

  const keys: string[] = [];
  if (id) keys.push(`user:${id}`);
  if (keys.length) {
    await invalidateCache(keys);
  }

  await invalidateCacheByPrefix('stats:user:');
}
