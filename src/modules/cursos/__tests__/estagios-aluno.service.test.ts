import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CursosEstagioParticipanteStatus, CursosEstagioProgramaStatus } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { estagiosProgramasService } from '../services/estagios-programas.service';

const alunoId = '11111111-1111-1111-1111-111111111111';
const cursoId = '22222222-2222-2222-2222-222222222222';

const buildParticipacao = (
  status = CursosEstagioParticipanteStatus.EM_ANDAMENTO,
  programaStatus = CursosEstagioProgramaStatus.EM_ANDAMENTO,
) =>
  ({
    id: 'participacao-1',
    inscricaoId: 'inscricao-1',
    alunoId,
    status,
    atualizadoEm: new Date('2026-05-20T12:00:00.000Z'),
    CursosEstagiosProgramasGrupos: {
      empresaNome: 'Empresa do Grupo',
      horaInicio: '09:00',
      horaFim: '13:00',
    },
    CursosEstagiosProgramas: {
      id: 'estagio-1',
      titulo: 'Estágio',
      descricao: 'Observação',
      status: programaStatus,
      cursoId,
      turmaId: 'turma-1',
      dataInicio: new Date('2026-05-10T00:00:00.000Z'),
      dataFim: new Date('2026-06-10T00:00:00.000Z'),
      horarioPadraoInicio: '08:00',
      horarioPadraoFim: '12:00',
      empresaNome: 'Empresa do Programa',
      empresaTelefone: '82999999999',
      empresaEndereco: { rua: 'Rua A', numero: '10', cidade: 'Maceio', estado: 'AL' },
      Cursos: { nome: 'Curso Real' },
      CursosTurmas: { nome: 'Turma Real', codigo: 'TRM001' },
    },
  }) as any;

describe('estagiosProgramasService.listMeus', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('lista somente participações do aluno e prioriza dados do grupo', async () => {
    jest
      .spyOn(prisma.cursosEstagiosProgramasAlunos, 'findMany')
      .mockResolvedValue([buildParticipacao()]);

    const result = await estagiosProgramasService.listMeus(alunoId, {
      page: 1,
      pageSize: 10,
    });

    const args = (prisma.cursosEstagiosProgramasAlunos.findMany as jest.Mock).mock
      .calls[0][0] as any;
    expect(args.where).toEqual({ alunoId });
    expect(result.items[0]).toMatchObject({
      empresaNome: 'Empresa do Grupo',
      empresaTelefone: '82999999999',
      horarioInicio: '09:00',
      horarioFim: '13:00',
      rua: 'Rua A',
      status: 'EM_ANDAMENTO',
    });
    expect(result.filters.cursos).toEqual([{ id: cursoId, nome: 'Curso Real' }]);
  });

  it('mantém histórico cancelado e aplica curso e período antes da paginação', async () => {
    jest
      .spyOn(prisma.cursosEstagiosProgramasAlunos, 'findMany')
      .mockResolvedValue([
        buildParticipacao(
          CursosEstagioParticipanteStatus.REPROVADO,
          CursosEstagioProgramaStatus.CANCELADO,
        ),
      ]);

    const result = await estagiosProgramasService.listMeus(alunoId, {
      cursoId,
      dataInicio: new Date('2026-05-01T00:00:00.000Z'),
      dataFim: new Date('2026-05-31T00:00:00.000Z'),
      page: 1,
      pageSize: 1,
    });

    expect(result.items[0].status).toBe('CANCELADO');
    expect(result.pagination).toMatchObject({ total: 1, totalPages: 1 });
  });
});
