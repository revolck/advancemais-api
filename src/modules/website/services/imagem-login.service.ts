import { prisma } from "../../../config/prisma";
import { WebsiteImagemLogin } from "@prisma/client";

export const imagemLoginService = {
  list: () => prisma.websiteImagemLogin.findMany(),
  get: (id: string) => prisma.websiteImagemLogin.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteImagemLogin, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteImagemLogin.create({ data }),
  update: (id: string, data: Partial<WebsiteImagemLogin>) =>
    prisma.websiteImagemLogin.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteImagemLogin.delete({ where: { id } }),
};

