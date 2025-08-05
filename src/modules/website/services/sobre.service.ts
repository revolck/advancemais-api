import { prisma } from "../../../config/prisma";
import { WebsiteSobre } from "@prisma/client";

export const sobreService = {
  list: () => prisma.websiteSobre.findMany(),
  create: (data: Omit<WebsiteSobre, "id" | "criadoEm" | "atualizadoEm">) =>
    prisma.websiteSobre.create({ data }),
  update: (id: string, data: Partial<WebsiteSobre>) =>
    prisma.websiteSobre.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteSobre.delete({ where: { id } }),
};
