import { WebsiteSobreEmpresa } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:sobreEmpresa:list';

export const sobreEmpresaService = {
  list: async () => {
    const cached = await getCache<WebsiteSobreEmpresa[]>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteSobreEmpresa.findMany();
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteSobreEmpresa.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteSobreEmpresa, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteSobreEmpresa.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteSobreEmpresa>) => {
    const result = await prisma.websiteSobreEmpresa.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteSobreEmpresa.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
