import { prisma } from "../../../config/prisma";
import { WebsiteTreinamentosInCompany } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:treinamentosInCompany:list";

export const treinamentosInCompanyService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteTreinamentosInCompany.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) =>
    prisma.websiteTreinamentosInCompany.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteTreinamentosInCompany, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteTreinamentosInCompany.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteTreinamentosInCompany>) => {
    const result = await prisma.websiteTreinamentosInCompany.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteTreinamentosInCompany.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};

