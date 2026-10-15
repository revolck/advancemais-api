jest.mock('@/config/prisma', () => ({
  prisma: { cursosTurmasInscricoes: { findMany: jest.fn(), updateMany: jest.fn() } },
}));
jest.mock('@/config/mercadopago', () => ({ getRuntimeMercadoPagoConfig: jest.fn() }));
jest.mock('@/modules/cursos/checkout/services/mercadopago-orders.client', () => ({
  cancelMercadoPagoOrder: jest.fn(),
}));
jest.mock('@/modules/cursos/checkout/services/curso-pagamento-notificacoes.service', () => ({
  cursoPagamentoNotificacoesService: {},
}));

import { prisma } from '@/config/prisma';
import {
  buildInscricaoOcupaVagaWhere,
  inscricaoOcupaVaga,
  limparReservasExpiradasDaTurma,
} from '../services/inscricoes-vagas.service';

const agora = new Date('2026-10-15T12:00:00Z');

describe('vaga reservada por cobrança da equipe', () => {
  it('cobrança pendente da equipe ocupa vaga mesmo sem prazo de expiração', () => {
    expect(
      inscricaoOcupaVaga(
        {
          status: 'AGUARDANDO_PAGAMENTO',
          statusPagamento: 'PENDENTE',
          origem: 'EQUIPE',
          pagamentoExpiraEm: null,
        },
        agora,
      ),
    ).toBe(true);
    expect(buildInscricaoOcupaVagaWhere(agora).OR).toContainEqual(
      expect.objectContaining({ origem: 'EQUIPE', removidaEm: null }),
    );
  });

  it('reserva comum sem prazo não ocupa; removido não ocupa', () => {
    expect(
      inscricaoOcupaVaga(
        { status: 'AGUARDANDO_PAGAMENTO', statusPagamento: 'PENDENTE', pagamentoExpiraEm: null },
        agora,
      ),
    ).toBe(false);
    expect(inscricaoOcupaVaga({ status: 'CANCELADO', removidaEm: agora }, agora)).toBe(false);
    expect(inscricaoOcupaVaga({ status: 'INSCRITO' }, agora)).toBe(true);
  });

  it('a limpeza de reservas expiradas nunca cancela a cobrança da equipe', async () => {
    const db = prisma as any;
    db.cursosTurmasInscricoes.findMany.mockResolvedValue([]);
    await limparReservasExpiradasDaTurma('t1', agora).catch(() => undefined);
    const where = db.cursosTurmasInscricoes.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ OR: [{ origem: null }, { origem: { not: 'EQUIPE' } }] });
  });
});
