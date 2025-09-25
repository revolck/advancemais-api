import type { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  curriculoSelect,
  mapCurriculo,
  mapUsuarioAdmin,
  type CurriculoRecord,
  type UsuarioAdminRecord,
  usuarioAdminSelect,
} from '@/modules/empresas/admin/services/admin-shared';

import type { AdminCandidatosListQuery } from '@/modules/empresas/admin/validators/admin-candidatos.schema';

const vagaResumoSelect = {
  id: true,
  codigo: true,
  slug: true,
  titulo: true,
  status: true,
  inseridaEm: true,
  atualizadoEm: true,
  inscricoesAte: true,
  modoAnonimo: true,
  modalidade: true,
  regimeDeTrabalho: true,
  paraPcd: true,
  senioridade: true,
  jornada: true,
  numeroVagas: true,
  descricao: true,
  requisitos: true,
  atividades: true,
  beneficios: true,
  observacoes: true,
  localizacao: true,
  salarioMin: true,
  salarioMax: true,
  salarioConfidencial: true,
  maxCandidaturasPorUsuario: true,
  areaInteresseId: true,
  subareaInteresseId: true,
  areaInteresse: {
    select: {
      id: true,
      categoria: true,
    },
  },
  subareaInteresse: {
    select: {
      id: true,
      nome: true,
      areaId: true,
    },
  },
  destaque: true,
  destaqueInfo: {
    select: {
      empresasPlanoId: true,
      ativo: true,
      ativadoEm: true,
      desativadoEm: true,
    },
  },
  empresa: { select: usuarioAdminSelect },
} satisfies Prisma.EmpresasVagasSelect;

const candidaturaSelect = {
  id: true,
  vagaId: true,
  candidatoId: true,
  curriculoId: true,
  empresaUsuarioId: true,
  status: true,
  origem: true,
  aplicadaEm: true,
  atualizadaEm: true,
  consentimentos: true,
  curriculo: { select: curriculoSelect },
  vaga: { select: vagaResumoSelect },
  empresa: { select: usuarioAdminSelect },
} satisfies Prisma.EmpresasCandidatosSelect;

const processoSelect = {
  id: true,
  vagaId: true,
  candidatoId: true,
  status: true,
  origem: true,
  observacoes: true,
  agendadoEm: true,
  criadoEm: true,
  atualizadoEm: true,
  vaga: { select: vagaResumoSelect },
} satisfies Prisma.EmpresasVagasProcessoSelect;

const candidatoSelect = {
  ...usuarioAdminSelect,
  curriculos: {
    orderBy: [
      { principal: 'desc' },
      { criadoEm: 'desc' },
    ],
    select: curriculoSelect,
  },
  candidaturasFeitas: {
    orderBy: { aplicadaEm: 'desc' },
    select: candidaturaSelect,
  },
  processosCandidatados: {
    orderBy: { criadoEm: 'desc' },
    select: processoSelect,
  },
  candidatoLogs: {
    orderBy: { criadoEm: 'desc' },
    select: {
      id: true,
      usuarioId: true,
      tipo: true,
      descricao: true,
      metadata: true,
      criadoEm: true,
    },
  },
} satisfies Prisma.UsuariosSelect;

type VagaResumoRecord = Prisma.EmpresasVagasGetPayload<{ select: typeof vagaResumoSelect }>;
type CandidaturaRecord = Prisma.EmpresasCandidatosGetPayload<{ select: typeof candidaturaSelect }>;
type ProcessoRecord = Prisma.EmpresasVagasProcessoGetPayload<{ select: typeof processoSelect }>;
type CandidatoRecord = Prisma.UsuariosGetPayload<{ select: typeof candidatoSelect }>;

const countByStatus = <T extends string>(items: { status: T }[]) =>
  items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

const mapVagaResumo = (vaga?: VagaResumoRecord | null) => {
  if (!vaga) {
    return null;
  }

  return {
    id: vaga.id,
    codigo: vaga.codigo,
    slug: vaga.slug,
    titulo: vaga.titulo,
    status: vaga.status,
    inseridaEm: vaga.inseridaEm,
    atualizadoEm: vaga.atualizadoEm,
    inscricoesAte: vaga.inscricoesAte ?? null,
    modoAnonimo: vaga.modoAnonimo,
    modalidade: vaga.modalidade,
    regimeDeTrabalho: vaga.regimeDeTrabalho,
    paraPcd: vaga.paraPcd,
    senioridade: vaga.senioridade,
    jornada: vaga.jornada,
    numeroVagas: vaga.numeroVagas,
    descricao: vaga.descricao ?? null,
    requisitos: vaga.requisitos,
    atividades: vaga.atividades,
    beneficios: vaga.beneficios,
    observacoes: vaga.observacoes ?? null,
    localizacao: vaga.localizacao ?? null,
    salarioMin: vaga.salarioMin ?? null,
    salarioMax: vaga.salarioMax ?? null,
    salarioConfidencial: vaga.salarioConfidencial,
    maxCandidaturasPorUsuario: vaga.maxCandidaturasPorUsuario ?? null,
    areaInteresseId: vaga.areaInteresseId ?? null,
    subareaInteresseId: vaga.subareaInteresseId ?? null,
    areaInteresse: vaga.areaInteresse
      ? {
          id: vaga.areaInteresse.id,
          categoria: vaga.areaInteresse.categoria,
        }
      : null,
    subareaInteresse: vaga.subareaInteresse
      ? {
          id: vaga.subareaInteresse.id,
          nome: vaga.subareaInteresse.nome,
          areaId: vaga.subareaInteresse.areaId,
        }
      : null,
    vagaEmDestaque: vaga.destaque,
    destaqueInfo: vaga.destaqueInfo
      ? {
          empresasPlanoId: vaga.destaqueInfo.empresasPlanoId,
          ativo: vaga.destaqueInfo.ativo,
          ativadoEm: vaga.destaqueInfo.ativadoEm,
          desativadoEm: vaga.destaqueInfo.desativadoEm ?? null,
        }
      : null,
    empresa: mapUsuarioAdmin(vaga.empresa ?? null),
  };
};

const mapCandidatura = (candidatura: CandidaturaRecord) => ({
  id: candidatura.id,
  vagaId: candidatura.vagaId,
  candidatoId: candidatura.candidatoId,
  curriculoId: candidatura.curriculoId ?? null,
  empresaUsuarioId: candidatura.empresaUsuarioId,
  status: candidatura.status,
  origem: candidatura.origem,
  aplicadaEm: candidatura.aplicadaEm,
  atualizadaEm: candidatura.atualizadaEm,
  consentimentos: candidatura.consentimentos ?? null,
  curriculo: mapCurriculo(candidatura.curriculo ?? null),
  vaga: mapVagaResumo(candidatura.vaga ?? null),
  empresa: mapUsuarioAdmin(candidatura.empresa ?? null),
});

const mapProcesso = (processo: ProcessoRecord) => ({
  id: processo.id,
  vagaId: processo.vagaId,
  candidatoId: processo.candidatoId,
  status: processo.status,
  origem: processo.origem,
  observacoes: processo.observacoes ?? null,
  agendadoEm: processo.agendadoEm ?? null,
  criadoEm: processo.criadoEm,
  atualizadoEm: processo.atualizadoEm,
  vaga: mapVagaResumo(processo.vaga ?? null),
});

const mapCandidato = (candidato: CandidatoRecord) => {
  const base = mapUsuarioAdmin(candidato as UsuarioAdminRecord);

  const curriculos = candidato.curriculos
    .map((curriculo) => mapCurriculo(curriculo as CurriculoRecord))
    .filter((curriculo): curriculo is ReturnType<typeof mapCurriculo> => Boolean(curriculo));

  const candidaturas = candidato.candidaturasFeitas.map(mapCandidatura);
  const processos = candidato.processosCandidatados.map(mapProcesso);

  return {
    ...base!,
    curriculos,
    curriculosResumo: {
      total: curriculos.length,
      principais: curriculos.filter((curriculo) => curriculo?.principal).length,
    },
    candidaturas,
    candidaturasResumo: {
      total: candidaturas.length,
      porStatus: countByStatus(candidaturas),
    },
    processos,
    processosResumo: {
      total: processos.length,
      porStatus: countByStatus(processos),
    },
    logs: candidato.candidatoLogs.map((log) => ({
      id: log.id,
      usuarioId: log.usuarioId,
      tipo: log.tipo,
      descricao: log.descricao ?? null,
      metadata: log.metadata ?? null,
      criadoEm: log.criadoEm,
    })),
  };
};

type AdminCandidatoDetalhe = ReturnType<typeof mapCandidato>;

type AdminCandidatosListResult = {
  data: AdminCandidatoDetalhe[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

const buildWhere = ({ status, search }: AdminCandidatosListQuery): Prisma.UsuariosWhereInput => {
  const conditions: Prisma.UsuariosWhereInput[] = [
    {
      role: 'ALUNO_CANDIDATO',
      curriculos: { some: {} },
    },
  ];

  if (status) {
    conditions.push({ status });
  }

  if (search) {
    conditions.push({
      OR: [
        { nomeCompleto: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { codUsuario: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
};

export const adminCandidatosService = {
  list: async (params: AdminCandidatosListQuery): Promise<AdminCandidatosListResult> => {
    const { page, pageSize } = params;
    const where = buildWhere(params);
    const skip = (page - 1) * pageSize;

    const [total, candidatos] = await prisma.$transaction([
      prisma.usuarios.count({ where }),
      prisma.usuarios.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        select: candidatoSelect,
      }),
    ]);

    const data = candidatos
      .filter((candidato) => candidato.curriculos.length > 0)
      .map((candidato) => mapCandidato(candidato));

    return {
      data,
      pagination: buildPagination(page, pageSize, total),
    };
  },

  get: async (id: string) => {
    const candidato = await prisma.usuarios.findFirst({
      where: {
        id,
        role: 'ALUNO_CANDIDATO',
        curriculos: { some: {} },
      },
      select: candidatoSelect,
    });

    if (!candidato || candidato.curriculos.length === 0) {
      return null;
    }

    return mapCandidato(candidato);
  },
};
