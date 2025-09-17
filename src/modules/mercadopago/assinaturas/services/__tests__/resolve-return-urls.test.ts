import { resolveCheckoutReturnUrls } from '@/modules/mercadopago/assinaturas/services/assinaturas.service';
import { mercadopagoConfig, serverConfig } from '@/config/env';

describe('resolveCheckoutReturnUrls', () => {
  const originalReturnUrls = {
    success: mercadopagoConfig.returnUrls.success,
    failure: mercadopagoConfig.returnUrls.failure,
    pending: mercadopagoConfig.returnUrls.pending,
  };
  const originalFrontendUrl = serverConfig.frontendUrl;

  afterEach(() => {
    (mercadopagoConfig.returnUrls as any).success = originalReturnUrls.success;
    (mercadopagoConfig.returnUrls as any).failure = originalReturnUrls.failure;
    (mercadopagoConfig.returnUrls as any).pending = originalReturnUrls.pending;
    (serverConfig as any).frontendUrl = originalFrontendUrl;
  });

  it('prefers explicit checkout URLs when provided', () => {
    const urls = resolveCheckoutReturnUrls({
      successUrl: 'https://app.example.com/success',
      failureUrl: 'https://app.example.com/failure',
      pendingUrl: 'https://app.example.com/pending',
    });

    expect(urls).toEqual({
      success: 'https://app.example.com/success',
      failure: 'https://app.example.com/failure',
      pending: 'https://app.example.com/pending',
    });
  });

  it('falls back to configured Mercado Pago return URLs', () => {
    (mercadopagoConfig.returnUrls as any).success = 'https://config.example.com/success';
    (mercadopagoConfig.returnUrls as any).failure = 'https://config.example.com/failure';
    (mercadopagoConfig.returnUrls as any).pending = 'https://config.example.com/pending';

    const urls = resolveCheckoutReturnUrls();

    expect(urls).toEqual({
      success: 'https://config.example.com/success',
      failure: 'https://config.example.com/failure',
      pending: 'https://config.example.com/pending',
    });
  });

  it('uses the frontend URL as a final fallback when configuration is missing', () => {
    (mercadopagoConfig.returnUrls as any).success = '';
    (mercadopagoConfig.returnUrls as any).failure = '  ';
    (mercadopagoConfig.returnUrls as any).pending = null;
    (serverConfig as any).frontendUrl = 'https://app.advancemais.com';

    const urls = resolveCheckoutReturnUrls();

    expect(urls).toEqual({
      success: 'https://app.advancemais.com',
      failure: 'https://app.advancemais.com',
      pending: 'https://app.advancemais.com',
    });
  });
});
