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
  },
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

  it('exposes the operational failure reason in the SMTP health endpoint', async () => {
    const { EmailController } = await import('../controllers/email-controller');
    const controller = new EmailController();

    (controller as any).emailService = {
      checkHealth: jest.fn().mockResolvedValue(false),
    };
    (controller as any).client = {
      healthCheck: jest.fn().mockResolvedValue(false),
      isSimulated: jest.fn().mockReturnValue(false),
      isOperational: jest.fn().mockReturnValue(true),
      getLastOperationalIssue: jest.fn().mockReturnValue({
        operation: 'health_check',
        failureReason: 'AUTHENTICATION_FAILED',
        message: '535 5.7.8 Error: authentication failed',
        responseCode: 535,
        code: 'EAUTH',
        occurredAt: '2026-10-01T00:00:00.000Z',
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
    expect(res.body.status).toBe('degraded');
    expect(res.body.module).toBe('email');
    expect(res.body.failureReason).toBe('AUTHENTICATION_FAILED');
    expect(res.body.lastError).toEqual(
      expect.objectContaining({
        operation: 'health_check',
        code: 'EAUTH',
        responseCode: 535,
      }),
    );
    expect(res.body.services).not.toHaveProperty('sms');
    expect(res.body.configuration.smtpHost).toBe('smtp.hostinger.com');
  });
});
