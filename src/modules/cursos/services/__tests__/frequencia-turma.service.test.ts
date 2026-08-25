const mockAulasFindMany = jest.fn();
const mockProvasFindMany = jest.fn();
const mockProgressoCount = jest.fn();
const mockFrequenciaFindMany = jest.fn();
const mockEnviosCount = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    cursosTurmasAulas: { findMany: mockAulasFindMany },
    cursosTurmasProvas: { findMany: mockProvasFindMany },
    cursosAulasProgresso: { count: mockProgressoCount },
    cursosFrequenciaAlunos: { findMany: mockFrequenciaFindMany },
    cursosTurmasProvasEnvios: { count: mockEnviosCount },
  },
}));

import { frequenciaTurmaService } from '../frequencia-turma.service';

const AGORA = new Date('2026-08-23T12:00:00.000Z');
const PASSADO = new Date('2026-08-01T00:00:00.000Z');
const FUTURO = new Date('2026-12-01T00:00:00.000Z');

describe('frequenciaTurmaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calcularCheckpoint', () => {
    it.each([
      [0, 10, 0],
      [1, 10, 0],
      [2, 10, 20],
      [4, 10, 40],
      [5, 10, 40],
      [6, 10, 60],
      [8, 10, 80],
      [10, 10, 100],
      [0, 0, 0],
    ])('itensOcorridos=%i, total=%i -> checkpoint=%i', (itensOcorridos, total, esperado) => {
      expect(frequenciaTurmaService.calcularCheckpoint(itensOcorridos, total)).toBe(esperado);
    });
  });

  describe('contarItensDaTurma', () => {
    it('conta itens ocorridos (data já passada) separado do total', async () => {
      mockAulasFindMany.mockResolvedValue([
        { id: 'aula-1', modalidade: 'ONLINE', dataInicio: PASSADO, dataFim: PASSADO },
        { id: 'aula-2', modalidade: 'ONLINE', dataInicio: FUTURO, dataFim: FUTURO },
      ]);
      mockProvasFindMany.mockResolvedValue([
        { id: 'prova-1', dataInicio: PASSADO, dataFim: PASSADO },
      ]);

      const resultado = await frequenciaTurmaService.contarItensDaTurma('turma-1', AGORA);

      expect(resultado.total).toBe(3);
      expect(resultado.itensOcorridos).toBe(2); // aula-1 + prova-1
      expect(resultado.provaIds).toEqual(['prova-1']);
    });

    it('usa dataInicio quando dataFim é nulo', async () => {
      mockAulasFindMany.mockResolvedValue([
        { id: 'aula-1', modalidade: 'ONLINE', dataInicio: PASSADO, dataFim: null },
      ]);
      mockProvasFindMany.mockResolvedValue([]);

      const resultado = await frequenciaTurmaService.contarItensDaTurma('turma-1', AGORA);

      expect(resultado.itensOcorridos).toBe(1);
    });
  });

  describe('calcularFrequenciaAluno', () => {
    it('retorna 0 quando total é 0', async () => {
      const resultado = await frequenciaTurmaService.calcularFrequenciaAluno({
        turmaId: 'turma-1',
        inscricaoId: 'insc-1',
        total: 0,
        aulas: [],
        provaIds: [],
      });
      expect(resultado).toBe(0);
    });

    it('soma aulas online concluídas + presenças distintas + envios de prova', async () => {
      mockProgressoCount.mockResolvedValue(2); // 2 aulas online concluídas
      mockFrequenciaFindMany.mockResolvedValue([{ aulaId: 'aula-live-1' }]); // 1 presença distinta
      mockEnviosCount.mockResolvedValue(1); // 1 envio de prova

      const resultado = await frequenciaTurmaService.calcularFrequenciaAluno({
        turmaId: 'turma-1',
        inscricaoId: 'insc-1',
        total: 10, // 2 + 1 + 1 = 4 de 10 = 40%
        aulas: [
          { id: 'aula-on-1', modalidade: 'ONLINE', dataInicio: null, dataFim: null },
          { id: 'aula-on-2', modalidade: 'ONLINE', dataInicio: null, dataFim: null },
          { id: 'aula-live-1', modalidade: 'LIVE', dataInicio: null, dataFim: null },
        ],
        provaIds: ['prova-1'],
      });

      expect(resultado).toBe(40);
      expect(mockProgressoCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ aulaId: { in: ['aula-on-1', 'aula-on-2'] } }),
        }),
      );
      expect(mockFrequenciaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ aulaId: { in: ['aula-live-1'] } }),
          distinct: ['aulaId'],
        }),
      );
    });

    it('não ultrapassa 100%', async () => {
      mockProgressoCount.mockResolvedValue(10);
      mockFrequenciaFindMany.mockResolvedValue([]);
      mockEnviosCount.mockResolvedValue(5);

      const resultado = await frequenciaTurmaService.calcularFrequenciaAluno({
        turmaId: 'turma-1',
        inscricaoId: 'insc-1',
        total: 5,
        aulas: [{ id: 'aula-on-1', modalidade: 'ONLINE', dataInicio: null, dataFim: null }],
        provaIds: ['prova-1'],
      });

      expect(resultado).toBe(100);
    });
  });
});
