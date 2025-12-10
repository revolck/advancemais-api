import { randomUUID } from 'crypto';

import { Prisma, StatusDeVagas, TiposDeUsuarios } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import { mapSocialLinks, usuarioRedesSociaisSelect } from '@/modules/usuarios/utils/social-links';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import {
  EmpresaSemPlanoAtivoError,
  LimiteVagasDestaqueAtingidoError,
  PlanoNaoPermiteVagaDestaqueError,
  VagaAreaSubareaError,
  UsuarioNaoEmpresaError,
} from '@/modules/empresas/vagas/services/errors';
import type {
  CreateVagaInput,
  UpdateVagaInput,
} from '@/modules/empresas/vagas/validators/vagas.schema';
export type CreateVagaData = CreateVagaInput;
export type UpdateVagaData = UpdateVagaInput;

const ANON_DESCRIPTION =
  'Esta empresa optou por manter suas informações confidenciais até avançar nas etapas do processo seletivo.';

const includeEmpresa = {
  include: {
    Usuarios: {
      select: {
        id: true,
        nomeCompleto: true,
        cnpj: true, // Adicionado para retornar CNPJ da empresa
        UsuariosInformation: {
          select: usuarioInformacoesSelect,
        },
        ...usuarioRedesSociaisSelect,
        codUsuario: true,
        role: true,
        tipoUsuario: true,
        UsuariosEnderecos: {
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
    EmpresasVagasDestaque: {
      select: {
        id: true,
        empresasPlanoId: true,
        ativo: true,
        ativadoEm: true,
        desativadoEm: true,
      },
    },
    CandidatosAreasInteresse: {
      select: {
        id: true,
        categoria: true,
      },
    },
    CandidatosSubareasInteresse: {
      select: {
        id: true,
        nome: true,
        areaId: true,
      },
    },
  },
} as const;

type VagaWithEmpresa = Prisma.EmpresasVagasGetPayload<typeof includeEmpresa>;

const HIGHLIGHT_ACTIVE_STATUSES: StatusDeVagas[] = [
  StatusDeVagas.EM_ANALISE,
  StatusDeVagas.PUBLICADO,
  StatusDeVagas.PAUSADA,
];

type PlanoAtivo = Awaited<ReturnType<typeof clientesService.findActiveByUsuario>>;

const resolvePlanoDestaqueLimite = (planoAtivo: PlanoAtivo): number | null => {
  if (!planoAtivo?.PlanosEmpresariais?.vagaEmDestaque) {
    return null;
  }

  const limite = planoAtivo.PlanosEmpresariais.quantidadeVagasDestaque ?? null;
  if (limite === null || limite <= 0) {
    return null;
  }

  return limite;
};

const assertPlanoPermiteVagaDestaque = (planoAtivo: PlanoAtivo): number => {
  const limite = resolvePlanoDestaqueLimite(planoAtivo);

  if (limite === null) {
    throw new PlanoNaoPermiteVagaDestaqueError();
  }

  return limite;
};

const assertVagasDestaqueDisponiveis = async (
  tx: Prisma.TransactionClient,
  empresasPlanoId: string,
  limite: number,
  vagaIdToIgnorar?: string,
) => {
  if (limite <= 0) {
    throw new PlanoNaoPermiteVagaDestaqueError();
  }

  const destaquesAtivos = await tx.empresasVagasDestaque.count({
    where: {
      empresasPlanoId,
      ativo: true,
      ...(vagaIdToIgnorar ? { vagaId: { not: vagaIdToIgnorar } } : {}),
      EmpresasVagas: { status: { in: HIGHLIGHT_ACTIVE_STATUSES } },
    },
  });

  if (destaquesAtivos >= limite) {
    throw new LimiteVagasDestaqueAtingidoError(limite);
  }
};

const anonymizedName = (vagaId: string) =>
  `Oportunidade Confidencial #${vagaId.slice(0, 5).toUpperCase()}`;

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

const createFallbackCandidate = () =>
  randomUUID().replace(/-/g, '').slice(0, VAGA_CODE_LENGTH).toUpperCase();

const generateUniqueVagaCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = createCodeCandidate();
    const existing = await prisma.empresasVagas.findUnique({
      where: { codigo: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = createFallbackCandidate();
    const existing = await prisma.empresasVagas.findUnique({
      where: { codigo: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw Object.assign(new Error('Não foi possível gerar um código único para a vaga'), {
    code: 'VAGA_CODE_GENERATION_FAILED',
  });
};

const sanitizeStringArray = (values: string[] | undefined) => {
  if (!Array.isArray(values)) return [];

  const sanitized = values.map((value) => value.trim()).filter((value) => value.length > 0);

  return Array.from(new Set(sanitized));
};

const sanitizeRequisitos = (
  value: CreateVagaData['requisitos'] | NonNullable<UpdateVagaData['requisitos']>,
): Prisma.JsonObject => ({
  obrigatorios: sanitizeStringArray(value.obrigatorios),
  desejaveis: sanitizeStringArray(value.desejaveis ?? []),
});

const sanitizeAtividades = (
  value: CreateVagaData['atividades'] | NonNullable<UpdateVagaData['atividades']>,
): Prisma.JsonObject => ({
  principais: sanitizeStringArray(value.principais),
  extras: sanitizeStringArray(value.extras ?? []),
});

const sanitizeBeneficios = (
  value: CreateVagaData['beneficios'] | NonNullable<UpdateVagaData['beneficios']>,
): Prisma.JsonObject => ({
  lista: sanitizeStringArray(value?.lista ?? []),
  observacoes: value?.observacoes !== undefined ? nullableText(value.observacoes) : null,
});

const sanitizeLocalizacao = (
  value:
    | CreateVagaData['localizacao']
    | NonNullable<UpdateVagaData['localizacao']>
    | null
    | undefined,
) => {
  if (!value) {
    return null;
  }

  const entries = Object.entries(value).reduce<Record<string, string>>(
    (accumulator, [key, raw]) => {
      if (typeof raw !== 'string') return accumulator;
      const trimmed = raw.trim();
      if (trimmed.length === 0) return accumulator;

      accumulator[key] = trimmed;
      return accumulator;
    },
    {},
  );

  return Object.keys(entries).length > 0 ? (entries as Prisma.JsonObject) : null;
};

const hasOwn = <T extends object>(target: T, property: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(target, property);

const ensureAreaAndSubarea = async ({
  areaId,
  subareaId,
}: {
  areaId?: number | null;
  subareaId?: number | null;
}) => {
  if (subareaId == null) {
    throw new VagaAreaSubareaError('SUBAREA_REQUIRED');
  }

  const subarea = await prisma.candidatosSubareasInteresse.findUnique({
    where: { id: subareaId },
    select: {
      id: true,
      areaId: true,
      CandidatosAreasInteresse: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!subarea) {
    throw new VagaAreaSubareaError('SUBAREA_NOT_FOUND');
  }

  if (!subarea.CandidatosAreasInteresse) {
    throw new VagaAreaSubareaError('AREA_NOT_FOUND');
  }

  const finalAreaId = areaId ?? subarea.CandidatosAreasInteresse?.id ?? subarea.areaId;

  if (subarea.areaId !== finalAreaId) {
    throw new VagaAreaSubareaError('MISMATCH');
  }

  return {
    areaId: finalAreaId,
    subareaId: subarea.id,
  } as const;
};

const resolveAreaSubareaUpdate = async (
  vagaAtual: { areaInteresseId: number | null; subareaInteresseId: number | null },
  data: UpdateVagaData,
) => {
  const areaProvided = hasOwn(data, 'areaInteresseId');
  const subareaProvided = hasOwn(data, 'subareaInteresseId');

  if (!areaProvided && !subareaProvided) {
    return null;
  }

  const targetAreaId = areaProvided
    ? (data.areaInteresseId ?? null)
    : (vagaAtual.areaInteresseId ?? null);
  const targetSubareaId = subareaProvided
    ? (data.subareaInteresseId ?? null)
    : (vagaAtual.subareaInteresseId ?? null);

  if (targetSubareaId == null) {
    throw new VagaAreaSubareaError('SUBAREA_REQUIRED');
  }

  const { areaId, subareaId } = await ensureAreaAndSubarea({
    areaId: targetAreaId ?? undefined,
    subareaId: targetSubareaId,
  });

  return {
    areaInteresseId: areaId,
    subareaInteresseId: subareaId,
  } as const;
};

const sanitizeCreateData = (
  data: CreateVagaData,
  codigo: string,
): Prisma.EmpresasVagasUncheckedCreateInput => {
  const localizacao = sanitizeLocalizacao(data.localizacao ?? null);

  return {
    usuarioId: data.usuarioId,
    slug: data.slug.trim().toLowerCase(),
    codigo,
    areaInteresseId: data.areaInteresseId,
    subareaInteresseId: data.subareaInteresseId,
    modoAnonimo: data.modoAnonimo ?? false,
    regimeDeTrabalho: data.regimeDeTrabalho,
    modalidade: data.modalidade,
    titulo: data.titulo.trim(),
    paraPcd: data.paraPcd ?? false,
    numeroVagas: data.numeroVagas ?? 1,
    descricao: nullableText(data.descricao),
    requisitos: sanitizeRequisitos(data.requisitos),
    atividades: sanitizeAtividades(data.atividades),
    beneficios: sanitizeBeneficios(data.beneficios),
    observacoes: nullableText(data.observacoes),
    jornada: data.jornada,
    senioridade: data.senioridade,
    inscricoesAte: data.inscricoesAte ?? null,
    inseridaEm: data.inseridaEm ?? new Date(),
    // status default handled by DB (RASCUNHO/EM_ANALISE)
    ...(localizacao ? { localizacao } : {}),
    salarioMin: data.salarioMin ?? undefined,
    salarioMax: data.salarioMax ?? undefined,
    salarioConfidencial: data.salarioConfidencial ?? true,
    destaque: data.vagaEmDestaque ?? false,
  };
};

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
  if (data.slug !== undefined) {
    update.slug = data.slug.trim().toLowerCase();
  }
  if (data.vagaEmDestaque !== undefined) {
    update.destaque = data.vagaEmDestaque;
  }
  if (data.numeroVagas !== undefined) {
    update.numeroVagas = data.numeroVagas;
  }
  if (data.descricao !== undefined) {
    update.descricao = nullableText(data.descricao ?? undefined);
  }
  if (data.requisitos !== undefined) {
    update.requisitos =
      data.requisitos === null ? Prisma.JsonNull : sanitizeRequisitos(data.requisitos);
  }
  if (data.atividades !== undefined) {
    update.atividades =
      data.atividades === null ? Prisma.JsonNull : sanitizeAtividades(data.atividades);
  }
  if (data.beneficios !== undefined) {
    update.beneficios =
      data.beneficios === null ? Prisma.JsonNull : sanitizeBeneficios(data.beneficios);
  }
  if (data.observacoes !== undefined) {
    update.observacoes =
      data.observacoes === null ? null : (nullableText(data.observacoes) ?? undefined);
  }
  if (data.jornada !== undefined) {
    update.jornada = data.jornada;
  }
  if (data.senioridade !== undefined) {
    update.senioridade = data.senioridade;
  }
  if (data.inscricoesAte !== undefined) {
    update.inscricoesAte = data.inscricoesAte ?? null;
  }
  if (data.inseridaEm !== undefined) {
    update.inseridaEm = data.inseridaEm;
  }
  if (data.localizacao !== undefined) {
    if (data.localizacao === null) {
      update.localizacao = Prisma.JsonNull;
    } else {
      const localizacao = sanitizeLocalizacao(data.localizacao);
      update.localizacao = localizacao ?? Prisma.JsonNull;
    }
  }
  if (data.salarioMin !== undefined) {
    update.salarioMin = data.salarioMin === null ? null : data.salarioMin;
  }
  if (data.salarioMax !== undefined) {
    update.salarioMax = data.salarioMax === null ? null : data.salarioMax;
  }
  if (data.salarioConfidencial !== undefined) {
    update.salarioConfidencial = data.salarioConfidencial;
  }
  if (data.areaInteresseId !== undefined) {
    update.areaInteresseId = data.areaInteresseId;
  }
  if (data.subareaInteresseId !== undefined) {
    update.subareaInteresseId = data.subareaInteresseId;
  }
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === StatusDeVagas.PUBLICADO && data.inseridaEm === undefined) {
      update.inseridaEm = new Date();
    }
  }

  return update;
};

const transformVaga = (vaga: VagaWithEmpresa) => {
  if (!vaga) return null;

  const {
    destaque,
    EmpresasVagasDestaque: destaqueInfo,
    CandidatosAreasInteresse: areaInteresse,
    CandidatosSubareasInteresse: subareaInteresse,
    ...vagaSemMetadados
  } = vaga;

  const empresaUsuarioRaw =
    vagaSemMetadados.Usuarios &&
    vagaSemMetadados.Usuarios.tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA
      ? vagaSemMetadados.Usuarios
      : null;
  const empresaUsuario = empresaUsuarioRaw
    ? attachEnderecoResumo(mergeUsuarioInformacoes(empresaUsuarioRaw))!
    : null;

  const displayName = vagaSemMetadados.modoAnonimo
    ? anonymizedName(vagaSemMetadados.id)
    : (empresaUsuario?.nomeCompleto ?? null);
  const displayLogo = vagaSemMetadados.modoAnonimo ? null : (empresaUsuario?.avatarUrl ?? null);
  const rawDescricao = empresaUsuario?.descricao;
  const displayDescription = vagaSemMetadados.modoAnonimo
    ? ANON_DESCRIPTION
    : typeof rawDescricao === 'string' && rawDescricao.trim().length > 0
      ? rawDescricao.trim()
      : (rawDescricao ?? null);

  const empresa = empresaUsuario
    ? {
        id: empresaUsuario.id,
        nome: empresaUsuario.nomeCompleto,
        cnpj: vagaSemMetadados.modoAnonimo ? null : ((empresaUsuario as any).cnpj ?? null), // CNPJ da empresa
        avatarUrl: vagaSemMetadados.modoAnonimo ? null : empresaUsuario.avatarUrl,
        cidade: empresaUsuario.cidade,
        estado: empresaUsuario.estado,
        descricao: displayDescription,
        socialLinks: vagaSemMetadados.modoAnonimo
          ? null
          : mapSocialLinks(empresaUsuario.redesSociais),
        codUsuario: empresaUsuario.codUsuario,
        enderecos: empresaUsuario.UsuariosEnderecos,
        informacoes: empresaUsuario.informacoes,
      }
    : null;

  const destaqueDetalhes = destaqueInfo
    ? {
        id: destaqueInfo.id,
        empresasPlanoId: destaqueInfo.empresasPlanoId,
        ativo: destaqueInfo.ativo,
        ativadoEm: destaqueInfo.ativadoEm,
        desativadoEm: destaqueInfo.desativadoEm ?? null,
      }
    : null;

  return {
    ...vagaSemMetadados,
    areaInteresse: areaInteresse
      ? {
          id: areaInteresse.id,
          categoria: areaInteresse.categoria,
        }
      : null,
    subareaInteresse: subareaInteresse
      ? {
          id: subareaInteresse.id,
          nome: subareaInteresse.nome,
          areaId: subareaInteresse.areaId,
        }
      : null,
    empresa,
    nomeExibicao: displayName,
    logoExibicao: displayLogo,
    mensagemAnonimato: vagaSemMetadados.modoAnonimo ? ANON_DESCRIPTION : null,
    descricaoExibicao: displayDescription,
    vagaEmDestaque: destaque,
    destaqueInfo: destaqueDetalhes,
  };
};

const ensurePlanoAtivoParaUsuario = async (usuarioId: string) => {
  const usuarioEmpresa = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: { tipoUsuario: true },
  });

  if (!usuarioEmpresa || usuarioEmpresa.tipoUsuario !== TiposDeUsuarios.PESSOA_JURIDICA) {
    throw new UsuarioNaoEmpresaError();
  }

  const planoAtivo = await clientesService.findActiveByUsuario(usuarioId);

  if (!planoAtivo) {
    throw new EmpresaSemPlanoAtivoError();
  }

  // Observação: a partir de agora, apenas vagas PUBLICADAS contam no limite do plano.
  // Permite enviar quantas vagas quiser para análise; o limite será validado na aprovação.

  return planoAtivo;
};

export const vagasService = {
  list: async (params?: {
    status?: StatusDeVagas[];
    usuarioId?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const where: Prisma.EmpresasVagasWhereInput = {
      ...(params?.status && params.status.length > 0
        ? { status: { in: params.status } }
        : { status: StatusDeVagas.PUBLICADO }),
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
      where: { id, status: StatusDeVagas.PUBLICADO },
      ...includeEmpresa,
    });

    return vaga ? transformVaga(vaga) : null;
  },

  getBySlug: async (slug: string) => {
    if (!slug) return null;
    const normalizedSlug = slug.trim().toLowerCase();
    const vaga = await prisma.empresasVagas.findFirst({
      where: {
        status: StatusDeVagas.PUBLICADO,
        slug: { equals: normalizedSlug, mode: 'insensitive' },
      },
      ...includeEmpresa,
    });

    return vaga ? transformVaga(vaga) : null;
  },

  create: async (data: CreateVagaData) => {
    // Se areaInteresseId é UUID, é na verdade a categoriaVagaId
    let categoriaId = data.categoriaVagaId;
    let subcategoriaId = data.subcategoriaVagaId;

    if (data.areaInteresseId && typeof data.areaInteresseId === 'string') {
      // Frontend enviou UUID em areaInteresseId - usar como categoriaVagaId
      categoriaId = data.areaInteresseId as any;
    }

    if (data.subareaInteresseId && typeof data.subareaInteresseId === 'string') {
      // Frontend enviou UUID em subareaInteresseId - usar como subcategoriaVagaId
      subcategoriaId = data.subareaInteresseId as any;
    }

    // Validar categoria
    if (!categoriaId) {
      throw new Error('Categoria da vaga é obrigatória');
    }

    const categoria = await prisma.empresasVagasCategorias.findUnique({
      where: { id: categoriaId },
    });

    if (!categoria) {
      throw new Error('Categoria de vaga não encontrada');
    }

    const planoAtivo = await ensurePlanoAtivoParaUsuario(data.usuarioId);
    const codigo = await generateUniqueVagaCode();
    const shouldHighlight = data.vagaEmDestaque ?? false;

    // Preparar dados com categoria correta
    const dataComCategoria = {
      ...data,
      categoriaVagaId: categoriaId,
      subcategoriaVagaId: subcategoriaId || null,
      areaInteresseId: null,
      subareaInteresseId: null,
    };

    const vaga = await prisma.$transaction(async (tx) => {
      if (shouldHighlight) {
        const limite = assertPlanoPermiteVagaDestaque(planoAtivo);
        await assertVagasDestaqueDisponiveis(tx, planoAtivo.id, limite);
      }

      const created = await tx.empresasVagas.create({
        data: sanitizeCreateData(dataComCategoria as any, codigo),
      });

      if (shouldHighlight) {
        await tx.empresasVagasDestaque.create({
          data: {
            vagaId: created.id,
            empresasPlanoId: planoAtivo.id,
          },
        });
      }

      return tx.empresasVagas.findUniqueOrThrow({
        where: { id: created.id },
        ...includeEmpresa,
      });
    });

    return transformVaga(vaga);
  },

  update: async (id: string, data: UpdateVagaData) => {
    const vagaAtual = await prisma.empresasVagas.findUnique({
      where: { id },
      include: { EmpresasVagasDestaque: true },
    });

    if (!vagaAtual) {
      throw Object.assign(new Error('Vaga não encontrada'), { code: 'P2025' });
    }

    const areaUpdate = await resolveAreaSubareaUpdate(vagaAtual, data);
    const dataParaAtualizar: UpdateVagaData = areaUpdate ? { ...data, ...areaUpdate } : data;

    const novoUsuarioId = data.usuarioId ?? vagaAtual.usuarioId;
    const shouldActivateHighlight = data.vagaEmDestaque === true && !vagaAtual.destaque;
    const shouldDeactivateHighlight = data.vagaEmDestaque === false && vagaAtual.destaque;
    const manterHighlightAtivo = vagaAtual.destaque && !shouldDeactivateHighlight;
    const shouldReassignHighlightPlan = manterHighlightAtivo && data.usuarioId !== undefined;

    let planoAtivo: PlanoAtivo = null;
    let limiteDestaque: number | null = null;

    if (shouldActivateHighlight || shouldReassignHighlightPlan) {
      planoAtivo = await ensurePlanoAtivoParaUsuario(novoUsuarioId);
      limiteDestaque = assertPlanoPermiteVagaDestaque(planoAtivo);
    }

    const vaga = await prisma.$transaction(async (tx) => {
      if (planoAtivo && limiteDestaque !== null) {
        await assertVagasDestaqueDisponiveis(tx, planoAtivo.id, limiteDestaque);
      }

      const atualizada = await tx.empresasVagas.update({
        where: { id },
        data: sanitizeUpdateData(dataParaAtualizar),
      });

      if (planoAtivo && (shouldActivateHighlight || shouldReassignHighlightPlan)) {
        await tx.empresasVagasDestaque.upsert({
          where: { vagaId: atualizada.id },
          update: {
            empresasPlanoId: planoAtivo.id,
            ativo: true,
            ativadoEm: new Date(),
            desativadoEm: null,
          },
          create: {
            vagaId: atualizada.id,
            empresasPlanoId: planoAtivo.id,
          },
        });
      }

      if (shouldDeactivateHighlight) {
        await tx.empresasVagasDestaque.updateMany({
          where: { vagaId: atualizada.id },
          data: { ativo: false, desativadoEm: new Date() },
        });
      }

      return tx.empresasVagas.findUniqueOrThrow({
        where: { id: atualizada.id },
        ...includeEmpresa,
      });
    });

    return transformVaga(vaga);
  },

  remove: (id: string) => prisma.empresasVagas.delete({ where: { id } }),
};
