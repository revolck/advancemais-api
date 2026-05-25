import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { candidatoLogsService } from '@/modules/candidatos/logs/service';
import { curriculosService } from '../services';

const usuarioId = '11111111-1111-1111-1111-111111111111';

describe('curriculosService - curriculo principal', () => {
  let tx: {
    usuariosCurriculos: {
      updateMany: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.restoreAllMocks();

    tx = {
      usuariosCurriculos: {
        updateMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    jest
      .spyOn(prisma as any, '$transaction')
      .mockImplementation(async (callback: any) => callback(tx));
    jest.spyOn(candidatoLogsService, 'create').mockResolvedValue({ id: 'log-1' } as any);
  });

  it.each([undefined, false])(
    'define o primeiro curriculo como principal mesmo quando principal e %s',
    async (principal) => {
      jest.spyOn(prisma.usuariosCurriculos, 'count').mockResolvedValue(0);
      tx.usuariosCurriculos.create.mockResolvedValue({
        id: 'curriculo-1',
        principal: true,
      });

      const result = await curriculosService.create(usuarioId, Roles.ALUNO_CANDIDATO, {
        titulo: 'Primeiro curriculo',
        ...(principal === undefined ? {} : { principal }),
      });

      expect(tx.usuariosCurriculos.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuarioId,
          principal: true,
        }),
      });
      expect(result).toMatchObject({ principal: true });
    },
  );

  it('substitui o principal anterior quando um novo curriculo e marcado como principal', async () => {
    jest.spyOn(prisma.usuariosCurriculos, 'count').mockResolvedValue(1);
    tx.usuariosCurriculos.create.mockResolvedValue({
      id: 'curriculo-2',
      principal: true,
    });

    await curriculosService.create(usuarioId, Roles.ALUNO_CANDIDATO, {
      titulo: 'Novo principal',
      principal: true,
    });

    expect(tx.usuariosCurriculos.updateMany).toHaveBeenCalledWith({
      where: { usuarioId, principal: true },
      data: { principal: false },
    });
    expect(tx.usuariosCurriculos.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ principal: true }),
    });
  });

  it('nao permite remover a marcacao do unico curriculo principal', async () => {
    jest.spyOn(prisma.usuariosCurriculos, 'findFirst').mockResolvedValue({
      id: 'curriculo-1',
      principal: true,
    } as any);
    tx.usuariosCurriculos.count.mockResolvedValue(0);

    await expect(
      curriculosService.update(usuarioId, 'curriculo-1', { principal: false }),
    ).rejects.toMatchObject({
      code: 'CURRICULO_PRINCIPAL_REQUIRED',
    });

    expect(tx.usuariosCurriculos.update).not.toHaveBeenCalled();
  });
});
