import crypto from 'crypto';
import {
  AuditoriaCategoria,
  Prisma,
  WebsitePopupLeadInterestSource,
  WebsitePopupLeadOpportunityStatus,
  WebsitePopupLeadStatus,
  WebsitePopupCronograma,
  WebsitePopupDispositivo,
  WebsitePopupEscopo,
  WebsitePopupGatilho,
  WebsiteStatus,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { WEBSITE_CACHE_TTL } from '@/modules/website/config';
import { logger } from '@/utils/logger';
import { getCache, invalidateCacheByPrefix, setCache } from '@/utils/cache';
import type {
  ActivePopupsQuery,
  CreatePopupLeadInterestInput,
  CreatePopupLeadNoteInput,
  CreatePopupLeadOpportunityInput,
  CreatePopupContactInput,
  CreatePopupInput,
  PopupLeadListQuery,
  ListPopupsQuery,
  UpdatePopupLeadInput,
  UpdatePopupLeadNoteInput,
  UpdatePopupLeadOpportunityInput,
  UpdatePopupInput,
} from '@/modules/website/validators/popups.schema';

const CACHE_PREFIX = 'website:popups';
const ACTIVE_CACHE_PREFIX = `${CACHE_PREFIX}:active`;
const MISSING_TRIGGER_TARGET_COLUMN = 'WebsitePopup.triggerTarget';
let triggerTargetColumnAvailable: boolean | null = null;

const popupsLogger = logger.child({ module: 'WebsitePopupsService' });

const popupListSelect = {
  id: true,
  nome: true,
  templateSlug: true,
  status: true,
  dispositivo: true,
  escopo: true,
  gatilho: true,
  cronograma: true,
  frequencia: true,
  prioridade: true,
  tag: true,
  criadoEm: true,
  atualizadoEm: true,
  _count: {
    select: {
      WebsitePopupContatos: true,
    },
  },
} satisfies Prisma.WebsitePopupSelect;

const popupDetailSelect = {
  id: true,
  nome: true,
  templateSlug: true,
  status: true,
  dispositivo: true,
  escopo: true,
  posicaoDesktop: true,
  posicaoMobile: true,
  gatilho: true,
  atrasoSegundos: true,
  inatividadeSegundos: true,
  scrollPercentual: true,
  seletorAlvo: true,
  triggerTarget: true,
  cronograma: true,
  inicioEm: true,
  fimEm: true,
  frequencia: true,
  tag: true,
  redirectUrl: true,
  redirectNovaAba: true,
  prioridade: true,
  contentConfig: true,
  formFields: true,
  designConfig: true,
  subscriptionConfig: true,
  pageRules: true,
  criadoPorId: true,
  atualizadoPorId: true,
  criadoEm: true,
  atualizadoEm: true,
  _count: {
    select: {
      WebsitePopupContatos: true,
    },
  },
} satisfies Prisma.WebsitePopupSelect;

const popupDetailSelectLegacy = {
  id: true,
  nome: true,
  templateSlug: true,
  status: true,
  dispositivo: true,
  escopo: true,
  posicaoDesktop: true,
  posicaoMobile: true,
  gatilho: true,
  atrasoSegundos: true,
  inatividadeSegundos: true,
  scrollPercentual: true,
  seletorAlvo: true,
  cronograma: true,
  inicioEm: true,
  fimEm: true,
  frequencia: true,
  tag: true,
  redirectUrl: true,
  redirectNovaAba: true,
  prioridade: true,
  contentConfig: true,
  formFields: true,
  designConfig: true,
  subscriptionConfig: true,
  pageRules: true,
  criadoPorId: true,
  atualizadoPorId: true,
  criadoEm: true,
  atualizadoEm: true,
  _count: {
    select: {
      WebsitePopupContatos: true,
    },
  },
} satisfies Prisma.WebsitePopupSelect;

const popupActiveSelect = {
  id: true,
  nome: true,
  templateSlug: true,
  dispositivo: true,
  escopo: true,
  posicaoDesktop: true,
  posicaoMobile: true,
  gatilho: true,
  atrasoSegundos: true,
  inatividadeSegundos: true,
  scrollPercentual: true,
  seletorAlvo: true,
  triggerTarget: true,
  frequencia: true,
  tag: true,
  redirectUrl: true,
  redirectNovaAba: true,
  prioridade: true,
  contentConfig: true,
  formFields: true,
  designConfig: true,
  pageRules: true,
  atualizadoEm: true,
} satisfies Prisma.WebsitePopupSelect;

const popupActiveSelectLegacy = {
  id: true,
  nome: true,
  templateSlug: true,
  dispositivo: true,
  escopo: true,
  posicaoDesktop: true,
  posicaoMobile: true,
  gatilho: true,
  atrasoSegundos: true,
  inatividadeSegundos: true,
  scrollPercentual: true,
  seletorAlvo: true,
  frequencia: true,
  tag: true,
  redirectUrl: true,
  redirectNovaAba: true,
  prioridade: true,
  contentConfig: true,
  formFields: true,
  designConfig: true,
  pageRules: true,
  atualizadoEm: true,
} satisfies Prisma.WebsitePopupSelect;

const contactSelect = {
  id: true,
  popupId: true,
  popupNome: true,
  usuarioId: true,
  contactKey: true,
  nome: true,
  email: true,
  telefone: true,
  whatsapp: true,
  tag: true,
  payload: true,
  origemPath: true,
  userAgent: true,
  ipHash: true,
  removidoEm: true,
  criadoEm: true,
  WebsitePopup: {
    select: {
      id: true,
      nome: true,
    },
  },
} satisfies Prisma.WebsitePopupContatoSelect;

type PopupPageRules = {
  mode?: string;
  urlContains?: string | null;
  htmlSelector?: string | null;
  pageKey?: string | null;
};

type PopupTriggerConfiguration = {
  gatilho: WebsitePopupGatilho;
  seletorAlvo: string | null;
  triggerTarget: string | null;
};

type PopupContactRecord = Prisma.WebsitePopupContatoGetPayload<{
  select: typeof contactSelect;
}>;

const popupLeadSelect = {
  id: true,
  contactKey: true,
  nome: true,
  email: true,
  telefone: true,
  whatsapp: true,
  empresa: true,
  idade: true,
  dataNascimento: true,
  endereco: true,
  cidade: true,
  estado: true,
  tag: true,
  status: true,
  ownerUsuarioId: true,
  origemPrincipal: true,
  ultimoPopupId: true,
  ultimoPopupNome: true,
  primeiraCapturaEm: true,
  ultimaCapturaEm: true,
  criadoEm: true,
  atualizadoEm: true,
  Owner: {
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
    },
  },
  UltimoPopup: {
    select: {
      id: true,
      nome: true,
    },
  },
} satisfies Prisma.WebsitePopupLeadSelect;

const popupLeadDetailSelect = {
  ...popupLeadSelect,
  Notes: {
    orderBy: {
      criadoEm: 'desc',
    },
    select: {
      id: true,
      conteudo: true,
      criadoEm: true,
      atualizadoEm: true,
      Autor: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
        },
      },
    },
  },
  Interests: {
    orderBy: {
      criadoEm: 'desc',
    },
    select: {
      id: true,
      label: true,
      source: true,
      criadoEm: true,
    },
  },
  Opportunities: {
    orderBy: [{ atualizadoEm: 'desc' }, { criadoEm: 'desc' }],
    select: {
      id: true,
      titulo: true,
      status: true,
      valorEsperado: true,
      closeDate: true,
      descricao: true,
      criadoEm: true,
      atualizadoEm: true,
      Owner: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.WebsitePopupLeadSelect;

type PopupLeadListItem = {
  id: string;
  contactKey: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  empresa: string | null;
  idade: number | null;
  dataNascimento: Date | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  tag: string | null;
  origemPath: string | null;
  popupId: string | null;
  popupNome: string | null;
  status: WebsitePopupLeadStatus;
  ownerUsuarioId: string | null;
  owner: {
    id: string;
    nome: string | null;
    email: string | null;
  } | null;
  inscricoesCount: number;
  primeiraCapturaEm: Date;
  ultimaCapturaEm: Date;
};

type PopupLeadDetail = PopupLeadListItem & {
  notes: {
    id: string;
    conteudo: string;
    criadoEm: Date;
    atualizadoEm: Date;
    autor: {
      id: string;
      nome: string | null;
      email: string | null;
    } | null;
  }[];
  interests: {
    id: string;
    label: string;
    source: WebsitePopupLeadInterestSource;
    criadoEm: Date;
  }[];
  opportunities: {
    id: string;
    titulo: string;
    status: WebsitePopupLeadOpportunityStatus;
    valorEsperado: Prisma.Decimal | null;
    closeDate: Date | null;
    descricao: string | null;
    criadoEm: Date;
    atualizadoEm: Date;
    owner: {
      id: string;
      nome: string | null;
      email: string | null;
    } | null;
  }[];
};

type PopupLeadActivityActor = {
  id: string | null;
  nome: string | null;
  email: string | null;
  role: string | null;
  roleLabel: string | null;
};

type PopupLeadActivityItem = {
  id: string;
  tipo: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  dataHora: Date;
  ator: PopupLeadActivityActor;
  contexto: Record<string, unknown> | null;
  dadosAnteriores: Record<string, unknown> | null;
  dadosNovos: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toRecordOrNull(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeNullableString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeEmail(value?: string | null) {
  return normalizeNullableString(value)?.toLowerCase() ?? null;
}

function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits || null;
}

function formatLeadStatusLabel(status?: string | null) {
  if (!status) return 'Sem status';

  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function buildActivityActorLabel(role?: string | null) {
  if (!role) return 'Sistema';

  const labels: Record<string, string> = {
    ADMIN: 'Administrador',
    MODERADOR: 'Moderador',
    PEDAGOGICO: 'Setor Pedagógico',
    INSTRUTOR: 'Instrutor',
    ALUNO_CANDIDATO: 'Aluno/Candidato',
    EMPRESA: 'Empresa',
    SETOR_DE_VAGAS: 'Setor de Vagas',
    RECRUTADOR: 'Recrutador',
    FINANCEIRO: 'Financeiro',
  };

  return labels[role] ?? role;
}

function buildSystemActor(name = 'Sistema'): PopupLeadActivityActor {
  return {
    id: null,
    nome: name,
    email: null,
    role: null,
    roleLabel: 'Sistema interno',
  };
}

function buildUserActor(
  user:
    | {
        id: string;
        nomeCompleto: string | null;
        email: string | null;
        role: string | null;
      }
    | null
    | undefined,
): PopupLeadActivityActor {
  if (!user) return buildSystemActor();

  return {
    id: user.id,
    nome: user.nomeCompleto ?? user.email ?? 'Equipe interna',
    email: user.email ?? null,
    role: user.role ?? null,
    roleLabel: buildActivityActorLabel(user.role ?? null),
  };
}

function buildAuditDescription(
  action: string,
  contextLabel: string,
  previousValue: string | null,
  nextValue: string | null,
) {
  switch (action) {
    case 'LEAD_STATUS_ALTERADO':
      return `Status do lead alterado para ${nextValue ?? 'não informado'}`;
    case 'LEAD_RESPONSAVEL_ALTERADO':
      return `Responsável do lead alterado para ${nextValue ?? 'não informado'}`;
    case 'LEAD_NOTA_CRIADA':
      return 'Nota do lead criada';
    case 'LEAD_NOTA_EDITADA':
      return 'Nota do lead editada';
    case 'LEAD_NOTA_EXCLUIDA':
      return 'Nota do lead excluída';
    default:
      return `${contextLabel}: ${previousValue ?? '—'} -> ${nextValue ?? '—'}`;
  }
}

async function registerLeadAuditLog(input: {
  usuarioId?: string | null;
  entidadeId: string;
  tipo:
    | 'LEAD_STATUS_ALTERADO'
    | 'LEAD_RESPONSAVEL_ALTERADO'
    | 'LEAD_NOTA_CRIADA'
    | 'LEAD_NOTA_EDITADA'
    | 'LEAD_NOTA_EXCLUIDA';
  acao: string;
  descricao: string;
  dadosAnteriores?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditoriaLogs.create({
    data: {
      categoria: AuditoriaCategoria.USUARIO,
      tipo: input.tipo,
      acao: input.acao,
      usuarioId: input.usuarioId ?? null,
      entidadeId: input.entidadeId,
      entidadeTipo: 'WEBSITE_POPUP_LEAD',
      descricao: input.descricao,
      dadosAnteriores: input.dadosAnteriores
        ? (input.dadosAnteriores as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      dadosNovos: input.dadosNovos ? (input.dadosNovos as Prisma.InputJsonValue) : Prisma.JsonNull,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

function buildContactKey(data: {
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
}) {
  const email = normalizeEmail(data.email);
  if (email) return `email:${email}`;

  const telefone = normalizePhone(data.telefone);
  if (telefone) return `telefone:${telefone}`;

  const whatsapp = normalizePhone(data.whatsapp);
  if (whatsapp) return `whatsapp:${whatsapp}`;

  return `anon:${crypto.randomUUID()}`;
}

function resolveContactDisplayValue(records: PopupContactRecord[], key: keyof PopupContactRecord) {
  for (const record of records) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return null;
}

function buildGroupedContact(records: PopupContactRecord[]) {
  const ordered = [...records].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  const latest = ordered[0];
  const oldest = ordered[ordered.length - 1];

  return {
    id: latest.contactKey ?? latest.id,
    contactKey: latest.contactKey ?? latest.id,
    nome: resolveContactDisplayValue(ordered, 'nome'),
    email: resolveContactDisplayValue(ordered, 'email'),
    telefone: resolveContactDisplayValue(ordered, 'telefone'),
    whatsapp: resolveContactDisplayValue(ordered, 'whatsapp'),
    tag: resolveContactDisplayValue(ordered, 'tag'),
    origemPath: resolveContactDisplayValue(ordered, 'origemPath'),
    popupId: latest.WebsitePopup?.id ?? latest.popupId ?? null,
    popupNome: latest.WebsitePopup?.nome ?? latest.popupNome ?? null,
    inscricoesCount: ordered.length,
    primeiraCapturaEm: oldest.criadoEm,
    ultimaCapturaEm: latest.criadoEm,
    userAgent: resolveContactDisplayValue(ordered, 'userAgent'),
    ipHash: resolveContactDisplayValue(ordered, 'ipHash'),
  };
}

function extractPayloadString(payload: Prisma.JsonValue | null | undefined, keys: string[]) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  for (const key of keys) {
    const raw = (payload as Record<string, unknown>)[key];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }

  return null;
}

function extractPayloadNumber(payload: Prisma.JsonValue | null | undefined, keys: string[]) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  for (const key of keys) {
    const raw = (payload as Record<string, unknown>)[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }

    if (typeof raw === 'string' && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function extractPayloadDate(payload: Prisma.JsonValue | null | undefined, keys: string[]) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  for (const key of keys) {
    const raw = (payload as Record<string, unknown>)[key];
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
}

function buildLeadListItem(
  lead: Prisma.WebsitePopupLeadGetPayload<{ select: typeof popupLeadSelect }>,
  inscricoesCount: number,
): PopupLeadListItem {
  return {
    id: lead.id,
    contactKey: lead.contactKey,
    nome: lead.nome,
    email: lead.email,
    telefone: lead.telefone,
    whatsapp: lead.whatsapp,
    empresa: lead.empresa,
    idade: lead.idade,
    dataNascimento: lead.dataNascimento,
    endereco: lead.endereco,
    cidade: lead.cidade,
    estado: lead.estado,
    tag: lead.tag,
    origemPath: lead.origemPrincipal,
    popupId: lead.UltimoPopup?.id ?? lead.ultimoPopupId ?? null,
    popupNome: lead.UltimoPopup?.nome ?? lead.ultimoPopupNome ?? null,
    status: lead.status,
    ownerUsuarioId: lead.ownerUsuarioId,
    owner: lead.Owner
      ? {
          id: lead.Owner.id,
          nome: lead.Owner.nomeCompleto ?? null,
          email: lead.Owner.email ?? null,
        }
      : null,
    inscricoesCount,
    primeiraCapturaEm: lead.primeiraCapturaEm,
    ultimaCapturaEm: lead.ultimaCapturaEm,
  };
}

function buildLeadDetail(
  lead: Prisma.WebsitePopupLeadGetPayload<{ select: typeof popupLeadDetailSelect }>,
  inscricoesCount: number,
): PopupLeadDetail {
  return {
    ...buildLeadListItem(lead, inscricoesCount),
    notes: lead.Notes.map((note) => ({
      id: note.id,
      conteudo: note.conteudo,
      criadoEm: note.criadoEm,
      atualizadoEm: note.atualizadoEm,
      autor: note.Autor
        ? {
            id: note.Autor.id,
            nome: note.Autor.nomeCompleto ?? null,
            email: note.Autor.email ?? null,
          }
        : null,
    })),
    interests: lead.Interests.map((interest) => ({
      id: interest.id,
      label: interest.label,
      source: interest.source,
      criadoEm: interest.criadoEm,
    })),
    opportunities: lead.Opportunities.map((opportunity) => ({
      id: opportunity.id,
      titulo: opportunity.titulo,
      status: opportunity.status,
      valorEsperado: opportunity.valorEsperado,
      closeDate: opportunity.closeDate,
      descricao: opportunity.descricao,
      criadoEm: opportunity.criadoEm,
      atualizadoEm: opportunity.atualizadoEm,
      owner: opportunity.Owner
        ? {
            id: opportunity.Owner.id,
            nome: opportunity.Owner.nomeCompleto ?? null,
            email: opportunity.Owner.email ?? null,
          }
        : null,
    })),
  };
}

function buildLegacySelectorFromTriggerTarget(triggerTarget?: string | null) {
  const normalized = normalizeNullableString(triggerTarget);
  return normalized ? `[data-popup-target="${normalized}"]` : null;
}

function isMissingTriggerTargetColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message || '';

  if (message.includes(`The column \`${MISSING_TRIGGER_TARGET_COLUMN}\` does not exist`)) {
    return true;
  }

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2022' &&
    message.includes(MISSING_TRIGGER_TARGET_COLUMN)
  );
}

function logTriggerTargetFallback(context: string, error: unknown) {
  popupsLogger.warn(
    {
      context,
      column: MISSING_TRIGGER_TARGET_COLUMN,
      errorMessage: error instanceof Error ? error.message : String(error),
    },
    'Fallback legacy acionado porque o banco ainda nao possui a coluna triggerTarget',
  );
}

async function withTriggerTargetFallback<T>(
  context: string,
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
) {
  if (triggerTargetColumnAvailable === false) {
    return fallback();
  }

  try {
    const result = await operation();
    triggerTargetColumnAvailable = true;
    return result;
  } catch (error) {
    if (!isMissingTriggerTargetColumnError(error)) {
      throw error;
    }

    triggerTargetColumnAvailable = false;
    logTriggerTargetFallback(context, error);
    return fallback();
  }
}

function assertTriggerTargetConfiguration({
  gatilho,
  triggerTarget,
  seletorAlvo,
  triggerTargetAvailable = true,
}: {
  gatilho?: string | null;
  triggerTarget?: string | null;
  seletorAlvo?: string | null;
  triggerTargetAvailable?: boolean;
}) {
  if (gatilho !== WebsitePopupGatilho.CLIQUE && gatilho !== WebsitePopupGatilho.HOVER) {
    return;
  }

  const resolvedLegacySelector =
    normalizeNullableString(seletorAlvo) ||
    (!triggerTargetAvailable ? buildLegacySelectorFromTriggerTarget(triggerTarget) : null);

  if (
    (triggerTargetAvailable && normalizeNullableString(triggerTarget)) ||
    resolvedLegacySelector
  ) {
    return;
  }

  const error = new Error(
    triggerTargetAvailable
      ? 'Selecione um alvo do gatilho ou mantenha um seletor legado para Clique e Hover.'
      : 'O banco atual ainda nao suporta triggerTarget. Aplique a migration ou use um seletor legado para Clique e Hover.',
  );
  (error as Error & { statusCode?: number }).statusCode = triggerTargetAvailable ? 400 : 503;
  throw error;
}

function buildPopupData(
  data: CreatePopupInput | UpdatePopupInput,
  userId?: string,
  options?: { includeTriggerTarget?: boolean },
) {
  const includeTriggerTarget = options?.includeTriggerTarget ?? true;
  const result: Prisma.WebsitePopupUncheckedUpdateInput = {};

  if (data.nome !== undefined) result.nome = data.nome;
  if (data.templateSlug !== undefined)
    result.templateSlug = normalizeNullableString(data.templateSlug);
  if (data.status !== undefined) result.status = data.status;
  if (data.dispositivo !== undefined) result.dispositivo = data.dispositivo;
  if (data.escopo !== undefined) result.escopo = data.escopo;
  if (data.posicaoDesktop !== undefined) result.posicaoDesktop = data.posicaoDesktop;
  if (data.posicaoMobile !== undefined) result.posicaoMobile = data.posicaoMobile;
  if (data.gatilho !== undefined) result.gatilho = data.gatilho;
  if (data.atrasoSegundos !== undefined) result.atrasoSegundos = data.atrasoSegundos;
  if (data.inatividadeSegundos !== undefined) result.inatividadeSegundos = data.inatividadeSegundos;
  if (data.scrollPercentual !== undefined) result.scrollPercentual = data.scrollPercentual;
  if (
    data.seletorAlvo !== undefined ||
    (!includeTriggerTarget && data.triggerTarget !== undefined)
  ) {
    result.seletorAlvo =
      normalizeNullableString(data.seletorAlvo) ||
      (!includeTriggerTarget ? buildLegacySelectorFromTriggerTarget(data.triggerTarget) : null);
  }
  if (includeTriggerTarget && data.triggerTarget !== undefined)
    result.triggerTarget = normalizeNullableString(data.triggerTarget);
  if (data.cronograma !== undefined) result.cronograma = data.cronograma;
  if (data.inicioEm !== undefined) result.inicioEm = data.inicioEm;
  if (data.fimEm !== undefined) result.fimEm = data.fimEm;
  if (data.frequencia !== undefined) result.frequencia = data.frequencia;
  if (data.tag !== undefined) result.tag = normalizeNullableString(data.tag);
  if (data.redirectUrl !== undefined)
    result.redirectUrl = normalizeNullableString(data.redirectUrl);
  if (data.redirectNovaAba !== undefined) result.redirectNovaAba = data.redirectNovaAba;
  if (data.prioridade !== undefined) result.prioridade = data.prioridade;
  if (data.contentConfig !== undefined) result.contentConfig = toJson(data.contentConfig);
  if (data.formFields !== undefined) result.formFields = toJson(data.formFields);
  if (data.designConfig !== undefined) result.designConfig = toJson(data.designConfig);
  if (data.subscriptionConfig !== undefined) {
    result.subscriptionConfig = data.subscriptionConfig
      ? toJson(data.subscriptionConfig)
      : Prisma.JsonNull;
  }
  if (data.pageRules !== undefined) {
    result.pageRules = data.pageRules ? toJson(data.pageRules) : Prisma.JsonNull;
  }
  if (userId) result.atualizadoPorId = userId;

  return result;
}

function appendLegacyTriggerTarget<T extends Record<string, unknown> | null>(record: T) {
  if (!record) return record;
  return {
    ...record,
    triggerTarget: null,
  };
}

function buildListWhere(query: ListPopupsQuery): Prisma.WebsitePopupWhereInput {
  const where: Prisma.WebsitePopupWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.dispositivo) where.dispositivo = query.dispositivo;
  if (query.escopo) where.escopo = query.escopo;
  if (query.search) {
    where.OR = [
      { nome: { contains: query.search, mode: 'insensitive' } },
      { templateSlug: { contains: query.search, mode: 'insensitive' } },
      { tag: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

const SPECIFIC_PAGE_PATHS: Record<string, string[]> = {
  HOME: ['/', '/website'],
  ABOUT: ['/sobre', '/website/sobre'],
  COURSES: ['/cursos', '/website/cursos'],
  RECRUITMENT: ['/recrutamento', '/website/recrutamento'],
  TRAINING: ['/treinamento', '/website/treinamento'],
  JOBS: ['/vagas', '/website/vagas'],
  FAQ: ['/faq', '/website/faq'],
  PRIVACY: ['/politica-privacidade', '/website/politica-privacidade'],
  TERMS: ['/termos-uso', '/website/termos-uso'],
};

function matchesPageRule(pageRules: Prisma.JsonValue | null, path: string) {
  const rules = (pageRules ?? {}) as PopupPageRules;
  const mode = rules.mode ?? 'ALL_PAGES';
  const normalizedPath = path || '/';

  if (mode === 'ALL_PAGES' || mode === 'HTML_SELECTOR') return true;
  if (mode === 'HOME') return normalizedPath === '/' || normalizedPath === '/website';
  if (mode === 'COURSES') return normalizedPath.startsWith('/cursos');
  if (mode === 'SPECIFIC_PAGE') {
    const pageKey = rules.pageKey?.trim();
    if (!pageKey) return false;
    const paths = SPECIFIC_PAGE_PATHS[pageKey];
    if (!paths?.length) return false;
    return paths.some((candidate) =>
      candidate === '/'
        ? normalizedPath === '/'
        : normalizedPath === candidate || normalizedPath.startsWith(`${candidate}/`),
    );
  }
  if (mode === 'URL_CONTAINS') {
    const snippet = rules.urlContains?.trim();
    return snippet ? normalizedPath.includes(snippet) : false;
  }

  return true;
}

async function invalidatePopupsCache() {
  await invalidateCacheByPrefix(CACHE_PREFIX);
}

async function findActiveContactRecordsByKey(contactKey: string) {
  return prisma.websitePopupContato.findMany({
    where: {
      contactKey,
      removidoEm: null,
    },
    orderBy: { criadoEm: 'desc' },
    select: contactSelect,
  });
}

async function getActiveContactGroupOrThrow(contactKey: string) {
  const records = await findActiveContactRecordsByKey(contactKey);

  if (records.length === 0) {
    const error = new Error('Contato não encontrado');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  return records;
}

function inferAutomaticInterestLabels(records: PopupContactRecord[]) {
  const values = new Set<string>();

  records.forEach((record) => {
    const popupName = normalizeNullableString(record.WebsitePopup?.nome ?? record.popupNome);
    const tag = normalizeNullableString(record.tag);
    const origem = normalizeNullableString(record.origemPath);

    if (popupName) values.add(popupName);
    if (tag) values.add(tag);
    if (origem) values.add(origem);
  });

  return Array.from(values).slice(0, 24);
}

async function syncLeadFromContactKey(contactKey: string) {
  const records = await findActiveContactRecordsByKey(contactKey);

  if (records.length === 0) {
    const existingLead = await prisma.websitePopupLead.findUnique({
      where: { contactKey },
      select: { id: true },
    });

    if (existingLead) {
      await prisma.websitePopupLead.update({
        where: { id: existingLead.id },
        data: { removidoEm: new Date() },
      });
    }

    return null;
  }

  const grouped = buildGroupedContact(records);
  const latest = records[0];
  const latestPayload = latest?.payload;

  const lead = await prisma.websitePopupLead.upsert({
    where: { contactKey },
    create: {
      contactKey,
      nome: grouped.nome,
      email: grouped.email,
      telefone: grouped.telefone,
      whatsapp: grouped.whatsapp,
      empresa: extractPayloadString(latestPayload, ['empresa', 'company']),
      idade: extractPayloadNumber(latestPayload, ['idade', 'age']),
      dataNascimento: extractPayloadDate(latestPayload, [
        'dataNascimento',
        'data_nascimento',
        'birthDate',
      ]),
      endereco: extractPayloadString(latestPayload, ['endereco', 'endereço', 'address']),
      cidade: extractPayloadString(latestPayload, ['cidade', 'city']),
      estado: extractPayloadString(latestPayload, ['estado', 'uf', 'state']),
      tag: grouped.tag,
      origemPrincipal: grouped.origemPath,
      ultimoPopupId: grouped.popupId,
      ultimoPopupNome: grouped.popupNome,
      primeiraCapturaEm: grouped.primeiraCapturaEm,
      ultimaCapturaEm: grouped.ultimaCapturaEm,
      removidoEm: null,
    },
    update: {
      nome: grouped.nome,
      email: grouped.email,
      telefone: grouped.telefone,
      whatsapp: grouped.whatsapp,
      empresa: extractPayloadString(latestPayload, ['empresa', 'company']) ?? undefined,
      idade: extractPayloadNumber(latestPayload, ['idade', 'age']) ?? undefined,
      dataNascimento:
        extractPayloadDate(latestPayload, ['dataNascimento', 'data_nascimento', 'birthDate']) ??
        undefined,
      endereco:
        extractPayloadString(latestPayload, ['endereco', 'endereço', 'address']) ?? undefined,
      cidade: extractPayloadString(latestPayload, ['cidade', 'city']) ?? undefined,
      estado: extractPayloadString(latestPayload, ['estado', 'uf', 'state']) ?? undefined,
      tag: grouped.tag,
      origemPrincipal: grouped.origemPath,
      ultimoPopupId: grouped.popupId,
      ultimoPopupNome: grouped.popupNome,
      primeiraCapturaEm: grouped.primeiraCapturaEm,
      ultimaCapturaEm: grouped.ultimaCapturaEm,
      removidoEm: null,
    },
    select: { id: true },
  });

  const autoInterests = inferAutomaticInterestLabels(records);

  await prisma.$transaction([
    prisma.websitePopupLeadInterest.deleteMany({
      where: {
        leadId: lead.id,
        source: WebsitePopupLeadInterestSource.AUTO,
      },
    }),
    ...(autoInterests.length > 0
      ? [
          prisma.websitePopupLeadInterest.createMany({
            data: autoInterests.map((label) => ({
              leadId: lead.id,
              label,
              source: WebsitePopupLeadInterestSource.AUTO,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return lead.id;
}

async function getLeadOrThrow(id: string) {
  const lead = await prisma.websitePopupLead.findFirst({
    where: {
      id,
      removidoEm: null,
    },
    select: popupLeadDetailSelect,
  });

  if (!lead) {
    const error = new Error('Lead não encontrado');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  return lead;
}

async function getLeadInscricoesCount(contactKey: string) {
  return prisma.websitePopupContato.count({
    where: {
      contactKey,
      removidoEm: null,
    },
  });
}

async function getLeadInscricoesCountMap(contactKeys: string[]) {
  if (contactKeys.length === 0) {
    return new Map<string, number>();
  }

  const grouped = await prisma.websitePopupContato.groupBy({
    by: ['contactKey'],
    where: {
      removidoEm: null,
      contactKey: {
        in: contactKeys,
      },
    },
    _count: {
      _all: true,
    },
  });

  return new Map(grouped.map((item) => [item.contactKey, item._count._all]));
}

async function getLeadActivity(leadId: string) {
  const lead = await prisma.websitePopupLead.findFirst({
    where: {
      id: leadId,
      removidoEm: null,
    },
    select: {
      id: true,
      contactKey: true,
    },
  });

  if (!lead) {
    const error = new Error('Lead não encontrado');
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const [contactRecords, auditLogs] = await Promise.all([
    getActiveContactGroupOrThrow(lead.contactKey),
    prisma.auditoriaLogs.findMany({
      where: {
        entidadeId: leadId,
        entidadeTipo: 'WEBSITE_POPUP_LEAD',
        tipo: {
          in: [
            'LEAD_STATUS_ALTERADO',
            'LEAD_RESPONSAVEL_ALTERADO',
            'LEAD_NOTA_CRIADA',
            'LEAD_NOTA_EDITADA',
            'LEAD_NOTA_EXCLUIDA',
          ],
        },
      },
      include: {
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        criadoEm: 'desc',
      },
    }),
  ]);

  const captureEvents: PopupLeadActivityItem[] = contactRecords.map((record) => ({
    id: `capture:${record.id}`,
    tipo: 'LEAD_CAPTURADO',
    categoria: 'SISTEMA',
    titulo: 'Lead inscrito/capturado',
    descricao: `Captura registrada em ${record.WebsitePopup?.nome ?? record.popupNome ?? 'rotina removida'}`,
    dataHora: record.criadoEm,
    ator: buildSystemActor('Site'),
    contexto: {
      popupId: record.popupId ?? null,
      popupNome: record.WebsitePopup?.nome ?? record.popupNome ?? null,
      origemPath: record.origemPath ?? null,
      tag: record.tag ?? null,
      email: record.email ?? null,
      telefone: record.telefone ?? null,
      whatsapp: record.whatsapp ?? null,
    },
    dadosAnteriores: null,
    dadosNovos: {
      payload: toRecordOrNull(record.payload) ?? {},
    },
    meta: {
      userAgent: record.userAgent ?? null,
      ipHash: record.ipHash ?? null,
      origem: 'CAPTURA_POPUP',
    },
  }));

  const auditEvents: PopupLeadActivityItem[] = auditLogs.map((log) => ({
    id: log.id,
    tipo: log.tipo,
    categoria: log.categoria,
    titulo: log.acao,
    descricao: log.descricao ?? null,
    dataHora: log.criadoEm,
    ator: buildUserActor(log.Usuarios),
    contexto: toRecordOrNull(log.metadata),
    dadosAnteriores: toRecordOrNull(log.dadosAnteriores),
    dadosNovos: toRecordOrNull(log.dadosNovos),
    meta: toRecordOrNull(log.metadata),
  }));

  return [...captureEvents, ...auditEvents].sort(
    (left, right) => right.dataHora.getTime() - left.dataHora.getTime(),
  );
}

export const websitePopupsService = {
  list: async (query: ListPopupsQuery) => {
    const page = query.page;
    const pageSize = query.pageSize;
    const where = buildListWhere(query);

    const [total, popups] = await Promise.all([
      prisma.websitePopup.count({ where }),
      prisma.websitePopup.findMany({
        where,
        orderBy: [{ prioridade: 'desc' }, { atualizadoEm: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: popupListSelect,
      }),
    ]);

    return {
      popups,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  },

  get: (id: string) =>
    withTriggerTargetFallback(
      'get',
      () =>
        prisma.websitePopup.findUnique({
          where: { id },
          select: popupDetailSelect,
        }),
      async () =>
        appendLegacyTriggerTarget(
          await prisma.websitePopup.findUnique({
            where: { id },
            select: popupDetailSelectLegacy,
          }),
        ),
    ),

  active: async (query: ActivePopupsQuery) => {
    const cacheKey = `${ACTIVE_CACHE_PREFIX}:${query.scope}:${query.device}:${query.path}`;
    const cached =
      await getCache<Awaited<ReturnType<typeof prisma.websitePopup.findMany>>>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const where = {
      status: WebsiteStatus.PUBLICADO,
      escopo: { in: [query.scope as WebsitePopupEscopo, WebsitePopupEscopo.AMBOS] },
      dispositivo: {
        in: [query.device as WebsitePopupDispositivo, WebsitePopupDispositivo.AMBOS],
      },
      OR: [
        { cronograma: WebsitePopupCronograma.EXIBIR_AGORA },
        {
          cronograma: WebsitePopupCronograma.PERIODO,
          AND: [
            { OR: [{ inicioEm: null }, { inicioEm: { lte: now } }] },
            { OR: [{ fimEm: null }, { fimEm: { gte: now } }] },
          ],
        },
      ],
    } satisfies Prisma.WebsitePopupWhereInput;

    const popups = await withTriggerTargetFallback(
      'active',
      () =>
        prisma.websitePopup.findMany({
          where,
          orderBy: [{ prioridade: 'desc' }, { atualizadoEm: 'desc' }],
          take: 10,
          select: popupActiveSelect,
        }),
      async () => {
        const legacyPopups = await prisma.websitePopup.findMany({
          where,
          orderBy: [{ prioridade: 'desc' }, { atualizadoEm: 'desc' }],
          take: 10,
          select: popupActiveSelectLegacy,
        });

        return legacyPopups.map((popup) => ({
          ...popup,
          triggerTarget: null,
        }));
      },
    );

    const result = popups.filter((popup) => matchesPageRule(popup.pageRules, query.path));
    await setCache(cacheKey, result, WEBSITE_CACHE_TTL);
    return result;
  },

  create: async (data: CreatePopupInput, userId?: string) => {
    assertTriggerTargetConfiguration(data);
    const created = await withTriggerTargetFallback(
      'create',
      () =>
        prisma.websitePopup.create({
          data: {
            ...buildPopupData(data, userId),
            criadoPorId: userId,
            atualizadoPorId: userId,
          } as Prisma.WebsitePopupUncheckedCreateInput,
          select: popupDetailSelect,
        }),
      async () => {
        assertTriggerTargetConfiguration({
          gatilho: data.gatilho,
          triggerTarget: data.triggerTarget,
          seletorAlvo: data.seletorAlvo,
          triggerTargetAvailable: false,
        });

        return appendLegacyTriggerTarget(
          await prisma.websitePopup.create({
            data: {
              ...buildPopupData(data, userId, { includeTriggerTarget: false }),
              criadoPorId: userId,
              atualizadoPorId: userId,
            } as Prisma.WebsitePopupUncheckedCreateInput,
            select: popupDetailSelectLegacy,
          }),
        );
      },
    );
    await invalidatePopupsCache();
    return created;
  },

  update: async (id: string, data: UpdatePopupInput, userId?: string) => {
    const current = (await withTriggerTargetFallback(
      'update:current',
      () =>
        prisma.websitePopup.findUnique({
          where: { id },
          select: {
            gatilho: true,
            triggerTarget: true,
            seletorAlvo: true,
          },
        }),
      async () =>
        appendLegacyTriggerTarget(
          await prisma.websitePopup.findUnique({
            where: { id },
            select: {
              gatilho: true,
              seletorAlvo: true,
            },
          }),
        ),
    )) as PopupTriggerConfiguration | null;
    if (!current) {
      const error = new Error('Pop-up não encontrado');
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    assertTriggerTargetConfiguration({
      gatilho: data.gatilho ?? current.gatilho,
      triggerTarget: data.triggerTarget !== undefined ? data.triggerTarget : current.triggerTarget,
      seletorAlvo: data.seletorAlvo !== undefined ? data.seletorAlvo : current.seletorAlvo,
    });

    const updated = await withTriggerTargetFallback(
      'update',
      () =>
        prisma.websitePopup.update({
          where: { id },
          data: buildPopupData(data, userId),
          select: popupDetailSelect,
        }),
      async () => {
        assertTriggerTargetConfiguration({
          gatilho: data.gatilho ?? current.gatilho,
          triggerTarget:
            data.triggerTarget !== undefined ? data.triggerTarget : current.triggerTarget,
          seletorAlvo: data.seletorAlvo !== undefined ? data.seletorAlvo : current.seletorAlvo,
          triggerTargetAvailable: false,
        });

        return appendLegacyTriggerTarget(
          await prisma.websitePopup.update({
            where: { id },
            data: buildPopupData(data, userId, { includeTriggerTarget: false }),
            select: popupDetailSelectLegacy,
          }),
        );
      },
    );
    await invalidatePopupsCache();
    return updated;
  },

  remove: async (id: string) => {
    const popup = await prisma.websitePopup.findUnique({
      where: { id },
      select: { id: true, nome: true },
    });

    if (!popup) {
      popupsLogger.warn({ popupId: id }, 'Pop-up nao encontrado para exclusao');
      const notFoundError = new Error('Pop-up não encontrado');
      (notFoundError as Error & { statusCode?: number }).statusCode = 404;
      throw notFoundError;
    }

    try {
      await prisma.$transaction([
        prisma.websitePopupContato.updateMany({
          where: { popupId: id },
          data: {
            popupId: null,
            popupNome: popup.nome,
          },
        }),
        prisma.websitePopup.delete({ where: { id } }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          popupsLogger.warn({ popupId: id }, 'Pop-up nao encontrado para exclusao');
          const notFoundError = new Error('Pop-up não encontrado');
          (notFoundError as Error & { statusCode?: number }).statusCode = 404;
          throw notFoundError;
        }

        if (error.code === 'P2003') {
          popupsLogger.warn(
            { popupId: id, code: error.code, message: error.message },
            'Conflito ao remover pop-up',
          );
          const conflictError = new Error(
            'Não foi possível remover o pop-up porque existem vínculos ativos relacionados a ele.',
          );
          (conflictError as Error & { statusCode?: number }).statusCode = 409;
          throw conflictError;
        }
      }

      popupsLogger.error(
        { popupId: id, errorMessage: error instanceof Error ? error.message : String(error) },
        'Falha inesperada ao remover pop-up',
      );
      throw error;
    }

    try {
      await invalidatePopupsCache();
    } catch (error) {
      popupsLogger.warn(
        {
          popupId: id,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        'Pop-up removido, mas a invalidação de cache falhou',
      );
    }
  },

  createContact: async (
    popupId: string,
    data: CreatePopupContactInput,
    meta: { userId?: string; userAgent?: string | null; ipHash?: string | null },
  ) => {
    const popup = await prisma.websitePopup.findFirst({
      where: { id: popupId, status: WebsiteStatus.PUBLICADO },
      select: { id: true, nome: true, tag: true },
    });

    if (!popup) {
      const error = new Error('Pop-up publicado não encontrado');
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const contato = await prisma.websitePopupContato.create({
      data: {
        popupId,
        popupNome: popup.nome,
        usuarioId: meta.userId,
        contactKey: buildContactKey(data),
        nome: normalizeNullableString(data.nome),
        email: normalizeEmail(data.email),
        telefone: normalizePhone(data.telefone),
        whatsapp: normalizePhone(data.whatsapp),
        tag: normalizeNullableString(data.tag) ?? popup.tag,
        payload: toJson(data.payload),
        origemPath: normalizeNullableString(data.origemPath),
        userAgent: normalizeNullableString(meta.userAgent),
        ipHash: normalizeNullableString(meta.ipHash),
      },
      select: contactSelect,
    });

    await syncLeadFromContactKey(contato.contactKey ?? contato.id);

    return contato;
  },

  listContacts: async (query: PopupLeadListQuery) => {
    const page = query.page;
    const pageSize = query.pageSize;
    const where: Prisma.WebsitePopupLeadWhereInput = {
      removidoEm: null,
    };

    if (query.popupId) where.ultimoPopupId = query.popupId;
    if (query.status) where.status = query.status;
    if (query.ownerUsuarioId) where.ownerUsuarioId = query.ownerUsuarioId;
    if (query.origemPath) {
      where.origemPrincipal = { contains: query.origemPath, mode: 'insensitive' };
    }
    if (query.from || query.to) {
      where.ultimaCapturaEm = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { telefone: { contains: query.search, mode: 'insensitive' } },
        { whatsapp: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, leads] = await Promise.all([
      prisma.websitePopupLead.count({ where }),
      prisma.websitePopupLead.findMany({
        where,
        orderBy: [{ ultimaCapturaEm: 'desc' }, { atualizadoEm: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: popupLeadSelect,
      }),
    ]);

    const countMap = await getLeadInscricoesCountMap(leads.map((lead) => lead.contactKey));
    const contatos = leads.map((lead) =>
      buildLeadListItem(lead, countMap.get(lead.contactKey) ?? 0),
    );

    return {
      contatos,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  },

  getContact: async (leadId: string) => {
    const lead = await getLeadOrThrow(leadId);
    const inscricoesCount = await getLeadInscricoesCount(lead.contactKey);
    return buildLeadDetail(lead, inscricoesCount);
  },

  getContactHistory: async (leadId: string) => {
    const lead = await prisma.websitePopupLead.findFirst({
      where: {
        id: leadId,
        removidoEm: null,
      },
      select: {
        id: true,
        contactKey: true,
      },
    });

    if (!lead) {
      const error = new Error('Lead não encontrado');
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const records = await getActiveContactGroupOrThrow(lead.contactKey);

    return records.map((record) => ({
      id: record.id,
      popupId: record.popupId,
      popupNome: record.WebsitePopup?.nome ?? record.popupNome,
      tag: record.tag,
      payload: record.payload,
      origemPath: record.origemPath,
      userAgent: record.userAgent,
      ipHash: record.ipHash,
      criadoEm: record.criadoEm,
      nome: record.nome,
      email: record.email,
      telefone: record.telefone,
      whatsapp: record.whatsapp,
    }));
  },

  getContactActivity: async (leadId: string) => getLeadActivity(leadId),

  updateContact: async (
    leadId: string,
    data: UpdatePopupLeadInput,
    actor?: { userId?: string | null; ip?: string | null; userAgent?: string | null },
  ) => {
    const lead = await getLeadOrThrow(leadId);
    const identifiersTouched =
      data.email !== undefined || data.telefone !== undefined || data.whatsapp !== undefined;

    const nextEmail = data.email !== undefined ? normalizeEmail(data.email) : lead.email;
    const nextTelefone =
      data.telefone !== undefined ? normalizePhone(data.telefone) : lead.telefone;
    const nextWhatsapp =
      data.whatsapp !== undefined ? normalizePhone(data.whatsapp) : lead.whatsapp;
    const nextContactKey = buildContactKey({
      email: nextEmail,
      telefone: nextTelefone,
      whatsapp: nextWhatsapp,
    });

    const updatedLead = await prisma.websitePopupLead.update({
      where: { id: leadId },
      data: {
        contactKey: identifiersTouched ? nextContactKey : undefined,
        nome: data.nome !== undefined ? normalizeNullableString(data.nome) : undefined,
        email: data.email !== undefined ? nextEmail : undefined,
        telefone: data.telefone !== undefined ? nextTelefone : undefined,
        whatsapp: data.whatsapp !== undefined ? nextWhatsapp : undefined,
        empresa: data.empresa !== undefined ? normalizeNullableString(data.empresa) : undefined,
        idade: data.idade !== undefined ? (data.idade ?? null) : undefined,
        dataNascimento:
          data.dataNascimento !== undefined ? (data.dataNascimento ?? null) : undefined,
        endereco: data.endereco !== undefined ? normalizeNullableString(data.endereco) : undefined,
        cidade: data.cidade !== undefined ? normalizeNullableString(data.cidade) : undefined,
        estado: data.estado !== undefined ? normalizeNullableString(data.estado) : undefined,
        tag: data.tag !== undefined ? normalizeNullableString(data.tag) : undefined,
        status: data.status,
        ownerUsuarioId:
          data.ownerUsuarioId !== undefined
            ? normalizeNullableString(data.ownerUsuarioId)
            : undefined,
        removidoEm: null,
      },
      select: popupLeadDetailSelect,
    });

    if (data.status !== undefined && data.status !== lead.status) {
      const previousValue = {
        status: lead.status,
        statusLabel: formatLeadStatusLabel(lead.status),
      };
      const nextValue = {
        status: updatedLead.status,
        statusLabel: formatLeadStatusLabel(updatedLead.status),
      };

      await registerLeadAuditLog({
        usuarioId: actor?.userId,
        entidadeId: leadId,
        tipo: 'LEAD_STATUS_ALTERADO',
        acao: 'Status alterado',
        descricao: buildAuditDescription(
          'LEAD_STATUS_ALTERADO',
          'Status',
          previousValue.statusLabel,
          nextValue.statusLabel,
        ),
        dadosAnteriores: previousValue,
        dadosNovos: nextValue,
        metadata: {
          field: 'status',
          changedFields: [
            {
              key: 'status',
              label: 'Status',
              before: previousValue.statusLabel,
              after: nextValue.statusLabel,
            },
          ],
        },
        ip: actor?.ip,
        userAgent: actor?.userAgent,
      });
    }

    if (data.ownerUsuarioId !== undefined && data.ownerUsuarioId !== lead.ownerUsuarioId) {
      const previousValue = {
        ownerUsuarioId: lead.ownerUsuarioId,
        ownerNome: lead.Owner?.nomeCompleto ?? null,
        ownerEmail: lead.Owner?.email ?? null,
      };
      const nextValue = {
        ownerUsuarioId: updatedLead.ownerUsuarioId,
        ownerNome: updatedLead.Owner?.nomeCompleto ?? null,
        ownerEmail: updatedLead.Owner?.email ?? null,
      };

      await registerLeadAuditLog({
        usuarioId: actor?.userId,
        entidadeId: leadId,
        tipo: 'LEAD_RESPONSAVEL_ALTERADO',
        acao: 'Atendimento alterado',
        descricao: buildAuditDescription(
          'LEAD_RESPONSAVEL_ALTERADO',
          'Atendimento',
          previousValue.ownerNome ?? previousValue.ownerEmail ?? 'Não informado',
          nextValue.ownerNome ?? nextValue.ownerEmail ?? 'Não informado',
        ),
        dadosAnteriores: previousValue,
        dadosNovos: nextValue,
        metadata: {
          field: 'ownerUsuarioId',
          changedFields: [
            {
              key: 'ownerUsuarioId',
              label: 'Atendimento',
              before: previousValue.ownerNome ?? previousValue.ownerEmail ?? 'Não informado',
              after: nextValue.ownerNome ?? nextValue.ownerEmail ?? 'Não informado',
            },
          ],
        },
        ip: actor?.ip,
        userAgent: actor?.userAgent,
      });
    }

    if (identifiersTouched) {
      if (nextContactKey !== lead.contactKey) {
        await prisma.websitePopupContato.updateMany({
          where: {
            contactKey: lead.contactKey,
            removidoEm: null,
          },
          data: {
            contactKey: nextContactKey,
          },
        });
      }

      await syncLeadFromContactKey(nextContactKey);
    }

    const inscricoesCount = await getLeadInscricoesCount(updatedLead.contactKey);
    return buildLeadDetail(updatedLead, inscricoesCount);
  },

  removeContact: async (leadId: string) => {
    await getLeadOrThrow(leadId);

    await prisma.websitePopupLead.update({
      where: { id: leadId },
      data: {
        removidoEm: new Date(),
      },
    });
  },

  createContactNote: async (
    leadId: string,
    data: CreatePopupLeadNoteInput,
    autorUsuarioId?: string,
  ) => {
    await getLeadOrThrow(leadId);

    const note = await prisma.websitePopupLeadNote.create({
      data: {
        leadId,
        autorUsuarioId: autorUsuarioId ?? null,
        conteudo: data.conteudo.trim(),
      },
      select: {
        id: true,
        conteudo: true,
        criadoEm: true,
        atualizadoEm: true,
        Autor: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    await registerLeadAuditLog({
      usuarioId: autorUsuarioId ?? null,
      entidadeId: leadId,
      tipo: 'LEAD_NOTA_CRIADA',
      acao: 'Nota criada',
      descricao: buildAuditDescription('LEAD_NOTA_CRIADA', 'Nota', null, note.conteudo),
      dadosAnteriores: null,
      dadosNovos: {
        noteId: note.id,
        conteudo: note.conteudo,
      },
      metadata: {
        field: 'note',
        noteId: note.id,
        changedFields: [
          {
            key: 'conteudo',
            label: 'Nota',
            before: null,
            after: note.conteudo,
          },
        ],
      },
    });

    return note;
  },

  updateContactNote: async (
    leadId: string,
    noteId: string,
    data: UpdatePopupLeadNoteInput,
    actor?: { userId?: string | null; ip?: string | null; userAgent?: string | null },
  ) => {
    await getLeadOrThrow(leadId);
    const existing = await prisma.websitePopupLeadNote.findFirst({
      where: {
        id: noteId,
        leadId,
      },
      select: {
        id: true,
        conteudo: true,
      },
    });

    if (!existing) {
      const error = new Error('Nota não encontrada');
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const note = await prisma.websitePopupLeadNote.update({
      where: {
        id: noteId,
      },
      data: {
        conteudo: data.conteudo.trim(),
      },
      select: {
        id: true,
        conteudo: true,
        criadoEm: true,
        atualizadoEm: true,
        Autor: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    await registerLeadAuditLog({
      usuarioId: actor?.userId,
      entidadeId: leadId,
      tipo: 'LEAD_NOTA_EDITADA',
      acao: 'Nota editada',
      descricao: buildAuditDescription(
        'LEAD_NOTA_EDITADA',
        'Nota',
        existing.conteudo,
        note.conteudo,
      ),
      dadosAnteriores: {
        noteId: existing.id,
        conteudo: existing.conteudo,
      },
      dadosNovos: {
        noteId: note.id,
        conteudo: note.conteudo,
      },
      metadata: {
        field: 'note',
        noteId: note.id,
        changedFields: [
          {
            key: 'conteudo',
            label: 'Nota',
            before: existing.conteudo,
            after: note.conteudo,
          },
        ],
      },
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });

    return note;
  },

  removeContactNote: async (
    leadId: string,
    noteId: string,
    actor?: { userId?: string | null; ip?: string | null; userAgent?: string | null },
  ) => {
    await getLeadOrThrow(leadId);
    const existing = await prisma.websitePopupLeadNote.findFirst({
      where: {
        id: noteId,
        leadId,
      },
      select: {
        id: true,
        conteudo: true,
      },
    });

    if (!existing) {
      const error = new Error('Nota não encontrada');
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    await prisma.websitePopupLeadNote.delete({
      where: {
        id: noteId,
      },
    });

    await registerLeadAuditLog({
      usuarioId: actor?.userId,
      entidadeId: leadId,
      tipo: 'LEAD_NOTA_EXCLUIDA',
      acao: 'Nota excluída',
      descricao: buildAuditDescription('LEAD_NOTA_EXCLUIDA', 'Nota', existing.conteudo, null),
      dadosAnteriores: {
        noteId: existing.id,
        conteudo: existing.conteudo,
      },
      dadosNovos: null,
      metadata: {
        field: 'note',
        noteId: existing.id,
        changedFields: [
          {
            key: 'conteudo',
            label: 'Nota',
            before: existing.conteudo,
            after: null,
          },
        ],
      },
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
  },

  createContactInterest: async (leadId: string, data: CreatePopupLeadInterestInput) => {
    await getLeadOrThrow(leadId);

    return prisma.websitePopupLeadInterest.create({
      data: {
        leadId,
        label: data.label.trim(),
        source: WebsitePopupLeadInterestSource.MANUAL,
      },
    });
  },

  removeContactInterest: async (leadId: string, interestId: string) => {
    await getLeadOrThrow(leadId);
    const interest = await prisma.websitePopupLeadInterest.findFirst({
      where: {
        id: interestId,
        leadId,
      },
      select: {
        id: true,
        source: true,
      },
    });

    if (!interest) {
      const error = new Error('Interesse não encontrado');
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    if (interest.source === WebsitePopupLeadInterestSource.AUTO) {
      const error = new Error('Interesses automáticos não podem ser removidos manualmente');
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    await prisma.websitePopupLeadInterest.delete({
      where: {
        id: interestId,
      },
    });
  },

  createContactOpportunity: async (leadId: string, data: CreatePopupLeadOpportunityInput) => {
    await getLeadOrThrow(leadId);

    return prisma.websitePopupLeadOpportunity.create({
      data: {
        leadId,
        titulo: data.titulo.trim(),
        status: data.status,
        valorEsperado:
          data.valorEsperado !== undefined && data.valorEsperado !== null
            ? new Prisma.Decimal(data.valorEsperado)
            : null,
        closeDate: data.closeDate ?? null,
        descricao: normalizeNullableString(data.descricao),
        ownerUsuarioId: normalizeNullableString(data.ownerUsuarioId),
      },
      select: {
        id: true,
        titulo: true,
        status: true,
        valorEsperado: true,
        closeDate: true,
        descricao: true,
        criadoEm: true,
        atualizadoEm: true,
        Owner: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });
  },

  updateContactOpportunity: async (
    leadId: string,
    opportunityId: string,
    data: UpdatePopupLeadOpportunityInput,
  ) => {
    await getLeadOrThrow(leadId);

    return prisma.websitePopupLeadOpportunity.update({
      where: {
        id: opportunityId,
      },
      data: {
        titulo: data.titulo !== undefined ? data.titulo.trim() : undefined,
        status: data.status,
        valorEsperado:
          data.valorEsperado !== undefined
            ? data.valorEsperado === null
              ? null
              : new Prisma.Decimal(data.valorEsperado)
            : undefined,
        closeDate: data.closeDate !== undefined ? (data.closeDate ?? null) : undefined,
        descricao:
          data.descricao !== undefined ? normalizeNullableString(data.descricao) : undefined,
        ownerUsuarioId:
          data.ownerUsuarioId !== undefined
            ? normalizeNullableString(data.ownerUsuarioId)
            : undefined,
      },
      select: {
        id: true,
        titulo: true,
        status: true,
        valorEsperado: true,
        closeDate: true,
        descricao: true,
        criadoEm: true,
        atualizadoEm: true,
        Owner: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });
  },

  removeContactOpportunity: async (leadId: string, opportunityId: string) => {
    await getLeadOrThrow(leadId);
    await prisma.websitePopupLeadOpportunity.delete({
      where: {
        id: opportunityId,
      },
    });
  },
};

export const WEBSITE_POPUP_TRIGGER_TYPES = WebsitePopupGatilho;
