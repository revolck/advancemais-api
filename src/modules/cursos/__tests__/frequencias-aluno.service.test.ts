import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CursosFrequenciaStatus, StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { frequenciaService } from '../services/frequencia.service';

const alunoId = '11111111-1111-1111-1111-111111111111';
const cursoId = '22222222-2222-2222-2222-222222222222';
const turmaId = '33333333-3333-3333-3333-333333333333';

const buildFrequencia = (id: string, aulaId: string, status = CursosFrequenciaStatus.PRESENTE) =>
  ({
    id,
    turmaId,
    inscricaoId: '44444444-4444-4444-4444-444444444444',
    aulaId,
    dataReferencia: new Date('2026-05-20T12:00:00.000Z'),
    status,
    justificativa: null,
    observacoes: null,
    criadoEm: new Date('2026-05-20T12:00:00.000Z'),
    atualizadoEm: new Date('2026-05-20T12:00:00.000Z'),
    CursosTurmas: {
      id: turmaId,
      nome: 'Turma 1',
      codigo: 'TRM001',
      cursoId,
      Cursos: { id: cursoId, nome: 'Curso Real' },
    },
    CursosTurmasInscricoes: {
      id: '44444444-4444-4444-4444-444444444444',
      alunoId,
      Usuarios: {
        id: alunoId,
        nomeCompleto: 'Aluno Real',
        email: 'aluno@email.com',
        cpf: null,
        codUsuario: 'ALU001',
        UsuariosInformation: null,
      },
    },
    CursosTurmasAulas: {
      id: aulaId,
      nome: `Aula ${aulaId.slice(-1)}`,
      ordem: 1,
      moduloId: null,
      CursosTurmasModulos: null,
    },
  }) as any;

describe('frequenciaService.listMinhasFrequencias', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.cursosAulasProgresso, 'findMany').mockResolvedValue([]);
  });

  it('consulta somente inscrições liberadas do aluno, incluindo reprovado', async () => {
    jest.spyOn(prisma.cursosFrequenciaAlunos, 'findMany').mockResolvedValue([]);

    await frequenciaService.listMinhasFrequencias(alunoId, {
      page: 1,
      pageSize: 10,
      orderBy: 'atualizadoEm',
      order: 'desc',
    });

    const args = (prisma.cursosFrequenciaAlunos.findMany as jest.Mock).mock.calls[0][0] as any;
    expect(args.where.CursosTurmasInscricoes).toMatchObject({
      alunoId,
      statusPagamento: 'APROVADO',
    });
    expect(args.where.CursosTurmasInscricoes.status.in).toEqual([
      StatusInscricao.INSCRITO,
      StatusInscricao.EM_ANDAMENTO,
      StatusInscricao.EM_ESTAGIO,
      StatusInscricao.CONCLUIDO,
      StatusInscricao.REPROVADO,
    ]);
  });

  it('filtra aulas lançadas e pagina o conjunto final com metadados de filtros', async () => {
    jest
      .spyOn(prisma.cursosFrequenciaAlunos, 'findMany')
      .mockResolvedValue([
        buildFrequencia('freq-1', '55555555-5555-5555-5555-555555555551'),
        buildFrequencia('freq-2', '55555555-5555-5555-5555-555555555552'),
        buildFrequencia(
          'freq-3',
          '55555555-5555-5555-5555-555555555553',
          CursosFrequenciaStatus.AUSENTE,
        ),
      ]);

    const result = await frequenciaService.listMinhasFrequencias(alunoId, {
      status: CursosFrequenciaStatus.PRESENTE,
      dataInicio: new Date('2026-05-20T00:00:00.000Z'),
      dataFim: new Date('2026-05-20T00:00:00.000Z'),
      page: 1,
      pageSize: 1,
      orderBy: 'atualizadoEm',
      order: 'desc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      cursoId,
      cursoNome: 'Curso Real',
      turmaId,
      tipoOrigem: 'AULA',
      status: 'PRESENTE',
    });
    expect(result.pagination).toMatchObject({ total: 2, totalPages: 2, pageSize: 1 });
    expect(result.filters.cursos).toEqual([{ id: cursoId, nome: 'Curso Real' }]);
    expect(result.filters.aulas).toHaveLength(3);
  });
});
