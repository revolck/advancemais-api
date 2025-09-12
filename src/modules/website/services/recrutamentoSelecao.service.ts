import { prisma } from "../../../config/prisma";
import { WebsiteRecrutamentoSelecao } from "@prisma/client";
import { getCache, setCache, invalidateCache } from "../../../utils/cache";

const CACHE_KEY = "website:recrutamentoSelecao:list";

export const recrutamentoSelecaoService = {
  list: async () => {
    const cached = await getCache(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteRecrutamentoSelecao.findMany();
    await setCache(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteRecrutamentoSelecao.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteRecrutamentoSelecao, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteRecrutamentoSelecao.create({ data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteRecrutamentoSelecao>) => {
    const result = await prisma.websiteRecrutamentoSelecao.update({ where: { id }, data });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteRecrutamentoSelecao.delete({ where: { id } });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};

