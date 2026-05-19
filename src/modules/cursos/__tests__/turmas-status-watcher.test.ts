import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CursoStatus, Roles, Status } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { processTurmasStatusWatcherTick } from '../cron/turmas-status-watcher';

jest.mock('@/modules/brevo/services/email-service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendGeneric: jest.fn().mockResolvedValue(undefined),
  })),
}));

const turmaId = '44444444-4444-4444-4444-444444444444';
const cursoId = '33333333-3333-3333-3333-333333333333';
const gestorId = '11111111-1111-1111-1111-111111111111';
const alunoId = '22222222-2222-2222-2222-222222222222';
const agora = new Date('2026-05-19T12:00:00.000Z');

const buildTurma = (overrides: Record<string, any> = {}) => ({
  id: turmaId,
  nome: 'Turma Operacional',
  status: CursoStatus.INSCRICOES_ENCERRADAS,
  dataInscricaoInicio: new Date('2026-05-01T00:00:00.000Z'),
  dataInscricaoFim: new Date('2026-05-18T23:59:59.000Z'),
  dataInicio: new Date('2026-05-20T10:00:00.000Z'),
  dataFim: new Date('2026-07-20T18:00:00.000Z'),
  Cursos: {
    id: cursoId,
    nome: 'Curso Operacional',
  },
  ...overrides,
});

describe('Turmas status watcher', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.cursosTurmas, 'updateMany').mockResolvedValue({ count: 0 } as any);
    jest.spyOn(prisma.cursosTurmas, 'update').mockResolvedValue({ id: turmaId } as any);
    jest.spyOn(prisma.usuarios, 'findMany').mockResolvedValue([
      {
        id: gestorId,
        nomeCompleto: 'Gestor Advance',
        email: 'gestor@example.com',
        role: Roles.ADMIN,
        status: Status.ATIVO,
      },
    ] as any);
    jest.spyOn(prisma.notificacoesEnviadas, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.notificacoesEnviadas, 'create').mockResolvedValue({ id: 'enviada-1' } as any);
    jest.spyOn(prisma.notificacoes, 'create').mockResolvedValue({ id: 'notificacao-1' } as any);
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([
      {
        alunoId,
        Usuarios: {
          email: 'aluno@example.com',
          nomeCompleto: 'Aluno Advance',
        },
      },
    ] as any);
    jest.spyOn(prisma.cursosTurmasInscricoes, 'updateMany').mockResolvedValue({ count: 0 } as any);
  });

  it('notifica a gestão quando faltam 24h e a turma publicada está sem estrutura', async () => {
    jest.spyOn(prisma.cursosTurmas, 'findMany').mockResolvedValue([buildTurma()] as any);
    jest.spyOn(prisma.cursosTurmasAulas, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.cursosTurmasProvas, 'count').mockResolvedValue(0);

    const result = await processTurmasStatusWatcherTick(agora);

    expect(result.totalBloqueadasPorEstrutura).toBe(0);
    expect(prisma.notificacoes.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: gestorId,
        tipo: 'TURMA_ESTRUTURA_PENDENTE_24H',
        prioridade: 'ALTA',
      }),
    });
    expect(prisma.cursosTurmas.update).not.toHaveBeenCalled();
  });

  it('devolve a turma para rascunho e mantém alunos inscritos quando chega o início sem estrutura', async () => {
    jest.spyOn(prisma.cursosTurmas, 'findMany').mockResolvedValue([
      buildTurma({
        dataInicio: new Date('2026-05-19T11:59:00.000Z'),
      }),
    ] as any);
    jest.spyOn(prisma.cursosTurmasAulas, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.cursosTurmasProvas, 'count').mockResolvedValue(0);

    const result = await processTurmasStatusWatcherTick(agora);

    expect(result.totalBloqueadasPorEstrutura).toBe(1);
    expect(prisma.cursosTurmas.update).toHaveBeenCalledWith({
      where: { id: turmaId },
      data: {
        status: CursoStatus.RASCUNHO,
        atualizadoEm: agora,
      },
    });
    expect(prisma.cursosTurmasInscricoes.updateMany).not.toHaveBeenCalled();
    expect(prisma.notificacoes.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: alunoId,
        tipo: 'TURMA_INICIO_REPROGRAMADO',
        prioridade: 'ALTA',
      }),
    });
  });

  it('permite iniciar a turma quando existe pelo menos 1 item efetivo', async () => {
    jest.spyOn(prisma.cursosTurmas, 'findMany').mockResolvedValue([
      buildTurma({
        dataInicio: new Date('2026-05-19T11:59:00.000Z'),
      }),
    ] as any);
    jest.spyOn(prisma.cursosTurmasAulas, 'count').mockResolvedValue(1);
    jest.spyOn(prisma.cursosTurmasProvas, 'count').mockResolvedValue(0);

    const result = await processTurmasStatusWatcherTick(agora);

    expect(result.totalBloqueadasPorEstrutura).toBe(0);
    expect(prisma.cursosTurmas.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [turmaId] },
        status: { not: CursoStatus.RASCUNHO },
      },
      data: {
        status: CursoStatus.EM_ANDAMENTO,
        atualizadoEm: agora,
      },
    });
  });
});
