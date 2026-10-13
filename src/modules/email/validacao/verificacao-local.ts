import { promises as dns } from 'dns';
import type { ValidacaoEmail } from './tipos';

/**
 * Checagens gratuitas feitas antes do validador externo. Elas só servem para
 * DESCARTAR endereços: passar aqui não prova que a caixa postal existe.
 */

const SINTAXE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Provedores mais usados pela base (referência para detectar erro de digitação) */
const DOMINIOS_POPULARES = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com.br',
  'yahoo.com',
  'live.com',
  'icloud.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'ig.com.br',
  'msn.com',
  'hotmail.com.br',
  'outlook.com.br',
  'globo.com',
];

/** Domínios reais parecidos com os populares, que não devem ser tratados como erro */
const DOMINIOS_CONHECIDOS = new Set([
  ...DOMINIOS_POPULARES,
  'ymail.com',
  'mail.com',
  'email.com',
  'gmx.com',
  'aol.com',
  'me.com',
  'mac.com',
  'zoho.com',
  'proton.me',
  'protonmail.com',
  'yandex.com',
  'uol.com',
  'r7.com',
  'globomail.com',
  'hotmail.es',
  'hotmail.fr',
  'hotmail.it',
  'hotmail.co.uk',
  'live.co.uk',
  'live.fr',
  'outlook.es',
  'outlook.pt',
  'yahoo.es',
  'yahoo.fr',
  'yahoo.it',
  'yahoo.co.uk',
]);

const DOMINIOS_DESCARTAVEIS = new Set([
  'mailinator.com',
  'yopmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'emailondeck.com',
]);

/** Distância de edição com transposição (gmial → gmail conta 1) */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Domínio parecido com um provedor popular (gmal.com, hotmail.com.com, outloook.com).
 * Retorna o domínio provável. Alguns desses domínios aceitam qualquer e-mail
 * (typosquatting): enviar para eles entrega a senha provisória a terceiros.
 */
export function detectarErroDeDigitacao(dominio: string): string | null {
  const alvo = dominio.trim().toLowerCase();
  if (!alvo || DOMINIOS_CONHECIDOS.has(alvo)) return null;

  const repetido = DOMINIOS_POPULARES.find((popular) => alvo.startsWith(`${popular}.`));
  if (repetido) return repetido;

  let melhor: { dominio: string; distancia: number } | null = null;
  for (const popular of DOMINIOS_POPULARES) {
    const dist = distancia(alvo, popular);
    if (!melhor || dist < melhor.distancia) melhor = { dominio: popular, distancia: dist };
  }
  if (!melhor) return null;
  const limite = alvo.length >= 9 ? 2 : 1;
  return melhor.distancia <= limite ? melhor.dominio : null;
}

type SituacaoDominio = 'OK' | 'SEM_MX' | 'TEMPORARIO';
const cacheDominios = new Map<string, SituacaoDominio>();

export async function verificarDominio(dominio: string): Promise<SituacaoDominio> {
  const cached = cacheDominios.get(dominio);
  if (cached) return cached;

  let situacao: SituacaoDominio;
  try {
    const mx = await dns.resolveMx(dominio);
    // MX nulo (RFC 7505) também significa "não recebe e-mail"
    situacao = mx.some((item) => item.exchange && item.exchange !== '.') ? 'OK' : 'SEM_MX';
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Só é definitivo quando o DNS afirma que não existe; timeout/erro do servidor é temporário
    situacao =
      code === 'ENOTFOUND' || code === 'ENODATA' || code === 'EBADNAME' ? 'SEM_MX' : 'TEMPORARIO';
  }

  if (situacao !== 'TEMPORARIO') cacheDominios.set(dominio, situacao);
  return situacao;
}

/** Apenas para testes */
export function limparCacheDominios(): void {
  cacheDominios.clear();
}

/**
 * Retorna a classificação quando a checagem local já decide (inválido, risco ou
 * temporário). Retorna null quando o endereço passou e precisa do validador externo.
 */
export async function verificarLocalmente(email: string): Promise<ValidacaoEmail | null> {
  const normalizado = email.trim().toLowerCase();
  if (!SINTAXE.test(normalizado) || normalizado.includes('..')) {
    return { resultado: 'INVALIDO', motivo: 'FORMATO_INVALIDO' };
  }

  const [local, dominio] = normalizado.split('@');
  if (local.startsWith('.') || local.endsWith('.')) {
    return { resultado: 'INVALIDO', motivo: 'FORMATO_INVALIDO' };
  }

  if (DOMINIOS_DESCARTAVEIS.has(dominio)) {
    return { resultado: 'RISCO', motivo: 'DOMINIO_DESCARTAVEL' };
  }

  const provavel = detectarErroDeDigitacao(dominio);
  if (provavel) {
    return {
      resultado: 'RISCO',
      motivo: 'DOMINIO_COM_ERRO_DE_DIGITACAO',
      sugestao: `${local}@${provavel}`,
    };
  }

  const situacao = await verificarDominio(dominio);
  if (situacao === 'SEM_MX') return { resultado: 'INVALIDO', motivo: 'DOMINIO_SEM_MX' };
  if (situacao === 'TEMPORARIO') return { resultado: 'TEMPORARIO', motivo: 'DNS_INDISPONIVEL' };
  return null;
}
