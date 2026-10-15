jest.mock('@/config/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    cursosTurmas: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    cursosTurmasAulas: { count: jest.fn() },
    cursosTurmasProvas: { count: jest.fn() },
    usuarios: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));
jest.mock('@/modules/cursos/aulas/services/notificacoes-helper.service', () => ({
  notificacoesHelper: { notificarAlunosDaTurma: jest.fn(), notificarUsuarios: jest.fn() },
}));

import { CursoStatus } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { processTurmasStatusWatcherTick } from '../cron/turmas-status-watcher';
import { turmasService } from '../services/turmas.service';
import {
  decidirRecompra,
  transicaoAutomaticaPermitida,
  turmaAceitaNovasInscricoes,
} from '../utils/turma-inscricao';

const db = prisma as any;
const agora = new Date('2026-10-15T12:00:00.000Z');
const turma = (overrides: Record<string, unknown>) => ({
  id: 't1',
  nome: 'Turma legado - 17/10/2026 a 27/03/2027',
  status: CursoStatus.EM_ANDAMENTO,
  dataInscricaoInicio: new Date('2026-05-21T00:00:00Z'),
  dataInscricaoFim: new Date('2026-10-17T12:00:00Z'),
  dataInicio: new Date('2026-10-17T12:00:00Z'),
  dataFim: new Date('2027-03-27T12:00:00Z'),
  Cursos: { id: 'c1', nome: 'Curso' },
  ...overrides,
});

describe('regras de inscrição por status da turma', () => {
  it('turma concluída ou cancelada não recebe inscrição', () => {
    expect(turmaAceitaNovasInscricoes(CursoStatus.CONCLUIDO)).toBe(false);
    expect(turmaAceitaNovasInscricoes(CursoStatus.CANCELADO)).toBe(false);
    expect(turmaAceitaNovasInscricoes(CursoStatus.INSCRICOES_ABERTAS)).toBe(true);
  });

  it('depois de começar, a turma só anda para concluída', () => {
    expect(transicaoAutomaticaPermitida(CursoStatus.EM_ANDAMENTO, CursoStatus.CONCLUIDO)).toBe(
      true,
    );
    expect(
      transicaoAutomaticaPermitida(CursoStatus.EM_ANDAMENTO, CursoStatus.INSCRICOES_ABERTAS),
    ).toBe(false);
    // antes de começar, reprogramar inscrições continua possível
    expect(
      transicaoAutomaticaPermitida(
        CursoStatus.INSCRICOES_ENCERRADAS,
        CursoStatus.INSCRICOES_ABERTAS,
      ),
    ).toBe(true);
  });

  it('nova compra não sobrescreve inscrição concluída, reprovada, trancada ou com histórico', () => {
    expect(decidirRecompra('CONCLUIDO', true)).toMatchObject({
      permitir: false,
      code: 'INSCRICAO_JA_CONCLUIDA',
    });
    expect(decidirRecompra('REPROVADO', false)).toMatchObject({
      permitir: false,
      code: 'INSCRICAO_ENCERRADA',
    });
    expect(decidirRecompra('TRANCADO', false)).toMatchObject({ permitir: false });
    expect(decidirRecompra('CANCELADO', true)).toMatchObject({
      permitir: false,
      code: 'INSCRICAO_ENCERRADA',
    });
    expect(decidirRecompra('INSCRITO', false)).toMatchObject({ code: 'INSCRICAO_DUPLICADA_TURMA' });
    // pagamento cancelado (sem histórico): pode comprar de novo
    expect(decidirRecompra('CANCELADO', false)).toEqual({ permitir: true });
  });
});

describe('rotina de status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.cursosTurmasAulas.count.mockResolvedValue(0);
    db.cursosTurmasProvas.count.mockResolvedValue(0);
    db.cursosTurmas.updateMany.mockResolvedValue({ count: 1 });
  });

  it('turma em andamento com inscrição "aberta" pelas datas não reabre e não vira rascunho', async () => {
    db.cursosTurmas.findMany.mockResolvedValue([turma({})]);
    const r = await processTurmasStatusWatcherTick(agora);
    expect(r.totalUpdated).toBe(0);
    expect(db.cursosTurmas.update).not.toHaveBeenCalled();
    expect(db.cursosTurmas.updateMany).not.toHaveBeenCalled();
  });

  it('no dia do início (sem aulas, já em andamento) não manda "turma reprogramada"', async () => {
    db.cursosTurmas.findMany.mockResolvedValue([turma({})]);
    await processTurmasStatusWatcherTick(new Date('2026-10-17T13:00:00Z'));
    expect(db.cursosTurmas.update).not.toHaveBeenCalled();
  });

  it('na data de fim vira concluída', async () => {
    db.cursosTurmas.findMany.mockResolvedValue([turma({})]);
    await processTurmasStatusWatcherTick(new Date('2027-03-28T12:00:00Z'));
    expect(db.cursosTurmas.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: CursoStatus.CONCLUIDO }) }),
    );
  });
});

describe('inscrição pelo painel', () => {
  it('turma concluída recusa até admin', async () => {
    const tx = {
      cursosTurmas: {
        findFirst: jest.fn().mockResolvedValue({
          id: 't1',
          status: CursoStatus.CONCLUIDO,
          vagasDisponiveis: 10,
          vagasTotais: 10,
          vagasIlimitadas: true,
          dataInscricaoFim: null,
          dataInicio: null,
          dataFim: null,
        }),
      },
    };
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    await expect(
      turmasService.enroll('c1', 't1', 'a1', { id: 'admin', role: 'ADMIN' as any }),
    ).rejects.toMatchObject({ code: 'TURMA_ENCERRADA' });
  });
});
