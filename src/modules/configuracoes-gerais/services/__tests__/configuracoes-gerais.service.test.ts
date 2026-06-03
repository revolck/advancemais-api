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
  category: 'mercadopago' | 'uploads' | 'logs' | 'agenda' | 'emails' | 'integracoes',
  items: Record<string, any>[],
) {
  return {
    category,
    label:
      category === 'mercadopago'
        ? 'Mercado Pago'
        : category === 'uploads'
          ? 'Uploads'
          : category === 'logs'
            ? 'Logs'
            : category === 'agenda'
              ? 'Agenda'
              : category === 'emails'
                ? 'E-mails'
                : 'Integrações',
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
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
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
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
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
    expect(result.items.find((item) => item.key === 'assinaturas_grace_days')?.value).toBe(10);
  });

  it('bloqueia replace de segredo sem CONFIG_ENCRYPTION_KEY antes de persistir', async () => {
    jest.spyOn(runtimeConfigService, 'listCategory').mockResolvedValue(
      categorySnapshot('mercadopago', [
        {
          key: 'course_payment_methods',
          label: 'Métodos de pagamento para cursos e turmas',
          type: 'csv',
          secret: false,
          value: 'pix,boleto,card',
          configured: true,
          source: 'ENV',
        },
        {
          key: 'subscription_payment_methods',
          label: 'Métodos de pagamento para assinaturas',
          type: 'csv',
          secret: false,
          value: 'pix,boleto,card',
          configured: true,
          source: 'ENV',
        },
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
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
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

  it('retorna o estado persistido para toggles booleanos após salvar', async () => {
    jest
      .spyOn(runtimeConfigService, 'listCategory')
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'cron_cobranca_enabled',
            label: 'Cron de cobrança ativo',
            type: 'boolean',
            secret: false,
            value: false,
            configured: true,
            source: 'ENV',
          },
          {
            key: 'cron_cobranca_schedule',
            label: 'Agenda do cron de cobrança',
            type: 'cron',
            secret: false,
            value: '0 6 * * *',
            configured: true,
            source: 'ENV',
          },
        ]) as never,
      )
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'cron_cobranca_enabled',
            label: 'Cron de cobrança ativo',
            type: 'boolean',
            secret: false,
            value: true,
            configured: true,
            source: 'DB',
          },
          {
            key: 'cron_cobranca_schedule',
            label: 'Agenda do cron de cobrança',
            type: 'cron',
            secret: false,
            value: '0 6 * * *',
            configured: true,
            source: 'DB',
          },
        ]) as never,
      );

    const result = await configuracoesGeraisService.updateCategory(
      'mercadopago',
      {
        values: {
          cron_cobranca_enabled: true,
          cron_cobranca_schedule: '0 6 * * *',
        },
      },
      req,
    );

    expect(prisma.sistemaConfiguracoes.upsert).toHaveBeenCalled();
    expect(result.items.find((item) => item.key === 'cron_cobranca_enabled')?.value).toBe(true);
    expect(typeof result.items.find((item) => item.key === 'cron_cobranca_enabled')?.value).toBe(
      'boolean',
    );
  });

  it('retorna o modo ativo do Mercado Pago persistido após salvar', async () => {
    jest
      .spyOn(runtimeConfigService, 'listCategory')
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'mp_active_mode',
            label: 'Modo do Mercado Pago',
            type: 'string',
            secret: false,
            value: 'production',
            configured: true,
            source: 'DB',
          },
        ]) as never,
      )
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'mp_active_mode',
            label: 'Modo do Mercado Pago',
            type: 'string',
            secret: false,
            value: 'test',
            configured: true,
            source: 'DB',
          },
        ]) as never,
      );

    const result = await configuracoesGeraisService.updateCategory(
      'mercadopago',
      {
        values: {
          mp_active_mode: 'test',
        },
      },
      req,
    );

    expect(prisma.sistemaConfiguracoes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoria_chave: { categoria: 'mercadopago', chave: 'mp_active_mode' } },
      }),
    );
    expect(result.items.find((item) => item.key === 'mp_active_mode')?.value).toBe('test');
  });

  it('expõe status operacional de edição de segredos na categoria listada', async () => {
    jest.spyOn(prisma.sistemaConfiguracoes, 'findMany').mockResolvedValue([] as never);

    const result = await configuracoesGeraisService.listAll();
    const mercadopago = result.find((item) => item.category === 'mercadopago');

    expect(mercadopago?.secretEditingAvailable).toBe(false);
    expect(mercadopago?.secretEditingReason).toBe('CONFIG_ENCRYPTION_KEY_MISSING');
  });

  it('persiste segredos de teste e produção em chaves independentes quando a criptografia está disponível', async () => {
    process.env.CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');

    jest
      .spyOn(runtimeConfigService, 'listCategory')
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'mp_test_access_token',
            label: 'Access token de teste',
            type: 'string',
            secret: true,
            value: null,
            configured: true,
            source: 'DB',
            maskedPreview: '********TEST12',
          },
          {
            key: 'mp_access_token',
            label: 'Access token de produção',
            type: 'string',
            secret: true,
            value: null,
            configured: true,
            source: 'DB',
            maskedPreview: '********PROD12',
          },
        ]) as never,
      )
      .mockResolvedValueOnce(
        categorySnapshot('mercadopago', [
          {
            key: 'course_payment_methods',
            label: 'Métodos de pagamento para cursos e turmas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'subscription_payment_methods',
            label: 'Métodos de pagamento para assinaturas',
            type: 'csv',
            secret: false,
            value: 'pix,boleto,card',
            configured: true,
            source: 'ENV',
          },
          {
            key: 'mp_test_access_token',
            label: 'Access token de teste',
            type: 'string',
            secret: true,
            value: null,
            configured: true,
            source: 'DB',
            maskedPreview: '********TEST34',
          },
          {
            key: 'mp_access_token',
            label: 'Access token de produção',
            type: 'string',
            secret: true,
            value: null,
            configured: true,
            source: 'DB',
            maskedPreview: '********PROD56',
          },
        ]) as never,
      );

    await configuracoesGeraisService.updateCategory(
      'mercadopago',
      {
        secrets: {
          mp_test_access_token: { action: 'replace', value: 'TEST-ONLY_TOKEN' },
          mp_access_token: { action: 'replace', value: 'APP_USR_PROD_TOKEN' },
        },
      },
      req,
    );

    const upsertCalls = (prisma.sistemaConfiguracoes.upsert as jest.Mock).mock.calls;
    const testCall = upsertCalls.find(
      ([payload]) =>
        payload.where?.categoria_chave?.categoria === 'mercadopago' &&
        payload.where?.categoria_chave?.chave === 'mp_test_access_token',
    );
    const productionCall = upsertCalls.find(
      ([payload]) =>
        payload.where?.categoria_chave?.categoria === 'mercadopago' &&
        payload.where?.categoria_chave?.chave === 'mp_access_token',
    );

    expect(testCall).toBeDefined();
    expect(productionCall).toBeDefined();
    expect(testCall?.[0].create.valorCriptografado).not.toBe('TEST-ONLY_TOKEN');
    expect(productionCall?.[0].create.valorCriptografado).not.toBe('APP_USR_PROD_TOKEN');
    expect(testCall?.[0].create.valorCriptografado).not.toBe(
      productionCall?.[0].create.valorCriptografado,
    );
  });

  it('rejeita salvar métodos de pagamento vazios no Mercado Pago', async () => {
    jest.spyOn(runtimeConfigService, 'listCategory').mockResolvedValue(
      categorySnapshot('mercadopago', [
        {
          key: 'course_payment_methods',
          label: 'Métodos de pagamento para cursos e turmas',
          type: 'csv',
          secret: false,
          value: 'pix,boleto,card',
          configured: true,
          source: 'ENV',
        },
        {
          key: 'subscription_payment_methods',
          label: 'Métodos de pagamento para assinaturas',
          type: 'csv',
          secret: false,
          value: 'pix,boleto,card',
          configured: true,
          source: 'ENV',
        },
      ]) as never,
    );

    await expect(
      configuracoesGeraisService.updateCategory(
        'mercadopago',
        {
          values: {
            course_payment_methods: '',
          },
        },
        req,
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_CONFIG_VALUE',
      statusCode: 400,
    });
  });
});
