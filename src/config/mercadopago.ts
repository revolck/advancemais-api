import MercadoPagoConfig from 'mercadopago';
import { mercadopagoConfig } from './env';
import { logger } from '@/utils/logger';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';

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

export async function getMercadoPagoClient() {
  return runtimeConfigService.getMercadoPagoClient();
}

export async function assertMercadoPagoConfiguredAsync() {
  const config = await runtimeConfigService.getMercadoPagoConfig();
  const validation = config.validateActiveCredentials();
  const client = await getMercadoPagoClient();
  if (!client) {
    const modeLabel = validation.activeMode === 'production' ? 'Produção' : 'Teste';
    const missingLabels = validation.missingKeys.map((key) => {
      switch (key) {
        case 'mp_user_id':
          return 'User ID de produção';
        case 'mp_application_id':
          return 'Application ID de produção';
        case 'mp_public_key':
          return 'Public key de produção';
        case 'mp_access_token':
          return 'Access token de produção';
        case 'mp_test_user_id':
          return 'User ID de teste';
        case 'mp_test_application_id':
          return 'Application ID de teste';
        case 'mp_test_public_key':
          return 'Public key de teste';
        case 'mp_test_access_token':
          return 'Access token de teste';
        default:
          return key;
      }
    });

    throw Object.assign(
      new Error(
        missingLabels.length > 0
          ? `Modo ${modeLabel} ativo, mas faltam ${missingLabels.join(' e ')}.`
          : 'Mercado Pago não configurado. Defina credenciais no painel ou no ambiente da API.',
      ),
      {
        code: 'MERCADOPAGO_MODE_INCOMPLETE',
        statusCode: 503,
        activeMode: validation.activeMode,
        missingKeys: validation.missingKeys,
      },
    );
  }
  return client;
}

export async function getRuntimeMercadoPagoConfig() {
  return runtimeConfigService.getMercadoPagoConfig();
}

export { mercadopagoConfig };
