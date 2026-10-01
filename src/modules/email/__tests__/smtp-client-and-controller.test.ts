import express from 'express';
import request from 'supertest';

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockClose = jest.fn();
const mockCreateTransport = jest.fn();
const mockGetConfig = jest.fn();
const mockGetRuntimeConfig = jest.fn();
const mockResolveEmailEnvironment = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: (...args: unknown[]) => mockCreateTransport(...args),
  },
}));

jest.mock('../config/email-config', () => ({
  EmailConfigManager: {
    getInstance: () => ({
      getConfig: mockGetConfig,
      getRuntimeConfig: mockGetRuntimeConfig,
      getHealthInfo: jest.fn(),
    }),
  },
  resolveEmailEnvironment: () => mockResolveEmailEnvironment(),
}));

const runtimeConfig = {
  fromEmail: 'noreply@advancemais.com',
  fromName: 'Advance+',
  smtp: {
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    user: 'noreply@advancemais.com',
    password: 'smtp-password',
    dailyLimit: 100,
  },
  brevo: { apiKey: '', dailyLimit: 300, isConfigured: false },
  routing: { transactional: ['smtp', 'brevo'], marketing: ['brevo'], transactionalReserve: 50 },
  timeout: 15000,
  isConfigured: true,
  environment: 'production',
  urls: {
    frontend: 'https://advancemais.com',
    verification: 'https://auth.advancemais.com/verify-email',
    passwordRecovery: 'https://auth.advancemais.com/recuperar-senha',
  },
  UsuariosVerificacaoEmail: {
    enabled: true,
    tokenExpirationHours: 72,
    maxResendAttempts: 3,
    resendCooldownMinutes: 5,
  },
  passwordRecovery: {
    tokenExpirationMinutes: 4320,
    maxAttempts: 3,
    cooldownMinutes: 15,
  },
};

const emailData = {
  to: 'devfilipemarques@gmail.com',
  toName: 'Filipe',
  subject: 'Teste',
  html: '<p>Teste</p>',
  text: 'Teste',
};

describe('SMTP hardening', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockGetConfig.mockReturnValue(runtimeConfig);
    mockGetRuntimeConfig.mockResolvedValue(runtimeConfig);
    mockResolveEmailEnvironment.mockReturnValue('production');
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
      close: mockClose,
    });
  });

  it('sends through the pooled SMTP transport with the configured sender', async () => {
    const { SmtpClient } = await import('../client/smtp-client');
    (SmtpClient as any).instance = undefined;

    mockSendMail.mockResolvedValue({
      messageId: '<abc@advancemais.com>',
      accepted: ['devfilipemarques@gmail.com'],
      rejected: [],
      response: '250 2.0.0 Ok: queued',
    });

    const client = SmtpClient.getInstance();
    const result = await client.sendEmail(emailData);

    expect(result).toEqual({ success: true, messageId: '<abc@advancemais.com>' });
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        pool: true,
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true,
        auth: { user: 'noreply@advancemais.com', pass: 'smtp-password' },
      }),
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Advance+', address: 'noreply@advancemais.com' },
        to: { name: 'Filipe', address: 'devfilipemarques@gmail.com' },
        subject: 'Teste',
      }),
    );
  });

  it('returns a real failure when the SMTP server rejects the credentials', async () => {
    const { SmtpClient } = await import('../client/smtp-client');
    (SmtpClient as any).instance = undefined;

    mockSendMail.mockRejectedValue(
      Object.assign(new Error('Invalid login'), {
        code: 'EAUTH',
        responseCode: 535,
        response: '535 5.7.8 Error: authentication failed',
      }),
    );

    const client = SmtpClient.getInstance();
    const result = await client.sendEmail(emailData);

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining('authentication failed'),
    });
    expect(result.simulated).toBeUndefined();
    expect(client.getLastOperationalIssue()).toEqual(
      expect.objectContaining({
        operation: 'send_email',
        failureReason: 'AUTHENTICATION_FAILED',
        code: 'EAUTH',
        responseCode: 535,
      }),
    );
  });

  it('treats recipients rejected by the server as a failure', async () => {
    const { SmtpClient } = await import('../client/smtp-client');
    (SmtpClient as any).instance = undefined;

    mockSendMail.mockResolvedValue({
      messageId: '<abc@advancemais.com>',
      accepted: [],
      rejected: ['devfilipemarques@gmail.com'],
      response: '550 5.1.1 Mailbox unavailable',
    });

    const client = SmtpClient.getInstance();
    const result = await client.sendEmail(emailData);

    expect(result.success).toBe(false);
    expect(client.getLastOperationalIssue()?.failureReason).toBe('RECIPIENT_REJECTED');
  });

  it('simulates delivery when SMTP is not configured', async () => {
    const unconfigured = {
      ...runtimeConfig,
      isConfigured: false,
      smtp: { ...runtimeConfig.smtp, password: '' },
    };
    mockGetConfig.mockReturnValue(unconfigured);
    mockGetRuntimeConfig.mockResolvedValue(unconfigured);

    const { SmtpClient } = await import('../client/smtp-client');
    (SmtpClient as any).instance = undefined;

    const client = SmtpClient.getInstance();
    const result = await client.sendEmail(emailData);

    expect(result).toMatchObject({ success: true, simulated: true });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('exposes per-provider status and the failure reason in the health endpoint', async () => {
    const { EmailController } = await import('../controllers/email-controller');
    const controller = new EmailController();

    (controller as any).client = {
      getHealthReport: jest.fn().mockResolvedValue({
        status: 'degraded',
        simulated: false,
        routing: runtimeConfig.routing,
        providers: [
          {
            name: 'smtp',
            configured: true,
            healthy: false,
            dailyLimit: 100,
            usedToday: 3,
            lastIssue: {
              operation: 'health_check',
              failureReason: 'AUTHENTICATION_FAILED',
              message: '535 5.7.8 Error: authentication failed',
              responseCode: 535,
              code: 'EAUTH',
              occurredAt: '2026-10-01T00:00:00.000Z',
            },
          },
          {
            name: 'brevo',
            configured: true,
            healthy: true,
            dailyLimit: 300,
            usedToday: 10,
            lastIssue: null,
          },
        ],
      }),
    };
    (controller as any).config = {
      getRuntimeConfig: jest.fn().mockResolvedValue(runtimeConfig),
      getConfig: jest.fn().mockReturnValue(runtimeConfig),
      getHealthInfo: jest.fn().mockReturnValue({}),
    };

    const app = express();
    app.get('/health', controller.healthCheck);

    const res = await request(app).get('/health');

    // Um canal ainda funciona: degradado, mas não indisponível
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.module).toBe('email');
    expect(res.body.services).toMatchObject({ smtp: 'degraded', brevo: 'operational' });
    expect(res.body.failureReason).toBe('AUTHENTICATION_FAILED');
    expect(res.body.lastError).toEqual(
      expect.objectContaining({ provider: 'smtp', code: 'EAUTH', responseCode: 535 }),
    );
    expect(res.body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'brevo', usedToday: 10, dailyLimit: 300 }),
      ]),
    );
    expect(res.body.configuration.smtpHost).toBe('smtp.hostinger.com');
  });

  it('returns 503 when no configured provider is healthy', async () => {
    const { EmailController } = await import('../controllers/email-controller');
    const controller = new EmailController();

    (controller as any).client = {
      getHealthReport: jest.fn().mockResolvedValue({
        status: 'unhealthy',
        simulated: false,
        routing: runtimeConfig.routing,
        providers: [
          {
            name: 'smtp',
            configured: true,
            healthy: false,
            dailyLimit: 100,
            usedToday: 0,
            lastIssue: {
              operation: 'health_check',
              failureReason: 'TIMEOUT',
              message: 'Connection timeout',
              code: 'ETIMEDOUT',
              occurredAt: '2026-10-01T00:00:00.000Z',
            },
          },
          {
            name: 'brevo',
            configured: false,
            healthy: null,
            dailyLimit: 300,
            usedToday: 0,
            lastIssue: null,
          },
        ],
      }),
    };
    (controller as any).config = {
      getRuntimeConfig: jest.fn().mockResolvedValue(runtimeConfig),
      getConfig: jest.fn().mockReturnValue(runtimeConfig),
      getHealthInfo: jest.fn().mockReturnValue({}),
    };

    const app = express();
    app.get('/health', controller.healthCheck);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.services).toMatchObject({ smtp: 'degraded', brevo: 'not_configured' });
    expect(res.body.failureReason).toBe('TIMEOUT');
  });
});
