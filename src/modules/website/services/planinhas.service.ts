import { prisma } from "../../../config/prisma";
import { WebsitePlaninhas } from "@prisma/client";
import { getCache, setCache, invalidateCache } from "../../../utils/cache";

const CACHE_KEY = "website:planinhas:list";

export const planinhasService = {
  list: async () => {
    const cached = await getCache(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websitePlaninhas.findMany();
    await setCache(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websitePlaninhas.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsitePlaninhas, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websitePlaninhas.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsitePlaninhas>) => {
    const result = await prisma.websitePlaninhas.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websitePlaninhas.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};

