/**
 * Serviço específico para logs de auditoria
 * @module auditoria/services/logs
 */

import { AuditoriaCategoria, Prisma, Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { getUserRoleLabel } from '@/modules/usuarios/utils/user-history';
import { logger } from '@/utils/logger';

import { auditoriaService } from './auditoria.service';
import type {
  AuditoriaDashboardActor,
  AuditoriaDashboardEntity,
  AuditoriaDashboardFilters,
  AuditoriaDashboardItem,
  AuditoriaDashboardListResponse,
  AuditoriaLogResponse,
  AuditoriaFilters,
  PaginatedResponse,
} from '../types';

const logsLogger = logger.child({ module: 'LogsService' });

const dashboardLogInclude = {
  Usuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      role: true,
      UsuariosInformation: {
        select: {
          avatarUrl: true,
        },
      },
    },
  },
} as const;

type DashboardLogRow = Prisma.AuditoriaLogsGetPayload<{
  include: typeof dashboardLogInclude;
}>;

type SearchEntityMatch = {
  entidadeTipo: string;
  ids: string[];
};

type ResolvedEntity = AuditoriaDashboardEntity;

type DashboardMeta = Record<string, unknown>;

const CATEGORY_LABELS: Record<AuditoriaCategoria, string> = {
  [AuditoriaCategoria.SISTEMA]: 'Sistema',
  [AuditoriaCategoria.USUARIO]: 'Usuário',
  [AuditoriaCategoria.EMPRESA]: 'Empresa',
  [AuditoriaCategoria.VAGA]: 'Vaga',
  [AuditoriaCategoria.CURSO]: 'Curso',
  [AuditoriaCategoria.PAGAMENTO]: 'Pagamento',
  [AuditoriaCategoria.SCRIPT]: 'Script',
  [AuditoriaCategoria.SEGURANCA]: 'Segurança',
};

const ACTION_LABELS: Record<string, string> = {
  USUARIO_CRIADO: 'Usuário criado',
  USUARIO_ATUALIZADO: 'Usuário atualizado',
  USUARIO_STATUS_ALTERADO: 'Status alterado',
  USUARIO_ROLE_ALTERADA: 'Função alterada',
  USUARIO_ACESSO_LIBERADO: 'Acesso liberado',
  USUARIO_BLOQUEADO: 'Usuário bloqueado',
  USUARIO_DESBLOQUEADO: 'Usuário desbloqueado',
  USUARIO_EMAIL_LIBERADO: 'Email liberado',
  USUARIO_EMAIL_VERIFICADO: 'Email verificado',
  USUARIO_SENHA_RESETADA: 'Senha resetada',
  USUARIO_LOGIN: 'Login realizado',
  USUARIO_LOGOUT: 'Logout realizado',
  USUARIO_ENDERECO_ATUALIZADO: 'Endereço atualizado',
  USUARIO_SOCIAL_LINK_ATUALIZADO: 'Redes sociais atualizadas',
  USUARIO_AVATAR_ATUALIZADO: 'Avatar atualizado',
  USUARIO_CPF_ATUALIZADO: 'CPF atualizado',
  USUARIO_TELEFONE_ATUALIZADO: 'Telefone atualizado',
  CURSO_CRIADO: 'Curso criado',
  CURSO_ATUALIZADO: 'Curso atualizado',
  CURSO_EXCLUIDO_LOGICAMENTE: 'Curso excluído',
  CURSO_ALTERACAO: 'Curso atualizado',
  PROVA_CRIADA: 'Prova criada',
  ATIVIDADE_CRIADA: 'Atividade criada',
  PROVA_CORRECAO: 'Correção registrada',
  NOTA_MANUAL_ADICIONADA: 'Nota manual adicionada',
  NOTA_MANUAL_ATUALIZADA: 'Nota manual atualizada',
  NOTA_MANUAL_EXCLUIDA: 'Nota manual excluída',
  SCRIPT_EXECUTADO: 'Script executado',
};

const SORT_FIELD_MAP = {
  dataHora: 'criadoEm',
  categoria: 'categoria',
  tipo: 'acao',
  acao: 'acao',
} as const;

const stripAccents = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const humanizeEventType = (value?: string | null) => {
  if (!value) return 'Evento';

  const lower = value
    .split('_')
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join(' ');

  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const asJsonObject = (value: Prisma.JsonValue | null | undefined): Prisma.JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Prisma.JsonObject;
};

const getJsonString = (object: Prisma.JsonObject | null, key: string) => {
  if (!object) return null;
  const value = object[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

const getMetaObject = (metadata: Prisma.JsonValue | null): DashboardMeta | null => {
  const object = asJsonObject(metadata);
  if (!object) return null;
  return { ...(object as DashboardMeta) };
};

const normalizeEventType = (log: { acao?: string | null; tipo?: string | null }) => {
  const action = typeof log.acao === 'string' && log.acao.trim() !== '' ? log.acao.trim() : null;
  const type = typeof log.tipo === 'string' && log.tipo.trim() !== '' ? log.tipo.trim() : null;
  return action ?? type ?? 'EVENTO_DESCONHECIDO';
};

const getActionLabel = (eventType: string) =>
  ACTION_LABELS[eventType] ?? humanizeEventType(eventType);

const getCategoryLabel = (categoria: AuditoriaCategoria) => CATEGORY_LABELS[categoria] ?? categoria;

const getMatchingEventTypesFromSearch = (search: string) => {
  const normalizedSearch = stripAccents(search);

  return Object.keys(ACTION_LABELS).filter((eventType) => {
    const label = ACTION_LABELS[eventType] ?? humanizeEventType(eventType);
    return (
      stripAccents(eventType).includes(normalizedSearch) ||
      stripAccents(label).includes(normalizedSearch)
    );
  });
};

const getMatchingCategoriesFromSearch = (search: string) => {
  const normalizedSearch = stripAccents(search);

  return (Object.entries(CATEGORY_LABELS) as [AuditoriaCategoria, string][])
    .filter(([value, label]) => {
      return (
        stripAccents(value).includes(normalizedSearch) ||
        stripAccents(label).includes(normalizedSearch)
      );
    })
    .map(([value]) => value);
};

const buildActor = (log: DashboardLogRow): AuditoriaDashboardActor => {
  const meta = getMetaObject(log.metadata);
  const actorRoleFromMeta = typeof meta?.actorRole === 'string' ? meta.actorRole : null;
  const actorRole = actorRoleFromMeta ?? log.Usuarios?.role ?? null;

  if (!log.Usuarios) {
    return {
      id: null,
      nome: 'Sistema',
      role: 'SISTEMA',
      roleLabel: 'Sistema interno',
      avatarUrl: null,
    };
  }

  return {
    id: log.Usuarios.id,
    nome: log.Usuarios.nomeCompleto,
    role: actorRole ?? log.Usuarios.role,
    roleLabel: getUserRoleLabel(actorRole ?? log.Usuarios.role),
    avatarUrl: log.Usuarios.UsuariosInformation?.avatarUrl ?? null,
  };
};

const buildContext = (log: DashboardLogRow) => {
  const meta = getMetaObject(log.metadata);
  const origem =
    typeof meta?.origem === 'string' ? meta.origem : log.usuarioId ? 'PLATAFORMA' : 'SISTEMA';

  return {
    ip: log.ip ?? null,
    userAgent: log.userAgent ?? null,
    origem,
  };
};

const buildFallbackEntityFromMetadata = (log: DashboardLogRow): ResolvedEntity | null => {
  if (!log.entidadeId) return null;

  const meta = asJsonObject(log.metadata);
  const displayNameCandidates = [
    getJsonString(meta, 'nomeExibicao'),
    getJsonString(meta, 'nome'),
    getJsonString(meta, 'titulo'),
    getJsonString(meta, 'cursoNome'),
    getJsonString(meta, 'turmaNome'),
    getJsonString(meta, 'codigoInscricao'),
  ].filter((value): value is string => Boolean(value));

  const codeCandidates = [
    getJsonString(meta, 'codigo'),
    getJsonString(meta, 'codUsuario'),
    getJsonString(meta, 'etiqueta'),
    getJsonString(meta, 'codigoInscricao'),
  ].filter((value): value is string => Boolean(value));

  return {
    id: log.entidadeId,
    tipo: log.entidadeTipo ?? 'REGISTRO',
    codigo: codeCandidates[0] ?? null,
    nomeExibicao: displayNameCandidates[0] ?? null,
  };
};

const buildDescription = (
  log: DashboardLogRow,
  eventType: string,
  entity: ResolvedEntity | null,
): string => {
  const before = asJsonObject(log.dadosAnteriores);
  const after = asJsonObject(log.dadosNovos);

  if (eventType === 'USUARIO_ROLE_ALTERADA') {
    const beforeRole = getJsonString(before, 'role');
    const afterRole = getJsonString(after, 'role');
    if (beforeRole && afterRole) {
      return `Função do usuário alterada de ${getUserRoleLabel(beforeRole)} para ${getUserRoleLabel(afterRole)}.`;
    }
  }

  if (eventType === 'USUARIO_STATUS_ALTERADO') {
    const beforeStatus = getJsonString(before, 'status');
    const afterStatus = getJsonString(after, 'status');
    if (beforeStatus && afterStatus) {
      return `Status do usuário alterado de ${beforeStatus} para ${afterStatus}.`;
    }
  }

  if (eventType === 'USUARIO_ACESSO_LIBERADO') {
    return 'Acesso do usuário liberado manualmente.';
  }

  if (eventType === 'USUARIO_EMAIL_LIBERADO') {
    return 'Validação de email liberada manualmente.';
  }

  if (eventType === 'NOTA_MANUAL_ADICIONADA') {
    return 'Nota manual adicionada.';
  }

  if (eventType === 'NOTA_MANUAL_ATUALIZADA') {
    return 'Nota manual atualizada.';
  }

  if (eventType === 'NOTA_MANUAL_EXCLUIDA') {
    return 'Nota manual excluída.';
  }

  if (typeof log.descricao === 'string' && log.descricao.trim() !== '') {
    return log.descricao;
  }

  if (entity?.nomeExibicao) {
    return `${getActionLabel(eventType)} em ${entity.nomeExibicao}.`;
  }

  return getActionLabel(eventType);
};

const buildMeta = (log: DashboardLogRow) => {
  const meta = getMetaObject(log.metadata);
  if (!meta) return null;
  return meta;
};

const buildOrderBy = (
  filters: AuditoriaDashboardFilters,
): Prisma.AuditoriaLogsOrderByWithRelationInput => {
  const sortField = SORT_FIELD_MAP[filters.sortBy] ?? 'criadoEm';
  const sortDir = filters.sortDir ?? 'desc';
  return { [sortField]: sortDir } as Prisma.AuditoriaLogsOrderByWithRelationInput;
};

const dedupeIds = (ids: (string | null | undefined)[]) =>
  Array.from(new Set(ids.filter((value): value is string => Boolean(value))));

const resolveSearchEntityMatches = async (search: string): Promise<SearchEntityMatch[]> => {
  const matches: SearchEntityMatch[] = [];

  const users = await prisma.usuarios.findMany({
    where: {
      OR: [
        { nomeCompleto: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { codUsuario: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 100,
  });

  const userIds = dedupeIds(users.map((item) => item.id));
  if (userIds.length > 0) {
    matches.push({ entidadeTipo: 'USUARIO', ids: userIds });
    matches.push({ entidadeTipo: 'EMPRESA', ids: userIds });
  }

  const courses = await prisma.cursos.findMany({
    where: {
      deletedAt: null,
      OR: [
        { nome: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 100,
  });

  const courseIds = dedupeIds(courses.map((item) => item.id));
  if (courseIds.length > 0) {
    matches.push({ entidadeTipo: 'CURSO', ids: courseIds });
  }

  const turmas = await prisma.cursosTurmas.findMany({
    where: {
      deletedAt: null,
      OR: [
        { nome: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 100,
  });

  const turmaIds = dedupeIds(turmas.map((item) => item.id));
  if (turmaIds.length > 0) {
    matches.push({ entidadeTipo: 'TURMA', ids: turmaIds });
  }

  const vagas = await prisma.empresasVagas.findMany({
    where: {
      OR: [
        { titulo: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 100,
  });

  const vagaIds = dedupeIds(vagas.map((item) => item.id));
  if (vagaIds.length > 0) {
    matches.push({ entidadeTipo: 'VAGA', ids: vagaIds });
  }

  const provas = await prisma.cursosTurmasProvas.findMany({
    where: {
      OR: [
        { titulo: { contains: search, mode: 'insensitive' } },
        { etiqueta: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 100,
  });

  const provaIds = dedupeIds(provas.map((item) => item.id));
  if (provaIds.length > 0) {
    matches.push({ entidadeTipo: 'PROVA', ids: provaIds });
  }

  const notas = await prisma.cursosNotas.findMany({
    where: {
      OR: [
        { titulo: { contains: search, mode: 'insensitive' } },
        { referenciaExterna: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 100,
  });

  const notaIds = dedupeIds(notas.map((item) => item.id));
  if (notaIds.length > 0) {
    matches.push({ entidadeTipo: 'CURSO_NOTA', ids: notaIds });
  }

  return matches;
};

const buildSearchConditions = async (search: string): Promise<Prisma.AuditoriaLogsWhereInput[]> => {
  const matchingEventTypes = getMatchingEventTypesFromSearch(search);
  const matchingCategories = getMatchingCategoriesFromSearch(search);
  const entityMatches = await resolveSearchEntityMatches(search);

  const conditions: Prisma.AuditoriaLogsWhereInput[] = [
    { descricao: { contains: search, mode: 'insensitive' } },
    { acao: { contains: search, mode: 'insensitive' } },
    { tipo: { contains: search, mode: 'insensitive' } },
    { ip: { contains: search, mode: 'insensitive' } },
    { userAgent: { contains: search, mode: 'insensitive' } },
    { entidadeId: { contains: search, mode: 'insensitive' } },
    { usuarioId: { contains: search, mode: 'insensitive' } },
    {
      Usuarios: {
        is: {
          OR: [
            { nomeCompleto: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
    },
  ];

  if (matchingEventTypes.length > 0) {
    conditions.push({ acao: { in: matchingEventTypes } });
    conditions.push({ tipo: { in: matchingEventTypes } });
  }

  if (matchingCategories.length > 0) {
    conditions.push({ categoria: { in: matchingCategories } });
  }

  for (const match of entityMatches) {
    conditions.push({
      entidadeTipo: match.entidadeTipo,
      entidadeId: { in: match.ids },
    });
  }

  return conditions;
};

const buildWhere = async (
  filters: AuditoriaDashboardFilters,
  options?: { excludeCategoryAndTypeFilters?: boolean },
): Promise<Prisma.AuditoriaLogsWhereInput> => {
  const and: Prisma.AuditoriaLogsWhereInput[] = [];
  const excludeCategoryAndTypeFilters = options?.excludeCategoryAndTypeFilters ?? false;

  if (!excludeCategoryAndTypeFilters && filters.categorias.length > 0) {
    and.push({ categoria: { in: filters.categorias } });
  }

  if (!excludeCategoryAndTypeFilters && filters.tipos.length > 0) {
    and.push({
      OR: [{ acao: { in: filters.tipos } }, { tipo: { in: filters.tipos } }],
    });
  }

  if (filters.atorId) {
    and.push({ usuarioId: filters.atorId });
  }

  if (filters.atorRole) {
    const actorRoleConditions: Prisma.AuditoriaLogsWhereInput[] = [
      {
        metadata: {
          path: ['actorRole'],
          equals: filters.atorRole,
        },
      },
    ];

    if (filters.atorRole === 'SISTEMA') {
      actorRoleConditions.push({ usuarioId: null });
    } else {
      actorRoleConditions.push({
        Usuarios: {
          is: {
            role: filters.atorRole as Roles,
          },
        },
      });
    }

    and.push({ OR: actorRoleConditions });
  }

  if (filters.entidadeTipo) {
    and.push({ entidadeTipo: filters.entidadeTipo });
  }

  if (filters.entidadeId) {
    and.push({ entidadeId: filters.entidadeId });
  }

  if (filters.dataInicio || filters.dataFim) {
    const criadoEm: Prisma.DateTimeFilter = {};
    if (filters.dataInicio) {
      criadoEm.gte = new Date(filters.dataInicio);
    }
    if (filters.dataFim) {
      criadoEm.lte = new Date(filters.dataFim);
    }
    and.push({ criadoEm });
  }

  if (filters.search) {
    const searchConditions = await buildSearchConditions(filters.search);
    and.push({ OR: searchConditions });
  }

  return and.length > 0 ? { AND: and } : {};
};

const resolveEntities = async (logs: DashboardLogRow[]) => {
  const entityMap = new Map<string, ResolvedEntity>();

  const idsByType = new Map<string, string[]>();

  for (const log of logs) {
    if (!log.entidadeId || !log.entidadeTipo) continue;
    const current = idsByType.get(log.entidadeTipo) ?? [];
    current.push(log.entidadeId);
    idsByType.set(log.entidadeTipo, current);
  }

  const userEntityIds = dedupeIds([
    ...(idsByType.get('USUARIO') ?? []),
    ...(idsByType.get('EMPRESA') ?? []),
  ]);
  if (userEntityIds.length > 0) {
    const users = await prisma.usuarios.findMany({
      where: { id: { in: userEntityIds } },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        codUsuario: true,
        role: true,
      },
    });

    for (const user of users) {
      const base = {
        id: user.id,
        codigo: user.codUsuario ?? null,
        nomeExibicao: user.nomeCompleto || user.email,
      };
      entityMap.set(`USUARIO:${user.id}`, { ...base, tipo: 'USUARIO' });
      entityMap.set(`EMPRESA:${user.id}`, {
        ...base,
        tipo: 'EMPRESA',
        nomeExibicao: user.nomeCompleto || user.email,
      });
    }
  }

  const courseIds = dedupeIds(idsByType.get('CURSO') ?? []);
  if (courseIds.length > 0) {
    const courses = await prisma.cursos.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, codigo: true, nome: true },
    });

    for (const course of courses) {
      entityMap.set(`CURSO:${course.id}`, {
        id: course.id,
        tipo: 'CURSO',
        codigo: course.codigo ?? null,
        nomeExibicao: course.nome,
      });
    }
  }

  const turmaIds = dedupeIds(idsByType.get('TURMA') ?? []);
  if (turmaIds.length > 0) {
    const turmas = await prisma.cursosTurmas.findMany({
      where: { id: { in: turmaIds } },
      select: { id: true, codigo: true, nome: true },
    });

    for (const turma of turmas) {
      entityMap.set(`TURMA:${turma.id}`, {
        id: turma.id,
        tipo: 'TURMA',
        codigo: turma.codigo ?? null,
        nomeExibicao: turma.nome,
      });
    }
  }

  const vagaIds = dedupeIds(idsByType.get('VAGA') ?? []);
  if (vagaIds.length > 0) {
    const vagas = await prisma.empresasVagas.findMany({
      where: { id: { in: vagaIds } },
      select: { id: true, codigo: true, titulo: true },
    });

    for (const vaga of vagas) {
      entityMap.set(`VAGA:${vaga.id}`, {
        id: vaga.id,
        tipo: 'VAGA',
        codigo: vaga.codigo ?? null,
        nomeExibicao: vaga.titulo,
      });
    }
  }

  const provaIds = dedupeIds(idsByType.get('PROVA') ?? []);
  if (provaIds.length > 0) {
    const provas = await prisma.cursosTurmasProvas.findMany({
      where: { id: { in: provaIds } },
      select: { id: true, etiqueta: true, titulo: true },
    });

    for (const prova of provas) {
      entityMap.set(`PROVA:${prova.id}`, {
        id: prova.id,
        tipo: 'PROVA',
        codigo: prova.etiqueta ?? null,
        nomeExibicao: prova.titulo,
      });
    }
  }

  const notaIds = dedupeIds(idsByType.get('CURSO_NOTA') ?? []);
  if (notaIds.length > 0) {
    const notas = await prisma.cursosNotas.findMany({
      where: { id: { in: notaIds } },
      select: { id: true, referenciaExterna: true, titulo: true },
    });

    for (const nota of notas) {
      entityMap.set(`CURSO_NOTA:${nota.id}`, {
        id: nota.id,
        tipo: 'CURSO_NOTA',
        codigo: nota.referenciaExterna ?? null,
        nomeExibicao: nota.titulo,
      });
    }
  }

  return entityMap;
};

const buildEntity = (
  log: DashboardLogRow,
  resolvedEntityMap: Map<string, ResolvedEntity>,
): ResolvedEntity | null => {
  if (!log.entidadeId) {
    return null;
  }

  const entityType = log.entidadeTipo ?? 'REGISTRO';
  const resolved = resolvedEntityMap.get(`${entityType}:${log.entidadeId}`);
  if (resolved) {
    return resolved;
  }

  return (
    buildFallbackEntityFromMetadata(log) ?? {
      id: log.entidadeId,
      tipo: entityType,
      codigo: null,
      nomeExibicao: null,
    }
  );
};

export class LogsService {
  /**
   * Registra um log de sistema
   */
  async registrarLogSistema(
    tipo: string,
    acao: string,
    descricao: string,
    metadata?: Record<string, any>,
  ): Promise<AuditoriaLogResponse> {
    return auditoriaService.registrarLog({
      categoria: 'SISTEMA' as any,
      tipo,
      acao,
      descricao,
      metadata,
    });
  }

  /**
   * Registra um log de usuário
   */
  async registrarLogUsuario(
    usuarioId: string,
    tipo: string,
    acao: string,
    descricao: string,
    entidadeId?: string,
    entidadeTipo?: string,
    dadosAnteriores?: Record<string, any>,
    dadosNovos?: Record<string, any>,
    metadata?: Record<string, any>,
    ip?: string,
    userAgent?: string,
  ): Promise<AuditoriaLogResponse> {
    return auditoriaService.registrarLog({
      categoria: 'USUARIO' as any,
      tipo,
      acao,
      descricao,
      usuarioId,
      entidadeId,
      entidadeTipo,
      dadosAnteriores,
      dadosNovos,
      metadata,
      ip,
      userAgent,
    });
  }

  /**
   * Registra um log de segurança
   */
  async registrarLogSeguranca(
    tipo: string,
    acao: string,
    descricao: string,
    usuarioId?: string,
    ip?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<AuditoriaLogResponse> {
    return auditoriaService.registrarLog({
      categoria: 'SEGURANCA' as any,
      tipo,
      acao,
      descricao,
      usuarioId,
      metadata,
      ip,
      userAgent,
    });
  }

  /**
   * Lista logs com filtros específicos (compatibilidade interna)
   */
  async listarLogs(filters: AuditoriaFilters): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs(filters);
  }

  async listarLogsDashboard(
    filters: AuditoriaDashboardFilters,
  ): Promise<AuditoriaDashboardListResponse> {
    try {
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 10;
      const skip = (page - 1) * pageSize;

      const where = await buildWhere(filters);
      const facetWhere = await buildWhere(filters, { excludeCategoryAndTypeFilters: true });

      const logs = await prisma.auditoriaLogs.findMany({
        where,
        include: dashboardLogInclude,
        orderBy: buildOrderBy(filters),
        skip,
        take: pageSize,
      });

      const total = await prisma.auditoriaLogs.count({ where });
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      const ultimoEvento = await prisma.auditoriaLogs.findFirst({
        where,
        orderBy: { criadoEm: 'desc' },
        select: { criadoEm: true },
      });

      const categoriasGroup = await prisma.auditoriaLogs.groupBy({
        by: ['categoria'],
        where: facetWhere,
        _count: { categoria: true },
      });

      const tiposGroup = await prisma.auditoriaLogs.groupBy({
        by: ['acao'],
        where: facetWhere,
        _count: { acao: true },
      });

      const resolvedEntityMap = await resolveEntities(logs);

      const items: AuditoriaDashboardItem[] = logs.map((log) => {
        const eventType = normalizeEventType(log);
        const entity = buildEntity(log, resolvedEntityMap);

        return {
          id: log.id,
          categoria: log.categoria,
          tipo: eventType,
          acao: getActionLabel(eventType),
          descricao: buildDescription(log, eventType, entity),
          dataHora: log.criadoEm.toISOString(),
          ator: buildActor(log),
          entidade: entity,
          contexto: buildContext(log),
          dadosAnteriores: log.dadosAnteriores ?? null,
          dadosNovos: log.dadosNovos ?? null,
          meta: buildMeta(log),
        };
      });

      return {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
        resumo: {
          total,
          ultimoEventoEm: ultimoEvento?.criadoEm?.toISOString() ?? null,
        },
        filtrosDisponiveis: {
          categorias: categoriasGroup
            .map((item) => ({
              value: item.categoria,
              label: getCategoryLabel(item.categoria),
              count: item._count.categoria,
            }))
            .sort(
              (left, right) => right.count - left.count || left.label.localeCompare(right.label),
            ),
          tipos: tiposGroup
            .map((item) => {
              const eventType = item.acao;
              return {
                value: eventType,
                label: getActionLabel(eventType),
                count: item._count.acao,
              };
            })
            .sort(
              (left, right) => right.count - left.count || left.label.localeCompare(right.label),
            ),
        },
      };
    } catch (error) {
      logsLogger.error({ err: error, filters }, 'Erro ao listar logs globais de auditoria');
      throw Object.assign(new Error('Erro ao listar histórico global de auditoria'), {
        code: 'AUDITORIA_LOGS_ERROR',
        statusCode: 500,
      });
    }
  }

  /**
   * Obtém logs por usuário
   */
  async obterLogsPorUsuario(
    usuarioId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      usuarioId,
      page,
      pageSize,
    });
  }

  /**
   * Obtém logs por entidade
   */
  async obterLogsPorEntidade(
    entidadeId: string,
    entidadeTipo?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      entidadeId,
      entidadeTipo,
      page,
      pageSize,
    });
  }

  /**
   * Obtém logs de erro do sistema
   */
  async obterLogsErro(
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      categoria: 'SISTEMA' as any,
      tipo: 'ERRO',
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  /**
   * Obtém logs de acesso
   */
  async obterLogsAcesso(
    usuarioId?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      categoria: 'SEGURANCA' as any,
      tipo: 'ACESSO',
      usuarioId,
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  /**
   * Obtém logs de alteração de dados
   */
  async obterLogsAlteracao(
    entidadeTipo?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      categoria: 'USUARIO' as any,
      tipo: 'ALTERACAO',
      entidadeTipo,
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  /**
   * Obtém estatísticas de logs
   */
  async obterEstatisticas(filters: Partial<AuditoriaFilters> = {}) {
    return auditoriaService.obterEstatisticas(filters);
  }

  /**
   * Obtém um log específico
   */
  async obterLogPorId(id: string): Promise<AuditoriaLogResponse | null> {
    return auditoriaService.obterLogPorId(id);
  }

  /**
   * Exporta logs para CSV
   */
  async exportarLogs(filters: AuditoriaFilters): Promise<string> {
    const logs = await auditoriaService.listarLogs({
      ...filters,
      pageSize: 10000,
    });

    const headers = [
      'ID',
      'Categoria',
      'Tipo',
      'Ação',
      'Usuário',
      'Entidade ID',
      'Entidade Tipo',
      'Descrição',
      'IP',
      'Data/Hora',
    ];

    const rows = logs.items.map((log) => [
      log.id,
      log.categoria,
      log.tipo,
      log.acao,
      log.usuario?.nomeCompleto || '',
      log.entidadeId || '',
      log.entidadeTipo || '',
      log.descricao,
      log.ip || '',
      log.criadoEm.toISOString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

export const logsService = new LogsService();
