import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { prisma } from '@/config/prisma';
import { runtimeConfigService } from '../runtime-config.service';

describe('RuntimeConfigService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    runtimeConfigService.invalidate();
    process.env.CONFIG_ENCRYPTION_KEY = '';
    process.env.MP_ACCESS_TOKEN = 'APP_USR_ENV_TOKEN';
  });

  it('faz fallback para env quando há segredo em DB e a chave de criptografia está ausente', async () => {
    jest.spyOn(prisma.sistemaConfiguracoes, 'findMany').mockResolvedValue([
      {
        categoria: 'mercadopago',
        chave: 'mp_access_token',
        tipo: 'string',
        valor: null,
        valorCriptografado: 'v1:aaaa:bbbb:cccc',
        valorHash: 'sha256:test',
        ehSecreto: true,
        atualizadoEm: new Date(),
      },
    ] as never);

    const value = await runtimeConfigService.getString('mercadopago', 'mp_access_token');

    expect(value).toBe('APP_USR_ENV_TOKEN');
  });
});
