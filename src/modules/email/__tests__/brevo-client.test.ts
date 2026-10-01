const mockGetRuntimeConfig = jest.fn();

const config = {
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
};

jest.mock('../config/email-config', () => ({
  EmailConfigManager: {
    getInstance: () => ({
      getConfig: () => config,
      getRuntimeConfig: mockGetRuntimeConfig,
    }),
  },
}));

import { BrevoClient } from '../client/brevo-client';

const email = {
  to: 'devfilipemarques@gmail.com',
  toName: 'Filipe',
  subject: 'Teste',
  html: '<p>Teste</p>',
  text: 'Teste',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('BrevoClient', () => {
  const fetchMock = jest.fn();
  let client: BrevoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = fetchMock;
    mockGetRuntimeConfig.mockResolvedValue(config);
    (BrevoClient as any).instance = undefined;
    client = BrevoClient.getInstance();
  });

  it('sends through the transactional API with the configured sender', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { messageId: '<abc@smtp-relay.brevo.com>' }));

    const result = await client.sendEmail(email);

    expect(result).toEqual({ success: true, messageId: '<abc@smtp-relay.brevo.com>' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('brevo-key');
    expect(JSON.parse(init.body)).toMatchObject({
      sender: { name: 'Advance+', email: 'noreply@advancemais.com' },
      to: [{ email: 'devfilipemarques@gmail.com', name: 'Filipe' }],
      subject: 'Teste',
      htmlContent: '<p>Teste</p>',
      textContent: 'Teste',
    });
  });

  it('classifies an unauthorized IP as a safe failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, {
        code: 'unauthorized',
        message: 'We have detected you are using an unrecognised IP address 74.220.57.10',
      }),
    );

    const result = await client.sendEmail(email);

    expect(result).toMatchObject({
      success: false,
      failureReason: 'IP_NOT_AUTHORIZED',
      deliveryUncertain: false,
    });
  });

  it('classifies quota errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(402, { code: 'not_enough_credits', message: 'Not enough credits' }),
    );

    const result = await client.sendEmail(email);

    expect(result).toMatchObject({ success: false, failureReason: 'QUOTA_EXCEEDED' });
  });

  it('marks timeouts as uncertain delivery', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

    const result = await client.sendEmail(email);

    expect(result).toMatchObject({
      success: false,
      failureReason: 'TIMEOUT',
      deliveryUncertain: true,
    });
  });

  it('treats connection refused as a safe failure', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }),
    );

    const result = await client.sendEmail(email);

    expect(result).toMatchObject({
      success: false,
      failureReason: 'CONNECTION_FAILED',
      deliveryUncertain: false,
    });
  });

  it('does not call the API without an API key', async () => {
    mockGetRuntimeConfig.mockResolvedValue({
      ...config,
      brevo: { apiKey: '', dailyLimit: 300, isConfigured: false },
    });

    const result = await client.sendEmail(email);

    expect(result).toMatchObject({ success: false, failureReason: 'BREVO_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('health check uses the account endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { email: 'ops@advancemais.com' }));

    await expect(client.healthCheck()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.brevo.com/v3/account');
  });
});
