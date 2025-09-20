import { randomUUID } from 'crypto';

import {
  ModalidadesDeVagas,
  Prisma,
  RegimesDeTrabalhos,
  StatusVaga,
  TipoUsuario,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import {
  EmpresaSemPlanoAtivoError,
  LimiteVagasPlanoAtingidoError,
  UsuarioNaoEmpresaError,
} from '@/modules/empresas/vagas/services/errors';

export type CreateVagaData = {
  usuarioId: string;
  modoAnonimo?: boolean;
  regimeDeTrabalho: RegimesDeTrabalhos;
  modalidade: ModalidadesDeVagas;
  titulo: string;
  paraPcd?: boolean;
  requisitos: string;
  atividades: string;
  beneficios: string;
  observacoes?: string;
  cargaHoraria: string;
  inscricoesAte?: Date;
  inseridaEm?: Date;
  status?: StatusVaga;
};

export type UpdateVagaData = Omit<Partial<CreateVagaData>, 'inscricoesAte'> & {
  inscricoesAte?: Date | null;
};

const ANON_DESCRIPTION =
  'Esta empresa optou por manter suas informações confidenciais até avançar nas etapas do processo seletivo.';

const includeEmpresa = {
  include: {
    empresa: {
      select: {
        id: true,
        nomeCompleto: true,
        avatarUrl: true,
        descricao: true,
        instagram: true,
        linkedin: true,
        codUsuario: true,
        role: true,
        tipoUsuario: true,
        enderecos: {
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
        },
      },
    },
  },
} as const;

type VagaWithEmpresa = Prisma.EmpresasVagasGetPayload<typeof includeEmpresa>;

const anonymizedName = (vagaId: string) => `Oportunidade Confidencial #${vagaId.slice(0, 5).toUpperCase()}`;

const nullableText = (value?: string) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const VAGA_CODE_LENGTH = 6;
const VAGA_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const createCodeCandidate = () => {
  let result = '';

  for (let index = 0; index < VAGA_CODE_LENGTH; index++) {
    const charIndex = Math.floor(Math.random() * VAGA_CODE_ALPHABET.length);
    result += VAGA_CODE_ALPHABET[charIndex];
  }

  return result;
};

const createFallbackCandidate = () => randomUUID().replace(/-/g, '').slice(0, VAGA_CODE_LENGTH).toUpperCase();

const generateUniqueVagaCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = createCodeCandidate();
    const existing = await prisma.empresasVagas.findUnique({ where: { codigo: candidate }, select: { id: true } });

    if (!existing) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = createFallbackCandidate();
    const existing = await prisma.empresasVagas.findUnique({ where: { codigo: candidate }, select: { id: true } });

    if (!existing) {
      return candidate;
    }
  }

  throw Object.assign(new Error('Não foi possível gerar um código único para a vaga'), {
    code: 'VAGA_CODE_GENERATION_FAILED',
  });
};

const sanitizeCreateData = (data: CreateVagaData, codigo: string): Prisma.EmpresasVagasUncheckedCreateInput => ({
  usuarioId: data.usuarioId,
  codigo,
  modoAnonimo: data.modoAnonimo ?? false,
  regimeDeTrabalho: data.regimeDeTrabalho,
  modalidade: data.modalidade,
  titulo: data.titulo.trim(),
  paraPcd: data.paraPcd ?? false,
  requisitos: data.requisitos.trim(),
  atividades: data.atividades.trim(),
  beneficios: data.beneficios.trim(),
  observacoes: nullableText(data.observacoes),
  cargaHoraria: data.cargaHoraria.trim(),
  inscricoesAte: data.inscricoesAte ?? null,
  inseridaEm: data.inseridaEm ?? new Date(),
  status: data.status ?? StatusVaga.EM_ANALISE,
});

const sanitizeUpdateData = (data: UpdateVagaData): Prisma.EmpresasVagasUncheckedUpdateInput => {
  const update: Prisma.EmpresasVagasUncheckedUpdateInput = {};

  if (data.usuarioId !== undefined) {
    update.usuarioId = data.usuarioId;
  }
  if (data.modoAnonimo !== undefined) {
    update.modoAnonimo = data.modoAnonimo;
  }
  if (data.regimeDeTrabalho !== undefined) {
    update.regimeDeTrabalho = data.regimeDeTrabalho;
  }
  if (data.modalidade !== undefined) {
    update.modalidade = data.modalidade;
  }
  if (data.titulo !== undefined) {
    update.titulo = data.titulo.trim();
  }
  if (data.paraPcd !== undefined) {
    update.paraPcd = data.paraPcd;
  }
  if (data.requisitos !== undefined) {
    update.requisitos = data.requisitos.trim();
  }
  if (data.atividades !== undefined) {
    update.atividades = data.atividades.trim();
  }
  if (data.beneficios !== undefined) {
    update.beneficios = data.beneficios.trim();
  }
  if (data.observacoes !== undefined) {
    update.observacoes = nullableText(data.observacoes);
  }
  if (data.cargaHoraria !== undefined) {
    update.cargaHoraria = data.cargaHoraria.trim();
  }
  if (data.inscricoesAte !== undefined) {
    update.inscricoesAte = data.inscricoesAte ?? null;
  }
  if (data.inseridaEm !== undefined) {
    update.inseridaEm = data.inseridaEm;
  }
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === StatusVaga.PUBLICADO && data.inseridaEm === undefined) {
      update.inseridaEm = new Date();
    }
  }

  return update;
};

const transformVaga = (vaga: VagaWithEmpresa) => {
  if (!vaga) return null;

  const empresaUsuarioRaw =
    vaga.empresa && vaga.empresa.tipoUsuario === TipoUsuario.PESSOA_JURIDICA ? vaga.empresa : null;
  const empresaUsuario = empresaUsuarioRaw ? attachEnderecoResumo(empresaUsuarioRaw)! : null;

  const displayName = vaga.modoAnonimo
    ? anonymizedName(vaga.id)
    : empresaUsuario?.nomeCompleto ?? null;
  const displayLogo = vaga.modoAnonimo ? null : empresaUsuario?.avatarUrl ?? null;
  const rawDescricao = empresaUsuario?.descricao;
  const displayDescription = vaga.modoAnonimo
    ? ANON_DESCRIPTION
    : typeof rawDescricao === 'string' && rawDescricao.trim().length > 0
      ? rawDescricao.trim()
      : rawDescricao ?? null;

  const empresa = empresaUsuario
    ? {
        id: empresaUsuario.id,
        nome: empresaUsuario.nomeCompleto,
        avatarUrl: vaga.modoAnonimo ? null : empresaUsuario.avatarUrl,
        cidade: empresaUsuario.cidade,
        estado: empresaUsuario.estado,
        descricao: displayDescription,
        instagram: vaga.modoAnonimo ? null : empresaUsuario.instagram,
        linkedin: vaga.modoAnonimo ? null : empresaUsuario.linkedin,
        codUsuario: empresaUsuario.codUsuario,
        enderecos: empresaUsuario.enderecos,
      }
    : null;

  return {
    ...vaga,
    empresa,
    nomeExibicao: displayName,
    logoExibicao: displayLogo,
    mensagemAnonimato: vaga.modoAnonimo ? ANON_DESCRIPTION : null,
    descricaoExibicao: displayDescription,
  };
};

const ensurePlanoAtivoParaUsuario = async (usuarioId: string) => {
  const usuarioEmpresa = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: { tipoUsuario: true },
  });

  if (!usuarioEmpresa || usuarioEmpresa.tipoUsuario !== TipoUsuario.PESSOA_JURIDICA) {
    throw new UsuarioNaoEmpresaError();
  }

  const planoAtivo = await clientesService.findActiveByUsuario(usuarioId);

  if (!planoAtivo) {
    throw new EmpresaSemPlanoAtivoError();
  }

  const limite = planoAtivo.plano.quantidadeVagas;
  if (typeof limite === 'number' && limite > 0) {
    const vagasAtivas = await prisma.empresasVagas.count({
      where: {
        usuarioId,
        status: { in: [StatusVaga.EM_ANALISE, StatusVaga.PUBLICADO] },
      },
    });

    if (vagasAtivas >= limite) {
      throw new LimiteVagasPlanoAtingidoError(limite);
    }
  }

  return planoAtivo;
};

export const vagasService = {
  list: async (params?: { status?: StatusVaga[]; usuarioId?: string; page?: number; pageSize?: number }) => {
    const where: Prisma.EmpresasVagasWhereInput = {
      ...(params?.status && params.status.length > 0
        ? { status: { in: params.status } }
        : { status: StatusVaga.PUBLICADO }),
      ...(params?.usuarioId ? { usuarioId: params.usuarioId } : {}),
    };

    const take = params?.pageSize && params.pageSize > 0 ? params.pageSize : undefined;
    const skip = take && params?.page && params.page > 1 ? (params.page - 1) * take : undefined;

    const vagas = await prisma.empresasVagas.findMany({
      where,
      ...includeEmpresa,
      orderBy: { inseridaEm: 'desc' },
      ...(take ? { take } : {}),
      ...(skip ? { skip } : {}),
    });

    return vagas.map((vaga) => transformVaga(vaga));
  },

  get: async (id: string) => {
    const vaga = await prisma.empresasVagas.findFirst({
      where: { id, status: StatusVaga.PUBLICADO },
      ...includeEmpresa,
    });

    return vaga ? transformVaga(vaga) : null;
  },

  create: async (data: CreateVagaData) => {
    await ensurePlanoAtivoParaUsuario(data.usuarioId);
    const codigo = await generateUniqueVagaCode();

    const vaga = await prisma.empresasVagas.create({
      data: sanitizeCreateData(data, codigo),
      ...includeEmpresa,
    });

    return transformVaga(vaga);
  },

  update: async (id: string, data: UpdateVagaData) => {
    const vaga = await prisma.empresasVagas.update({
      where: { id },
      data: sanitizeUpdateData(data),
      ...includeEmpresa,
    });

    return transformVaga(vaga);
  },

  remove: (id: string) => prisma.empresasVagas.delete({ where: { id } }),
};
