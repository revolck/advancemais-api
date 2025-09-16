import { WebsiteSistema } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:sistema:list';

export const sistemaService = {
  list: async () => {
    const cached = await getCache<WebsiteSistema[]>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteSistema.findMany();
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteSistema.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteSistema, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteSistema.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteSistema>) => {
    const result = await prisma.websiteSistema.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteSistema.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
