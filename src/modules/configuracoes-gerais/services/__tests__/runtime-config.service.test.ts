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

  it('normaliza booleans como boolean no GET das categorias', async () => {
    jest.spyOn(prisma.sistemaConfiguracoes, 'findMany').mockResolvedValue([
      {
        categoria: 'mercadopago',
        chave: 'cron_cobranca_enabled',
        tipo: 'boolean',
        valor: true,
        valorCriptografado: null,
        valorHash: null,
        ehSecreto: false,
        atualizadoEm: new Date(),
      },
      {
        categoria: 'emails',
        chave: 'email_verification_required',
        tipo: 'boolean',
        valor: false,
        valorCriptografado: null,
        valorHash: null,
        ehSecreto: false,
        atualizadoEm: new Date(),
      },
      {
        categoria: 'agenda',
        chave: 'agenda_cron_aulas_enabled',
        tipo: 'boolean',
        valor: true,
        valorCriptografado: null,
        valorHash: null,
        ehSecreto: false,
        atualizadoEm: new Date(),
      },
      {
        categoria: 'logs',
        chave: 'enable_console_log',
        tipo: 'boolean',
        valor: false,
        valorCriptografado: null,
        valorHash: null,
        ehSecreto: false,
        atualizadoEm: new Date(),
      },
    ] as never);

    const [mercadopago, emails, agenda, logs] = await Promise.all([
      runtimeConfigService.listCategory('mercadopago'),
      runtimeConfigService.listCategory('emails'),
      runtimeConfigService.listCategory('agenda'),
      runtimeConfigService.listCategory('logs'),
    ]);

    expect(mercadopago.items.find((item) => item.key === 'cron_cobranca_enabled')?.value).toBe(
      true,
    );
    expect(
      typeof mercadopago.items.find((item) => item.key === 'cron_cobranca_enabled')?.value,
    ).toBe('boolean');

    expect(emails.items.find((item) => item.key === 'email_verification_required')?.value).toBe(
      false,
    );
    expect(
      typeof emails.items.find((item) => item.key === 'email_verification_required')?.value,
    ).toBe('boolean');

    expect(agenda.items.find((item) => item.key === 'agenda_cron_aulas_enabled')?.value).toBe(true);
    expect(
      typeof agenda.items.find((item) => item.key === 'agenda_cron_aulas_enabled')?.value,
    ).toBe('boolean');

    expect(logs.items.find((item) => item.key === 'enable_console_log')?.value).toBe(false);
    expect(typeof logs.items.find((item) => item.key === 'enable_console_log')?.value).toBe(
      'boolean',
    );
  });

  it('normaliza métodos de pagamento CSV para arrays ordenados e sem duplicidade', async () => {
    jest.spyOn(prisma.sistemaConfiguracoes, 'findMany').mockResolvedValue([
      {
        categoria: 'mercadopago',
        chave: 'course_payment_methods',
        tipo: 'csv',
        valor: 'card,pix,card,boleto',
        valorCriptografado: null,
        valorHash: null,
        ehSecreto: false,
        atualizadoEm: new Date(),
      },
      {
        categoria: 'mercadopago',
        chave: 'subscription_payment_methods',
        tipo: 'csv',
        valor: 'boleto,card',
        valorCriptografado: null,
        valorHash: null,
        ehSecreto: false,
        atualizadoEm: new Date(),
      },
    ] as never);

    const config = await runtimeConfigService.getMercadoPagoConfig();

    expect(config.coursePaymentMethods).toEqual(['pix', 'boleto', 'card']);
    expect(config.subscriptionPaymentMethods).toEqual(['boleto', 'card']);
  });
});
