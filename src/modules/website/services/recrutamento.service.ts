import { prisma } from "../../../config/prisma";
import { WebsiteRecrutamento } from "@prisma/client";

export const recrutamentoService = {
  list: () => prisma.websiteRecrutamento.findMany(),
  get: (id: string) =>
    prisma.websiteRecrutamento.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteRecrutamento, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteRecrutamento.create({ data }),
  update: (id: string, data: Partial<WebsiteRecrutamento>) =>
    prisma.websiteRecrutamento.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteRecrutamento.delete({ where: { id } }),
};
