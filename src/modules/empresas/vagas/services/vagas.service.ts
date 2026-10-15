import { randomUUID } from 'crypto';

import { Prisma, Roles, StatusDeVagas, TiposDeUsuarios } from '@prisma/client';

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
  VagaSlugDuplicadoError,
  VagaAreaSubareaError,
  UsuarioNaoEmpresaError,
} from '@/modules/empresas/vagas/services/errors';
import { syncExpiredPublishedVagas } from '@/modules/empresas/vagas/services/status-sync.service';
import { registrarHistoricoVaga } from '@/modules/empresas/vagas/utils/historico-vaga';
import { atualizarAvisoDaFila, avisosDaVaga } from '@/modules/empresas/vagas/utils/avisos-vaga';
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
const VAGA_SLUG_MAX_LENGTH = 120;
const VAGA_SLUG_RACE_RETRIES = 3;

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

type PrismaVagasUniqueClient = Pick<Prisma.TransactionClient, 'empresasVagas'>;

const normalizeVagaSlug = (value: string | null | undefined) => {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, VAGA_SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');

  return normalized.length > 0 ? normalized : 'vaga';
};

const appendSlugSuffix = (base: string, suffix: string) => {
  const suffixText = `-${suffix}`;
  const maxBaseLength = VAGA_SLUG_MAX_LENGTH - suffixText.length;
  const truncatedBase = base.slice(0, maxBaseLength).replace(/-+$/g, '');

  return `${truncatedBase || 'vaga'}${suffixText}`;
};

const generateUniqueVagaSlug = async (
  db: PrismaVagasUniqueClient,
  source: string | null | undefined,
) => {
  const base = normalizeVagaSlug(source);

  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix === 0 ? base : appendSlugSuffix(base, String(suffix + 1));
    const existing = await db.empresasVagas.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const randomSuffix = randomUUID().replace(/-/g, '').slice(0, 6).toLowerCase();
    const candidate = appendSlugSuffix(base, randomSuffix);
    const existing = await db.empresasVagas.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new VagaSlugDuplicadoError();
};

const isUniqueConstraintForField = (error: unknown, field: string) => {
  const prismaError = error as { code?: string; meta?: { target?: unknown } };
  const target = prismaError?.meta?.target;

  if (prismaError?.code !== 'P2002') {
    return false;
  }

  return Array.isArray(target) ? target.includes(field) : target === field;
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

  // Garantir que apenas numbers sejam usados para areaInteresseId e subareaInteresseId
  const dataAreaId = typeof data.areaInteresseId === 'number' ? data.areaInteresseId : null;
  const dataSubareaId =
    typeof data.subareaInteresseId === 'number' ? data.subareaInteresseId : null;

  const targetAreaId = areaProvided ? dataAreaId : (vagaAtual.areaInteresseId ?? null);
  const targetSubareaId = subareaProvided ? dataSubareaId : (vagaAtual.subareaInteresseId ?? null);

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
  slug: string,
  status?: StatusDeVagas,
): Prisma.EmpresasVagasUncheckedCreateInput => {
  const localizacao = sanitizeLocalizacao(data.localizacao ?? null);

  // Garantir que areaInteresseId e subareaInteresseId sejam numbers ou null
  const areaInteresseId = typeof data.areaInteresseId === 'number' ? data.areaInteresseId : null;
  const subareaInteresseId =
    typeof data.subareaInteresseId === 'number' ? data.subareaInteresseId : null;

  return {
    usuarioId: data.usuarioId,
    slug,
    codigo,
    areaInteresseId,
    subareaInteresseId,
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
    ...(status ? { status } : {}),
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
    update.slug = normalizeVagaSlug(data.slug);
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
    // Garantir que apenas numbers sejam passados (se for string/UUID, será null)
    update.areaInteresseId = typeof data.areaInteresseId === 'number' ? data.areaInteresseId : null;
  }
  if (data.subareaInteresseId !== undefined) {
    // Garantir que apenas numbers sejam passados (se for string/UUID, será null)
    update.subareaInteresseId =
      typeof data.subareaInteresseId === 'number' ? data.subareaInteresseId : null;
  }
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === StatusDeVagas.PUBLICADO && data.inseridaEm === undefined) {
      update.inseridaEm = new Date();
    }
  }

  return update;
};

/**
 * Vaga para resposta da API.
 * - interno (painel da equipe, empresa dona, recrutador vinculado): dados completos da
 *   empresa e a moderação (motivo da rejeição, observação da aprovação).
 * - público (site, candidatos): só a vitrine da empresa, sem o cadastro bruto, telefone
 *   ou dados pessoais; vaga confidencial não identifica a empresa (nome, CNPJ, endereço,
 *   código e id ficam de fora).
 */
const transformVaga = (vaga: VagaWithEmpresa, opcoes?: { interno?: boolean }) => {
  if (!vaga) return null;

  const interno = Boolean(opcoes?.interno);
  const {
    destaque,
    EmpresasVagasDestaque: destaqueInfo,
    CandidatosAreasInteresse: areaInteresse,
    CandidatosSubareasInteresse: subareaInteresse,
    motivoRejeicao,
    observacoesAprovacao,
    moderadaEm,
    Usuarios: usuarioBruto,
    ...vagaSemMetadados
  } = vaga;
  const moderacao = interno
    ? {
        motivoRejeicao: motivoRejeicao ?? null,
        observacoesAprovacao: observacoesAprovacao ?? null,
        moderadaEm: moderadaEm ?? null,
      }
    : {};
  const confidencialPublica = !interno && vagaSemMetadados.modoAnonimo;

  const empresaUsuarioRaw =
    usuarioBruto && usuarioBruto.tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA
      ? usuarioBruto
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

  const empresa = confidencialPublica
    ? {
        id: null,
        nome: displayName,
        cnpj: null,
        avatarUrl: null,
        cidade: null,
        estado: null,
        descricao: ANON_DESCRIPTION,
        socialLinks: null,
        codUsuario: null,
        enderecos: [],
        informacoes: null,
        modoAnonimo: true,
      }
    : empresaUsuario
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
          // Telefone e dados pessoais do cadastro só no painel
          informacoes: interno ? empresaUsuario.informacoes : null,
          modoAnonimo: Boolean(vagaSemMetadados.modoAnonimo),
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
    ...(confidencialPublica ? { usuarioId: null } : {}),
    // Cadastro bruto da empresa (com telefone e dados pessoais) só no painel
    ...(interno ? { Usuarios: usuarioBruto } : {}),
    ...moderacao,
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

const ensureUsuarioEmpresa = async (usuarioId: string) => {
  const usuarioEmpresa = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: { tipoUsuario: true },
  });

  if (!usuarioEmpresa || usuarioEmpresa.tipoUsuario !== TiposDeUsuarios.PESSOA_JURIDICA) {
    throw new UsuarioNaoEmpresaError();
  }
};

const hasRecursosPremiumVagasAtivos = async (usuarioId: string) => {
  await ensureUsuarioEmpresa(usuarioId);

  const recursosPremium = await prisma.empresasRecursosPremiumVagas.findUnique({
    where: { empresaId: usuarioId },
    select: {
      ativo: true,
      vagasIlimitadas: true,
      destaquesIlimitados: true,
    },
  });

  return Boolean(
    recursosPremium?.ativo &&
      recursosPremium.vagasIlimitadas &&
      recursosPremium.destaquesIlimitados,
  );
};

const canBypassPlanoAtivo = (actorRole?: Roles | string | null) =>
  actorRole === Roles.ADMIN || actorRole === Roles.MODERADOR;

const ensurePlanoAtivoParaUsuario = async (usuarioId: string) => {
  await ensureUsuarioEmpresa(usuarioId);
  const planoAtivo = await clientesService.findActiveByUsuario(usuarioId);

  if (!planoAtivo) {
    throw new EmpresaSemPlanoAtivoError();
  }

  // O limite do plano conta vagas publicadas + em análise (ver ocupacaoDoPlano).

  return planoAtivo;
};

/** Vagas que ocupam o plano: publicadas e em análise (viram publicadas na aprovação) */
const STATUS_QUE_OCUPAM_PLANO = [StatusDeVagas.PUBLICADO, StatusDeVagas.EM_ANALISE];

export const ocupacaoDoPlano = async (usuarioId: string, plano?: PlanoAtivo) => {
  const planoUsado =
    plano ?? (await clientesService.findActiveByUsuario(usuarioId).catch(() => null));
  const limite = planoUsado?.PlanosEmpresariais?.quantidadeVagas ?? null;
  const emUso = await prisma.empresasVagas.count({
    where: { usuarioId, status: { in: STATUS_QUE_OCUPAM_PLANO } },
  });
  return {
    limite,
    emUso,
    cheio: typeof limite === 'number' && limite > 0 && emUso >= limite,
  };
};

export const mensagemLimiteDoPlano = (ocupacao: { limite: number | null; emUso: number }) =>
  `Seu plano permite ${ocupacao.limite} vaga(s) ativa(s) (publicadas ou em análise) e você já está usando ${ocupacao.emUso}. Encerre ou despublique uma vaga, ou faça upgrade do plano.`;

const erroVaga = (code: string, message: string, statusCode: number) =>
  Object.assign(new Error(message), { code, statusCode });

/** Encerrada ou expirada: a empresa não edita mais (o processo daquela vaga acabou) */
const STATUS_SEM_EDICAO_PELA_EMPRESA: StatusDeVagas[] = [
  StatusDeVagas.ENCERRADA,
  StatusDeVagas.EXPIRADO,
];

/** Empresa só mexe nas próprias vagas (para as outras, a vaga "não existe") */
const carregarVagaDoAtor = async (id: string, ator: { id: string; role?: string | null }) => {
  const vaga = await prisma.empresasVagas.findUnique({
    where: { id },
    select: {
      id: true,
      usuarioId: true,
      status: true,
      codigo: true,
      titulo: true,
      _count: { select: { EmpresasCandidatos: true } },
    },
  });
  if (!vaga || (ator.role === Roles.EMPRESA && vaga.usuarioId !== ator.id)) {
    throw erroVaga('VAGA_NOT_FOUND', 'Vaga não encontrada', 404);
  }
  return vaga;
};

export const vagasService = {
  list: async (params?: {
    status?: StatusDeVagas[];
    usuarioId?: string;
    usuarioIds?: string[];
    ids?: string[];
    page?: number;
    pageSize?: number;
    /** Painel (equipe, empresa dona, recrutador vinculado): dados completos */
    interno?: boolean;
  }) => {
    await syncExpiredPublishedVagas({
      empresaUsuarioIds: params?.usuarioIds ?? (params?.usuarioId ? [params.usuarioId] : undefined),
      vagaIds: params?.ids,
    });

    const where: Prisma.EmpresasVagasWhereInput = {
      ...(params?.ids && params.ids.length > 0 ? { id: { in: params.ids } } : {}),
      ...(params?.status && params.status.length > 0
        ? { status: { in: params.status } }
        : { status: StatusDeVagas.PUBLICADO }),
      ...(params?.usuarioIds && params.usuarioIds.length > 0
        ? { usuarioId: { in: params.usuarioIds } }
        : params?.usuarioId
          ? { usuarioId: params.usuarioId }
          : {}),
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

    return vagas.map((vaga) => transformVaga(vaga, { interno: params?.interno }));
  },

  getForInternalViewer: async (params: {
    id: string;
    usuarioIds?: string[];
    status?: StatusDeVagas[];
  }) => {
    await syncExpiredPublishedVagas({ vagaIds: [params.id] });

    const vaga = await prisma.empresasVagas.findFirst({
      where: {
        id: params.id,
        ...(params.status && params.status.length > 0 ? { status: { in: params.status } } : {}),
        ...(params.usuarioIds && params.usuarioIds.length > 0
          ? { usuarioId: { in: params.usuarioIds } }
          : {}),
      },
      ...includeEmpresa,
    });

    return vaga ? transformVaga(vaga, { interno: true }) : null;
  },

  get: async (id: string) => {
    await syncExpiredPublishedVagas({ vagaIds: [id] });

    const vaga = await prisma.empresasVagas.findFirst({
      where: { id, status: StatusDeVagas.PUBLICADO },
      ...includeEmpresa,
    });

    return vaga ? transformVaga(vaga) : null;
  },

  getBySlug: async (slug: string) => {
    if (!slug) return null;

    await syncExpiredPublishedVagas();

    const normalizedSlug = normalizeVagaSlug(slug);
    const vaga = await prisma.empresasVagas.findFirst({
      where: {
        status: StatusDeVagas.PUBLICADO,
        slug: { equals: normalizedSlug, mode: 'insensitive' },
      },
      ...includeEmpresa,
    });

    return vaga ? transformVaga(vaga) : null;
  },

  create: async (
    data: CreateVagaData,
    options?: { actorRole?: Roles | string | null; actorId?: string | null },
  ) => {
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

    const codigo = await generateUniqueVagaCode();
    const shouldHighlight = data.vagaEmDestaque ?? false;
    const recursosPremiumAtivos = await hasRecursosPremiumVagasAtivos(data.usuarioId);
    const precisaPlanoAtivo =
      !recursosPremiumAtivos && (!canBypassPlanoAtivo(options?.actorRole) || shouldHighlight);
    const planoAtivo = precisaPlanoAtivo ? await ensurePlanoAtivoParaUsuario(data.usuarioId) : null;

    // Fila de aprovação do Setor de Vagas: a vaga entra EM_ANALISE. Se o plano já está
    // cheio, fica salva como rascunho (nada do que foi digitado se perde) com o aviso.
    let statusInicial: StatusDeVagas = StatusDeVagas.EM_ANALISE;
    let avisoStatus: string | null = null;
    let ocupacao: Awaited<ReturnType<typeof ocupacaoDoPlano>> | null = null;
    if (recursosPremiumAtivos) {
      statusInicial = StatusDeVagas.PUBLICADO;
    } else {
      ocupacao = await ocupacaoDoPlano(data.usuarioId, planoAtivo);
      if (ocupacao.cheio) {
        statusInicial = StatusDeVagas.RASCUNHO;
        avisoStatus = `Vaga salva como rascunho. ${mensagemLimiteDoPlano(ocupacao)}`;
      }
    }

    // Preparar dados com categoria correta
    const dataComCategoria = {
      ...data,
      categoriaVagaId: categoriaId,
      subcategoriaVagaId: subcategoriaId || null,
      areaInteresseId: null,
      subareaInteresseId: null,
    };

    for (let attempt = 0; attempt < VAGA_SLUG_RACE_RETRIES; attempt++) {
      try {
        const vaga = await prisma.$transaction(async (tx) => {
          if (shouldHighlight && !recursosPremiumAtivos) {
            if (!planoAtivo) {
              throw new EmpresaSemPlanoAtivoError();
            }

            const limite = assertPlanoPermiteVagaDestaque(planoAtivo);
            await assertVagasDestaqueDisponiveis(tx, planoAtivo.id, limite);
          }

          const slug = await generateUniqueVagaSlug(
            tx,
            dataComCategoria.slug ?? dataComCategoria.titulo,
          );
          const created = await tx.empresasVagas.create({
            data: sanitizeCreateData(dataComCategoria as any, codigo, slug, statusInicial),
          });

          if (shouldHighlight && !recursosPremiumAtivos) {
            if (!planoAtivo) {
              throw new EmpresaSemPlanoAtivoError();
            }

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

        await registrarHistoricoVaga({
          vagaId: vaga.id,
          usuarioId: options?.actorId ?? data.usuarioId,
          acao: 'VAGA_CRIADA',
          descricao:
            statusInicial === StatusDeVagas.EM_ANALISE
              ? 'Vaga criada e enviada para aprovação'
              : statusInicial === StatusDeVagas.PUBLICADO
                ? 'Vaga criada e publicada (recursos premium)'
                : 'Vaga criada como rascunho (limite do plano)',
          para: statusInicial,
        });
        const vagaDoAviso = { id: vaga.id, usuarioId: vaga.usuarioId, titulo: vaga.titulo };
        if (statusInicial === StatusDeVagas.PUBLICADO) {
          await avisosDaVaga.publicadaDireto(vagaDoAviso);
        } else if (statusInicial === StatusDeVagas.RASCUNHO && ocupacao) {
          await avisosDaVaga.limiteNoCadastro(vagaDoAviso, ocupacao);
        } else {
          await avisosDaVaga.emAnalise(vagaDoAviso, 'CADASTRADA');
          await atualizarAvisoDaFila({
            novaVaga: { ...vagaDoAviso, empresaNome: vaga.Usuarios?.nomeCompleto },
            motivo: 'CADASTRADA',
            atorId: options?.actorId,
          });
          if (ocupacao?.limite && ocupacao.emUso + 1 >= ocupacao.limite) {
            await avisosDaVaga.planoCompleto(vagaDoAviso, ocupacao.limite);
          }
        }
        return { ...transformVaga(vaga, { interno: true }), avisoStatus };
      } catch (error) {
        if (isUniqueConstraintForField(error, 'slug')) {
          continue;
        }

        throw error;
      }
    }

    throw new VagaSlugDuplicadoError();
  },

  /**
   * Edição. Quando é a empresa editando: só a própria vaga, sem mexer em status, dono ou
   * data de publicação; e vaga publicada que for editada sai do ar e volta para a fila de
   * aprovação do setor de vagas (o conteúdo novo precisa ser aprovado de novo).
   */
  update: async (
    id: string,
    dadosRecebidos: UpdateVagaData,
    opcoes?: { ator?: { id: string; role?: string | null } },
  ) => {
    const vagaAtual = await prisma.empresasVagas.findUnique({
      where: { id },
      include: { EmpresasVagasDestaque: true },
    });

    const ator = opcoes?.ator;
    const editadaPelaEmpresa = ator?.role === Roles.EMPRESA;

    if (!vagaAtual || (editadaPelaEmpresa && vagaAtual.usuarioId !== ator!.id)) {
      throw Object.assign(new Error('Vaga não encontrada'), { code: 'P2025' });
    }

    let data = dadosRecebidos;
    let voltaParaAnalise = false;
    if (editadaPelaEmpresa) {
      if (STATUS_SEM_EDICAO_PELA_EMPRESA.includes(vagaAtual.status)) {
        throw erroVaga(
          'VAGA_NAO_EDITAVEL',
          'Vagas encerradas ou expiradas não podem ser editadas. Crie uma nova vaga.',
          409,
        );
      }
      const {
        status: _status,
        usuarioId: _usuarioId,
        inseridaEm: _inseridaEm,
        ...camposEditaveis
      } = dadosRecebidos;
      if (!Object.values(camposEditaveis).some((valor) => valor !== undefined)) {
        throw erroVaga(
          'VALIDATION_ERROR',
          'Informe ao menos um campo para atualização da vaga',
          400,
        );
      }
      voltaParaAnalise = vagaAtual.status === StatusDeVagas.PUBLICADO;
      data = {
        ...camposEditaveis,
        ...(voltaParaAnalise ? { status: StatusDeVagas.EM_ANALISE } : {}),
      };
    }

    const areaUpdate = await resolveAreaSubareaUpdate(vagaAtual, data);
    const dataParaAtualizar: UpdateVagaData = areaUpdate ? { ...data, ...areaUpdate } : data;

    const novoUsuarioId = data.usuarioId ?? vagaAtual.usuarioId;
    const shouldActivateHighlight = data.vagaEmDestaque === true && !vagaAtual.destaque;
    const shouldDeactivateHighlight = data.vagaEmDestaque === false && vagaAtual.destaque;
    const manterHighlightAtivo = vagaAtual.destaque && !shouldDeactivateHighlight;
    const shouldReassignHighlightPlan = manterHighlightAtivo && data.usuarioId !== undefined;
    const recursosPremiumAtivos = await hasRecursosPremiumVagasAtivos(novoUsuarioId);

    let planoAtivo: PlanoAtivo = null;
    let limiteDestaque: number | null = null;

    if (!recursosPremiumAtivos && (shouldActivateHighlight || shouldReassignHighlightPlan)) {
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

      if (recursosPremiumAtivos && (shouldActivateHighlight || shouldReassignHighlightPlan)) {
        await tx.empresasVagasDestaque.updateMany({
          where: { vagaId: atualizada.id },
          data: { ativo: false, desativadoEm: new Date() },
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

    const vagaDoAviso = { id: vaga.id, usuarioId: vaga.usuarioId, titulo: vaga.titulo };
    if (voltaParaAnalise) {
      await avisosDaVaga.emAnalise(vagaDoAviso, 'EDITADA');
      await atualizarAvisoDaFila({
        novaVaga: { ...vagaDoAviso, empresaNome: vaga.Usuarios?.nomeCompleto },
        motivo: 'EDITADA',
        atorId: ator?.id,
      });
    } else if (!editadaPelaEmpresa && vaga.status !== vagaAtual.status) {
      await avisosDaVaga.situacaoAlteradaPelaEquipe(vagaDoAviso, vaga.status);
      if (
        vaga.status === StatusDeVagas.EM_ANALISE ||
        vagaAtual.status === StatusDeVagas.EM_ANALISE
      ) {
        await atualizarAvisoDaFila({});
      }
    }

    await registrarHistoricoVaga({
      vagaId: id,
      usuarioId: ator?.id ?? null,
      acao: 'VAGA_EDITADA',
      descricao: voltaParaAnalise
        ? 'Vaga publicada editada pela empresa: saiu do ar e voltou para aprovação'
        : 'Vaga editada',
      de: vagaAtual.status,
      para: vaga.status,
      metadata: {
        campos: Object.keys(data).filter((campo) => (data as any)[campo] !== undefined),
      },
    });

    return {
      ...transformVaga(vaga, { interno: true }),
      avisoStatus: voltaParaAnalise
        ? 'Alterações salvas. A vaga saiu do ar e voltou para a aprovação do setor de vagas.'
        : null,
    };
  },

  remove: (id: string) => prisma.empresasVagas.delete({ where: { id } }),

  /**
   * Rascunho (ou despublicada) → fila de aprovação. Confere dono, plano ativo e limite
   * do plano (publicadas + em análise). Recursos premium publicam direto.
   */
  enviarParaAnalise: async (id: string, ator: { id: string; role?: string | null }) => {
    const vaga = await carregarVagaDoAtor(id, ator);
    if (vaga.status === StatusDeVagas.EM_ANALISE) {
      throw erroVaga('VAGA_JA_EM_ANALISE', 'Esta vaga já está aguardando aprovação.', 409);
    }
    if (vaga.status === StatusDeVagas.PUBLICADO) {
      throw erroVaga('VAGA_JA_PUBLICADA', 'Esta vaga já está publicada.', 409);
    }
    const permitidos: StatusDeVagas[] = [StatusDeVagas.RASCUNHO, StatusDeVagas.DESPUBLICADA];
    if (!permitidos.includes(vaga.status)) {
      throw erroVaga(
        'VAGA_STATUS_INVALIDO',
        'Esta vaga não pode ser enviada para aprovação na situação atual.',
        409,
      );
    }

    const premium = await hasRecursosPremiumVagasAtivos(vaga.usuarioId);
    let novoStatus: StatusDeVagas = StatusDeVagas.EM_ANALISE;
    let ocupacao: Awaited<ReturnType<typeof ocupacaoDoPlano>> | null = null;
    const vagaDoAviso = { id: vaga.id, usuarioId: vaga.usuarioId, titulo: vaga.titulo };
    if (premium) {
      novoStatus = StatusDeVagas.PUBLICADO;
    } else {
      const plano = canBypassPlanoAtivo(ator.role)
        ? undefined
        : await ensurePlanoAtivoParaUsuario(vaga.usuarioId);
      ocupacao = await ocupacaoDoPlano(vaga.usuarioId, plano);
      if (ocupacao.cheio) {
        await avisosDaVaga.limiteNoEnvio(vagaDoAviso, ocupacao);
        throw Object.assign(erroVaga('LIMITE_VAGAS_PLANO', mensagemLimiteDoPlano(ocupacao), 409), {
          limite: ocupacao.limite,
          emUso: ocupacao.emUso,
        });
      }
    }

    const atualizada = await prisma.empresasVagas.update({
      where: { id },
      data: {
        status: novoStatus,
        // Reenvio: o motivo da rejeição anterior sai da vaga (continua no histórico)
        motivoRejeicao: null,
        ...(novoStatus === StatusDeVagas.PUBLICADO ? { inseridaEm: new Date() } : {}),
      },
      ...includeEmpresa,
    });
    await registrarHistoricoVaga({
      vagaId: id,
      usuarioId: ator.id,
      acao: 'VAGA_ENVIADA_PARA_ANALISE',
      descricao:
        novoStatus === StatusDeVagas.PUBLICADO
          ? 'Vaga publicada direto (recursos premium)'
          : 'Vaga enviada para aprovação do setor de vagas',
      de: vaga.status,
      para: novoStatus,
    });
    if (novoStatus === StatusDeVagas.PUBLICADO) {
      await avisosDaVaga.publicadaDireto(vagaDoAviso);
    } else {
      await avisosDaVaga.emAnalise(vagaDoAviso, 'ENVIADA');
      await atualizarAvisoDaFila({
        novaVaga: { ...vagaDoAviso, empresaNome: atualizada.Usuarios?.nomeCompleto },
        motivo: 'ENVIADA',
        atorId: ator.id,
      });
      if (ocupacao?.limite && ocupacao.emUso + 1 >= ocupacao.limite) {
        await avisosDaVaga.planoCompleto(vagaDoAviso, ocupacao.limite);
      }
    }
    return transformVaga(atualizada, { interno: true });
  },

  /** Publicada → despublicada; em análise → volta a rascunho. Libera espaço no plano. */
  despublicar: async (id: string, ator: { id: string; role?: string | null }) => {
    const vaga = await carregarVagaDoAtor(id, ator);
    const destino =
      vaga.status === StatusDeVagas.PUBLICADO
        ? StatusDeVagas.DESPUBLICADA
        : vaga.status === StatusDeVagas.EM_ANALISE
          ? StatusDeVagas.RASCUNHO
          : null;
    if (!destino) {
      throw erroVaga(
        'VAGA_STATUS_INVALIDO',
        'Só vagas publicadas ou aguardando aprovação podem ser despublicadas.',
        409,
      );
    }
    const atualizada = await prisma.empresasVagas.update({
      where: { id },
      data: { status: destino },
      ...includeEmpresa,
    });
    await registrarHistoricoVaga({
      vagaId: id,
      usuarioId: ator.id,
      acao: destino === StatusDeVagas.RASCUNHO ? 'VAGA_ENVIO_CANCELADO' : 'VAGA_DESPUBLICADA',
      descricao:
        destino === StatusDeVagas.RASCUNHO
          ? 'Envio para aprovação cancelado (voltou a rascunho)'
          : 'Vaga despublicada',
      de: vaga.status,
      para: destino,
    });
    if (vaga.status === StatusDeVagas.EM_ANALISE) {
      await atualizarAvisoDaFila({});
    }
    if (destino === StatusDeVagas.DESPUBLICADA) {
      await avisosDaVaga.despublicada(
        { id: vaga.id, usuarioId: vaga.usuarioId, titulo: vaga.titulo },
        ator.role !== Roles.EMPRESA,
      );
    }
    return transformVaga(atualizada, { interno: true });
  },

  /** Excluir de vez só a própria vaga e só sem candidatos (com candidatos: despublique) */
  removerComRegras: async (id: string, ator: { id: string; role?: string | null }) => {
    const vaga = await carregarVagaDoAtor(id, ator);
    if (vaga._count.EmpresasCandidatos > 0) {
      throw erroVaga(
        'VAGA_COM_CANDIDATOS',
        'Esta vaga já tem candidatos e não pode ser excluída. Despublique ou encerre a vaga.',
        409,
      );
    }
    await prisma.empresasVagas.delete({ where: { id } });
    if (vaga.status === StatusDeVagas.EM_ANALISE) {
      await atualizarAvisoDaFila({});
    }
    await registrarHistoricoVaga({
      vagaId: id,
      usuarioId: ator.id,
      acao: 'VAGA_EXCLUIDA',
      descricao: `Vaga ${vaga.codigo} excluída`,
      de: vaga.status,
      metadata: { codigo: vaga.codigo, titulo: vaga.titulo },
    });
  },
};
