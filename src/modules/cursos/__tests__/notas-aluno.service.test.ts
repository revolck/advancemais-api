import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { notasService } from '../services/notas.service';

const alunoId = '11111111-1111-1111-1111-111111111111';
const outroAlunoId = '22222222-2222-2222-2222-222222222222';

const buildInscricao = (overrides: Record<string, any> = {}) => ({
  id: 'inscricao-1',
  alunoId,
  status: StatusInscricao.INSCRITO,
  criadoEm: new Date('2026-05-01T12:00:00.000Z'),
  Usuarios: {
    id: alunoId,
    nomeCompleto: 'Aluno Teste',
    cpf: '00000000000',
    codUsuario: 'ALU001',
  },
  CursosTurmas: {
    id: 'turma-1',
    nome: 'Turma 1',
    codigo: 'TRM001',
    cursoId: '33333333-3333-3333-3333-333333333333',
    metodo: 'ONLINE',
    dataInicio: new Date('2026-05-10T00:00:00.000Z'),
    Cursos: {
      id: '33333333-3333-3333-3333-333333333333',
      nome: 'Curso 1',
      codigo: 'CUR001',
      cargaHoraria: 20,
    },
  },
  ...overrides,
});

describe('notasService.listMinhasNotas', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma, '$queryRaw').mockResolvedValue([] as any);
  });

  it('filtra inscrições do aluno por pagamento aprovado e status elegíveis incluindo REPROVADO', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([]);

    await notasService.listMinhasNotas(alunoId, {
      page: 1,
      pageSize: 10,
      orderBy: 'atualizadoEm',
      order: 'desc',
    });

    const findArgs = (prisma.cursosTurmasInscricoes.findMany as jest.Mock).mock.calls[0][0] as any;

    expect(findArgs.where).toMatchObject({
      alunoId,
      statusPagamento: 'APROVADO',
    });
    expect(findArgs.where.status.in).toEqual([
      StatusInscricao.INSCRITO,
      StatusInscricao.EM_ANDAMENTO,
      StatusInscricao.EM_ESTAGIO,
      StatusInscricao.CONCLUIDO,
      StatusInscricao.REPROVADO,
    ]);
    expect(findArgs.where.status.in).not.toContain(StatusInscricao.CANCELADO);
    expect(findArgs.where.status.in).not.toContain(StatusInscricao.TRANCADO);
    expect(findArgs.where.status.in).not.toContain(StatusInscricao.AGUARDANDO_PAGAMENTO);
  });

  it('aplica situação, período e paginação sobre notas consolidadas reais', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([
      buildInscricao(),
      buildInscricao({
        id: 'inscricao-2',
        status: StatusInscricao.REPROVADO,
        CursosTurmas: {
          id: 'turma-2',
          nome: 'Turma 2',
          codigo: 'TRM002',
          cursoId: '44444444-4444-4444-4444-444444444444',
          metodo: 'PRESENCIAL',
          dataInicio: new Date('2026-04-10T00:00:00.000Z'),
          Cursos: {
            id: '44444444-4444-4444-4444-444444444444',
            nome: 'Curso 2',
            codigo: 'CUR002',
            cargaHoraria: 40,
          },
        },
      }),
    ] as any);
    jest.spyOn(prisma.cursosTurmasProvas, 'findMany').mockResolvedValue([
      { id: 'prova-1', turmaId: 'turma-1', peso: 1 },
      { id: 'prova-2', turmaId: 'turma-2', peso: 1 },
    ] as any);
    jest.spyOn(prisma.cursosTurmasProvasEnvios, 'findMany').mockResolvedValue([
      {
        provaId: 'prova-1',
        inscricaoId: 'inscricao-1',
        nota: 8.5,
        atualizadoEm: new Date('2026-05-20T12:00:00.000Z'),
      },
      {
        provaId: 'prova-2',
        inscricaoId: 'inscricao-2',
        nota: 4,
        atualizadoEm: new Date('2026-04-20T12:00:00.000Z'),
      },
    ] as any);
    jest.spyOn(prisma.cursosNotas, 'findMany').mockResolvedValue([]);

    const result = await notasService.listMinhasNotas(alunoId, {
      situacao: 'APROVADO',
      dataInicio: '2026-05-01',
      dataFim: '2026-05-31',
      page: 1,
      pageSize: 1,
      orderBy: 'nota',
      order: 'desc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      cursoId: '33333333-3333-3333-3333-333333333333',
      cursoNome: 'Curso 1',
      turmaId: 'turma-1',
      statusRaw: StatusInscricao.INSCRITO,
      modalidade: 'ONLINE',
      dataInicio: '2026-05-10T00:00:00.000Z',
      cargaHoraria: 20,
      nota: 8.5,
    });
    expect(result.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
    expect(result.filters.cursos).toHaveLength(2);
  });
});

describe('notasService.listMeuHistoricoNota', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('bloqueia histórico de nota que pertence a outro aluno', async () => {
    jest.spyOn(prisma.cursosNotas, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prisma.auditoriaLogs, 'findMany').mockResolvedValue([
      {
        metadata: null,
        dadosAnteriores: null,
        dadosNovos: {
          notaId: 'nota-1',
          cursoId: '33333333-3333-3333-3333-333333333333',
          turmaId: 'turma-1',
          inscricaoId: 'inscricao-2',
          alunoId: outroAlunoId,
        },
      },
    ] as any);

    await expect(notasService.listMeuHistoricoNota('nota-1', alunoId)).rejects.toMatchObject({
      code: 'NOTA_NOT_FOUND',
    });
  });
});
