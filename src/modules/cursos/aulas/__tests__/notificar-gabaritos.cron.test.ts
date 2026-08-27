const mockEnviosFindMany = jest.fn();
const mockNotasCreateMany = jest.fn();
const mockCriarNotificacao = jest.fn();
const mockReconciliarInscricao = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    cursosTurmasProvasEnvios: { findMany: mockEnviosFindMany },
    cursosNotas: { createMany: mockNotasCreateMany },
  },
}));

jest.mock('@/modules/cursos/aulas/services/notificacoes-helper.service', () => ({
  notificacoesHelper: { criar: mockCriarNotificacao },
}));

jest.mock('@/modules/cursos/services/pagamentos-aluno.service', () => ({
  pagamentosAlunoService: { reconciliarRecuperacaoInscricao: mockReconciliarInscricao },
}));

import { notificarGabaritosDisponiveis } from '../cron/notificar-gabaritos.cron';

const buildEnvio = (horaTermino: string) => ({
  id: `envio-${horaTermino}`,
  nota: 8,
  pesoTotal: 10,
  realizadoEm: new Date('2026-08-26T20:20:00.000Z'),
  inscricaoId: `inscricao-${horaTermino}`,
  CursosTurmasInscricoes: { alunoId: `aluno-${horaTermino}` },
  CursosTurmasProvas: {
    id: `avaliacao-${horaTermino}`,
    cursoId: 'curso-1',
    turmaId: 'turma-1',
    titulo: 'Avaliação objetiva',
    tipo: 'ATIVIDADE',
    dataFim: new Date('2026-08-26T00:00:00.000Z'),
    horaTermino,
  },
});

describe('notificarGabaritosDisponiveis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotasCreateMany.mockResolvedValue({ count: 1 });
    mockCriarNotificacao.mockResolvedValue({ id: 'notificacao-1' });
    mockReconciliarInscricao.mockResolvedValue(undefined);
  });

  it('consolida a nota e notifica somente o aluno que enviou após a liberação', async () => {
    mockEnviosFindMany.mockResolvedValue([buildEnvio('17:30'), buildEnvio('18:00')]);

    const resultado = await notificarGabaritosDisponiveis(new Date('2026-08-26T20:31:00.000Z'));

    expect(mockNotasCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          inscricaoId: 'inscricao-17:30',
          provaId: 'avaliacao-17:30',
          nota: 8,
        }),
      ],
      skipDuplicates: true,
    });
    expect(mockCriarNotificacao).toHaveBeenCalledTimes(1);
    expect(mockCriarNotificacao).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'aluno-17:30',
        eventoId: 'gabarito-envio-17:30',
        linkAcao: '/dashboard/cursos/alunos/cursos/curso-1/turma-1/avaliacao-17:30',
      }),
    );
    expect(mockReconciliarInscricao).toHaveBeenCalledWith('inscricao-17:30');
    expect(resultado).toEqual({ enviosAnalisados: 2, notificadas: 1 });
  });

  it('não publica nota nem notificação antes do horário', async () => {
    mockEnviosFindMany.mockResolvedValue([buildEnvio('17:30')]);

    const resultado = await notificarGabaritosDisponiveis(new Date('2026-08-26T20:30:59.999Z'));

    expect(mockNotasCreateMany).not.toHaveBeenCalled();
    expect(mockCriarNotificacao).not.toHaveBeenCalled();
    expect(resultado).toEqual({ enviosAnalisados: 1, notificadas: 0 });
  });
});
