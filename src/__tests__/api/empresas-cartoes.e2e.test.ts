import express from 'express';
import request from 'supertest';
import { Customer, CustomerCard, Payment, PaymentRefund } from 'mercadopago';

import { prisma } from '@/config/prisma';
import { cartoesRoutes } from '@/modules/empresas/cartoes';

jest.mock('@/modules/usuarios/auth', () => ({
  supabaseAuthMiddleware: jest.fn(() => (req: any, _res: any, next: any): void => {
    req.user = {
      id: 'empresa-1',
      role: 'EMPRESA',
    };
    next();
  }),
}));

jest.mock('@/config/mercadopago', () => {
  const actual = jest.requireActual('@/config/mercadopago');

  return {
    ...actual,
    assertMercadoPagoConfiguredAsync: jest.fn().mockResolvedValue({ accessToken: 'TEST_TOKEN' }),
    getMercadoPagoClient: jest.fn().mockResolvedValue({ accessToken: 'TEST_TOKEN' }),
  };
});

jest.mock('@/config/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

describe('API - Cartões de empresas', () => {
  const app = express();
  const customerCreateSpy = jest.spyOn(Customer.prototype, 'create');
  const customerCardCreateSpy = jest.spyOn(CustomerCard.prototype, 'create');
  const customerCardRemoveSpy = jest.spyOn(CustomerCard.prototype, 'remove');
  const paymentCreateSpy = jest.spyOn(Payment.prototype, 'create');
  const paymentRefundCreateSpy = jest.spyOn(PaymentRefund.prototype, 'create');

  beforeAll(() => {
    app.use(express.json());
    app.use('/api/v1/empresas/cartoes', cartoesRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.$executeRaw as jest.Mock).mockResolvedValue(1);

    customerCreateSpy.mockResolvedValue({
      id: 'cus_test_empresa',
    } as any);

    customerCardCreateSpy.mockResolvedValue({
      id: 'card_test_123',
      last_four_digits: '1234',
      payment_method: {
        id: 'visa',
      },
      cardholder: {
        name: 'EMPRESA TESTE',
      },
      expiration_month: 12,
      expiration_year: 2030,
    } as any);

    customerCardRemoveSpy.mockResolvedValue(undefined as any);

    paymentCreateSpy.mockResolvedValue({
      id: 999,
      status: 'approved',
    } as any);

    paymentRefundCreateSpy.mockResolvedValue({ id: 1000 } as any);
  });

  it('deve cadastrar cartão sem cobrar validação de R$ 1', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([
        {
          id: 'empresa-1',
          nomeCompleto: 'Empresa Cartão Teste',
          email: 'empresa-cartao@test.com',
          cnpj: '11222333000181',
          mpCustomerId: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cartao-1',
          empresaId: 'empresa-1',
          ultimos4Digitos: '1234',
          bandeira: 'Visa',
          nomeNoCartao: 'EMPRESA TESTE',
          mesExpiracao: '12',
          anoExpiracao: '2030',
          isPadrao: true,
          isAtivo: true,
          validadoEm: new Date('2026-08-03T12:00:00.000Z'),
          criadoEm: new Date('2026-08-03T12:00:00.000Z'),
          atualizadoEm: new Date('2026-08-03T12:00:00.000Z'),
          mpCardId: 'card_test_123',
          tipo: 'credito',
          falhasConsecutivas: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cartao-1',
          empresaId: 'empresa-1',
          ultimos4Digitos: '1234',
          bandeira: 'Visa',
          nomeNoCartao: 'EMPRESA TESTE',
          mesExpiracao: '12',
          anoExpiracao: '2030',
          isPadrao: true,
          isAtivo: true,
          validadoEm: new Date('2026-08-03T12:00:00.000Z'),
          criadoEm: new Date('2026-08-03T12:00:00.000Z'),
          atualizadoEm: new Date('2026-08-03T12:00:00.000Z'),
          mpCardId: 'card_test_123',
          tipo: 'credito',
          falhasConsecutivas: 0,
        },
      ]);

    const addResponse = await request(app)
      .post('/api/v1/empresas/cartoes')
      .send({
        token: 'card_token_test',
        tipo: 'credito',
        isPadrao: true,
      })
      .expect(201);

    expect(addResponse.body).toMatchObject({
      success: true,
      message: 'Cartão adicionado com sucesso',
      data: {
        validacao: {
          sucesso: true,
          mensagem: 'Cartão cadastrado com sucesso.',
        },
        cartao: {
          id: 'cartao-1',
          empresaId: 'empresa-1',
          ultimos4Digitos: '1234',
          bandeira: 'Visa',
          nomeNoCartao: 'EMPRESA TESTE',
          mesExpiracao: '12',
          anoExpiracao: '2030',
          isPadrao: true,
          isAtivo: true,
          mpCardId: 'card_test_123',
          tipo: 'credito',
          falhasConsecutivas: 0,
        },
      },
    });

    expect(customerCreateSpy).toHaveBeenCalledTimes(1);
    expect(customerCardCreateSpy).toHaveBeenCalledWith({
      customerId: 'cus_test_empresa',
      body: { token: 'card_token_test' },
    });
    expect(paymentCreateSpy).not.toHaveBeenCalled();
    expect(paymentRefundCreateSpy).not.toHaveBeenCalled();

    const listResponse = await request(app).get('/api/v1/empresas/cartoes').expect(200);

    expect(listResponse.body).toMatchObject({
      success: true,
      data: [
        {
          id: 'cartao-1',
          empresaId: 'empresa-1',
          ultimos4Digitos: '1234',
          bandeira: 'Visa',
          nomeNoCartao: 'EMPRESA TESTE',
          mesExpiracao: '12',
          anoExpiracao: '2030',
          isPadrao: true,
          isAtivo: true,
          mpCardId: 'card_test_123',
          tipo: 'credito',
          falhasConsecutivas: 0,
        },
      ],
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('deve retornar INVALID_CARD_TOKEN quando Mercado Pago rejeita token do cartão', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ count: 0n }]).mockResolvedValueOnce([
      {
        id: 'empresa-1',
        nomeCompleto: 'Empresa Token Inválido Teste',
        email: 'empresa-cartao-token-invalido@test.com',
        cnpj: '33444555000166',
        mpCustomerId: null,
      },
    ]);
    customerCardCreateSpy.mockRejectedValueOnce(new Error('invalid card token'));

    await request(app)
      .post('/api/v1/empresas/cartoes')
      .send({
        token: 'invalid_card_token',
        tipo: 'credito',
      })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({
          success: false,
          code: 'INVALID_CARD_TOKEN',
          message: 'Token de cartão inválido ou expirado',
        });
      });

    expect(paymentCreateSpy).not.toHaveBeenCalled();
    expect(paymentRefundCreateSpy).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('deve remover o único cartão da empresa', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'cartao-1',
          isPadrao: true,
          mpCustomerId: 'cus_test_empresa',
          mpCardId: 'card_test_123',
        },
      ])
      .mockResolvedValueOnce([{ count: 1n }]);

    const response = await request(app).delete('/api/v1/empresas/cartoes/cartao-1').expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'Cartão removido com sucesso',
    });
    expect(customerCardRemoveSpy).toHaveBeenCalledWith({
      customerId: 'cus_test_empresa',
      cardId: 'card_test_123',
    });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
