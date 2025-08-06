import { prisma } from "../../../config/prisma";
import { WebsiteBusinessGroupInformation } from "@prisma/client";

export const businessGroupInformationService = {
  list: () =>
    prisma.websiteBusinessGroupInformation.findMany({
      orderBy: { ordem: "asc" },
    }),
  get: (id: string) =>
    prisma.websiteBusinessGroupInformation.findUnique({ where: { id } }),
  create: (
    data: Omit<
      WebsiteBusinessGroupInformation,
      "id" | "criadoEm" | "atualizadoEm"
    >
  ) => prisma.websiteBusinessGroupInformation.create({ data }),
  update: (id: string, data: Partial<WebsiteBusinessGroupInformation>) =>
    prisma.websiteBusinessGroupInformation.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteBusinessGroupInformation.delete({ where: { id } }),
};
