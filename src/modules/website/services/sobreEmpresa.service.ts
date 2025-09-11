import { prisma } from "../../../config/prisma";
import { WebsiteSobreEmpresa } from "@prisma/client";
import cache from "../../../utils/cache";

const CACHE_KEY = "website:sobreEmpresa:list";

export const sobreEmpresaService = {
  list: async () => {
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteSobreEmpresa.findMany();
    await cache.set(CACHE_KEY, result);
    return result;
  },
  get: (id: string) => prisma.websiteSobreEmpresa.findUnique({ where: { id } }),
  create: async (
    data: Omit<WebsiteSobreEmpresa, "id" | "criadoEm" | "atualizadoEm">
  ) => {
    const result = await prisma.websiteSobreEmpresa.create({ data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Partial<WebsiteSobreEmpresa>) => {
    const result = await prisma.websiteSobreEmpresa.update({ where: { id }, data });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteSobreEmpresa.delete({ where: { id } });
    await cache.invalidate(CACHE_KEY);
    return result;
  },
};

