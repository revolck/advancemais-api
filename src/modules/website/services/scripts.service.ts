import { Prisma, WebsiteScriptOrientation, WebsiteStatus } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';
import { getCache, invalidateCacheByPrefix, setCache } from '@/utils/cache';

const CACHE_PREFIX = 'website:scripts:list';

type ListFilters = {
  orientacao?: WebsiteScriptOrientation;
  status?: WebsiteStatus;
};

const buildCacheKey = ({ orientacao, status }: ListFilters = {}) =>
  `${CACHE_PREFIX}:${orientacao ?? 'all'}:${status ?? 'all'}`;

const selectFields = {
  id: true,
  nome: true,
  descricao: true,
  codigo: true,
  orientacao: true,
  status: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.WebsiteScriptSelect;

export const websiteScriptsService = {
  list: async (filters: ListFilters = {}) => {
    const cacheKey = buildCacheKey(filters);
    const cached = await getCache<Awaited<ReturnType<typeof prisma.websiteScript.findMany>>>(cacheKey);
    if (cached) return cached;

    const where: Record<string, any> = {};
    if (filters.orientacao) {
      where.orientacao = filters.orientacao;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const result = await prisma.websiteScript.findMany({
      where,
      orderBy: [
        { orientacao: 'asc' },
        { criadoEm: 'desc' },
      ],
      select: selectFields,
    });

    await setCache(cacheKey, result, WEBSITE_CACHE_TTL);
    return result;
  },

  get: (id: string) =>
    prisma.websiteScript.findUnique({
      where: { id },
      select: selectFields,
    }),

  create: async (data: {
    nome?: string;
    descricao?: string;
    codigo: string;
    orientacao: WebsiteScriptOrientation;
    status?: WebsiteStatus;
  }) => {
    const result = await prisma.websiteScript.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        codigo: data.codigo,
        orientacao: data.orientacao,
        status: data.status ?? 'RASCUNHO',
      },
      select: selectFields,
    });
    await invalidateCacheByPrefix(CACHE_PREFIX);
    return result;
  },

  update: async (
    id: string,
    data: {
      nome?: string;
      descricao?: string;
      codigo?: string;
      orientacao?: WebsiteScriptOrientation;
      status?: WebsiteStatus;
    },
  ) => {
    const result = await prisma.websiteScript.update({
      where: { id },
      data,
      select: selectFields,
    });
    await invalidateCacheByPrefix(CACHE_PREFIX);
    return result;
  },

  remove: async (id: string) => {
    const result = await prisma.websiteScript.delete({
      where: { id },
      select: { id: true },
    });
    await invalidateCacheByPrefix(CACHE_PREFIX);
    return result;
  },
};

export type WebsiteScriptListResult = Awaited<ReturnType<typeof websiteScriptsService.list>>;
