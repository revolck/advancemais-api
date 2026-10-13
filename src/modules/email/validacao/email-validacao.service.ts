import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';
import { criarValidadorExterno } from './provedores';
import { verificarLocalmente } from './verificacao-local';
import {
  ErroValidador,
  type FonteValidacao,
  type ResultadoValidacao,
  type ValidacaoEmail,
} from './tipos';

/** Um VALIDO antigo é conferido de novo antes de receber outro envio */
export const VALIDADE_VALIDO_DIAS = 30;
/** TEMPORARIO vira DESCONHECIDO (revisão manual) depois desse número de tentativas */
export const MAX_TENTATIVAS_TEMPORARIO = 3;
const ESPERA_TEMPORARIO_HORAS = 6;
const CONCORRENCIA = 4;
const DIA_MS = 24 * 60 * 60 * 1000;

const log = logger.child({ module: 'EmailValidacao' });

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

export interface RegistroValidacao {
  email: string;
  resultado: string;
  fonte: string;
  motivo: string | null;
  sugestao: string | null;
  tentativas: number;
  validadoEm: Date;
  proximaTentativaEm: Date | null;
}

/** Devolução ou bloqueio real na Brevo: nenhum validador pode liberar o endereço de novo */
export const ehBloqueioDefinitivo = (registro: Pick<RegistroValidacao, 'fonte' | 'resultado'>) =>
  registro.fonte === 'BREVO' &&
  (registro.resultado === 'INVALIDO' || registro.resultado === 'BLOQUEADO');

/** Endereço apto a receber envio automático */
export function liberadoParaEnvio(registro: RegistroValidacao | undefined, agora = new Date()) {
  return (
    registro?.resultado === 'VALIDO' &&
    agora.getTime() - registro.validadoEm.getTime() <= VALIDADE_VALIDO_DIAS * DIA_MS
  );
}

export function precisaValidar(
  registro: RegistroValidacao | undefined,
  agora: Date,
  temValidadorExterno: boolean,
): boolean {
  if (!registro) return true;
  if (ehBloqueioDefinitivo(registro)) return false;
  switch (registro.resultado) {
    case 'TEMPORARIO':
      return !registro.proximaTentativaEm || registro.proximaTentativaEm <= agora;
    case 'PENDENTE':
      return temValidadorExterno;
    case 'VALIDO':
      return !liberadoParaEnvio(registro, agora);
    default:
      // INVALIDO, RISCO, DESCONHECIDO e BLOQUEADO dependem de correção ou revisão humana
      return false;
  }
}

export async function carregarValidacoes(
  emails: string[],
): Promise<Map<string, RegistroValidacao>> {
  const unicos = [...new Set(emails.map(normalizarEmail))];
  if (unicos.length === 0) return new Map();
  const registros = await prisma.emailsValidacoes.findMany({
    where: { email: { in: unicos } },
    select: {
      email: true,
      resultado: true,
      fonte: true,
      motivo: true,
      sugestao: true,
      tentativas: true,
      validadoEm: true,
      proximaTentativaEm: true,
    },
  });
  return new Map(registros.map((registro) => [registro.email, registro]));
}

async function salvarValidacao(
  email: string,
  validacao: ValidacaoEmail,
  fonte: FonteValidacao,
  anterior: RegistroValidacao | undefined,
  agora: Date,
): Promise<ResultadoValidacao> {
  let resultado = validacao.resultado;
  let motivo = validacao.motivo;
  let proximaTentativaEm: Date | null = null;
  const tentativas = anterior?.resultado === 'TEMPORARIO' ? anterior.tentativas + 1 : 1;

  if (resultado === 'TEMPORARIO') {
    if (tentativas >= MAX_TENTATIVAS_TEMPORARIO) {
      resultado = 'DESCONHECIDO';
      motivo = `${motivo} (sem conclusão após ${tentativas} tentativas)`;
    } else {
      proximaTentativaEm = new Date(
        agora.getTime() + ESPERA_TEMPORARIO_HORAS * tentativas * 3600_000,
      );
    }
  }

  const dados = {
    resultado,
    fonte,
    motivo: motivo.slice(0, 255),
    sugestao: validacao.sugestao?.slice(0, 255) ?? null,
    tentativas,
    detalhes: (validacao.detalhes ?? undefined) as object | undefined,
    validadoEm: agora,
    proximaTentativaEm,
  };
  await prisma.emailsValidacoes.upsert({
    where: { email },
    create: { email, ...dados },
    update: dados,
  });
  return resultado;
}

export interface ResumoValidacao {
  provedor: string | null;
  processados: number;
  porResultado: Partial<Record<ResultadoValidacao, number>>;
  interrompidoPor: string | null;
  erro: string | null;
}

/**
 * Valida os endereços que ainda precisam (checagem local + validador externo).
 * Falha do validador interrompe o lote sem classificar ninguém como válido.
 */
export async function validarEmails(
  emails: string[],
  opcoes: { agora?: Date; limite?: number } = {},
): Promise<ResumoValidacao> {
  const agora = opcoes.agora ?? new Date();
  const config = await runtimeConfigService.getEmailValidacaoConfig();
  const validador = criarValidadorExterno(config.provedor, config.apiKey);
  const resumo: ResumoValidacao = {
    provedor: validador ? validador.fonte : null,
    processados: 0,
    porResultado: {},
    interrompidoPor: null,
    erro: null,
  };

  const unicos = [...new Set(emails.map(normalizarEmail))];
  const existentes = await carregarValidacoes(unicos);
  const fila = unicos
    .filter((email) => precisaValidar(existentes.get(email), agora, Boolean(validador)))
    .slice(0, opcoes.limite ?? unicos.length);

  let indice = 0;
  let parar = false;
  const worker = async () => {
    while (!parar && indice < fila.length) {
      const email = fila[indice++];
      try {
        const local = await verificarLocalmente(email);
        let validacao: ValidacaoEmail;
        let fonte: FonteValidacao = 'LOCAL';
        if (local) {
          validacao = local;
        } else if (!validador) {
          validacao = { resultado: 'PENDENTE', motivo: 'AGUARDANDO_VALIDADOR_EXTERNO' };
        } else {
          validacao = await validador.validar(email);
          fonte = validador.fonte;
        }
        const resultado = await salvarValidacao(
          email,
          validacao,
          fonte,
          existentes.get(email),
          agora,
        );
        resumo.processados += 1;
        resumo.porResultado[resultado] = (resumo.porResultado[resultado] ?? 0) + 1;
      } catch (error) {
        if (error instanceof ErroValidador) {
          parar = true;
          resumo.interrompidoPor = error.codigo;
          resumo.erro = error.message;
          log.warn({ codigo: error.codigo }, '⏸️ Validação de e-mails interrompida');
          return;
        }
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, worker));
  return resumo;
}

export interface SinalBrevo {
  email: string;
  resultado: 'INVALIDO' | 'BLOQUEADO';
  motivo: string;
}

/**
 * Registra sinais negativos reais da Brevo (devolução definitiva, bloqueio, denúncia).
 * Têm precedência sobre qualquer validação anterior. Retorna quantos endereços mudaram.
 */
export async function registrarSinaisBrevo(
  sinais: SinalBrevo[],
  agora = new Date(),
): Promise<number> {
  const porEmail = new Map<string, SinalBrevo>();
  for (const sinal of sinais) {
    const email = normalizarEmail(sinal.email);
    if (!email.includes('@')) continue;
    // INVALIDO (caixa inexistente) prevalece sobre BLOQUEADO para o mesmo endereço
    const atual = porEmail.get(email);
    if (!atual || (atual.resultado === 'BLOQUEADO' && sinal.resultado === 'INVALIDO')) {
      porEmail.set(email, { ...sinal, email });
    }
  }
  if (porEmail.size === 0) return 0;

  const existentes = await carregarValidacoes([...porEmail.keys()]);
  let alterados = 0;
  for (const sinal of porEmail.values()) {
    const anterior = existentes.get(sinal.email);
    if (anterior?.fonte === 'BREVO' && anterior.resultado === sinal.resultado) continue;
    const dados = {
      resultado: sinal.resultado,
      fonte: 'BREVO',
      motivo: sinal.motivo.slice(0, 255),
      validadoEm: agora,
      proximaTentativaEm: null,
    };
    await prisma.emailsValidacoes.upsert({
      where: { email: sinal.email },
      create: { email: sinal.email, ...dados },
      update: dados,
    });
    alterados += 1;
  }
  return alterados;
}
