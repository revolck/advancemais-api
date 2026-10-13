import { promises as dns } from 'dns';
import bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';
import { MAX_CURRICULOS } from '@/modules/candidatos/curriculos/services';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { gerarSenhaProvisoria } from '@/modules/usuarios/utils/senha-provisoria';
import { recordUserAuditEvent } from '@/modules/usuarios/utils/user-history';
import { BrevoClient } from '../client/brevo-client';
import { EmailDispatcher } from '../client/email-dispatcher';
import { EmailConfigManager } from '../config/email-config';
import { EmailTemplates } from '../templates/email-templates';

export const COMUNICADO_PRIMEIRO_ACESSO = 'PRIMEIRO_ACESSO_NOVA_PLATAFORMA_2026';
export const MAX_TENTATIVAS = 3;
/** Mínimo de envios antes de avaliar a taxa de devolução */
export const MINIMO_PARA_AVALIAR_DEVOLUCAO = 50;
/** A pausa olha só os envios recentes, para poder retomar depois de limpar a lista */
export const JANELA_DEVOLUCAO_HORAS = 24;
/** Eventos da Brevo que indicam que o e-mail não chegou (ou gerou reclamação) */
const EVENTOS_DEVOLUCAO = ['hardBounces', 'invalid', 'blocked', 'spam'];

const log = logger.child({ module: 'ComunicadoPrimeiroAcesso' });

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

/** Alunos migrados, ativos, com e-mail real e que ainda não foram concluídos */
export function filtroElegiveis(): Prisma.UsuariosWhereInput {
  return {
    role: 'ALUNO_CANDIDATO',
    status: 'ATIVO',
    authId: { startsWith: 'migracao-aluno-' },
    NOT: { email: { endsWith: '@sem-email.local' } },
    ComunicadosEnvios: {
      none: {
        comunicado: COMUNICADO_PRIMEIRO_ACESSO,
        OR: [
          { status: { in: ['ENVIADO', 'DESCARTADO', 'INCERTO', 'DEVOLVIDO'] } },
          { tentativas: { gte: MAX_TENTATIVAS } },
        ],
      },
    },
  };
}

const mxCache = new Map<string, boolean>();

/** Domínio sem servidor de e-mail gera devolução certa (e prejudica a reputação do remetente) */
export async function dominioAceitaEmail(email: string): Promise<boolean> {
  const dominio = email.split('@')[1]?.toLowerCase();
  if (!dominio) return false;
  const cached = mxCache.get(dominio);
  if (cached !== undefined) return cached;

  let aceita = true;
  try {
    const mx = await dns.resolveMx(dominio);
    aceita = mx.length > 0;
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Só descarta quando o DNS afirma que não existe; timeout/erro temporário não descarta
    aceita = !(code === 'ENOTFOUND' || code === 'ENODATA');
  }
  mxCache.set(dominio, aceita);
  return aceita;
}

/** Apenas para testes */
export function limparCacheMx(): void {
  mxCache.clear();
}

async function registrarEnvio(
  usuarioId: string,
  email: string,
  data: {
    status: 'ENVIADO' | 'FALHA' | 'INCERTO' | 'DESCARTADO';
    contarTentativa: boolean;
    provider?: string | null;
    messageId?: string | null;
    erro?: string | null;
  },
) {
  const now = new Date();
  await prisma.comunicadosEnvios.upsert({
    where: { comunicado_usuarioId: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, usuarioId } },
    create: {
      comunicado: COMUNICADO_PRIMEIRO_ACESSO,
      usuarioId,
      email,
      status: data.status,
      tentativas: data.contarTentativa ? 1 : 0,
      provider: data.provider ?? null,
      messageId: data.messageId ?? null,
      erro: data.erro?.slice(0, 500) ?? null,
      enviadoEm: data.status === 'ENVIADO' ? now : null,
    },
    update: {
      email,
      status: data.status,
      tentativas: data.contarTentativa ? { increment: 1 } : undefined,
      provider: data.provider ?? null,
      messageId: data.messageId ?? null,
      erro: data.erro?.slice(0, 500) ?? null,
      enviadoEm: data.status === 'ENVIADO' ? now : undefined,
    },
  });
}

async function montarLinks() {
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
  descartados: number;
  interrompidoPor: string | null;
}

/**
 * Processa um lote: para cada aluno elegível gera a senha provisória individual,
 * envia o comunicado e registra o resultado. Se o envio falhar, a senha anterior
 * é restaurada (ninguém fica com uma senha que não recebeu).
 */
export async function processarLote(limite: number): Promise<ResultadoLote> {
  const resultado: ResultadoLote = {
    processados: 0,
    enviados: 0,
    falhas: 0,
    incertos: 0,
    descartados: 0,
    interrompidoPor: null,
  };

  const usuarios = await prisma.usuarios.findMany({
    where: filtroElegiveis(),
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
    take: limite,
  });
  if (usuarios.length === 0) return resultado;

  const links = await montarLinks();
  const dispatcher = EmailDispatcher.getInstance();

  for (const usuario of usuarios) {
    resultado.processados += 1;
    const email = usuario.email.trim().toLowerCase();

    if (!(await dominioAceitaEmail(email))) {
      await registrarEnvio(usuario.id, email, {
        status: 'DESCARTADO',
        contarTentativa: false,
        erro: 'DOMINIO_SEM_MX: o domínio do e-mail não recebe mensagens',
      });
      resultado.descartados += 1;
      continue;
    }

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
      },
      { channel: 'marketing' },
    );

    if (envio.success && !envio.simulated) {
      await registrarEnvio(usuario.id, email, {
        status: 'ENVIADO',
        contarTentativa: true,
        provider: envio.provider,
        messageId: envio.messageId,
      });
      await recordUserAuditEvent({
        client: prisma,
        targetUserId: usuario.id,
        action: 'USUARIO_SENHA_PROVISORIA_DEFINIDA',
        descricao:
          'Senha provisória individual enviada no comunicado da nova plataforma; troca obrigatória no próximo login.',
        meta: { origem: 'COMUNICADO_PRIMEIRO_ACESSO', comunicado: COMUNICADO_PRIMEIRO_ACESSO },
      });
      await invalidateUserCache(usuario.id);
      resultado.enviados += 1;
      continue;
    }

    if (envio.deliveryUncertain) {
      // Pode ter chegado: mantém a senha nova e não reenvia automaticamente
      await registrarEnvio(usuario.id, email, {
        status: 'INCERTO',
        contarTentativa: true,
        provider: envio.provider,
        erro: envio.error ?? envio.failureReason ?? 'Entrega incerta',
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
      resultado.processados -= 1;
      resultado.interrompidoPor = motivo;
      log.warn(
        { motivo },
        '⏸️ Comunicado interrompido: problema no provedor, retoma no próximo ciclo',
      );
      break;
    }

    await registrarEnvio(usuario.id, email, {
      status: 'FALHA',
      contarTentativa: true,
      provider: envio.provider,
      erro: `${motivo}: ${envio.error ?? ''}`,
    });
    resultado.falhas += 1;
  }

  return resultado;
}

export async function obterProgresso() {
  const [config, restantes, contagem, contagemRecente] = await Promise.all([
    runtimeConfigService.getComunicadoPrimeiroAcessoConfig(),
    prisma.usuarios.count({ where: filtroElegiveis() }),
    contagemPorStatus(),
    contagemPorStatus(inicioJanelaDevolucao()),
  ]);
  const total = avaliarTaxaDevolucao(contagem, config.maxDevolucao);
  const recente = avaliarTaxaDevolucao(contagemRecente, config.maxDevolucao);

  return {
    comunicado: COMUNICADO_PRIMEIRO_ACESSO,
    ativo: config.ativo,
    lotePorCiclo: config.lote,
    restantes,
    enviados: contagem.ENVIADO ?? 0,
    devolvidos: contagem.DEVOLVIDO ?? 0,
    falhas: contagem.FALHA ?? 0,
    incertos: contagem.INCERTO ?? 0,
    descartados: contagem.DESCARTADO ?? 0,
    taxaDevolucao: total.taxaPercentual,
    taxaDevolucaoUltimas24h: recente.taxaPercentual,
    limiteDevolucao: config.maxDevolucao,
    pausadoPorDevolucao: recente.pausado,
  };
}

const normalizarMessageId = (messageId?: string | null) =>
  (messageId ?? '').trim().replace(/^<|>$/g, '').toLowerCase();

/**
 * Consulta na Brevo os eventos de devolução/bloqueio/spam dos últimos dias e marca
 * os envios correspondentes como DEVOLVIDO (o e-mail não chegou ao aluno).
 */
export async function sincronizarDevolucoes(): Promise<{ marcados: number }> {
  const brevo = BrevoClient.getInstance();
  const eventos = new Map<string, { event: string; reason?: string }>();

  for (const event of EVENTOS_DEVOLUCAO) {
    for (let offset = 0; offset < 20_000; offset += 2500) {
      const lote = await brevo.listarEventos({ event, days: 7, limit: 2500, offset });
      lote.forEach((item) =>
        eventos.set(normalizarMessageId(item.messageId), {
          event: item.event,
          reason: item.reason,
        }),
      );
      if (lote.length < 2500) break;
    }
  }
  if (eventos.size === 0) return { marcados: 0 };

  const enviados = await prisma.comunicadosEnvios.findMany({
    where: { comunicado: COMUNICADO_PRIMEIRO_ACESSO, status: 'ENVIADO', messageId: { not: null } },
    select: { id: true, messageId: true },
  });

  let marcados = 0;
  for (const envio of enviados) {
    const evento = eventos.get(normalizarMessageId(envio.messageId));
    if (!evento) continue;
    await prisma.comunicadosEnvios.update({
      where: { id: envio.id },
      data: {
        status: 'DEVOLVIDO',
        erro: `${evento.event}${evento.reason ? `: ${evento.reason}` : ''}`.slice(0, 500),
      },
    });
    marcados += 1;
  }

  if (marcados > 0)
    log.warn({ marcados }, '↩️ Envios devolvidos pela Brevo marcados como DEVOLVIDO');
  return { marcados };
}

/** Taxa de devolução do comunicado e se o envio deve ficar pausado */
export function avaliarTaxaDevolucao(
  contagem: Record<string, number>,
  maxDevolucaoPercentual: number,
) {
  const devolvidos = contagem.DEVOLVIDO ?? 0;
  const entregues = (contagem.ENVIADO ?? 0) + devolvidos;
  const taxa = entregues > 0 ? devolvidos / entregues : 0;
  return {
    devolvidos,
    entregues,
    taxaPercentual: Math.round(taxa * 1000) / 10,
    pausado: entregues >= MINIMO_PARA_AVALIAR_DEVOLUCAO && taxa * 100 > maxDevolucaoPercentual,
  };
}

export const inicioJanelaDevolucao = (agora = new Date()) =>
  new Date(agora.getTime() - JANELA_DEVOLUCAO_HORAS * 60 * 60 * 1000);

/** Envios por status; com `desde`, só os enviados a partir dessa data */
export async function contagemPorStatus(desde?: Date): Promise<Record<string, number>> {
  const porStatus = await prisma.comunicadosEnvios.groupBy({
    by: ['status'],
    where: {
      comunicado: COMUNICADO_PRIMEIRO_ACESSO,
      ...(desde ? { enviadoEm: { gte: desde } } : {}),
    },
    _count: { _all: true },
  });
  return Object.fromEntries(porStatus.map((item) => [item.status, item._count._all]));
}
