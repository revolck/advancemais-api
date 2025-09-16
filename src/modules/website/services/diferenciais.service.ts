import { WebsiteDiferenciais } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:diferenciais:list';

export const diferenciaisService = {
  list: async () => {
    const cached = await getCache<WebsiteDiferenciais[]>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteDiferenciais.findMany();
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteDiferenciais.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteDiferenciais, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteDiferenciais.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteDiferenciais>) => {
    const result = await prisma.websiteDiferenciais.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteDiferenciais.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
