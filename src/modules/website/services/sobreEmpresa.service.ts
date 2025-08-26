import { prisma } from "../../../config/prisma";
import { WebsiteSobreEmpresa } from "@prisma/client";

export const sobreEmpresaService = {
  list: () => prisma.websiteSobreEmpresa.findMany(),
  get: (id: string) => prisma.websiteSobreEmpresa.findUnique({ where: { id } }),
  create: (
    data: Omit<WebsiteSobreEmpresa, "id" | "criadoEm" | "atualizadoEm">
  ) => prisma.websiteSobreEmpresa.create({ data }),
  update: (id: string, data: Partial<WebsiteSobreEmpresa>) =>
    prisma.websiteSobreEmpresa.update({ where: { id }, data }),
  remove: (id: string) => prisma.websiteSobreEmpresa.delete({ where: { id } }),
};

