import { prisma } from "../../../config/prisma";
import { WebsiteTreinamentosInCompany } from "@prisma/client";

export const treinamentosInCompanyService = {
  list: () => prisma.websiteTreinamentosInCompany.findMany(),
  get: (id: string) =>
    prisma.websiteTreinamentosInCompany.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteTreinamentosInCompany, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteTreinamentosInCompany.create({ data }),
  update: (id: string, data: Partial<WebsiteTreinamentosInCompany>) =>
    prisma.websiteTreinamentosInCompany.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteTreinamentosInCompany.delete({ where: { id } }),
};

