import { prisma } from "../../../config/prisma";
import { WebsiteSistema } from "@prisma/client";

export const sistemaService = {
  list: () => prisma.websiteSistema.findMany(),
  get: (id: string) =>
    prisma.websiteSistema.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteSistema, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteSistema.create({ data }),
  update: (id: string, data: Partial<WebsiteSistema>) =>
    prisma.websiteSistema.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteSistema.delete({ where: { id } }),
};

