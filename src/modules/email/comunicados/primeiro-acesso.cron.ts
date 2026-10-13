import cron from 'node-cron';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { BrevoClient } from '../client/brevo-client';
import { validarEmails, type ResumoValidacao } from '../validacao';
import {
  avaliarTaxaDevolucao,
  contagemJanela,
  filtroElegiveis,
  inicioJanelaDevolucao,
  processarLote,
  reabrirEmailsCorrigidos,
  recuperarEnviosTravados,
  resultadoVazio,
  situacaoRampa,
  type ResultadoLote,
} from './primeiro-acesso.service';
import { sincronizarComBrevo, type ResultadoSincronizacao } from './primeiro-acesso.sincronizacao';

const log = logger.child({ module: 'ComunicadoPrimeiroAcessoJob' });

/** Créditos da Brevo que o comunicado nunca usa (reserva para os e-mails do sistema) */
export const RESERVA_CREDITOS_BREVO = 300;
/** Endereços validados por ciclo automático (mantém a fila de validados à frente dos envios) */
const VALIDACAO_POR_CICLO = 200;

export interface ResultadoCiclo extends ResultadoLote {
  limiteAplicado: number;
  sincronizacao: ResultadoSincronizacao | null;
  validacao: ResumoValidacao | null;
}

let emExecucao = false;
let validacaoEmExecucao = false;
let ultimaExecucao: { em: string; resultado: ResultadoCiclo } | null = null;
let ultimaSincronizacao: { em: string; ok: boolean; erro: string | null } | null = null;
let ultimaValidacao: { em: string; resumo: ResumoValidacao | null; erro: string | null } | null =
  null;

const mensagemDe = (error: unknown) =>
  error instanceof Error ? error.message.slice(0, 300) : 'Erro desconhecido';

async function sincronizar(agora: Date) {
  try {
    const resultado = await sincronizarComBrevo(agora);
    ultimaSincronizacao = { em: agora.toISOString(), ok: true, erro: null };
    return resultado;
  } catch (error) {
    ultimaSincronizacao = { em: agora.toISOString(), ok: false, erro: mensagemDe(error) };
    throw error;
  }
}

/** Valida os e-mails dos alunos ainda na fila. Retorna null se já houver validação rodando. */
async function validarElegiveis(limite: number, agora = new Date()) {
  if (validacaoEmExecucao) return null;
  validacaoEmExecucao = true;
  try {
    const elegiveis = await prisma.usuarios.findMany({
      where: filtroElegiveis(agora),
      select: { email: true },
      orderBy: { criadoEm: 'asc' },
    });
    const resumo = await validarEmails(
      elegiveis.map((usuario) => usuario.email),
      { agora, limite },
    );
    ultimaValidacao = { em: agora.toISOString(), resumo, erro: resumo.erro };
    return resumo;
  } catch (error) {
    ultimaValidacao = { em: agora.toISOString(), resumo: null, erro: mensagemDe(error) };
    throw error;
  } finally {
    validacaoEmExecucao = false;
  }
}

/** Créditos disponíveis para o comunicado (null = Brevo não informou) */
async function creditosDisponiveis(): Promise<number | null> {
  try {
    const creditos = await BrevoClient.getInstance().obterCreditosEnvio();
    return creditos === null ? null : creditos - RESERVA_CREDITOS_BREVO;
  } catch (error) {
    log.warn({ err: error }, '⚠️ Não foi possível consultar os créditos da Brevo');
    return null;
  }
}

/**
 * Um ciclo do comunicado. Qualquer dúvida (Brevo sem resposta, cota desconhecida,
 * devolução alta) para o envio; nunca "segue enviando" no escuro.
 * Retorna null se outro ciclo já estiver rodando.
 */
export async function executarCicloComunicado(
  opcoes: { limite?: number } = {},
): Promise<ResultadoCiclo | null> {
  if (emExecucao) return null;
  emExecucao = true;
  const agora = new Date();
  let sincronizacao: ResultadoSincronizacao | null = null;
  let validacao: ResumoValidacao | null = null;

  const finalizar = (lote: ResultadoLote, limiteAplicado = 0) => {
    const resultado: ResultadoCiclo = { ...lote, limiteAplicado, sincronizacao, validacao };
    ultimaExecucao = { em: agora.toISOString(), resultado };
    if (lote.processados > 0 || lote.interrompidoPor) {
      log.info(
        { ...lote, limiteAplicado, validados: validacao?.processados ?? 0 },
        '📨 Ciclo do comunicado de primeiro acesso',
      );
    }
    return resultado;
  };

  try {
    const config = await runtimeConfigService.getComunicadoPrimeiroAcessoConfig();
    await recuperarEnviosTravados(agora);

    try {
      sincronizacao = await sincronizar(agora);
    } catch (error) {
      log.error({ err: error }, '⛔ Comunicado parado: sem resposta da Brevo sobre devoluções');
      return finalizar(resultadoVazio('FALHA_SINCRONIZACAO_BREVO'));
    }

    await reabrirEmailsCorrigidos();

    const devolucao = avaliarTaxaDevolucao(
      await contagemJanela(inicioJanelaDevolucao(agora)),
      config.maxDevolucao,
    );
    if (devolucao.pausado) {
      log.warn(
        { taxa: devolucao.taxaPercentual, limite: config.maxDevolucao },
        '⏸️ Comunicado pausado: taxa de devolução acima do limite',
      );
      return finalizar(resultadoVazio('TAXA_DEVOLUCAO_ALTA'));
    }

    validacao = await validarElegiveis(VALIDACAO_POR_CICLO, agora);

    const rampa = await situacaoRampa(config, agora);
    if (rampa.disponivelHoje <= 0) return finalizar(resultadoVazio('LIMITE_DIARIO_RAMPA'));

    const creditos = await creditosDisponiveis();
    if (creditos === null) return finalizar(resultadoVazio('COTA_BREVO_DESCONHECIDA'));
    if (creditos <= 0) return finalizar(resultadoVazio('COTA_BREVO_INSUFICIENTE'));

    const limite = Math.min(opcoes.limite ?? config.lote, rampa.disponivelHoje, creditos);
    const lote = await processarLote(limite, { agora });
    if (!lote.interrompidoPor && lote.processados === 0 && lote.naoValidados > 0) {
      lote.interrompidoPor = 'SEM_ENDERECOS_VALIDADOS';
    }
    return finalizar(lote, limite);
  } finally {
    emExecucao = false;
  }
}

/**
 * Valida a fila em segundo plano (sem enviar nada). Retorna false se já houver
 * validação rodando.
 */
export function iniciarValidacaoEmSegundoPlano(limite: number): boolean {
  if (validacaoEmExecucao) return false;
  const agora = new Date();
  void (async () => {
    try {
      // Evita gastar créditos do validador com endereços que a Brevo já bloqueou
      await sincronizar(agora).catch((error) =>
        log.warn({ err: error }, '⚠️ Validação sem sincronizar com a Brevo antes'),
      );
      await validarElegiveis(limite, agora);
    } catch (error) {
      log.error({ err: error }, '❌ Erro na validação de e-mails do comunicado');
    }
  })();
  return true;
}

/** Só consulta a Brevo e atualiza devoluções/entregas; não envia nada. */
export async function sincronizarSemEnviar(): Promise<ResultadoSincronizacao> {
  const agora = new Date();
  const resultado = await sincronizar(agora);
  await reabrirEmailsCorrigidos();
  return resultado;
}

/**
 * Envia para um aluno específico (ex.: depois de o suporte corrigir o e-mail).
 * Respeita a pausa por devolução e os créditos; não depende do envio automático estar ligado.
 */
export async function enviarParaAluno(usuarioId: string): Promise<ResultadoLote | null> {
  if (emExecucao) return null;
  emExecucao = true;
  try {
    const agora = new Date();
    const config = await runtimeConfigService.getComunicadoPrimeiroAcessoConfig();
    const devolucao = avaliarTaxaDevolucao(
      await contagemJanela(inicioJanelaDevolucao(agora)),
      config.maxDevolucao,
    );
    if (devolucao.pausado) return resultadoVazio('TAXA_DEVOLUCAO_ALTA');
    const creditos = await creditosDisponiveis();
    if (creditos === null) return resultadoVazio('COTA_BREVO_DESCONHECIDA');
    if (creditos <= 0) return resultadoVazio('COTA_BREVO_INSUFICIENTE');
    return await processarLote(1, { agora, usuarioIds: [usuarioId] });
  } finally {
    emExecucao = false;
  }
}

export function getEstadoExecucao() {
  return {
    emExecucao,
    validacaoEmExecucao,
    ultimaExecucao,
    ultimaSincronizacao,
    ultimaValidacao,
  };
}

export function startComunicadoPrimeiroAcessoJob() {
  if (process.env.NODE_ENV === 'test') return;

  const schedule = process.env.COMUNICADO_PRIMEIRO_ACESSO_SCHEDULE || '*/10 * * * *';
  cron.schedule(schedule, async () => {
    try {
      const config = await runtimeConfigService.getComunicadoPrimeiroAcessoConfig();
      if (!config.ativo) return;
      await executarCicloComunicado({ limite: config.lote });
    } catch (err) {
      if (handlePrismaConnectionError(err, log, 'comunicado-primeiro-acesso')) return;
      log.error({ err }, '❌ Erro no ciclo do comunicado de primeiro acesso');
    }
  });
  log.info(
    { schedule },
    '⏱️ Comunicado de primeiro acesso agendado (liga/desliga nas configurações)',
  );
}
