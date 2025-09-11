import { prisma } from "../../../config/prisma";
import { WebsiteTreinamentoCompany } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:treinamentoCompany:list";

export const treinamentoCompanyService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteTreinamentoCompany.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteTreinamentoCompany.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteTreinamentoCompany, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteTreinamentoCompany.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteTreinamentoCompany>) => {
    const result = await prisma.websiteTreinamentoCompany.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteTreinamentoCompany.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};

