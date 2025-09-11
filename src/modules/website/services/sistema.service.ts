import { prisma } from "../../../config/prisma";
import { WebsiteSistema } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:sistema:list";

export const sistemaService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteSistema.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteSistema.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteSistema, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteSistema.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteSistema>) => {
    const result = await prisma.websiteSistema.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteSistema.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};

