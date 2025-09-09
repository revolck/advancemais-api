import { prisma } from "../../../config/prisma";
import { planoEmpresaService } from "../../plano-empresa";
import { RegimeTrabalho, TipoContrato, VagaStatus } from "../enums";

interface CreateVaga {
  empresaId: string;
  empresaNome?: string;
  empresaLogoUrl?: string;
  nome: string;
  localizacao?: string;
  tipoContrato: TipoContrato;
  regimeTrabalho: RegimeTrabalho;
  pcd?: boolean;
  requisitos?: string;
  atividades?: string;
  beneficios?: string;
  observacoes?: string;
  destaque?: boolean;
  status?: VagaStatus;
  expiraEm?: Date | string;
}

interface UpdateVaga extends Partial<CreateVaga> {}

export const vagaService = {
  list: (empresaId?: string) =>
    prisma.vaga.findMany({
      where: empresaId ? { empresaId } : undefined,
    }),

  get: (id: string) => prisma.vaga.findUnique({ where: { id } }),

  create: async (data: CreateVaga) => {
    const empresa = await prisma.empresa.findUnique({
      where: { id: data.empresaId },
    });
    if (!empresa) throw new Error("Empresa não encontrada");

    const status = data.status ?? VagaStatus.RASCUNHO;
    if (status !== VagaStatus.RASCUNHO) {
      const can = await planoEmpresaService.canPublishVaga(data.empresaId, data.destaque);
      if (!can) throw new Error("Limite de vagas atingido");
    }

    return prisma.vaga.create({
      data: {
        empresaId: data.empresaId,
        empresaNome: data.empresaNome ?? empresa.nome,
        empresaLogoUrl: data.empresaLogoUrl ?? empresa.logoUrl,
        nome: data.nome,
        localizacao:
          data.localizacao ?? `${empresa.cidade}/${empresa.estado}`,
        tipoContrato: data.tipoContrato,
        regimeTrabalho: data.regimeTrabalho,
        pcd: data.pcd ?? false,
        requisitos: data.requisitos,
        atividades: data.atividades,
        beneficios: data.beneficios,
        observacoes: data.observacoes,
        destaque: data.destaque ?? false,
        status,
        publicadoEm: status === VagaStatus.PUBLICADO ? new Date() : null,
        expiraEm: data.expiraEm ? new Date(data.expiraEm) : null,
      },
    });
  },

  update: async (id: string, data: UpdateVaga) => {
    const existing = await prisma.vaga.findUnique({ where: { id } });
    if (!existing) throw new Error("Vaga não encontrada");

    let status = data.status ?? existing.status;
    if (
      status !== VagaStatus.RASCUNHO &&
      existing.status === VagaStatus.RASCUNHO
    ) {
      const can = await planoEmpresaService.canPublishVaga(
        existing.empresaId,
        data.destaque ?? existing.destaque
      );
      if (!can) throw new Error("Limite de vagas atingido");
    }

    return prisma.vaga.update({
      where: { id },
      data: {
        ...data,
        publicadoEm:
          status === VagaStatus.PUBLICADO && !existing.publicadoEm
            ? new Date()
            : existing.publicadoEm,
        status,
      },
    });
  },

  remove: (id: string) => prisma.vaga.delete({ where: { id } }),

  apply: (vagaId: string, usuarioId: string) =>
    prisma.candidaturaVaga.create({ data: { vagaId, usuarioId } }),
};
