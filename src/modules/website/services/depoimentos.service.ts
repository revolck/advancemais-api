import { Prisma, WebsiteStatus } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getCache, setCache, invalidateCacheByPrefix } from '@/utils/cache';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';

const CACHE_PREFIX = 'website:depoimentos:list';
const buildCacheKey = (status?: WebsiteStatus) => `${CACHE_PREFIX}:${status ?? 'ALL'}`;
const depoimentoOrderSelect = {
  id: true,
  ordem: true,
  status: true,
  criadoEm: true,
  WebsiteDepoimento: {
    select: {
      id: true,
      depoimento: true,
      nome: true,
      cargo: true,
      fotoUrl: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  },
} satisfies Prisma.WebsiteDepoimentoOrdemSelect;

export const depoimentosService = {
  list: async (status?: WebsiteStatus) => {
    const cacheKey = buildCacheKey(status);
    const cached =
      await getCache<Awaited<ReturnType<typeof prisma.websiteDepoimentoOrdem.findMany>>>(cacheKey);
    if (cached) return cached;

    const result = await prisma.websiteDepoimentoOrdem.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { ordem: 'asc' },
      take: 100,
      select: depoimentoOrderSelect,
    });
    await setCache(cacheKey, result, WEBSITE_CACHE_TTL);
    return result;
  },
  get: (id: string) =>
    prisma.websiteDepoimentoOrdem.findUnique({
      where: { id },
      select: depoimentoOrderSelect,
    }),
  create: async (data: {
    depoimento: string;
    nome: string;
    cargo: string;
    fotoUrl: string;
    status?: WebsiteStatus;
  }) => {
    const max = await prisma.websiteDepoimentoOrdem.aggregate({
      _max: { ordem: true },
    });
    const ordem = (max._max.ordem ?? 0) + 1;
    const result = await prisma.websiteDepoimentoOrdem.create({
      data: {
        ordem,
        status: data.status ?? 'RASCUNHO',
        WebsiteDepoimento: {
          create: {
            depoimento: data.depoimento,
            nome: data.nome,
            cargo: data.cargo,
            fotoUrl: data.fotoUrl,
          },
        },
      },
      select: depoimentoOrderSelect,
    });
    await invalidateCacheByPrefix(CACHE_PREFIX);
    return result;
  },
  update: async (
    depoimentoId: string,
    data: {
      depoimento?: string;
      nome?: string;
      cargo?: string;
      fotoUrl?: string;
      status?: WebsiteStatus;
      ordem?: number;
    },
  ) => {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.websiteDepoimentoOrdem.findFirst({
        where: {
          OR: [{ websiteDepoimentoId: depoimentoId }, { id: depoimentoId }],
        },
      });
      if (!current) throw new Error('Depoimento não encontrado');

      let ordem = data.ordem ?? current.ordem;
      if (data.ordem !== undefined && data.ordem !== current.ordem) {
        if (data.ordem > current.ordem) {
          await tx.websiteDepoimentoOrdem.updateMany({
            where: { ordem: { gt: current.ordem, lte: data.ordem } },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteDepoimentoOrdem.updateMany({
            where: { ordem: { gte: data.ordem, lt: current.ordem } },
            data: { ordem: { increment: 1 } },
          });
        }
        ordem = data.ordem;
      }

      return tx.websiteDepoimentoOrdem.update({
        where: { id: current.id },
        data: {
          ordem,
          ...(data.status !== undefined && { status: data.status }),
          ...(data.depoimento !== undefined ||
          data.nome !== undefined ||
          data.cargo !== undefined ||
          data.fotoUrl !== undefined
            ? {
                WebsiteDepoimento: {
                  update: {
                    ...(data.depoimento !== undefined && {
                      depoimento: data.depoimento,
                    }),
                    ...(data.nome !== undefined && { nome: data.nome }),
                    ...(data.cargo !== undefined && { cargo: data.cargo }),
                    ...(data.fotoUrl !== undefined && { fotoUrl: data.fotoUrl }),
                  },
                },
              }
            : {}),
        },
        select: depoimentoOrderSelect,
      });
    });
    await invalidateCacheByPrefix(CACHE_PREFIX);
    return result;
  },
  reorder: async (ordemId: string, novaOrdem: number) => {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.websiteDepoimentoOrdem.findUnique({
        where: { id: ordemId },
        select: {
          id: true,
          ordem: true,
          status: true,
          criadoEm: true,
          WebsiteDepoimento: {
            select: {
              id: true,
              depoimento: true,
              nome: true,
              cargo: true,
              fotoUrl: true,
              criadoEm: true,
              atualizadoEm: true,
            },
          },
        },
      });
      if (!current) throw new Error('Depoimento não encontrado');

      if (novaOrdem !== current.ordem) {
        await tx.websiteDepoimentoOrdem.update({
          where: { id: ordemId },
          data: { ordem: 0 },
        });

        if (novaOrdem > current.ordem) {
          await tx.websiteDepoimentoOrdem.updateMany({
            where: { ordem: { gt: current.ordem, lte: novaOrdem } },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteDepoimentoOrdem.updateMany({
            where: { ordem: { gte: novaOrdem, lt: current.ordem } },
            data: { ordem: { increment: 1 } },
          });
        }

        return tx.websiteDepoimentoOrdem.update({
          where: { id: ordemId },
          data: { ordem: novaOrdem },
          select: depoimentoOrderSelect,
        });
      }

      return current;
    });
    await invalidateCacheByPrefix(CACHE_PREFIX);
    return result;
  },
  remove: async (depoimentoId: string) => {
    await prisma.$transaction(async (tx) => {
      const ordem = await tx.websiteDepoimentoOrdem.findFirst({
        where: {
          OR: [{ websiteDepoimentoId: depoimentoId }, { id: depoimentoId }],
        },
        select: { id: true, ordem: true, websiteDepoimentoId: true },
      });
      if (!ordem) return;
      await tx.websiteDepoimentoOrdem.delete({ where: { id: ordem.id } });
      await tx.websiteDepoimento.delete({ where: { id: ordem.websiteDepoimentoId } });
      await tx.websiteDepoimentoOrdem.updateMany({
        where: { ordem: { gt: ordem.ordem } },
        data: { ordem: { decrement: 1 } },
      });
    });
    await invalidateCacheByPrefix(CACHE_PREFIX);
  },
};
