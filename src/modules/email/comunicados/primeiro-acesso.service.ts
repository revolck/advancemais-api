import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { MAX_CURRICULOS } from '@/modules/candidatos/curriculos/services';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { gerarSenhaProvisoria } from '@/modules/usuarios/utils/senha-provisoria';
import { recordUserAuditEvent } from '@/modules/usuarios/utils/user-history';
import { EmailDispatcher } from '../client/email-dispatcher';
import { EmailConfigManager } from '../config/email-config';
import { EmailTemplates } from '../templates/email-templates';
import { carregarValidacoes, liberadoParaEnvio, normalizarEmail } from '../validacao';

export const COMUNICADO_PRIMEIRO_ACESSO = 'PRIMEIRO_ACESSO_NOVA_PLATAFORMA_2026';
/** Etiqueta na Brevo: separa as estatísticas do comunicado dos e-mails do sistema */
export const TAG_COMUNICADO = 'comunicado-primeiro-acesso';
export const MAX_TENTATIVAS = 3;
/** Devolução temporária (soft bounce): no máximo 2 envios no total, com 48h de intervalo */
export const MAX_TENTATIVAS_DEVOLUCAO_TEMPORARIA = 2;
/** Mínimo de envios na janela antes de avaliar a taxa de devolução */
export const MINIMO_PARA_AVALIAR_DEVOLUCAO = 50;
/** A pausa olha só os envios recentes, para poder retomar depois de limpar a lista */
export const JANELA_DEVOLUCAO_HORAS = 24;

const HORA_MS = 3600_000;
const ESPERA_FALHA_MS = 1 * HORA_MS;
const ESPERA_DEVOLUCAO_TEMPORARIA_MS = 48 * HORA_MS;
/** Envio em PROCESSANDO há mais tempo que isso foi interrompido no meio (ex.: reinício) */
const PROCESSANDO_TRAVADO_MS = 30 * 60_000;

const log = logger.child({ module: 'ComunicadoPrimeiroAcesso' });

export type StatusEnvio =
  | 'PROCESSANDO'
  | 'ENVIADO'
  | 'DEVOLVIDO'
  | 'DEVOLUCAO_TEMPORARIA'
  | 'FALHA'
  | 'INCERTO'
  | 'DESCARTADO'
  | 'REABERTO'
  | 'REVOGADO'
  /** O aluno definiu a própria senha pela recuperação (CPF): já tem acesso */
  | 'CONCLUIDO_PELO_ALUNO';

/** Já atendidos ou à espera de decisão humana: o ciclo automático não envia de novo */
const STATUS_CONCLUIDOS: StatusEnvio[] = [
  'PROCESSANDO',
  'ENVIADO',
  'DEVOLVIDO',
  'INCERTO',
  'DESCARTADO',
  'REVOGADO',
  'CONCLUIDO_PELO_ALUNO',
];
/** Podem receber nova tentativa, respeitando espera e limite */
const STATUS_REPROCESSAVEIS: StatusEnvio[] = ['FALHA', 'DEVOLUCAO_TEMPORARIA', 'REABERTO'];

/** Falhas do provedor (não do destinatário): interrompem o lote e tentam no próximo ciclo */
const FALHAS_DO_PROVEDOR = new Set([
  'DAILY_LIMIT_REACHED',
  'NO_PROVIDER_AVAILABLE',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'IP_NOT_AUTHORIZED',
  'AUTHENTICATION_FAILED',
  'CONNECTION_FAILED',
  'BREVO_NOT_CONFIGURED',
  'SMTP_NOT_CONFIGURED',
  'SIMULATED',
]);

const chaveEnvio = (usuarioId: string) => ({
  comunicado_usuarioId: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId },
});

/** Público do comunicado: alunos migrados, ativos e com e-mail real */
export function filtroPopulacao(): Prisma.UsuariosWhereInput {
  return {
    role: 'ALUNO_CANDIDATO',
    status: 'ATIVO',
    authId: { startsWith: 'migracao-aluno-' },
    NOT: { email: { endsWith: '@sem-email.local' } },
  };
}

/** Público que ainda pode receber o comunicado agora */
export function filtroElegiveis(agora = new Date()): Prisma.UsuariosWhereInput {
  return {
    ...filtroPopulacao(),
    // Quem já entrou na plataforma nova tem acesso: a senha dele nunca é trocada
    ultimoLogin: null,
    ComunicadosEnvios: {
      none: {
        comunicado: COMUNICADO_PRIMEIRO_ACESSO,
        OR: [
          { status: { in: STATUS_CONCLUIDOS } },
          { tentativas: { gte: MAX_TENTATIVAS } },
          { status: 'FALHA', atualizadoEm: { gt: new Date(agora.getTime() - ESPERA_FALHA_MS) } },
          {
            status: 'DEVOLUCAO_TEMPORARIA',
            OR: [
              {
                atualizadoEm: {
                  gt: new Date(agora.getTime() - ESPERA_DEVOLUCAO_TEMPORARIA_MS),
                },
              },
              { tentativas: { gte: MAX_TENTATIVAS_DEVOLUCAO_TEMPORARIA } },
            ],
          },
        ],
      },
    },
  };
}

/**
 * Reserva o aluno antes do envio (compare-and-set no banco). Garante que dois
 * ciclos, ou duas instâncias da API, nunca enviem para o mesmo aluno.
 * Retorna null se outro processo já reservou ou se o aluno não pode ser reprocessado.
 */
async function reservarEnvio(
  usuarioId: string,
  email: string,
): Promise<{ anterior: StatusEnvio | null } | null> {
  const existente = await prisma.comunicadosEnvios.findUnique({
    where: chaveEnvio(usuarioId),
    select: { status: true },
  });

  if (!existente) {
    try {
      await prisma.comunicadosEnvios.create({
        data: {
          comunicado: COMUNICADO_PRIMEIRO_ACESSO,
          usuarioId,
          email,
          status: 'PROCESSANDO',
          tentativas: 0,
        },
      });
      return { anterior: null };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  const anterior = existente.status as StatusEnvio;
  if (!STATUS_REPROCESSAVEIS.includes(anterior)) return null;
  const { count } = await prisma.comunicadosEnvios.updateMany({
    where: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId, status: anterior },
    data: { status: 'PROCESSANDO' },
  });
  return count === 1 ? { anterior } : null;
}

async function desfazerReserva(usuarioId: string, anterior: StatusEnvio | null) {
  const where = { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId, status: 'PROCESSANDO' };
  if (anterior === null) {
    await prisma.comunicadosEnvios.deleteMany({ where });
  } else {
    await prisma.comunicadosEnvios.updateMany({ where, data: { status: anterior } });
  }
}

async function concluirEnvio(
  usuarioId: string,
  email: string,
  data: {
    status: 'ENVIADO' | 'FALHA' | 'INCERTO';
    provider?: string | null;
    messageId?: string | null;
    erro?: string | null;
    agora: Date;
  },
) {
  await prisma.comunicadosEnvios.update({
    where: chaveEnvio(usuarioId),
    data: {
      email,
      status: data.status,
      tentativas: { increment: 1 },
      provider: data.provider ?? null,
      messageId: data.messageId ?? null,
      erro: data.erro?.slice(0, 500) ?? null,
      ...(data.status === 'ENVIADO' ? { enviadoEm: data.agora, entregueEm: null } : {}),
    },
  });
}

/** Links do comunicado (plataforma, cursos, vagas, currículo e mídia) */
export async function montarLinks() {
  const config = await EmailConfigManager.getInstance().getRuntimeConfig();
  const frontendUrl = config.urls.frontend.replace(/\/$/, '');
  const authUrl = config.urls.verification.replace(/\/verify-email$/, '');
  return {
    platformUrl: `${authUrl}/login`,
    coursesUrl: `${frontendUrl}/cursos`,
    jobsUrl: `${frontendUrl}/vagas`,
    resumeUrl: `${frontendUrl}/dashboard/curriculo`,
    heroImageUrl: `${frontendUrl}/images/emails/nova-plataforma.gif`,
    videoUrl: `${frontendUrl}/images/emails/novo-site-advancemais.mp4`,
  };
}

export interface ResultadoLote {
  processados: number;
  enviados: number;
  falhas: number;
  incertos: number;
  /** Elegíveis que não foram enviados porque o endereço não está validado */
  naoValidados: number;
  interrompidoPor: string | null;
}

export const resultadoVazio = (interrompidoPor: string | null = null): ResultadoLote => ({
  processados: 0,
  enviados: 0,
  falhas: 0,
  incertos: 0,
  naoValidados: 0,
  interrompidoPor,
});

/**
 * Envia o comunicado para até `limite` alunos elegíveis cujo e-mail está VALIDADO.
 * Para cada um: reserva, gera a senha provisória individual, envia e registra.
 * Se o envio falhar, a senha anterior é restaurada (ninguém fica com uma senha que não recebeu).
 */
export async function processarLote(
  limite: number,
  opcoes: { agora?: Date; usuarioIds?: string[] } = {},
): Promise<ResultadoLote> {
  const agora = opcoes.agora ?? new Date();
  const resultado = resultadoVazio();
  if (limite <= 0) return resultado;

  const candidatos = await prisma.usuarios.findMany({
    where: {
      ...filtroElegiveis(agora),
      ...(opcoes.usuarioIds ? { id: { in: opcoes.usuarioIds } } : {}),
    },
    select: { id: true, email: true },
    orderBy: { criadoEm: 'asc' },
  });
  const validacoes = await carregarValidacoes(candidatos.map((c) => c.email));
  const liberados = candidatos.filter((c) =>
    liberadoParaEnvio(validacoes.get(normalizarEmail(c.email)), agora),
  );
  resultado.naoValidados = candidatos.length - liberados.length;
  const selecionados = liberados.slice(0, limite).map((c) => c.id);
  if (selecionados.length === 0) return resultado;

  const usuarios = await prisma.usuarios.findMany({
    where: { id: { in: selecionados } },
    select: {
      id: true,
      email: true,
      cpf: true,
      nomeCompleto: true,
      senha: true,
      precisaTrocarSenha: true,
      senhaProvisoriaEm: true,
    },
    orderBy: { criadoEm: 'asc' },
  });

  const links = await montarLinks();
  const dispatcher = EmailDispatcher.getInstance();

  for (const usuario of usuarios) {
    const email = normalizarEmail(usuario.email);
    const reserva = await reservarEnvio(usuario.id, email);
    if (!reserva) continue; // outro ciclo/instância já cuidou deste aluno
    resultado.processados += 1;

    const senhaProvisoria = gerarSenhaProvisoria();
    const senhaHash = await bcrypt.hash(senhaProvisoria, 12);
    const definidaEm = new Date();

    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: {
        senha: senhaHash,
        precisaTrocarSenha: true,
        senhaProvisoriaEm: definidaEm,
        atualizadoEm: definidaEm,
      },
    });

    const template = EmailTemplates.generatePlatformWelcomeEmail({
      nomeCompleto: usuario.nomeCompleto,
      ...links,
      maxCurriculos: MAX_CURRICULOS,
      primeiroAcesso: { cpf: usuario.cpf ?? '', senhaProvisoria },
    });

    const envio = await dispatcher.send(
      {
        to: email,
        toName: usuario.nomeCompleto,
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: [TAG_COMUNICADO],
      },
      { channel: 'marketing' },
    );

    if (envio.success && !envio.simulated) {
      await concluirEnvio(usuario.id, email, {
        status: 'ENVIADO',
        provider: envio.provider,
        messageId: envio.messageId,
        agora: definidaEm,
      });
      await recordUserAuditEvent({
        client: prisma,
        targetUserId: usuario.id,
        action: 'USUARIO_SENHA_PROVISORIA_DEFINIDA',
        descricao:
          'Senha provisória individual enviada no comunicado da nova plataforma; troca obrigatória no próximo login.',
        meta: {
          origem: 'COMUNICADO_PRIMEIRO_ACESSO',
          comunicado: COMUNICADO_PRIMEIRO_ACESSO,
          provider: envio.provider ?? null,
          messageId: envio.messageId ?? null,
        },
      });
      await invalidateUserCache(usuario.id);
      resultado.enviados += 1;
      continue;
    }

    if (envio.deliveryUncertain) {
      // Pode ter chegado: mantém a senha nova e não reenvia automaticamente
      await concluirEnvio(usuario.id, email, {
        status: 'INCERTO',
        provider: envio.provider,
        erro: envio.error ?? envio.failureReason ?? 'Entrega incerta',
        agora: definidaEm,
      });
      await invalidateUserCache(usuario.id);
      resultado.incertos += 1;
      continue;
    }

    // Não enviado: restaura a senha anterior
    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: {
        senha: usuario.senha,
        precisaTrocarSenha: usuario.precisaTrocarSenha,
        senhaProvisoriaEm: usuario.senhaProvisoriaEm,
      },
    });
    await invalidateUserCache(usuario.id);

    const motivo = envio.simulated ? 'SIMULATED' : (envio.failureReason ?? 'SEND_FAILED');
    if (FALHAS_DO_PROVEDOR.has(motivo)) {
      await desfazerReserva(usuario.id, reserva.anterior);
      resultado.processados -= 1;
      resultado.interrompidoPor = motivo;
      log.warn(
        { motivo },
        '⏸️ Comunicado interrompido: problema no provedor, retoma no próximo ciclo',
      );
      break;
    }

    await concluirEnvio(usuario.id, email, {
      status: 'FALHA',
      provider: envio.provider,
      erro: `${motivo}: ${envio.error ?? ''}`,
      agora: definidaEm,
    });
    resultado.falhas += 1;
  }

  return resultado;
}

/**
 * Envio que ficou em PROCESSANDO (servidor caiu no meio): não dá para saber se o
 * e-mail saiu. Vira INCERTO para revisão; nunca é reenviado automaticamente.
 */
export async function recuperarEnviosTravados(agora = new Date()): Promise<number> {
  const { count } = await prisma.comunicadosEnvios.updateMany({
    where: {
      comunicado: COMUNICADO_PRIMEIRO_ACESSO,
      status: 'PROCESSANDO',
      atualizadoEm: { lt: new Date(agora.getTime() - PROCESSANDO_TRAVADO_MS) },
    },
    data: { status: 'INCERTO', erro: 'Envio interrompido no meio do processamento' },
  });
  if (count > 0) log.warn({ count }, '⚠️ Envios travados em PROCESSANDO marcados como INCERTO');
  return count;
}

/**
 * Quando o e-mail do aluno foi corrigido (aqui ou no cadastro do admin), o envio
 * anterior deixa de valer e o aluno volta para a fila, passando pela validação.
 * Quem já trocou a senha provisória não recebe de novo.
 */
export async function reabrirEmailsCorrigidos(usuarioIds?: string[]): Promise<number> {
  const envios = await prisma.comunicadosEnvios.findMany({
    where: {
      comunicado: COMUNICADO_PRIMEIRO_ACESSO,
      status: {
        in: [
          'ENVIADO',
          'DEVOLVIDO',
          'DEVOLUCAO_TEMPORARIA',
          'FALHA',
          'INCERTO',
          'DESCARTADO',
          'REVOGADO',
        ],
      },
      ...(usuarioIds ? { usuarioId: { in: usuarioIds } } : {}),
    },
    select: {
      id: true,
      email: true,
      status: true,
      Usuario: { select: { email: true, precisaTrocarSenha: true } },
    },
  });

  let reabertos = 0;
  for (const envio of envios) {
    if (normalizarEmail(envio.Usuario.email) === normalizarEmail(envio.email)) continue;
    if (envio.status === 'ENVIADO' && !envio.Usuario.precisaTrocarSenha) continue;
    await prisma.comunicadosEnvios.update({
      where: { id: envio.id },
      data: {
        status: 'REABERTO',
        tentativas: 0,
        erro: `E-mail corrigido; envio anterior: ${envio.status}`,
      },
    });
    reabertos += 1;
  }
  if (reabertos > 0) log.info({ reabertos }, '🔁 Alunos com e-mail corrigido voltaram para a fila');
  return reabertos;
}

/**
 * Invalida a senha provisória de quem ainda não a trocou (ex.: e-mail entregue em
 * domínio com erro de digitação, que pode ser de terceiros). O aluno só volta a ter
 * acesso pelo fluxo seguro: e-mail corrigido + novo comunicado, ou recuperação de senha.
 */
export async function revogarSenhaProvisoria(
  usuarioId: string,
  contexto: {
    motivo: string;
    actorId?: string | null;
    actorRole?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  },
) {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: { id: true, precisaTrocarSenha: true },
  });
  if (!usuario) {
    throw Object.assign(new Error('Aluno não encontrado'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (!usuario.precisaTrocarSenha) {
    throw Object.assign(new Error('O aluno já trocou a senha provisória; nada a revogar'), {
      statusCode: 409,
      code: 'SENHA_JA_TROCADA',
    });
  }

  // Senha aleatória descartada na hora: ninguém a conhece
  const senhaInutilizavel = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  await prisma.usuarios.update({
    where: { id: usuarioId },
    data: {
      senha: senhaInutilizavel,
      senhaProvisoriaEm: null,
      refreshToken: null,
      atualizadoEm: new Date(),
    },
  });
  await prisma.comunicadosEnvios.updateMany({
    where: {
      comunicado: COMUNICADO_PRIMEIRO_ACESSO,
      usuarioId,
      status: { not: 'PROCESSANDO' },
    },
    data: {
      status: 'REVOGADO',
      erro: `Senha provisória revogada: ${contexto.motivo}`.slice(0, 500),
    },
  });
  await recordUserAuditEvent({
    client: prisma,
    actorId: contexto.actorId ?? null,
    actorRole: contexto.actorRole ?? null,
    targetUserId: usuarioId,
    action: 'USUARIO_SENHA_RESETADA',
    descricao: `Senha provisória do comunicado revogada (${contexto.motivo}). Acesso só após correção do e-mail e novo envio.`,
    meta: { origem: 'COMUNICADO_PRIMEIRO_ACESSO', comunicado: COMUNICADO_PRIMEIRO_ACESSO },
    ip: contexto.ip ?? null,
    userAgent: contexto.userAgent ?? null,
  });
  await invalidateUserCache(usuarioId);
}

// ---------------------------------------------------------------------------
// Aquecimento (rampa diária) e taxa de devolução
// ---------------------------------------------------------------------------

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data (AAAA-MM-DD) no fuso de Brasília */
export const diaBrasilia = (data: Date) => formatoDia.format(data);

/** Brasília não tem horário de verão desde 2019 (UTC-3 fixo) */
export const inicioDoDiaBrasilia = (agora: Date) =>
  new Date(`${diaBrasilia(agora)}T00:00:00-03:00`);

/** Limite do dia: começa em `rampaInicial` e dobra a cada dia anterior com envio */
export function limiteDiarioRampa(rampaInicial: number, maxDiario: number, diasAnteriores: number) {
  return Math.min(maxDiario, rampaInicial * 2 ** Math.min(diasAnteriores, 20));
}

export async function situacaoRampa(
  config: { rampaInicial: number; maxDiario: number },
  agora = new Date(),
) {
  const inicioHoje = inicioDoDiaBrasilia(agora);
  const envios = await prisma.comunicadosEnvios.findMany({
    where: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, enviadoEm: { not: null } },
    select: { enviadoEm: true },
  });
  const diasAnteriores = new Set<string>();
  let enviadosHoje = 0;
  for (const { enviadoEm } of envios) {
    if (!enviadoEm) continue;
    if (enviadoEm >= inicioHoje) enviadosHoje += 1;
    else diasAnteriores.add(diaBrasilia(enviadoEm));
  }
  const limiteHoje = limiteDiarioRampa(config.rampaInicial, config.maxDiario, diasAnteriores.size);
  return {
    diasComEnvio: diasAnteriores.size,
    enviadosHoje,
    limiteHoje,
    disponivelHoje: Math.max(0, limiteHoje - enviadosHoje),
  };
}

export const inicioJanelaDevolucao = (agora = new Date()) =>
  new Date(agora.getTime() - JANELA_DEVOLUCAO_HORAS * HORA_MS);

/**
 * Envios e devoluções definitivas na janela. Usa `devolvidoEm`, que nunca é apagado:
 * corrigir o e-mail de quem voltou não "limpa" a devolução da conta.
 */
export async function contagemJanela(desde: Date) {
  const [enviados, devolvidos] = await Promise.all([
    prisma.comunicadosEnvios.count({
      where: {
        comunicado: COMUNICADO_PRIMEIRO_ACESSO,
        OR: [{ enviadoEm: { gte: desde } }, { devolvidoEm: { gte: desde } }],
      },
    }),
    prisma.comunicadosEnvios.count({
      where: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, devolvidoEm: { gte: desde } },
    }),
  ]);
  return { enviados, devolvidos };
}

/** Taxa de devolução e se o envio deve ficar pausado */
export function avaliarTaxaDevolucao(
  contagem: { enviados: number; devolvidos: number },
  maxDevolucaoPercentual: number,
) {
  const taxa = contagem.enviados > 0 ? contagem.devolvidos / contagem.enviados : 0;
  return {
    ...contagem,
    taxaPercentual: Math.round(taxa * 1000) / 10,
    pausado:
      contagem.enviados >= MINIMO_PARA_AVALIAR_DEVOLUCAO && taxa * 100 > maxDevolucaoPercentual,
  };
}

/**
 * Quando a pausa por devolução termina se nada mais for enviado: o momento em que
 * envios suficientes saem da janela de 24h.
 */
export async function previsaoFimDaPausa(maxDevolucao: number, agora = new Date()) {
  const desde = inicioJanelaDevolucao(agora);
  const linhas = await prisma.comunicadosEnvios.findMany({
    where: {
      comunicado: COMUNICADO_PRIMEIRO_ACESSO,
      OR: [{ enviadoEm: { gte: desde } }, { devolvidoEm: { gte: desde } }],
    },
    select: { enviadoEm: true, devolvidoEm: true },
  });
  const janelaMs = JANELA_DEVOLUCAO_HORAS * HORA_MS;
  const momentos = linhas
    .flatMap((linha) => [linha.enviadoEm, linha.devolvidoEm])
    .filter((data): data is Date => data instanceof Date && data >= desde)
    .map((data) => data.getTime() + janelaMs)
    .sort((a, b) => a - b);

  for (const momento of momentos) {
    const inicio = momento - janelaMs;
    // No instante `momento` o envio que o gerou acabou de sair da janela
    const naJanela = (data: Date | null) => data instanceof Date && data.getTime() > inicio;
    const enviados = linhas.filter(
      (linha) => naJanela(linha.enviadoEm) || naJanela(linha.devolvidoEm),
    ).length;
    const devolvidos = linhas.filter((linha) => naJanela(linha.devolvidoEm)).length;
    if (!avaliarTaxaDevolucao({ enviados, devolvidos }, maxDevolucao).pausado) {
      return new Date(momento);
    }
  }
  return null;
}
