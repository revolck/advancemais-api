import { prisma } from "../../../config/prisma";
import { WebsiteHeaderPage } from "@prisma/client";
import { getCache, setCache, invalidateCache } from "../../../utils/cache";

const CACHE_KEY = "website:headerPages:list";

export const headerPagesService = {
  list: async () => {
    const cached = await getCache(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteHeaderPage.findMany();
    await setCache(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteHeaderPage.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteHeaderPage, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteHeaderPage.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteHeaderPage>) => {
    const result = await prisma.websiteHeaderPage.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteHeaderPage.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
