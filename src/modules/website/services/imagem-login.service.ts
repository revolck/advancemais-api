import { WebsiteImagemLogin } from '@prisma/client';
import { prisma, retryOperation } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:imagemLogin:list';

export const imagemLoginService = {
  list: async () => {
    const cached = await getCache<WebsiteImagemLogin[]>(CACHE_KEY);
    if (cached) return cached;
    // 🔄 Usar retry logic para evitar timeout
    const result = await retryOperation(
      async () => await prisma.websiteImagemLogin.findMany(),
      3,
      1500,
    );
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) => prisma.websiteImagemLogin.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteImagemLogin, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const result = await prisma.websiteImagemLogin.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteImagemLogin>) => {
    const result = await prisma.websiteImagemLogin.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteImagemLogin.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
