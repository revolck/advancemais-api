import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { CursosCheckoutController } from '../controllers/cursos-checkout.controller';
import { cursosCheckoutService } from '../services/cursos-checkout.service';

jest.mock('../services/cursos-checkout.service', () => ({
  cursosCheckoutService: {
    startCheckout: jest.fn(),
  },
}));

describe('CursosCheckoutController.checkout', () => {
  const mockedService = cursosCheckoutService as jest.Mocked<typeof cursosCheckoutService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sanitiza erro técnico P2002 em resposta amigável', async () => {
    const req = {
      body: {
        cursoId: '2e035bc5-f6b8-4f2a-84e3-009b9db34780',
        turmaId: 'fb488ecc-4f31-481e-97f1-b859e831ee4b',
        pagamento: 'pix',
        aceitouTermos: true,
        payer: {
          identification: {
            type: 'CPF',
            number: '529.982.247-25',
          },
        },
      },
      user: { id: '29d07257-d0ca-4b54-814e-5019c9cd2bcb' },
    } as any;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`turmaId`,`alunoId`)',
      {
        code: 'P2002',
        clientVersion: '6.19.0',
      },
    );

    mockedService.startCheckout.mockRejectedValue(p2002);

    await CursosCheckoutController.checkout(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'INSCRICAO_DUPLICADA_TURMA',
      message: 'Você já possui inscrição ativa nesta turma.',
      details: undefined,
    });
  });
});
