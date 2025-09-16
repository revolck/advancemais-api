import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCache } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_KEY = 'website:informacoesGerais:list';

export const informacoesGeraisService = {
  list: async () => {
    const cached =
      await getCache<Awaited<ReturnType<typeof prisma.websiteInformacoes.findMany>>>(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteInformacoes.findMany({
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
    });
    await setCache(CACHE_KEY, result, WEBSITE_CACHE_TTL);
    return result;
  },
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
  create: async (data: Prisma.WebsiteInformacoesCreateInput) => {
    const result = await prisma.websiteInformacoes.create({
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
    });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  update: async (id: string, data: Prisma.WebsiteInformacoesUpdateInput) => {
    const result = await prisma.websiteInformacoes.update({
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
    });
    await invalidateCache(CACHE_KEY);
    return result;
  },
  remove: async (id: string) => {
    const result = await prisma.websiteInformacoes.delete({
      where: { id },
      select: { id: true },
    });
    await invalidateCache(CACHE_KEY);
    return result;
  },
};
