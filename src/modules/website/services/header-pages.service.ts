import { prisma } from "../../../config/prisma";
import { WebsiteHeaderPage } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:headerPages:list";

export const headerPagesService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteHeaderPage.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteHeaderPage.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteHeaderPage, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteHeaderPage.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteHeaderPage>) => {
    const result = await prisma.websiteHeaderPage.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteHeaderPage.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};
