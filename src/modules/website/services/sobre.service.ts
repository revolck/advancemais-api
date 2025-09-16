import { WebsiteSobre } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:sobre:list';

export const sobreService = {
  list: async () => {
    const cached = await getCache<WebsiteSobre[]>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteSobre.findMany();
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteSobre.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteSobre, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteSobre.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteSobre>) => {
    const result = await prisma.websiteSobre.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteSobre.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
