import { WebsiteRecrutamento } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:recrutamento:list';

export const recrutamentoService = {
  list: async () => {
    const cached = await getCache<WebsiteRecrutamento[]>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteRecrutamento.findMany();
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteRecrutamento.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteRecrutamento, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteRecrutamento.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteRecrutamento>) => {
    const result = await prisma.websiteRecrutamento.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteRecrutamento.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
