import { prisma } from "../../../config/prisma";
import { WebsiteRecrutamento } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:recrutamento:list";

export const recrutamentoService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteRecrutamento.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteRecrutamento.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteRecrutamento, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteRecrutamento.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteRecrutamento>) => {
    const result = await prisma.websiteRecrutamento.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteRecrutamento.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};
