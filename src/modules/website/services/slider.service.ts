import { prisma } from "../../../config/prisma";
import { SliderOrientation, WebsiteStatus } from "@prisma/client";

export const sliderService = {
  list: () =>
    prisma.websiteSliderOrdem.findMany({
      orderBy: { ordem: "asc" },
      take: 100,
      select: {
        id: true,
        ordem: true,
        orientacao: true,
        status: true,
        slider: {
          select: {
            id: true,
            sliderName: true,
            imagemUrl: true,
            link: true,
          },
        },
      },
    }),

  get: (id: string) =>
    prisma.websiteSliderOrdem.findUnique({
      where: { id },
      select: {
        id: true,
        ordem: true,
        orientacao: true,
        status: true,
        slider: {
          select: {
            id: true,
            sliderName: true,
            imagemUrl: true,
            link: true,
          },
        },
      },
    }),

  create: async (data: {
    sliderName: string;
    imagemUrl: string;
    link?: string;
    orientacao: SliderOrientation;
    status?: WebsiteStatus;
  }) => {
    const max = await prisma.websiteSliderOrdem.aggregate({
      _max: { ordem: true },
      where: { orientacao: data.orientacao },
    });
    const ordem = (max._max.ordem ?? 0) + 1;

    return prisma.websiteSliderOrdem.create({
      data: {
        ordem,
        orientacao: data.orientacao,
        status: data.status ?? "RASCUNHO",
        slider: {
          create: {
            sliderName: data.sliderName,
            imagemUrl: data.imagemUrl,
            link: data.link,
          },
        },
      },
      select: {
        id: true,
        ordem: true,
        orientacao: true,
        status: true,
        slider: {
          select: {
            id: true,
            sliderName: true,
            imagemUrl: true,
            link: true,
          },
        },
      },
    });
  },

  update: async (
    sliderId: string,
    data: {
      sliderName?: string;
      imagemUrl?: string;
      link?: string;
      orientacao?: SliderOrientation;
      status?: WebsiteStatus;
      ordem?: number;
    }
  ) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteSliderOrdem.findUnique({
        where: { websiteSliderId: sliderId },
      });
      if (!current) throw new Error("Slider não encontrado");

      const ordemId = current.id;

      const orientacao = data.orientacao ?? current.orientacao;
      let ordem = data.ordem ?? current.ordem;

      // Se a orientação mudou, ajusta as ordens das listas envolvidas
      if (orientacao !== current.orientacao) {
        await tx.websiteSliderOrdem.updateMany({
          where: { orientacao: current.orientacao, ordem: { gt: current.ordem } },
          data: { ordem: { decrement: 1 } },
        });

        if (data.ordem === undefined) {
          const max = await tx.websiteSliderOrdem.aggregate({
            _max: { ordem: true },
            where: { orientacao },
          });
          ordem = (max._max.ordem ?? 0) + 1;
        } else {
          await tx.websiteSliderOrdem.updateMany({
            where: { orientacao, ordem: { gte: ordem } },
            data: { ordem: { increment: 1 } },
          });
        }
      } else if (data.ordem !== undefined && data.ordem !== current.ordem) {
        ordem = data.ordem;
        if (ordem > current.ordem) {
          await tx.websiteSliderOrdem.updateMany({
            where: {
              orientacao,
              ordem: { gt: current.ordem, lte: ordem },
            },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteSliderOrdem.updateMany({
            where: {
              orientacao,
              ordem: { gte: ordem, lt: current.ordem },
            },
            data: { ordem: { increment: 1 } },
          });
        }
      }

      return tx.websiteSliderOrdem.update({
        where: { id: ordemId },
        data: {
          ordem,
          orientacao,
          status: data.status,
          slider:
            data.sliderName !== undefined ||
            data.imagemUrl !== undefined ||
            data.link !== undefined
              ? {
                  update: {
                    sliderName: data.sliderName,
                    imagemUrl: data.imagemUrl,
                    link: data.link,
                  },
                }
              : undefined,
        },
        select: {
          id: true,
          ordem: true,
          orientacao: true,
          status: true,
          slider: {
            select: {
              id: true,
              sliderName: true,
              imagemUrl: true,
              link: true,
            },
          },
        },
      });
    }),

  reorder: async (ordemId: string, novaOrdem: number) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteSliderOrdem.findUnique({
        where: { id: ordemId },
        select: {
          id: true,
          ordem: true,
          orientacao: true,
          slider: {
            select: {
              id: true,
              sliderName: true,
              imagemUrl: true,
              link: true,
            },
          },
        },
      });
      if (!current) throw new Error("Slider não encontrado");

      if (novaOrdem !== current.ordem) {
        await tx.websiteSliderOrdem.update({
          where: { id: ordemId },
          data: { ordem: 0 },
        });

        if (novaOrdem > current.ordem) {
          await tx.websiteSliderOrdem.updateMany({
            where: {
              orientacao: current.orientacao,
              ordem: { gt: current.ordem, lte: novaOrdem },
            },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteSliderOrdem.updateMany({
            where: {
              orientacao: current.orientacao,
              ordem: { gte: novaOrdem, lt: current.ordem },
            },
            data: { ordem: { increment: 1 } },
          });
        }

        return tx.websiteSliderOrdem.update({
          where: { id: ordemId },
          data: { ordem: novaOrdem },
          select: {
            id: true,
            ordem: true,
            orientacao: true,
            slider: {
              select: {
                id: true,
                sliderName: true,
                imagemUrl: true,
                link: true,
              },
            },
          },
        });
      }

      return current;
    }),

  remove: async (sliderId: string) => {
    await prisma.$transaction(async (tx) => {
      const ordem = await tx.websiteSliderOrdem.findUnique({
        where: { websiteSliderId: sliderId },
        select: { id: true, ordem: true, orientacao: true },
      });
      if (!ordem) return;
      await tx.websiteSliderOrdem.delete({ where: { id: ordem.id } });
      await tx.websiteSlider.delete({ where: { id: sliderId } });
      await tx.websiteSliderOrdem.updateMany({
        where: { orientacao: ordem.orientacao, ordem: { gt: ordem.ordem } },
        data: { ordem: { decrement: 1 } },
      });
    });
  },
};

