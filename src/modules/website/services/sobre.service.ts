import { prisma } from "../../../config/prisma";
import { WebsiteSobre } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:sobre:list";

export const sobreService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteSobre.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) => prisma.websiteSobre.findUnique({ where: { id } }),
  create: async (data: Omit<WebsiteSobre, "id" | "criadoEm" | "atualizadoEm">) => {
    const result = await prisma.websiteSobre.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteSobre>) => {
    const result = await prisma.websiteSobre.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteSobre.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};
