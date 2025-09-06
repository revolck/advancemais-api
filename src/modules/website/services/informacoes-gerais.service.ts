import { prisma } from "../../../config/prisma";
import { WebsiteInformacoes } from "@prisma/client";

export const informacoesGeraisService = {
  list: () => prisma.websiteInformacoes.findMany(),
  get: (id: string) => prisma.websiteInformacoes.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteInformacoes, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteInformacoes.create({ data }),
  update: (id: string, data: Partial<WebsiteInformacoes>) =>
    prisma.websiteInformacoes.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteInformacoes.delete({ where: { id } }),
};
