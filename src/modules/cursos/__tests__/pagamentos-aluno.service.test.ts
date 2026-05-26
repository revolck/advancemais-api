import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CursosAulaStatus, StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';
import { avaliacaoService } from '../services/avaliacao.service';
import { pagamentosAlunoService } from '../services/pagamentos-aluno.service';

const alunoId = '11111111-1111-1111-1111-111111111111';

const curso = { id: 'curso-1', nome: 'Curso Real' };
const turma = {
  id: 'turma-1',
  nome: 'Turma Real',
  Cursos: curso,
};

describe('pagamentosAlunoService.list', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(pagamentosAlunoService, 'reconciliarRecuperacoes').mockResolvedValue(undefined);
  });

  it('une matricula e recuperacao do aluno, exclui gratuito e calcula resumo real', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([
      {
        id: 'inscricao-1',
        statusPagamento: 'APROVADO',
        valorPago: 100,
        valorFinal: 100,
        metodoPagamento: 'PIX',
        mpPaymentId: 'mp-matricula',
        pixQrCode: null,
        pixQrCodeBase64: null,
        boletoCodigo: null,
        boletoUrl: null,
        pagamentoExpiraEm: null,
        criadoEm: new Date('2026-05-20T12:00:00.000Z'),
        CursosTurmas: turma,
      },
    ] as any);
    jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'findMany').mockResolvedValue([
      {
        id: 'recuperacao-1',
        statusPagamento: 'PENDENTE',
        valor: 50,
        metodoPagamento: null,
        mpPaymentId: null,
        pixQrCode: null,
        boletoUrl: null,
        boletoCodigo: null,
        expiraEm: null,
        criadoEm: new Date('2026-05-21T12:00:00.000Z'),
        CursosTurmas: turma,
        CursosTurmasProvas: { id: 'prova-1', titulo: 'Recuperacao Final' },
      },
    ] as any);

    const data = await pagamentosAlunoService.list(alunoId, {
      tab: 'historico',
      page: 1,
      pageSize: 10,
    });

    const enrollmentWhere = (prisma.cursosTurmasInscricoes.findMany as jest.Mock).mock
      .calls[0][0] as any;
    expect(enrollmentWhere.where).toEqual({ alunoId, valorFinal: { gt: 0 } });
    expect(data.items).toHaveLength(2);
    expect(data.items.map((item) => item.origem)).toEqual(['RECUPERACAO_FINAL', 'MATRICULA']);
    expect(data.pendingCount).toBe(1);
    expect(data.summary).toMatchObject({
      totalPago: 100,
      totalPendente: 50,
      totalTransacoes: 2,
    });
    expect(data.filters.cursos).toEqual([curso]);
  });

  it('aplica aba pendente e paginacao somente depois da uniao', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([] as any);
    jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'findMany').mockResolvedValue(
      ['a', 'b'].map((id, index) => ({
        id,
        statusPagamento: 'PENDENTE',
        valor: 50,
        metodoPagamento: null,
        mpPaymentId: null,
        pixQrCode: null,
        boletoUrl: null,
        boletoCodigo: null,
        expiraEm: null,
        criadoEm: new Date(`2026-05-${22 - index}T12:00:00.000Z`),
        CursosTurmas: turma,
        CursosTurmasProvas: { id: `prova-${id}`, titulo: 'Recuperacao Final' },
      })) as any,
    );

    const data = await pagamentosAlunoService.list(alunoId, {
      tab: 'pendentes',
      page: 2,
      pageSize: 1,
    });

    expect(data.pagination).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(data.items).toHaveLength(1);
  });
});

describe('pagamentosAlunoService.reconciliarRecuperacoes', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('cria uma cobranca de R$ 50 para nota abaixo de sete em prova publicada', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([
      {
        id: 'inscricao-1',
        turmaId: turma.id,
        CursosTurmas: {
          ...turma,
          CursosTurmasProvas: [{ id: 'prova-1' }],
        },
      },
    ] as any);
    jest.spyOn(avaliacaoService, 'calcularNotasInscricao').mockResolvedValue({
      resultadoFinal: { media: 6.9 },
    } as any);
    jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'findUnique').mockResolvedValue(null);
    const create = jest
      .spyOn(prisma.cursosRecuperacaoPagamentos, 'create')
      .mockResolvedValue({ id: 'pagamento-1' } as any);
    jest
      .spyOn(notificacoesService, 'notificarRecuperacaoFinalPendente')
      .mockResolvedValue({} as any);

    await pagamentosAlunoService.reconciliarRecuperacoes(alunoId);

    const enrollmentWhere = (prisma.cursosTurmasInscricoes.findMany as jest.Mock).mock
      .calls[0][0] as any;
    expect(enrollmentWhere.where).toMatchObject({
      alunoId,
      statusPagamento: 'APROVADO',
      status: {
        in: [
          StatusInscricao.INSCRITO,
          StatusInscricao.EM_ANDAMENTO,
          StatusInscricao.EM_ESTAGIO,
          StatusInscricao.CONCLUIDO,
          StatusInscricao.REPROVADO,
        ],
      },
    });
    expect(enrollmentWhere.include.CursosTurmas.include.CursosTurmasProvas.where).toMatchObject({
      recuperacaoFinal: true,
      ativo: true,
      status: CursosAulaStatus.PUBLICADA,
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alunoId,
        inscricaoId: 'inscricao-1',
        provaId: 'prova-1',
        valor: expect.anything(),
      }),
    });
    expect(Number((create.mock.calls[0][0] as any).data.valor)).toBe(50);
  });

  it('nao cria cobranca quando nao existe nota final consolidada', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findMany').mockResolvedValue([
      {
        id: 'inscricao-1',
        turmaId: turma.id,
        CursosTurmas: { ...turma, CursosTurmasProvas: [{ id: 'prova-1' }] },
      },
    ] as any);
    jest.spyOn(avaliacaoService, 'calcularNotasInscricao').mockResolvedValue({
      resultadoFinal: { media: null },
    } as any);
    const create = jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'create');

    await pagamentosAlunoService.reconciliarRecuperacoes(alunoId);

    expect(create).not.toHaveBeenCalled();
  });
});

describe('pagamentosAlunoService.reconciliarRecuperacaoInscricao', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('reconcilia a cobranca a partir da inscricao que recebeu nota', async () => {
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findUnique').mockResolvedValue({
      alunoId,
    } as any);
    const reconciliar = jest
      .spyOn(pagamentosAlunoService, 'reconciliarRecuperacoes')
      .mockResolvedValue(undefined);

    await pagamentosAlunoService.reconciliarRecuperacaoInscricao('inscricao-1');

    expect(reconciliar).toHaveBeenCalledWith(alunoId);
  });
});

describe('pagamentosAlunoService.checkoutRecuperacao', () => {
  it('bloqueia pagamento que nao pertence ao aluno antes de chamar o gateway', async () => {
    jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'findFirst').mockResolvedValue(null);

    await expect(
      pagamentosAlunoService.checkoutRecuperacao(alunoId, 'pagamento-alheio', {
        pagamento: 'pix',
        payer: {
          email: 'aluno@example.com',
          identification: { type: 'CPF', number: '12345678901' },
        },
      }),
    ).rejects.toMatchObject({ code: 'PAGAMENTO_NOT_FOUND' });

    expect(prisma.cursosRecuperacaoPagamentos.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pagamento-alheio', alunoId } }),
    );
  });
});

describe('pagamentosAlunoService.getAcessoRecuperacao', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.cursosTurmasInscricoes, 'findFirst').mockResolvedValue({
      id: 'inscricao-1',
      turmaId: turma.id,
    } as any);
  });

  it('nao exige pagamento para prova que nao seja recuperacao final', async () => {
    jest.spyOn(prisma.cursosTurmasProvas, 'findFirst').mockResolvedValue(null);

    const acesso = await pagamentosAlunoService.getAcessoRecuperacao(
      alunoId,
      'inscricao-1',
      'prova-regular',
    );

    expect(acesso).toEqual({ requiresPayment: false, liberado: true, pagamento: null });
  });

  it('bloqueia recuperacao final sem cobranca aprovada', async () => {
    jest.spyOn(prisma.cursosTurmasProvas, 'findFirst').mockResolvedValue({
      id: 'prova-recuperacao',
    } as any);
    jest.spyOn(pagamentosAlunoService, 'reconciliarRecuperacoes').mockResolvedValue(undefined);
    jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'findUnique').mockResolvedValue(null);

    const acesso = await pagamentosAlunoService.getAcessoRecuperacao(
      alunoId,
      'inscricao-1',
      'prova-recuperacao',
    );

    expect(acesso).toEqual({ requiresPayment: true, liberado: false, pagamento: null });
  });

  it('libera recuperacao final somente com pagamento aprovado', async () => {
    jest.spyOn(prisma.cursosTurmasProvas, 'findFirst').mockResolvedValue({
      id: 'prova-recuperacao',
    } as any);
    jest.spyOn(pagamentosAlunoService, 'reconciliarRecuperacoes').mockResolvedValue(undefined);
    jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'findUnique').mockResolvedValue({
      id: 'pagamento-1',
      statusPagamento: 'APROVADO',
      valor: 50,
    } as any);

    const acesso = await pagamentosAlunoService.getAcessoRecuperacao(
      alunoId,
      'inscricao-1',
      'prova-recuperacao',
    );

    expect(acesso).toEqual({
      requiresPayment: true,
      liberado: true,
      pagamento: { id: 'pagamento-1', status: 'APROVADO', valor: 50 },
    });
  });
});

describe('pagamentosAlunoService.aprovarRecuperacao', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('libera a prova somente quando o pagamento de recuperacao e aprovado', async () => {
    jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'findUnique').mockResolvedValue({
      id: 'pagamento-1',
      alunoId,
      inscricaoId: 'inscricao-1',
      provaId: 'prova-recuperacao',
      turmaId: turma.id,
      CursosTurmas: turma,
    } as any);
    jest.spyOn(prisma.cursosRecuperacaoPagamentos, 'update').mockResolvedValue({} as any);
    const upsert = jest
      .spyOn(prisma.cursosTurmasInscricoesProvasAcesso, 'upsert')
      .mockResolvedValue({} as any);
    jest.spyOn(prisma, '$transaction').mockResolvedValue([] as any);
    jest
      .spyOn(notificacoesService, 'notificarRecuperacaoFinalAprovada')
      .mockResolvedValue({} as any);

    await pagamentosAlunoService.aprovarRecuperacao('pagamento-1');

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inscricaoId_provaId: {
            inscricaoId: 'inscricao-1',
            provaId: 'prova-recuperacao',
          },
        },
        create: expect.objectContaining({ origem: 'PAGAMENTO_RECUPERACAO' }),
        update: expect.objectContaining({ origem: 'PAGAMENTO_RECUPERACAO' }),
      }),
    );
  });
});
