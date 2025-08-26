import { prisma } from "../../../config/prisma";
import { WebsiteTeam } from "@prisma/client";

export const teamService = {
  list: () => prisma.websiteTeam.findMany(),
  get: (id: string) => prisma.websiteTeam.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteTeam, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteTeam.create({ data }),
  update: (id: string, data: Partial<WebsiteTeam>) =>
    prisma.websiteTeam.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteTeam.delete({ where: { id } }),
};
