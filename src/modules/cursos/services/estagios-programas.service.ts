import {
  CursosEstagioFrequenciaStatus,
  CursosEstagioModoAlocacao,
  CursosEstagioParticipanteStatus,
  CursosEstagioPeriodicidade,
  CursosEstagioProgramaStatus,
  CursosEstagioTipoParticipacao,
  Prisma,
  Roles as UsuarioRole,
  StatusInscricao,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { generateCacheKey, getCachedOrFetch, invalidateCacheByPrefix } from '@/utils/cache';

import {
  CreateEstagioProgramaInput,
  UpdateEstagioProgramaInput,
  VincularAlunosEstagioInput,
  ListEstagiosProgramasQuery,
  ListFrequenciasEstagioQuery,
  ListFrequenciasEstagioPeriodoQuery,
  ListFrequenciaHistoricoEstagioQuery,
  ListEstagiosAlunoQuery,
  UpsertFrequenciaEstagioInput,
} from '../validators/estagios.schema';

const DAY_TO_CODE: Record<number, string> = {
  0: 'DOM',
  1: 'SEG',
  2: 'TER',
  3: 'QUA',
  4: 'QUI',
  5: 'SEX',
  6: 'SAB',
};

const toStartOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

const addDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const dateToIsoDay = (value: Date) => {
  const date = toStartOfDay(value);
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

const isoDayToDate = (isoDay: string, endOfDay = false) => {
  const [year, month, day] = isoDay.split('-').map((token) => Number(token));
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

const parseTimeToMinutes = (value: string) => {
  const [h, m] = value.split(':').map((token) => Number(token));
  return h * 60 + m;
};

const getDurationMinutes = (horaInicio: string, horaFim: string) => {
  const start = parseTimeToMinutes(horaInicio);
  const end = parseTimeToMinutes(horaFim);

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    const error = new Error('Horário inválido: horaFim deve ser maior que horaInicio');
    (error as any).code = 'HORARIO_INVALIDO';
    throw error;
  }

  return end - start;
};

const buildGroupAllocationSlots = <T extends { id: string; capacidade: number | null }>(
  groups: T[],
) => {
  const slots: string[] = [];
  for (const group of groups) {
    const capacidade = Math.max(0, group.capacidade ?? 0);
    for (let i = 0; i < capacidade; i += 1) {
      slots.push(group.id);
    }
  }
  return slots;
};

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  return Number(value.toString());
};

const getRoleLabel = (role?: string | null) => {
  switch (role) {
    case 'ADMIN':
      return 'Administrador';
    case 'MODERADOR':
      return 'Moderador';
    case 'PEDAGOGICO':
      return 'Setor Pedagógico';
    case 'INSTRUTOR':
      return 'Instrutor';
    default:
      return role ?? 'Usuário';
  }
};

type EstagioFrequenciaAuditOrigin = 'WEB' | 'MOBILE' | 'API';

type EstagioFrequenciaAuditContext = {
  ip?: string | null;
  userAgent?: string | null;
  origem?: EstagioFrequenciaAuditOrigin | null;
};

type EstagioFrequenciaHistoricoMetadata = {
  evento?: 'FREQUENCIA_LANCADA' | 'STATUS_ALTERADO' | 'MOTIVO_ALTERADO';
  estagioAlunoId?: string;
  dataReferencia?: string;
  deMotivo?: string | null;
  paraMotivo?: string | null;
  seguranca?: {
    ip?: string | null;
    userAgent?: string | null;
    origem?: EstagioFrequenciaAuditOrigin | null;
  };
};

const normalizeHistoricoMetadata = (
  value: Prisma.JsonValue | null | undefined,
): EstagioFrequenciaHistoricoMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as EstagioFrequenciaHistoricoMetadata;
};

const resolveHistoricoEvento = (
  fromStatus: CursosEstagioFrequenciaStatus | null,
  toStatus: CursosEstagioFrequenciaStatus,
  deMotivo: string | null,
  paraMotivo: string | null,
) => {
  if (fromStatus == null) return 'FREQUENCIA_LANCADA' as const;
  if (fromStatus !== toStatus) return 'STATUS_ALTERADO' as const;
  if ((deMotivo ?? null) !== (paraMotivo ?? null)) return 'MOTIVO_ALTERADO' as const;
  return 'STATUS_ALTERADO' as const;
};

const ESTAGIOS_CACHE_PREFIX = 'cursos:estagios';
const ESTAGIO_DETAIL_CACHE_TTL_SECONDS = 45;
const ESTAGIO_FREQUENCIAS_CACHE_TTL_SECONDS = 30;

const buildEstagioDetailCacheKey = (estagioId: string) =>
  `${ESTAGIOS_CACHE_PREFIX}:detail:${estagioId}`;

const buildEstagioFrequenciasCacheKey = (
  estagioId: string,
  query: ListFrequenciasEstagioQuery,
  alunoId?: string,
) =>
  generateCacheKey(
    `${ESTAGIOS_CACHE_PREFIX}:frequencias:${estagioId}`,
    {
      alunoId: alunoId ?? null,
      data: query.data ? dateToIsoDay(query.data) : null,
      status: query.status ?? null,
      grupoId: query.grupoId ?? null,
      search: query.search?.trim().toLowerCase() ?? null,
      page: query.page,
      pageSize: query.pageSize,
    },
    { excludeKeys: [] },
  );

const buildEstagioFrequenciasPeriodoCacheKey = (
  estagioId: string,
  query: ListFrequenciasEstagioPeriodoQuery,
  alunoId?: string,
) =>
  generateCacheKey(
    `${ESTAGIOS_CACHE_PREFIX}:frequencias:${estagioId}:periodo`,
    {
      alunoId: alunoId ?? null,
      dataInicio: query.dataInicio ? dateToIsoDay(query.dataInicio) : null,
      dataFim: query.dataFim ? dateToIsoDay(query.dataFim) : null,
      status: query.status ?? null,
      grupoId: query.grupoId ?? null,
      search: query.search?.trim().toLowerCase() ?? null,
      page: query.page,
      pageSize: query.pageSize,
    },
    { excludeKeys: [] },
  );

const invalidateEstagioRuntimeCache = async (estagioId: string) => {
  await Promise.all([
    invalidateCacheByPrefix(buildEstagioDetailCacheKey(estagioId)),
    invalidateCacheByPrefix(`${ESTAGIOS_CACHE_PREFIX}:frequencias:${estagioId}`),
  ]);
};

const buildCalendarioObrigatorio = (params: {
  periodicidade: CursosEstagioPeriodicidade;
  diasSemana: string[];
  dataInicio: Date;
  dataFim: Date;
  incluirSabados: boolean;
}) => {
  const start = toStartOfDay(params.dataInicio);
  const end = toStartOfDay(params.dataFim);
  const allowedDays = new Set(params.diasSemana ?? []);
  const result: Date[] = [];

  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    const dayCode = DAY_TO_CODE[current.getDay()] ?? '';

    if (dayCode === 'DOM') {
      continue;
    }

    if (dayCode === 'SAB' && !params.incluirSabados) {
      continue;
    }

    if (
      params.periodicidade === CursosEstagioPeriodicidade.DIAS_SEMANA &&
      !allowedDays.has(dayCode)
    ) {
      continue;
    }

    result.push(new Date(current));
  }

  return result;
};

const ensureTurmaBelongsToCurso = async (
  client: Prisma.TransactionClient | typeof prisma,
  cursoId: string,
  turmaId: string,
) => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId, deletedAt: null },
    select: {
      id: true,
      nome: true,
      codigo: true,
      cursoId: true,
      Cursos: { select: { id: true, nome: true, codigo: true } },
    },
  });

  if (!turma) {
    const error = new Error('Curso e turma inválidos');
    (error as any).code = 'TURMA_CURSO_INVALIDOS';
    throw error;
  }

  return turma;
};

const mapProgramaResumo = (
  item: Prisma.CursosEstagiosProgramasGetPayload<{
    include: {
      Cursos: { select: { id: true; nome: true; codigo: true } };
      CursosTurmas: { select: { id: true; nome: true; codigo: true } };
      _count: { select: { CursosEstagiosProgramasAlunos: true } };
    };
  }>,
) => ({
  id: item.id,
  titulo: item.titulo,
  cursoId: item.cursoId,
  cursoNome: item.Cursos.nome,
  turmaId: item.turmaId,
  turmaNome: item.CursosTurmas.nome,
  turmaCodigo: item.CursosTurmas.codigo,
  obrigatorio: item.obrigatorio,
  modoAlocacao: item.modoAlocacao,
  usarGrupos: item.usarGrupos,
  status: item.status,
  diasObrigatorios: item.diasObrigatorios,
  cargaHorariaMinutos: item.cargaHorariaMinutos,
  horarioPadrao:
    item.horarioPadraoInicio && item.horarioPadraoFim
      ? {
          horaInicio: item.horarioPadraoInicio,
          horaFim: item.horarioPadraoFim,
        }
      : null,
  totalAlunosVinculados: item._count.CursosEstagiosProgramasAlunos,
  periodo: {
    periodicidade: item.periodicidade,
    diasSemana: item.diasSemana,
    dataInicio: dateToIsoDay(item.dataInicio),
    dataFim: dateToIsoDay(item.dataFim),
    incluirSabados: item.incluirSabados,
  },
  atualizadoEm: item.atualizadoEm.toISOString(),
});

const includeProgramaDetalhe = {
  Cursos: { select: { id: true, nome: true, codigo: true } },
  CursosTurmas: { select: { id: true, nome: true, codigo: true } },
  CursosEstagiosProgramasGrupos: {
    orderBy: { criadoEm: 'asc' as const },
  },
  CursosEstagiosProgramasAlunos: {
    orderBy: { criadoEm: 'asc' as const },
    include: {
      CursosTurmasInscricoes: {
        select: {
          id: true,
          codigo: true,
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              cpf: true,
              email: true,
              UsuariosInformation: { select: { avatarUrl: true } },
            },
          },
        },
      },
      CursosEstagiosProgramasGrupos: {
        select: {
          id: true,
          nome: true,
          turno: true,
          horaInicio: true,
          horaFim: true,
        },
      },
    },
  },
  _count: {
    select: {
      CursosEstagiosProgramasAlunos: true,
      CursosEstagiosProgramasFrequencias: true,
    },
  },
};

const mapProgramaDetalhe = (
  item: Prisma.CursosEstagiosProgramasGetPayload<{ include: typeof includeProgramaDetalhe }>,
) => {
  const calendarioObrigatorio = buildCalendarioObrigatorio({
    periodicidade: item.periodicidade,
    diasSemana: item.diasSemana,
    dataInicio: item.dataInicio,
    dataFim: item.dataFim,
    incluirSabados: item.incluirSabados,
  }).map(dateToIsoDay);

  const participantes = item.CursosEstagiosProgramasAlunos;
  const alunosPorGrupo = participantes.reduce<Record<string, number>>((acc, participante) => {
    if (participante.grupoId) {
      acc[participante.grupoId] = (acc[participante.grupoId] ?? 0) + 1;
    }
    return acc;
  }, {});
  const concluidos = participantes.filter(
    (p) => p.status === CursosEstagioParticipanteStatus.CONCLUIDO,
  ).length;
  const pendentes = participantes.filter(
    (p) => p.status !== CursosEstagioParticipanteStatus.CONCLUIDO,
  ).length;
  const mediaFrequencia =
    participantes.length > 0
      ? Number(
          (
            participantes.reduce(
              (acc, p) => acc + (decimalToNumber(p.percentualFrequencia) ?? 0),
              0,
            ) / participantes.length
          ).toFixed(1),
        )
      : 0;

  return {
    id: item.id,
    titulo: item.titulo,
    descricao: item.descricao,
    cursoId: item.cursoId,
    cursoNome: item.Cursos.nome,
    turmaId: item.turmaId,
    turmaNome: item.CursosTurmas.nome,
    turmaCodigo: item.CursosTurmas.codigo,
    obrigatorio: item.obrigatorio,
    modoAlocacao: item.modoAlocacao,
    usarGrupos: item.usarGrupos,
    periodicidade: item.periodicidade,
    diasSemana: item.diasSemana,
    dataInicio: dateToIsoDay(item.dataInicio),
    dataFim: dateToIsoDay(item.dataFim),
    incluirSabados: item.incluirSabados,
    diasObrigatorios: item.diasObrigatorios,
    cargaHorariaMinutos: item.cargaHorariaMinutos,
    horarioPadrao:
      item.horarioPadraoInicio && item.horarioPadraoFim
        ? {
            horaInicio: item.horarioPadraoInicio,
            horaFim: item.horarioPadraoFim,
          }
        : null,
    empresa: {
      vinculoModo: item.empresaVinculoModo,
      empresaId: item.empresaId,
      nome: item.empresaNome,
      cnpj: item.empresaCnpj,
      telefone: item.empresaTelefone,
      email: item.empresaEmail,
      endereco: item.empresaEndereco ?? null,
    },
    status: item.status,
    calendarioObrigatorio,
    resumo: {
      totalAlunosVinculados: participantes.length,
      concluidos,
      pendentes,
      mediaFrequencia,
      totalLancamentosFrequencia: item._count.CursosEstagiosProgramasFrequencias,
    },
    grupos: item.CursosEstagiosProgramasGrupos.map((grupo) => ({
      id: grupo.id,
      nome: grupo.nome,
      turno: grupo.turno,
      capacidade: grupo.capacidade,
      horaInicio: grupo.horaInicio,
      horaFim: grupo.horaFim,
      alunosVinculados: alunosPorGrupo[grupo.id] ?? 0,
      empresaId: grupo.empresaId,
      empresaNome: grupo.empresaNome,
      supervisorNome: grupo.supervisorNome,
      contatoSupervisor: grupo.contatoSupervisor,
    })),
    alunos: participantes.map((participante) => ({
      id: participante.id,
      inscricaoId: participante.inscricaoId,
      alunoId: participante.alunoId,
      alunoNome: participante.CursosTurmasInscricoes.Usuarios.nomeCompleto,
      cpf: participante.CursosTurmasInscricoes.Usuarios.cpf,
      email: participante.CursosTurmasInscricoes.Usuarios.email,
      avatarUrl:
        participante.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.avatarUrl ?? null,
      codigoInscricao: participante.CursosTurmasInscricoes.codigo,
      tipoParticipacao: participante.tipoParticipacao,
      status: participante.status,
      validadeAte: participante.validadeAte ? participante.validadeAte.toISOString() : null,
      percentualFrequencia: decimalToNumber(participante.percentualFrequencia),
      diasObrigatorios: participante.diasObrigatorios,
      diasPresentes: participante.diasPresentes,
      diasAusentes: participante.diasAusentes,
      grupo: participante.CursosEstagiosProgramasGrupos,
    })),
    criadoEm: item.criadoEm.toISOString(),
    atualizadoEm: item.atualizadoEm.toISOString(),
  };
};

const estagioMetaSelect = {
  id: true,
  cursoId: true,
  turmaId: true,
  Cursos: {
    select: { nome: true },
  },
  CursosTurmas: {
    select: { nome: true, codigo: true },
  },
} as const;

const participanteListSelect = {
  id: true,
  estagioId: true,
  inscricaoId: true,
  alunoId: true,
  diasPresentes: true,
  diasAusentes: true,
  diasObrigatorios: true,
  status: true,
  CursosTurmasInscricoes: {
    select: {
      codigo: true,
      Usuarios: {
        select: {
          nomeCompleto: true,
          cpf: true,
          UsuariosInformation: {
            select: { avatarUrl: true },
          },
        },
      },
    },
  },
  CursosEstagiosProgramasGrupos: {
    select: {
      id: true,
      nome: true,
      turno: true,
      horaInicio: true,
      horaFim: true,
    },
  },
} as const;

const mapFrequenciaEstagioFromParts = (params: {
  estagioId: string;
  estagioMeta: {
    cursoId: string;
    cursoNome: string;
    turmaId: string;
    turmaNome: string;
    turmaCodigo: string | null;
  };
  participante: Prisma.CursosEstagiosProgramasAlunosGetPayload<{
    select: typeof participanteListSelect;
  }>;
  frequencia: {
    id: string;
    status: CursosEstagioFrequenciaStatus;
    motivo: string | null;
    dataReferencia: Date;
    lancadoEm: Date;
    atualizadoEm: Date;
    lancadoPor: { id: string; nomeCompleto: string; role: string } | null;
  };
}) => ({
  id: params.frequencia.id,
  isPersisted: true,
  estagioId: params.estagioId,
  estagioAlunoId: params.participante.id,
  cursoId: params.estagioMeta.cursoId,
  cursoNome: params.estagioMeta.cursoNome,
  turmaId: params.estagioMeta.turmaId,
  turmaNome: params.estagioMeta.turmaNome,
  turmaCodigo: params.estagioMeta.turmaCodigo,
  inscricaoId: params.participante.inscricaoId,
  alunoId: params.participante.alunoId,
  alunoNome: params.participante.CursosTurmasInscricoes.Usuarios.nomeCompleto,
  alunoCpf: params.participante.CursosTurmasInscricoes.Usuarios.cpf ?? null,
  avatarUrl:
    params.participante.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.avatarUrl ?? null,
  codigoInscricao: params.participante.CursosTurmasInscricoes.codigo,
  codigoMatricula: params.participante.CursosTurmasInscricoes.codigo,
  grupo: params.participante.CursosEstagiosProgramasGrupos,
  dataReferencia: dateToIsoDay(params.frequencia.dataReferencia),
  status: params.frequencia.status,
  motivo: params.frequencia.motivo,
  lancadoPor: params.frequencia.lancadoPor
    ? {
        id: params.frequencia.lancadoPor.id,
        nome: params.frequencia.lancadoPor.nomeCompleto,
        role: params.frequencia.lancadoPor.role,
        roleLabel: getRoleLabel(params.frequencia.lancadoPor.role),
      }
    : null,
  lancadoEm: params.frequencia.lancadoEm.toISOString(),
  atualizadoEm: params.frequencia.atualizadoEm.toISOString(),
});

const buildParticipanteWhere = (params: {
  estagioId: string;
  grupoId?: string;
  alunoId?: string;
  search?: string;
}): Prisma.CursosEstagiosProgramasAlunosWhereInput => ({
  estagioId: params.estagioId,
  ...(params.grupoId ? { grupoId: params.grupoId } : {}),
  ...(params.alunoId ? { alunoId: params.alunoId } : {}),
  ...(params.search
    ? {
        OR: [
          {
            CursosTurmasInscricoes: {
              Usuarios: {
                nomeCompleto: { contains: params.search, mode: 'insensitive' },
              },
            },
          },
          {
            CursosTurmasInscricoes: {
              codigo: { contains: params.search, mode: 'insensitive' },
            },
          },
        ],
      }
    : {}),
});

const recalculateParticipanteMetrics = async (
  client: Prisma.TransactionClient,
  participanteId: string,
) => {
  const participante = await client.cursosEstagiosProgramasAlunos.findUnique({
    where: { id: participanteId },
    include: {
      CursosEstagiosProgramas: true,
    },
  });

  if (!participante) return null;

  const calendario = buildCalendarioObrigatorio({
    periodicidade: participante.CursosEstagiosProgramas.periodicidade,
    diasSemana: participante.CursosEstagiosProgramas.diasSemana,
    dataInicio: participante.CursosEstagiosProgramas.dataInicio,
    dataFim: participante.CursosEstagiosProgramas.dataFim,
    incluirSabados: participante.CursosEstagiosProgramas.incluirSabados,
  });

  const days = calendario.map((date) => dateToIsoDay(date));
  const dateSet = new Set(days);

  const frequencias = await client.cursosEstagiosProgramasFrequencias.findMany({
    where: {
      estagioAlunoId: participante.id,
      dataReferencia: {
        gte: toStartOfDay(participante.CursosEstagiosProgramas.dataInicio),
        lte: toEndOfDay(participante.CursosEstagiosProgramas.dataFim),
      },
    },
    select: { status: true, dataReferencia: true },
  });

  let diasPresentes = 0;
  let diasAusentes = 0;

  for (const frequencia of frequencias) {
    const ref = dateToIsoDay(frequencia.dataReferencia);
    if (!dateSet.has(ref)) continue;
    if (frequencia.status === CursosEstagioFrequenciaStatus.PRESENTE) {
      diasPresentes += 1;
    }
    if (frequencia.status === CursosEstagioFrequenciaStatus.AUSENTE) {
      diasAusentes += 1;
    }
  }

  const diasObrigatorios = calendario.length;
  const percentual =
    diasObrigatorios > 0 ? Number(((diasPresentes / diasObrigatorios) * 100).toFixed(2)) : 0;
  const status =
    diasPresentes + diasAusentes > 0 &&
    participante.status === CursosEstagioParticipanteStatus.PENDENTE
      ? CursosEstagioParticipanteStatus.EM_ANDAMENTO
      : participante.status;

  const updated = await client.cursosEstagiosProgramasAlunos.update({
    where: { id: participante.id },
    data: {
      diasObrigatorios,
      diasPresentes,
      diasAusentes,
      percentualFrequencia: percentual,
      status,
    },
  });

  return updated;
};

const ensureInitialParticipationAllowed = async (
  client: Prisma.TransactionClient,
  params: {
    estagioId: string;
    cursoId: string;
    turmaId: string;
    alunoIds: string[];
  },
) => {
  if (params.alunoIds.length === 0) return;

  const now = new Date();
  const conflicts = await client.cursosEstagiosProgramasAlunos.findMany({
    where: {
      alunoId: { in: params.alunoIds },
      tipoParticipacao: CursosEstagioTipoParticipacao.INICIAL,
      status: CursosEstagioParticipanteStatus.CONCLUIDO,
      validadeAte: { gte: now },
      estagioId: { not: params.estagioId },
      CursosEstagiosProgramas: {
        cursoId: params.cursoId,
        turmaId: params.turmaId,
      },
    },
    select: {
      alunoId: true,
      validadeAte: true,
    },
  });

  if (conflicts.length > 0) {
    const error = new Error('Aluno possui estágio válido vigente para este curso/turma');
    (error as any).code = 'ESTAGIO_VALIDO_VIGENTE';
    (error as any).data = conflicts;
    throw error;
  }
};

const getDailyMinutesForProgram = (params: {
  usarGrupos: boolean;
  horarioPadraoInicio: string | null;
  horarioPadraoFim: string | null;
  grupos: { horaInicio: string | null; horaFim: string | null }[];
}) => {
  if (params.usarGrupos) {
    if (params.grupos.length === 0) {
      const error = new Error('Grupo obrigatório para alocação');
      (error as any).code = 'GRUPO_OBRIGATORIO_PARA_ALOCACAO';
      throw error;
    }

    const durations = params.grupos.map((grupo) => {
      if (!grupo.horaInicio || !grupo.horaFim) {
        const error = new Error('Grupos precisam de horaInicio e horaFim');
        (error as any).code = 'HORARIO_INVALIDO';
        throw error;
      }
      return getDurationMinutes(grupo.horaInicio, grupo.horaFim);
    });

    const base = durations[0];
    const allEqual = durations.every((value) => value === base);
    if (!allEqual) {
      const error = new Error(
        'Quando usarGrupos=true, todos os grupos devem ter a mesma duração de horário',
      );
      (error as any).code = 'HORARIO_INVALIDO';
      throw error;
    }

    return base;
  }

  if (!params.horarioPadraoInicio || !params.horarioPadraoFim) {
    const error = new Error('horarioPadrao é obrigatório quando usarGrupos=false');
    (error as any).code = 'HORARIO_INVALIDO';
    throw error;
  }

  return getDurationMinutes(params.horarioPadraoInicio, params.horarioPadraoFim);
};

const ensureGroupCapacityForTodos = (
  groups: { capacidade: number | null }[],
  totalAlunos: number,
) => {
  const capacidadeTotal = groups.reduce((acc, group) => acc + (group.capacidade ?? 0), 0);
  if (capacidadeTotal < totalAlunos) {
    const error = new Error(
      'A capacidade total dos grupos é insuficiente para a quantidade de alunos da turma. Ajuste as capacidades ou crie novos grupos.',
    );
    (error as any).code = 'CAPACIDADE_GRUPOS_INSUFICIENTE';
    throw error;
  }
};

const ensureAlunoExists = async (alunoId: string) => {
  const aluno = await prisma.usuarios.findFirst({
    where: { id: alunoId, role: UsuarioRole.ALUNO_CANDIDATO },
    select: { id: true },
  });

  if (!aluno) {
    const error = new Error('Aluno não encontrado');
    (error as any).code = 'ALUNO_NOT_FOUND';
    throw error;
  }
};

const mapAlunoProgramaStatus = (params: {
  participanteStatus: CursosEstagioParticipanteStatus;
  programaStatus: CursosEstagioProgramaStatus;
}) => {
  if (
    params.participanteStatus === CursosEstagioParticipanteStatus.CANCELADO ||
    params.programaStatus === CursosEstagioProgramaStatus.CANCELADO
  ) {
    return 'CANCELADO' as const;
  }
  if (params.participanteStatus === CursosEstagioParticipanteStatus.CONCLUIDO) {
    return 'CONCLUIDO' as const;
  }
  return 'ATIVO' as const;
};

export const estagiosProgramasService = {
  async list(query: ListEstagiosProgramasQuery) {
    const where: Prisma.CursosEstagiosProgramasWhereInput = {
      cursoId: query.cursoId,
      status: query.status,
    };

    if (query.turmaIds && query.turmaIds.length > 0) {
      where.turmaId = { in: query.turmaIds };
    }

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { titulo: { contains: term, mode: 'insensitive' } },
        { descricao: { contains: term, mode: 'insensitive' } },
        { Cursos: { nome: { contains: term, mode: 'insensitive' } } },
        { CursosTurmas: { nome: { contains: term, mode: 'insensitive' } } },
        { CursosTurmas: { codigo: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const total = await prisma.cursosEstagiosProgramas.count({ where });
    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 1;
    const page = Math.min(query.page, totalPages);

    const items = await prisma.cursosEstagiosProgramas.findMany({
      where,
      include: {
        Cursos: { select: { id: true, nome: true, codigo: true } },
        CursosTurmas: { select: { id: true, nome: true, codigo: true } },
        _count: { select: { CursosEstagiosProgramasAlunos: true } },
      },
      orderBy: { [query.orderBy]: query.order },
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      success: true,
      data: {
        items: items.map(mapProgramaResumo),
        pagination: {
          page,
          requestedPage: query.page,
          pageSize: query.pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
          isPageAdjusted: page !== query.page,
        },
      },
    };
  },

  async listByAluno(alunoId: string, query: ListEstagiosAlunoQuery) {
    await ensureAlunoExists(alunoId);

    const where: Prisma.CursosEstagiosProgramasAlunosWhereInput = {
      alunoId,
      ...(query.search && query.search.trim().length > 0
        ? {
            CursosEstagiosProgramas: {
              OR: [
                { titulo: { contains: query.search, mode: 'insensitive' } },
                { Cursos: { nome: { contains: query.search, mode: 'insensitive' } } },
                { CursosTurmas: { nome: { contains: query.search, mode: 'insensitive' } } },
                { CursosTurmas: { codigo: { contains: query.search, mode: 'insensitive' } } },
              ],
            },
          }
        : {}),
      ...(query.status
        ? {
            ...(query.status === 'CONCLUIDO'
              ? { status: CursosEstagioParticipanteStatus.CONCLUIDO }
              : query.status === 'CANCELADO'
                ? {
                    OR: [
                      { status: CursosEstagioParticipanteStatus.CANCELADO },
                      {
                        CursosEstagiosProgramas: { status: CursosEstagioProgramaStatus.CANCELADO },
                      },
                    ],
                  }
                : {
                    AND: [
                      {
                        status: {
                          in: [
                            CursosEstagioParticipanteStatus.PENDENTE,
                            CursosEstagioParticipanteStatus.EM_ANDAMENTO,
                          ],
                        },
                      },
                      {
                        CursosEstagiosProgramas: {
                          status: {
                            in: [
                              CursosEstagioProgramaStatus.PLANEJADO,
                              CursosEstagioProgramaStatus.EM_ANDAMENTO,
                            ],
                          },
                        },
                      },
                    ],
                  }),
          }
        : {}),
    };

    const total = await prisma.cursosEstagiosProgramasAlunos.count({ where });
    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 1;
    const page = Math.min(query.page, totalPages);

    const items = await prisma.cursosEstagiosProgramasAlunos.findMany({
      where,
      select: {
        id: true,
        status: true,
        CursosEstagiosProgramas: {
          select: {
            id: true,
            titulo: true,
            status: true,
            cursoId: true,
            turmaId: true,
            periodicidade: true,
            dataInicio: true,
            dataFim: true,
            incluirSabados: true,
            usarGrupos: true,
            diasObrigatorios: true,
            cargaHorariaMinutos: true,
            Cursos: { select: { nome: true } },
            CursosTurmas: { select: { nome: true, codigo: true } },
          },
        },
      },
      orderBy: [{ atualizadoEm: 'desc' }, { criadoEm: 'desc' }],
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      success: true,
      data: {
        items: items.map((item) => ({
          id: item.CursosEstagiosProgramas.id,
          titulo: item.CursosEstagiosProgramas.titulo,
          status: mapAlunoProgramaStatus({
            participanteStatus: item.status,
            programaStatus: item.CursosEstagiosProgramas.status,
          }),
          cursoId: item.CursosEstagiosProgramas.cursoId,
          cursoNome: item.CursosEstagiosProgramas.Cursos.nome,
          turmaId: item.CursosEstagiosProgramas.turmaId,
          turmaNome: item.CursosEstagiosProgramas.CursosTurmas.nome,
          turmaCodigo: item.CursosEstagiosProgramas.CursosTurmas.codigo,
          periodo: {
            dataInicio: dateToIsoDay(item.CursosEstagiosProgramas.dataInicio),
            dataFim: dateToIsoDay(item.CursosEstagiosProgramas.dataFim),
            periodicidade: item.CursosEstagiosProgramas.periodicidade,
            incluirSabados: item.CursosEstagiosProgramas.incluirSabados,
          },
          usarGrupos: item.CursosEstagiosProgramas.usarGrupos,
          diasObrigatorios: item.CursosEstagiosProgramas.diasObrigatorios,
          cargaHorariaMinutos: item.CursosEstagiosProgramas.cargaHorariaMinutos,
        })),
        pagination: {
          page,
          pageSize: query.pageSize,
          total,
          totalPages,
        },
      },
    };
  },

  async create(input: CreateEstagioProgramaInput, actorId?: string) {
    const created = await prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, input.cursoId, input.turmaId);

      const calendarioObrigatorio = buildCalendarioObrigatorio({
        periodicidade: input.periodo.periodicidade,
        diasSemana: input.periodo.diasSemana ?? [],
        dataInicio: input.periodo.dataInicio,
        dataFim: input.periodo.dataFim,
        incluirSabados: input.periodo.incluirSabados,
      });
      const diasObrigatorios = calendarioObrigatorio.length;
      const minutosPorDia = getDailyMinutesForProgram({
        usarGrupos: input.usarGrupos,
        horarioPadraoInicio: input.horarioPadrao?.horaInicio ?? null,
        horarioPadraoFim: input.horarioPadrao?.horaFim ?? null,
        grupos: (input.grupos ?? []).map((grupo) => ({
          horaInicio: grupo.horaInicio ?? null,
          horaFim: grupo.horaFim ?? null,
        })),
      });

      const estagio = await tx.cursosEstagiosProgramas.create({
        data: {
          cursoId: input.cursoId,
          turmaId: input.turmaId,
          titulo: input.titulo,
          descricao: input.descricao ?? null,
          obrigatorio: input.obrigatorio,
          modoAlocacao: input.modoAlocacao,
          usarGrupos: input.usarGrupos,
          periodicidade: input.periodo.periodicidade,
          diasSemana: input.periodo.diasSemana ?? [],
          dataInicio: input.periodo.dataInicio,
          dataFim: input.periodo.dataFim,
          incluirSabados: input.periodo.incluirSabados,
          horarioPadraoInicio: input.horarioPadrao?.horaInicio ?? null,
          horarioPadraoFim: input.horarioPadrao?.horaFim ?? null,
          diasObrigatorios,
          cargaHorariaMinutos: diasObrigatorios * minutosPorDia,
          empresaVinculoModo: input.empresa?.vinculoModo ?? null,
          empresaId: input.empresa?.empresaId ?? null,
          empresaNome: input.empresa?.nome ?? null,
          empresaCnpj: input.empresa?.cnpj ?? null,
          empresaTelefone: input.empresa?.telefone ?? null,
          empresaEmail: input.empresa?.email ?? null,
          empresaEndereco:
            (input.empresa?.endereco as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
          status: input.status ?? CursosEstagioProgramaStatus.PLANEJADO,
          criadoPorId: actorId ?? null,
          atualizadoPorId: actorId ?? null,
        },
      });

      const gruposCriados: { id: string; capacidade: number | null }[] = [];
      if (input.usarGrupos && input.grupos.length > 0) {
        for (const grupo of input.grupos) {
          const grupoCriado = await tx.cursosEstagiosProgramasGrupos.create({
            data: {
              estagioId: estagio.id,
              nome: grupo.nome,
              turno: grupo.turno,
              capacidade: grupo.capacidade ?? null,
              horaInicio: grupo.horaInicio ?? null,
              horaFim: grupo.horaFim ?? null,
              empresaId: grupo.empresaId ?? null,
              empresaNome: grupo.empresaNome ?? null,
              supervisorNome: grupo.supervisorNome ?? null,
              contatoSupervisor: grupo.contatoSupervisor ?? null,
            },
            select: { id: true, capacidade: true },
          });
          gruposCriados.push(grupoCriado);
        }
      }

      if (input.modoAlocacao === CursosEstagioModoAlocacao.TODOS) {
        const inscricoes = await tx.cursosTurmasInscricoes.findMany({
          where: {
            turmaId: input.turmaId,
            status: {
              in: [
                StatusInscricao.INSCRITO,
                StatusInscricao.EM_ANDAMENTO,
                StatusInscricao.EM_ESTAGIO,
              ],
            },
          },
          select: { id: true, alunoId: true },
        });

        await ensureInitialParticipationAllowed(tx, {
          estagioId: estagio.id,
          cursoId: input.cursoId,
          turmaId: input.turmaId,
          alunoIds: inscricoes.map((item) => item.alunoId),
        });

        if (inscricoes.length > 0) {
          if (input.usarGrupos) {
            ensureGroupCapacityForTodos(gruposCriados, inscricoes.length);
          }

          const slots = input.usarGrupos ? buildGroupAllocationSlots(gruposCriados) : [];
          await tx.cursosEstagiosProgramasAlunos.createMany({
            data: inscricoes.map((inscricao) => ({
              estagioId: estagio.id,
              grupoId: input.usarGrupos ? (slots.shift() ?? null) : null,
              inscricaoId: inscricao.id,
              alunoId: inscricao.alunoId,
              tipoParticipacao: CursosEstagioTipoParticipacao.INICIAL,
              status: CursosEstagioParticipanteStatus.PENDENTE,
              criadoPorId: actorId ?? null,
              atualizadoPorId: actorId ?? null,
            })),
            skipDuplicates: true,
          });
        }
      }

      return estagio.id;
    });

    return this.getById(created);
  },

  async getById(estagioId: string) {
    return getCachedOrFetch(
      buildEstagioDetailCacheKey(estagioId),
      async () => {
        const estagio = await prisma.cursosEstagiosProgramas.findUnique({
          where: { id: estagioId },
          include: includeProgramaDetalhe,
        });

        if (!estagio) {
          const error = new Error('Estágio não encontrado');
          (error as any).code = 'ESTAGIO_NOT_FOUND';
          throw error;
        }

        return {
          success: true,
          data: mapProgramaDetalhe(estagio),
        };
      },
      ESTAGIO_DETAIL_CACHE_TTL_SECONDS,
    );
  },

  async getByIdForAluno(alunoId: string, estagioId: string) {
    await ensureAlunoExists(alunoId);

    const estagio = await prisma.cursosEstagiosProgramas.findFirst({
      where: {
        id: estagioId,
        CursosEstagiosProgramasAlunos: {
          some: { alunoId },
        },
      },
      include: includeProgramaDetalhe,
    });

    if (!estagio) {
      const error = new Error('Estágio não encontrado');
      (error as any).code = 'ESTAGIO_NOT_FOUND';
      throw error;
    }

    const mapped = mapProgramaDetalhe(estagio);

    return {
      success: true,
      data: {
        ...mapped,
        alunos: mapped.alunos.filter((item) => item.alunoId === alunoId),
      },
    };
  },

  async update(estagioId: string, input: UpdateEstagioProgramaInput, actorId?: string) {
    await prisma.$transaction(async (tx) => {
      const atual = await tx.cursosEstagiosProgramas.findUnique({
        where: { id: estagioId },
        include: {
          CursosEstagiosProgramasGrupos: {
            select: { id: true, capacidade: true, horaInicio: true, horaFim: true },
          },
          CursosEstagiosProgramasAlunos: {
            select: { id: true },
          },
        },
      });

      if (!atual) {
        const error = new Error('Estágio não encontrado');
        (error as any).code = 'ESTAGIO_NOT_FOUND';
        throw error;
      }

      const cursoId = input.cursoId ?? atual.cursoId;
      const turmaId = input.turmaId ?? atual.turmaId;

      if (input.cursoId || input.turmaId) {
        await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);
      }

      const periodo = input.periodo
        ? {
            periodicidade: input.periodo.periodicidade ?? atual.periodicidade,
            diasSemana: input.periodo.diasSemana ?? atual.diasSemana,
            dataInicio: input.periodo.dataInicio ?? atual.dataInicio,
            dataFim: input.periodo.dataFim ?? atual.dataFim,
            incluirSabados: input.periodo.incluirSabados ?? atual.incluirSabados,
          }
        : {
            periodicidade: atual.periodicidade,
            diasSemana: atual.diasSemana,
            dataInicio: atual.dataInicio,
            dataFim: atual.dataFim,
            incluirSabados: atual.incluirSabados,
          };

      const usarGrupos = input.usarGrupos ?? atual.usarGrupos;
      const gruposReferencia = input.grupos ?? atual.CursosEstagiosProgramasGrupos;
      const horarioPadraoInicio = input.horarioPadrao?.horaInicio ?? atual.horarioPadraoInicio;
      const horarioPadraoFim = input.horarioPadrao?.horaFim ?? atual.horarioPadraoFim;

      const calendarioObrigatorio = buildCalendarioObrigatorio({
        periodicidade: periodo.periodicidade,
        diasSemana: periodo.diasSemana,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        incluirSabados: periodo.incluirSabados,
      });
      const diasObrigatorios = calendarioObrigatorio.length;
      const minutosPorDia = getDailyMinutesForProgram({
        usarGrupos,
        horarioPadraoInicio: horarioPadraoInicio ?? null,
        horarioPadraoFim: horarioPadraoFim ?? null,
        grupos: gruposReferencia.map((grupo) => ({
          horaInicio: grupo.horaInicio ?? null,
          horaFim: grupo.horaFim ?? null,
        })),
      });

      await tx.cursosEstagiosProgramas.update({
        where: { id: estagioId },
        data: {
          cursoId,
          turmaId,
          titulo: input.titulo ?? undefined,
          descricao: Object.prototype.hasOwnProperty.call(input, 'descricao')
            ? (input.descricao ?? null)
            : undefined,
          obrigatorio: input.obrigatorio ?? undefined,
          modoAlocacao: input.modoAlocacao ?? undefined,
          usarGrupos,
          periodicidade: periodo.periodicidade,
          diasSemana: periodo.diasSemana,
          dataInicio: periodo.dataInicio,
          dataFim: periodo.dataFim,
          incluirSabados: periodo.incluirSabados,
          horarioPadraoInicio: usarGrupos ? null : (horarioPadraoInicio ?? null),
          horarioPadraoFim: usarGrupos ? null : (horarioPadraoFim ?? null),
          diasObrigatorios,
          cargaHorariaMinutos: diasObrigatorios * minutosPorDia,
          empresaVinculoModo: input.empresa?.vinculoModo ?? undefined,
          empresaId: Object.prototype.hasOwnProperty.call(input.empresa ?? {}, 'empresaId')
            ? (input.empresa?.empresaId ?? null)
            : undefined,
          empresaNome: Object.prototype.hasOwnProperty.call(input.empresa ?? {}, 'nome')
            ? (input.empresa?.nome ?? null)
            : undefined,
          empresaCnpj: Object.prototype.hasOwnProperty.call(input.empresa ?? {}, 'cnpj')
            ? (input.empresa?.cnpj ?? null)
            : undefined,
          empresaTelefone: Object.prototype.hasOwnProperty.call(input.empresa ?? {}, 'telefone')
            ? (input.empresa?.telefone ?? null)
            : undefined,
          empresaEmail: Object.prototype.hasOwnProperty.call(input.empresa ?? {}, 'email')
            ? (input.empresa?.email ?? null)
            : undefined,
          empresaEndereco: Object.prototype.hasOwnProperty.call(input.empresa ?? {}, 'endereco')
            ? ((input.empresa?.endereco as Prisma.JsonValue | undefined) ?? Prisma.JsonNull)
            : undefined,
          status: input.status ?? undefined,
          atualizadoPorId: actorId ?? null,
        },
      });

      if (input.grupos) {
        await tx.cursosEstagiosProgramasGrupos.deleteMany({ where: { estagioId } });

        if (input.grupos.length > 0) {
          for (const grupo of input.grupos) {
            await tx.cursosEstagiosProgramasGrupos.create({
              data: {
                estagioId,
                nome: grupo.nome,
                turno: grupo.turno,
                capacidade: grupo.capacidade ?? null,
                horaInicio: grupo.horaInicio ?? null,
                horaFim: grupo.horaFim ?? null,
                empresaId: grupo.empresaId ?? null,
                empresaNome: grupo.empresaNome ?? null,
                supervisorNome: grupo.supervisorNome ?? null,
                contatoSupervisor: grupo.contatoSupervisor ?? null,
              },
            });
          }
        }
      }

      const participantes = await tx.cursosEstagiosProgramasAlunos.findMany({
        where: { estagioId },
        select: { id: true },
      });

      if (participantes.length > 0) {
        if (usarGrupos) {
          const gruposAtivos = await tx.cursosEstagiosProgramasGrupos.findMany({
            where: { estagioId },
            select: { id: true, capacidade: true },
            orderBy: { criadoEm: 'asc' },
          });

          ensureGroupCapacityForTodos(gruposAtivos, participantes.length);
          const slots = buildGroupAllocationSlots(gruposAtivos);

          for (const participante of participantes) {
            await tx.cursosEstagiosProgramasAlunos.update({
              where: { id: participante.id },
              data: { grupoId: slots.shift() ?? null, atualizadoPorId: actorId ?? null },
            });
          }
        } else {
          await tx.cursosEstagiosProgramasAlunos.updateMany({
            where: { estagioId },
            data: {
              grupoId: null,
              atualizadoPorId: actorId ?? null,
            },
          });
        }
      }
    });

    await invalidateEstagioRuntimeCache(estagioId);
    return this.getById(estagioId);
  },

  async vincularAlunos(estagioId: string, input: VincularAlunosEstagioInput, actorId?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const estagio = await tx.cursosEstagiosProgramas.findUnique({
        where: { id: estagioId },
        include: {
          CursosEstagiosProgramasGrupos: {
            select: { id: true, capacidade: true },
            orderBy: { criadoEm: 'asc' },
          },
        },
      });

      if (!estagio) {
        const error = new Error('Estágio não encontrado');
        (error as any).code = 'ESTAGIO_NOT_FOUND';
        throw error;
      }

      if (
        estagio.usarGrupos &&
        input.modo === CursosEstagioModoAlocacao.ESPECIFICOS &&
        !input.grupoIdDefault
      ) {
        const error = new Error('Grupo obrigatório para alocação quando usarGrupos=true');
        (error as any).code = 'GRUPO_OBRIGATORIO_PARA_ALOCACAO';
        throw error;
      }

      if (input.grupoIdDefault) {
        const grupo = await tx.cursosEstagiosProgramasGrupos.findFirst({
          where: { id: input.grupoIdDefault, estagioId },
          select: { id: true },
        });
        if (!grupo) {
          const error = new Error('Grupo não encontrado para o estágio');
          (error as any).code = 'GRUPO_NOT_FOUND';
          throw error;
        }
      }

      const inscricoes =
        input.modo === CursosEstagioModoAlocacao.TODOS
          ? await tx.cursosTurmasInscricoes.findMany({
              where: {
                turmaId: estagio.turmaId,
                status: {
                  in: [
                    StatusInscricao.INSCRITO,
                    StatusInscricao.EM_ANDAMENTO,
                    StatusInscricao.EM_ESTAGIO,
                  ],
                },
              },
              select: { id: true, alunoId: true },
            })
          : await tx.cursosTurmasInscricoes.findMany({
              where: {
                turmaId: estagio.turmaId,
                id: { in: input.inscricaoIds ?? [] },
              },
              select: { id: true, alunoId: true },
            });

      if (inscricoes.length === 0) {
        return {
          success: true,
          data: {
            estagioId,
            vinculados: 0,
          },
        };
      }

      if (input.tipoParticipacao === CursosEstagioTipoParticipacao.INICIAL) {
        await ensureInitialParticipationAllowed(tx, {
          estagioId,
          cursoId: estagio.cursoId,
          turmaId: estagio.turmaId,
          alunoIds: inscricoes.map((item) => item.alunoId),
        });
      }

      if (estagio.usarGrupos && input.modo === CursosEstagioModoAlocacao.TODOS) {
        ensureGroupCapacityForTodos(estagio.CursosEstagiosProgramasGrupos, inscricoes.length);
      }

      const existingLinks = await tx.cursosEstagiosProgramasAlunos.findMany({
        where: {
          estagioId,
          inscricaoId: { in: inscricoes.map((item) => item.id) },
        },
        select: {
          inscricaoId: true,
          grupoId: true,
        },
      });

      if (estagio.usarGrupos && input.modo === CursosEstagioModoAlocacao.ESPECIFICOS) {
        const conflictedInscricoes = existingLinks
          .filter(
            (item) => item.grupoId && input.grupoIdDefault && item.grupoId !== input.grupoIdDefault,
          )
          .map((item) => item.inscricaoId);

        if (conflictedInscricoes.length > 0) {
          const error = new Error('Aluno já está alocado em outro grupo deste estágio');
          (error as any).code = 'ALUNO_EM_GRUPOS_DUPLICADOS';
          (error as any).data = {
            estagioId,
            inscricaoIds: conflictedInscricoes,
          };
          throw error;
        }

        const grupoSelecionado = estagio.CursosEstagiosProgramasGrupos.find(
          (grupo) => grupo.id === input.grupoIdDefault,
        );
        if (grupoSelecionado?.capacidade != null) {
          const inscricoesJaVinculadas = new Set(existingLinks.map((item) => item.inscricaoId));
          const inscricoesNovas = inscricoes.filter((item) => !inscricoesJaVinculadas.has(item.id));

          const vinculadosNoGrupo = await tx.cursosEstagiosProgramasAlunos.count({
            where: {
              estagioId,
              grupoId: input.grupoIdDefault,
            },
          });

          if (vinculadosNoGrupo + inscricoesNovas.length > grupoSelecionado.capacidade) {
            const error = new Error(
              'A capacidade total dos grupos é insuficiente para a quantidade de alunos da turma. Ajuste as capacidades ou crie novos grupos.',
            );
            (error as any).code = 'CAPACIDADE_GRUPOS_INSUFICIENTE';
            (error as any).data = {
              estagioId,
              grupoId: input.grupoIdDefault,
              capacidade: grupoSelecionado.capacidade,
              vinculadosNoGrupo,
              tentandoVincular: inscricoesNovas.length,
            };
            throw error;
          }
        }
      }

      const slots =
        estagio.usarGrupos && input.modo === CursosEstagioModoAlocacao.TODOS
          ? buildGroupAllocationSlots(estagio.CursosEstagiosProgramasGrupos)
          : [];

      const result = await tx.cursosEstagiosProgramasAlunos.createMany({
        data: inscricoes.map((inscricao) => ({
          estagioId,
          grupoId: estagio.usarGrupos
            ? input.modo === CursosEstagioModoAlocacao.TODOS
              ? (slots.shift() ?? null)
              : (input.grupoIdDefault ?? null)
            : null,
          inscricaoId: inscricao.id,
          alunoId: inscricao.alunoId,
          tipoParticipacao: input.tipoParticipacao,
          status: CursosEstagioParticipanteStatus.PENDENTE,
          criadoPorId: actorId ?? null,
          atualizadoPorId: actorId ?? null,
        })),
        skipDuplicates: true,
      });

      return {
        success: true,
        data: {
          estagioId,
          vinculados: result.count,
        },
      };
    });
    await invalidateEstagioRuntimeCache(estagioId);
    return result;
  },

  async alocarGrupo(
    estagioId: string,
    estagioAlunoId: string,
    grupoId: string | null,
    actorId?: string,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const estagio = await tx.cursosEstagiosProgramas.findUnique({
        where: { id: estagioId },
        select: { id: true, usarGrupos: true },
      });

      if (!estagio) {
        const error = new Error('Estágio não encontrado');
        (error as any).code = 'ESTAGIO_NOT_FOUND';
        throw error;
      }

      const participante = await tx.cursosEstagiosProgramasAlunos.findFirst({
        where: { id: estagioAlunoId, estagioId },
        select: { id: true },
      });

      if (!participante) {
        const error = new Error('Vínculo de aluno com estágio não encontrado');
        (error as any).code = 'ESTAGIO_ALUNO_NOT_FOUND';
        throw error;
      }

      if (!estagio.usarGrupos && grupoId) {
        const error = new Error('Este estágio não usa grupos');
        (error as any).code = 'GRUPO_OBRIGATORIO_PARA_ALOCACAO';
        throw error;
      }

      if (grupoId) {
        const grupo = await tx.cursosEstagiosProgramasGrupos.findFirst({
          where: { id: grupoId, estagioId },
          select: { id: true },
        });
        if (!grupo) {
          const error = new Error('Grupo não encontrado para o estágio');
          (error as any).code = 'GRUPO_NOT_FOUND';
          throw error;
        }
      }

      const updated = await tx.cursosEstagiosProgramasAlunos.update({
        where: { id: estagioAlunoId },
        data: {
          grupoId,
          atualizadoPorId: actorId ?? null,
        },
      });

      return {
        success: true,
        data: {
          id: updated.id,
          grupoId: updated.grupoId,
        },
      };
    });
    await invalidateEstagioRuntimeCache(estagioId);
    return result;
  },

  async listFrequencias(estagioId: string, query: ListFrequenciasEstagioQuery, alunoId?: string) {
    const cacheKey = buildEstagioFrequenciasCacheKey(estagioId, query, alunoId);
    const statusPersistido = query.status && query.status !== 'PENDENTE' ? query.status : undefined;
    const wantsPendingOnly = query.status === 'PENDENTE';

    return getCachedOrFetch(
      cacheKey,
      async () => {
        const estagio = await prisma.cursosEstagiosProgramas.findUnique({
          where: { id: estagioId },
          select: estagioMetaSelect,
        });

        if (!estagio) {
          const error = new Error('Estágio não encontrado');
          (error as any).code = 'ESTAGIO_NOT_FOUND';
          throw error;
        }

        const estagioMeta = {
          cursoId: estagio.cursoId,
          cursoNome: estagio.Cursos.nome,
          turmaId: estagio.turmaId,
          turmaNome: estagio.CursosTurmas.nome,
          turmaCodigo: estagio.CursosTurmas.codigo,
        };

        const participanteWhere = buildParticipanteWhere({
          estagioId,
          grupoId: query.grupoId,
          alunoId,
          search: query.search,
        });

        if (query.data) {
          const normalizedDate = toStartOfDay(query.data);
          const [totalParticipantes, participantes] = await Promise.all([
            prisma.cursosEstagiosProgramasAlunos.count({ where: participanteWhere }),
            prisma.cursosEstagiosProgramasAlunos.findMany({
              where: participanteWhere,
              select: participanteListSelect,
              orderBy: {
                CursosTurmasInscricoes: { Usuarios: { nomeCompleto: 'asc' } },
              },
              skip: (query.page - 1) * query.pageSize,
              take: query.pageSize,
            }),
          ]);

          const frequenciasPersistidas =
            participantes.length > 0
              ? await prisma.cursosEstagiosProgramasFrequencias.findMany({
                  where: {
                    estagioId,
                    estagioAlunoId: { in: participantes.map((item) => item.id) },
                    dataReferencia: normalizedDate,
                    ...(statusPersistido ? { status: statusPersistido } : {}),
                  },
                  select: {
                    id: true,
                    estagioAlunoId: true,
                    dataReferencia: true,
                    status: true,
                    motivo: true,
                    lancadoEm: true,
                    atualizadoEm: true,
                    Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios: {
                      select: { id: true, nomeCompleto: true, role: true },
                    },
                  },
                })
              : [];

          const persistidasMap = new Map(
            frequenciasPersistidas.map((item) => [item.estagioAlunoId, item]),
          );

          const items = participantes
            .map((participante) => {
              const persisted = persistidasMap.get(participante.id);
              if (persisted) {
                if (wantsPendingOnly) {
                  return null;
                }
                return mapFrequenciaEstagioFromParts({
                  estagioId,
                  estagioMeta,
                  participante,
                  frequencia: {
                    id: persisted.id,
                    status: persisted.status,
                    motivo: persisted.motivo,
                    dataReferencia: persisted.dataReferencia,
                    lancadoEm: persisted.lancadoEm,
                    atualizadoEm: persisted.atualizadoEm,
                    lancadoPor:
                      persisted.Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios,
                  },
                });
              }

              if (statusPersistido) {
                return null;
              }

              return {
                id: null,
                isPersisted: false,
                estagioId,
                estagioAlunoId: participante.id,
                cursoId: estagioMeta.cursoId,
                cursoNome: estagioMeta.cursoNome,
                turmaId: estagioMeta.turmaId,
                turmaNome: estagioMeta.turmaNome,
                turmaCodigo: estagioMeta.turmaCodigo,
                inscricaoId: participante.inscricaoId,
                alunoId: participante.alunoId,
                alunoNome: participante.CursosTurmasInscricoes.Usuarios.nomeCompleto,
                alunoCpf: participante.CursosTurmasInscricoes.Usuarios.cpf ?? null,
                avatarUrl:
                  participante.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.avatarUrl ??
                  null,
                codigoInscricao: participante.CursosTurmasInscricoes.codigo,
                codigoMatricula: participante.CursosTurmasInscricoes.codigo,
                grupo: participante.CursosEstagiosProgramasGrupos,
                dataReferencia: dateToIsoDay(normalizedDate),
                status: 'PENDENTE',
                motivo: null,
                lancadoPor: null,
                lancadoEm: null,
                atualizadoEm: null,
              };
            })
            .filter((item) => item !== null);

          const totalPages =
            totalParticipantes > 0 ? Math.ceil(totalParticipantes / query.pageSize) : 1;

          return {
            success: true,
            data: {
              items,
              pagination: {
                page: query.page,
                pageSize: query.pageSize,
                total: totalParticipantes,
                totalPages,
              },
            },
          };
        }

        const where: Prisma.CursosEstagiosProgramasFrequenciasWhereInput = {
          estagioId,
          ...(statusPersistido ? { status: statusPersistido } : {}),
          ...(query.grupoId
            ? {
                CursosEstagiosProgramasAlunos: {
                  grupoId: query.grupoId,
                  ...(alunoId ? { alunoId } : {}),
                },
              }
            : {}),
          ...(!query.grupoId && alunoId
            ? {
                CursosEstagiosProgramasAlunos: {
                  alunoId,
                },
              }
            : {}),
          ...(query.search
            ? {
                OR: [
                  {
                    CursosEstagiosProgramasAlunos: {
                      ...(alunoId ? { alunoId } : {}),
                      CursosTurmasInscricoes: {
                        Usuarios: {
                          nomeCompleto: { contains: query.search, mode: 'insensitive' },
                        },
                      },
                    },
                  },
                  {
                    CursosEstagiosProgramasAlunos: {
                      ...(alunoId ? { alunoId } : {}),
                      CursosTurmasInscricoes: {
                        codigo: { contains: query.search, mode: 'insensitive' },
                      },
                    },
                  },
                ],
              }
            : {}),
        };

        if (wantsPendingOnly) {
          return {
            success: true,
            data: {
              items: [],
              pagination: {
                page: query.page,
                pageSize: query.pageSize,
                total: 0,
                totalPages: 1,
              },
            },
          };
        }

        const total = await prisma.cursosEstagiosProgramasFrequencias.count({ where });
        const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 1;
        const page = Math.min(query.page, totalPages);

        const frequencias = await prisma.cursosEstagiosProgramasFrequencias.findMany({
          where,
          select: {
            id: true,
            estagioAlunoId: true,
            dataReferencia: true,
            status: true,
            motivo: true,
            lancadoEm: true,
            atualizadoEm: true,
            CursosEstagiosProgramasAlunos: {
              select: participanteListSelect,
            },
            Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios: {
              select: { id: true, nomeCompleto: true, role: true },
            },
          },
          orderBy: [{ dataReferencia: 'desc' }, { atualizadoEm: 'desc' }],
          skip: (page - 1) * query.pageSize,
          take: query.pageSize,
        });

        return {
          success: true,
          data: {
            items: frequencias.map((item) =>
              mapFrequenciaEstagioFromParts({
                estagioId,
                estagioMeta,
                participante: item.CursosEstagiosProgramasAlunos,
                frequencia: {
                  id: item.id,
                  status: item.status,
                  motivo: item.motivo,
                  dataReferencia: item.dataReferencia,
                  lancadoEm: item.lancadoEm,
                  atualizadoEm: item.atualizadoEm,
                  lancadoPor:
                    item.Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios,
                },
              }),
            ),
            pagination: {
              page,
              requestedPage: query.page,
              pageSize: query.pageSize,
              total,
              totalPages,
              hasNext: page < totalPages,
              hasPrevious: page > 1,
              isPageAdjusted: page !== query.page,
            },
          },
        };
      },
      ESTAGIO_FREQUENCIAS_CACHE_TTL_SECONDS,
    );
  },

  async listFrequenciasPeriodo(
    estagioId: string,
    query: ListFrequenciasEstagioPeriodoQuery,
    alunoId?: string,
  ) {
    const cacheKey = buildEstagioFrequenciasPeriodoCacheKey(estagioId, query, alunoId);
    const statusPersistido = query.status && query.status !== 'PENDENTE' ? query.status : undefined;
    const wantsPendingOnly = query.status === 'PENDENTE';

    return getCachedOrFetch(
      cacheKey,
      async () => {
        const estagio = await prisma.cursosEstagiosProgramas.findUnique({
          where: { id: estagioId },
          select: {
            ...estagioMetaSelect,
            periodicidade: true,
            diasSemana: true,
            dataInicio: true,
            dataFim: true,
            incluirSabados: true,
          },
        });

        if (!estagio) {
          const error = new Error('Estágio não encontrado');
          (error as any).code = 'ESTAGIO_NOT_FOUND';
          throw error;
        }

        const calendarioObrigatorio = buildCalendarioObrigatorio({
          periodicidade: estagio.periodicidade,
          diasSemana: estagio.diasSemana,
          dataInicio: estagio.dataInicio,
          dataFim: estagio.dataFim,
          incluirSabados: estagio.incluirSabados,
        }).map(dateToIsoDay);

        const firstCalendarDay = calendarioObrigatorio[0] ?? dateToIsoDay(estagio.dataInicio);
        const lastCalendarDay =
          calendarioObrigatorio[calendarioObrigatorio.length - 1] ?? dateToIsoDay(estagio.dataFim);
        const rangeStart = query.dataInicio ? dateToIsoDay(query.dataInicio) : firstCalendarDay;
        const rangeEnd = query.dataFim ? dateToIsoDay(query.dataFim) : lastCalendarDay;
        const datasSelecionadas = calendarioObrigatorio.filter(
          (day) => day >= rangeStart && day <= rangeEnd,
        );

        const participanteWhere = buildParticipanteWhere({
          estagioId,
          grupoId: query.grupoId,
          alunoId,
          search: query.search,
        });

        const [totalParticipantes, participantes] = await Promise.all([
          prisma.cursosEstagiosProgramasAlunos.count({ where: participanteWhere }),
          prisma.cursosEstagiosProgramasAlunos.findMany({
            where: participanteWhere,
            select: participanteListSelect,
            orderBy: {
              CursosTurmasInscricoes: { Usuarios: { nomeCompleto: 'asc' } },
            },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
        ]);

        const totalPages =
          totalParticipantes > 0 ? Math.ceil(totalParticipantes / query.pageSize) : 1;
        const page = Math.min(query.page, totalPages);

        if (datasSelecionadas.length === 0 || participantes.length === 0) {
          return {
            success: true,
            data: {
              gruposPorData: datasSelecionadas.map((data) => ({ data, items: [] })),
              pagination: {
                page,
                requestedPage: query.page,
                pageSize: query.pageSize,
                total: totalParticipantes,
                totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1,
                isPageAdjusted: page !== query.page,
              },
              periodo: {
                dataInicio: rangeStart,
                dataFim: rangeEnd,
                totalDatas: datasSelecionadas.length,
              },
            },
          };
        }

        const estagioMeta = {
          cursoId: estagio.cursoId,
          cursoNome: estagio.Cursos.nome,
          turmaId: estagio.turmaId,
          turmaNome: estagio.CursosTurmas.nome,
          turmaCodigo: estagio.CursosTurmas.codigo,
        };

        const frequenciasPersistidas = await prisma.cursosEstagiosProgramasFrequencias.findMany({
          where: {
            estagioId,
            estagioAlunoId: { in: participantes.map((item) => item.id) },
            dataReferencia: {
              gte: isoDayToDate(datasSelecionadas[0]),
              lte: isoDayToDate(datasSelecionadas[datasSelecionadas.length - 1], true),
            },
            ...(statusPersistido ? { status: statusPersistido } : {}),
          },
          select: {
            id: true,
            estagioAlunoId: true,
            dataReferencia: true,
            status: true,
            motivo: true,
            lancadoEm: true,
            atualizadoEm: true,
            Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios: {
              select: { id: true, nomeCompleto: true, role: true },
            },
          },
        });

        const persistidasMap = new Map(
          frequenciasPersistidas.map((item) => [
            `${item.estagioAlunoId}:${dateToIsoDay(item.dataReferencia)}`,
            item,
          ]),
        );

        const gruposPorData = datasSelecionadas.map((data) => {
          const items = participantes
            .map((participante) => {
              const key = `${participante.id}:${data}`;
              const persisted = persistidasMap.get(key);
              if (persisted) {
                if (wantsPendingOnly) {
                  return null;
                }
                return mapFrequenciaEstagioFromParts({
                  estagioId,
                  estagioMeta,
                  participante,
                  frequencia: {
                    id: persisted.id,
                    status: persisted.status,
                    motivo: persisted.motivo,
                    dataReferencia: persisted.dataReferencia,
                    lancadoEm: persisted.lancadoEm,
                    atualizadoEm: persisted.atualizadoEm,
                    lancadoPor:
                      persisted.Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios,
                  },
                });
              }

              if (statusPersistido) {
                return null;
              }

              return {
                id: null,
                isPersisted: false,
                estagioId,
                estagioAlunoId: participante.id,
                cursoId: estagioMeta.cursoId,
                cursoNome: estagioMeta.cursoNome,
                turmaId: estagioMeta.turmaId,
                turmaNome: estagioMeta.turmaNome,
                turmaCodigo: estagioMeta.turmaCodigo,
                inscricaoId: participante.inscricaoId,
                alunoId: participante.alunoId,
                alunoNome: participante.CursosTurmasInscricoes.Usuarios.nomeCompleto,
                alunoCpf: participante.CursosTurmasInscricoes.Usuarios.cpf ?? null,
                avatarUrl:
                  participante.CursosTurmasInscricoes.Usuarios.UsuariosInformation?.avatarUrl ??
                  null,
                codigoInscricao: participante.CursosTurmasInscricoes.codigo,
                codigoMatricula: participante.CursosTurmasInscricoes.codigo,
                grupo: participante.CursosEstagiosProgramasGrupos,
                dataReferencia: data,
                status: 'PENDENTE',
                motivo: null,
                lancadoPor: null,
                lancadoEm: null,
                atualizadoEm: null,
              };
            })
            .filter((item) => item !== null);

          return { data, items };
        });

        return {
          success: true,
          data: {
            gruposPorData,
            pagination: {
              page,
              requestedPage: query.page,
              pageSize: query.pageSize,
              total: totalParticipantes,
              totalPages,
              hasNext: page < totalPages,
              hasPrevious: page > 1,
              isPageAdjusted: page !== query.page,
            },
            periodo: {
              dataInicio: rangeStart,
              dataFim: rangeEnd,
              totalDatas: datasSelecionadas.length,
            },
          },
        };
      },
      ESTAGIO_FREQUENCIAS_CACHE_TTL_SECONDS,
    );
  },

  async listFrequenciasByAluno(
    alunoId: string,
    estagioId: string,
    query: ListFrequenciasEstagioQuery,
  ) {
    await ensureAlunoExists(alunoId);
    return this.listFrequencias(estagioId, query, alunoId);
  },

  async listFrequenciasPeriodoByAluno(
    alunoId: string,
    estagioId: string,
    query: ListFrequenciasEstagioPeriodoQuery,
  ) {
    await ensureAlunoExists(alunoId);
    return this.listFrequenciasPeriodo(estagioId, query, alunoId);
  },

  async upsertFrequencia(
    estagioId: string,
    input: UpsertFrequenciaEstagioInput,
    actorId?: string,
    audit?: EstagioFrequenciaAuditContext,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const participante = await tx.cursosEstagiosProgramasAlunos.findFirst({
        where: { id: input.estagioAlunoId, estagioId },
        select: {
          ...participanteListSelect,
          CursosEstagiosProgramas: {
            select: {
              id: true,
              cursoId: true,
              turmaId: true,
              periodicidade: true,
              diasSemana: true,
              dataInicio: true,
              dataFim: true,
              incluirSabados: true,
              diasObrigatorios: true,
              Cursos: { select: { nome: true } },
              CursosTurmas: { select: { nome: true, codigo: true } },
            },
          },
        },
      });

      if (!participante) {
        const error = new Error('Aluno não vinculado ao estágio');
        (error as any).code = 'ESTAGIO_ALUNO_NOT_FOUND';
        throw error;
      }

      const normalizedDate = toStartOfDay(input.dataReferencia);
      const motivo = input.motivo ?? null;

      const existing = await tx.cursosEstagiosProgramasFrequencias.findUnique({
        where: {
          estagioAlunoId_dataReferencia: {
            estagioAlunoId: input.estagioAlunoId,
            dataReferencia: normalizedDate,
          },
        },
        select: {
          id: true,
          status: true,
          motivo: true,
          dataReferencia: true,
          lancadoEm: true,
          atualizadoEm: true,
          Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios: {
            select: { id: true, nomeCompleto: true, role: true },
          },
        },
      });

      const unchanged =
        existing && existing.status === input.status && (existing.motivo ?? null) === motivo;

      const frequencia = unchanged
        ? existing
        : existing
          ? await tx.cursosEstagiosProgramasFrequencias.update({
              where: { id: existing.id },
              data: {
                status: input.status,
                motivo,
                atualizadoPorId: actorId ?? null,
              },
              select: {
                id: true,
                status: true,
                motivo: true,
                dataReferencia: true,
                lancadoEm: true,
                atualizadoEm: true,
                Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios: {
                  select: { id: true, nomeCompleto: true, role: true },
                },
              },
            })
          : await tx.cursosEstagiosProgramasFrequencias.create({
              data: {
                estagioId,
                estagioAlunoId: input.estagioAlunoId,
                dataReferencia: normalizedDate,
                status: input.status,
                motivo,
                lancadoPorId: actorId ?? null,
                atualizadoPorId: actorId ?? null,
              },
              select: {
                id: true,
                status: true,
                motivo: true,
                dataReferencia: true,
                lancadoEm: true,
                atualizadoEm: true,
                Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios: {
                  select: { id: true, nomeCompleto: true, role: true },
                },
              },
            });

      if (!unchanged) {
        const deMotivo = existing?.motivo ?? null;
        const paraMotivo = motivo;
        const evento = resolveHistoricoEvento(
          existing?.status ?? null,
          input.status,
          deMotivo,
          paraMotivo,
        );
        await tx.cursosEstagiosProgramasFrequenciasHistorico.create({
          data: {
            estagioId,
            frequenciaId: frequencia.id,
            fromStatus: existing?.status ?? null,
            toStatus: input.status,
            motivo,
            actorId: actorId ?? null,
            metadata: {
              evento,
              estagioAlunoId: input.estagioAlunoId,
              dataReferencia: dateToIsoDay(normalizedDate),
              deMotivo,
              paraMotivo,
              seguranca: {
                ip: audit?.ip ?? null,
                userAgent: audit?.userAgent ?? null,
                origem: audit?.origem ?? 'WEB',
              },
            },
          },
        });

        const calendarioObrigatorio = buildCalendarioObrigatorio({
          periodicidade: participante.CursosEstagiosProgramas.periodicidade,
          diasSemana: participante.CursosEstagiosProgramas.diasSemana,
          dataInicio: participante.CursosEstagiosProgramas.dataInicio,
          dataFim: participante.CursosEstagiosProgramas.dataFim,
          incluirSabados: participante.CursosEstagiosProgramas.incluirSabados,
        });

        const isDiaObrigatorio = new Set(calendarioObrigatorio.map(dateToIsoDay)).has(
          dateToIsoDay(normalizedDate),
        );

        if (isDiaObrigatorio) {
          let diasPresentes = participante.diasPresentes;
          let diasAusentes = participante.diasAusentes;

          if (existing?.status === CursosEstagioFrequenciaStatus.PRESENTE) {
            diasPresentes -= 1;
          }
          if (existing?.status === CursosEstagioFrequenciaStatus.AUSENTE) {
            diasAusentes -= 1;
          }
          if (input.status === CursosEstagioFrequenciaStatus.PRESENTE) {
            diasPresentes += 1;
          }
          if (input.status === CursosEstagioFrequenciaStatus.AUSENTE) {
            diasAusentes += 1;
          }

          diasPresentes = Math.max(0, diasPresentes);
          diasAusentes = Math.max(0, diasAusentes);

          const diasObrigatorios =
            participante.diasObrigatorios > 0
              ? participante.diasObrigatorios
              : participante.CursosEstagiosProgramas.diasObrigatorios;
          const percentualFrequencia =
            diasObrigatorios > 0
              ? Number(((diasPresentes / diasObrigatorios) * 100).toFixed(2))
              : 0;
          const statusParticipante =
            diasPresentes + diasAusentes > 0 &&
            participante.status === CursosEstagioParticipanteStatus.PENDENTE
              ? CursosEstagioParticipanteStatus.EM_ANDAMENTO
              : participante.status;

          await tx.cursosEstagiosProgramasAlunos.update({
            where: { id: participante.id },
            data: {
              diasPresentes,
              diasAusentes,
              percentualFrequencia,
              status: statusParticipante,
              atualizadoPorId: actorId ?? null,
            },
          });
        }
      }

      return {
        success: true,
        data: mapFrequenciaEstagioFromParts({
          estagioId,
          estagioMeta: {
            cursoId: participante.CursosEstagiosProgramas.cursoId,
            cursoNome: participante.CursosEstagiosProgramas.Cursos.nome,
            turmaId: participante.CursosEstagiosProgramas.turmaId,
            turmaNome: participante.CursosEstagiosProgramas.CursosTurmas.nome,
            turmaCodigo: participante.CursosEstagiosProgramas.CursosTurmas.codigo,
          },
          participante,
          frequencia: {
            id: frequencia.id,
            status: frequencia.status,
            motivo: frequencia.motivo,
            dataReferencia: frequencia.dataReferencia,
            lancadoEm: frequencia.lancadoEm,
            atualizadoEm: frequencia.atualizadoEm,
            lancadoPor:
              frequencia.Usuarios_CursosEstagiosProgramasFrequencias_lancadoPorIdToUsuarios,
          },
        }),
      };
    });

    await invalidateEstagioRuntimeCache(estagioId);
    return result;
  },

  async upsertFrequenciaByAluno(
    alunoId: string,
    estagioId: string,
    input: UpsertFrequenciaEstagioInput,
    actorId?: string,
    audit?: EstagioFrequenciaAuditContext,
  ) {
    await ensureAlunoExists(alunoId);

    const participante = await prisma.cursosEstagiosProgramasAlunos.findFirst({
      where: {
        id: input.estagioAlunoId,
        estagioId,
        alunoId,
      },
      select: { id: true },
    });

    if (!participante) {
      const error = new Error('Aluno não vinculado ao estágio');
      (error as any).code = 'ESTAGIO_ALUNO_NOT_FOUND';
      throw error;
    }

    return this.upsertFrequencia(estagioId, input, actorId, audit);
  },

  async listFrequenciaHistorico(
    estagioId: string,
    frequenciaId: string,
    query: ListFrequenciaHistoricoEstagioQuery,
  ) {
    const [estagioExists, frequenciaExists] = await Promise.all([
      prisma.cursosEstagiosProgramas.findUnique({
        where: { id: estagioId },
        select: { id: true },
      }),
      prisma.cursosEstagiosProgramasFrequencias.findFirst({
        where: { id: frequenciaId, estagioId },
        select: { id: true, dataReferencia: true },
      }),
    ]);

    if (!estagioExists) {
      const error = new Error('Estágio não encontrado');
      (error as any).code = 'ESTAGIO_NOT_FOUND';
      throw error;
    }

    if (!frequenciaExists) {
      const error = new Error('Frequência não encontrada');
      (error as any).code = 'FREQUENCIA_NOT_FOUND';
      throw error;
    }

    const total = await prisma.cursosEstagiosProgramasFrequenciasHistorico.count({
      where: { estagioId, frequenciaId },
    });
    const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 1;
    const page = Math.min(query.page, totalPages);
    const historico = await prisma.cursosEstagiosProgramasFrequenciasHistorico.findMany({
      where: { estagioId, frequenciaId },
      orderBy: { changedAt: 'desc' },
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        Usuarios_CursosEstagiosProgramasFrequenciasHistorico_actorIdToUsuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        items: historico.map((item) => {
          const metadata = normalizeHistoricoMetadata(item.metadata as Prisma.JsonValue);
          const deMotivo = metadata.deMotivo ?? null;
          const paraMotivo = metadata.paraMotivo ?? item.motivo ?? null;
          const evento =
            metadata.evento ??
            resolveHistoricoEvento(item.fromStatus ?? null, item.toStatus, deMotivo, paraMotivo);
          const dataReferencia =
            metadata.dataReferencia ?? dateToIsoDay(frequenciaExists.dataReferencia);

          return {
            id: item.id,
            frequenciaId: item.frequenciaId,
            evento,
            deStatus: item.fromStatus,
            paraStatus: item.toStatus,
            deMotivo,
            paraMotivo,
            dataReferencia,
            createdAt: item.changedAt.toISOString(),
            ator: item.Usuarios_CursosEstagiosProgramasFrequenciasHistorico_actorIdToUsuarios
              ? {
                  usuarioId:
                    item.Usuarios_CursosEstagiosProgramasFrequenciasHistorico_actorIdToUsuarios.id,
                  nome: item.Usuarios_CursosEstagiosProgramasFrequenciasHistorico_actorIdToUsuarios
                    .nomeCompleto,
                  email:
                    item.Usuarios_CursosEstagiosProgramasFrequenciasHistorico_actorIdToUsuarios
                      .email ?? null,
                  perfil:
                    item.Usuarios_CursosEstagiosProgramasFrequenciasHistorico_actorIdToUsuarios
                      .role,
                  perfilLabel: getRoleLabel(
                    item.Usuarios_CursosEstagiosProgramasFrequenciasHistorico_actorIdToUsuarios
                      .role,
                  ),
                }
              : null,
            seguranca: {
              ip: metadata.seguranca?.ip ?? null,
              userAgent: metadata.seguranca?.userAgent ?? null,
              origem: metadata.seguranca?.origem ?? 'WEB',
            },
          };
        }),
        pagination: {
          page,
          pageSize: query.pageSize,
          total,
          totalPages,
        },
      },
    };
  },

  async listFrequenciaHistoricoByAluno(
    alunoId: string,
    estagioId: string,
    frequenciaId: string,
    query: ListFrequenciaHistoricoEstagioQuery,
  ) {
    await ensureAlunoExists(alunoId);

    const scopedFrequencia = await prisma.cursosEstagiosProgramasFrequencias.findFirst({
      where: {
        id: frequenciaId,
        estagioId,
        CursosEstagiosProgramasAlunos: { alunoId },
      },
      select: { id: true },
    });

    if (!scopedFrequencia) {
      const error = new Error('Frequência não encontrada');
      (error as any).code = 'FREQUENCIA_NOT_FOUND';
      throw error;
    }

    return this.listFrequenciaHistorico(estagioId, frequenciaId, query);
  },

  async concluirAluno(estagioId: string, estagioAlunoId: string, actorId?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const participante = await tx.cursosEstagiosProgramasAlunos.findFirst({
        where: { id: estagioAlunoId, estagioId },
      });

      if (!participante) {
        const error = new Error('Vínculo de estágio não encontrado');
        (error as any).code = 'ESTAGIO_ALUNO_NOT_FOUND';
        throw error;
      }

      const recalculated = await recalculateParticipanteMetrics(tx, estagioAlunoId);
      const percentual = decimalToNumber(recalculated?.percentualFrequencia) ?? 0;
      const elegivelCertificado = percentual >= 70;
      const conclusaoEm = new Date();
      const validadeAte = elegivelCertificado ? addDays(conclusaoEm, 365) : null;

      const updated = await tx.cursosEstagiosProgramasAlunos.update({
        where: { id: estagioAlunoId },
        data: {
          status: elegivelCertificado
            ? CursosEstagioParticipanteStatus.CONCLUIDO
            : CursosEstagioParticipanteStatus.REPROVADO,
          conclusaoEm,
          validadeAte,
          atualizadoPorId: actorId ?? null,
        },
      });

      return {
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          conclusaoEm: updated.conclusaoEm?.toISOString() ?? null,
          validadeAte: updated.validadeAte?.toISOString() ?? null,
          percentualFrequencia: decimalToNumber(updated.percentualFrequencia),
          elegivelCertificado,
        },
      };
    });
    await invalidateEstagioRuntimeCache(estagioId);
    return result;
  },
};
