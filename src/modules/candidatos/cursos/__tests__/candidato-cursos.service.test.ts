import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { candidatoCursosService } from '../services';

const usuarioId = 'usuario-123';

const buildInscricao = (overrides: Record<string, any> = {}) => ({
  id: 'inscricao-123',
  status: StatusInscricao.INSCRITO,
  turmaId: 'turma-123',
  criadoEm: new Date('2026-05-01T10:00:00.000Z'),
  _count: {
    CursosFrequenciaAlunos: 1,
    CursosNotas: 1,
  },
  CursosTurmas: {
    id: 'turma-123',
    nome: 'Turma Online',
    metodo: 'ONLINE',
    dataInicio: new Date('2026-06-01T00:00:00.000Z'),
    dataFim: new Date('2026-07-01T00:00:00.000Z'),
    _count: {
      CursosTurmasAulas: 4,
      CursosTurmasProvas: 1,
    },
    Cursos: {
      id: 'curso-123',
      nome: 'Curso Online',
      descricao: 'Descrição do curso',
      imagemUrl: 'https://example.com/curso.jpg',
      cargaHoraria: 20,
    },
  },
  CursosNotas: [
    {
      nota: 8,
      peso: 1,
    },
  ],
  ...overrides,
});

describe('candidatoCursosService.listCursos', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.cursosTurmasAulas, 'findFirst').mockResolvedValue(null as any);
  });

  it('filtra apenas inscrições liberadas com pagamento aprovado', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([]);

    await candidatoCursosService.listCursos(usuarioId, { page: 2, limit: 4 });

    const countArgs = (prisma.cursosTurmasInscricoes.count as jest.Mock).mock.calls[0][0] as any;
    const findManyArgs = (prisma.cursosTurmasInscricoes.findMany as jest.Mock).mock
      .calls[0][0] as any;

    expect(countArgs.where).toMatchObject({
      alunoId: usuarioId,
      statusPagamento: 'APROVADO',
    });
    expect(countArgs.where.status.in).toEqual([
      StatusInscricao.INSCRITO,
      StatusInscricao.EM_ANDAMENTO,
      StatusInscricao.EM_ESTAGIO,
      StatusInscricao.CONCLUIDO,
    ]);
    expect(countArgs.where.status.in).not.toContain(StatusInscricao.CANCELADO);
    expect(countArgs.where.status.in).not.toContain(StatusInscricao.TRANCADO);
    expect(countArgs.where.status.in).not.toContain(StatusInscricao.REPROVADO);
    expect(countArgs.where.status.in).not.toContain(StatusInscricao.AGUARDANDO_PAGAMENTO);
    expect(findManyArgs.where).toEqual(countArgs.where);
    expect(findManyArgs.skip).toBe(4);
    expect(findManyArgs.take).toBe(4);
  });

  it('mantém o filtro de modalidade antes da paginação', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([]);

    await candidatoCursosService.listCursos(usuarioId, {
      modalidade: 'AO_VIVO',
      page: 1,
      limit: 8,
    });

    const countArgs = (prisma.cursosTurmasInscricoes.count as jest.Mock).mock.calls[0][0] as any;

    expect(countArgs.where.CursosTurmas).toEqual({
      metodo: {
        in: ['LIVE'],
      },
    });
  });

  it('retorna os campos esperados pelo frontend', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'count').mockResolvedValue(1);
    jest
      .spyOn(prisma.cursosTurmasInscricoes, 'findMany')
      .mockResolvedValue([buildInscricao()] as any);

    const result = await candidatoCursosService.listCursos(usuarioId, { page: 1, limit: 8 });

    expect(result.cursos).toHaveLength(1);
    expect(result.cursos[0]).toMatchObject({
      id: 'inscricao-123',
      cursoId: 'curso-123',
      turmaId: 'turma-123',
      status: 'Não iniciado',
      statusRaw: StatusInscricao.INSCRITO,
      nome: 'Curso Online',
      quantidadeAulas: 5,
      progresso: 25,
      notaMedia: 8,
      modalidade: 'ONLINE',
      cargaHoraria: 20,
    });
    expect(result.cursos[0].dataInicio).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    expect(result.paginacao).toMatchObject({
      page: 1,
      limit: 8,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('busca próxima aula apenas para inscrições liberadas e aprovadas', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([]);

    await candidatoCursosService.listCursos(usuarioId, { page: 1, limit: 8 });

    const findFirstArgs = (prisma.cursosTurmasAulas.findFirst as jest.Mock).mock.calls[0][0] as any;
    const inscricaoWhere = findFirstArgs.where.CursosTurmas.CursosTurmasInscricoes.some;

    expect(inscricaoWhere).toMatchObject({
      alunoId: usuarioId,
      statusPagamento: 'APROVADO',
    });
    expect(inscricaoWhere.status.in).toEqual([
      StatusInscricao.INSCRITO,
      StatusInscricao.EM_ANDAMENTO,
      StatusInscricao.EM_ESTAGIO,
    ]);
    expect(inscricaoWhere.status.in).not.toContain(StatusInscricao.CONCLUIDO);
    expect(inscricaoWhere.status.in).not.toContain(StatusInscricao.AGUARDANDO_PAGAMENTO);
  });
});
