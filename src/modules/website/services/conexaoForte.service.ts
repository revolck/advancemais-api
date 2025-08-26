import { prisma } from "../../../config/prisma";
import { WebsiteConexaoForte } from "@prisma/client";

export const conexaoForteService = {
  list: () => prisma.websiteConexaoForte.findMany(),
  get: (id: string) =>
    prisma.websiteConexaoForte.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteConexaoForte, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteConexaoForte.create({ data }),
  update: (id: string, data: Partial<WebsiteConexaoForte>) =>
    prisma.websiteConexaoForte.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteConexaoForte.delete({ where: { id } }),
};

