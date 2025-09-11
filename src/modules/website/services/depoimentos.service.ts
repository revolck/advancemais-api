import { prisma } from "../../../config/prisma";
import { WebsiteStatus } from "@prisma/client";

export const depoimentosService = {
  list: (status?: WebsiteStatus) =>
    prisma.websiteDepoimentoOrdem.findMany({
      where: status ? { status } : undefined,
      orderBy: { ordem: "asc" },
      take: 100,
      select: {
        id: true,
        ordem: true,
        status: true,
        depoimento: {
          select: {
            id: true,
            depoimento: true,
            nome: true,
            cargo: true,
            fotoUrl: true,
          },
        },
      },
    }),
  get: (id: string) =>
    prisma.websiteDepoimentoOrdem.findUnique({
      where: { id },
      select: {
        id: true,
        ordem: true,
        status: true,
        depoimento: {
          select: {
            id: true,
            depoimento: true,
            nome: true,
            cargo: true,
            fotoUrl: true,
          },
        },
      },
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
    return prisma.websiteDepoimentoOrdem.create({
      data: {
        ordem,
        status: data.status ?? "RASCUNHO",
        depoimento: {
          create: {
            depoimento: data.depoimento,
            nome: data.nome,
            cargo: data.cargo,
            fotoUrl: data.fotoUrl,
          },
        },
      },
      select: {
        id: true,
        ordem: true,
        status: true,
        depoimento: {
          select: {
            id: true,
            depoimento: true,
            nome: true,
            cargo: true,
            fotoUrl: true,
          },
        },
      },
    });
  },
  update: (
    depoimentoId: string,
    data: {
      depoimento?: string;
      nome?: string;
      cargo?: string;
      fotoUrl?: string;
      status?: WebsiteStatus;
      ordem?: number;
    }
  ) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteDepoimentoOrdem.findUnique({
        where: { websiteDepoimentoId: depoimentoId },
      });
      if (!current) throw new Error("Depoimento não encontrado");

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
                depoimento: {
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
        select: {
          id: true,
          ordem: true,
          status: true,
          depoimento: {
            select: {
              id: true,
              depoimento: true,
              nome: true,
              cargo: true,
              fotoUrl: true,
            },
          },
        },
      });
    }),
  reorder: (ordemId: string, novaOrdem: number) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteDepoimentoOrdem.findUnique({
        where: { id: ordemId },
        select: {
          id: true,
          ordem: true,
          depoimento: {
            select: {
              id: true,
              depoimento: true,
              nome: true,
              cargo: true,
              fotoUrl: true,
            },
          },
        },
      });
      if (!current) throw new Error("Depoimento não encontrado");

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
          select: {
            id: true,
            ordem: true,
            depoimento: {
              select: {
                id: true,
                depoimento: true,
                nome: true,
                cargo: true,
                fotoUrl: true,
              },
            },
          },
        });
      }

      return current;
    }),
  remove: (depoimentoId: string) =>
    prisma.$transaction(async (tx) => {
      const ordem = await tx.websiteDepoimentoOrdem.findUnique({
        where: { websiteDepoimentoId: depoimentoId },
        select: { id: true, ordem: true },
      });
      if (!ordem) return;
      await tx.websiteDepoimentoOrdem.delete({ where: { id: ordem.id } });
      await tx.websiteDepoimento.delete({ where: { id: depoimentoId } });
      await tx.websiteDepoimentoOrdem.updateMany({
        where: { ordem: { gt: ordem.ordem } },
        data: { ordem: { decrement: 1 } },
      });
    }),
};

