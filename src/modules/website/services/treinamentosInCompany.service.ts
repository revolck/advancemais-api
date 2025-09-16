import { WebsiteTreinamentosInCompany } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:treinamentosInCompany:list';

export const treinamentosInCompanyService = {
  list: async () => {
    const cached = await getCache<WebsiteTreinamentosInCompany[]>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteTreinamentosInCompany.findMany();
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteTreinamentosInCompany.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteTreinamentosInCompany, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteTreinamentosInCompany.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteTreinamentosInCompany>) => {
    const result = await prisma.websiteTreinamentosInCompany.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteTreinamentosInCompany.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
