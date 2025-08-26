import { prisma } from "../../../config/prisma";
import { WebsiteConsultoria } from "@prisma/client";

export const consultoriaService = {
  list: () => prisma.websiteConsultoria.findMany(),
  get: (id: string) =>
    prisma.websiteConsultoria.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteConsultoria, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteConsultoria.create({ data }),
  update: (id: string, data: Partial<WebsiteConsultoria>) =>
    prisma.websiteConsultoria.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteConsultoria.delete({ where: { id } }),
};
