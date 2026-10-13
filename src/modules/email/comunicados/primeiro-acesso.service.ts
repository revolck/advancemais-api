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
import { EmailDispatcher } from '../client/email-dispatcher';
import { EmailConfigManager } from '../config/email-config';
import { EmailTemplates } from '../templates/email-templates';

export const COMUNICADO_PRIMEIRO_ACESSO = 'PRIMEIRO_ACESSO_NOVA_PLATAFORMA_2026';
export const MAX_TENTATIVAS = 3;

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
          { status: { in: ['ENVIADO', 'DESCARTADO', 'INCERTO'] } },
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
  const [config, restantes, porStatus] = await Promise.all([
    runtimeConfigService.getComunicadoPrimeiroAcessoConfig(),
    prisma.usuarios.count({ where: filtroElegiveis() }),
    prisma.comunicadosEnvios.groupBy({
      by: ['status'],
      where: { comunicado: COMUNICADO_PRIMEIRO_ACESSO },
      _count: { _all: true },
    }),
  ]);
  const contagem = Object.fromEntries(porStatus.map((item) => [item.status, item._count._all]));

  return {
    comunicado: COMUNICADO_PRIMEIRO_ACESSO,
    ativo: config.ativo,
    lotePorCiclo: config.lote,
    restantes,
    enviados: contagem.ENVIADO ?? 0,
    falhas: contagem.FALHA ?? 0,
    incertos: contagem.INCERTO ?? 0,
    descartados: contagem.DESCARTADO ?? 0,
  };
}
