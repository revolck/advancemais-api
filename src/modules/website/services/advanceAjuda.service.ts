import { prisma } from "../../../config/prisma";
import { WebsiteAdvanceAjuda } from "@prisma/client";
import { getCache, setCache, invalidateCache } from "../../../utils/cache";

const CACHE_KEY = "website:advanceAjuda:list";

export const advanceAjudaService = {
  list: async () => {
    const cached = await getCache(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteAdvanceAjuda.findMany();
    await setCache(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteAdvanceAjuda.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteAdvanceAjuda, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteAdvanceAjuda.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteAdvanceAjuda>) => {
    const result = await prisma.websiteAdvanceAjuda.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteAdvanceAjuda.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};

