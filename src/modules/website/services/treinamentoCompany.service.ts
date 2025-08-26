import { prisma } from "../../../config/prisma";
import { WebsiteTreinamentoCompany } from "@prisma/client";

export const treinamentoCompanyService = {
  list: () => prisma.websiteTreinamentoCompany.findMany(),
  get: (id: string) =>
    prisma.websiteTreinamentoCompany.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteTreinamentoCompany, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteTreinamentoCompany.create({ data }),
  update: (id: string, data: Partial<WebsiteTreinamentoCompany>) =>
    prisma.websiteTreinamentoCompany.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteTreinamentoCompany.delete({ where: { id } }),
};

