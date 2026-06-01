import { describe, expect, it, jest } from '@jest/globals';

const ORIGINAL_ENV = process.env;

async function loadMercadoPagoModules(env: Record<string, string>) {
  jest.resetModules();
  jest.doMock('dotenv', () => ({
    __esModule: true,
    default: { config: jest.fn() },
    config: jest.fn(),
  }));

  process.env = { ...ORIGINAL_ENV, ...env };

  const envModule = await import('../env');
  const mercadoPagoModule = await import('../mercadopago');

  jest.dontMock('dotenv');

  return { envModule, mercadoPagoModule };
}

describe('Mercado Pago config', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
    jest.dontMock('dotenv');
  });

  it('usa MERCADOPAGO_ACCESS_TOKEN como alias de produção', async () => {
    const { envModule } = await loadMercadoPagoModules({
      MP_ACCESS_TOKEN: '',
      MP_TEST_ACCESS_TOKEN: '',
      MERCADOPAGO_ACCESS_TOKEN: 'APP_USR_ALIAS_TOKEN',
    });

    expect(envModule.mercadopagoConfig.getAccessToken()).toBe('APP_USR_ALIAS_TOKEN');
    expect(envModule.mercadopagoConfig.getAccessTokenSource()).toBe('MERCADOPAGO_ACCESS_TOKEN');
    expect(envModule.mercadopagoConfig.getAccessTokenFingerprint()).toBe('APP_USR_...len:19');
  });

  it('lança erro de domínio quando Mercado Pago não está configurado', async () => {
    const { mercadoPagoModule } = await loadMercadoPagoModules({
      MP_ACCESS_TOKEN: '',
      MP_TEST_ACCESS_TOKEN: '',
      MERCADOPAGO_ACCESS_TOKEN: '',
      MERCADOPAGO_TEST_ACCESS_TOKEN: '',
    });

    try {
      mercadoPagoModule.assertMercadoPagoConfigured();
      throw new Error('assertMercadoPagoConfigured deveria ter lançado erro');
    } catch (error) {
      expect(error).toMatchObject({
        message: expect.stringContaining('Mercado Pago não configurado'),
        code: 'MERCADOPAGO_NOT_CONFIGURED',
        statusCode: 503,
      });
    }
  });
});
