const mockGetRuntimeConfig = jest.fn();

jest.mock('../config/email-config', () => ({
  EmailConfigManager: {
    getInstance: () => ({
      getConfig: () => baseConfig(),
      getRuntimeConfig: mockGetRuntimeConfig,
    }),
  },
  resolveEmailEnvironment: () => 'test',
}));

import { EmailDispatcher } from '../client/email-dispatcher';
import { emailUsageCounter } from '../client/email-usage-counter';

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    fromEmail: 'noreply@advancemais.com',
    fromName: 'Advance+',
    isConfigured: true,
    smtp: {
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      user: 'noreply@advancemais.com',
      password: 'secret',
      dailyLimit: 100,
    },
    brevo: { apiKey: 'brevo-key', dailyLimit: 300, isConfigured: true },
    routing: { transactional: ['smtp', 'brevo'], marketing: ['brevo'], transactionalReserve: 50 },
    timeout: 15000,
    ...overrides,
  };
}

const email = {
  to: 'devfilipemarques@gmail.com',
  toName: 'Filipe',
  subject: 'Teste',
  html: '<p>Teste</p>',
  text: 'Teste',
};

function makeClient() {
  return {
    sendEmail: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    getLastOperationalIssue: jest.fn().mockReturnValue(null),
  };
}

describe('EmailDispatcher', () => {
  let smtp: ReturnType<typeof makeClient>;
  let brevo: ReturnType<typeof makeClient>;
  let dispatcher: EmailDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    emailUsageCounter.resetMemory();
    mockGetRuntimeConfig.mockResolvedValue(baseConfig());
    smtp = makeClient();
    brevo = makeClient();
    dispatcher = new (EmailDispatcher as any)({ smtp, brevo });
  });

  it('sends system emails through SMTP first', async () => {
    smtp.sendEmail.mockResolvedValue({ success: true, messageId: 'smtp-1' });

    const result = await dispatcher.send(email);

    expect(result).toMatchObject({ success: true, provider: 'smtp', messageId: 'smtp-1' });
    expect(brevo.sendEmail).not.toHaveBeenCalled();
    expect(await emailUsageCounter.get('smtp')).toBe(1);
  });

  it('falls back to Brevo when SMTP rejects for sure', async () => {
    smtp.sendEmail.mockResolvedValue({
      success: false,
      error: '535 authentication failed',
      failureReason: 'AUTHENTICATION_FAILED',
      deliveryUncertain: false,
    });
    brevo.sendEmail.mockResolvedValue({ success: true, messageId: 'brevo-1' });

    const result = await dispatcher.send(email);

    expect(result).toMatchObject({ success: true, provider: 'brevo', messageId: 'brevo-1' });
    expect(await emailUsageCounter.get('smtp')).toBe(0);
    expect(await emailUsageCounter.get('brevo')).toBe(1);
  });

  it('falls back from Brevo to SMTP when the order is reversed', async () => {
    mockGetRuntimeConfig.mockResolvedValue(
      baseConfig({
        routing: {
          transactional: ['brevo', 'smtp'],
          marketing: ['brevo'],
          transactionalReserve: 50,
        },
      }),
    );
    brevo.sendEmail.mockResolvedValue({
      success: false,
      failureReason: 'IP_NOT_AUTHORIZED',
      deliveryUncertain: false,
    });
    smtp.sendEmail.mockResolvedValue({ success: true, messageId: 'smtp-2' });

    const result = await dispatcher.send(email);

    expect(result).toMatchObject({ success: true, provider: 'smtp' });
  });

  it('does not resend through another channel when delivery is uncertain', async () => {
    smtp.sendEmail.mockResolvedValue({
      success: false,
      error: 'SMTP_EMAIL_TIMEOUT',
      failureReason: 'TIMEOUT',
      deliveryUncertain: true,
    });

    const result = await dispatcher.send(email);

    expect(result).toMatchObject({ success: false, provider: 'smtp', deliveryUncertain: true });
    expect(brevo.sendEmail).not.toHaveBeenCalled();
    // A tentativa conta no limite, pois pode ter sido entregue
    expect(await emailUsageCounter.get('smtp')).toBe(1);
  });

  it('moves to Brevo once the SMTP daily limit is reached', async () => {
    mockGetRuntimeConfig.mockResolvedValue(
      baseConfig({ smtp: { ...baseConfig().smtp, dailyLimit: 2 } }),
    );
    smtp.sendEmail.mockResolvedValue({ success: true, messageId: 'smtp' });
    brevo.sendEmail.mockResolvedValue({ success: true, messageId: 'brevo' });

    const providers = [];
    for (let i = 0; i < 3; i++) providers.push((await dispatcher.send(email)).provider);

    expect(providers).toEqual(['smtp', 'smtp', 'brevo']);
    expect(smtp.sendEmail).toHaveBeenCalledTimes(2);
  });

  it('marks a channel as exhausted when the provider reports quota exceeded', async () => {
    smtp.sendEmail.mockResolvedValueOnce({
      success: false,
      failureReason: 'QUOTA_EXCEEDED',
      deliveryUncertain: false,
    });
    brevo.sendEmail.mockResolvedValue({ success: true, messageId: 'brevo' });

    await dispatcher.send(email);
    await dispatcher.send(email);

    expect(smtp.sendEmail).toHaveBeenCalledTimes(1);
    expect(brevo.sendEmail).toHaveBeenCalledTimes(2);
  });

  it('keeps campaigns on Brevo and leaves the reserve for system emails', async () => {
    mockGetRuntimeConfig.mockResolvedValue(
      baseConfig({
        brevo: { apiKey: 'brevo-key', dailyLimit: 3, isConfigured: true },
        routing: {
          transactional: ['smtp', 'brevo'],
          marketing: ['brevo'],
          transactionalReserve: 1,
        },
      }),
    );
    brevo.sendEmail.mockResolvedValue({ success: true, messageId: 'brevo' });
    smtp.sendEmail.mockResolvedValue({ success: true, messageId: 'smtp' });

    const results = [];
    for (let i = 0; i < 3; i++)
      results.push(await dispatcher.send(email, { channel: 'marketing' }));

    // limite 3 - reserva 1 = 2 envios de campanha; o 3º falha sem usar o SMTP
    expect(results.map((r) => r.success)).toEqual([true, true, false]);
    expect(results[2].failureReason).toBe('DAILY_LIMIT_REACHED');
    expect(smtp.sendEmail).not.toHaveBeenCalled();

    // A reserva continua disponível para e-mails do sistema
    smtp.sendEmail.mockResolvedValueOnce({
      success: false,
      failureReason: 'TIMEOUT',
      deliveryUncertain: false,
    });
    const system = await dispatcher.send(email);
    expect(system).toMatchObject({ success: true, provider: 'brevo' });
  });

  it('uses the system channels for campaigns when Brevo is not configured', async () => {
    mockGetRuntimeConfig.mockResolvedValue(
      baseConfig({ brevo: { apiKey: '', dailyLimit: 300, isConfigured: false } }),
    );
    smtp.sendEmail.mockResolvedValue({ success: true, messageId: 'smtp' });

    const result = await dispatcher.send(email, { channel: 'marketing' });

    expect(result).toMatchObject({ success: true, provider: 'smtp' });
  });

  it('simulates delivery when no channel is configured', async () => {
    mockGetRuntimeConfig.mockResolvedValue(
      baseConfig({
        isConfigured: false,
        brevo: { apiKey: '', dailyLimit: 300, isConfigured: false },
      }),
    );

    const result = await dispatcher.send(email);

    expect(result).toMatchObject({ success: true, simulated: true });
    expect(smtp.sendEmail).not.toHaveBeenCalled();
    expect(brevo.sendEmail).not.toHaveBeenCalled();
  });

  it('reports degraded health when only one configured channel works', async () => {
    smtp.healthCheck.mockResolvedValue(false);
    smtp.getLastOperationalIssue.mockReturnValue({
      operation: 'health_check',
      failureReason: 'TIMEOUT',
      message: 'Connection timeout',
      occurredAt: '2026-10-01T00:00:00.000Z',
    });

    const report = await dispatcher.getHealthReport();

    expect(report.status).toBe('degraded');
    expect(report.providers.find((p) => p.name === 'smtp')?.lastIssue?.failureReason).toBe(
      'TIMEOUT',
    );
    expect(await dispatcher.healthCheck()).toBe(true);
  });
});
