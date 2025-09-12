import { prisma } from "../../../config/prisma";
import { WebsiteStatus } from "@prisma/client";
import { getCache, setCache, invalidateCache } from "../../../utils/cache";

const CACHE_KEY = "website:logoEnterprise:list";

export const logoEnterpriseService = {
  list: async () => {
    const cached = await getCache<
      Awaited<ReturnType<typeof prisma.websiteLogoEnterpriseOrdem.findMany>>
    >(CACHE_KEY);
    if (cached) return cached;
    const result = await prisma.websiteLogoEnterpriseOrdem.findMany({
      orderBy: { ordem: "asc" },
      take: 100,
      select: {
        id: true,
        ordem: true,
        status: true,
        logo: {
          select: {
            id: true,
            nome: true,
            imagemUrl: true,
            imagemAlt: true,
            website: true,
          },
        },
      },
    });
    await setCache(CACHE_KEY, result);
    return result;
  },

  get: (id: string) =>
    prisma.websiteLogoEnterpriseOrdem.findUnique({
      where: { id },
      select: {
        id: true,
        ordem: true,
        status: true,
        logo: {
          select: {
            id: true,
            nome: true,
            imagemUrl: true,
            imagemAlt: true,
            website: true,
          },
        },
      },
    }),

  create: async (data: {
    nome: string;
    imagemUrl: string;
    imagemAlt: string;
    website?: string;
    status?: WebsiteStatus;
  }) => {
    const result = await prisma.$transaction(async (tx) => {
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
        select: {
          id: true,
          ordem: true,
          status: true,
          logo: {
            select: {
              id: true,
              nome: true,
              imagemUrl: true,
              imagemAlt: true,
              website: true,
            },
          },
        },
      });
    });
    await invalidateCache(CACHE_KEY);
    return result;
  },

  update: async (
    logoId: string,
    data: {
      nome?: string;
      imagemUrl?: string;
      imagemAlt?: string;
      website?: string;
      status?: WebsiteStatus;
      ordem?: number;
    }
  ) => {
    const result = await prisma.$transaction(async (tx) => {
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
        select: {
          id: true,
          ordem: true,
          status: true,
          logo: {
            select: {
              id: true,
              nome: true,
              imagemUrl: true,
              imagemAlt: true,
              website: true,
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
      const current = await tx.websiteLogoEnterpriseOrdem.findUnique({
        where: { id: ordemId },
        select: {
          id: true,
          ordem: true,
          logo: {
            select: {
              id: true,
              nome: true,
              imagemUrl: true,
              imagemAlt: true,
              website: true,
            },
          },
        },
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
          select: {
            id: true,
            ordem: true,
            logo: {
              select: {
                id: true,
                nome: true,
                imagemUrl: true,
                imagemAlt: true,
                website: true,
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

  remove: async (logoId: string) => {
    await prisma.$transaction(async (tx) => {
      const ordem = await tx.websiteLogoEnterpriseOrdem.findUnique({
        where: { websiteLogoEnterpriseId: logoId },
        select: { id: true, ordem: true },
      });
      if (!ordem) return;
      await tx.websiteLogoEnterpriseOrdem.delete({ where: { id: ordem.id } });
      await tx.websiteLogoEnterprise.delete({ where: { id: logoId } });
      await tx.websiteLogoEnterpriseOrdem.updateMany({
        where: { ordem: { gt: ordem.ordem } },
        data: { ordem: { decrement: 1 } },
      });
    });
    await invalidateCache(CACHE_KEY);
  },
};
