import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { prisma } from '@/config/prisma';
import { AuditoriaService } from '@/modules/auditoria/services/auditoria.service';
import { configuracoesGeraisService } from '../configuracoes-gerais.service';
import { runtimeConfigService } from '../runtime-config.service';

const req = {
  user: {
    id: 'user-1',
    role: 'ADMIN',
  },
  ip: '127.0.0.1',
  get: jest.fn().mockReturnValue('jest'),
} as any;

function categorySnapshot(
  category: 'mercadopago' | 'uploads',
  items: Record<string, any>[],
) {
  return {
    category,
    label: category === 'mercadopago' ? 'Mercado Pago' : 'Uploads',
    description: '',
    items: items.map((item) => ({
      description: null,
      envKeys: [],
      envSource: null,
      fingerprint: null,
      maskedPreview: null,
      restartRequired: false,
      required: false,
      updatedAt: null,
      ...item,
    })),
  };
}

describe('ConfiguracoesGeraisService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.CONFIG_ENCRYPTION_KEY = '';

    jest.spyOn(prisma.sistemaConfiguracoes, 'upsert').mockResolvedValue({} as never);
    jest.spyOn(prisma.sistemaConfiguracoes, 'deleteMany').mockResolvedValue({ count: 1 } as never);
    jest.spyOn(runtimeConfigService, 'invalidate').mockImplementation(() => undefined);
    jest.spyOn(AuditoriaService.prototype, 'registrarLog').mockResolvedValue(undefined as never);
  });

  it('permite salvar campos comuns sem CONFIG_ENCRYPTION_KEY', async () => {
    jest
      .spyOn(runtimeConfigService, 'listCategory')
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'assinaturas_grace_days',
            label: 'Dias de tolerância',
            type: 'number',
            secret: false,
            value: 5,
            configured: true,
            source: 'ENV',
          },
        ]) as never,
      )
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'assinaturas_grace_days',
            label: 'Dias de tolerância',
            type: 'number',
            secret: false,
            value: 10,
            configured: true,
            source: 'DB',
          },
        ]) as never,
      );

    const result = await configuracoesGeraisService.updateCategory(
      'mercadopago',
      {
        values: { assinaturas_grace_days: 10 },
      },
      req,
    );

    expect(prisma.sistemaConfiguracoes.upsert).toHaveBeenCalledTimes(1);
    expect(result.items[0]?.value).toBe(10);
  });

  it('bloqueia replace de segredo sem CONFIG_ENCRYPTION_KEY antes de persistir', async () => {
    jest.spyOn(runtimeConfigService, 'listCategory').mockResolvedValue(
      categorySnapshot('mercadopago', [
        {
          key: 'mp_access_token',
          label: 'Access token de produção',
          type: 'string',
          secret: true,
          value: null,
          configured: true,
          source: 'ENV',
          maskedPreview: '********token12',
        },
      ]) as never,
    );

    await expect(
      configuracoesGeraisService.updateCategory(
        'mercadopago',
        {
          secrets: {
            mp_access_token: { action: 'replace', value: 'APP_USR_TOKEN' },
          },
        },
        req,
      ),
    ).rejects.toMatchObject({
      code: 'CONFIG_SECRET_UNAVAILABLE',
      statusCode: 503,
    });

    expect(prisma.sistemaConfiguracoes.upsert).not.toHaveBeenCalled();
    expect(prisma.sistemaConfiguracoes.deleteMany).not.toHaveBeenCalled();
  });

  it('permite limpar segredo sem CONFIG_ENCRYPTION_KEY', async () => {
    jest
      .spyOn(runtimeConfigService, 'listCategory')
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'mp_access_token',
            label: 'Access token de produção',
            type: 'string',
            secret: true,
            value: null,
            configured: true,
            source: 'DB',
            maskedPreview: '********token12',
          },
        ]) as never,
      )
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'mp_access_token',
            label: 'Access token de produção',
            type: 'string',
            secret: true,
            value: null,
            configured: false,
            source: 'EMPTY',
            maskedPreview: null,
          },
        ]) as never,
      );

    await configuracoesGeraisService.updateCategory(
      'mercadopago',
      {
        secrets: {
          mp_access_token: { action: 'clear' },
        },
      },
      req,
    );

    expect(prisma.sistemaConfiguracoes.deleteMany).toHaveBeenCalledTimes(1);
  });
});
