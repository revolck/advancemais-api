import { prisma } from "../../../config/prisma";
import { WebsitePlaninhas } from "@prisma/client";

export const planinhasService = {
  list: () => prisma.websitePlaninhas.findMany(),
  get: (id: string) =>
    prisma.websitePlaninhas.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsitePlaninhas, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websitePlaninhas.create({ data }),
  update: (id: string, data: Partial<WebsitePlaninhas>) =>
    prisma.websitePlaninhas.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websitePlaninhas.delete({ where: { id } }),
};

