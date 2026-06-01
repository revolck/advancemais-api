import MercadoPagoConfig from 'mercadopago';
import { mercadopagoConfig } from './env';
import { logger } from '@/utils/logger';

// Inicializa o cliente do Mercado Pago caso exista access token
const accessToken = mercadopagoConfig.getAccessToken();
export const mpClient = accessToken ? new MercadoPagoConfig({ accessToken }) : null;

logger.info('[MERCADOPAGO_CONFIG]', {
  configured: Boolean(accessToken),
  tokenSource: mercadopagoConfig.getAccessTokenSource(),
  tokenFingerprint: mercadopagoConfig.getAccessTokenFingerprint(),
  nodeEnv: process.env.NODE_ENV,
});

export function assertMercadoPagoConfigured() {
  if (!mpClient) {
    throw Object.assign(
      new Error(
        'Mercado Pago não configurado. Defina MP_ACCESS_TOKEN, MERCADOPAGO_ACCESS_TOKEN ou MP_TEST_ACCESS_TOKEN.',
      ),
      {
        code: 'MERCADOPAGO_NOT_CONFIGURED',
        statusCode: 503,
      },
    );
  }
}

export { mercadopagoConfig };
