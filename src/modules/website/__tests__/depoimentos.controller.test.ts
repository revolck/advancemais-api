jest.mock('@/modules/website/services/depoimentos.service', () => ({
  depoimentosService: {
    list: jest.fn(),
  },
}));

import type { Request, Response } from 'express';
import { WebsiteStatus } from '@prisma/client';

import { DepoimentosController } from '../controllers/depoimentos.controller';
import { depoimentosService } from '@/modules/website/services/depoimentos.service';

const makeResponse = () =>
  ({
    set: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  }) as unknown as Response;

describe('DepoimentosController.list', () => {
  it('retorna o texto do depoimento no campo publico depoimento', async () => {
    const criadoEm = new Date('2024-01-01T12:00:00.000Z');
    const atualizadoEm = new Date('2024-01-02T12:00:00.000Z');
    const ordemCriadoEm = new Date('2024-01-03T12:00:00.000Z');

    (depoimentosService.list as jest.Mock).mockResolvedValue([
      {
        id: 'ordem-uuid',
        ordem: 1,
        status: WebsiteStatus.PUBLICADO,
        criadoEm: ordemCriadoEm,
        WebsiteDepoimento: {
          id: 'depoimento-uuid',
          depoimento: 'Otimo servico',
          nome: 'Fulano',
          cargo: 'Gerente',
          fotoUrl: 'https://cdn.example.com/foto.jpg',
          criadoEm,
          atualizadoEm,
        },
      },
    ]);

    const req = {
      query: { status: 'PUBLICADO' },
      headers: {},
    } as unknown as Request;
    const res = makeResponse();

    await DepoimentosController.list(req, res);

    expect(depoimentosService.list).toHaveBeenCalledWith(WebsiteStatus.PUBLICADO);
    expect(res.json).toHaveBeenCalledWith([
      {
        id: 'ordem-uuid',
        depoimentoId: 'depoimento-uuid',
        depoimento: 'Otimo servico',
        nome: 'Fulano',
        cargo: 'Gerente',
        fotoUrl: 'https://cdn.example.com/foto.jpg',
        status: WebsiteStatus.PUBLICADO,
        ordem: 1,
        criadoEm,
        atualizadoEm,
        ordemCriadoEm,
      },
    ]);
  });
});
