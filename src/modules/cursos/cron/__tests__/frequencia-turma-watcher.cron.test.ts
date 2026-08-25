const mockTurmasFindMany = jest.fn();
const mockCheckpointFindUnique = jest.fn();
const mockCheckpointCreateMany = jest.fn();
const mockInscricoesFindMany = jest.fn();
const mockAlertaCreate = jest.fn();
const mockAlertaDeleteMany = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    cursosTurmas: { findMany: mockTurmasFindMany },
    cursosTurmasFrequenciaCheckpoints: {
      findUnique: mockCheckpointFindUnique,
      createMany: mockCheckpointCreateMany,
    },
    cursosTurmasInscricoes: { findMany: mockInscricoesFindMany },
    cursosTurmasAlertas: { create: mockAlertaCreate, deleteMany: mockAlertaDeleteMany },
  },
}));

const mockContarItensDaTurma = jest.fn();
const mockCalcularCheckpoint = jest.fn();
const mockCalcularFrequenciaAluno = jest.fn();

jest.mock('@/modules/cursos/services/frequencia-turma.service', () => ({
  frequenciaTurmaService: {
    contarItensDaTurma: mockContarItensDaTurma,
    calcularCheckpoint: mockCalcularCheckpoint,
    calcularFrequenciaAluno: mockCalcularFrequenciaAluno,
  },
}));

const mockNotificarEquipeDaTurma = jest.fn();
const mockCriar = jest.fn();
const mockEnviarEmailCritico = jest.fn();

jest.mock('@/modules/cursos/aulas/services/notificacoes-helper.service', () => ({
  notificacoesHelper: {
    notificarEquipeDaTurma: mockNotificarEquipeDaTurma,
    criar: mockCriar,
    enviarEmailCritico: mockEnviarEmailCritico,
  },
}));

import { processFrequenciaTurmaWatcherTick } from '../frequencia-turma-watcher.cron';

const TURMA_BASE = {
  id: 'turma-1',
  nome: 'Turma Teste',
  instrutorId: 'instrutor-1',
  Cursos: { id: 'curso-1', nome: 'Curso Teste' },
  CursosTurmasInstrutores: [] as { instrutorId: string }[],
};

describe('processFrequenciaTurmaWatcherTick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlertaDeleteMany.mockResolvedValue({ count: 0 });
    mockContarItensDaTurma.mockResolvedValue({
      total: 10,
      itensOcorridos: 4,
      aulas: [],
      provaIds: [],
    });
    mockCalcularCheckpoint.mockReturnValue(40);
    mockCriar.mockResolvedValue({ id: 'notif-1' });
  });

  it('não faz nada se o checkpoint já foi processado (idempotente)', async () => {
    mockTurmasFindMany.mockResolvedValue([TURMA_BASE]);
    mockCheckpointFindUnique.mockResolvedValue({ id: 'checkpoint-existente' });

    const resultado = await processFrequenciaTurmaWatcherTick(new Date());

    expect(mockAlertaCreate).not.toHaveBeenCalled();
    expect(mockNotificarEquipeDaTurma).not.toHaveBeenCalled();
    expect(resultado.turmasComAlerta).toBe(0);
  });

  it('não cria alerta se nenhum aluno está abaixo do checkpoint', async () => {
    mockTurmasFindMany.mockResolvedValue([TURMA_BASE]);
    mockCheckpointFindUnique.mockResolvedValue(null);
    mockInscricoesFindMany.mockResolvedValue([
      {
        id: 'insc-1',
        alunoId: 'aluno-1',
        Usuarios: { nomeCompleto: 'Aluno 1', email: 'a1@x.com' },
      },
    ]);
    mockCalcularFrequenciaAluno.mockResolvedValue(50); // acima do checkpoint (40)

    const resultado = await processFrequenciaTurmaWatcherTick(new Date());

    expect(mockCheckpointCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { turmaId: 'turma-1', checkpoint: 20 },
          { turmaId: 'turma-1', checkpoint: 40 },
        ],
      }),
    );
    expect(mockAlertaCreate).not.toHaveBeenCalled();
    expect(mockNotificarEquipeDaTurma).not.toHaveBeenCalled();
    expect(resultado.turmasProcessadas).toBe(1);
    expect(resultado.turmasComAlerta).toBe(0);
  });

  it('cria alerta + notifica equipe e alunos abaixo do checkpoint', async () => {
    mockTurmasFindMany.mockResolvedValue([TURMA_BASE]);
    mockCheckpointFindUnique.mockResolvedValue(null);
    mockInscricoesFindMany.mockResolvedValue([
      {
        id: 'insc-1',
        alunoId: 'aluno-1',
        Usuarios: { nomeCompleto: 'Aluno Atrasado', email: 'a1@x.com' },
      },
      {
        id: 'insc-2',
        alunoId: 'aluno-2',
        Usuarios: { nomeCompleto: 'Aluno Em Dia', email: 'a2@x.com' },
      },
    ]);
    mockCalcularFrequenciaAluno
      .mockResolvedValueOnce(10) // aluno-1: abaixo de 40
      .mockResolvedValueOnce(60); // aluno-2: acima de 40

    const resultado = await processFrequenciaTurmaWatcherTick(new Date());

    expect(mockAlertaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          turmaId: 'turma-1',
          checkpoint: 40,
          alunosAfetados: [
            expect.objectContaining({ alunoId: 'aluno-1', frequenciaPercentual: 10 }),
          ],
        }),
      }),
    );
    expect(mockNotificarEquipeDaTurma).toHaveBeenCalledTimes(1);
    expect(mockNotificarEquipeDaTurma).toHaveBeenCalledWith(
      expect.objectContaining({ turmaId: 'turma-1', tipo: 'TURMA_FREQUENCIA_ALERTA' }),
    );
    expect(mockCriar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 'aluno-1', tipo: 'ALUNO_FREQUENCIA_BAIXA' }),
    );
    expect(mockEnviarEmailCritico).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'a1@x.com' }),
    );
    expect(resultado.turmasComAlerta).toBe(1);
  });

  it('não avalia turmas cujo checkpoint atual é 0', async () => {
    mockCalcularCheckpoint.mockReturnValue(0);
    mockTurmasFindMany.mockResolvedValue([TURMA_BASE]);

    const resultado = await processFrequenciaTurmaWatcherTick(new Date());

    expect(mockCheckpointFindUnique).not.toHaveBeenCalled();
    expect(resultado.turmasProcessadas).toBe(0);
  });

  it('remove alertas expirados independente de haver checkpoint novo', async () => {
    mockTurmasFindMany.mockResolvedValue([]);
    mockAlertaDeleteMany.mockResolvedValue({ count: 3 });

    const resultado = await processFrequenciaTurmaWatcherTick(new Date());

    expect(resultado.alertasExpiradosRemovidos).toBe(3);
  });
});
