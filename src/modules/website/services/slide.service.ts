import { prisma } from "../../../config/prisma";
import { WebsiteSlide } from "@prisma/client";

export const slideService = {
  list: () =>
    prisma.websiteSlide.findMany({
      orderBy: { ordem: "asc" },
    }),
  get: (id: string) => prisma.websiteSlide.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteSlide, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteSlide.create({ data }),
  update: (id: string, data: Partial<WebsiteSlide>) =>
    prisma.websiteSlide.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteSlide.delete({ where: { id } }),
};

