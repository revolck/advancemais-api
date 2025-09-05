import { prisma } from "../../../config/prisma";
import { WebsiteStatus } from "@prisma/client";

export const logoEnterpriseService = {
  list: () =>
    prisma.websiteLogoEnterpriseOrdem.findMany({
      include: { logo: true },
      orderBy: { ordem: "asc" },
    }),

  get: (id: string) =>
    prisma.websiteLogoEnterpriseOrdem.findUnique({
      where: { id },
      include: { logo: true },
    }),

  create: (data: {
    nome: string;
    imagemUrl: string;
    imagemAlt: string;
    website?: string;
    status?: WebsiteStatus;
  }) =>
    prisma.$transaction(async (tx) => {
      const max = await tx.websiteLogoEnterpriseOrdem.aggregate({
        _max: { ordem: true },
      });
      const ordem = (max._max.ordem ?? 0) + 1;

      return tx.websiteLogoEnterpriseOrdem.create({
        data: {
          ordem,
          status: data.status ?? "RASCUNHO",
          logo: {
            create: {
              nome: data.nome,
              imagemUrl: data.imagemUrl,
              imagemAlt: data.imagemAlt,
              ...(data.website !== undefined && { website: data.website }),
            },
          },
        },
        include: { logo: true },
      });
    }),

  update: (
    logoId: string,
    data: {
      nome?: string;
      imagemUrl?: string;
      imagemAlt?: string;
      website?: string;
      status?: WebsiteStatus;
      ordem?: number;
    }
  ) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteLogoEnterpriseOrdem.findUnique({
        where: { websiteLogoEnterpriseId: logoId },
      });
      if (!current) throw new Error("Logo não encontrada");

      let ordem = data.ordem ?? current.ordem;
      if (data.ordem !== undefined && data.ordem !== current.ordem) {
        if (data.ordem > current.ordem) {
          await tx.websiteLogoEnterpriseOrdem.updateMany({
            where: { ordem: { gt: current.ordem, lte: data.ordem } },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteLogoEnterpriseOrdem.updateMany({
            where: { ordem: { gte: data.ordem, lt: current.ordem } },
            data: { ordem: { increment: 1 } },
          });
        }
        ordem = data.ordem;
      }

      return tx.websiteLogoEnterpriseOrdem.update({
        where: { id: current.id },
        data: {
          ordem,
          status: data.status,
          logo:
            data.nome !== undefined ||
            data.imagemUrl !== undefined ||
            data.imagemAlt !== undefined ||
            data.website !== undefined
              ? {
                  update: {
                    nome: data.nome,
                    imagemUrl: data.imagemUrl,
                    imagemAlt: data.imagemAlt,
                    ...(data.website !== undefined && {
                      website: data.website,
                    }),
                  },
                }
              : undefined,
        },
        include: { logo: true },
      });
    }),

  reorder: (ordemId: string, novaOrdem: number) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteLogoEnterpriseOrdem.findUnique({
        where: { id: ordemId },
        include: { logo: true },
      });
      if (!current) throw new Error("Logo não encontrada");

      if (novaOrdem !== current.ordem) {
        await tx.websiteLogoEnterpriseOrdem.update({
          where: { id: ordemId },
          data: { ordem: 0 },
        });

        if (novaOrdem > current.ordem) {
          await tx.websiteLogoEnterpriseOrdem.updateMany({
            where: { ordem: { gt: current.ordem, lte: novaOrdem } },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteLogoEnterpriseOrdem.updateMany({
            where: { ordem: { gte: novaOrdem, lt: current.ordem } },
            data: { ordem: { increment: 1 } },
          });
        }

        return tx.websiteLogoEnterpriseOrdem.update({
          where: { id: ordemId },
          data: { ordem: novaOrdem },
          include: { logo: true },
        });
      }

      return current;
    }),

  remove: (logoId: string) =>
    prisma.$transaction(async (tx) => {
      const ordem = await tx.websiteLogoEnterpriseOrdem.findUnique({
        where: { websiteLogoEnterpriseId: logoId },
      });
      if (!ordem) return;
      await tx.websiteLogoEnterpriseOrdem.delete({ where: { id: ordem.id } });
      await tx.websiteLogoEnterprise.delete({ where: { id: logoId } });
      await tx.websiteLogoEnterpriseOrdem.updateMany({
        where: { ordem: { gt: ordem.ordem } },
        data: { ordem: { decrement: 1 } },
      });
    }),
};
