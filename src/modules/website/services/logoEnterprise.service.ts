import { prisma } from "../../../config/prisma";
import { WebsiteLogoEnterprise } from "@prisma/client";

export const logoEnterpriseService = {
  list: () =>
    prisma.websiteLogoEnterprise.findMany({
      orderBy: { ordem: "asc" },
    }),
  get: (id: string) =>
    prisma.websiteLogoEnterprise.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteLogoEnterprise, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteLogoEnterprise.create({ data }),
  update: (id: string, data: Partial<WebsiteLogoEnterprise>) =>
    prisma.websiteLogoEnterprise.update({ where: { id }, data }),
  remove: (id: string) =>
    prisma.websiteLogoEnterprise.delete({ where: { id } }),
};
