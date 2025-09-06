import { prisma } from "../../../config/prisma";
import { Prisma } from "@prisma/client";

export const informacoesGeraisService = {
  list: () =>
    prisma.websiteInformacoes.findMany({ include: { horarios: true } }),
  get: (id: string) =>
    prisma.websiteInformacoes.findUnique({
      where: { id },
      include: { horarios: true },
    }),
  create: (data: Prisma.WebsiteInformacoesCreateInput) =>
    prisma.websiteInformacoes.create({ data, include: { horarios: true } }),
  update: (id: string, data: Prisma.WebsiteInformacoesUpdateInput) =>
    prisma.websiteInformacoes.update({
      where: { id },
      data,
      include: { horarios: true },
    }),
  remove: (id: string) => prisma.websiteInformacoes.delete({ where: { id } }),
};
