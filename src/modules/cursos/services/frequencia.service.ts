import {
  AuditoriaCategoria,
  CursosAvaliacaoTipo,
  CursosFrequenciaStatus,
  Prisma,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import {
  FrequenciaWithRelations,
  frequenciaWithRelations,
  mapFrequencia,
} from './frequencia.mapper';

const frequenciasLogger = logger.child({ module: 'CursosFrequenciaService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
) => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId, deletedAt: null },
    select: { id: true },
  });

  if (!turma) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

const ensureInscricaoBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  inscricaoId: string,
) => {
  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: { id: inscricaoId, turmaId },
    select: { id: true },
  });

  if (!inscricao) {
    const error = new Error('Inscrição não encontrada para a turma informada');
    (error as any).code = 'INSCRICAO_NOT_FOUND';
    throw error;
  }
};

const ensureInscricaoBelongsToAluno = async (
  client: PrismaClientOrTx,
  alunoId: string,
  turmaId: string,
  inscricaoId: string,
) => {
  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: { id: inscricaoId, turmaId, alunoId },
    select: { id: true },
  });

  if (!inscricao) {
    const error = new Error('Inscrição não encontrada para o aluno na turma informada');
    (error as any).code = 'INSCRICAO_NOT_FOUND';
    throw error;
  }
};

const ensureAulaBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  aulaId: string,
) => {
  const aula = await client.cursosTurmasAulas.findFirst({
    where: { id: aulaId, turmaId },
    select: { id: true },
  });

  if (!aula) {
    const error = new Error('Aula não encontrada para a turma informada');
    (error as any).code = 'AULA_NOT_FOUND';
    throw error;
  }
};

const ensureFrequenciaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  frequenciaId: string,
) => {
  const frequencia = await client.cursosFrequenciaAlunos.findFirst({
    where: { id: frequenciaId, turmaId, CursosTurmas: { cursoId } },
    select: {
      id: true,
      turmaId: true,
      inscricaoId: true,
      status: true,
      aulaId: true,
      justificativa: true,
    },
  });

  if (!frequencia) {
    const error = new Error('Registro de frequência não encontrado para a turma informada');
    (error as any).code = 'FREQUENCIA_NOT_FOUND';
    throw error;
  }

  return frequencia;
};

type TipoOrigemFrequencia = 'AULA' | 'PROVA' | 'ATIVIDADE';
type ModoLancamentoFrequencia = 'MANUAL' | 'AUTOMATICO';

type FrequenciaMeta = {
  tipoOrigem: TipoOrigemFrequencia;
  origemId: string;
  origemTitulo?: string | null;
  modoLancamento?: ModoLancamentoFrequencia;
  minutosPresenca?: number | null;
  minimoMinutosParaPresenca?: number | null;
  lancadoPorId?: string | null;
  lancadoEm?: string | null;
};

type EvidencePayload = {
  acessou: boolean;
  primeiroAcessoEm: string | null;
  ultimoAcessoEm: string | null;
  minutosEngajados: number;
  respondeu: boolean;
  statusSugerido: CursosFrequenciaStatus | 'PENDENTE';
};

type HistoricoFrequenciaEntry = {
  id: string;
  fromStatus: CursosFrequenciaStatus | null;
  toStatus: CursosFrequenciaStatus | null;
  motivo: string | null;
  changedAt: string;
  actor: {
    id: string;
    nome: string;
    role: string;
    roleLabel: string;
  } | null;
};

const MINIMO_MINUTOS_PADRAO = 30;
const OBS_META_PREFIX = '__FREQMETA__';
const OBS_META_SEPARATOR = '__::';

const roleLabelMap: Record<string, string> = {
  ADMIN: 'Administrador',
  MODERADOR: 'Moderador',
  PEDAGOGICO: 'Setor Pedagógico',
  INSTRUTOR: 'Instrutor',
  ALUNO_CANDIDATO: 'Aluno/Candidato',
};

const toIsoStringOrNull = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

const toCursosFrequenciaStatusOrUndefined = (value: string | undefined) => {
  if (!value || value === 'PENDENTE') return undefined;
  if (Object.values(CursosFrequenciaStatus).includes(value as CursosFrequenciaStatus)) {
    return value as CursosFrequenciaStatus;
  }
  return undefined;
};

const serializeFrequenciaMeta = (
  observacoes: string | null | undefined,
  meta: FrequenciaMeta,
): string => {
  const payload = Buffer.from(JSON.stringify(meta), 'utf8').toString('base64url');
  const observacoesNormalizadas = normalizeNullable(observacoes) ?? '';
  return `${OBS_META_PREFIX}${payload}${OBS_META_SEPARATOR}${observacoesNormalizadas}`;
};

const decodeFrequenciaMeta = (observacoes: string | null | undefined) => {
  const observacaoTexto = observacoes ?? null;
  if (!observacaoTexto || !observacaoTexto.startsWith(OBS_META_PREFIX)) {
    return {
      meta: null as FrequenciaMeta | null,
      observacoesLimpa: normalizeNullable(observacoes) ?? null,
    };
  }

  const raw = observacaoTexto.slice(OBS_META_PREFIX.length);
  const separatorIndex = raw.indexOf(OBS_META_SEPARATOR);
  if (separatorIndex === -1) {
    return {
      meta: null as FrequenciaMeta | null,
      observacoesLimpa: normalizeNullable(observacoes) ?? null,
    };
  }

  const encodedMeta = raw.slice(0, separatorIndex);
  const observacoesLimpa = raw.slice(separatorIndex + OBS_META_SEPARATOR.length) || null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedMeta, 'base64url').toString('utf8'),
    ) as FrequenciaMeta;
    return {
      meta: parsed,
      observacoesLimpa: normalizeNullable(observacoesLimpa) ?? null,
    };
  } catch {
    return {
      meta: null as FrequenciaMeta | null,
      observacoesLimpa: normalizeNullable(observacoes) ?? null,
    };
  }
};

const ensureProvaOuAtividadeBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  origemId: string,
  tipoOrigem: Extract<TipoOrigemFrequencia, 'PROVA' | 'ATIVIDADE'>,
) => {
  const tipo = tipoOrigem === 'PROVA' ? CursosAvaliacaoTipo.PROVA : CursosAvaliacaoTipo.ATIVIDADE;
  const avaliacao = await client.cursosTurmasProvas.findFirst({
    where: {
      id: origemId,
      turmaId,
      tipo,
    },
    select: { id: true, titulo: true },
  });

  if (!avaliacao) {
    const error = new Error(
      tipoOrigem === 'PROVA'
        ? 'Prova não encontrada para a turma informada'
        : 'Atividade não encontrada para a turma informada',
    );
    (error as any).code = tipoOrigem === 'PROVA' ? 'PROVA_NOT_FOUND' : 'ATIVIDADE_NOT_FOUND';
    throw error;
  }

  return avaliacao;
};

const resolveOrigemData = async (
  client: PrismaClientOrTx,
  turmaId: string,
  input: {
    aulaId?: string | null;
    tipoOrigem?: TipoOrigemFrequencia;
    origemId?: string | null;
    origemTitulo?: string | null;
  },
) => {
  const tipoOrigem = input.tipoOrigem ?? (input.aulaId ? 'AULA' : undefined);

  if (!tipoOrigem) {
    const error = new Error('tipoOrigem é obrigatório');
    (error as any).code = 'VALIDATION_ERROR';
    throw error;
  }

  const origemId = input.origemId ?? input.aulaId ?? null;
  if (!origemId) {
    const error = new Error('origemId é obrigatório para o tipo de origem informado');
    (error as any).code = 'VALIDATION_ERROR';
    throw error;
  }

  if (tipoOrigem === 'AULA') {
    await ensureAulaBelongsToTurma(client, turmaId, origemId);
    const aula = await client.cursosTurmasAulas.findUnique({
      where: { id: origemId },
      select: { id: true, nome: true },
    });
    return {
      tipoOrigem,
      origemId,
      origemTitulo: input.origemTitulo?.trim() || aula?.nome || null,
      aulaId: origemId,
    };
  }

  const avaliacao = await ensureProvaOuAtividadeBelongsToTurma(
    client,
    turmaId,
    origemId,
    tipoOrigem,
  );
  return {
    tipoOrigem,
    origemId,
    origemTitulo: input.origemTitulo?.trim() || avaliacao.titulo || null,
    aulaId: null,
  };
};

const findDuplicateByOrigem = async (
  client: PrismaClientOrTx,
  turmaId: string,
  inscricaoId: string,
  origem: {
    tipoOrigem: TipoOrigemFrequencia;
    origemId: string;
  },
  exceptId?: string,
) => {
  if (origem.tipoOrigem === 'AULA') {
    const found = await client.cursosFrequenciaAlunos.findFirst({
      where: {
        turmaId,
        inscricaoId,
        aulaId: origem.origemId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    return found;
  }

  const candidatos = await client.cursosFrequenciaAlunos.findMany({
    where: {
      turmaId,
      inscricaoId,
      aulaId: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, observacoes: true },
  });

  for (const item of candidatos) {
    const { meta } = decodeFrequenciaMeta(item.observacoes);
    if (meta?.tipoOrigem === origem.tipoOrigem && meta?.origemId === origem.origemId) {
      return item;
    }
  }

  return null;
};

const normalizeNullable = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toRecord = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

const toStatusFromJson = (value: unknown): CursosFrequenciaStatus | null => {
  if (typeof value !== 'string') return null;
  if (Object.values(CursosFrequenciaStatus).includes(value as CursosFrequenciaStatus)) {
    return value as CursosFrequenciaStatus;
  }
  return null;
};

const mapHistoricoFromAudit = (log: {
  id: string;
  criadoEm: Date;
  dadosAnteriores: Prisma.JsonValue | null;
  dadosNovos: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  Usuarios: { id: string; nomeCompleto: string; role: string } | null;
}): HistoricoFrequenciaEntry => {
  const dadosAnteriores = toRecord(log.dadosAnteriores);
  const dadosNovos = toRecord(log.dadosNovos);
  const metadata = toRecord(log.metadata);

  const fromStatus =
    toStatusFromJson(dadosAnteriores.statusAnterior) ??
    toStatusFromJson(metadata.statusAnterior) ??
    null;
  const toStatus =
    toStatusFromJson(dadosNovos.statusNovo) ?? toStatusFromJson(metadata.statusNovo) ?? null;

  const motivo =
    normalizeNullable((dadosNovos.justificativaNova as string | null | undefined) ?? undefined) ??
    normalizeNullable((metadata.justificativaNova as string | null | undefined) ?? undefined) ??
    normalizeNullable((dadosNovos.justificativa as string | null | undefined) ?? undefined) ??
    normalizeNullable((metadata.justificativa as string | null | undefined) ?? undefined) ??
    null;

  return {
    id: log.id,
    fromStatus,
    toStatus,
    motivo,
    changedAt: log.criadoEm.toISOString(),
    actor: log.Usuarios
      ? {
          id: log.Usuarios.id,
          nome: log.Usuarios.nomeCompleto,
          role: log.Usuarios.role,
          roleLabel: roleLabelMap[log.Usuarios.role] ?? log.Usuarios.role,
        }
      : null,
  };
};

const ensureJustificativaWhenRequired = (
  status: CursosFrequenciaStatus,
  justificativa?: string | null,
) => {
  if (status === CursosFrequenciaStatus.JUSTIFICADO || status === CursosFrequenciaStatus.AUSENTE) {
    const normalized = justificativa?.trim() ?? '';
    if (!normalized) {
      const error = new Error('Justificativa é obrigatória para status AUSENTE ou JUSTIFICADO');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }
  }
};

const buildEvidence = async (
  client: PrismaClientOrTx,
  frequencia: FrequenciaWithRelations,
  origem: { tipoOrigem: TipoOrigemFrequencia; origemId: string },
  minimoMinutosParaPresenca: number,
  minutosPresencaManual?: number | null,
): Promise<EvidencePayload> => {
  if (origem.tipoOrigem === 'AULA') {
    const progresso = await client.cursosAulasProgresso.findFirst({
      where: {
        aulaId: origem.origemId,
        inscricaoId: frequencia.inscricaoId,
      },
      select: {
        tempoAssistidoSegundos: true,
        iniciadoEm: true,
        atualizadoEm: true,
      },
    });

    const minutosEngajados = progresso
      ? Math.floor((progresso.tempoAssistidoSegundos || 0) / 60)
      : 0;
    const minutosBase = minutosPresencaManual ?? minutosEngajados;
    return {
      acessou:
        !!progresso && (!!progresso.iniciadoEm || (progresso.tempoAssistidoSegundos || 0) > 0),
      primeiroAcessoEm: toIsoStringOrNull(progresso?.iniciadoEm),
      ultimoAcessoEm: toIsoStringOrNull(progresso?.atualizadoEm),
      minutosEngajados,
      respondeu: false,
      statusSugerido:
        minutosBase >= minimoMinutosParaPresenca
          ? CursosFrequenciaStatus.PRESENTE
          : ('PENDENTE' as const),
    };
  }

  const [envio, respostasAgg] = await Promise.all([
    client.cursosTurmasProvasEnvios.findFirst({
      where: {
        provaId: origem.origemId,
        inscricaoId: frequencia.inscricaoId,
      },
      select: {
        realizadoEm: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    }),
    client.cursosTurmasProvasRespostas.aggregate({
      where: {
        inscricaoId: frequencia.inscricaoId,
        CursosTurmasProvasQuestoes: {
          provaId: origem.origemId,
        },
      },
      _min: { criadoEm: true },
      _max: { atualizadoEm: true },
      _count: { _all: true },
    }),
  ]);

  const primeiroAcesso =
    respostasAgg._min.criadoEm ??
    envio?.criadoEm ??
    envio?.realizadoEm ??
    envio?.atualizadoEm ??
    null;
  const ultimoAcesso =
    respostasAgg._max.atualizadoEm ??
    envio?.atualizadoEm ??
    envio?.realizadoEm ??
    envio?.criadoEm ??
    primeiroAcesso;
  const minutosCalculados =
    primeiroAcesso && ultimoAcesso
      ? Math.max(0, Math.round((ultimoAcesso.getTime() - primeiroAcesso.getTime()) / 60000))
      : 0;
  const minutosBase = minutosPresencaManual ?? minutosCalculados;
  const respondeu = Boolean(envio) || (respostasAgg._count._all ?? 0) > 0;

  return {
    acessou: respondeu || Boolean(primeiroAcesso),
    primeiroAcessoEm: toIsoStringOrNull(primeiroAcesso),
    ultimoAcessoEm: toIsoStringOrNull(ultimoAcesso),
    minutosEngajados: minutosCalculados,
    respondeu,
    statusSugerido:
      respondeu || minutosBase >= minimoMinutosParaPresenca
        ? CursosFrequenciaStatus.PRESENTE
        : ('PENDENTE' as const),
  };
};

const enrichFrequencia = async (client: PrismaClientOrTx, frequencia: FrequenciaWithRelations) => {
  const base = mapFrequencia(frequencia);
  const { meta, observacoesLimpa } = decodeFrequenciaMeta(frequencia.observacoes);

  const tipoOrigem = meta?.tipoOrigem ?? (frequencia.aulaId ? 'AULA' : 'AULA');
  const origemId = meta?.origemId ?? frequencia.aulaId ?? '';
  const origemTitulo = meta?.origemTitulo ?? frequencia.CursosTurmasAulas?.nome ?? null;
  const modoLancamento = meta?.modoLancamento ?? 'MANUAL';
  const minimoMinutosParaPresenca = meta?.minimoMinutosParaPresenca ?? MINIMO_MINUTOS_PADRAO;
  const minutosPresenca = meta?.minutosPresenca ?? null;

  const evidence = origemId
    ? await buildEvidence(
        client,
        frequencia,
        { tipoOrigem, origemId },
        minimoMinutosParaPresenca,
        minutosPresenca,
      )
    : {
        acessou: false,
        primeiroAcessoEm: null,
        ultimoAcessoEm: null,
        minutosEngajados: 0,
        respondeu: false,
        statusSugerido: 'PENDENTE' as const,
      };

  let lancadoPor: {
    id: string;
    nome: string;
  } | null = null;

  if (meta?.lancadoPorId) {
    const user = await client.usuarios.findUnique({
      where: { id: meta.lancadoPorId },
      select: { id: true, nomeCompleto: true },
    });
    if (user) {
      lancadoPor = { id: user.id, nome: user.nomeCompleto };
    }
  }

  return {
    ...base,
    isPersisted: true,
    observacoes: observacoesLimpa,
    tipoOrigem,
    origemId: origemId || null,
    origemTitulo,
    modoLancamento,
    minutosPresenca: minutosPresenca ?? evidence.minutosEngajados,
    minimoMinutosParaPresenca,
    evidencia: evidence,
    lancadoPor,
    lancadoEm: meta?.lancadoEm ?? base.criadoEm,
    alunoId: base.aluno?.id ?? base.inscricao?.alunoId ?? null,
    alunoNome: base.aluno?.nomeCompleto ?? base.aluno?.nome ?? null,
    naturalKey: {
      inscricaoId: base.inscricaoId,
      tipoOrigem,
      origemId: origemId || null,
    },
  };
};

const buildPairKey = (inscricaoId: string, origemId: string) => `${inscricaoId}:${origemId}`;

const enrichFrequenciasBatch = async (
  client: PrismaClientOrTx,
  frequencias: FrequenciaWithRelations[],
) => {
  if (frequencias.length === 0) return [] as any[];

  const decoded = frequencias.map((frequencia) => {
    const base = mapFrequencia(frequencia);
    const { meta, observacoesLimpa } = decodeFrequenciaMeta(frequencia.observacoes);

    const tipoOrigem = meta?.tipoOrigem ?? (frequencia.aulaId ? 'AULA' : 'AULA');
    const origemId = meta?.origemId ?? frequencia.aulaId ?? '';
    const origemTitulo = meta?.origemTitulo ?? frequencia.CursosTurmasAulas?.nome ?? null;
    const modoLancamento = meta?.modoLancamento ?? 'MANUAL';
    const minimoMinutosParaPresenca = meta?.minimoMinutosParaPresenca ?? MINIMO_MINUTOS_PADRAO;
    const minutosPresenca = meta?.minutosPresenca ?? null;

    return {
      frequencia,
      base,
      meta,
      observacoesLimpa,
      tipoOrigem,
      origemId,
      origemTitulo,
      modoLancamento,
      minimoMinutosParaPresenca,
      minutosPresenca,
    };
  });

  const aulaPairs = decoded.filter((item) => item.tipoOrigem === 'AULA' && item.origemId);
  const avaliacaoPairs = decoded.filter(
    (item) => (item.tipoOrigem === 'PROVA' || item.tipoOrigem === 'ATIVIDADE') && item.origemId,
  );

  const aulaIds = Array.from(new Set(aulaPairs.map((item) => item.origemId)));
  const aulaInscricaoIds = Array.from(new Set(aulaPairs.map((item) => item.base.inscricaoId)));

  const avaliacaoIds = Array.from(new Set(avaliacaoPairs.map((item) => item.origemId)));
  const avaliacaoInscricaoIds = Array.from(
    new Set(avaliacaoPairs.map((item) => item.base.inscricaoId)),
  );

  const lancadoPorIds = Array.from(
    new Set(decoded.map((item) => item.meta?.lancadoPorId).filter(Boolean) as string[]),
  );

  const [progressoRows, envioRows, respostaRows, usuariosRows] = await Promise.all([
    aulaIds.length > 0 && aulaInscricaoIds.length > 0
      ? client.cursosAulasProgresso.findMany({
          where: {
            aulaId: { in: aulaIds },
            inscricaoId: { in: aulaInscricaoIds },
          },
          select: {
            aulaId: true,
            inscricaoId: true,
            tempoAssistidoSegundos: true,
            iniciadoEm: true,
            atualizadoEm: true,
          },
        })
      : Promise.resolve([]),
    avaliacaoIds.length > 0 && avaliacaoInscricaoIds.length > 0
      ? client.cursosTurmasProvasEnvios.findMany({
          where: {
            provaId: { in: avaliacaoIds },
            inscricaoId: { in: avaliacaoInscricaoIds },
          },
          select: {
            provaId: true,
            inscricaoId: true,
            realizadoEm: true,
            criadoEm: true,
            atualizadoEm: true,
          },
        })
      : Promise.resolve([]),
    avaliacaoIds.length > 0 && avaliacaoInscricaoIds.length > 0
      ? client.cursosTurmasProvasRespostas.findMany({
          where: {
            inscricaoId: { in: avaliacaoInscricaoIds },
            CursosTurmasProvasQuestoes: {
              provaId: { in: avaliacaoIds },
            },
          },
          select: {
            inscricaoId: true,
            criadoEm: true,
            atualizadoEm: true,
            CursosTurmasProvasQuestoes: {
              select: {
                provaId: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    lancadoPorIds.length > 0
      ? client.usuarios.findMany({
          where: { id: { in: lancadoPorIds } },
          select: { id: true, nomeCompleto: true },
        })
      : Promise.resolve([]),
  ]);

  const progressoMap = new Map<
    string,
    {
      tempoAssistidoSegundos: number;
      iniciadoEm: Date | null;
      atualizadoEm: Date;
    }
  >();
  for (const row of progressoRows) {
    progressoMap.set(buildPairKey(row.inscricaoId, row.aulaId), {
      tempoAssistidoSegundos: row.tempoAssistidoSegundos ?? 0,
      iniciadoEm: row.iniciadoEm,
      atualizadoEm: row.atualizadoEm,
    });
  }

  const envioMap = new Map<
    string,
    {
      realizadoEm: Date | null;
      criadoEm: Date;
      atualizadoEm: Date;
    }
  >();
  for (const row of envioRows) {
    envioMap.set(buildPairKey(row.inscricaoId, row.provaId), {
      realizadoEm: row.realizadoEm,
      criadoEm: row.criadoEm,
      atualizadoEm: row.atualizadoEm,
    });
  }

  const respostasAggMap = new Map<
    string,
    {
      minCriadoEm: Date | null;
      maxAtualizadoEm: Date | null;
      count: number;
    }
  >();
  for (const row of respostaRows) {
    const provaId = row.CursosTurmasProvasQuestoes?.provaId;
    if (!provaId) continue;
    const key = buildPairKey(row.inscricaoId, provaId);
    const current = respostasAggMap.get(key);
    if (!current) {
      respostasAggMap.set(key, {
        minCriadoEm: row.criadoEm,
        maxAtualizadoEm: row.atualizadoEm,
        count: 1,
      });
      continue;
    }
    respostasAggMap.set(key, {
      minCriadoEm:
        !current.minCriadoEm || row.criadoEm < current.minCriadoEm
          ? row.criadoEm
          : current.minCriadoEm,
      maxAtualizadoEm:
        !current.maxAtualizadoEm || row.atualizadoEm > current.maxAtualizadoEm
          ? row.atualizadoEm
          : current.maxAtualizadoEm,
      count: current.count + 1,
    });
  }

  const usuarioMap = new Map(usuariosRows.map((user) => [user.id, user.nomeCompleto]));

  return decoded.map((item) => {
    let evidencia: EvidencePayload;

    if (item.origemId && item.tipoOrigem === 'AULA') {
      const progresso = progressoMap.get(buildPairKey(item.base.inscricaoId, item.origemId));
      const minutosEngajados = progresso
        ? Math.floor((progresso.tempoAssistidoSegundos || 0) / 60)
        : 0;
      const minutosBase = item.minutosPresenca ?? minutosEngajados;
      evidencia = {
        acessou:
          !!progresso && (!!progresso.iniciadoEm || (progresso.tempoAssistidoSegundos || 0) > 0),
        primeiroAcessoEm: toIsoStringOrNull(progresso?.iniciadoEm),
        ultimoAcessoEm: toIsoStringOrNull(progresso?.atualizadoEm),
        minutosEngajados,
        respondeu: false,
        statusSugerido:
          minutosBase >= item.minimoMinutosParaPresenca
            ? CursosFrequenciaStatus.PRESENTE
            : ('PENDENTE' as const),
      };
    } else if (item.origemId) {
      const pairKey = buildPairKey(item.base.inscricaoId, item.origemId);
      const envio = envioMap.get(pairKey);
      const respostasAgg = respostasAggMap.get(pairKey);

      const primeiroAcesso =
        respostasAgg?.minCriadoEm ??
        envio?.criadoEm ??
        envio?.realizadoEm ??
        envio?.atualizadoEm ??
        null;
      const ultimoAcesso =
        respostasAgg?.maxAtualizadoEm ??
        envio?.atualizadoEm ??
        envio?.realizadoEm ??
        envio?.criadoEm ??
        primeiroAcesso;
      const minutosCalculados =
        primeiroAcesso && ultimoAcesso
          ? Math.max(0, Math.round((ultimoAcesso.getTime() - primeiroAcesso.getTime()) / 60000))
          : 0;
      const minutosBase = item.minutosPresenca ?? minutosCalculados;
      const respondeu = Boolean(envio) || (respostasAgg?.count ?? 0) > 0;

      evidencia = {
        acessou: respondeu || Boolean(primeiroAcesso),
        primeiroAcessoEm: toIsoStringOrNull(primeiroAcesso),
        ultimoAcessoEm: toIsoStringOrNull(ultimoAcesso),
        minutosEngajados: minutosCalculados,
        respondeu,
        statusSugerido:
          respondeu || minutosBase >= item.minimoMinutosParaPresenca
            ? CursosFrequenciaStatus.PRESENTE
            : ('PENDENTE' as const),
      };
    } else {
      evidencia = {
        acessou: false,
        primeiroAcessoEm: null,
        ultimoAcessoEm: null,
        minutosEngajados: 0,
        respondeu: false,
        statusSugerido: 'PENDENTE',
      };
    }

    const lancadoPorId = item.meta?.lancadoPorId ?? null;
    const lancadoPorNome = lancadoPorId ? usuarioMap.get(lancadoPorId) : null;

    return {
      ...item.base,
      isPersisted: true,
      observacoes: item.observacoesLimpa,
      tipoOrigem: item.tipoOrigem,
      origemId: item.origemId || null,
      origemTitulo: item.origemTitulo,
      modoLancamento: item.modoLancamento,
      minutosPresenca: item.minutosPresenca ?? evidencia.minutosEngajados,
      minimoMinutosParaPresenca: item.minimoMinutosParaPresenca,
      evidencia,
      lancadoPor:
        lancadoPorId && lancadoPorNome
          ? {
              id: lancadoPorId,
              nome: lancadoPorNome,
            }
          : null,
      lancadoEm: item.meta?.lancadoEm ?? item.base.criadoEm,
      alunoId: item.base.aluno?.id ?? item.base.inscricao?.alunoId ?? null,
      alunoNome: item.base.aluno?.nomeCompleto ?? item.base.aluno?.nome ?? null,
      naturalKey: {
        inscricaoId: item.base.inscricaoId,
        tipoOrigem: item.tipoOrigem,
        origemId: item.origemId || null,
      },
    };
  });
};

const writeFrequenciaAudit = async (
  tx: PrismaClientOrTx,
  payload: {
    frequenciaId: string;
    usuarioId?: string;
    descricao: string;
    acao: string;
    dadosAnteriores?: Prisma.InputJsonValue;
    dadosNovos?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
    ip?: string;
    userAgent?: string;
  },
) => {
  if (!payload.usuarioId) return;
  await tx.auditoriaLogs.create({
    data: {
      categoria: AuditoriaCategoria.CURSO,
      tipo: 'CURSO_FREQUENCIA',
      acao: payload.acao,
      usuarioId: payload.usuarioId,
      entidadeId: payload.frequenciaId,
      entidadeTipo: 'CURSO_FREQUENCIA',
      descricao: payload.descricao,
      dadosAnteriores: payload.dadosAnteriores,
      dadosNovos: payload.dadosNovos,
      metadata: payload.metadata,
      ip: payload.ip ?? null,
      userAgent: payload.userAgent ?? null,
    },
  });
};

export const frequenciaService = {
  async listGeral(
    filters: {
      cursoId?: string;
      turmaIds?: string[];
      alunoId?: string;
      inscricaoId?: string;
      tipoOrigem?: TipoOrigemFrequencia;
      origemId?: string;
      status?: CursosFrequenciaStatus | 'PENDENTE';
      search?: string;
      page?: number;
      pageSize?: number;
      orderBy?: 'atualizadoEm' | 'status' | 'tipoOrigem';
      order?: 'asc' | 'desc';
      dataInicio?: Date;
      dataFim?: Date;
    } = {},
    viewer?: {
      userId?: string;
      role?: string;
    },
  ) {
    const normalizedSearch = filters.search?.trim();
    const shouldSearchAlunoProfile = !!normalizedSearch && !filters.alunoId;

    const turmaIdsFiltro = filters.turmaIds?.filter(Boolean);

    if (filters.cursoId && turmaIdsFiltro?.length) {
      const uniqueTurmaIds = Array.from(new Set(turmaIdsFiltro));
      const validCount = await prisma.cursosTurmas.count({
        where: {
          cursoId: filters.cursoId,
          id: { in: uniqueTurmaIds },
        },
      });
      if (validCount !== uniqueTurmaIds.length) {
        const error = new Error('Uma ou mais turmas são inválidas para o curso informado');
        (error as any).code = 'INVALID_TURMA_FILTER';
        throw error;
      }
    }

    if (viewer?.role === 'INSTRUTOR' && !viewer.userId) {
      return {
        items: [],
        pagination: {
          page: 1,
          requestedPage: filters.page ?? 1,
          pageSize: Math.max(1, Math.min(200, filters.pageSize ?? 10)),
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
          isPageAdjusted: false,
        },
      };
    }

    const turmaScopeWhere: Prisma.CursosTurmasWhereInput = {
      ...(filters.cursoId ? { cursoId: filters.cursoId } : {}),
      ...(turmaIdsFiltro?.length ? { id: { in: turmaIdsFiltro } } : {}),
      ...(viewer?.role === 'INSTRUTOR'
        ? {
            OR: [
              { instrutorId: viewer.userId },
              { CursosTurmasInstrutores: { some: { instrutorId: viewer.userId } } },
            ],
          }
        : {}),
    };

    const turmasEscopo = await prisma.cursosTurmas.findMany({
      where: turmaScopeWhere,
      select: {
        id: true,
        nome: true,
        codigo: true,
        cursoId: true,
        Cursos: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    const turmaIdsEscopo = turmasEscopo.map((item) => item.id);
    if (turmaIdsEscopo.length === 0) {
      return {
        items: [],
        pagination: {
          page: 1,
          requestedPage: filters.page ?? 1,
          pageSize: Math.max(1, Math.min(200, filters.pageSize ?? 10)),
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
          isPageAdjusted: false,
        },
      };
    }

    const makeKey = (
      turmaId: string,
      inscricaoId: string,
      tipoOrigem: TipoOrigemFrequencia,
      origemId: string,
    ) => `${turmaId}:${inscricaoId}:${tipoOrigem}:${origemId}`;

    const inscricaoWhere: Prisma.CursosTurmasInscricoesWhereInput = {
      ...(filters.alunoId ? { alunoId: filters.alunoId } : {}),
      ...(shouldSearchAlunoProfile
        ? {
            Usuarios: {
              OR: [
                { nomeCompleto: { contains: normalizedSearch, mode: 'insensitive' as const } },
                { email: { contains: normalizedSearch, mode: 'insensitive' as const } },
                { cpf: { contains: normalizedSearch } },
                { codUsuario: { contains: normalizedSearch } },
                { UsuariosInformation: { inscricao: { contains: normalizedSearch } } },
              ],
            },
          }
        : {}),
    };

    const existingWhere: Prisma.CursosFrequenciaAlunosWhereInput = {
      turmaId: { in: turmaIdsEscopo },
      inscricaoId: filters.inscricaoId ?? undefined,
      status: toCursosFrequenciaStatusOrUndefined(filters.status as string | undefined),
      ...(Object.keys(inscricaoWhere).length > 0 ? { CursosTurmasInscricoes: inscricaoWhere } : {}),
    };

    if (filters.dataInicio || filters.dataFim) {
      existingWhere.dataReferencia = {
        gte: filters.dataInicio ?? undefined,
        lte: filters.dataFim ?? undefined,
      };
    }

    const frequenciasExistentes = await prisma.cursosFrequenciaAlunos.findMany({
      where: existingWhere,
      orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }],
      include: frequenciaWithRelations.include,
    });

    const frequenciasEnriquecidas = await enrichFrequenciasBatch(
      prisma,
      frequenciasExistentes as FrequenciaWithRelations[],
    );

    const existingKeys = new Set<string>();
    for (const frequencia of frequenciasExistentes) {
      if (frequencia.aulaId) {
        existingKeys.add(
          makeKey(frequencia.turmaId, frequencia.inscricaoId, 'AULA', frequencia.aulaId),
        );
        continue;
      }
      const { meta } = decodeFrequenciaMeta(frequencia.observacoes);
      if (meta?.tipoOrigem && meta?.origemId) {
        existingKeys.add(
          makeKey(frequencia.turmaId, frequencia.inscricaoId, meta.tipoOrigem, meta.origemId),
        );
      }
    }

    const shouldBuildPendentes = !filters.status || filters.status === 'PENDENTE';
    const pendentes: any[] = [];

    if (shouldBuildPendentes) {
      const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
        where: {
          turmaId: { in: turmaIdsEscopo },
          ...(filters.alunoId ? { alunoId: filters.alunoId } : {}),
          ...(filters.inscricaoId ? { id: filters.inscricaoId } : {}),
          status: { in: ['INSCRITO', 'EM_ANDAMENTO', 'EM_ESTAGIO'] },
          ...(shouldSearchAlunoProfile
            ? {
                Usuarios: {
                  OR: [
                    { nomeCompleto: { contains: normalizedSearch, mode: 'insensitive' as const } },
                    { email: { contains: normalizedSearch, mode: 'insensitive' as const } },
                    { cpf: { contains: normalizedSearch } },
                    { codUsuario: { contains: normalizedSearch } },
                    { UsuariosInformation: { inscricao: { contains: normalizedSearch } } },
                  ],
                },
              }
            : {}),
        },
        select: {
          id: true,
          turmaId: true,
          alunoId: true,
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
              codUsuario: true,
              UsuariosInformation: {
                select: {
                  avatarUrl: true,
                  inscricao: true,
                },
              },
            },
          },
        },
      });

      if (inscricoes.length > 0) {
        const now = new Date();
        const shouldIncludeByDate = (refDate: Date | null | undefined) => {
          if (!refDate) return true;
          return refDate.getTime() <= now.getTime();
        };

        const aulas =
          !filters.tipoOrigem || filters.tipoOrigem === 'AULA'
            ? await prisma.cursosTurmasAulas.findMany({
                where: {
                  turmaId: { in: turmaIdsEscopo },
                  deletedAt: null,
                  status: { in: ['PUBLICADA', 'RASCUNHO'] },
                  ...(filters.origemId ? { id: filters.origemId } : {}),
                },
                select: {
                  id: true,
                  turmaId: true,
                  nome: true,
                  ordem: true,
                  moduloId: true,
                  dataInicio: true,
                  criadoEm: true,
                },
              })
            : [];

        const avaliacoes =
          !filters.tipoOrigem ||
          filters.tipoOrigem === 'PROVA' ||
          filters.tipoOrigem === 'ATIVIDADE'
            ? await prisma.cursosTurmasProvas.findMany({
                where: {
                  turmaId: { in: turmaIdsEscopo },
                  ativo: true,
                  status: { in: ['PUBLICADA', 'RASCUNHO'] },
                  ...(filters.origemId ? { id: filters.origemId } : {}),
                  ...(filters.tipoOrigem
                    ? { tipo: filters.tipoOrigem === 'PROVA' ? 'PROVA' : 'ATIVIDADE' }
                    : {}),
                },
                select: {
                  id: true,
                  turmaId: true,
                  tipo: true,
                  titulo: true,
                  dataInicio: true,
                  criadoEm: true,
                },
              })
            : [];

        type OrigemPendente = {
          tipoOrigem: TipoOrigemFrequencia;
          origemId: string;
          turmaId: string;
          origemTitulo: string | null;
          dataReferencia: Date;
          aula: {
            id: string;
            nome: string;
            ordem: number;
            moduloId: string | null;
            modulo: null;
          } | null;
        };

        const origemByTurma = new Map<string, OrigemPendente[]>();
        const addOrigem = (origem: OrigemPendente) => {
          const arr = origemByTurma.get(origem.turmaId) ?? [];
          arr.push(origem);
          origemByTurma.set(origem.turmaId, arr);
        };

        for (const aula of aulas) {
          const referencia = aula.dataInicio ?? aula.criadoEm;
          if (!shouldIncludeByDate(referencia)) continue;
          if (
            (filters.dataInicio && referencia.getTime() < filters.dataInicio.getTime()) ||
            (filters.dataFim && referencia.getTime() > filters.dataFim.getTime())
          ) {
            continue;
          }
          addOrigem({
            tipoOrigem: 'AULA',
            origemId: aula.id,
            turmaId: aula.turmaId ?? '',
            origemTitulo: aula.nome,
            dataReferencia: referencia,
            aula: {
              id: aula.id,
              nome: aula.nome,
              ordem: aula.ordem ?? 0,
              moduloId: aula.moduloId,
              modulo: null,
            },
          });
        }

        for (const avaliacao of avaliacoes) {
          const referencia = avaliacao.dataInicio ?? avaliacao.criadoEm;
          if (!shouldIncludeByDate(referencia)) continue;
          if (
            (filters.dataInicio && referencia.getTime() < filters.dataInicio.getTime()) ||
            (filters.dataFim && referencia.getTime() > filters.dataFim.getTime())
          ) {
            continue;
          }
          addOrigem({
            tipoOrigem: avaliacao.tipo === 'PROVA' ? 'PROVA' : 'ATIVIDADE',
            origemId: avaliacao.id,
            turmaId: avaliacao.turmaId ?? '',
            origemTitulo: avaliacao.titulo,
            dataReferencia: referencia,
            aula: null,
          });
        }

        const inscricaoIds = inscricoes.map((item) => item.id);
        const aulaIds = aulas.map((item) => item.id);
        const avaliacaoIds = avaliacoes.map((item) => item.id);

        const progressoRows =
          aulaIds.length > 0
            ? await prisma.cursosAulasProgresso.findMany({
                where: {
                  inscricaoId: { in: inscricaoIds },
                  aulaId: { in: aulaIds },
                },
                select: {
                  inscricaoId: true,
                  aulaId: true,
                  iniciadoEm: true,
                  atualizadoEm: true,
                  tempoAssistidoSegundos: true,
                },
              })
            : [];

        const envioRows =
          avaliacaoIds.length > 0
            ? await prisma.cursosTurmasProvasEnvios.findMany({
                where: {
                  inscricaoId: { in: inscricaoIds },
                  provaId: { in: avaliacaoIds },
                },
                select: {
                  inscricaoId: true,
                  provaId: true,
                  realizadoEm: true,
                  criadoEm: true,
                  atualizadoEm: true,
                },
              })
            : [];

        const progressoMap = new Map<
          string,
          {
            iniciadoEm: Date | null;
            atualizadoEm: Date;
            tempoAssistidoSegundos: number;
          }
        >();
        for (const row of progressoRows) {
          progressoMap.set(`${row.inscricaoId}:${row.aulaId}`, {
            iniciadoEm: row.iniciadoEm,
            atualizadoEm: row.atualizadoEm,
            tempoAssistidoSegundos: row.tempoAssistidoSegundos ?? 0,
          });
        }

        const envioMap = new Map<
          string,
          {
            realizadoEm: Date | null;
            criadoEm: Date;
            atualizadoEm: Date;
          }
        >();
        for (const row of envioRows) {
          envioMap.set(`${row.inscricaoId}:${row.provaId}`, {
            realizadoEm: row.realizadoEm,
            criadoEm: row.criadoEm,
            atualizadoEm: row.atualizadoEm,
          });
        }

        const turmaMap = new Map(
          turmasEscopo.map((item) => [
            item.id,
            {
              cursoId: item.cursoId,
              cursoNome: item.Cursos?.nome ?? null,
              turmaNome: item.nome ?? null,
              turmaCodigo: item.codigo ?? null,
            },
          ]),
        );

        for (const inscricao of inscricoes) {
          const origens = origemByTurma.get(inscricao.turmaId) ?? [];
          for (const origem of origens) {
            const key = makeKey(
              inscricao.turmaId,
              inscricao.id,
              origem.tipoOrigem,
              origem.origemId,
            );
            if (existingKeys.has(key)) continue;

            let evidencia: {
              acessou: boolean;
              primeiroAcessoEm: string | null;
              ultimoAcessoEm: string | null;
              minutosEngajados: number;
              respondeu: boolean;
              statusSugerido: 'PRESENTE' | 'PENDENTE';
            };

            if (origem.tipoOrigem === 'AULA') {
              const progresso = progressoMap.get(`${inscricao.id}:${origem.origemId}`);
              const minutosEngajados = progresso
                ? Math.floor((progresso.tempoAssistidoSegundos || 0) / 60)
                : 0;
              evidencia = {
                acessou: !!progresso && (!!progresso.iniciadoEm || minutosEngajados > 0),
                primeiroAcessoEm: toIsoStringOrNull(progresso?.iniciadoEm),
                ultimoAcessoEm: toIsoStringOrNull(progresso?.atualizadoEm),
                minutosEngajados,
                respondeu: false,
                statusSugerido: minutosEngajados >= MINIMO_MINUTOS_PADRAO ? 'PRESENTE' : 'PENDENTE',
              };
            } else {
              const envio = envioMap.get(`${inscricao.id}:${origem.origemId}`);
              const primeiroAcesso = envio?.criadoEm ?? envio?.realizadoEm ?? null;
              const ultimoAcesso =
                envio?.atualizadoEm ?? envio?.realizadoEm ?? envio?.criadoEm ?? null;
              const minutosEngajados =
                primeiroAcesso && ultimoAcesso
                  ? Math.max(
                      0,
                      Math.round((ultimoAcesso.getTime() - primeiroAcesso.getTime()) / 60000),
                    )
                  : 0;
              const respondeu = !!envio;
              evidencia = {
                acessou: respondeu || !!primeiroAcesso,
                primeiroAcessoEm: toIsoStringOrNull(primeiroAcesso),
                ultimoAcessoEm: toIsoStringOrNull(ultimoAcesso),
                minutosEngajados,
                respondeu,
                statusSugerido:
                  respondeu || minutosEngajados >= MINIMO_MINUTOS_PADRAO ? 'PRESENTE' : 'PENDENTE',
              };
            }

            const aluno = inscricao.Usuarios;
            const referenciaIso = origem.dataReferencia.toISOString();
            const turmaData = turmaMap.get(inscricao.turmaId);
            pendentes.push({
              id: null,
              syntheticId: `pendente:${key}`,
              isPersisted: false,
              cursoId: turmaData?.cursoId ?? null,
              cursoNome: turmaData?.cursoNome ?? null,
              turmaId: inscricao.turmaId,
              turmaNome: turmaData?.turmaNome ?? null,
              turmaCodigo: turmaData?.turmaCodigo ?? null,
              inscricaoId: inscricao.id,
              aulaId: origem.tipoOrigem === 'AULA' ? origem.origemId : null,
              dataReferencia: referenciaIso,
              status: 'PENDENTE',
              justificativa: null,
              observacoes: null,
              criadoEm: referenciaIso,
              atualizadoEm: referenciaIso,
              curso: turmaData?.cursoId
                ? {
                    id: turmaData.cursoId,
                    nome: turmaData.cursoNome,
                  }
                : null,
              turma: {
                id: inscricao.turmaId,
                nome: turmaData?.turmaNome ?? null,
                codigo: turmaData?.turmaCodigo ?? null,
              },
              aula: origem.aula,
              inscricao: {
                id: inscricao.id,
                alunoId: inscricao.alunoId,
                aluno: aluno
                  ? {
                      id: aluno.id,
                      nome: aluno.nomeCompleto,
                      nomeCompleto: aluno.nomeCompleto,
                      email: aluno.email,
                      cpf: aluno.cpf ?? null,
                      codigo: aluno.codUsuario,
                      avatarUrl: aluno.UsuariosInformation?.avatarUrl ?? null,
                    }
                  : null,
              },
              aluno: aluno
                ? {
                    id: aluno.id,
                    nome: aluno.nomeCompleto,
                    nomeCompleto: aluno.nomeCompleto,
                    email: aluno.email,
                    cpf: aluno.cpf ?? null,
                    codigo: aluno.codUsuario,
                    avatarUrl: aluno.UsuariosInformation?.avatarUrl ?? null,
                  }
                : null,
              tipoOrigem: origem.tipoOrigem,
              origemId: origem.origemId,
              origemTitulo: origem.origemTitulo,
              modoLancamento: 'AUTOMATICO',
              minutosPresenca: evidencia.minutosEngajados,
              minimoMinutosParaPresenca: MINIMO_MINUTOS_PADRAO,
              evidencia,
              lancadoPor: null,
              lancadoEm: null,
              alunoId: inscricao.alunoId,
              alunoNome: aluno?.nomeCompleto ?? null,
              naturalKey: {
                inscricaoId: inscricao.id,
                tipoOrigem: origem.tipoOrigem,
                origemId: origem.origemId,
              },
            });
          }
        }
      }
    }

    const searchInAlunoContext = (item: any, rawSearch: string) => {
      const needle = rawSearch.toLocaleLowerCase('pt-BR');
      const haystack = [
        item.cursoNome,
        item.turmaNome,
        item.turmaCodigo,
        item.origemTitulo,
        item.aula?.nome,
        item.tipoOrigem,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return haystack.includes(needle);
    };

    const combinadas = [...frequenciasEnriquecidas, ...pendentes].filter((item) => {
      if (filters.alunoId && normalizedSearch && !searchInAlunoContext(item, normalizedSearch)) {
        return false;
      }
      if (filters.tipoOrigem && item.tipoOrigem !== filters.tipoOrigem) return false;
      if (filters.origemId && item.origemId !== filters.origemId) return false;
      if (filters.status) {
        if (filters.status === 'PENDENTE') return item.status === 'PENDENTE';
        return item.status === filters.status;
      }
      return true;
    });

    const parseDateValue = (value: string | null | undefined) =>
      value ? new Date(value).getTime() : 0;

    const orderDirection = filters.order === 'asc' ? 1 : -1;
    const baseDateSorter = (a: any, b: any) => {
      const da = parseDateValue(a.dataReferencia ?? a.atualizadoEm ?? a.criadoEm);
      const db = parseDateValue(b.dataReferencia ?? b.atualizadoEm ?? b.criadoEm);
      if (db !== da) return db - da;
      const aa = parseDateValue(a.atualizadoEm ?? a.criadoEm);
      const bb = parseDateValue(b.atualizadoEm ?? b.criadoEm);
      return bb - aa;
    };

    if (filters.orderBy) {
      combinadas.sort((a, b) => {
        let compare = 0;
        if (filters.orderBy === 'atualizadoEm') {
          compare = parseDateValue(a.atualizadoEm) - parseDateValue(b.atualizadoEm);
        } else if (filters.orderBy === 'status') {
          compare = String(a.status ?? '').localeCompare(String(b.status ?? ''), 'pt-BR');
        } else if (filters.orderBy === 'tipoOrigem') {
          compare = String(a.tipoOrigem ?? '').localeCompare(String(b.tipoOrigem ?? ''), 'pt-BR');
        }

        if (compare === 0) {
          return baseDateSorter(a, b);
        }
        return compare * orderDirection;
      });
    } else {
      combinadas.sort(baseDateSorter);
    }

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? 10));
    const total = combinadas.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      items: combinadas.slice(start, start + pageSize),
      pagination: {
        page: safePage,
        requestedPage: page,
        pageSize,
        total,
        totalPages: totalPages || 1,
        hasNext: totalPages > 0 && safePage < totalPages,
        hasPrevious: safePage > 1,
        isPageAdjusted: safePage !== page,
      },
    };
  },

  async list(
    cursoId: string,
    turmaId: string,
    filters: {
      inscricaoId?: string;
      tipoOrigem?: TipoOrigemFrequencia;
      origemId?: string;
      status?: CursosFrequenciaStatus | 'PENDENTE';
      search?: string;
      page?: number;
      pageSize?: number;
      dataInicio?: Date;
      dataFim?: Date;
    } = {},
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    if (filters.inscricaoId) {
      await ensureInscricaoBelongsToTurma(prisma, turmaId, filters.inscricaoId);
    }

    const where: Prisma.CursosFrequenciaAlunosWhereInput = {
      turmaId,
      CursosTurmas: { cursoId },
      inscricaoId: filters.inscricaoId ?? undefined,
      status: toCursosFrequenciaStatusOrUndefined(filters.status as string | undefined),
      ...(filters.search
        ? {
            CursosTurmasInscricoes: {
              Usuarios: {
                OR: [
                  { nomeCompleto: { contains: filters.search, mode: 'insensitive' as const } },
                  { email: { contains: filters.search, mode: 'insensitive' as const } },
                  { cpf: { contains: filters.search } },
                  { codUsuario: { contains: filters.search } },
                  { UsuariosInformation: { inscricao: { contains: filters.search } } },
                ],
              },
            },
          }
        : {}),
    };

    if (filters.dataInicio || filters.dataFim) {
      where.dataReferencia = {
        gte: filters.dataInicio ?? undefined,
        lte: filters.dataFim ?? undefined,
      };
    }

    const frequencias = await prisma.cursosFrequenciaAlunos.findMany({
      where,
      orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }],
      include: frequenciaWithRelations.include,
    });

    const enriched = await enrichFrequenciasBatch(prisma, frequencias as FrequenciaWithRelations[]);
    const filtradas = enriched.filter((item) => {
      if (filters.tipoOrigem && item.tipoOrigem !== filters.tipoOrigem) return false;
      if (filters.origemId && item.origemId !== filters.origemId) return false;
      if (filters.status === 'PENDENTE') return item.evidencia?.statusSugerido === 'PENDENTE';
      return true;
    });

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? 10));
    const total = filtradas.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      items: filtradas.slice(start, start + pageSize),
      pagination: {
        page: safePage,
        requestedPage: page,
        pageSize,
        total,
        totalPages: totalPages || 1,
        hasNext: totalPages > 0 && safePage < totalPages,
        hasPrevious: safePage > 1,
        isPageAdjusted: safePage !== page,
      },
    };
  },

  async get(cursoId: string, turmaId: string, frequenciaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const frequencia = await prisma.cursosFrequenciaAlunos.findFirst({
      where: { id: frequenciaId, turmaId, CursosTurmas: { cursoId } },
      include: frequenciaWithRelations.include,
    });

    if (!frequencia) {
      const error = new Error('Registro de frequência não encontrado para a turma informada');
      (error as any).code = 'FREQUENCIA_NOT_FOUND';
      throw error;
    }

    return enrichFrequencia(prisma, frequencia as FrequenciaWithRelations);
  },

  async create(
    cursoId: string,
    turmaId: string,
    data: {
      inscricaoId: string;
      aulaId?: string | null;
      tipoOrigem?: TipoOrigemFrequencia;
      origemId?: string;
      origemTitulo?: string;
      dataReferencia?: Date;
      status: CursosFrequenciaStatus;
      modoLancamento?: ModoLancamentoFrequencia;
      minutosPresenca?: number;
      minimoMinutosParaPresenca?: number;
      justificativa?: string | null;
      observacoes?: string | null;
    },
    context?: {
      lancadoPorId?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);
      await ensureInscricaoBelongsToTurma(tx, turmaId, data.inscricaoId);
      const origem = await resolveOrigemData(tx, turmaId, {
        aulaId: data.aulaId,
        tipoOrigem: data.tipoOrigem,
        origemId: data.origemId,
        origemTitulo: data.origemTitulo,
      });

      const duplicate = await findDuplicateByOrigem(tx, turmaId, data.inscricaoId, {
        tipoOrigem: origem.tipoOrigem,
        origemId: origem.origemId,
      });
      if (duplicate) {
        const duplicated = new Error('Já existe uma frequência registrada para esta combinação');
        (duplicated as any).code = 'FREQUENCIA_JA_LANCADA';
        throw duplicated;
      }

      ensureJustificativaWhenRequired(data.status, data.justificativa);

      const meta: FrequenciaMeta = {
        tipoOrigem: origem.tipoOrigem,
        origemId: origem.origemId,
        origemTitulo: origem.origemTitulo ?? null,
        modoLancamento: data.modoLancamento ?? 'MANUAL',
        minutosPresenca: data.minutosPresenca ?? null,
        minimoMinutosParaPresenca: data.minimoMinutosParaPresenca ?? MINIMO_MINUTOS_PADRAO,
        lancadoPorId: context?.lancadoPorId ?? null,
        lancadoEm: new Date().toISOString(),
      };

      try {
        const frequencia = (await tx.cursosFrequenciaAlunos.create({
          data: {
            turmaId,
            inscricaoId: data.inscricaoId,
            aulaId: origem.aulaId,
            dataReferencia: data.dataReferencia ?? new Date(),
            status: data.status,
            justificativa: normalizeNullable(data.justificativa),
            observacoes: serializeFrequenciaMeta(data.observacoes, meta),
          },
          include: frequenciaWithRelations.include,
        })) as FrequenciaWithRelations;

        await writeFrequenciaAudit(tx, {
          frequenciaId: frequencia.id,
          usuarioId: context?.lancadoPorId,
          acao: 'FREQUENCIA_CRIADA',
          descricao: `Frequência lançada para ${origem.tipoOrigem}`,
          dadosNovos: {
            statusNovo: frequencia.status,
            justificativaNova: frequencia.justificativa,
            modoLancamento: meta.modoLancamento,
            origemTipo: origem.tipoOrigem,
            origemId: origem.origemId,
            origemTitulo: origem.origemTitulo,
          },
          metadata: {
            lancadoPorId: context?.lancadoPorId ?? null,
            ip: context?.ip ?? null,
            userAgent: context?.userAgent ?? null,
          },
          ip: context?.ip,
          userAgent: context?.userAgent,
        });

        frequenciasLogger.info(
          { turmaId, frequenciaId: frequencia.id },
          'Frequência registrada para inscrição',
        );

        return enrichFrequencia(tx, frequencia);
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const duplicated = new Error('Já existe uma frequência registrada para esta combinação');
          (duplicated as any).code = 'FREQUENCIA_JA_LANCADA';
          throw duplicated;
        }

        throw error;
      }
    });
  },

  async upsertLancamento(
    cursoId: string,
    turmaId: string,
    data: {
      inscricaoId: string;
      tipoOrigem: TipoOrigemFrequencia;
      origemId: string;
      origemTitulo?: string | null;
      status: CursosFrequenciaStatus;
      modoLancamento?: ModoLancamentoFrequencia;
      minutosPresenca?: number;
      minimoMinutosParaPresenca?: number;
      justificativa?: string | null;
      observacoes?: string | null;
    },
    context?: {
      lancadoPorId?: string;
      ip?: string;
      userAgent?: string;
    },
    options?: {
      skipBaseValidation?: boolean;
    },
  ) {
    if (!options?.skipBaseValidation) {
      await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);
      await ensureInscricaoBelongsToTurma(prisma, turmaId, data.inscricaoId);
    }

    const origem = await resolveOrigemData(prisma, turmaId, {
      tipoOrigem: data.tipoOrigem,
      origemId: data.origemId,
      origemTitulo: data.origemTitulo ?? null,
    });

    const existente = await findDuplicateByOrigem(prisma, turmaId, data.inscricaoId, {
      tipoOrigem: origem.tipoOrigem,
      origemId: origem.origemId,
    });

    if (existente?.id) {
      return this.update(
        cursoId,
        turmaId,
        existente.id,
        {
          status: data.status,
          justificativa: data.justificativa ?? null,
          observacoes: data.observacoes ?? null,
          tipoOrigem: origem.tipoOrigem,
          origemId: origem.origemId,
          origemTitulo: origem.origemTitulo ?? null,
          modoLancamento: data.modoLancamento ?? 'MANUAL',
          minutosPresenca: data.minutosPresenca,
          minimoMinutosParaPresenca: data.minimoMinutosParaPresenca,
        },
        context,
      );
    }

    return this.create(
      cursoId,
      turmaId,
      {
        inscricaoId: data.inscricaoId,
        tipoOrigem: origem.tipoOrigem,
        origemId: origem.origemId,
        origemTitulo: origem.origemTitulo ?? undefined,
        status: data.status,
        modoLancamento: data.modoLancamento ?? 'MANUAL',
        minutosPresenca: data.minutosPresenca,
        minimoMinutosParaPresenca: data.minimoMinutosParaPresenca,
        justificativa: data.justificativa ?? null,
        observacoes: data.observacoes ?? null,
      },
      context,
    );
  },

  async upsertLancamentoByAluno(
    alunoId: string,
    data: {
      cursoId: string;
      turmaId: string;
      inscricaoId: string;
      tipoOrigem: TipoOrigemFrequencia;
      origemId: string;
      origemTitulo?: string | null;
      status: CursosFrequenciaStatus;
      modoLancamento?: ModoLancamentoFrequencia;
      minutosPresenca?: number;
      minimoMinutosParaPresenca?: number;
      justificativa?: string | null;
      observacoes?: string | null;
    },
    context?: {
      lancadoPorId?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    await ensureTurmaBelongsToCurso(prisma, data.cursoId, data.turmaId);
    await ensureInscricaoBelongsToAluno(prisma, alunoId, data.turmaId, data.inscricaoId);

    return this.upsertLancamento(
      data.cursoId,
      data.turmaId,
      {
        inscricaoId: data.inscricaoId,
        tipoOrigem: data.tipoOrigem,
        origemId: data.origemId,
        origemTitulo: data.origemTitulo ?? null,
        status: data.status,
        modoLancamento: data.modoLancamento,
        minutosPresenca: data.minutosPresenca,
        minimoMinutosParaPresenca: data.minimoMinutosParaPresenca,
        justificativa: data.justificativa ?? null,
        observacoes: data.observacoes ?? null,
      },
      context,
      { skipBaseValidation: true },
    );
  },

  async listHistoricoByFrequencia(cursoId: string, turmaId: string, frequenciaId: string) {
    await ensureFrequenciaBelongsToTurma(prisma, cursoId, turmaId, frequenciaId);

    const logs = await prisma.auditoriaLogs.findMany({
      where: {
        entidadeTipo: 'CURSO_FREQUENCIA',
        entidadeId: frequenciaId,
        tipo: 'CURSO_FREQUENCIA',
      },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        criadoEm: true,
        dadosAnteriores: true,
        dadosNovos: true,
        metadata: true,
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            role: true,
          },
        },
      },
    });

    return logs.map(mapHistoricoFromAudit);
  },

  async listHistoricoByFrequenciaForAluno(alunoId: string, frequenciaId: string) {
    const frequencia = await prisma.cursosFrequenciaAlunos.findFirst({
      where: {
        id: frequenciaId,
        CursosTurmasInscricoes: {
          alunoId,
        },
      },
      select: {
        id: true,
        turmaId: true,
        CursosTurmas: {
          select: {
            cursoId: true,
          },
        },
      },
    });

    if (!frequencia?.CursosTurmas?.cursoId) {
      const error = new Error('Registro de frequência não encontrado para o aluno informado');
      (error as any).code = 'FREQUENCIA_NOT_FOUND';
      throw error;
    }

    return this.listHistoricoByFrequencia(
      frequencia.CursosTurmas.cursoId,
      frequencia.turmaId,
      frequencia.id,
    );
  },

  async listHistoricoByNaturalKey(
    cursoId: string,
    turmaId: string,
    naturalKey: {
      inscricaoId: string;
      tipoOrigem: TipoOrigemFrequencia;
      origemId: string;
    },
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);
    await ensureInscricaoBelongsToTurma(prisma, turmaId, naturalKey.inscricaoId);

    const origem = await resolveOrigemData(prisma, turmaId, {
      tipoOrigem: naturalKey.tipoOrigem,
      origemId: naturalKey.origemId,
    });

    const frequencia = await findDuplicateByOrigem(prisma, turmaId, naturalKey.inscricaoId, {
      tipoOrigem: origem.tipoOrigem,
      origemId: origem.origemId,
    });

    if (!frequencia?.id) {
      return [];
    }

    return this.listHistoricoByFrequencia(cursoId, turmaId, frequencia.id);
  },

  async listHistoricoByNaturalKeyForAluno(
    alunoId: string,
    params: {
      cursoId: string;
      turmaId: string;
      inscricaoId: string;
      tipoOrigem: TipoOrigemFrequencia;
      origemId: string;
    },
  ) {
    await ensureTurmaBelongsToCurso(prisma, params.cursoId, params.turmaId);
    await ensureInscricaoBelongsToAluno(prisma, alunoId, params.turmaId, params.inscricaoId);

    return this.listHistoricoByNaturalKey(params.cursoId, params.turmaId, {
      inscricaoId: params.inscricaoId,
      tipoOrigem: params.tipoOrigem,
      origemId: params.origemId,
    });
  },

  async update(
    cursoId: string,
    turmaId: string,
    frequenciaId: string,
    data: {
      aulaId?: string | null;
      tipoOrigem?: TipoOrigemFrequencia;
      origemId?: string | null;
      origemTitulo?: string | null;
      dataReferencia?: Date | null;
      status?: CursosFrequenciaStatus;
      modoLancamento?: ModoLancamentoFrequencia;
      minutosPresenca?: number;
      minimoMinutosParaPresenca?: number;
      justificativa?: string | null;
      observacoes?: string | null;
    },
    context?: {
      lancadoPorId?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const frequenciaAtual = await ensureFrequenciaBelongsToTurma(
        tx,
        cursoId,
        turmaId,
        frequenciaId,
      );

      const atualCompleta = (await tx.cursosFrequenciaAlunos.findFirst({
        where: { id: frequenciaId, turmaId, CursosTurmas: { cursoId } },
        include: frequenciaWithRelations.include,
      })) as FrequenciaWithRelations | null;
      if (!atualCompleta) {
        const error = new Error('Registro de frequência não encontrado para a turma informada');
        (error as any).code = 'FREQUENCIA_NOT_FOUND';
        throw error;
      }

      const metaAtual = decodeFrequenciaMeta(atualCompleta.observacoes).meta;
      const originFieldsChanged =
        data.aulaId !== undefined ||
        data.tipoOrigem !== undefined ||
        data.origemId !== undefined ||
        data.origemTitulo !== undefined;

      let origemResolvida: {
        tipoOrigem: TipoOrigemFrequencia;
        origemId: string;
        origemTitulo: string | null;
        aulaId: string | null;
      };

      if (originFieldsChanged) {
        origemResolvida = await resolveOrigemData(tx, turmaId, {
          aulaId: data.aulaId !== undefined ? data.aulaId : (atualCompleta.aulaId ?? undefined),
          tipoOrigem: data.tipoOrigem ?? metaAtual?.tipoOrigem,
          origemId: data.origemId === undefined ? metaAtual?.origemId : data.origemId,
          origemTitulo:
            data.origemTitulo === undefined ? (metaAtual?.origemTitulo ?? null) : data.origemTitulo,
        });

        const duplicate = await findDuplicateByOrigem(
          tx,
          turmaId,
          frequenciaAtual.inscricaoId,
          { tipoOrigem: origemResolvida.tipoOrigem, origemId: origemResolvida.origemId },
          frequenciaId,
        );
        if (duplicate) {
          const duplicated = new Error('Já existe uma frequência registrada para esta combinação');
          (duplicated as any).code = 'FREQUENCIA_JA_LANCADA';
          throw duplicated;
        }
      } else {
        const tipoOrigemAtual = metaAtual?.tipoOrigem ?? (atualCompleta.aulaId ? 'AULA' : 'AULA');
        const origemIdAtual = metaAtual?.origemId ?? atualCompleta.aulaId ?? '';
        if (!origemIdAtual) {
          const error = new Error('origemId é obrigatório para atualizar a frequência');
          (error as any).code = 'VALIDATION_ERROR';
          throw error;
        }
        origemResolvida = {
          tipoOrigem: tipoOrigemAtual,
          origemId: origemIdAtual,
          origemTitulo: metaAtual?.origemTitulo ?? atualCompleta.CursosTurmasAulas?.nome ?? null,
          aulaId: tipoOrigemAtual === 'AULA' ? origemIdAtual : null,
        };
      }

      const statusFinal = data.status ?? frequenciaAtual.status;

      const justificativaFinal =
        data.justificativa !== undefined ? data.justificativa : frequenciaAtual.justificativa;

      ensureJustificativaWhenRequired(statusFinal, justificativaFinal);

      const metaNova: FrequenciaMeta = {
        tipoOrigem: origemResolvida.tipoOrigem,
        origemId: origemResolvida.origemId,
        origemTitulo: origemResolvida.origemTitulo ?? null,
        modoLancamento: data.modoLancamento ?? metaAtual?.modoLancamento ?? 'MANUAL',
        minutosPresenca:
          data.minutosPresenca !== undefined
            ? data.minutosPresenca
            : (metaAtual?.minutosPresenca ?? null),
        minimoMinutosParaPresenca:
          data.minimoMinutosParaPresenca !== undefined
            ? data.minimoMinutosParaPresenca
            : (metaAtual?.minimoMinutosParaPresenca ?? MINIMO_MINUTOS_PADRAO),
        lancadoPorId: metaAtual?.lancadoPorId ?? context?.lancadoPorId ?? null,
        lancadoEm: metaAtual?.lancadoEm ?? atualCompleta.criadoEm.toISOString(),
      };

      const frequencia = (await tx.cursosFrequenciaAlunos.update({
        where: { id: frequenciaId },
        data: {
          aulaId: origemResolvida.aulaId,
          dataReferencia: data.dataReferencia ?? undefined,
          status: data.status ?? undefined,
          justificativa: normalizeNullable(data.justificativa),
          observacoes: serializeFrequenciaMeta(data.observacoes, metaNova),
        },
        include: frequenciaWithRelations.include,
      })) as FrequenciaWithRelations;

      await writeFrequenciaAudit(tx, {
        frequenciaId,
        usuarioId: context?.lancadoPorId,
        acao: 'FREQUENCIA_ATUALIZADA',
        descricao: `Frequência atualizada para ${origemResolvida.tipoOrigem}`,
        dadosAnteriores: {
          statusAnterior: frequenciaAtual.status,
          justificativaAnterior: frequenciaAtual.justificativa,
        },
        dadosNovos: {
          statusNovo: frequencia.status,
          justificativaNova: frequencia.justificativa,
          modoLancamento: metaNova.modoLancamento,
          origemTipo: origemResolvida.tipoOrigem,
          origemId: origemResolvida.origemId,
          origemTitulo: origemResolvida.origemTitulo,
        },
        metadata: {
          statusAnterior: frequenciaAtual.status,
          statusNovo: frequencia.status,
          justificativaAnterior: frequenciaAtual.justificativa,
          justificativaNova: frequencia.justificativa,
          ip: context?.ip ?? null,
          userAgent: context?.userAgent ?? null,
        },
        ip: context?.ip,
        userAgent: context?.userAgent,
      });

      frequenciasLogger.info({ turmaId, frequenciaId }, 'Frequência atualizada');

      return enrichFrequencia(tx, frequencia);
    });
  },

  async remove(cursoId: string, turmaId: string, frequenciaId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureFrequenciaBelongsToTurma(tx, cursoId, turmaId, frequenciaId);

      await tx.cursosFrequenciaAlunos.delete({ where: { id: frequenciaId } });

      frequenciasLogger.info({ turmaId, frequenciaId }, 'Frequência removida');

      return { success: true } as const;
    });
  },

  async listByInscricao(
    inscricaoId: string,
    requesterId?: string,
    { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
  ) {
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: inscricaoId },
      include: {
        Usuarios: { select: { id: true, nomeCompleto: true, email: true } },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            Cursos: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!inscricao) {
      const error = new Error('Inscrição não encontrada');
      (error as any).code = 'INSCRICAO_NOT_FOUND';
      throw error;
    }

    if (requesterId && inscricao.alunoId !== requesterId && !permitirAdmin) {
      const error = new Error('Acesso negado');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const frequencias = await prisma.cursosFrequenciaAlunos.findMany({
      where: { inscricaoId },
      orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }],
      include: frequenciaWithRelations.include,
    });
    const frequenciasEnriquecidas = await Promise.all(
      frequencias.map((frequencia) =>
        enrichFrequencia(prisma, frequencia as FrequenciaWithRelations),
      ),
    );

    return {
      inscricao: {
        id: inscricao.id,
        aluno: {
          id: inscricao.Usuarios.id,
          nome: inscricao.Usuarios.nomeCompleto,
          email: inscricao.Usuarios.email,
        },
      },
      curso: {
        id: inscricao.CursosTurmas.Cursos.id,
        nome: inscricao.CursosTurmas.Cursos.nome,
      },
      turma: {
        id: inscricao.CursosTurmas.id,
        nome: inscricao.CursosTurmas.nome,
        codigo: inscricao.CursosTurmas.codigo,
      },
      frequencias: frequenciasEnriquecidas,
    };
  },

  /**
   * Retorna resumo de frequência por aluno para uma turma
   * Query params: periodo (TOTAL|DIA|SEMANA|MES), anchorDate (YYYY-MM-DD), search, page, pageSize
   */
  async resumo(
    cursoId: string,
    turmaId: string,
    filters: {
      periodo?: 'TOTAL' | 'DIA' | 'SEMANA' | 'MES';
      anchorDate?: Date;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const { periodo = 'TOTAL', anchorDate = new Date(), search, page = 1, pageSize = 10 } = filters;

    // Calcular intervalo de datas baseado no período
    let dataInicio: Date | undefined;
    let dataFim: Date | undefined;

    if (periodo !== 'TOTAL') {
      const anchor = new Date(anchorDate);
      anchor.setHours(0, 0, 0, 0);

      switch (periodo) {
        case 'DIA':
          dataInicio = new Date(anchor);
          dataFim = new Date(anchor);
          dataFim.setHours(23, 59, 59, 999);
          break;
        case 'SEMANA': {
          const dayOfWeek = anchor.getDay();
          dataInicio = new Date(anchor);
          dataInicio.setDate(anchor.getDate() - dayOfWeek);
          dataFim = new Date(dataInicio);
          dataFim.setDate(dataInicio.getDate() + 6);
          dataFim.setHours(23, 59, 59, 999);
          break;
        }
        case 'MES':
          dataInicio = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
          dataFim = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
          dataFim.setHours(23, 59, 59, 999);
          break;
      }
    }

    // Buscar total de aulas no período
    const totalAulasNoPeriodo = await prisma.cursosTurmasAulas.count({
      where: {
        turmaId,
        deletedAt: null,
        ...(dataInicio && dataFim
          ? {
              OR: [
                { dataInicio: { gte: dataInicio, lte: dataFim } },
                { dataFim: { gte: dataInicio, lte: dataFim } },
              ],
            }
          : {}),
      },
    });

    // Buscar inscrições da turma com filtro de busca
    const inscricoesWhere: Prisma.CursosTurmasInscricoesWhereInput = {
      turmaId,
      status: { in: ['INSCRITO', 'EM_ANDAMENTO', 'EM_ESTAGIO'] },
      ...(search
        ? {
            Usuarios: {
              OR: [
                { nomeCompleto: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [totalInscricoes, inscricoes] = await Promise.all([
      prisma.cursosTurmasInscricoes.count({ where: inscricoesWhere }),
      prisma.cursosTurmasInscricoes.findMany({
        where: inscricoesWhere,
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              UsuariosInformation: { select: { inscricao: true } },
            },
          },
        },
        orderBy: { Usuarios: { nomeCompleto: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Para cada inscrição, buscar contagens de frequência
    // Nota: O enum CursosFrequenciaStatus tem: PRESENTE, AUSENTE, JUSTIFICADO, ATRASADO
    const items = await Promise.all(
      inscricoes.map(async (inscricao) => {
        const frequenciaWhere: Prisma.CursosFrequenciaAlunosWhereInput = {
          inscricaoId: inscricao.id,
          turmaId,
          ...(dataInicio && dataFim ? { dataReferencia: { gte: dataInicio, lte: dataFim } } : {}),
        };

        const [presencas, ausencias, atrasados, justificadas] = await Promise.all([
          prisma.cursosFrequenciaAlunos.count({
            where: { ...frequenciaWhere, status: CursosFrequenciaStatus.PRESENTE },
          }),
          prisma.cursosFrequenciaAlunos.count({
            where: { ...frequenciaWhere, status: CursosFrequenciaStatus.AUSENTE },
          }),
          prisma.cursosFrequenciaAlunos.count({
            where: { ...frequenciaWhere, status: CursosFrequenciaStatus.ATRASADO },
          }),
          prisma.cursosFrequenciaAlunos.count({
            where: { ...frequenciaWhere, status: CursosFrequenciaStatus.JUSTIFICADO },
          }),
        ]);

        const totalAulas = presencas + ausencias + atrasados + justificadas;
        const taxaPresencaPct =
          totalAulas > 0 ? Math.round(((presencas + atrasados) / totalAulas) * 100) : 0;

        return {
          alunoId: inscricao.Usuarios.id,
          alunoNome: inscricao.Usuarios.nomeCompleto,
          alunoCodigo: inscricao.Usuarios.UsuariosInformation?.inscricao ?? null,
          totalAulas,
          presencas,
          ausencias,
          atrasados,
          justificadas,
          taxaPresencaPct,
        };
      }),
    );

    return {
      totalAulasNoPeriodo,
      items,
      pagination: {
        page,
        pageSize,
        total: totalInscricoes,
        totalPages: Math.ceil(totalInscricoes / pageSize),
      },
    };
  },
};
