import { prisma } from "../../../config/prisma";
import { WebsiteHeaderPage } from "@prisma/client";

export const headerPagesService = {
  list: () => prisma.websiteHeaderPage.findMany(),
  get: (id: string) =>
    prisma.websiteHeaderPage.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteHeaderPage, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteHeaderPage.create({ data }),
  update: (id: string, data: Partial<WebsiteHeaderPage>) =>
    prisma.websiteHeaderPage.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteHeaderPage.delete({ where: { id } }),
};
