import { prisma } from "../../../config/prisma";
import { WebsiteAdvanceAjuda } from "@prisma/client";

export const advanceAjudaService = {
  list: () => prisma.websiteAdvanceAjuda.findMany(),
  get: (id: string) =>
    prisma.websiteAdvanceAjuda.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteAdvanceAjuda, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteAdvanceAjuda.create({ data }),
  update: (id: string, data: Partial<WebsiteAdvanceAjuda>) =>
    prisma.websiteAdvanceAjuda.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteAdvanceAjuda.delete({ where: { id } }),
};

