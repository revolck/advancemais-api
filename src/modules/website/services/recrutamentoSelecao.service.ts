import { prisma } from "../../../config/prisma";
import { WebsiteRecrutamentoSelecao } from "@prisma/client";

export const recrutamentoSelecaoService = {
  list: () => prisma.websiteRecrutamentoSelecao.findMany(),
  get: (id: string) =>
    prisma.websiteRecrutamentoSelecao.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteRecrutamentoSelecao, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteRecrutamentoSelecao.create({ data }),
  update: (id: string, data: Partial<WebsiteRecrutamentoSelecao>) =>
    prisma.websiteRecrutamentoSelecao.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteRecrutamentoSelecao.delete({ where: { id } }),
};

