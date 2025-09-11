import { prisma } from "../../../config/prisma";
import { WebsiteRecrutamentoSelecao } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:recrutamentoSelecao:list";

export const recrutamentoSelecaoService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteRecrutamentoSelecao.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteRecrutamentoSelecao.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteRecrutamentoSelecao, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteRecrutamentoSelecao.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteRecrutamentoSelecao>) => {
    const result = await prisma.websiteRecrutamentoSelecao.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteRecrutamentoSelecao.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};

