import express from 'express';
import request from 'supertest';

const mockSendTransacEmail = jest.fn();
const mockSendTransacSms = jest.fn();
const mockGetAccount = jest.fn();
const mockGetConfig = jest.fn();
const mockGetRuntimeConfig = jest.fn();
const mockResolveBrevoEnvironment = jest.fn();

jest.mock('@getbrevo/brevo', () => {
  class TransactionalEmailsApi {
    setApiKey = jest.fn();
    sendTransacEmail = mockSendTransacEmail;
  }

  class TransactionalSMSApi {
    setApiKey = jest.fn();
    sendTransacSms = mockSendTransacSms;
  }

  class AccountApi {
    setApiKey = jest.fn();
    getAccount = mockGetAccount;
  }

  class SendSmtpEmail {
    to?: { email: string; name: string }[];
    sender?: { email: string; name: string };
    subject?: string;
    htmlContent?: string;
    textContent?: string;
  }

  class SendTransacSms {
    static TypeEnum = { Transactional: 'transactional' };
    type?: string;
    unicodeEnabled?: boolean;
    sender?: string;
    recipient?: string;
    content?: string;
  }

  return {
    TransactionalEmailsApi,
    TransactionalSMSApi,
    AccountApi,
    SendSmtpEmail,
    SendTransacSms,
    TransactionalEmailsApiApiKeys: { apiKey: 'apiKey' },
    TransactionalSMSApiApiKeys: { apiKey: 'apiKey' },
    AccountApiApiKeys: { apiKey: 'apiKey' },
  };
});

jest.mock('../config/brevo-config', () => ({
  BrevoConfigManager: {
    getInstance: () => ({
      getConfig: mockGetConfig,
      getRuntimeConfig: mockGetRuntimeConfig,
      getHealthInfo: jest.fn(),
    }),
  },
  resolveBrevoEnvironment: () => mockResolveBrevoEnvironment(),
}));

const runtimeConfig = {
  apiKey: 'brevo-api-key',
  fromEmail: 'noreply@advancemais.com',
  fromName: 'Advance+',
  maxRetries: 3,
  timeout: 30000,
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

describe('Brevo hardening', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockGetConfig.mockReturnValue(runtimeConfig);
    mockGetRuntimeConfig.mockResolvedValue(runtimeConfig);
    mockResolveBrevoEnvironment.mockReturnValue('production');
    mockGetAccount.mockResolvedValue({ email: 'ops@advancemais.com' });
  });

  it('returns a real failure when Brevo rejects email by unauthorized IP', async () => {
    const { BrevoClient } = await import('../client/brevo-client');
    (BrevoClient as any).instance = undefined;

    mockSendTransacEmail.mockRejectedValue({
      response: {
        statusCode: 401,
        body: {
          code: 'unauthorized',
          message:
            'We have detected you are using an unrecognised IP address 2804:29b8:5131:1b31:1199:56c8:b6ec:828c.',
        },
      },
    });

    const client = BrevoClient.getInstance();
    const result = await client.sendEmail({
      to: 'devfilipemarques@gmail.com',
      toName: 'Filipe',
      subject: 'Teste',
      html: '<p>Teste</p>',
      text: 'Teste',
    });

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining('unrecognised IP address'),
    });
    expect(result.simulated).toBeUndefined();
    expect(client.getLastOperationalIssue()).toEqual(
      expect.objectContaining({
        operation: 'send_email',
        failureReason: 'IP_NOT_AUTHORIZED',
        code: 'unauthorized',
        statusCode: 401,
      }),
    );
  });

  it('exposes the operational failure reason in the Brevo health endpoint', async () => {
    const { BrevoController } = await import('../controllers/brevo-controller');
    const controller = new BrevoController();

    (controller as any).emailService = {
      checkHealth: jest.fn().mockResolvedValue(false),
    };
    (controller as any).smsService = {
      checkHealth: jest.fn().mockResolvedValue(false),
    };
    (controller as any).client = {
      healthCheck: jest.fn().mockResolvedValue(false),
      isSimulated: jest.fn().mockReturnValue(false),
      isOperational: jest.fn().mockReturnValue(true),
      getLastOperationalIssue: jest.fn().mockReturnValue({
        operation: 'health_check',
        failureReason: 'IP_NOT_AUTHORIZED',
        message: 'IP de saída não autorizado na Brevo',
        statusCode: 401,
        code: 'unauthorized',
        occurredAt: '2026-06-22T23:59:59.000Z',
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
    expect(res.body.failureReason).toBe('IP_NOT_AUTHORIZED');
    expect(res.body.lastError).toEqual(
      expect.objectContaining({
        operation: 'health_check',
        code: 'unauthorized',
        statusCode: 401,
      }),
    );
    expect(res.body.configuration.environment).toBe('production');
  });
});
