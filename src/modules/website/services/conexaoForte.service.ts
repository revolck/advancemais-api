import { prisma } from "../../../config/prisma";
import { WebsiteConexaoForte } from "@prisma/client";
import { getCache, setCache, invalidateCache } from "../../../utils/cache";

const CACHE_KEY = "website:conexaoForte:list";

export const conexaoForteService = {
  list: async () => {
    const cached = await getCache(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteConexaoForte.findMany();
    await setCache(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteConexaoForte.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteConexaoForte, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteConexaoForte.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteConexaoForte>) => {
    const result = await prisma.websiteConexaoForte.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteConexaoForte.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};

