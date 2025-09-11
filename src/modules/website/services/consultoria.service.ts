import { prisma } from "../../../config/prisma";
import { WebsiteConsultoria } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:consultoria:list";

export const consultoriaService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteConsultoria.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteConsultoria.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteConsultoria, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteConsultoria.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteConsultoria>) => {
    const result = await prisma.websiteConsultoria.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteConsultoria.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};
