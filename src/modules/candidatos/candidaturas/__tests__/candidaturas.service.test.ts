import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { candidatoLogsService } from '@/modules/candidatos/logs/service';
import { candidaturasService } from '../services';

const params = {
  usuarioId: 'aluno-123',
  role: Roles.ALUNO_CANDIDATO,
  vagaId: 'vaga-123',
  curriculoId: 'curriculo-123',
};

describe('candidaturasService.apply', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('cria a candidatura quando o curriculo pertence ao aluno autenticado', async () => {
    jest.spyOn(prisma.usuariosCurriculos, 'findFirst').mockResolvedValue({
      id: params.curriculoId,
    } as any);
    jest.spyOn(prisma.empresasCandidatos, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prisma.statusProcessosCandidatos, 'findFirst').mockResolvedValue({
      id: 'status-123',
      nome: 'Recebida',
    } as any);
    jest.spyOn(prisma.empresasVagas, 'findUnique').mockResolvedValue({
      id: params.vagaId,
      usuarioId: 'empresa-123',
    } as any);
    jest.spyOn(prisma.empresasCandidatos, 'create').mockResolvedValue({
      id: 'candidatura-123',
    } as any);
    jest.spyOn(candidatoLogsService, 'create').mockResolvedValue({ id: 'log-123' } as any);

    await expect(candidaturasService.apply(params)).resolves.toMatchObject({
      id: 'candidatura-123',
    });

    expect(prisma.usuariosCurriculos.findFirst).toHaveBeenCalledWith({
      where: {
        id: params.curriculoId,
        usuarioId: params.usuarioId,
      },
      select: { id: true },
    });
    expect(prisma.empresasCandidatos.create).toHaveBeenCalled();
  });

  it('rejeita curriculo inexistente ou pertencente a outro aluno antes de gravar', async () => {
    jest.spyOn(prisma.usuariosCurriculos, 'findFirst').mockResolvedValue(null);
    const createSpy = jest.spyOn(prisma.empresasCandidatos, 'create');

    await expect(candidaturasService.apply(params)).rejects.toMatchObject({
      code: 'CURRICULO_INVALIDO',
    });

    expect(createSpy).not.toHaveBeenCalled();
  });
});
