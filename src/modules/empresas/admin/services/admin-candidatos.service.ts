import type { Prisma } from '@prisma/client';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import { mapSocialLinks, usuarioRedesSociaisSelect } from '@/modules/usuarios/utils/social-links';

import type { AdminCandidatosListQuery } from '@/modules/empresas/admin/validators/admin-candidatos.schema';

const usuarioEnderecoSelect = {
  orderBy: { criadoEm: 'asc' },
  select: {
    id: true,
    logradouro: true,
    numero: true,
    bairro: true,
    cidade: true,
    estado: true,
    cep: true,
  },
} as const;

const usuarioAdminSelect = {
  id: true,
  codUsuario: true,
  nomeCompleto: true,
  email: true,
  cpf: true,
  cnpj: true,
  role: true,
  tipoUsuario: true,
  status: true,
  criadoEm: true,
  ultimoLogin: true,
  ...usuarioRedesSociaisSelect,
  informacoes: { select: usuarioInformacoesSelect },
  enderecos: usuarioEnderecoSelect,
} satisfies Prisma.UsuariosSelect;

const curriculoSelect = {
  id: true,
  usuarioId: true,
  titulo: true,
  resumo: true,
  objetivo: true,
  principal: true,
  areasInteresse: true,
  preferencias: true,
  habilidades: true,
  idiomas: true,
  experiencias: true,
  formacao: true,
  cursosCertificacoes: true,
  premiosPublicacoes: true,
  acessibilidade: true,
  consentimentos: true,
  ultimaAtualizacao: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.UsuariosCurriculosSelect;

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
  vaga: { select: vagaSelect },
  empresa: { select: usuarioAdminSelect },
} satisfies Prisma.EmpresasCandidatosSelect;

const candidatoSelect = {
  ...usuarioAdminSelect,
  curriculos: {
    orderBy: [{ principal: 'desc' }, { atualizadoEm: 'desc' }],
    select: curriculoSelect,
  },
  candidaturasFeitas: {
    orderBy: { aplicadaEm: 'desc' },
    select: candidaturaSelect,
  },
} satisfies Prisma.UsuariosSelect;

type UsuarioAdminRecord = Prisma.UsuariosGetPayload<{ select: typeof usuarioAdminSelect }>;
type CurriculoRecord = Prisma.UsuariosCurriculosGetPayload<{ select: typeof curriculoSelect }>;
type VagaRecord = Prisma.EmpresasVagasGetPayload<{ select: typeof vagaSelect }>;
type CandidaturaRecord = Prisma.EmpresasCandidatosGetPayload<{ select: typeof candidaturaSelect }>;
type CandidatoRecord = Prisma.UsuariosGetPayload<{ select: typeof candidatoSelect }>;

const mapUsuarioAdmin = (usuario?: UsuarioAdminRecord | null) => {
  if (!usuario) {
    return null;
  }

  const merged = attachEnderecoResumo(mergeUsuarioInformacoes(usuario));

  if (!merged) {
    return null;
  }

  const socialLinks = mapSocialLinks(merged.redesSociais);

  return {
    id: merged.id,
    codUsuario: merged.codUsuario,
    nomeCompleto: merged.nomeCompleto,
    email: merged.email,
    cpf: merged.cpf ?? null,
    cnpj: merged.cnpj ?? null,
    role: merged.role,
    tipoUsuario: merged.tipoUsuario,
    status: merged.status,
    criadoEm: merged.criadoEm,
    ultimoLogin: merged.ultimoLogin ?? null,
    telefone: merged.telefone ?? null,
    genero: merged.genero ?? null,
    dataNasc: merged.dataNasc ?? null,
    inscricao: merged.inscricao ?? null,
    avatarUrl: merged.avatarUrl ?? null,
    descricao: merged.descricao ?? null,
    aceitarTermos: merged.aceitarTermos ?? false,
    cidade: merged.cidade,
    estado: merged.estado,
    enderecos: merged.enderecos,
    socialLinks,
    informacoes: merged.informacoes,
  };
};

const mapCurriculo = (curriculo: CurriculoRecord) => ({
  id: curriculo.id,
  usuarioId: curriculo.usuarioId,
  titulo: curriculo.titulo ?? null,
  resumo: curriculo.resumo ?? null,
  objetivo: curriculo.objetivo ?? null,
  principal: curriculo.principal,
  areasInteresse: curriculo.areasInteresse ?? null,
  preferencias: curriculo.preferencias ?? null,
  habilidades: curriculo.habilidades ?? null,
  idiomas: curriculo.idiomas ?? null,
  experiencias: curriculo.experiencias ?? null,
  formacao: curriculo.formacao ?? null,
  cursosCertificacoes: curriculo.cursosCertificacoes ?? null,
  premiosPublicacoes: curriculo.premiosPublicacoes ?? null,
  acessibilidade: curriculo.acessibilidade ?? null,
  consentimentos: curriculo.consentimentos ?? null,
  ultimaAtualizacao: curriculo.ultimaAtualizacao,
  criadoEm: curriculo.criadoEm,
  atualizadoEm: curriculo.atualizadoEm,
});

const mapVaga = (vaga?: VagaRecord | null) => {
  if (!vaga) {
    return null;
  }

  return {
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
  curriculo: candidatura.curriculo ? mapCurriculo(candidatura.curriculo) : null,
  vaga: mapVaga(candidatura.vaga ?? null),
  empresa: mapUsuarioAdmin(candidatura.empresa ?? null),
});

const countByStatus = <T extends string>(items: { status: T }[]) =>
  items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

const mapCandidatoDetalhe = (candidato: CandidatoRecord) => {
  const base = mapUsuarioAdmin(candidato);

  if (!base) {
    return null;
  }

  const curriculos = candidato.curriculos.map(mapCurriculo);
  const candidaturas = candidato.candidaturasFeitas.map(mapCandidatura);

  return {
    ...base,
    curriculos,
    candidaturas,
    curriculosResumo: {
      total: curriculos.length,
      principais: curriculos.filter((curriculo) => curriculo.principal).length,
    },
    candidaturasResumo: {
      total: candidaturas.length,
      porStatus: countByStatus(candidaturas),
    },
  };
};

type AdminCandidatoDetalhe = ReturnType<typeof mapCandidatoDetalhe>;

const buildWhere = ({ status, search }: AdminCandidatosListQuery): Prisma.UsuariosWhereInput => {
  const where: Prisma.UsuariosWhereInput = {
    role: Roles.ALUNO_CANDIDATO,
    curriculos: { some: {} },
  };

  if (status && status.length > 0) {
    where.status = { in: status };
  }

  if (search) {
    where.OR = [
      { nomeCompleto: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { cpf: { contains: search, mode: 'insensitive' } },
      { codUsuario: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

export const adminCandidatosService = {
  list: async (params: AdminCandidatosListQuery) => {
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
      .map((candidato) => mapCandidatoDetalhe(candidato))
      .filter((item): item is NonNullable<AdminCandidatoDetalhe> => item !== null);

    return {
      data,
      pagination: buildPagination(page, pageSize, total),
    };
  },

  get: async (id: string) => {
    const candidato = await prisma.usuarios.findFirst({
      where: {
        id,
        role: Roles.ALUNO_CANDIDATO,
        curriculos: { some: {} },
      },
      select: candidatoSelect,
    });

    return candidato ? mapCandidatoDetalhe(candidato) : null;
  },
};
