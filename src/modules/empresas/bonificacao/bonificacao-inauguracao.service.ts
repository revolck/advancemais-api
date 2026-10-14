import {
  EmpresasPlanoModo,
  EmpresasPlanoOrigin,
  EmpresasPlanoStatus,
  Prisma,
  Roles,
  StatusDeVagas,
} from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { EmailConfigManager } from '@/modules/email/config/email-config';
import { EmailService } from '@/modules/email/services/email-service';
import { EmailTemplates } from '@/modules/email/templates/email-templates';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';
import { isVigente } from '../shared/planos';

/**
 * Bonificação de inauguração do novo site: 1 mês grátis do plano mais básico para
 * todas as empresas (menos as da própria Advance). Ao terminar, as vagas voltam para
 * rascunho e a empresa é avisada para contratar um plano.
 */

export const CAMPANHA_INAUGURACAO = 'INAUGURACAO_2026';
/** 14/10/2026 00:00 (Brasília) */
export const INICIO_INAUGURACAO = new Date('2026-10-14T03:00:00.000Z');
/** Válido até 14/11/2026 inclusive: termina em 15/11/2026 00:00 (Brasília) */
export const FIM_INAUGURACAO = new Date('2026-11-15T03:00:00.000Z');
export const PLANO_INAUGURACAO = 'Inicial';
/** Empresas da própria Advance: não recebem a bonificação */
export const CNPJS_EXCLUIDOS = ['25089257000192'];
/** Lembrete de fim do plano gratuito, em dias */
export const DIAS_LEMBRETE = 3;

const DIA_MS = 24 * 60 * 60 * 1000;
const log = logger.child({ module: 'BonificacaoInauguracao' });

/** Último instante de uso (para exibir "válido até dd/mm") */
export const ultimoDia = (fim: Date) => new Date(fim.getTime() - 1);

const naoExcluida: Prisma.UsuariosWhereInput = {
  OR: [{ cnpj: null }, { cnpj: { notIn: CNPJS_EXCLUIDOS } }],
};

/** Empresas ativas que ainda não têm plano ativo nem a bonificação */
export function filtroEmpresasElegiveis(): Prisma.UsuariosWhereInput {
  return {
    role: Roles.EMPRESA,
    status: 'ATIVO',
    ...naoExcluida,
    EmpresasPlano: {
      none: {
        OR: [{ status: EmpresasPlanoStatus.ATIVO }, { campanha: CAMPANHA_INAUGURACAO }],
      },
    },
  };
}

/**
 * Meses grátis lançados pelos administradores em 14/10 antes desta rotina: foram
 * gravados como assinatura paga (modo CLIENTE, próxima cobrança em 14/11), o que
 * terminaria em "cancelada por falta de pagamento". Viram o mês grátis da campanha,
 * mantendo o plano escolhido pelo admin.
 */
export function filtroConcessoesAdminDoMes(): Prisma.EmpresasPlanoWhereInput {
  return {
    origin: EmpresasPlanoOrigin.ADMIN,
    modo: EmpresasPlanoModo.CLIENTE,
    status: EmpresasPlanoStatus.ATIVO,
    campanha: null,
    mpPreapprovalId: null,
    mpSubscriptionId: null,
    mpPaymentId: null,
    inicio: { gte: INICIO_INAUGURACAO },
    proximaCobranca: {
      gte: new Date('2026-11-13T00:00:00.000Z'),
      lte: new Date('2026-11-16T00:00:00.000Z'),
    },
    Usuarios: naoExcluida,
  };
}

async function buscarPlanoInauguracao() {
  return prisma.planosEmpresariais.findFirst({
    where: { nome: { equals: PLANO_INAUGURACAO, mode: 'insensitive' } },
    select: { id: true, nome: true, quantidadeVagas: true },
  });
}

export async function previsualizarBonificacao() {
  const [plano, elegiveis, concessoesAdmin, jaBonificadas, comPlanoAtivo, excluidas] =
    await Promise.all([
      buscarPlanoInauguracao(),
      prisma.usuarios.count({ where: filtroEmpresasElegiveis() }),
      prisma.empresasPlano.count({ where: filtroConcessoesAdminDoMes() }),
      prisma.empresasPlano.count({ where: { campanha: CAMPANHA_INAUGURACAO } }),
      prisma.usuarios.count({
        where: {
          role: Roles.EMPRESA,
          status: 'ATIVO',
          ...naoExcluida,
          EmpresasPlano: { some: { status: EmpresasPlanoStatus.ATIVO, campanha: null } },
        },
      }),
      prisma.usuarios.findMany({
        where: { role: Roles.EMPRESA, cnpj: { in: CNPJS_EXCLUIDOS } },
        select: { nomeCompleto: true, cnpj: true },
      }),
    ]);

  return {
    campanha: CAMPANHA_INAUGURACAO,
    plano,
    inicio: INICIO_INAUGURACAO.toISOString(),
    validoAte: ultimoDia(FIM_INAUGURACAO).toISOString(),
    encerrada: new Date() >= FIM_INAUGURACAO,
    /** Recebem o plano ao aplicar */
    elegiveis,
    /** Meses grátis do admin (14/10) que serão convertidos */
    concessoesAdminParaConverter: concessoesAdmin,
    /** Já têm a bonificação (aplicar de novo não duplica) */
    jaBonificadas,
    /** Já têm plano ativo próprio: mantêm o plano delas (inclui as concessões do admin) */
    comPlanoAtivo: Math.max(comPlanoAtivo - concessoesAdmin, 0),
    excluidas,
  };
}

let aplicando = false;

/**
 * Aplica a bonificação. Idempotente: pode rodar de novo para pegar empresas que se
 * cadastraram depois, sem duplicar.
 */
export async function aplicarBonificacao(contexto: { actorId?: string | null } = {}) {
  if (aplicando) {
    throw Object.assign(new Error('A bonificação já está sendo aplicada'), {
      statusCode: 409,
      code: 'BONIFICACAO_EM_ANDAMENTO',
    });
  }
  if (new Date() >= FIM_INAUGURACAO) {
    throw Object.assign(new Error('A campanha de inauguração já terminou'), {
      statusCode: 409,
      code: 'CAMPANHA_ENCERRADA',
    });
  }
  const plano = await buscarPlanoInauguracao();
  if (!plano) {
    throw Object.assign(new Error(`Plano "${PLANO_INAUGURACAO}" não encontrado`), {
      statusCode: 404,
      code: 'PLANO_NAO_ENCONTRADO',
    });
  }

  aplicando = true;
  try {
    const convertidas = await prisma.empresasPlano.updateMany({
      where: filtroConcessoesAdminDoMes(),
      data: {
        modo: EmpresasPlanoModo.TESTE,
        campanha: CAMPANHA_INAUGURACAO,
        fim: FIM_INAUGURACAO,
        proximaCobranca: null,
        graceUntil: null,
        modeloPagamento: null,
        metodoPagamento: null,
        statusPagamento: null,
      },
    });

    let criadas = 0;
    for (;;) {
      const lote = await prisma.usuarios.findMany({
        where: filtroEmpresasElegiveis(),
        select: { id: true },
        take: 500,
      });
      if (lote.length === 0) break;
      const { count } = await prisma.empresasPlano.createMany({
        data: lote.map((empresa) => ({
          usuarioId: empresa.id,
          planosEmpresariaisId: plano.id,
          modo: EmpresasPlanoModo.TESTE,
          status: EmpresasPlanoStatus.ATIVO,
          origin: EmpresasPlanoOrigin.ADMIN,
          inicio: INICIO_INAUGURACAO,
          fim: FIM_INAUGURACAO,
          campanha: CAMPANHA_INAUGURACAO,
          statusPagamento: null,
        })),
      });
      criadas += count;
      if (count === 0) break;
    }

    const resultado = {
      plano: plano.nome,
      validoAte: ultimoDia(FIM_INAUGURACAO).toISOString(),
      criadas,
      convertidas: convertidas.count,
    };
    log.info(
      { ...resultado, actorId: contexto.actorId ?? null },
      '🎁 Bonificação de inauguração aplicada',
    );
    return resultado;
  } finally {
    aplicando = false;
  }
}

/** Situação da empresa logada: bonificação ativa e/ou plano gratuito que terminou */
export async function situacaoDaEmpresa(usuarioId: string, agora = new Date()) {
  const planos = await prisma.empresasPlano.findMany({
    where: { usuarioId },
    orderBy: [{ criadoEm: 'desc' }],
    take: 10,
    select: {
      id: true,
      modo: true,
      status: true,
      fim: true,
      campanha: true,
      bonificacaoExibidaEm: true,
      PlanosEmpresariais: { select: { nome: true, quantidadeVagas: true } },
    },
  });

  const vigente = planos.find((plano) => isVigente(plano.status, plano.fim, agora));
  const bonificacao =
    vigente && vigente.campanha === CAMPANHA_INAUGURACAO && vigente.fim
      ? {
          planoId: vigente.id,
          planoNome: vigente.PlanosEmpresariais.nome,
          quantidadeVagas: vigente.PlanosEmpresariais.quantidadeVagas,
          validoAte: ultimoDia(vigente.fim).toISOString(),
          exibir: !vigente.bonificacaoExibidaEm,
        }
      : null;

  const ultimoGratuito = planos.find((plano) => plano.modo === EmpresasPlanoModo.TESTE);
  const gratuitoExpirado =
    !vigente &&
    ultimoGratuito &&
    (ultimoGratuito.status === EmpresasPlanoStatus.EXPIRADO ||
      (ultimoGratuito.fim !== null && ultimoGratuito.fim <= agora))
      ? {
          planoId: ultimoGratuito.id,
          planoNome: ultimoGratuito.PlanosEmpresariais.nome,
          inauguracao: ultimoGratuito.campanha === CAMPANHA_INAUGURACAO,
          expirouEm: ultimoGratuito.fim?.toISOString() ?? null,
        }
      : null;

  return { bonificacao, gratuitoExpirado };
}

export async function marcarBonificacaoExibida(usuarioId: string) {
  const { count } = await prisma.empresasPlano.updateMany({
    where: { usuarioId, campanha: CAMPANHA_INAUGURACAO, bonificacaoExibidaEm: null },
    data: { bonificacaoExibidaEm: new Date() },
  });
  return { marcadas: count };
}

// ---------------------------------------------------------------------------
// Fim do plano gratuito (rodado pela reconciliação diária)
// ---------------------------------------------------------------------------

/**
 * E-mail só para quem já entrou na plataforma: a base importada tem muitos endereços
 * antigos, e avisar milhares de empresas que nunca acessaram geraria devoluções em massa.
 * Todas recebem o aviso dentro da plataforma.
 */
const podeReceberEmail = (usuario: { email: string; ultimoLogin: Date | null }) =>
  Boolean(usuario.ultimoLogin) && !usuario.email.toLowerCase().endsWith('.local');

async function vagasParaRascunho(usuarioId: string) {
  const { count } = await prisma.empresasVagas.updateMany({
    where: {
      usuarioId,
      status: { in: [StatusDeVagas.PUBLICADO, StatusDeVagas.EM_ANALISE, StatusDeVagas.PAUSADA] },
    },
    data: { status: StatusDeVagas.RASCUNHO },
  });
  return count;
}

async function planosUrl() {
  const config = await EmailConfigManager.getInstance().getRuntimeConfig();
  return `${config.urls.frontend.replace(/\/$/, '')}/dashboard/upgrade`;
}

const selecaoAviso = {
  id: true,
  usuarioId: true,
  fim: true,
  campanha: true,
  PlanosEmpresariais: { select: { nome: true } },
  Usuarios: { select: { email: true, nomeCompleto: true, ultimoLogin: true } },
} satisfies Prisma.EmpresasPlanoSelect;

export interface ResultadoPlanosGratuitos {
  lembretes: number;
  expirados: number;
  vagasParaRascunho: number;
  emails: number;
  expiradosIds: { id: string; usuarioId: string }[];
}

/**
 * - Lembrete DIAS_LEMBRETE dias antes do fim (uma vez por plano)
 * - Plano vencido: EXPIRADO, vagas em rascunho (se não houver outro plano vigente) e aviso
 */
export async function processarPlanosGratuitos(
  agora = new Date(),
): Promise<ResultadoPlanosGratuitos> {
  const resultado: ResultadoPlanosGratuitos = {
    lembretes: 0,
    expirados: 0,
    vagasParaRascunho: 0,
    emails: 0,
    expiradosIds: [],
  };
  const urlPlanos = await planosUrl();
  const emailService = new EmailService();

  const proximos = await prisma.empresasPlano.findMany({
    where: {
      modo: EmpresasPlanoModo.TESTE,
      status: EmpresasPlanoStatus.ATIVO,
      lembreteExpiracaoEm: null,
      fim: { gt: agora, lte: new Date(agora.getTime() + DIAS_LEMBRETE * DIA_MS) },
    },
    select: selecaoAviso,
  });
  for (const plano of proximos) {
    if (!plano.fim) continue;
    const validoAte = ultimoDia(plano.fim);
    const inauguracao = plano.campanha === CAMPANHA_INAUGURACAO;
    const dias = Math.max(Math.ceil((plano.fim.getTime() - agora.getTime()) / DIA_MS), 0);
    await notificacoesService.criar({
      usuarioId: plano.usuarioId,
      tipo: 'PLANO_EXPIRANDO',
      titulo: inauguracao ? 'Seu mês grátis está acabando' : 'Seu período gratuito está acabando',
      mensagem: `Seu plano ${plano.PlanosEmpresariais.nome} gratuito termina em ${validoAte.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Escolha um plano para manter suas vagas publicadas.`,
      prioridade: dias <= 1 ? 'URGENTE' : 'ALTA',
      empresasPlanoId: plano.id,
      dados: { diasRestantes: dias, validoAte: validoAte.toISOString() },
      linkAcao: '/dashboard/upgrade',
    });
    if (podeReceberEmail(plano.Usuarios)) {
      const email = EmailTemplates.generateFreePlanEndingEmail({
        nomeEmpresa: plano.Usuarios.nomeCompleto,
        planoNome: plano.PlanosEmpresariais.nome,
        validoAte,
        planosUrl: urlPlanos,
        inauguracao,
      });
      const envio = await emailService.sendGeneric(
        plano.Usuarios.email,
        plano.Usuarios.nomeCompleto,
        email.subject,
        email.html,
        email.text,
      );
      if (envio.success) resultado.emails += 1;
    }
    await prisma.empresasPlano.update({
      where: { id: plano.id },
      data: { lembreteExpiracaoEm: agora },
    });
    resultado.lembretes += 1;
  }

  const vencidos = await prisma.empresasPlano.findMany({
    where: { modo: EmpresasPlanoModo.TESTE, status: EmpresasPlanoStatus.ATIVO, fim: { lt: agora } },
    select: selecaoAviso,
  });
  for (const plano of vencidos) {
    await prisma.empresasPlano.update({
      where: { id: plano.id },
      data: { status: EmpresasPlanoStatus.EXPIRADO, expiracaoNotificadaEm: agora },
    });
    resultado.expirados += 1;
    resultado.expiradosIds.push({ id: plano.id, usuarioId: plano.usuarioId });

    // Se a empresa já contratou outro plano, nada muda para ela
    const outroVigente = await prisma.empresasPlano.findFirst({
      where: {
        usuarioId: plano.usuarioId,
        id: { not: plano.id },
        status: EmpresasPlanoStatus.ATIVO,
        OR: [{ fim: null }, { fim: { gt: agora } }],
      },
      select: { id: true },
    });
    if (outroVigente) continue;

    resultado.vagasParaRascunho += await vagasParaRascunho(plano.usuarioId);
    const inauguracao = plano.campanha === CAMPANHA_INAUGURACAO;
    await notificacoesService.criar({
      usuarioId: plano.usuarioId,
      tipo: 'PLANO_EXPIRADO',
      titulo: inauguracao ? 'Seu mês grátis chegou ao fim' : 'Seu período gratuito chegou ao fim',
      mensagem:
        'Suas vagas foram salvas como rascunho, então nada foi perdido. Escolha um plano para republicá-las e continuar recebendo candidatos.',
      prioridade: 'URGENTE',
      empresasPlanoId: plano.id,
      linkAcao: '/dashboard/upgrade',
    });
    if (podeReceberEmail(plano.Usuarios)) {
      const email = EmailTemplates.generateFreePlanEndedEmail({
        nomeEmpresa: plano.Usuarios.nomeCompleto,
        planoNome: plano.PlanosEmpresariais.nome,
        planosUrl: urlPlanos,
        inauguracao,
      });
      const envio = await emailService.sendGeneric(
        plano.Usuarios.email,
        plano.Usuarios.nomeCompleto,
        email.subject,
        email.html,
        email.text,
      );
      if (envio.success) resultado.emails += 1;
    }
  }

  if (resultado.lembretes || resultado.expirados) {
    log.info({ ...resultado, expiradosIds: undefined }, '⏳ Planos gratuitos processados');
  }
  return resultado;
}
