import { prisma } from "../../../config/prisma";
import { WebsiteStatus } from "@prisma/client";

export const bannerService = {
  list: () =>
    prisma.websiteBannerOrdem.findMany({
      include: { banner: true },
      orderBy: { ordem: "asc" },
    }),

  get: (id: string) =>
    prisma.websiteBannerOrdem.findUnique({
      where: { id },
      include: { banner: true },
    }),

  create: (data: {
    imagemUrl: string;
    imagemTitulo: string;
    link?: string;
    status?: WebsiteStatus;
  }) =>
    prisma.$transaction(async (tx) => {
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
        include: { banner: true },
      });
    }),

  update: (
    bannerId: string,
    data: {
      imagemUrl?: string;
      imagemTitulo?: string;
      link?: string;
      status?: WebsiteStatus;
      ordem?: number;
    }
  ) =>
    prisma.$transaction(async (tx) => {
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
        include: { banner: true },
      });
    }),

  reorder: (ordemId: string, novaOrdem: number) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteBannerOrdem.findUnique({
        where: { id: ordemId },
        include: { banner: true },
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
          include: { banner: true },
        });
      }

      return current;
    }),

  remove: (bannerId: string) =>
    prisma.$transaction(async (tx) => {
      const ordem = await tx.websiteBannerOrdem.findUnique({
        where: { websiteBannerId: bannerId },
      });
      if (!ordem) return;
      await tx.websiteBannerOrdem.delete({ where: { id: ordem.id } });
      await tx.websiteBanner.delete({ where: { id: bannerId } });
      await tx.websiteBannerOrdem.updateMany({
        where: { ordem: { gt: ordem.ordem } },
        data: { ordem: { decrement: 1 } },
      });
    }),
};

