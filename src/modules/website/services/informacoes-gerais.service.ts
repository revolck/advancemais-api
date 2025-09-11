import { prisma } from "../../../config/prisma";
import { Prisma } from "@prisma/client";

export const informacoesGeraisService = {
  list: () =>
    prisma.websiteInformacoes.findMany({
      select: {
        id: true,
        endereco: true,
        cep: true,
        cidade: true,
        estado: true,
        telefone1: true,
        telefone2: true,
        whatsapp: true,
        linkedin: true,
        facebook: true,
        instagram: true,
        youtube: true,
        email: true,
        horarios: {
          select: {
            id: true,
            diaDaSemana: true,
            horarioInicio: true,
            horarioFim: true,
          },
        },
      },
    }),
  get: (id: string) =>
    prisma.websiteInformacoes.findUnique({
      where: { id },
      select: {
        id: true,
        endereco: true,
        cep: true,
        cidade: true,
        estado: true,
        telefone1: true,
        telefone2: true,
        whatsapp: true,
        linkedin: true,
        facebook: true,
        instagram: true,
        youtube: true,
        email: true,
        horarios: {
          select: {
            id: true,
            diaDaSemana: true,
            horarioInicio: true,
            horarioFim: true,
          },
        },
      },
    }),
  create: (data: Prisma.WebsiteInformacoesCreateInput) =>
    prisma.websiteInformacoes.create({
      data,
      select: {
        id: true,
        endereco: true,
        cep: true,
        cidade: true,
        estado: true,
        telefone1: true,
        telefone2: true,
        whatsapp: true,
        linkedin: true,
        facebook: true,
        instagram: true,
        youtube: true,
        email: true,
        horarios: {
          select: {
            id: true,
            diaDaSemana: true,
            horarioInicio: true,
            horarioFim: true,
          },
        },
      },
    }),
  update: (id: string, data: Prisma.WebsiteInformacoesUpdateInput) =>
    prisma.websiteInformacoes.update({
      where: { id },
      data,
      select: {
        id: true,
        endereco: true,
        cep: true,
        cidade: true,
        estado: true,
        telefone1: true,
        telefone2: true,
        whatsapp: true,
        linkedin: true,
        facebook: true,
        instagram: true,
        youtube: true,
        email: true,
        horarios: {
          select: {
            id: true,
            diaDaSemana: true,
            horarioInicio: true,
            horarioFim: true,
          },
        },
      },
    }),
  remove: (id: string) =>
    prisma.websiteInformacoes.delete({ where: { id }, select: { id: true } }),
};
