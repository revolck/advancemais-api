import type { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  curriculoSelect,
  mapCurriculo,
  mapUsuarioAdmin,
  usuarioAdminSelect,
} from '@/modules/empresas/admin/services/admin-shared';

import type { AdminVagasListQuery } from '@/modules/empresas/admin/validators/admin-vagas.schema';
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
  candidato: { select: usuarioAdminSelect },
  curriculo: { select: curriculoSelect },
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
  candidato: { select: usuarioAdminSelect },
} satisfies Prisma.EmpresasVagasProcessoSelect;

const vagaSelect = {
  id: true,
  codigo: true,
  slug: true,
  usuarioId: true,
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
  candidaturas: {
    orderBy: { aplicadaEm: 'desc' },
    select: candidaturaSelect,
  },
  processos: {
    orderBy: { criadoEm: 'desc' },
    select: processoSelect,
  },
} satisfies Prisma.EmpresasVagasSelect;

type CandidaturaRecord = Prisma.EmpresasCandidatosGetPayload<{ select: typeof candidaturaSelect }>;
type ProcessoRecord = Prisma.EmpresasVagasProcessoGetPayload<{ select: typeof processoSelect }>;
type VagaRecord = Prisma.EmpresasVagasGetPayload<{ select: typeof vagaSelect }>;

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
  candidato: mapUsuarioAdmin(candidatura.candidato ?? null),
  curriculo: mapCurriculo(candidatura.curriculo ?? null),
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
  candidato: mapUsuarioAdmin(processo.candidato ?? null),
});

const mapVagaBase = (vaga: VagaRecord) => ({
  id: vaga.id,
  codigo: vaga.codigo,
  slug: vaga.slug,
  usuarioId: vaga.usuarioId,
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
});

const countByStatus = <T extends string>(items: { status: T }[]) =>
  items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

const mapVagaDetalhada = (vaga: VagaRecord) => {
  const candidaturas = vaga.candidaturas.map(mapCandidatura);
  const processos = vaga.processos.map(mapProcesso);

  return {
    ...mapVagaBase(vaga),
    empresa: mapUsuarioAdmin(vaga.empresa ?? null),
    candidaturas,
    processos,
    candidaturasResumo: {
      total: candidaturas.length,
      porStatus: countByStatus(candidaturas),
    },
    processosResumo: {
      total: processos.length,
      porStatus: countByStatus(processos),
    },
  };
};

type AdminVagaDetalhe = ReturnType<typeof mapVagaDetalhada>;

type AdminVagaListResult = {
  data: AdminVagaDetalhe[];
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

const buildWhere = ({
  status,
  empresaId,
  search,
}: AdminVagasListQuery): Prisma.EmpresasVagasWhereInput => {
  const where: Prisma.EmpresasVagasWhereInput = {};

  if (status && status.length > 0) {
    where.status = { in: status };
  }

  if (empresaId) {
    where.usuarioId = empresaId;
  }

  if (search) {
    where.OR = [
      { titulo: { contains: search, mode: 'insensitive' } },
      { codigo: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

export const adminVagasService = {
  list: async (params: AdminVagasListQuery): Promise<AdminVagaListResult> => {
    const { page, pageSize } = params;
    const where = buildWhere(params);
    const skip = (page - 1) * pageSize;

    const [total, vagas] = await prisma.$transaction([
      prisma.empresasVagas.count({ where }),
      prisma.empresasVagas.findMany({
        where,
        orderBy: { inseridaEm: 'desc' },
        skip,
        take: pageSize,
        select: vagaSelect,
      }),
    ]);

    const data = vagas.map((vaga) => mapVagaDetalhada(vaga));

    return {
      data,
      pagination: buildPagination(page, pageSize, total),
    };
  },

  get: async (id: string) => {
    const vaga = await prisma.empresasVagas.findUnique({
      where: { id },
      select: vagaSelect,
    });

    return vaga ? mapVagaDetalhada(vaga) : null;
  },
};
