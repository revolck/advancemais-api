import { prisma } from "../../../config/prisma";
import { WebsiteStatus } from "@prisma/client";

export const teamService = {
  list: (status?: WebsiteStatus) =>
    prisma.websiteTeamOrdem.findMany({
      include: { team: true },
      where: status ? { status } : undefined,
      orderBy: { ordem: "asc" },
    }),
  get: (id: string) =>
    prisma.websiteTeamOrdem.findUnique({
      where: { id },
      include: { team: true },
    }),
  create: async (data: {
    photoUrl: string;
    nome: string;
    cargo: string;
    status?: WebsiteStatus;
  }) => {
    const max = await prisma.websiteTeamOrdem.aggregate({
      _max: { ordem: true },
    });
    const ordem = (max._max.ordem ?? 0) + 1;
    return prisma.websiteTeamOrdem.create({
      data: {
        ordem,
        status: data.status ?? "RASCUNHO",
        team: {
          create: {
            photoUrl: data.photoUrl,
            nome: data.nome,
            cargo: data.cargo,
          },
        },
      },
      include: { team: true },
    });
  },
  update: (
    teamId: string,
    data: {
      photoUrl?: string;
      nome?: string;
      cargo?: string;
      status?: WebsiteStatus;
      ordem?: number;
    }
  ) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteTeamOrdem.findUnique({
        where: { websiteTeamId: teamId },
      });
      if (!current) throw new Error("Team member não encontrado");

      let ordem = data.ordem ?? current.ordem;
      if (data.ordem !== undefined && data.ordem !== current.ordem) {
        if (data.ordem > current.ordem) {
          await tx.websiteTeamOrdem.updateMany({
            where: { ordem: { gt: current.ordem, lte: data.ordem } },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteTeamOrdem.updateMany({
            where: { ordem: { gte: data.ordem, lt: current.ordem } },
            data: { ordem: { increment: 1 } },
          });
        }
        ordem = data.ordem;
      }

      return tx.websiteTeamOrdem.update({
        where: { id: current.id },
        data: {
          ordem,
          ...(data.status !== undefined && { status: data.status }),
          ...(data.photoUrl !== undefined ||
          data.nome !== undefined ||
          data.cargo !== undefined
            ? {
                team: {
                  update: {
                    ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
                    ...(data.nome !== undefined && { nome: data.nome }),
                    ...(data.cargo !== undefined && { cargo: data.cargo }),
                  },
                },
              }
            : {}),
        },
        include: { team: true },
      });
    }),
  reorder: (ordemId: string, novaOrdem: number) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.websiteTeamOrdem.findUnique({
        where: { id: ordemId },
        include: { team: true },
      });
      if (!current) throw new Error("Team member não encontrado");

      if (novaOrdem !== current.ordem) {
        await tx.websiteTeamOrdem.update({
          where: { id: ordemId },
          data: { ordem: 0 },
        });

        if (novaOrdem > current.ordem) {
          await tx.websiteTeamOrdem.updateMany({
            where: { ordem: { gt: current.ordem, lte: novaOrdem } },
            data: { ordem: { decrement: 1 } },
          });
        } else {
          await tx.websiteTeamOrdem.updateMany({
            where: { ordem: { gte: novaOrdem, lt: current.ordem } },
            data: { ordem: { increment: 1 } },
          });
        }

        return tx.websiteTeamOrdem.update({
          where: { id: ordemId },
          data: { ordem: novaOrdem },
          include: { team: true },
        });
      }

      return current;
    }),
  remove: (teamId: string) =>
    prisma.$transaction(async (tx) => {
      const ordem = await tx.websiteTeamOrdem.findUnique({
        where: { websiteTeamId: teamId },
      });
      if (!ordem) return;
      await tx.websiteTeamOrdem.delete({ where: { id: ordem.id } });
      await tx.websiteTeam.delete({ where: { id: teamId } });
      await tx.websiteTeamOrdem.updateMany({
        where: { ordem: { gt: ordem.ordem } },
        data: { ordem: { decrement: 1 } },
      });
    }),
};

