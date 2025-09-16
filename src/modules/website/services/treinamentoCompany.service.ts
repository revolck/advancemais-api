import { WebsiteTreinamentoCompany } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:treinamentoCompany:list';

export const treinamentoCompanyService = {
  list: async () => {
    const cached = await getCache<WebsiteTreinamentoCompany[]>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteTreinamentoCompany.findMany();
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteTreinamentoCompany.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteTreinamentoCompany, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteTreinamentoCompany.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteTreinamentoCompany>) => {
    const result = await prisma.websiteTreinamentoCompany.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteTreinamentoCompany.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
