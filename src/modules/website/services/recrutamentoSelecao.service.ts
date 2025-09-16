import { WebsiteRecrutamentoSelecao } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:recrutamentoSelecao:list';

export const recrutamentoSelecaoService = {
  list: async () => {
    const cached = await getCache<WebsiteRecrutamentoSelecao[]>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteRecrutamentoSelecao.findMany();
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteRecrutamentoSelecao.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteRecrutamentoSelecao, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteRecrutamentoSelecao.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteRecrutamentoSelecao>) => {
    const result = await prisma.websiteRecrutamentoSelecao.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteRecrutamentoSelecao.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
