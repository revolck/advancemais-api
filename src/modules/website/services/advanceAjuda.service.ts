import { prisma } from "../../../config/prisma";
import { WebsiteAdvanceAjuda } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:advanceAjuda:list";

export const advanceAjudaService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteAdvanceAjuda.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteAdvanceAjuda.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteAdvanceAjuda, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteAdvanceAjuda.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteAdvanceAjuda>) => {
    const result = await prisma.websiteAdvanceAjuda.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteAdvanceAjuda.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};

