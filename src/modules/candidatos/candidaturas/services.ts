import { prisma } from '@/config/prisma';
import { CandidatoLogTipo, Prisma, Roles, StatusProcesso } from '@prisma/client';
import { candidatoLogsService } from '@/modules/candidatos/logs/service';
import type { CandidatoLogEntry } from '@/modules/candidatos/logs/service';

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
    if (params.status && params.status.length > 0) {
      where.status = { in: params.status };
    } else {
      where.status = { not: StatusProcesso.CANCELADO };
    }
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
      select: { id: true, usuarioId: true },
    });
    if (!vaga) throw Object.assign(new Error('Vaga não encontrada'), { code: 'VAGA_NOT_FOUND' });

    const candidaturasExistentes = await prisma.empresasCandidatos.count({
      where: { vagaId: vaga.id, candidatoId: params.usuarioId },
    });
    if (candidaturasExistentes > 0) {
      throw Object.assign(new Error('Limite de candidaturas atingido para esta vaga'), {
        code: 'VAGA_LIMIT_CANDIDATURAS',
      });
    }

    return prisma.$transaction(async (tx) => {
      const created = await tx.empresasCandidatos.create({
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

      await candidatoLogsService.create(
        {
          usuarioId: params.usuarioId,
          tipo: CandidatoLogTipo.CANDIDATURA_CRIADA,
          metadata: {
            candidaturaId: created.id,
            vagaId: vaga.id,
            curriculoId: params.curriculoId,
          },
        },
        tx,
      );

      return created;
    });
  },
  cancelForCandidato: async (params: {
    usuarioId: string;
    motivo: 'CURRICULO_REMOVIDO' | 'BLOQUEIO';
    curriculoId?: string;
    tx?: Prisma.TransactionClient;
  }) => {
    const client = params.tx ?? prisma;
    const where: Prisma.EmpresasCandidatosWhereInput = {
      candidatoId: params.usuarioId,
    };

    if (params.curriculoId) {
      where.curriculoId = params.curriculoId;
    }

    const candidaturas = await client.empresasCandidatos.findMany({
      where,
      select: { id: true, vagaId: true, status: true, curriculoId: true },
    });

    if (candidaturas.length === 0) {
      return 0;
    }

    const logs: CandidatoLogEntry[] = [];
    const shouldClearCurriculo = Boolean(params.curriculoId);
    const logTipo =
      params.motivo === 'BLOQUEIO'
        ? CandidatoLogTipo.CANDIDATURA_CANCELADA_BLOQUEIO
        : CandidatoLogTipo.CANDIDATURA_CANCELADA_CURRICULO;

    for (const candidatura of candidaturas) {
      if (candidatura.status === StatusProcesso.CANCELADO) {
        if (shouldClearCurriculo && candidatura.curriculoId) {
          await client.empresasCandidatos.update({
            where: { id: candidatura.id },
            data: { curriculoId: null },
          });
        }
        continue;
      }

      await client.empresasCandidatos.update({
        where: { id: candidatura.id },
        data: {
          status: StatusProcesso.CANCELADO,
          ...(shouldClearCurriculo ? { curriculoId: null } : {}),
        },
      });

      logs.push({
        usuarioId: params.usuarioId,
        tipo: logTipo,
        metadata: {
          candidaturaId: candidatura.id,
          vagaId: candidatura.vagaId,
          curriculoId: candidatura.curriculoId,
          statusAnterior: candidatura.status,
          motivo: params.motivo,
        },
      });
    }

    if (logs.length > 0) {
      await candidatoLogsService.bulkCreate(logs, client);
    }

    return logs.length;
  },
};
