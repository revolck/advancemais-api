import { ErroValidador, type ValidacaoEmail, type ValidadorExterno } from './tipos';

/**
 * Validadores de caixa postal. Todos fazem a checagem SMTP do lado deles, com IPs
 * e reputação próprios (fazer isso a partir da nossa API queimaria o IP e não funciona
 * com Gmail/Outlook). Basta configurar um provedor e a chave em Configurações → E-mails.
 */
export const PROVEDORES_VALIDACAO = ['zerobounce', 'neverbounce', 'kickbox'] as const;
export type ProvedorValidacao = (typeof PROVEDORES_VALIDACAO)[number];

const TIMEOUT_MS = 30_000;
const TIMEOUT: ValidacaoEmail = { resultado: 'TEMPORARIO', motivo: 'TIMEOUT_VALIDADOR' };

/** GET JSON. Retorna null em timeout (o endereço fica TEMPORARIO, o lote segue). */
async function buscarJson(url: string): Promise<any | null> {
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const texto = await response.text();
    let body: any = null;
    try {
      body = texto ? JSON.parse(texto) : null;
    } catch {
      body = { message: texto.slice(0, 200) };
    }

    if (!response.ok) {
      const mensagem = String(body?.message || body?.error || `HTTP ${response.status}`).slice(
        0,
        200,
      );
      if (response.status === 402 || /credit|balance|saldo/i.test(mensagem)) {
        throw new ErroValidador('SEM_CREDITOS', mensagem);
      }
      if (response.status === 401 || response.status === 403) {
        throw new ErroValidador('CREDENCIAL_INVALIDA', mensagem);
      }
      if (response.status === 429) throw new ErroValidador('LIMITE_DE_TAXA', mensagem);
      throw new ErroValidador('INDISPONIVEL', mensagem);
    }
    return body;
  } catch (error) {
    if (error instanceof ErroValidador) throw error;
    if ((error as { name?: string })?.name === 'AbortError') return null;
    // Nunca incluir a URL na mensagem: ela contém a chave
    throw new ErroValidador('INDISPONIVEL', 'Falha de rede ao consultar o validador');
  } finally {
    clearTimeout(timer);
  }
}

const sugestaoDe = (valor: unknown) =>
  typeof valor === 'string' && valor.includes('@') ? valor.trim().toLowerCase() : null;

/** https://www.zerobounce.net/docs/email-validation-api-quickstart/ */
export class ZeroBounceValidador implements ValidadorExterno {
  readonly fonte = 'ZEROBOUNCE' as const;
  private static readonly TEMPORARIOS = new Set([
    'greylisted',
    'mail_server_temporary_error',
    'mail_server_did_not_respond',
    'timeout_exceeded',
    'forcible_disconnect',
    'failed_smtp_connection',
    'antispam_system',
    'exception_occurred',
  ]);

  constructor(private readonly apiKey: string) {}

  async validar(email: string): Promise<ValidacaoEmail> {
    const query = new URLSearchParams({ api_key: this.apiKey, email, ip_address: '' });
    const body = await buscarJson(`https://api.zerobounce.net/v2/validate?${query.toString()}`);
    if (body === null) return TIMEOUT;
    if (body.error) {
      const mensagem = String(body.error).slice(0, 200);
      if (/credit/i.test(mensagem)) throw new ErroValidador('SEM_CREDITOS', mensagem);
      if (/key/i.test(mensagem)) throw new ErroValidador('CREDENCIAL_INVALIDA', mensagem);
      throw new ErroValidador('INDISPONIVEL', mensagem);
    }

    const status = String(body.status ?? '').toLowerCase();
    const sub = String(body.sub_status ?? '').toLowerCase();
    const base = {
      sugestao: sugestaoDe(body.did_you_mean),
      detalhes: { status, subStatus: sub || null },
    };

    switch (status) {
      case 'valid':
        return { ...base, resultado: 'VALIDO', motivo: 'CAIXA_CONFIRMADA' };
      case 'invalid':
        return {
          ...base,
          resultado: 'INVALIDO',
          motivo: sub ? `INVALIDO:${sub}` : 'CAIXA_INEXISTENTE',
        };
      case 'catch-all':
        return { ...base, resultado: 'RISCO', motivo: 'ACEITA_QUALQUER_ENDERECO' };
      case 'spamtrap':
        return { ...base, resultado: 'RISCO', motivo: 'ARMADILHA_DE_SPAM' };
      case 'abuse':
        return { ...base, resultado: 'RISCO', motivo: 'HISTORICO_DE_DENUNCIAS' };
      case 'do_not_mail':
        return { ...base, resultado: 'RISCO', motivo: sub ? `NAO_ENVIAR:${sub}` : 'NAO_ENVIAR' };
      case 'unknown':
        return ZeroBounceValidador.TEMPORARIOS.has(sub)
          ? { ...base, resultado: 'TEMPORARIO', motivo: `TEMPORARIO:${sub}` }
          : {
              ...base,
              resultado: 'DESCONHECIDO',
              motivo: sub ? `DESCONHECIDO:${sub}` : 'DESCONHECIDO',
            };
      default:
        return {
          ...base,
          resultado: 'DESCONHECIDO',
          motivo: `STATUS_INESPERADO:${status || 'vazio'}`,
        };
    }
  }
}

/** https://developers.neverbounce.com/reference/single-check */
export class NeverBounceValidador implements ValidadorExterno {
  readonly fonte = 'NEVERBOUNCE' as const;

  constructor(private readonly apiKey: string) {}

  async validar(email: string): Promise<ValidacaoEmail> {
    const query = new URLSearchParams({ key: this.apiKey, email, timeout: '20' });
    const body = await buscarJson(
      `https://api.neverbounce.com/v4/single/check?${query.toString()}`,
    );
    if (body === null) return TIMEOUT;

    if (body.status !== 'success') {
      const mensagem = String(body.message || body.status || 'erro').slice(0, 200);
      if (body.status === 'auth_failure' || body.status === 'bad_referrer') {
        throw new ErroValidador('CREDENCIAL_INVALIDA', mensagem);
      }
      if (body.status === 'throttle_triggered') throw new ErroValidador('LIMITE_DE_TAXA', mensagem);
      if (/credit/i.test(mensagem)) throw new ErroValidador('SEM_CREDITOS', mensagem);
      throw new ErroValidador('INDISPONIVEL', mensagem);
    }

    const resultado = String(body.result ?? '').toLowerCase();
    const base = {
      sugestao: sugestaoDe(body.suggested_correction),
      detalhes: { result: resultado, flags: Array.isArray(body.flags) ? body.flags : [] },
    };

    switch (resultado) {
      case 'valid':
        return { ...base, resultado: 'VALIDO', motivo: 'CAIXA_CONFIRMADA' };
      case 'invalid':
        return { ...base, resultado: 'INVALIDO', motivo: 'CAIXA_INEXISTENTE' };
      case 'disposable':
        return { ...base, resultado: 'RISCO', motivo: 'DOMINIO_DESCARTAVEL' };
      case 'catchall':
        return { ...base, resultado: 'RISCO', motivo: 'ACEITA_QUALQUER_ENDERECO' };
      case 'unknown':
        // O servidor não respondeu; nova tentativa depois (vira DESCONHECIDO após 3)
        return { ...base, resultado: 'TEMPORARIO', motivo: 'SERVIDOR_NAO_RESPONDEU' };
      default:
        return {
          ...base,
          resultado: 'DESCONHECIDO',
          motivo: `RESULTADO_INESPERADO:${resultado || 'vazio'}`,
        };
    }
  }
}

/** https://docs.kickbox.com/docs/single-verification-api */
export class KickboxValidador implements ValidadorExterno {
  readonly fonte = 'KICKBOX' as const;
  private static readonly TEMPORARIOS = new Set([
    'no_connect',
    'timeout',
    'unavailable_smtp',
    'unexpected_error',
  ]);

  constructor(private readonly apiKey: string) {}

  async validar(email: string): Promise<ValidacaoEmail> {
    const query = new URLSearchParams({ email, apikey: this.apiKey, timeout: '20000' });
    const body = await buscarJson(`https://api.kickbox.com/v2/verify?${query.toString()}`);
    if (body === null) return TIMEOUT;
    if (body.success === false) {
      const mensagem = String(body.message || 'erro').slice(0, 200);
      if (/balance|credit/i.test(mensagem)) throw new ErroValidador('SEM_CREDITOS', mensagem);
      if (/key/i.test(mensagem)) throw new ErroValidador('CREDENCIAL_INVALIDA', mensagem);
      throw new ErroValidador('INDISPONIVEL', mensagem);
    }

    const resultado = String(body.result ?? '').toLowerCase();
    const razao = String(body.reason ?? '').toLowerCase();
    const base = {
      sugestao: sugestaoDe(body.did_you_mean),
      detalhes: {
        result: resultado,
        reason: razao || null,
        acceptAll: Boolean(body.accept_all),
        disposable: Boolean(body.disposable),
        sendex: body.sendex ?? null,
      },
    };

    switch (resultado) {
      case 'deliverable':
        return body.accept_all
          ? { ...base, resultado: 'RISCO', motivo: 'ACEITA_QUALQUER_ENDERECO' }
          : { ...base, resultado: 'VALIDO', motivo: 'CAIXA_CONFIRMADA' };
      case 'undeliverable':
        return {
          ...base,
          resultado: 'INVALIDO',
          motivo: razao ? `INVALIDO:${razao}` : 'CAIXA_INEXISTENTE',
        };
      case 'risky':
        if (body.disposable) return { ...base, resultado: 'RISCO', motivo: 'DOMINIO_DESCARTAVEL' };
        if (body.accept_all)
          return { ...base, resultado: 'RISCO', motivo: 'ACEITA_QUALQUER_ENDERECO' };
        return { ...base, resultado: 'RISCO', motivo: razao ? `RISCO:${razao}` : 'RISCO' };
      case 'unknown':
        return KickboxValidador.TEMPORARIOS.has(razao)
          ? { ...base, resultado: 'TEMPORARIO', motivo: `TEMPORARIO:${razao}` }
          : {
              ...base,
              resultado: 'DESCONHECIDO',
              motivo: razao ? `DESCONHECIDO:${razao}` : 'DESCONHECIDO',
            };
      default:
        return {
          ...base,
          resultado: 'DESCONHECIDO',
          motivo: `RESULTADO_INESPERADO:${resultado || 'vazio'}`,
        };
    }
  }
}

export function criarValidadorExterno(
  provedor: string | null | undefined,
  apiKey: string | null | undefined,
): ValidadorExterno | null {
  const chave = apiKey?.trim();
  if (!chave) return null;
  switch (provedor?.trim().toLowerCase()) {
    case 'zerobounce':
      return new ZeroBounceValidador(chave);
    case 'neverbounce':
      return new NeverBounceValidador(chave);
    case 'kickbox':
      return new KickboxValidador(chave);
    default:
      return null;
  }
}
