import { prisma } from "../../../config/prisma";
import { WebsiteDiferenciais } from "@prisma/client";

export const diferenciaisService = {
  list: () => prisma.websiteDiferenciais.findMany(),
  get: (id: string) =>
    prisma.websiteDiferenciais.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteDiferenciais, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteDiferenciais.create({ data }),
  update: (id: string, data: Partial<WebsiteDiferenciais>) =>
    prisma.websiteDiferenciais.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteDiferenciais.delete({ where: { id } }),
};
