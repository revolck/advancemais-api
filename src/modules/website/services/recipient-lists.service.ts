import {
  EmpresasPlanoStatus,
  Prisma,
  Roles,
  Status,
  StatusInscricao,
  StatusDeVagas,
  WebsitePopupLeadStatus,
  WebsiteRecipientListMemberSource,
  WebsiteRecipientListRecipientKind,
  WebsiteRecipientListStatus,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  type CreateRecipientListFolderInput,
  type CreateRecipientListInput,
  type ListRecipientListFoldersQuery,
  type ListRecipientListsQuery,
  type RecipientListConditionInput,
  type RecipientListRecipientsOptionsQuery,
  type RecipientListRulesGroupInput,
  type RecipientListStatusesQuery,
  type RecipientReferenceInput,
  type UpdateRecipientListFolderInput,
  type UpdateRecipientListInput,
} from '@/modules/website/validators/recipient-lists.schema';
import { invalidateCacheByPrefix } from '@/utils/cache';
import { logger } from '@/utils/logger';

const CACHE_PREFIX = 'website:recipient-lists';
const recalculationLogger = logger.child({ module: 'WebsiteRecipientListsRecalculation' });
const RECALCULATION_MAX_CONCURRENCY = 1;
const RECALCULATION_REHYDRATE_INTERVAL_MS = 30000;
const RECALCULATION_STALE_AFTER_MS = 15 * 60 * 1000;

const recipientListFolderSelect = {
  id: true,
  nome: true,
  ordem: true,
  criadoEm: true,
  atualizadoEm: true,
  _count: {
    select: {
      Lists: true,
    },
  },
} satisfies Prisma.WebsiteRecipientListFolderSelect;

const recipientListSelect = {
  id: true,
  nome: true,
  descricao: true,
  folderId: true,
  status: true,
  membershipMode: true,
  rulesConfig: true,
  manualIncludes: true,
  manualExcludes: true,
  recipientCount: true,
  lastCalculatedAt: true,
  recalculationStatus: true,
  recalculationStartedAt: true,
  recalculationFinishedAt: true,
  recalculationError: true,
  criadoPorId: true,
  atualizadoPorId: true,
  criadoEm: true,
  atualizadoEm: true,
  Folder: {
    select: {
      id: true,
      nome: true,
    },
  },
  Members: {
    select: {
      id: true,
      recipientKind: true,
      recipientId: true,
      email: true,
      nome: true,
      role: true,
      source: true,
      criadoEm: true,
    },
    orderBy: [{ nome: 'asc' }, { email: 'asc' }],
    take: 200,
  },
} satisfies Prisma.WebsiteRecipientListSelect;

type RecipientListFolderRow = Prisma.WebsiteRecipientListFolderGetPayload<{
  select: typeof recipientListFolderSelect;
}>;

type CandidateRecipient = {
  recipientKind: 'MARKETING_LEAD' | 'USUARIO';
  recipientId: string;
  email: string;
  nome: string;
  role: string | null;
  source: 'RULE' | 'MANUAL_INCLUDE';
  context: {
    userStatus?: string | null;
    leadStatus?: string | null;
    popupId?: string | null;
    popupName?: string | null;
    tag?: string | null;
    ownerUsuarioId?: string | null;
    capturedAt?: Date | null;
    curriculoCount?: number;
    hasResume?: boolean;
    enrollmentCount?: number;
    hasEnrollment?: boolean;
    enrollmentCourseIds?: string[];
    enrollmentTurmaIds?: string[];
    enrollmentStatuses?: string[];
    enrollmentDates?: Date[];
    certificateCount?: number;
    hasCertificate?: boolean;
    planIds?: string[];
    hasPlan?: boolean;
    vacancyCount?: number;
    hasVacancies?: boolean;
    vacancyStatuses?: string[];
    instructorCourseIds?: string[];
    instructorTurmaIds?: string[];
    instructorAssignmentCount?: number;
  };
};

type CandidateKey = `${'MARKETING_LEAD' | 'USUARIO'}:${string}`;
type RecipientListProcessingStatus = 'IDLE' | 'PROCESSING' | 'FAILED';

const recalculationQueue = new Set<string>();
const activeRecalculations = new Set<string>();
let recalculationWorkerStarted = false;
let recalculationRehydrateTimer: ReturnType<typeof setInterval> | null = null;

function toCandidateKey(
  recipientKind: 'MARKETING_LEAD' | 'USUARIO',
  recipientId: string,
): CandidateKey {
  return `${recipientKind}:${recipientId}`;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function getElapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

function createNotFoundError(message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = 404;
  return error;
}

function createBusinessError(message: string, status = 400) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function formatEnumLabel(value: string) {
  const normalized = value.trim();
  if (!normalized) return value;

  const specialLabels: Record<string, string> = {
    ALUNO_CANDIDATO: 'ALUNO/CANDIDATO',
  };

  if (specialLabels[normalized]) {
    return specialLabels[normalized];
  }

  if (normalized === normalized.toUpperCase()) {
    return normalized.replaceAll('_', ' ');
  }

  return normalized;
}

function toNullableString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRecipientReferences(
  references?: RecipientReferenceInput[] | null,
): RecipientReferenceInput[] {
  if (!Array.isArray(references)) return [];

  const seen = new Set<string>();
  return references
    .filter((entry): entry is RecipientReferenceInput =>
      Boolean(entry?.recipientKind && entry?.recipientId),
    )
    .filter((entry) => {
      const key = `${entry.recipientKind}:${entry.recipientId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeRulesConfig(
  value?: RecipientListRulesGroupInput | Prisma.JsonValue | null,
): RecipientListRulesGroupInput | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as RecipientListRulesGroupInput;
  return {
    operator: raw.operator === 'OR' ? 'OR' : 'AND',
    conditions: Array.isArray(raw.conditions) ? raw.conditions : [],
    groups: Array.isArray(raw.groups)
      ? raw.groups
          .map((group: RecipientListRulesGroupInput) => normalizeRulesConfig(group))
          .filter(Boolean)
      : [],
  } as RecipientListRulesGroupInput;
}

function isBooleanField(field: RecipientListConditionInput['field']) {
  return [
    'student.hasResume',
    'student.hasEnrollment',
    'student.hasCertificate',
    'company.hasPlan',
    'company.hasVacancies',
  ].includes(field);
}

function requiresValue(operator: RecipientListConditionInput['operator']) {
  return !['EXISTS', 'NOT_EXISTS'].includes(operator);
}

function validateConditionShape(condition: RecipientListConditionInput) {
  if (!condition.field || !condition.operator) {
    throw createBusinessError('Todas as condições precisam ter campo e operador.');
  }

  if (!requiresValue(condition.operator)) return;

  if (condition.operator === 'BETWEEN') {
    const hasStart = String(condition.value ?? '').trim().length > 0;
    const hasEnd = String(condition.valueTo ?? '').trim().length > 0;

    if (!hasStart || !hasEnd) {
      throw createBusinessError('Condições do tipo entre precisam de valor inicial e final.');
    }

    return;
  }

  if (['IN', 'NOT_IN', 'HAS_ANY', 'HAS_ALL'].includes(condition.operator)) {
    if (!Array.isArray(condition.value) || condition.value.length === 0) {
      throw createBusinessError('Condições de múltipla seleção precisam de ao menos um valor.');
    }

    return;
  }

  if (isBooleanField(condition.field)) {
    if (typeof condition.value !== 'boolean') {
      throw createBusinessError('Campos booleanos aceitam apenas valores verdadeiro ou falso.');
    }

    return;
  }

  if (String(condition.value ?? '').trim().length === 0) {
    throw createBusinessError('Preencha todos os valores obrigatórios das condições.');
  }
}

function sanitizeListConfiguration(params: {
  membershipMode: 'MANUAL' | 'DINAMICA' | 'HIBRIDA';
  rulesConfig: RecipientListRulesGroupInput | null;
  manualIncludes: RecipientReferenceInput[];
  manualExcludes: RecipientReferenceInput[];
}) {
  const manualIncludes = normalizeRecipientReferences(params.manualIncludes);
  const manualExcludes = normalizeRecipientReferences(params.manualExcludes);
  const rulesConfig = params.rulesConfig
    ? {
        operator: params.rulesConfig.operator === 'OR' ? 'OR' : 'AND',
        conditions: Array.isArray(params.rulesConfig.conditions)
          ? params.rulesConfig.conditions
          : [],
        groups: Array.isArray(params.rulesConfig.groups) ? params.rulesConfig.groups : [],
      }
    : null;

  if ((rulesConfig?.groups?.length ?? 0) > 0) {
    throw createBusinessError(
      'Esta versão aceita apenas um grupo principal de regras, sem subgrupos aninhados.',
    );
  }

  const conditions = rulesConfig?.conditions ?? [];

  if (conditions.length > 20) {
    throw createBusinessError('A lista pode ter no máximo 20 condições.');
  }

  conditions.forEach(validateConditionShape);

  const conflictingKeys = manualIncludes.filter((include) =>
    manualExcludes.some(
      (exclude) =>
        exclude.recipientKind === include.recipientKind &&
        exclude.recipientId === include.recipientId,
    ),
  );

  if (conflictingKeys.length > 0) {
    throw createBusinessError(
      'O mesmo destinatário não pode estar em inclusões e exclusões da mesma lista.',
    );
  }

  if (params.membershipMode === 'MANUAL') {
    return {
      rulesConfig: null,
      manualIncludes,
      manualExcludes: [],
    };
  }

  if (conditions.length === 0) {
    throw createBusinessError(
      'Listas dinâmicas e híbridas precisam de ao menos uma condição válida.',
    );
  }

  if (params.membershipMode === 'DINAMICA') {
    return {
      rulesConfig: {
        operator: rulesConfig?.operator === 'OR' ? 'OR' : 'AND',
        conditions,
        groups: [],
      } as RecipientListRulesGroupInput,
      manualIncludes: [],
      manualExcludes: [],
    };
  }

  return {
    rulesConfig: {
      operator: rulesConfig?.operator === 'OR' ? 'OR' : 'AND',
      conditions,
      groups: [],
    } as RecipientListRulesGroupInput,
    manualIncludes,
    manualExcludes,
  };
}

function getComparableDate(value: unknown): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function containsAll(haystack: string[], needles: string[]) {
  return needles.every((needle) => haystack.includes(needle));
}

function containsAny(haystack: string[], needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function compareCondition(actualValue: unknown, condition: RecipientListConditionInput): boolean {
  const actualArray = asArray(actualValue)
    .map((item) => (item === null || item === undefined ? null : String(item)))
    .filter((item): item is string => item !== null);
  const conditionArray = asArray(condition.value)
    .map((item) => (item === null || item === undefined ? null : String(item)))
    .filter((item): item is string => item !== null);

  switch (condition.operator) {
    case 'IS':
      return String(actualValue ?? '') === String(condition.value ?? '');
    case 'IS_NOT':
      return String(actualValue ?? '') !== String(condition.value ?? '');
    case 'IN':
      return conditionArray.includes(String(actualValue ?? ''));
    case 'NOT_IN':
      return !conditionArray.includes(String(actualValue ?? ''));
    case 'EXISTS':
      return Array.isArray(actualValue)
        ? actualValue.length > 0
        : actualValue !== null && actualValue !== undefined && String(actualValue).trim() !== '';
    case 'NOT_EXISTS':
      return Array.isArray(actualValue)
        ? actualValue.length === 0
        : actualValue === null || actualValue === undefined || String(actualValue).trim() === '';
    case 'GT':
      return Number(actualValue ?? 0) > Number(condition.value ?? 0);
    case 'GTE':
      return Number(actualValue ?? 0) >= Number(condition.value ?? 0);
    case 'LT':
      return Number(actualValue ?? 0) < Number(condition.value ?? 0);
    case 'LTE':
      return Number(actualValue ?? 0) <= Number(condition.value ?? 0);
    case 'BETWEEN': {
      const actualDate = getComparableDate(actualValue);
      const start = getComparableDate(condition.value);
      const end = getComparableDate(condition.valueTo);
      if (actualDate === null || start === null || end === null) return false;
      return actualDate >= start && actualDate <= end;
    }
    case 'HAS_ANY':
      return containsAny(actualArray, conditionArray);
    case 'HAS_ALL':
      return containsAll(actualArray, conditionArray);
    default:
      return false;
  }
}

function resolveConditionValue(
  candidate: CandidateRecipient,
  field: RecipientListConditionInput['field'],
): unknown {
  switch (field) {
    case 'recipient.base.kind':
      return candidate.recipientKind;
    case 'recipient.user.role':
      return candidate.role;
    case 'recipient.user.status':
      return candidate.context.userStatus ?? null;
    case 'lead.popupId':
      return candidate.context.popupId ?? null;
    case 'lead.status':
      return candidate.context.leadStatus ?? null;
    case 'lead.tag':
      return candidate.context.tag ?? null;
    case 'lead.captureDate':
      return candidate.context.capturedAt ?? null;
    case 'lead.ownerUsuarioId':
      return candidate.context.ownerUsuarioId ?? null;
    case 'student.hasResume':
      return candidate.context.hasResume ?? false;
    case 'student.resumeCount':
      return candidate.context.curriculoCount ?? 0;
    case 'student.hasEnrollment':
      return candidate.context.hasEnrollment ?? false;
    case 'student.courseId':
      return candidate.context.enrollmentCourseIds ?? [];
    case 'student.enrollmentDate':
      return candidate.context.enrollmentDates ?? [];
    case 'student.enrollmentStatus':
      return candidate.context.enrollmentStatuses ?? [];
    case 'student.hasCertificate':
      return candidate.context.hasCertificate ?? false;
    case 'student.turmaId':
      return candidate.context.enrollmentTurmaIds ?? [];
    case 'company.hasPlan':
      return candidate.context.hasPlan ?? false;
    case 'company.planId':
      return candidate.context.planIds ?? [];
    case 'company.hasVacancies':
      return candidate.context.hasVacancies ?? false;
    case 'company.vacancyStatus':
      return candidate.context.vacancyStatuses ?? [];
    case 'company.vacancyCount':
      return candidate.context.vacancyCount ?? 0;
    case 'instructor.courseId':
      return candidate.context.instructorCourseIds ?? [];
    case 'instructor.turmaId':
      return candidate.context.instructorTurmaIds ?? [];
    case 'instructor.assignmentCount':
      return candidate.context.instructorAssignmentCount ?? 0;
    default:
      return null;
  }
}

function matchesRulesGroup(
  candidate: CandidateRecipient,
  group: RecipientListRulesGroupInput | null,
): boolean {
  if (!group) return true;

  const conditionResults = (group.conditions ?? []).map((condition: RecipientListConditionInput) =>
    compareCondition(resolveConditionValue(candidate, condition.field), condition),
  );
  const groupResults = (group.groups ?? []).map((child: RecipientListRulesGroupInput) =>
    matchesRulesGroup(candidate, child),
  );
  const results = [...conditionResults, ...groupResults];

  if (results.length === 0) return true;
  return group.operator === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

async function ensureFolderExists(folderId?: string | null) {
  if (!folderId) return null;
  const folder = await prisma.websiteRecipientListFolder.findUnique({
    where: { id: folderId },
    select: { id: true },
  });
  if (!folder) throw createBusinessError('Pasta da lista não encontrada.', 404);
  return folder.id;
}

function collectConditionFields(
  group: RecipientListRulesGroupInput | null,
): Set<RecipientListConditionInput['field']> {
  const fields = new Set<RecipientListConditionInput['field']>();
  for (const condition of group?.conditions ?? []) {
    fields.add(condition.field);
  }
  return fields;
}

function buildScalarWhere(
  fieldName: string,
  condition: RecipientListConditionInput,
): Record<string, unknown> | null {
  switch (condition.operator) {
    case 'IS':
      return { [fieldName]: condition.value };
    case 'IS_NOT':
      return { [fieldName]: { not: condition.value } };
    case 'IN':
    case 'HAS_ANY':
    case 'HAS_ALL':
      return Array.isArray(condition.value) ? { [fieldName]: { in: condition.value } } : null;
    case 'NOT_IN':
      return Array.isArray(condition.value) ? { [fieldName]: { notIn: condition.value } } : null;
    case 'GT':
      return { [fieldName]: { gt: condition.value } };
    case 'GTE':
      return { [fieldName]: { gte: condition.value } };
    case 'LT':
      return { [fieldName]: { lt: condition.value } };
    case 'LTE':
      return { [fieldName]: { lte: condition.value } };
    case 'BETWEEN':
      return { [fieldName]: { gte: condition.value, lte: condition.valueTo } };
    case 'EXISTS':
      return { [fieldName]: { not: null } };
    case 'NOT_EXISTS':
      return { [fieldName]: null };
    default:
      return null;
  }
}

function buildLeadConditionWhere(
  condition: RecipientListConditionInput,
): Prisma.WebsitePopupLeadWhereInput | null {
  switch (condition.field) {
    case 'lead.popupId':
      return buildScalarWhere('ultimoPopupId', condition) as Prisma.WebsitePopupLeadWhereInput;
    case 'lead.status':
      return buildScalarWhere('status', condition) as Prisma.WebsitePopupLeadWhereInput;
    case 'lead.tag':
      return buildScalarWhere('tag', condition) as Prisma.WebsitePopupLeadWhereInput;
    case 'lead.ownerUsuarioId':
      return buildScalarWhere('ownerUsuarioId', condition) as Prisma.WebsitePopupLeadWhereInput;
    case 'lead.captureDate':
      return buildScalarWhere('ultimaCapturaEm', condition) as Prisma.WebsitePopupLeadWhereInput;
    default:
      return null;
  }
}

function buildUserConditionWhere(
  condition: RecipientListConditionInput,
): Prisma.UsuariosWhereInput | null {
  switch (condition.field) {
    case 'recipient.user.role':
      return buildScalarWhere('role', condition) as Prisma.UsuariosWhereInput;
    case 'recipient.user.status':
      return buildScalarWhere('status', condition) as Prisma.UsuariosWhereInput;
    case 'student.hasResume':
      if (condition.operator === 'IS') {
        return condition.value
          ? { UsuariosCurriculos: { some: {} } }
          : { UsuariosCurriculos: { none: {} } };
      }
      return null;
    case 'student.hasEnrollment':
      if (condition.operator === 'IS') {
        return condition.value
          ? { CursosTurmasInscricoes: { some: {} } }
          : { CursosTurmasInscricoes: { none: {} } };
      }
      return null;
    case 'student.courseId':
      if (condition.operator === 'IS') {
        return {
          CursosTurmasInscricoes: {
            some: { CursosTurmas: { cursoId: String(condition.value ?? '') } },
          },
        };
      }
      if (
        ['IN', 'HAS_ANY', 'HAS_ALL'].includes(condition.operator) &&
        Array.isArray(condition.value)
      ) {
        return {
          CursosTurmasInscricoes: {
            some: { CursosTurmas: { cursoId: { in: condition.value as string[] } } },
          },
        };
      }
      return null;
    case 'student.turmaId':
      return condition.operator === 'IS'
        ? { CursosTurmasInscricoes: { some: { turmaId: String(condition.value ?? '') } } }
        : Array.isArray(condition.value)
          ? { CursosTurmasInscricoes: { some: { turmaId: { in: condition.value as string[] } } } }
          : null;
    case 'student.enrollmentStatus':
      return condition.operator === 'IS'
        ? { CursosTurmasInscricoes: { some: { status: condition.value as StatusInscricao } } }
        : Array.isArray(condition.value)
          ? {
              CursosTurmasInscricoes: {
                some: { status: { in: condition.value as StatusInscricao[] } },
              },
            }
          : null;
    case 'student.enrollmentDate': {
      const where = buildScalarWhere('criadoEm', condition);
      return where ? { CursosTurmasInscricoes: { some: where } } : null;
    }
    case 'student.hasCertificate':
      if (condition.operator === 'IS') {
        return condition.value
          ? { CursosCertificadosEmitidos: { some: {} } }
          : { CursosCertificadosEmitidos: { none: {} } };
      }
      return null;
    case 'company.hasPlan':
      if (condition.operator === 'IS') {
        const planWhere = {
          status: {
            in: [EmpresasPlanoStatus.ATIVO, EmpresasPlanoStatus.SUSPENSO],
          },
        };
        return condition.value
          ? { EmpresasPlano: { some: planWhere } }
          : { EmpresasPlano: { none: planWhere } };
      }
      return null;
    case 'company.planId':
      return condition.operator === 'IS'
        ? {
            EmpresasPlano: {
              some: {
                status: { in: [EmpresasPlanoStatus.ATIVO, EmpresasPlanoStatus.SUSPENSO] },
                planosEmpresariaisId: String(condition.value ?? ''),
              },
            },
          }
        : Array.isArray(condition.value)
          ? {
              EmpresasPlano: {
                some: {
                  status: { in: [EmpresasPlanoStatus.ATIVO, EmpresasPlanoStatus.SUSPENSO] },
                  planosEmpresariaisId: { in: condition.value as string[] },
                },
              },
            }
          : null;
    case 'company.hasVacancies':
      if (condition.operator === 'IS') {
        return condition.value ? { EmpresasVagas: { some: {} } } : { EmpresasVagas: { none: {} } };
      }
      return null;
    case 'company.vacancyStatus':
      return condition.operator === 'IS'
        ? { EmpresasVagas: { some: { status: condition.value as StatusDeVagas } } }
        : Array.isArray(condition.value)
          ? { EmpresasVagas: { some: { status: { in: condition.value as StatusDeVagas[] } } } }
          : null;
    case 'instructor.courseId':
      return condition.operator === 'IS'
        ? {
            CursosTurmasInstrutores: {
              some: { CursosTurmas: { cursoId: String(condition.value ?? '') } },
            },
          }
        : Array.isArray(condition.value)
          ? {
              CursosTurmasInstrutores: {
                some: { CursosTurmas: { cursoId: { in: condition.value as string[] } } },
              },
            }
          : null;
    case 'instructor.turmaId':
      return condition.operator === 'IS'
        ? { CursosTurmasInstrutores: { some: { turmaId: String(condition.value ?? '') } } }
        : Array.isArray(condition.value)
          ? { CursosTurmasInstrutores: { some: { turmaId: { in: condition.value as string[] } } } }
          : null;
    default:
      return null;
  }
}

function buildTypedWhere<T>(
  group: RecipientListRulesGroupInput | null,
  compiler: (condition: RecipientListConditionInput) => T | null,
): T | undefined {
  const whereParts = (group?.conditions ?? [])
    .map((condition: RecipientListConditionInput) => compiler(condition))
    .filter((value: T | null): value is T => Boolean(value));

  if (whereParts.length === 0) return undefined;
  if ((group?.operator ?? 'AND') === 'OR') {
    return { OR: whereParts } as T;
  }
  return { AND: whereParts } as T;
}

function getConditionFieldDomain(
  field: RecipientListConditionInput['field'],
): 'LEAD' | 'USER' | 'SHARED' {
  if (field.startsWith('lead.')) return 'LEAD';
  if (field === 'recipient.base.kind') return 'SHARED';
  return 'USER';
}

function conditionRequiresDomainPresence(condition: RecipientListConditionInput) {
  if (isBooleanField(condition.field) && condition.operator === 'IS') {
    return Boolean(condition.value);
  }

  return ['IS', 'IN', 'HAS_ANY', 'HAS_ALL', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'EXISTS'].includes(
    condition.operator,
  );
}

function canFullyEvaluateLeadConditionInDatabase(condition: RecipientListConditionInput): boolean {
  if (condition.field === 'recipient.base.kind') {
    return ['IS', 'IS_NOT', 'IN', 'NOT_IN'].includes(condition.operator);
  }

  if (
    ['lead.popupId', 'lead.status', 'lead.tag', 'lead.ownerUsuarioId'].includes(condition.field)
  ) {
    return ['IS', 'IS_NOT', 'IN', 'NOT_IN', 'EXISTS', 'NOT_EXISTS'].includes(condition.operator);
  }

  if (condition.field === 'lead.captureDate') {
    return ['IS', 'IS_NOT', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN'].includes(condition.operator);
  }

  return false;
}

function canFullyEvaluateUserConditionInDatabase(condition: RecipientListConditionInput): boolean {
  if (condition.field === 'recipient.base.kind') {
    return ['IS', 'IS_NOT', 'IN', 'NOT_IN'].includes(condition.operator);
  }

  if (['recipient.user.role', 'recipient.user.status'].includes(condition.field)) {
    return ['IS', 'IS_NOT', 'IN', 'NOT_IN', 'EXISTS', 'NOT_EXISTS'].includes(condition.operator);
  }

  if (
    [
      'student.hasResume',
      'student.hasEnrollment',
      'student.hasCertificate',
      'company.hasPlan',
      'company.hasVacancies',
    ].includes(condition.field)
  ) {
    return condition.operator === 'IS';
  }

  if (
    [
      'student.courseId',
      'student.turmaId',
      'student.enrollmentStatus',
      'company.planId',
      'company.vacancyStatus',
      'instructor.courseId',
      'instructor.turmaId',
    ].includes(condition.field)
  ) {
    return ['IS', 'IN', 'HAS_ANY'].includes(condition.operator);
  }

  if (condition.field === 'student.enrollmentDate') {
    return ['IS', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN'].includes(condition.operator);
  }

  return false;
}

function canFullyEvaluateGroupInDatabase(
  group: RecipientListRulesGroupInput | null,
  predicate: (condition: RecipientListConditionInput) => boolean,
) {
  if (!group) return true;
  if ((group.groups?.length ?? 0) > 0) return false;
  return (group.conditions ?? []).every(predicate);
}

function resolveKindConstraint(group: RecipientListRulesGroupInput | null) {
  const defaultConstraint = { includeLeads: true, includeUsers: true };
  if (!group || group.operator !== 'AND') return defaultConstraint;

  let includeLeads = true;
  let includeUsers = true;

  for (const condition of group.conditions ?? []) {
    const fieldDomain = getConditionFieldDomain(condition.field);

    if (condition.field === 'recipient.base.kind') {
      includeLeads = includeLeads && compareCondition('MARKETING_LEAD', condition);
      includeUsers = includeUsers && compareCondition('USUARIO', condition);
      continue;
    }

    if (fieldDomain === 'USER' && conditionRequiresDomainPresence(condition)) {
      includeLeads = false;
      continue;
    }

    if (fieldDomain === 'LEAD' && conditionRequiresDomainPresence(condition)) {
      includeUsers = false;
    }
  }

  return { includeLeads, includeUsers };
}

async function fetchLeadCandidates(
  rulesConfig: RecipientListRulesGroupInput | null,
  options?: { skipPostFilter?: boolean },
): Promise<CandidateRecipient[]> {
  const where: Prisma.WebsitePopupLeadWhereInput = {
    removidoEm: null,
    email: { not: null },
    ...(buildTypedWhere(rulesConfig, buildLeadConditionWhere) ?? {}),
  };

  const leads = await prisma.websitePopupLead.findMany({
    where,
    select: {
      id: true,
      nome: true,
      email: true,
      ...(options?.skipPostFilter
        ? {}
        : {
            status: true,
            tag: true,
            ownerUsuarioId: true,
            ultimaCapturaEm: true,
            ultimoPopupId: true,
            ultimoPopupNome: true,
          }),
    },
  });

  return leads
    .filter((lead) => Boolean(lead.email))
    .map((lead) => ({
      recipientKind: 'MARKETING_LEAD',
      recipientId: lead.id,
      email: String(lead.email).trim(),
      nome: lead.nome?.trim() || String(lead.email).trim(),
      role: null,
      source: 'RULE',
      context: options?.skipPostFilter
        ? {}
        : {
            leadStatus: lead.status,
            popupId: lead.ultimoPopupId,
            popupName: lead.ultimoPopupNome,
            tag: lead.tag,
            ownerUsuarioId: lead.ownerUsuarioId,
            capturedAt: lead.ultimaCapturaEm,
          },
    }));
}

async function fetchUserCandidates(
  rulesConfig: RecipientListRulesGroupInput | null,
  options?: { skipPostFilter?: boolean },
): Promise<CandidateRecipient[]> {
  if (options?.skipPostFilter) {
    const users = await prisma.usuarios.findMany({
      where: buildTypedWhere(rulesConfig, buildUserConditionWhere),
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        role: true,
      },
    });

    return users
      .filter((user) => Boolean(user.email))
      .map(
        (user): CandidateRecipient => ({
          recipientKind: 'USUARIO',
          recipientId: user.id,
          email: String(user.email).trim(),
          nome: user.nomeCompleto.trim(),
          role: user.role,
          source: 'RULE',
          context: {},
        }),
      );
  }

  const fields = collectConditionFields(rulesConfig);
  const needsCurriculos = fields.has('student.hasResume') || fields.has('student.resumeCount');
  const needsInscricoes =
    fields.has('student.hasEnrollment') ||
    fields.has('student.courseId') ||
    fields.has('student.enrollmentDate') ||
    fields.has('student.enrollmentStatus') ||
    fields.has('student.turmaId');
  const needsCertificates = fields.has('student.hasCertificate');
  const needsPlans = fields.has('company.hasPlan') || fields.has('company.planId');
  const needsVacancies =
    fields.has('company.hasVacancies') ||
    fields.has('company.vacancyStatus') ||
    fields.has('company.vacancyCount');
  const needsInstructor =
    fields.has('instructor.courseId') ||
    fields.has('instructor.turmaId') ||
    fields.has('instructor.assignmentCount');

  const userSelect: any = {
    id: true,
    nomeCompleto: true,
    email: true,
    role: true,
    status: true,
    ...(needsCurriculos
      ? {
          UsuariosCurriculos: {
            select: { id: true },
          },
        }
      : {}),
    ...(needsInscricoes
      ? {
          CursosTurmasInscricoes: {
            select: {
              id: true,
              criadoEm: true,
              status: true,
              turmaId: true,
              CursosTurmas: {
                select: {
                  cursoId: true,
                },
              },
            },
          },
        }
      : {}),
    ...(needsCertificates
      ? {
          CursosCertificadosEmitidos: {
            select: { id: true },
          },
        }
      : {}),
    ...(needsPlans
      ? {
          EmpresasPlano: {
            where: {
              status: {
                in: [EmpresasPlanoStatus.ATIVO, EmpresasPlanoStatus.SUSPENSO],
              },
            },
            select: {
              planosEmpresariaisId: true,
            },
          },
        }
      : {}),
    ...(needsVacancies
      ? {
          EmpresasVagas: {
            select: {
              id: true,
              status: true,
            },
          },
        }
      : {}),
    ...(needsInstructor
      ? {
          CursosTurmasInstrutores: {
            select: {
              turmaId: true,
              CursosTurmas: {
                select: {
                  cursoId: true,
                },
              },
            },
          },
        }
      : {}),
  };

  const users = await prisma.usuarios.findMany({
    where: buildTypedWhere(rulesConfig, buildUserConditionWhere),
    select: userSelect,
  });

  return users
    .filter((user) => Boolean(user.email))
    .map((user: any) => {
      const enrollments = user.CursosTurmasInscricoes ?? [];
      const plans = user.EmpresasPlano ?? [];
      const vacancies = user.EmpresasVagas ?? [];
      const instructorAssignments = user.CursosTurmasInstrutores ?? [];

      return {
        recipientKind: 'USUARIO',
        recipientId: user.id,
        email: String(user.email).trim(),
        nome: user.nomeCompleto.trim(),
        role: user.role,
        source: 'RULE',
        context: {
          userStatus: user.status,
          curriculoCount: user.UsuariosCurriculos?.length ?? 0,
          hasResume: (user.UsuariosCurriculos?.length ?? 0) > 0,
          enrollmentCount: enrollments.length,
          hasEnrollment: enrollments.length > 0,
          enrollmentCourseIds: enrollments.map((item: any) => item.CursosTurmas.cursoId),
          enrollmentTurmaIds: enrollments.map((item: any) => item.turmaId),
          enrollmentStatuses: enrollments.map((item: any) => item.status),
          enrollmentDates: enrollments.map((item: any) => item.criadoEm),
          certificateCount: user.CursosCertificadosEmitidos?.length ?? 0,
          hasCertificate: (user.CursosCertificadosEmitidos?.length ?? 0) > 0,
          planIds: plans.map((item: any) => item.planosEmpresariaisId),
          hasPlan: plans.length > 0,
          vacancyCount: vacancies.length,
          hasVacancies: vacancies.length > 0,
          vacancyStatuses: vacancies.map((item: any) => item.status),
          instructorCourseIds: instructorAssignments.map((item: any) => item.CursosTurmas.cursoId),
          instructorTurmaIds: instructorAssignments.map((item: any) => item.turmaId),
          instructorAssignmentCount: instructorAssignments.length,
        },
      } satisfies CandidateRecipient;
    });
}

async function resolveRuleRecipients(
  membershipMode: 'MANUAL' | 'DINAMICA' | 'HIBRIDA',
  rulesConfig: RecipientListRulesGroupInput | null,
): Promise<CandidateRecipient[]> {
  if (membershipMode === 'MANUAL') return [];

  const kindConstraint = resolveKindConstraint(rulesConfig);
  const canEvaluateLeadsInDatabase = canFullyEvaluateGroupInDatabase(
    rulesConfig,
    canFullyEvaluateLeadConditionInDatabase,
  );
  const canEvaluateUsersInDatabase = canFullyEvaluateGroupInDatabase(
    rulesConfig,
    canFullyEvaluateUserConditionInDatabase,
  );

  const [leadCandidates, userCandidates] = await Promise.all([
    kindConstraint.includeLeads
      ? fetchLeadCandidates(rulesConfig, {
          skipPostFilter: canEvaluateLeadsInDatabase,
        })
      : Promise.resolve([]),
    kindConstraint.includeUsers
      ? fetchUserCandidates(rulesConfig, {
          skipPostFilter: canEvaluateUsersInDatabase,
        })
      : Promise.resolve([]),
  ]);

  return [
    ...leadCandidates.filter((candidate) =>
      canEvaluateLeadsInDatabase ? true : matchesRulesGroup(candidate, rulesConfig),
    ),
    ...userCandidates.filter((candidate) =>
      canEvaluateUsersInDatabase ? true : matchesRulesGroup(candidate, rulesConfig),
    ),
  ];
}

async function resolveManualRecipients(
  references: RecipientReferenceInput[],
): Promise<CandidateRecipient[]> {
  const leadIds = references
    .filter((item) => item.recipientKind === 'MARKETING_LEAD')
    .map((item) => item.recipientId);
  const userIds = references
    .filter((item) => item.recipientKind === 'USUARIO')
    .map((item) => item.recipientId);

  const [leads, users] = await Promise.all([
    leadIds.length > 0
      ? prisma.websitePopupLead.findMany({
          where: {
            id: { in: leadIds },
            removidoEm: null,
            email: { not: null },
          },
          select: {
            id: true,
            nome: true,
            email: true,
            status: true,
            tag: true,
            ownerUsuarioId: true,
            ultimaCapturaEm: true,
            ultimoPopupId: true,
            ultimoPopupNome: true,
          },
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? prisma.usuarios.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            role: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...leads.map(
      (lead): CandidateRecipient => ({
        recipientKind: 'MARKETING_LEAD',
        recipientId: lead.id,
        email: String(lead.email).trim(),
        nome: lead.nome?.trim() || String(lead.email).trim(),
        role: null,
        source: 'MANUAL_INCLUDE',
        context: {
          leadStatus: lead.status,
          popupId: lead.ultimoPopupId,
          popupName: lead.ultimoPopupNome,
          tag: lead.tag,
          ownerUsuarioId: lead.ownerUsuarioId,
          capturedAt: lead.ultimaCapturaEm,
        },
      }),
    ),
    ...users.map(
      (user): CandidateRecipient => ({
        recipientKind: 'USUARIO',
        recipientId: user.id,
        email: String(user.email).trim(),
        nome: user.nomeCompleto.trim(),
        role: user.role,
        source: 'MANUAL_INCLUDE',
        context: {
          userStatus: user.status,
        },
      }),
    ),
  ];
}

function mergeRecipients(candidates: CandidateRecipient[]) {
  const map = new Map<string, CandidateRecipient>();

  for (const candidate of candidates) {
    const key = `${candidate.recipientKind}:${candidate.recipientId}`;
    if (!map.has(key)) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values());
}

async function syncRecipientMembers(listId: string, merged: CandidateRecipient[]) {
  await prisma.$transaction(async (tx) => {
    const existingMembers = await tx.websiteRecipientListMember.findMany({
      where: { listId },
      select: {
        recipientKind: true,
        recipientId: true,
        email: true,
        nome: true,
        role: true,
        source: true,
      },
    });

    const existingMap = new Map(
      existingMembers.map((member) => [
        toCandidateKey(
          member.recipientKind === WebsiteRecipientListRecipientKind.MARKETING_LEAD
            ? 'MARKETING_LEAD'
            : 'USUARIO',
          member.recipientId,
        ),
        member,
      ]),
    );

    const nextMap = new Map(
      merged.map((candidate) => [
        toCandidateKey(candidate.recipientKind, candidate.recipientId),
        candidate,
      ]),
    );

    const keysToDelete: CandidateKey[] = [];
    const rowsToInsert = merged.filter((candidate) => {
      const key = toCandidateKey(candidate.recipientKind, candidate.recipientId);
      const existing = existingMap.get(key);

      if (!existing) return true;

      const nextSource =
        candidate.source === 'MANUAL_INCLUDE'
          ? WebsiteRecipientListMemberSource.MANUAL_INCLUDE
          : WebsiteRecipientListMemberSource.RULE;

      const hasChanged =
        existing.email !== candidate.email ||
        existing.nome !== candidate.nome ||
        (existing.role ?? null) !== (candidate.role ?? null) ||
        existing.source !== nextSource;

      if (hasChanged) {
        keysToDelete.push(key);
        return true;
      }

      return false;
    });

    for (const key of existingMap.keys()) {
      if (!nextMap.has(key)) {
        keysToDelete.push(key);
      }
    }

    for (const batch of chunkArray(Array.from(new Set(keysToDelete)), 250)) {
      await tx.websiteRecipientListMember.deleteMany({
        where: {
          listId,
          OR: batch.map((key) => {
            const [recipientKind, recipientId] = key.split(':');
            return {
              recipientKind:
                recipientKind === 'MARKETING_LEAD'
                  ? WebsiteRecipientListRecipientKind.MARKETING_LEAD
                  : WebsiteRecipientListRecipientKind.USUARIO,
              recipientId,
            };
          }),
        },
      });
    }

    for (const batch of chunkArray(rowsToInsert, 500)) {
      if (batch.length === 0) continue;
      await tx.websiteRecipientListMember.createMany({
        data: batch.map((candidate) => ({
          listId,
          recipientKind:
            candidate.recipientKind === 'MARKETING_LEAD'
              ? WebsiteRecipientListRecipientKind.MARKETING_LEAD
              : WebsiteRecipientListRecipientKind.USUARIO,
          recipientId: candidate.recipientId,
          email: candidate.email,
          nome: candidate.nome,
          role: candidate.role as Roles | null,
          source:
            candidate.source === 'MANUAL_INCLUDE'
              ? WebsiteRecipientListMemberSource.MANUAL_INCLUDE
              : WebsiteRecipientListMemberSource.RULE,
        })),
        skipDuplicates: true,
      });
    }

    await tx.websiteRecipientList.update({
      where: { id: listId },
      data: {
        recipientCount: merged.length,
        lastCalculatedAt: new Date(),
      },
    });
  });
}

async function materializeMembers(
  listId: string,
  membershipMode: 'MANUAL' | 'DINAMICA' | 'HIBRIDA',
  rulesConfig: RecipientListRulesGroupInput | null,
  manualIncludes: RecipientReferenceInput[],
  manualExcludes: RecipientReferenceInput[],
) {
  const ruleRecipients = await resolveRuleRecipients(membershipMode, rulesConfig);
  const manualRecipients =
    membershipMode === 'DINAMICA' ? [] : await resolveManualRecipients(manualIncludes);
  const excludedKeys = new Set(
    manualExcludes.map((entry) => `${entry.recipientKind}:${entry.recipientId}`),
  );

  const merged = mergeRecipients([...ruleRecipients, ...manualRecipients]).filter(
    (candidate) => !excludedKeys.has(`${candidate.recipientKind}:${candidate.recipientId}`),
  );

  await syncRecipientMembers(listId, merged);
}

async function finalizeRecalculation(
  listId: string,
  status: RecipientListProcessingStatus,
  errorMessage?: string | null,
) {
  await prisma.websiteRecipientList.update({
    where: { id: listId },
    data: {
      recalculationStatus: status,
      recalculationFinishedAt: new Date(),
      recalculationError: errorMessage ? errorMessage.slice(0, 500) : null,
    },
  });
}

async function performQueuedRecalculation(listId: string) {
  const totalStartedAt = Date.now();
  const metrics = {
    loadConfigMs: 0,
    resolveRuleRecipientsMs: 0,
    resolveManualRecipientsMs: 0,
    syncMembersMs: 0,
    totalMs: 0,
    ruleRecipients: 0,
    manualRecipients: 0,
    finalRecipients: 0,
  };

  try {
    const loadConfigStartedAt = Date.now();
    const existing = await prisma.websiteRecipientList.findUnique({
      where: { id: listId },
      select: {
        id: true,
        membershipMode: true,
        rulesConfig: true,
        manualIncludes: true,
        manualExcludes: true,
      },
    });
    metrics.loadConfigMs = getElapsedMs(loadConfigStartedAt);

    if (!existing) {
      return;
    }

    const membershipMode = existing.membershipMode;
    const rulesConfig = normalizeRulesConfig(existing.rulesConfig);
    const manualIncludes = normalizeRecipientReferences(
      existing.manualIncludes as RecipientReferenceInput[] | null | undefined,
    );
    const manualExcludes = normalizeRecipientReferences(
      existing.manualExcludes as RecipientReferenceInput[] | null | undefined,
    );

    const resolveRuleRecipientsStartedAt = Date.now();
    const ruleRecipients = await resolveRuleRecipients(membershipMode, rulesConfig);
    metrics.resolveRuleRecipientsMs = getElapsedMs(resolveRuleRecipientsStartedAt);
    metrics.ruleRecipients = ruleRecipients.length;

    const resolveManualRecipientsStartedAt = Date.now();
    const manualRecipients =
      membershipMode === 'DINAMICA' ? [] : await resolveManualRecipients(manualIncludes);
    metrics.resolveManualRecipientsMs = getElapsedMs(resolveManualRecipientsStartedAt);
    metrics.manualRecipients = manualRecipients.length;

    const excludedKeys = new Set(
      manualExcludes.map((entry) => `${entry.recipientKind}:${entry.recipientId}`),
    );

    const merged = mergeRecipients([...ruleRecipients, ...manualRecipients]).filter(
      (candidate) => !excludedKeys.has(`${candidate.recipientKind}:${candidate.recipientId}`),
    );
    metrics.finalRecipients = merged.length;

    const syncMembersStartedAt = Date.now();
    await syncRecipientMembers(listId, merged);
    metrics.syncMembersMs = getElapsedMs(syncMembersStartedAt);

    await finalizeRecalculation(listId, 'IDLE');
    metrics.totalMs = getElapsedMs(totalStartedAt);
    recalculationLogger.info(
      {
        listId,
        metrics,
      },
      'Recálculo finalizado',
    );
  } catch (error) {
    metrics.totalMs = getElapsedMs(totalStartedAt);
    recalculationLogger.error({ err: error, listId }, 'Falha ao recalcular lista');
    recalculationLogger.warn(
      {
        listId,
        metrics,
      },
      'Recálculo abortado',
    );
    await finalizeRecalculation(
      listId,
      'FAILED',
      error instanceof Error ? error.message : 'Erro ao recalcular lista',
    );
  } finally {
    await invalidateCacheByPrefix(CACHE_PREFIX);
  }
}

async function processRecalculationQueue() {
  while (activeRecalculations.size < RECALCULATION_MAX_CONCURRENCY && recalculationQueue.size > 0) {
    const [nextListId] = recalculationQueue;
    if (!nextListId) return;

    recalculationQueue.delete(nextListId);
    if (activeRecalculations.has(nextListId)) {
      continue;
    }

    activeRecalculations.add(nextListId);
    void (async () => {
      try {
        await performQueuedRecalculation(nextListId);
      } finally {
        activeRecalculations.delete(nextListId);
        if (recalculationQueue.size > 0) {
          void processRecalculationQueue();
        }
      }
    })();
  }
}

function enqueueRecalculation(listId: string) {
  recalculationQueue.add(listId);
  void processRecalculationQueue();
}

async function rehydrateProcessingLists() {
  const processingLists = await prisma.websiteRecipientList.findMany({
    where: {
      recalculationStatus: 'PROCESSING',
    },
    select: {
      id: true,
      recalculationStartedAt: true,
    },
    orderBy: [{ recalculationStartedAt: 'asc' }, { atualizadoEm: 'asc' }],
    take: 50,
  });

  const now = Date.now();

  for (const list of processingLists) {
    if (activeRecalculations.has(list.id)) {
      continue;
    }

    const startedAt = list.recalculationStartedAt?.getTime() ?? now;
    const isStale = now - startedAt > RECALCULATION_STALE_AFTER_MS;

    if (isStale) {
      recalculationLogger.warn(
        {
          listId: list.id,
          recalculationStartedAt: list.recalculationStartedAt,
        },
        'Lista presa em PROCESSING marcada como FAILED',
      );

      await finalizeRecalculation(list.id, 'FAILED', 'Recálculo interrompido por timeout interno.');
      continue;
    }

    enqueueRecalculation(list.id);
  }
}

async function buildRecipientListDetail(id: string) {
  const list = await prisma.websiteRecipientList.findUnique({
    where: { id },
    select: recipientListSelect,
  });

  if (!list) return null;

  return {
    ...list,
    rulesConfig: normalizeRulesConfig(list.rulesConfig),
    manualIncludes: normalizeRecipientReferences(
      list.manualIncludes as RecipientReferenceInput[] | null | undefined,
    ),
    manualExcludes: normalizeRecipientReferences(
      list.manualExcludes as RecipientReferenceInput[] | null | undefined,
    ),
  };
}

export function startRecipientListRecalculationWorker() {
  if (recalculationWorkerStarted) return;
  recalculationWorkerStarted = true;

  void rehydrateProcessingLists().catch((error) => {
    recalculationLogger.warn({ err: error }, 'Falha ao reidratar listas em processamento');
  });

  recalculationRehydrateTimer = setInterval(() => {
    void rehydrateProcessingLists().catch((error) => {
      recalculationLogger.warn({ err: error }, 'Falha ao sincronizar fila de recalculacao');
    });
  }, RECALCULATION_REHYDRATE_INTERVAL_MS);

  recalculationRehydrateTimer.unref?.();
}

export const websiteRecipientListsService = {
  async listFolders(query: ListRecipientListFoldersQuery) {
    const folders = await prisma.websiteRecipientListFolder.findMany({
      where: query.search
        ? {
            nome: { contains: query.search, mode: 'insensitive' },
          }
        : undefined,
      select: recipientListFolderSelect,
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });

    return folders.map((folder: RecipientListFolderRow) => ({
      ...folder,
      listCount: folder._count.Lists,
    }));
  },

  async createFolder(input: CreateRecipientListFolderInput, actorId?: string | null) {
    const folder = await prisma.websiteRecipientListFolder.create({
      data: {
        nome: input.nome.trim(),
        ordem: input.ordem ?? 0,
        criadoPorId: actorId ?? null,
        atualizadoPorId: actorId ?? null,
      },
      select: recipientListFolderSelect,
    });

    await invalidateCacheByPrefix(CACHE_PREFIX);
    return {
      ...folder,
      listCount: folder._count.Lists,
    };
  },

  async updateFolder(id: string, input: UpdateRecipientListFolderInput, actorId?: string | null) {
    const existing = await prisma.websiteRecipientListFolder.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) throw createNotFoundError('Pasta da lista não encontrada.');

    const folder = await prisma.websiteRecipientListFolder.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome.trim() } : {}),
        ...(input.ordem !== undefined ? { ordem: input.ordem } : {}),
        atualizadoPorId: actorId ?? null,
      },
      select: recipientListFolderSelect,
    });

    await invalidateCacheByPrefix(CACHE_PREFIX);
    return {
      ...folder,
      listCount: folder._count.Lists,
    };
  },

  async removeFolder(id: string) {
    const folder = await prisma.websiteRecipientListFolder.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: {
            Lists: true,
          },
        },
      },
    });

    if (!folder) throw createNotFoundError('Pasta da lista não encontrada.');
    if (folder._count.Lists > 0) {
      throw createBusinessError('Remova ou mova as listas desta pasta antes de excluir.');
    }

    await prisma.websiteRecipientListFolder.delete({ where: { id } });
    await invalidateCacheByPrefix(CACHE_PREFIX);
  },

  async list(query: ListRecipientListsQuery) {
    const where: Prisma.WebsiteRecipientListWhereInput = {};

    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { descricao: { contains: query.search, mode: 'insensitive' } },
        { id: query.search },
      ];
    }

    if (query.folderId) where.folderId = query.folderId;
    if (query.status) where.status = query.status as WebsiteRecipientListStatus;
    if (query.membershipMode) where.membershipMode = query.membershipMode;

    if (query.updatedFrom || query.updatedTo) {
      where.atualizadoEm = {
        ...(query.updatedFrom ? { gte: startOfDay(query.updatedFrom) } : {}),
        ...(query.updatedTo ? { lte: endOfDay(query.updatedTo) } : {}),
      };
    }

    const skip = (query.page - 1) * query.pageSize;
    const [total, lists] = await Promise.all([
      prisma.websiteRecipientList.count({ where }),
      prisma.websiteRecipientList.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ atualizadoEm: 'desc' }],
        select: {
          id: true,
          nome: true,
          descricao: true,
          status: true,
          membershipMode: true,
          recipientCount: true,
          lastCalculatedAt: true,
          recalculationStatus: true,
          recalculationStartedAt: true,
          recalculationFinishedAt: true,
          recalculationError: true,
          criadoEm: true,
          atualizadoEm: true,
          Folder: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      }),
    ]);

    return {
      lists,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  },

  async listStatuses(query: RecipientListStatusesQuery) {
    if (query.listIds.length === 0) return [];

    return prisma.websiteRecipientList.findMany({
      where: {
        id: { in: query.listIds },
      },
      select: {
        id: true,
        recipientCount: true,
        lastCalculatedAt: true,
        recalculationStatus: true,
        recalculationStartedAt: true,
        recalculationFinishedAt: true,
        recalculationError: true,
        atualizadoEm: true,
      },
      orderBy: { atualizadoEm: 'desc' },
    });
  },

  async get(id: string) {
    return buildRecipientListDetail(id);
  },

  async create(input: CreateRecipientListInput, actorId?: string | null) {
    await ensureFolderExists(input.folderId);

    const sanitizedConfig = sanitizeListConfiguration({
      membershipMode: input.membershipMode,
      rulesConfig: normalizeRulesConfig(input.rulesConfig),
      manualIncludes: input.manualIncludes ?? [],
      manualExcludes: input.manualExcludes ?? [],
    });

    const list = await prisma.websiteRecipientList.create({
      data: {
        nome: input.nome.trim(),
        descricao: toNullableString(input.descricao),
        folderId: input.folderId ?? null,
        status: input.status,
        membershipMode: input.membershipMode,
        rulesConfig: sanitizedConfig.rulesConfig
          ? (sanitizedConfig.rulesConfig as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        manualIncludes:
          sanitizedConfig.manualIncludes.length > 0
            ? (sanitizedConfig.manualIncludes as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        manualExcludes:
          sanitizedConfig.manualExcludes.length > 0
            ? (sanitizedConfig.manualExcludes as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        criadoPorId: actorId ?? null,
        atualizadoPorId: actorId ?? null,
      },
      select: { id: true },
    });

    await materializeMembers(
      list.id,
      input.membershipMode,
      sanitizedConfig.rulesConfig,
      sanitizedConfig.manualIncludes,
      sanitizedConfig.manualExcludes,
    );

    await invalidateCacheByPrefix(CACHE_PREFIX);
    return buildRecipientListDetail(list.id);
  },

  async update(id: string, input: UpdateRecipientListInput, actorId?: string | null) {
    const existing = await prisma.websiteRecipientList.findUnique({
      where: { id },
      select: {
        id: true,
        membershipMode: true,
        rulesConfig: true,
        manualIncludes: true,
        manualExcludes: true,
      },
    });

    if (!existing) throw createNotFoundError('Lista não encontrada.');

    const nextFolderId =
      input.folderId !== undefined ? await ensureFolderExists(input.folderId) : undefined;
    const nextMembershipMode = input.membershipMode ?? existing.membershipMode;
    const rawNextRulesConfig =
      input.rulesConfig !== undefined
        ? normalizeRulesConfig(input.rulesConfig)
        : normalizeRulesConfig(existing.rulesConfig);
    const rawNextManualIncludes =
      input.manualIncludes !== undefined
        ? normalizeRecipientReferences(input.manualIncludes)
        : normalizeRecipientReferences(
            existing.manualIncludes as RecipientReferenceInput[] | null | undefined,
          );
    const rawNextManualExcludes =
      input.manualExcludes !== undefined
        ? normalizeRecipientReferences(input.manualExcludes)
        : normalizeRecipientReferences(
            existing.manualExcludes as RecipientReferenceInput[] | null | undefined,
          );
    const sanitizedConfig = sanitizeListConfiguration({
      membershipMode: nextMembershipMode,
      rulesConfig: rawNextRulesConfig,
      manualIncludes: rawNextManualIncludes,
      manualExcludes: rawNextManualExcludes,
    });

    await prisma.websiteRecipientList.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome.trim() } : {}),
        ...(input.descricao !== undefined ? { descricao: toNullableString(input.descricao) } : {}),
        ...(input.folderId !== undefined ? { folderId: nextFolderId ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.membershipMode !== undefined ? { membershipMode: input.membershipMode } : {}),
        ...(input.rulesConfig !== undefined || nextMembershipMode === 'MANUAL'
          ? {
              rulesConfig: sanitizedConfig.rulesConfig
                ? (sanitizedConfig.rulesConfig as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(input.manualIncludes !== undefined || nextMembershipMode === 'DINAMICA'
          ? {
              manualIncludes:
                sanitizedConfig.manualIncludes.length > 0
                  ? (sanitizedConfig.manualIncludes as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            }
          : {}),
        ...(input.manualExcludes !== undefined ||
        nextMembershipMode === 'DINAMICA' ||
        nextMembershipMode === 'MANUAL'
          ? {
              manualExcludes:
                sanitizedConfig.manualExcludes.length > 0
                  ? (sanitizedConfig.manualExcludes as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            }
          : {}),
        atualizadoPorId: actorId ?? null,
      },
    });

    await materializeMembers(
      id,
      nextMembershipMode,
      sanitizedConfig.rulesConfig,
      sanitizedConfig.manualIncludes,
      sanitizedConfig.manualExcludes,
    );

    await invalidateCacheByPrefix(CACHE_PREFIX);
    return buildRecipientListDetail(id);
  },

  async remove(id: string) {
    const existing = await prisma.websiteRecipientList.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw createNotFoundError('Lista não encontrada.');

    await prisma.websiteRecipientList.delete({ where: { id } });
    await invalidateCacheByPrefix(CACHE_PREFIX);
  },

  async recalculate(id: string, actorId?: string | null) {
    const transition = await prisma.websiteRecipientList.updateMany({
      where: {
        id,
        recalculationStatus: {
          not: 'PROCESSING',
        },
      },
      data: {
        recalculationStatus: 'PROCESSING',
        recalculationStartedAt: new Date(),
        recalculationFinishedAt: null,
        recalculationError: null,
        atualizadoPorId: actorId ?? null,
      },
    });

    const list = await buildRecipientListDetail(id);
    if (!list) throw createNotFoundError('Lista não encontrada.');

    if (transition.count > 0) {
      enqueueRecalculation(id);
      await invalidateCacheByPrefix(CACHE_PREFIX);
    }

    return list;
  },

  async getRuleOptions() {
    const [popups, owners, plans, cursos, turmas, tags] = await Promise.all([
      prisma.websitePopup.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.usuarios.findMany({
        where: {
          role: {
            in: [Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS, Roles.RECRUTADOR],
          },
        },
        select: { id: true, nomeCompleto: true },
        orderBy: { nomeCompleto: 'asc' },
        take: 200,
      }),
      prisma.planosEmpresariais.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.cursos.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
        take: 300,
      }),
      prisma.cursosTurmas.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
        take: 300,
      }),
      prisma.websitePopupLead.findMany({
        where: {
          removidoEm: null,
          tag: { not: null },
        },
        select: { tag: true },
        distinct: ['tag'],
        orderBy: { tag: 'asc' },
      }),
    ]);

    const categories = [
      {
        key: 'base',
        label: 'Destinatário',
        fields: [
          {
            field: 'recipient.base.kind',
            label: 'Tipo do destinatário',
            operators: ['IS', 'IS_NOT', 'IN', 'NOT_IN'],
          },
          {
            field: 'recipient.user.role',
            label: 'Role do usuário',
            operators: ['IS', 'IS_NOT', 'IN', 'NOT_IN'],
          },
          {
            field: 'recipient.user.status',
            label: 'Status do usuário',
            operators: ['IS', 'IS_NOT', 'IN', 'NOT_IN'],
          },
        ],
      },
      {
        key: 'marketing',
        label: 'Contatos',
        fields: [
          { field: 'lead.popupId', label: 'Pop-up / origem', operators: ['IS', 'IN'] },
          { field: 'lead.status', label: 'Status do contato', operators: ['IS', 'IN'] },
          { field: 'lead.tag', label: 'Tag do contato', operators: ['IS', 'IN', 'HAS_ANY'] },
          { field: 'lead.captureDate', label: 'Data de captura', operators: ['BETWEEN'] },
          {
            field: 'lead.ownerUsuarioId',
            label: 'Responsável do contato',
            operators: ['IS', 'IN'],
          },
        ],
      },
      {
        key: 'student',
        label: 'Aluno / candidato',
        fields: [
          { field: 'student.hasResume', label: 'Possui currículo', operators: ['IS'] },
          {
            field: 'student.resumeCount',
            label: 'Quantidade de currículos',
            operators: ['GT', 'GTE', 'LT', 'LTE'],
          },
          {
            field: 'student.hasEnrollment',
            label: 'Possui candidatura/inscrição',
            operators: ['IS'],
          },
          {
            field: 'student.courseId',
            label: 'Curso vinculado',
            operators: ['HAS_ANY', 'HAS_ALL'],
          },
          {
            field: 'student.enrollmentDate',
            label: 'Período da inscrição',
            operators: ['BETWEEN'],
          },
          {
            field: 'student.enrollmentStatus',
            label: 'Status da inscrição',
            operators: ['HAS_ANY', 'HAS_ALL'],
          },
          { field: 'student.hasCertificate', label: 'Possui certificado', operators: ['IS'] },
          { field: 'student.turmaId', label: 'Turma', operators: ['HAS_ANY', 'HAS_ALL'] },
        ],
      },
      {
        key: 'company',
        label: 'Empresa',
        fields: [
          { field: 'company.hasPlan', label: 'Possui plano', operators: ['IS'] },
          { field: 'company.planId', label: 'Plano específico', operators: ['HAS_ANY', 'HAS_ALL'] },
          { field: 'company.hasVacancies', label: 'Possui vagas', operators: ['IS'] },
          {
            field: 'company.vacancyStatus',
            label: 'Status da vaga',
            operators: ['HAS_ANY', 'HAS_ALL'],
          },
          {
            field: 'company.vacancyCount',
            label: 'Quantidade de vagas',
            operators: ['GT', 'GTE', 'LT', 'LTE'],
          },
        ],
      },
      {
        key: 'instructor',
        label: 'Instrutor',
        fields: [
          {
            field: 'instructor.courseId',
            label: 'Curso vinculado',
            operators: ['HAS_ANY', 'HAS_ALL'],
          },
          {
            field: 'instructor.turmaId',
            label: 'Turma vinculada',
            operators: ['HAS_ANY', 'HAS_ALL'],
          },
          {
            field: 'instructor.assignmentCount',
            label: 'Quantidade de vínculos',
            operators: ['GT', 'GTE', 'LT', 'LTE'],
          },
        ],
      },
    ] as const;

    const routines = categories.map((category) => ({
      key: category.key,
      label: category.label,
      fields: category.fields.map((field) => ({
        ...field,
        routineKey: category.key,
        routineLabel: category.label,
      })),
    }));

    return {
      roles: Object.values(Roles).map((value) => ({ value, label: formatEnumLabel(value) })),
      userStatuses: Object.values(Status).map((value) => ({
        value,
        label: formatEnumLabel(value),
      })),
      leadStatuses: Object.values(WebsitePopupLeadStatus).map((value) => ({
        value,
        label: formatEnumLabel(value),
      })),
      enrollmentStatuses: Object.values(StatusInscricao).map((value) => ({
        value,
        label: formatEnumLabel(value),
      })),
      vacancyStatuses: Object.values(StatusDeVagas).map((value) => ({
        value,
        label: formatEnumLabel(value),
      })),
      recipientKinds: [
        { value: 'MARKETING_LEAD', label: 'Contatos' },
        { value: 'USUARIO', label: 'Usuários da plataforma' },
        { value: 'BOTH', label: 'Contatos e usuários' },
      ],
      categories: routines,
      routines,
      values: {
        popups,
        owners: owners.map((item) => ({ value: item.id, label: item.nomeCompleto })),
        plans: plans.map((item) => ({ value: item.id, label: item.nome })),
        courses: cursos.map((item) => ({ value: item.id, label: item.nome })),
        turmas: turmas.map((item) => ({ value: item.id, label: item.nome })),
        tags: tags
          .map((item) => item.tag?.trim())
          .filter((value): value is string => Boolean(value))
          .map((value) => ({ value, label: formatEnumLabel(value) })),
      },
    };
  },

  async getRecipientsOptions(query: RecipientListRecipientsOptionsQuery) {
    const search = query.search?.trim().toLowerCase() ?? '';

    const [leads, users] = await Promise.all([
      query.kind === 'USUARIO'
        ? Promise.resolve([])
        : prisma.websitePopupLead.findMany({
            where: {
              removidoEm: null,
              email: { not: null },
              ...(search
                ? {
                    OR: [
                      { nome: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                      { tag: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              nome: true,
              email: true,
              status: true,
              tag: true,
            },
            take: query.limit,
            orderBy: [{ nome: 'asc' }],
          }),
      query.kind === 'MARKETING_LEAD'
        ? Promise.resolve([])
        : prisma.usuarios.findMany({
            where: {
              ...(search
                ? {
                    OR: [
                      { nomeCompleto: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
              status: true,
            },
            take: query.limit,
            orderBy: [{ nomeCompleto: 'asc' }],
          }),
    ]);

    return {
      leads: leads.map((lead) => ({
        recipientKind: 'MARKETING_LEAD',
        recipientId: lead.id,
        nome: lead.nome?.trim() || lead.email || 'Lead sem nome',
        email: lead.email,
        subtitle: [lead.status, lead.tag].filter(Boolean).join(' · '),
      })),
      users: users.map((user) => ({
        recipientKind: 'USUARIO',
        recipientId: user.id,
        nome: user.nomeCompleto,
        email: user.email,
        subtitle: [user.role, user.status].filter(Boolean).join(' · '),
      })),
    };
  },
};
