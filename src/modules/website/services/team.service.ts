import { prisma } from "../../../config/prisma";
import { WebsiteStatus } from "@prisma/client";

export const teamService = {
  list: (status?: WebsiteStatus) =>
    prisma.websiteTeam.findMany({
      where: status ? { status } : undefined,
    }),
  get: (id: string) => prisma.websiteTeam.findUnique({ where: { id } }),
  create: (data: {
    photoUrl: string;
    nome: string;
    cargo: string;
    status?: WebsiteStatus;
  }) =>
    prisma.websiteTeam.create({
      data: {
        photoUrl: data.photoUrl,
        nome: data.nome,
        cargo: data.cargo,
        status: data.status ?? "RASCUNHO",
      },
    }),
  update: (
    id: string,
    data: {
      photoUrl?: string;
      nome?: string;
      cargo?: string;
      status?: WebsiteStatus;
    }
  ) => prisma.websiteTeam.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteTeam.delete({ where: { id } }),
};
