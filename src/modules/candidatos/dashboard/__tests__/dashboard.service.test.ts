import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { candidatoDashboardService } from '../services';

const usuarioId = 'usuario-dashboard-123';

describe('candidatoDashboardService.getDashboard', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.empresasCandidatos, 'findMany').mockResolvedValue([] as any);
  });

  it('busca métricas e cursos apenas com pagamento aprovado e status liberado', async () => {
    jest
      .spyOn(prisma.cursosTurmasInscricoes, 'findMany')
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);

    await candidatoDashboardService.getDashboard(usuarioId);

    const [metricasArgs, ultimosCursosArgs] = (
      prisma.cursosTurmasInscricoes.findMany as jest.Mock
    ).mock.calls.map((call) => call[0] as any);

    for (const args of [metricasArgs, ultimosCursosArgs]) {
      expect(args.where).toMatchObject({
        alunoId: usuarioId,
        statusPagamento: 'APROVADO',
      });
      expect(args.where.status.in).toEqual([
        StatusInscricao.INSCRITO,
        StatusInscricao.EM_ANDAMENTO,
        StatusInscricao.EM_ESTAGIO,
        StatusInscricao.CONCLUIDO,
      ]);
      expect(args.where.status.in).not.toContain(StatusInscricao.CANCELADO);
      expect(args.where.status.in).not.toContain(StatusInscricao.TRANCADO);
      expect(args.where.status.in).not.toContain(StatusInscricao.AGUARDANDO_PAGAMENTO);
    }
  });

  it('calcula métricas sem inscrições canceladas ou pendentes', async () => {
    jest
      .spyOn(prisma.cursosTurmasInscricoes, 'findMany')
      .mockResolvedValueOnce([
        { id: 'i-1', status: StatusInscricao.INSCRITO, criadoEm: new Date() },
        { id: 'i-2', status: StatusInscricao.EM_ANDAMENTO, criadoEm: new Date() },
        { id: 'i-3', status: StatusInscricao.EM_ESTAGIO, criadoEm: new Date() },
        { id: 'i-4', status: StatusInscricao.CONCLUIDO, criadoEm: new Date() },
      ] as any)
      .mockResolvedValueOnce([] as any);

    const result = await candidatoDashboardService.getDashboard(usuarioId);

    expect(result.metricas).toMatchObject({
      cursosEmProgresso: 3,
      cursosConcluidos: 1,
      totalCursos: 4,
      totalCandidaturas: 0,
    });
    expect(result.cursos).toEqual([]);
  });
});
