import { prisma } from "../../../config/prisma";
import { WebsiteBanner } from "@prisma/client";

export const bannerService = {
  list: () =>
    prisma.websiteBanner.findMany({
      orderBy: { ordem: "asc" },
    }),
  get: (id: string) => prisma.websiteBanner.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteBanner, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteBanner.create({ data }),
  update: (id: string, data: Partial<WebsiteBanner>) =>
    prisma.websiteBanner.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteBanner.delete({ where: { id } }),
};
