import { prisma } from "../../../config/prisma";
import { WebsiteStatus } from "@prisma/client";
import { getCache, setCache, invalidateCache } from "../../../utils/cache";

const CACHE_KEY = "website:banner:list";

export const bannerService = {
  list: async () => {
    const cached = await getCache<Awaited<ReturnType<typeof prisma.websiteBannerOrdem.findMany>>>(
      CACHE_KEY
    );
    if (cached) return cached;
    const result = await prisma.websiteBannerOrdem.findMany({
      orderBy: { ordem: "asc" },
      take: 100,
      select: {
        id: true,
        ordem: true,
        status: true,
        banner: {
          select: {
            id: true,
            imagemUrl: true,
            imagemTitulo: true,
            link: true,
          },
        },
      },
    });
    await setCache(CACHE_KEY, result);
    return result;
  },

  get: (id: string) =>
    prisma.websiteBannerOrdem.findUnique({
      where: { id },
      select: {
        id: true,
        ordem: true,
        status: true,
        banner: {
          select: {
            id: true,
            imagemUrl: true,
            imagemTitulo: true,
            link: true,
          },
        },
      },
    }),

  create: async (data: {
    imagemUrl: string;
    imagemTitulo: string;
    link?: string;
    status?: WebsiteStatus;
  }) => {
    const result = await prisma.$transaction(async (tx) => {
      const max = await tx.websiteBannerOrdem.aggregate({ _max: { ordem: true } });
      const ordem = (max._max.ordem ?? 0) + 1;

      return tx.websiteBannerOrdem.create({
        data: {
          ordem,
          status: data.status ?? "RASCUNHO",
          banner: {
            create: {
              imagemUrl: data.imagemUrl,
              imagemTitulo: data.imagemTitulo,
              link: data.link,
            },
          },
        },
        select: {
          id: true,
          ordem: true,
          status: true,
          banner: {
            select: {
              id: true,
              imagemUrl: true,
              imagemTitulo: true,
              link: true,
            },
          },
        },
      });
    });
    await invalidateCache(CACHE_KEY);
    return result;
  },

  update: async (
    bannerId: string,
    data: {
      imagemUrl?: string;
      imagemTitulo?: string;
      link?: string;
      status?: WebsiteStatus;
      ordem?: number;
    }
  ) => {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.websiteBannerOrdem.findUnique({
        where: { websiteBannerId: bannerId },
      });
      if (!current) throw new Error("Banner não encontrado");

      let ordem = data.ordem ?? current.ordem;
      if (data.ordem !== undefined && data.ordem !== current.ordem) {
        if (data.ordem > current.ordem) {
          await tx.websiteBannerOrdem.updateMany({
            where: { ordem: { gt: current.ordem, lte: data.ordem } },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteBannerOrdem.updateMany({
            where: { ordem: { gte: data.ordem, lt: current.ordem } },
            data: { ordem: { increment: 1 } },
          });
        }
        ordem = data.ordem;
      }

      return tx.websiteBannerOrdem.update({
        where: { id: current.id },
        data: {
          ordem,
          status: data.status,
          banner:
            data.imagemUrl !== undefined ||
            data.imagemTitulo !== undefined ||
            data.link !== undefined
              ? {
                  update: {
                    imagemUrl: data.imagemUrl,
                    imagemTitulo: data.imagemTitulo,
                    link: data.link,
                  },
                }
              : undefined,
        },
        select: {
          id: true,
          ordem: true,
          status: true,
          banner: {
            select: {
              id: true,
              imagemUrl: true,
              imagemTitulo: true,
              link: true,
            },
          },
        },
      });
    });
    await invalidateCache(CACHE_KEY);
    return result;
  },

  reorder: async (ordemId: string, novaOrdem: number) => {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.websiteBannerOrdem.findUnique({
        where: { id: ordemId },
        select: {
          id: true,
          ordem: true,
          banner: {
            select: {
              id: true,
              imagemUrl: true,
              imagemTitulo: true,
              link: true,
            },
          },
        },
      });
      if (!current) throw new Error("Banner não encontrado");

      if (novaOrdem !== current.ordem) {
        await tx.websiteBannerOrdem.update({
          where: { id: ordemId },
          data: { ordem: 0 },
        });

        if (novaOrdem > current.ordem) {
          await tx.websiteBannerOrdem.updateMany({
            where: { ordem: { gt: current.ordem, lte: novaOrdem } },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteBannerOrdem.updateMany({
            where: { ordem: { gte: novaOrdem, lt: current.ordem } },
            data: { ordem: { increment: 1 } },
          });
        }

        return tx.websiteBannerOrdem.update({
          where: { id: ordemId },
          data: { ordem: novaOrdem },
          select: {
            id: true,
            ordem: true,
            banner: {
              select: {
                id: true,
                imagemUrl: true,
                imagemTitulo: true,
                link: true,
              },
            },
          },
        });
      }

      return current;
    });
    await invalidateCache(CACHE_KEY);
    return result;
  },

  remove: async (bannerId: string) => {
    await prisma.$transaction(async (tx) => {
      const ordem = await tx.websiteBannerOrdem.findUnique({
        where: { websiteBannerId: bannerId },
        select: { id: true, ordem: true },
      });
      if (!ordem) return;
      await tx.websiteBannerOrdem.delete({ where: { id: ordem.id } });
      await tx.websiteBanner.delete({ where: { id: bannerId } });
      await tx.websiteBannerOrdem.updateMany({
        where: { ordem: { gt: ordem.ordem } },
        data: { ordem: { decrement: 1 } },
      });
    });
    await invalidateCache(CACHE_KEY);
  },
};

