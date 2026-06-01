import MercadoPagoConfig from 'mercadopago';
import { mercadopagoConfig } from './env';

// Inicializa o cliente do Mercado Pago caso exista access token
const accessToken = mercadopagoConfig.getAccessToken();
export const mpClient = accessToken ? new MercadoPagoConfig({ accessToken }) : null;

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
