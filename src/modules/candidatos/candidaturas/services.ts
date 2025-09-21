import { prisma } from '@/config/prisma';
import { Roles, StatusProcesso } from '@prisma/client';

export const candidaturasService = {
  listMine: async (params: { usuarioId: string; vagaId?: string; status?: StatusProcesso[] }) => {
    const where: any = { candidatoId: params.usuarioId };
    if (params.vagaId) where.vagaId = params.vagaId;
    if (params.status && params.status.length > 0) where.status = { in: params.status };
    return prisma.empresasCandidatos.findMany({
      where,
      orderBy: { aplicadaEm: 'desc' },
      select: {
        id: true,
        vagaId: true,
        candidatoId: true,
        curriculoId: true,
        empresaUsuarioId: true,
        status: true,
        origem: true,
        aplicadaEm: true,
        atualizadaEm: true,
        consentimentos: true,
        vaga: {
          select: {
            id: true,
            titulo: true,
            slug: true,
            status: true,
            usuarioId: true,
            inseridaEm: true,
          },
        },
        curriculo: {
          select: { id: true, titulo: true, resumo: true, ultimaAtualizacao: true },
        },
      },
    });
  },

  listReceived: async (params: {
    empresaUsuarioId: string;
    vagaId?: string;
    status?: StatusProcesso[];
  }) => {
    const where: any = { empresaUsuarioId: params.empresaUsuarioId };
    if (params.vagaId) where.vagaId = params.vagaId;
    if (params.status && params.status.length > 0) where.status = { in: params.status };
    return prisma.empresasCandidatos.findMany({
      where,
      orderBy: { aplicadaEm: 'desc' },
      select: {
        id: true,
        vagaId: true,
        candidatoId: true,
        curriculoId: true,
        empresaUsuarioId: true,
        status: true,
        origem: true,
        aplicadaEm: true,
        atualizadaEm: true,
        consentimentos: true,
        vaga: {
          select: { id: true, titulo: true, slug: true, status: true, inseridaEm: true },
        },
        curriculo: {
          select: { id: true, titulo: true, resumo: true, ultimaAtualizacao: true },
        },
        candidato: {
          select: { id: true, nomeCompleto: true, email: true },
        },
      },
    });
  },
  apply: async (params: {
    usuarioId: string;
    role: Roles;
    vagaId: string;
    curriculoId: string;
    consentimentos?: any;
  }) => {
    if (params.role !== Roles.ALUNO_CANDIDATO) {
      throw Object.assign(new Error('Apenas candidatos podem se aplicar'), { code: 'FORBIDDEN' });
    }
    const curriculo = await prisma.usuariosCurriculos.findFirst({
      where: { id: params.curriculoId, usuarioId: params.usuarioId },
    });
    if (!curriculo)
      throw Object.assign(new Error('Currículo inválido'), { code: 'CURRICULO_INVALIDO' });

    const vaga = await prisma.empresasVagas.findUnique({
      where: { id: params.vagaId },
      select: { id: true, usuarioId: true, maxCandidaturasPorUsuario: true },
    });
    if (!vaga) throw Object.assign(new Error('Vaga não encontrada'), { code: 'VAGA_NOT_FOUND' });

    if (typeof vaga.maxCandidaturasPorUsuario === 'number' && vaga.maxCandidaturasPorUsuario > 0) {
      const count = await prisma.empresasCandidatos.count({
        where: { vagaId: vaga.id, candidatoId: params.usuarioId },
      });
      if (count >= vaga.maxCandidaturasPorUsuario) {
        throw Object.assign(new Error('Limite de candidaturas atingido para esta vaga'), {
          code: 'VAGA_LIMIT_CANDIDATURAS',
        });
      }
    }

    return prisma.empresasCandidatos.create({
      data: {
        vagaId: vaga.id,
        candidatoId: params.usuarioId,
        curriculoId: params.curriculoId,
        empresaUsuarioId: vaga.usuarioId,
        status: StatusProcesso.RECEBIDA,
        origem: 'SITE' as any,
        consentimentos: params.consentimentos ?? null,
      },
    });
  },
};
