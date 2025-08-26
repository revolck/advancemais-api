import { prisma } from "../../../config/prisma";
import { WebsiteAdanceAjuda } from "@prisma/client";

export const adanceAjudaService = {
  list: () => prisma.websiteAdanceAjuda.findMany(),
  get: (id: string) =>
    prisma.websiteAdanceAjuda.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteAdanceAjuda, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteAdanceAjuda.create({ data }),
  update: (id: string, data: Partial<WebsiteAdanceAjuda>) =>
    prisma.websiteAdanceAjuda.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteAdanceAjuda.delete({ where: { id } }),
};

