import { prisma } from "../../../config/prisma";
import { planoEmpresaService } from "../../plano-empresa/services/plano-empresa.service";
import { VagaStatus } from "../../plano-empresa/enums";

export interface VagaCreateInput {
  empresaId: string;
  nome: string;
  cidade?: string;
  estado?: string;
  tipoContrato: string;
  regimeTrabalho: string;
  pcd?: boolean;
  requisitos: string;
  atividades: string;
  beneficios: string;
  observacoes?: string;
  publicadaAte: Date;
  status?: VagaStatus;
}

export const vagaService = {
  create: async (data: VagaCreateInput) => {
    const empresa = await prisma.empresa.findUnique({
      where: { id: data.empresaId },
    });
    if (!empresa) throw new Error("Empresa não encontrada");

    const cidade = data.cidade || empresa.cidade || "";
    const estado = data.estado || empresa.estado || "";
    const status = data.status ?? VagaStatus.RASCUNHO;

    if (status !== VagaStatus.RASCUNHO) {
      const canPublish = await planoEmpresaService.canPublishVaga(data.empresaId);
      if (!canPublish) throw new Error("Limite de vagas atingido");
    }

    return prisma.vaga.create({
      data: {
        empresaId: data.empresaId,
        nome: data.nome,
        cidade,
        estado,
        tipoContrato: data.tipoContrato,
        regimeTrabalho: data.regimeTrabalho,
        pcd: data.pcd ?? false,
        requisitos: data.requisitos,
        atividades: data.atividades,
        beneficios: data.beneficios,
        observacoes: data.observacoes,
        publicadaAte: data.publicadaAte,
        status,
      },
      include: {
        empresa: { select: { nome: true, logoUrl: true } },
      },
    });
  },

  list: async () => {
    return prisma.vaga.findMany({
      include: {
        empresa: { select: { nome: true, logoUrl: true } },
      },
    });
  },

  apply: async (vagaId: string, usuarioId: string, curriculoUrl?: string) => {
    return prisma.vagaCandidatura.create({
      data: {
        vagaId,
        usuarioId,
        curriculoUrl,
      },
    });
  },
};
