import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

import {
  AcoesDeLogDeBloqueio,
  EmpresasPlanoModo,
  EmpresasPlanoOrigin,
  EmpresasPlanoStatus,
  METODO_PAGAMENTO,
  MODELO_PAGAMENTO,
  STATUS_PAGAMENTO,
  ModalidadesDeVagas,
  MotivosDeBloqueios,
  Prisma,
  Jornadas,
  Roles,
  RegimesDeTrabalhos,
  Senioridade,
  Status,
  StatusDeBloqueios,
  StatusDeVagas,
  StatusProcesso,
  TiposDeBloqueios,
  TiposDeUsuarios,
} from '@prisma/client';

import { serverConfig } from '@/config/env';
import { prisma } from '@/config/prisma';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import { LimiteVagasPlanoAtingidoError } from '@/modules/empresas/vagas/services/errors';
import { calcularFim } from '@/modules/empresas/shared/planos';
import { EmailService } from '@/modules/brevo/services/email-service';
import { EmailTemplates } from '@/modules/brevo/templates/email-templates';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import type { UsuarioEnderecoDto } from '@/modules/usuarios/utils/address';
import {
  mapUsuarioInformacoes,
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import type { UsuarioSocialLinks } from '@/modules/usuarios/utils/types';
import {
  buildSocialLinksCreateData,
  buildSocialLinksUpdateData,
  extractSocialLinksFromPayload,
  mapSocialLinks,
  sanitizeSocialLinks,
  usuarioRedesSociaisSelect,
} from '@/modules/usuarios/utils/social-links';
import type {
  AdminEmpresasBloqueioInput,
  AdminEmpresasDashboardListQuery,
  AdminEmpresasCreateInput,
  AdminEmpresasHistoryQuery,
  AdminEmpresasListQuery,
  AdminEmpresasPlanoInput,
  AdminEmpresasPlanoManualAssignInput,
  AdminEmpresasPlanoUpdateInput,
  AdminEmpresasUpdateInput,
  AdminEmpresasVagasQuery,
} from '@/modules/empresas/admin/validators/admin-empresas.schema';

const createPlanoAtivoSelect = () =>
  ({
    where: {
      status: EmpresasPlanoStatus.ATIVO,
      OR: [{ fim: null }, { fim: { gt: new Date() } }],
    },
    orderBy: [{ inicio: 'desc' }, { criadoEm: 'desc' }],
    take: 1,
    select: {
      id: true,
      modo: true,
      status: true,
      inicio: true,
      fim: true,
      criadoEm: true,
      atualizadoEm: true,
      modeloPagamento: true,
      metodoPagamento: true,
      statusPagamento: true,
      plano: {
        select: {
          id: true,
          nome: true,
          valor: true,
          quantidadeVagas: true,
        },
      },
    },
  }) satisfies Prisma.Usuarios$planosContratadosArgs;

const planoHistoricoSelect = {
  id: true,
  modo: true,
  status: true,
  origin: true,
  inicio: true,
  fim: true,
  criadoEm: true,
  atualizadoEm: true,
  modeloPagamento: true,
  metodoPagamento: true,
  statusPagamento: true,
  proximaCobranca: true,
  graceUntil: true,
  plano: {
    select: {
      id: true,
      nome: true,
      valor: true,
      quantidadeVagas: true,
    },
  },
} satisfies Prisma.EmpresasPlanoSelect;

const bloqueioSelect = {
  id: true,
  tipo: true,
  motivo: true,
  status: true,
  inicio: true,
  fim: true,
  observacoes: true,
  criadoEm: true,
  atualizadoEm: true,
  aplicadoPor: {
    select: {
      id: true,
      nomeCompleto: true,
      role: true,
    },
  },
  usuario: {
    select: {
      id: true,
      nomeCompleto: true,
      role: true,
      tipoUsuario: true,
    },
  },
} satisfies Prisma.UsuariosEmBloqueiosSelect;

const createUsuarioListSelect = () =>
  ({
    id: true,
    codUsuario: true,
    nomeCompleto: true,
    email: true,
    cnpj: true,
    criadoEm: true,
    status: true,
    informacoes: {
      select: usuarioInformacoesSelect,
    },
    planosContratados: createPlanoAtivoSelect(),
    bloqueiosRecebidos: {
      where: {
        status: StatusDeBloqueios.ATIVO,
        OR: [{ fim: null }, { fim: { gt: new Date() } }],
      },
      orderBy: [{ fim: 'desc' }, { criadoEm: 'desc' }],
      take: 1,
      select: bloqueioSelect,
    },
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
    _count: {
      select: {
        vagasCriadas: {
          where: {
            status: StatusDeVagas.PUBLICADO,
          },
        },
      },
    },
  }) satisfies Prisma.UsuariosSelect;

const createUsuarioDashboardSelect = () =>
  ({
    id: true,
    codUsuario: true,
    nomeCompleto: true,
    email: true,
    cnpj: true,
    status: true,
    criadoEm: true,
    informacoes: {
      select: {
        telefone: true,
        avatarUrl: true,
      },
    },
    planosContratados: createPlanoAtivoSelect(),
    bloqueiosRecebidos: {
      where: {
        status: StatusDeBloqueios.ATIVO,
        OR: [{ fim: null }, { fim: { gt: new Date() } }],
      },
      orderBy: [{ fim: 'desc' }, { criadoEm: 'desc' }],
      take: 1,
      select: bloqueioSelect,
    },
    _count: {
      select: {
        vagasCriadas: {
          where: {
            status: StatusDeVagas.PUBLICADO,
          },
        },
      },
    },
  }) satisfies Prisma.UsuariosSelect;

const usuarioDetailSelect = {
  id: true,
  codUsuario: true,
  nomeCompleto: true,
  email: true,
  cnpj: true,
  ...usuarioRedesSociaisSelect,
  criadoEm: true,
  tipoUsuario: true,
  status: true,
  ultimoLogin: true,
  informacoes: {
    select: usuarioInformacoesSelect,
  },
  planosContratados: createPlanoAtivoSelect(),
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
  _count: {
    select: {
      vagasCriadas: {
        where: {
          status: StatusDeVagas.PUBLICADO,
        },
      },
    },
  },
} satisfies Prisma.UsuariosSelect;

const vagaSelect = {
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
  numeroVagas: true,
  descricao: true,
  jornada: true,
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
} satisfies Prisma.EmpresasVagasSelect;

type UsuarioListSelect = ReturnType<typeof createUsuarioListSelect>;
type UsuarioListResult = Prisma.UsuariosGetPayload<{ select: UsuarioListSelect }>;
type PlanoResumoData = UsuarioListResult['planosContratados'][number];
type PlanoHistoricoRecord = Prisma.EmpresasPlanoGetPayload<{ select: typeof planoHistoricoSelect }>;
type BloqueioResumoData = Prisma.UsuariosEmBloqueiosGetPayload<{
  select: typeof bloqueioSelect;
}>;
type VagaRecord = Prisma.EmpresasVagasGetPayload<{ select: typeof vagaSelect }>;

type AdminEmpresasPlanoPaymentFields = {
  modeloPagamento?: MODELO_PAGAMENTO | null;
  metodoPagamento?: METODO_PAGAMENTO | null;
  statusPagamento?: STATUS_PAGAMENTO | null;
  proximaCobranca?: Date | null;
  graceUntil?: Date | null;
};

type AdminEmpresasPlanoPersistInput = AdminEmpresasPlanoInput & AdminEmpresasPlanoPaymentFields;

const mapPlanoPagamentoData = (plano: AdminEmpresasPlanoPaymentFields) => {
  const data: Record<string, unknown> = {};

  if (plano.modeloPagamento !== undefined) {
    data.modeloPagamento = plano.modeloPagamento;
  }

  if (plano.metodoPagamento !== undefined) {
    data.metodoPagamento = plano.metodoPagamento;
  }

  if (plano.statusPagamento !== undefined) {
    data.statusPagamento = plano.statusPagamento;
  }

  if (plano.proximaCobranca !== undefined) {
    data.proximaCobranca = plano.proximaCobranca;
  }

  if (plano.graceUntil !== undefined) {
    data.graceUntil = plano.graceUntil;
  }

  return data;
};

type AdminEmpresasPlanoResumo = {
  id: string;
  nome: string | null;
  modo: EmpresasPlanoModo | null;
  status: EmpresasPlanoStatus | null;
  inicio: Date | null;
  fim: Date | null;
  modeloPagamento: MODELO_PAGAMENTO | null;
  metodoPagamento: METODO_PAGAMENTO | null;
  statusPagamento: STATUS_PAGAMENTO | null;
  valor: string | null;
  quantidadeVagas: number | null;
  duracaoEmDias: number | null;
  diasRestantes: number | null;
};

type AdminEmpresaPlanoHistoricoItem = AdminEmpresasPlanoResumo & {
  origin: EmpresasPlanoOrigin;
  criadoEm: Date;
  atualizadoEm: Date;
  proximaCobranca: Date | null;
  graceUntil: Date | null;
};

type AdminEmpresaListItem = {
  id: string;
  codUsuario: string;
  nome: string;
  email: string;
  telefone: string;
  avatarUrl: string | null;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  enderecos: UsuarioEnderecoDto[];
  criadoEm: Date;
  ativa: boolean;
  parceira: boolean;
  diasTesteDisponibilizados: number | null;
  plano: AdminEmpresasPlanoResumo | null;
  vagasPublicadas: number;
  limiteVagasPlano: number | null;
  bloqueada: boolean;
  bloqueioAtivo: AdminUsuariosEmBloqueiosResumo | null;
  informacoes: ReturnType<typeof mapUsuarioInformacoes>;
};

type AdminEmpresasDashboardListItem = {
  id: string;
  codUsuario: string;
  nome: string;
  email: string;
  telefone: string | null;
  avatarUrl: string | null;
  cnpj: string | null;
  status: Status;
  criadoEm: Date;
  vagasPublicadas: number;
  limiteVagasPlano: number | null;
  plano: AdminEmpresasPlanoResumo | null;
  bloqueada: boolean;
  bloqueioAtivo: AdminUsuariosEmBloqueiosResumo | null;
};

type AdminUsuariosBloqueioAlvo = {
  id: string;
  tipo: 'EMPRESA' | 'USUARIO' | 'ESTUDANTE';
  nome: string;
  role: Roles;
};

type AdminUsuariosBloqueioAplicadoPor = {
  id: string;
  nome: string;
  role: Roles;
};

type AdminUsuariosBloqueioDados = {
  tipo: TiposDeBloqueios;
  motivo: MotivosDeBloqueios;
  status: StatusDeBloqueios;
  inicio: Date;
  fim: Date | null;
  observacoes: string | null;
};

type AdminUsuariosBloqueioAuditoria = {
  criadoEm: Date;
  atualizadoEm: Date;
};

type AdminUsuariosEmBloqueiosResumo = {
  id: string;
  alvo: AdminUsuariosBloqueioAlvo;
  bloqueio: AdminUsuariosBloqueioDados;
  aplicadoPor: AdminUsuariosBloqueioAplicadoPor | null;
  auditoria: AdminUsuariosBloqueioAuditoria;
};

type AdminEmpresaPaymentLog = {
  id: string;
  tipo: string;
  status: string | null;
  mensagem: string | null;
  externalRef: string | null;
  mpResourceId: string | null;
  criadoEm: Date;
  plano: {
    id: string | null;
    nome: string | null;
  } | null;
};

type AdminEmpresaJobResumo = {
  id: string;
  codigo: string;
  slug: string;
  titulo: string;
  status: StatusDeVagas;
  inseridaEm: Date;
  atualizadoEm: Date;
  inscricoesAte: Date | null;
  modoAnonimo: boolean;
  modalidade: ModalidadesDeVagas;
  regimeDeTrabalho: RegimesDeTrabalhos;
  paraPcd: boolean;
  senioridade: Senioridade;
  numeroVagas: number;
  descricao: string | null;
  jornada: Jornadas;
  requisitos: Prisma.JsonValue;
  atividades: Prisma.JsonValue;
  beneficios: Prisma.JsonValue;
  observacoes: string | null;
  localizacao: Prisma.JsonValue | null;
  salarioMin: Prisma.Decimal | null;
  salarioMax: Prisma.Decimal | null;
  salarioConfidencial: boolean;
  maxCandidaturasPorUsuario: number | null;
  areaInteresseId: number | null;
  subareaInteresseId: number | null;
  areaInteresse: {
    id: number;
    categoria: string;
  } | null;
  subareaInteresse: {
    id: number;
    nome: string;
    areaId: number;
  } | null;
  vagaEmDestaque: boolean;
  destaqueInfo: {
    empresasPlanoId: string;
    ativo: boolean;
    ativadoEm: Date;
    desativadoEm: Date | null;
  } | null;
};

type AdminEmpresaDetail = {
  id: string;
  codUsuario: string;
  nome: string;
  email: string;
  telefone: string;
  avatarUrl: string | null;
  cnpj: string | null;
  descricao: string | null;
  socialLinks: UsuarioSocialLinks | null;
  cidade: string | null;
  estado: string | null;
  enderecos: UsuarioEnderecoDto[];
  criadoEm: Date;
  status: Status;
  ultimoLogin: Date | null;
  ativa: boolean;
  parceira: boolean;
  diasTesteDisponibilizados: number | null;
  plano: AdminEmpresasPlanoResumo | null;
  vagas: {
    publicadas: number;
    limitePlano: number | null;
  };
  bloqueada: boolean;
  pagamento: {
    modelo: MODELO_PAGAMENTO | null;
    metodo: METODO_PAGAMENTO | null;
    status: STATUS_PAGAMENTO | null;
    ultimoPagamentoEm: Date | null;
  };
  bloqueioAtivo: AdminUsuariosEmBloqueiosResumo | null;
  informacoes: ReturnType<typeof mapUsuarioInformacoes>;
};

type AdminEmpresaOverview = {
  empresa: AdminEmpresaDetail;
  planos: {
    ativos: AdminEmpresaPlanoHistoricoItem[];
    historico: AdminEmpresaPlanoHistoricoItem[];
  };
  pagamentos: {
    total: number;
    recentes: AdminEmpresaPaymentLog[];
  };
  vagas: {
    total: number;
    porStatus: Record<StatusDeVagas, number>;
    recentes: AdminEmpresaJobResumo[];
  };
  candidaturas: {
    total: number;
    porStatus: Record<StatusProcesso, number>;
  };
  bloqueios: {
    ativos: AdminUsuariosEmBloqueiosResumo[];
    historico: AdminUsuariosEmBloqueiosResumo[];
  };
};

const sanitizeOptionalValue = (value?: string | null) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeEmail = (email: string) => email.trim().toLowerCase();
const sanitizeNome = (nome: string) => nome.trim();
const sanitizeTelefone = (telefone: string) => telefone.trim();
const sanitizeSupabaseId = (supabaseId: string) => supabaseId.trim();
const sanitizeSenha = async (senha: string) => bcrypt.hash(senha, 12);
const normalizeDocumento = (value: string) => value.replace(/\D/g, '');
const formatCnpj = (value: string) =>
  value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

const formatCpf = (value: string) => value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

const isValidCnpj = (value: string) => {
  if (value.length !== 14) {
    return false;
  }

  if (/^(\d)\1{13}$/.test(value)) {
    return false;
  }

  const calculateDigit = (size: number) => {
    let sum = 0;
    let position = size - 7;

    for (let i = size; i >= 1; i--) {
      const index = size - i;
      sum += Number(value.charAt(index)) * position--;
      if (position < 2) {
        position = 9;
      }
    }

    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const firstDigit = calculateDigit(12);
  if (firstDigit !== Number(value.charAt(12))) {
    return false;
  }

  const secondDigit = calculateDigit(13);
  return secondDigit === Number(value.charAt(13));
};

const isValidCpf = (value: string) => {
  if (value.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(value)) {
    return false;
  }

  const calculateDigit = (factor: number) => {
    let total = 0;

    for (let i = 0; i < factor - 1; i++) {
      total += Number(value.charAt(i)) * (factor - i);
    }

    const mod = (total * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const firstDigit = calculateDigit(10);
  if (firstDigit !== Number(value.charAt(9))) {
    return false;
  }

  const secondDigit = calculateDigit(11);
  return secondDigit === Number(value.charAt(10));
};

const PASSWORD_UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PASSWORD_LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const PASSWORD_DIGITS = '0123456789';
const PASSWORD_SPECIAL = '!@#$%&*?';
const PASSWORD_ALPHABET =
  PASSWORD_UPPERCASE + PASSWORD_LOWERCASE + PASSWORD_DIGITS + PASSWORD_SPECIAL;
const DEFAULT_ADMIN_PASSWORD_LENGTH = 12;

const getSecureRandomInt = (max: number) => {
  if (max <= 0) {
    throw new Error('max must be greater than 0');
  }

  const limit = 256 - (256 % max);
  let randomNumber = 0;

  do {
    randomNumber = randomBytes(1)[0];
  } while (randomNumber >= limit);

  return randomNumber % max;
};

const getRandomChar = (alphabet: string) => alphabet[getSecureRandomInt(alphabet.length)];

const shuffleArray = <T>(items: T[]) => {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
};

const generateSecurePassword = (length = DEFAULT_ADMIN_PASSWORD_LENGTH) => {
  const targetLength = Math.max(length, 8);
  const requiredChars = [
    getRandomChar(PASSWORD_UPPERCASE),
    getRandomChar(PASSWORD_LOWERCASE),
    getRandomChar(PASSWORD_DIGITS),
    getRandomChar(PASSWORD_SPECIAL),
  ];
  const remainingLength = targetLength - requiredChars.length;

  for (let i = 0; i < remainingLength; i++) {
    requiredChars.push(getRandomChar(PASSWORD_ALPHABET));
  }

  return shuffleArray(requiredChars).join('');
};

// removed: observação e cálculo por TiposDePlanos (modelo migrado para modo/status)

const upsertEnderecoPrincipal = async (
  tx: Prisma.TransactionClient,
  usuarioId: string,
  endereco: { cidade?: string | null; estado?: string | null },
) => {
  const dataToUpdate: Prisma.UsuariosEnderecosUpdateInput = {};
  const dataToCreate: Prisma.UsuariosEnderecosUncheckedCreateInput = { usuarioId };

  let hasDefinedField = false;
  let hasCreateValue = false;

  if (endereco.cidade !== undefined) {
    dataToUpdate.cidade = endereco.cidade;
    dataToCreate.cidade = endereco.cidade ?? null;
    hasDefinedField = true;
    if (endereco.cidade && endereco.cidade.length > 0) {
      hasCreateValue = true;
    }
  }

  if (endereco.estado !== undefined) {
    dataToUpdate.estado = endereco.estado;
    dataToCreate.estado = endereco.estado ?? null;
    hasDefinedField = true;
    if (endereco.estado && endereco.estado.length > 0) {
      hasCreateValue = true;
    }
  }

  if (!hasDefinedField) {
    return;
  }

  const principalEndereco = await tx.usuariosEnderecos.findFirst({
    where: { usuarioId },
    orderBy: { criadoEm: 'asc' },
  });

  if (principalEndereco) {
    await tx.usuariosEnderecos.update({
      where: { id: principalEndereco.id },
      data: dataToUpdate,
    });
    return;
  }

  if (!hasCreateValue) {
    return;
  }

  await tx.usuariosEnderecos.create({
    data: dataToCreate,
  });
};

const generateCodePrefix = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let prefix = '';

  for (let i = 0; i < 3; i++) {
    const index = Math.floor(Math.random() * letters.length);
    prefix += letters[index];
  }

  return prefix;
};

const generateUniqueEmpresaCode = async (tx: Prisma.TransactionClient): Promise<string> => {
  const prefix = generateCodePrefix();

  for (let attempt = 0; attempt < 10; attempt++) {
    const random = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}${random}`;
    const existing = await tx.usuarios.findUnique({
      where: { codUsuario: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${prefix}${Date.now().toString().slice(-6)}`;
};

const assignPlanoToEmpresa = async (
  tx: Prisma.TransactionClient,
  usuarioId: string,
  plano: AdminEmpresasPlanoPersistInput,
) => {
  const modo = plano.modo ?? EmpresasPlanoModo.CLIENTE;
  const inicio = plano.iniciarEm ?? new Date();
  const fim = calcularFim(
    modo,
    inicio,
    plano.diasTeste ?? undefined,
    plano.proximaCobranca ?? undefined,
    plano.graceUntil ?? undefined,
  );
  const status = EmpresasPlanoStatus.ATIVO;

  const pagamentoData = mapPlanoPagamentoData(plano);

  await tx.empresasPlano.updateMany({
    where: { usuarioId, status: EmpresasPlanoStatus.ATIVO },
    data: { status: EmpresasPlanoStatus.CANCELADO, fim: new Date() },
  });

  await tx.empresasPlano.create({
    data: {
      usuarioId,
      planosEmpresariaisId: plano.planosEmpresariaisId,
      modo,
      status,
      origin: 'ADMIN',
      inicio,
      fim,
      ...pagamentoData,
    },
  });
};

const atualizarPlanoSemReset = async (
  tx: Prisma.TransactionClient,
  usuarioId: string,
  plano: AdminEmpresasPlanoPersistInput,
) => {
  const planoAtual = await tx.empresasPlano.findFirst({
    where: { usuarioId, status: EmpresasPlanoStatus.ATIVO },
    orderBy: [{ inicio: 'desc' }, { criadoEm: 'desc' }],
  });

  if (!planoAtual) {
    await assignPlanoToEmpresa(tx, usuarioId, plano);
    return;
  }

  const modo = plano.modo ?? planoAtual.modo;
  const data: Prisma.EmpresasPlanoUpdateInput = {
    plano: { connect: { id: plano.planosEmpresariaisId } },
    modo,
    ...mapPlanoPagamentoData(plano),
  };

  const shouldRecalculateFim =
    plano.modo !== undefined ||
    plano.diasTeste !== undefined ||
    plano.proximaCobranca !== undefined ||
    plano.graceUntil !== undefined;

  if (shouldRecalculateFim) {
    const proximaCobranca =
      plano.proximaCobranca !== undefined
        ? plano.proximaCobranca
        : planoAtual.proximaCobranca ?? undefined;
    const graceUntil =
      plano.graceUntil !== undefined ? plano.graceUntil : planoAtual.graceUntil ?? undefined;

    data.fim = calcularFim(
      modo,
      planoAtual.inicio ?? null,
      plano.diasTeste ?? undefined,
      proximaCobranca,
      graceUntil,
    );
  }

  await tx.empresasPlano.update({
    where: { id: planoAtual.id },
    data,
  });
};

type PrismaUsuarioClient = Pick<Prisma.TransactionClient, 'usuarios'>;

const ensureEmpresaExiste = async (db: PrismaUsuarioClient, id: string) => {
  const empresa = await db.usuarios.findUnique({
    where: { id },
    select: {
      id: true,
      tipoUsuario: true,
      nomeCompleto: true,
      role: true,
    },
  });

  if (!empresa || empresa.tipoUsuario !== TiposDeUsuarios.PESSOA_JURIDICA) {
    throw Object.assign(new Error('Empresa não encontrada'), { code: 'EMPRESA_NOT_FOUND' });
  }

  return empresa;
};

const buildSearchFilter = (search?: string): Prisma.UsuariosWhereInput => {
  if (!search) {
    return {};
  }

  return {
    OR: [
      { nomeCompleto: { contains: search, mode: 'insensitive' } },
      { codUsuario: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { cnpj: { contains: search, mode: 'insensitive' } },
    ],
  };
};

const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

const calculateDurationInDays = (inicio: Date | null, fim: Date | null) => {
  if (!inicio || !fim) {
    return null;
  }

  const diff = fim.getTime() - inicio.getTime();

  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / MILLISECONDS_IN_DAY);
};

const calculateDaysRemaining = (fim: Date | null, reference: Date) => {
  if (!fim) {
    return null;
  }

  const diff = fim.getTime() - reference.getTime();

  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / MILLISECONDS_IN_DAY);
};

const mapPlanoResumo = (
  plano?: PlanoResumoData,
  referenceDate: Date = new Date(),
): AdminEmpresasPlanoResumo | null => {
  if (!plano) {
    return null;
  }

  const inicio = plano.inicio ?? null;
  const fim = plano.fim ?? null;

  return {
    id: plano.id,
    nome: plano.plano?.nome ?? null,
    modo: plano.modo ?? null,
    status: plano.status ?? null,
    inicio,
    fim,
    modeloPagamento: plano.modeloPagamento ?? null,
    metodoPagamento: plano.metodoPagamento ?? null,
    statusPagamento: plano.statusPagamento ?? null,
    valor: plano.plano?.valor ?? null,
    quantidadeVagas: plano.plano?.quantidadeVagas ?? null,
    duracaoEmDias: calculateDurationInDays(inicio, fim),
    diasRestantes: calculateDaysRemaining(fim, referenceDate),
  };
};

const mapPlanoHistorico = (
  plano: PlanoHistoricoRecord,
  referenceDate: Date = new Date(),
): AdminEmpresaPlanoHistoricoItem => {
  const resumo = mapPlanoResumo(plano as unknown as PlanoResumoData, referenceDate) ?? {
    id: plano.id,
    nome: plano.plano?.nome ?? null,
    modo: plano.modo ?? null,
    status: plano.status ?? null,
    inicio: plano.inicio ?? null,
    fim: plano.fim ?? null,
    modeloPagamento: plano.modeloPagamento ?? null,
    metodoPagamento: plano.metodoPagamento ?? null,
    statusPagamento: plano.statusPagamento ?? null,
    valor: plano.plano?.valor ?? null,
    quantidadeVagas: plano.plano?.quantidadeVagas ?? null,
    duracaoEmDias: calculateDurationInDays(plano.inicio ?? null, plano.fim ?? null),
    diasRestantes: calculateDaysRemaining(plano.fim ?? null, referenceDate),
  };

  return {
    ...resumo,
    origin: plano.origin,
    criadoEm: plano.criadoEm,
    atualizadoEm: plano.atualizadoEm,
    proximaCobranca: plano.proximaCobranca ?? null,
    graceUntil: plano.graceUntil ?? null,
  };
};

const mapBloqueioResumo = (
  bloqueio: BloqueioResumoData | null,
): AdminUsuariosEmBloqueiosResumo | null => {
  if (!bloqueio || !bloqueio.usuario) {
    return null;
  }

  const alvoTipo: AdminUsuariosBloqueioAlvo['tipo'] =
    bloqueio.usuario.tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA
      ? 'EMPRESA'
      : bloqueio.usuario.tipoUsuario === TiposDeUsuarios.PESSOA_FISICA
        ? 'USUARIO'
        : 'ESTUDANTE';

  const aplicadoPor = bloqueio.aplicadoPor
    ? {
        id: bloqueio.aplicadoPor.id,
        nome: bloqueio.aplicadoPor.nomeCompleto,
        role: bloqueio.aplicadoPor.role,
      }
    : null;

  return {
    id: bloqueio.id,
    alvo: {
      id: bloqueio.usuario.id,
      nome: bloqueio.usuario.nomeCompleto,
      role: bloqueio.usuario.role,
      tipo: alvoTipo,
    },
    bloqueio: {
      tipo: bloqueio.tipo,
      motivo: bloqueio.motivo,
      status: bloqueio.status,
      inicio: bloqueio.inicio,
      fim: bloqueio.fim ?? null,
      observacoes: bloqueio.observacoes ?? null,
    },
    aplicadoPor,
    auditoria: {
      criadoEm: bloqueio.criadoEm,
      atualizadoEm: bloqueio.atualizadoEm,
    },
  };
};

const mapVagaResumo = (vaga: VagaRecord): AdminEmpresaJobResumo => ({
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
  numeroVagas: vaga.numeroVagas,
  descricao: vaga.descricao ?? null,
  jornada: vaga.jornada,
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

const buildStatusCountMap = <T extends string>(
  statuses: readonly T[],
  items: { status: T; _count: { _all: number } }[],
): Record<T, number> => {
  const map = {} as Record<T, number>;

  statuses.forEach((status) => {
    map[status] = 0;
  });

  items.forEach((item) => {
    map[item.status] = item._count._all;
  });

  return map;
};

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

const listPagamentos = async (id: string, { page, pageSize }: AdminEmpresasHistoryQuery) => {
  await ensureEmpresaExiste(prisma, id);

  const skip = (page - 1) * pageSize;

  const planosIds = await prisma.empresasPlano.findMany({
    where: { usuarioId: id },
    select: { id: true },
  });
  const planoIds = planosIds.map((plano) => plano.id);

  const orFilters: Prisma.LogsPagamentosDeAssinaturasWhereInput['OR'] = [{ usuarioId: id }];
  if (planoIds.length > 0) {
    orFilters.push({ empresasPlanoId: { in: planoIds } });
  }

  const where: Prisma.LogsPagamentosDeAssinaturasWhereInput = { OR: orFilters };

  const [total, logs] = await prisma.$transaction([
    prisma.logsPagamentosDeAssinaturas.count({ where }),
    prisma.logsPagamentosDeAssinaturas.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        tipo: true,
        status: true,
        mensagem: true,
        externalRef: true,
        mpResourceId: true,
        criadoEm: true,
        empresasPlanoId: true,
      },
    }),
  ]);

  const referencedPlanoIds = Array.from(
    new Set(
      logs.map((log) => log.empresasPlanoId).filter((value): value is string => Boolean(value)),
    ),
  );

  const planosResumo = referencedPlanoIds.length
    ? await prisma.empresasPlano.findMany({
        where: { id: { in: referencedPlanoIds } },
        select: {
          id: true,
          plano: { select: { nome: true } },
        },
      })
    : [];

  const planoMap = new Map(planosResumo.map((item) => [item.id, item.plano?.nome ?? null]));

  const data: AdminEmpresaPaymentLog[] = logs.map((log) => ({
    id: log.id,
    tipo: log.tipo,
    status: log.status ?? null,
    mensagem: log.mensagem ?? null,
    externalRef: log.externalRef ?? null,
    mpResourceId: log.mpResourceId ?? null,
    criadoEm: log.criadoEm,
    plano: log.empresasPlanoId
      ? { id: log.empresasPlanoId, nome: planoMap.get(log.empresasPlanoId) ?? null }
      : null,
  }));

  return {
    data,
    pagination: buildPagination(page, pageSize, total),
  };
};

const listVagas = async (id: string, { page, pageSize, status }: AdminEmpresasVagasQuery) => {
  await ensureEmpresaExiste(prisma, id);

  const skip = (page - 1) * pageSize;
  const where: Prisma.EmpresasVagasWhereInput = {
    usuarioId: id,
    ...(status && status.length > 0 ? { status: { in: status } } : {}),
  };

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

  const data = vagas.map(mapVagaResumo);

  return {
    data,
    pagination: buildPagination(page, pageSize, total),
  };
};

export const adminEmpresasService = {
  validateCnpj: async (input: string) => {
    const normalized = normalizeDocumento(input);
    const hasFourteenDigits = normalized.length === 14;
    const valid = hasFourteenDigits && isValidCnpj(normalized);

    let empresaResumo:
      | {
          id: string;
          nome: string;
          email: string;
          telefone: string | null;
          codUsuario: string;
          status: Status;
          role: Roles;
          tipoUsuario: TiposDeUsuarios;
          criadoEm: Date;
          atualizadoEm: Date;
        }
      | null = null;

    if (hasFourteenDigits) {
      const empresa = await prisma.usuarios.findFirst({
        where: { cnpj: normalized },
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          codUsuario: true,
          status: true,
          role: true,
          tipoUsuario: true,
          criadoEm: true,
          atualizadoEm: true,
          informacoes: { select: { telefone: true } },
        },
      });

      if (empresa) {
        empresaResumo = {
          id: empresa.id,
          nome: empresa.nomeCompleto,
          email: empresa.email,
          telefone: empresa.informacoes?.telefone ?? null,
          codUsuario: empresa.codUsuario,
          status: empresa.status,
          role: empresa.role,
          tipoUsuario: empresa.tipoUsuario,
          criadoEm: empresa.criadoEm,
          atualizadoEm: empresa.atualizadoEm,
        };
      }
    }

    return {
      success: true,
      cnpj: {
        input,
        normalized,
        formatted: hasFourteenDigits ? formatCnpj(normalized) : null,
        valid,
      },
      exists: empresaResumo !== null,
      available: valid && !empresaResumo,
      empresa: empresaResumo,
    };
  },

  validateCpf: async (input: string) => {
    const normalized = normalizeDocumento(input);
    const hasElevenDigits = normalized.length === 11;
    const valid = hasElevenDigits && isValidCpf(normalized);

    let usuarioResumo:
      | {
          id: string;
          nome: string;
          email: string;
          telefone: string | null;
          codUsuario: string;
          status: Status;
          role: Roles;
          tipoUsuario: TiposDeUsuarios;
          criadoEm: Date;
          atualizadoEm: Date;
        }
      | null = null;

    if (hasElevenDigits) {
      const usuario = await prisma.usuarios.findFirst({
        where: { cpf: normalized },
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          codUsuario: true,
          status: true,
          role: true,
          tipoUsuario: true,
          criadoEm: true,
          atualizadoEm: true,
          informacoes: { select: { telefone: true } },
        },
      });

      if (usuario) {
        usuarioResumo = {
          id: usuario.id,
          nome: usuario.nomeCompleto,
          email: usuario.email,
          telefone: usuario.informacoes?.telefone ?? null,
          codUsuario: usuario.codUsuario,
          status: usuario.status,
          role: usuario.role,
          tipoUsuario: usuario.tipoUsuario,
          criadoEm: usuario.criadoEm,
          atualizadoEm: usuario.atualizadoEm,
        };
      }
    }

    return {
      success: true,
      cpf: {
        input,
        normalized,
        formatted: hasElevenDigits ? formatCpf(normalized) : null,
        valid,
      },
      exists: usuarioResumo !== null,
      available: valid && !usuarioResumo,
      usuario: usuarioResumo,
    };
  },

  create: async (input: AdminEmpresasCreateInput) => {
    const senhaOriginal = input.senha ?? generateSecurePassword();
    const senhaHash = await sanitizeSenha(senhaOriginal);
    const aceitarTermos = input.aceitarTermos ?? true;
    const status = input.status ?? Status.ATIVO;
    const cidade = sanitizeOptionalValue(input.cidade);
    const estado = sanitizeOptionalValue(input.estado);
    const descricao = sanitizeOptionalValue(input.descricao);
    const avatarUrl = sanitizeOptionalValue(input.avatarUrl);
    const socialLinksInput = extractSocialLinksFromPayload(
      input as unknown as Record<string, unknown>,
    );
    const socialLinksSanitized = sanitizeSocialLinks(socialLinksInput);
    const socialLinksCreate = buildSocialLinksCreateData(socialLinksSanitized);

    const empresaId = await prisma.$transaction(async (tx) => {
      const codUsuario = await generateUniqueEmpresaCode(tx);
      const usuario = await tx.usuarios.create({
        data: {
          nomeCompleto: sanitizeNome(input.nome),
          email: sanitizeEmail(input.email),
          senha: senhaHash,
          supabaseId: sanitizeSupabaseId(input.supabaseId),
          tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
          role: Roles.EMPRESA,
          status,
          codUsuario,
          cnpj: normalizeDocumento(input.cnpj),
          emailVerification: {
            create: {
              emailVerificado: true,
              emailVerificadoEm: new Date(),
              emailVerificationToken: null,
              emailVerificationTokenExp: null,
              emailVerificationAttempts: 0,
              ultimaTentativaVerificacao: new Date(),
            },
          },
          informacoes: {
            create: {
              telefone: sanitizeTelefone(input.telefone),
              aceitarTermos,
              ...(descricao !== undefined ? { descricao } : {}),
              ...(avatarUrl !== undefined ? { avatarUrl } : {}),
            },
          },
          ...(socialLinksCreate
            ? {
                redesSociais: {
                  create: socialLinksCreate,
                },
              }
            : {}),
        },
        select: { id: true },
      });

      await upsertEnderecoPrincipal(tx, usuario.id, { cidade, estado });

      if (input.plano) {
        await assignPlanoToEmpresa(tx, usuario.id, input.plano);
      }

      return usuario.id;
    });

    const empresa = await adminEmpresasService.get(empresaId);

    if (empresa) {
      const baseFrontendUrl = serverConfig.frontendUrl.replace(/\/$/, '');
      const rawAuthUrl = process.env.AUTH_FRONTEND_URL?.trim();
      const authBaseUrl = (
        rawAuthUrl && rawAuthUrl.length > 0 ? rawAuthUrl : `${baseFrontendUrl}/auth`
      ).replace(/\/$/, '');
      const loginUrl = `${authBaseUrl}/login`;

      try {
        const emailService = new EmailService();
        const template = EmailTemplates.generateAdminEmpresaCredentialsEmail({
          nomeCompleto: empresa.nome,
          email: empresa.email,
          senha: senhaOriginal,
          loginUrl,
          cnpj: empresa.cnpj ?? null,
        });

        await emailService.sendAssinaturaNotificacao(
          { id: empresa.id, email: empresa.email, nomeCompleto: empresa.nome },
          template,
        );
      } catch (error) {
        console.error('Erro ao enviar credenciais de acesso da empresa', { empresaId, error });
      }
    }

    return empresa;
  },

  update: async (id: string, data: AdminEmpresasUpdateInput) => {
    await prisma.$transaction(async (tx) => {
      await ensureEmpresaExiste(tx, id);

      const updates: Prisma.UsuariosUpdateInput = {};
      const informacoesUpdates: Prisma.UsuariosInformationUpdateInput = {};
      const socialLinksInput = extractSocialLinksFromPayload(
        data as unknown as Record<string, unknown>,
      );
      const socialLinksSanitized = sanitizeSocialLinks(socialLinksInput);
      const socialLinksUpdate = buildSocialLinksUpdateData(socialLinksSanitized);

      if (data.nome !== undefined) {
        updates.nomeCompleto = sanitizeNome(data.nome);
      }

      if (data.email !== undefined) {
        updates.email = sanitizeEmail(data.email);
      }

      if (data.telefone !== undefined) {
        informacoesUpdates.telefone = sanitizeTelefone(data.telefone);
      }

      if (data.cnpj !== undefined) {
        updates.cnpj = data.cnpj === null ? null : normalizeDocumento(data.cnpj);
      }

      const cidade = sanitizeOptionalValue(data.cidade);

      const estado = sanitizeOptionalValue(data.estado);

      const descricao = sanitizeOptionalValue(data.descricao);
      if (descricao !== undefined) {
        informacoesUpdates.descricao = descricao;
      }

      const avatarUrl = sanitizeOptionalValue(data.avatarUrl);
      if (avatarUrl !== undefined) {
        informacoesUpdates.avatarUrl = avatarUrl;
      }

      await upsertEnderecoPrincipal(tx, id, { cidade, estado });

      if (data.status !== undefined) {
        updates.status = data.status;
      }

      if (data.senha !== undefined) {
        updates.senha = await sanitizeSenha(data.senha);
      }

      if (Object.keys(informacoesUpdates).length > 0) {
        updates.informacoes = { update: informacoesUpdates };
      }

      if (Object.keys(updates).length > 0) {
        await tx.usuarios.update({ where: { id }, data: updates });
      }

      if (socialLinksSanitized) {
        if (socialLinksSanitized.hasAnyValue) {
          await tx.usuariosRedesSociais.upsert({
            where: { usuarioId: id },
            create: {
              usuarioId: id,
              ...socialLinksSanitized.values,
            },
            update: socialLinksUpdate ?? socialLinksSanitized.values,
          });
        } else {
          await tx.usuariosRedesSociais.deleteMany({ where: { usuarioId: id } });
        }
      }

      if (data.plano === null) {
        await tx.empresasPlano.updateMany({
          where: { usuarioId: id, status: EmpresasPlanoStatus.ATIVO },
          data: { status: EmpresasPlanoStatus.CANCELADO, fim: new Date() },
        });
      } else if (data.plano) {
        const { resetPeriodo, ...planoPayload } = data.plano;
        const planoInput = planoPayload as AdminEmpresasPlanoPersistInput;

        if (resetPeriodo || planoPayload.iniciarEm !== undefined) {
          await assignPlanoToEmpresa(tx, id, planoInput);
        } else {
          await atualizarPlanoSemReset(tx, id, planoInput);
        }
      }
    });

    return adminEmpresasService.get(id);
  },

  updatePlano: async (id: string, plano: AdminEmpresasPlanoUpdateInput) => {
    await prisma.$transaction(async (tx) => {
      await ensureEmpresaExiste(tx, id);

      const { resetPeriodo, ...planoPayload } = plano;
      const planoInput = planoPayload as AdminEmpresasPlanoPersistInput;

      if (resetPeriodo || planoPayload.iniciarEm !== undefined) {
        await assignPlanoToEmpresa(tx, id, planoInput);
        return;
      }

      await atualizarPlanoSemReset(tx, id, planoInput);
    });

    return adminEmpresasService.get(id);
  },

  assignPlanoManual: async (id: string, plano: AdminEmpresasPlanoManualAssignInput) => {
    await prisma.$transaction(async (tx) => {
      await ensureEmpresaExiste(tx, id);

      const inicio = plano.iniciarEm ?? new Date();
      const modo = plano.modo;
      const fim = calcularFim(
        modo,
        inicio,
        plano.diasTeste ?? undefined,
        plano.proximaCobranca ?? undefined,
        plano.graceUntil ?? undefined,
      );

      await tx.empresasPlano.updateMany({
        where: { usuarioId: id, status: EmpresasPlanoStatus.ATIVO },
        data: { status: EmpresasPlanoStatus.CANCELADO, fim: new Date() },
      });

      await tx.empresasPlano.create({
        data: {
          usuarioId: id,
          planosEmpresariaisId: plano.planosEmpresariaisId,
          modo,
          status: EmpresasPlanoStatus.ATIVO,
          origin: EmpresasPlanoOrigin.ADMIN,
          inicio,
          fim,
          ...mapPlanoPagamentoData(plano),
        },
      });
    });

    return adminEmpresasService.get(id);
  },

  listDashboard: async ({ page, pageSize, search }: AdminEmpresasDashboardListQuery) => {
    const where: Prisma.UsuariosWhereInput = {
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      role: Roles.EMPRESA,
      ...buildSearchFilter(search),
    };

    const skip = (page - 1) * pageSize;
    const referenceDate = new Date();

    const [total, empresas] = await prisma.$transaction([
      prisma.usuarios.count({ where }),
      prisma.usuarios.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        select: createUsuarioDashboardSelect(),
      }),
    ]);

    const data: AdminEmpresasDashboardListItem[] = empresas.map((empresa) => {
      const planoAtual = empresa.planosContratados[0];
      const plano = mapPlanoResumo(planoAtual, referenceDate);
      const bloqueio = mapBloqueioResumo(empresa.bloqueiosRecebidos?.[0] ?? null);

      return {
        id: empresa.id,
        codUsuario: empresa.codUsuario,
        nome: empresa.nomeCompleto,
        email: empresa.email,
        telefone: empresa.informacoes?.telefone ?? null,
        avatarUrl: empresa.informacoes?.avatarUrl ?? null,
        cnpj: empresa.cnpj ?? null,
        status: empresa.status,
        criadoEm: empresa.criadoEm,
        vagasPublicadas: empresa._count?.vagasCriadas ?? 0,
        limiteVagasPlano: plano?.quantidadeVagas ?? null,
        plano,
        bloqueada: Boolean(bloqueio),
        bloqueioAtivo: bloqueio,
      } satisfies AdminEmpresasDashboardListItem;
    });

    return {
      data,
      pagination: buildPagination(page, pageSize, total),
    };
  },

  list: async ({ page, pageSize, search }: AdminEmpresasListQuery) => {
    const where: Prisma.UsuariosWhereInput = {
      tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA,
      ...buildSearchFilter(search),
    };

    const skip = (page - 1) * pageSize;

    const referenceDate = new Date();

    const [total, empresas] = await prisma.$transaction([
      prisma.usuarios.count({ where }),
      prisma.usuarios.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        select: createUsuarioListSelect(),
      }),
    ]);

    const data: AdminEmpresaListItem[] = empresas.map((empresaRaw) => {
      const empresa = attachEnderecoResumo(mergeUsuarioInformacoes(empresaRaw))!;
      const planoAtual = empresa.planosContratados[0];
      const plano = mapPlanoResumo(planoAtual, referenceDate);
      const diasTeste =
        planoAtual && planoAtual.inicio && planoAtual.fim
          ? calculateDurationInDays(planoAtual.inicio, planoAtual.fim)
          : null;
      const bloqueio = mapBloqueioResumo(empresa.bloqueiosRecebidos?.[0] ?? null);

      return {
        id: empresa.id,
        codUsuario: empresa.codUsuario,
        nome: empresa.nomeCompleto,
        email: empresa.email,
        telefone: empresa.telefone ?? '',
        avatarUrl: empresa.avatarUrl,
        cnpj: empresa.cnpj ?? null,
        cidade: empresa.cidade,
        estado: empresa.estado,
        enderecos: empresa.enderecos,
        criadoEm: empresa.criadoEm,
        ativa: empresa.status === Status.ATIVO,
        parceira: Boolean(planoAtual && planoAtual.modo === EmpresasPlanoModo.PARCEIRO),
        diasTesteDisponibilizados: diasTeste,
        plano,
        vagasPublicadas: empresa._count?.vagasCriadas ?? 0,
        limiteVagasPlano: plano?.quantidadeVagas ?? null,
        bloqueada: Boolean(bloqueio),
        bloqueioAtivo: bloqueio,
        informacoes: empresa.informacoes,
      };
    });

    return {
      data,
      pagination: buildPagination(page, pageSize, total),
    };
  },

  get: async (id: string): Promise<AdminEmpresaDetail | null> => {
    const empresaRecord = await prisma.usuarios.findUnique({
      where: { id },
      select: usuarioDetailSelect,
    });

    if (!empresaRecord || empresaRecord.tipoUsuario !== TiposDeUsuarios.PESSOA_JURIDICA) {
      return null;
    }

    const empresa = attachEnderecoResumo(mergeUsuarioInformacoes(empresaRecord))!;

    const planoAtual = empresa.planosContratados[0];
    const plano = mapPlanoResumo(planoAtual);
    const diasTeste =
      planoAtual && planoAtual.inicio && planoAtual.fim
        ? calculateDurationInDays(planoAtual.inicio, planoAtual.fim)
        : null;
    const ultimoPagamentoEm =
      planoAtual?.atualizadoEm ?? planoAtual?.inicio ?? planoAtual?.criadoEm ?? null;
    const bloqueioAtivoRegistro = await prisma.usuariosEmBloqueios.findFirst({
      where: {
        usuarioId: id,
        status: StatusDeBloqueios.ATIVO,
        OR: [{ fim: null }, { fim: { gt: new Date() } }],
      },
      orderBy: [{ fim: 'desc' }, { criadoEm: 'desc' }],
      select: bloqueioSelect,
    });
    const bloqueioAtivo = mapBloqueioResumo(bloqueioAtivoRegistro);

    return {
      id: empresa.id,
      codUsuario: empresa.codUsuario,
      nome: empresa.nomeCompleto,
      email: empresa.email,
      telefone: empresa.telefone ?? '',
      avatarUrl: empresa.avatarUrl,
      cnpj: empresa.cnpj ?? null,
      descricao: empresa.descricao,
      socialLinks: mapSocialLinks(empresa.redesSociais),
      cidade: empresa.cidade,
      estado: empresa.estado,
      enderecos: empresa.enderecos,
      criadoEm: empresa.criadoEm,
      status: empresa.status,
      ultimoLogin: empresa.ultimoLogin ?? null,
      ativa: empresa.status === Status.ATIVO,
      parceira: Boolean(planoAtual && planoAtual.modo === EmpresasPlanoModo.PARCEIRO),
      diasTesteDisponibilizados: diasTeste,
      plano,
      vagas: {
        publicadas: empresa._count?.vagasCriadas ?? 0,
        limitePlano: plano?.quantidadeVagas ?? null,
      },
      bloqueada: Boolean(bloqueioAtivo),
      pagamento: {
        modelo: planoAtual?.modeloPagamento ?? null,
        metodo: planoAtual?.metodoPagamento ?? null,
        status: planoAtual?.statusPagamento ?? null,
        ultimoPagamentoEm,
      },
      bloqueioAtivo,
      informacoes: empresa.informacoes,
    };
  },

  getFullOverview: async (id: string): Promise<AdminEmpresaOverview | null> => {
    const empresa = await adminEmpresasService.get(id);

    if (!empresa) {
      return null;
    }

    const referenceDate = new Date();

    const [
      planosHistoricoRecords,
      bloqueiosRecords,
      vagasStatusCountsRaw,
      candidaturasStatusCountsRaw,
    ] = await prisma.$transaction([
      prisma.empresasPlano.findMany({
        where: { usuarioId: id },
        orderBy: [{ inicio: 'desc' }, { criadoEm: 'desc' }],
        select: planoHistoricoSelect,
      }),
      prisma.usuariosEmBloqueios.findMany({
        where: { usuarioId: id },
        orderBy: [{ criadoEm: 'desc' }],
        select: bloqueioSelect,
      }),
      prisma.empresasVagas.groupBy({
        by: ['status'],
        where: { usuarioId: id },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.empresasCandidatos.groupBy({
        by: ['status'],
        where: { empresaUsuarioId: id },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
    ]);

    const vagasStatusCounts = vagasStatusCountsRaw.map((item) => ({
      status: item.status,
      _count: {
        _all:
          typeof item._count === 'object' && item._count !== null
            ? ((item._count as { _all?: number })._all ?? 0)
            : 0,
      },
    }));

    const candidaturasStatusCounts = candidaturasStatusCountsRaw.map((item) => ({
      status: item.status,
      _count: {
        _all:
          typeof item._count === 'object' && item._count !== null
            ? ((item._count as { _all?: number })._all ?? 0)
            : 0,
      },
    }));

    const planosHistorico = planosHistoricoRecords.map((plano) =>
      mapPlanoHistorico(plano, referenceDate),
    );
    const planosAtivos = planosHistorico.filter(
      (plano) =>
        plano.status === EmpresasPlanoStatus.ATIVO &&
        (!plano.fim || plano.fim.getTime() > referenceDate.getTime()),
    );

    const bloqueiosHistorico = bloqueiosRecords
      .map((registro) => mapBloqueioResumo(registro))
      .filter((bloqueio): bloqueio is AdminUsuariosEmBloqueiosResumo => Boolean(bloqueio));

    const bloqueiosAtivos = bloqueiosHistorico.filter((bloqueio) => {
      if (bloqueio.bloqueio.status !== StatusDeBloqueios.ATIVO) {
        return false;
      }

      const fim = bloqueio.bloqueio.fim;
      return !fim || fim.getTime() > referenceDate.getTime();
    });

    const vagasPorStatus = buildStatusCountMap(
      Object.values(StatusDeVagas) as StatusDeVagas[],
      vagasStatusCounts,
    );
    const totalVagas = Object.values(vagasPorStatus).reduce((acc, value) => acc + value, 0);

    const candidaturasPorStatus = buildStatusCountMap(
      Object.values(StatusProcesso) as StatusProcesso[],
      candidaturasStatusCounts,
    );
    const totalCandidaturas = Object.values(candidaturasPorStatus).reduce(
      (acc, value) => acc + value,
      0,
    );

    const [pagamentosResumo, vagasResumo] = await Promise.all([
      listPagamentos(id, { page: 1, pageSize: 20 }),
      listVagas(id, { page: 1, pageSize: 10 }),
    ]);

    return {
      empresa,
      planos: {
        ativos: planosAtivos,
        historico: planosHistorico,
      },
      pagamentos: {
        total: pagamentosResumo.pagination.total,
        recentes: pagamentosResumo.data,
      },
      vagas: {
        total: totalVagas,
        porStatus: vagasPorStatus,
        recentes: vagasResumo.data,
      },
      candidaturas: {
        total: totalCandidaturas,
        porStatus: candidaturasPorStatus,
      },
      bloqueios: {
        ativos: bloqueiosAtivos,
        historico: bloqueiosHistorico,
      },
    } satisfies AdminEmpresaOverview;
  },

  listPagamentos: (id: string, query: AdminEmpresasHistoryQuery) => listPagamentos(id, query),

  listVagas: (id: string, query: AdminEmpresasVagasQuery) => listVagas(id, query),

  listVagasEmAnalise: async (id: string, query: AdminEmpresasHistoryQuery) =>
    listVagas(id, {
      ...query,
      status: [StatusDeVagas.EM_ANALISE],
    }),

  approveVaga: async (empresaId: string, vagaId: string) => {
    const vaga = await prisma.$transaction(async (tx) => {
      await ensureEmpresaExiste(tx, empresaId);

      const vagaAtual = await tx.empresasVagas.findFirst({
        where: { id: vagaId, usuarioId: empresaId },
      });

      if (!vagaAtual) {
        throw Object.assign(new Error('Vaga não encontrada'), { code: 'VAGA_NOT_FOUND' });
      }

      if (vagaAtual.status !== StatusDeVagas.EM_ANALISE) {
        throw Object.assign(new Error('Vaga não está em análise'), {
          code: 'VAGA_INVALID_STATUS',
        });
      }

      // Verifica limite do plano considerando apenas PUBLICADO
      const planoAtivo = await clientesService.findActiveByUsuario(empresaId);
      const limite = planoAtivo?.plano?.quantidadeVagas ?? null;
      if (typeof limite === 'number' && limite > 0) {
        const publicados = await tx.empresasVagas.count({
          where: { usuarioId: empresaId, status: StatusDeVagas.PUBLICADO },
        });
        if (publicados >= limite) {
          throw new LimiteVagasPlanoAtingidoError(limite);
        }
      }

      const publishedAt = vagaAtual.inseridaEm ?? new Date();

      const updated = await tx.empresasVagas.update({
        where: { id: vagaAtual.id },
        data: {
          status: StatusDeVagas.PUBLICADO,
          inseridaEm: publishedAt,
        },
        select: vagaSelect,
      });

      // Se atingiu o limite após esta aprovação, retorna demais EM_ANALISE para RASCUNHO
      if (typeof limite === 'number' && limite > 0) {
        const publicadosApos = await tx.empresasVagas.count({
          where: { usuarioId: empresaId, status: StatusDeVagas.PUBLICADO },
        });
        if (publicadosApos >= limite) {
          await tx.empresasVagas.updateMany({
            where: { usuarioId: empresaId, status: StatusDeVagas.EM_ANALISE },
            data: { status: StatusDeVagas.RASCUNHO },
          });
        }
      }

      return updated;
    });

    return mapVagaResumo(vaga);
  },

  aplicarBloqueio: async (
    empresaId: string,
    adminId: string,
    input: AdminEmpresasBloqueioInput,
  ) => {
    const observacoes = sanitizeOptionalValue(input.observacoes ?? undefined);
    const inicio = new Date();
    let fim: Date | null = null;

    if (input.tipo !== TiposDeBloqueios.PERMANENTE && input.dias && input.dias > 0) {
      fim = new Date(inicio.getTime());
      fim.setDate(fim.getDate() + input.dias);
    }

    const bloqueio = await prisma.$transaction(async (tx) => {
      const empresa = await ensureEmpresaExiste(tx, empresaId);

      const admin = await tx.usuarios.findUnique({
        where: { id: adminId },
        select: { id: true, role: true },
      });

      if (!admin || !['ADMIN', 'MODERADOR'].includes(admin.role)) {
        throw Object.assign(new Error('Usuário não autorizado a aplicar bloqueio'), {
          code: 'ADMIN_REQUIRED',
        });
      }

      await tx.usuarios.update({
        where: { id: empresaId },
        data: { status: Status.BLOQUEADO },
      });

      const novoBloqueio = await tx.usuariosEmBloqueios.create({
        data: {
          usuarioId: empresa.id,
          aplicadoPorId: adminId,
          tipo: input.tipo,
          motivo: input.motivo,
          status: StatusDeBloqueios.ATIVO,
          inicio,
          fim,
          ...(observacoes !== undefined ? { observacoes } : {}),
          logs: {
            create: {
              acao: AcoesDeLogDeBloqueio.CRIACAO,
              criadoPorId: adminId,
              ...(observacoes !== undefined
                ? { descricao: observacoes }
                : { descricao: 'Bloqueio registrado pelo painel administrativo.' }),
            },
          },
        },
        select: bloqueioSelect,
      });

      return novoBloqueio;
    });

    // Envia email de bloqueio
    try {
      const user = await prisma.usuarios.findUnique({
        where: { id: empresaId },
        select: { email: true, nomeCompleto: true },
      });
      if (user?.email) {
        const emailService = new EmailService();
        const template = EmailTemplates.generateUserBlockedEmail({
          nomeCompleto: user.nomeCompleto,
          motivo: input.motivo,
          fim: input.tipo === TiposDeBloqueios.TEMPORARIO ? fim : null,
          descricao: input.observacoes ?? null,
          tipo: input.tipo,
        });
        await emailService.sendAssinaturaNotificacao(
          { id: empresaId, email: user.email, nomeCompleto: user.nomeCompleto },
          template,
        );
      }
    } catch (error) {
      console.error('Erro ao enviar e-mail de bloqueio', { empresaId, error });
    }

    return mapBloqueioResumo(bloqueio);
  },

  revogarBloqueio: async (empresaId: string, adminId: string, observacoes?: string | null) => {
    await ensureEmpresaExiste(prisma, empresaId);
    const bloqueioAtivo = await prisma.usuariosEmBloqueios.findFirst({
      where: { usuarioId: empresaId, status: StatusDeBloqueios.ATIVO },
      orderBy: { criadoEm: 'desc' },
    });
    if (!bloqueioAtivo) {
      throw Object.assign(new Error('Nenhum bloqueio ativo encontrado'), {
        code: 'BLOQUEIO_NOT_FOUND',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.usuariosEmBloqueios.update({
        where: { id: bloqueioAtivo.id },
        data: {
          status: StatusDeBloqueios.REVOGADO,
          logs: {
            create: {
              acao: AcoesDeLogDeBloqueio.REVOGACAO,
              criadoPorId: adminId,
              descricao: observacoes ?? 'Bloqueio revogado pelo painel administrativo.',
            },
          },
        },
      });
      await tx.usuarios.update({ where: { id: empresaId }, data: { status: Status.ATIVO } });
    });

    // E-mail de boas-vindas de volta
    try {
      const user = await prisma.usuarios.findUnique({
        where: { id: empresaId },
        select: { email: true, nomeCompleto: true },
      });
      if (user?.email) {
        const emailService = new EmailService();
        const template = EmailTemplates.generateUserUnblockedEmail({
          nomeCompleto: user.nomeCompleto,
        });
        await emailService.sendAssinaturaNotificacao(
          { id: empresaId, email: user.email, nomeCompleto: user.nomeCompleto },
          template,
        );
      }
    } catch (error) {
      console.error('Erro ao enviar e-mail de revogação de bloqueio', { empresaId, error });
    }
  },

  listarBloqueios: async (empresaId: string, { page, pageSize }: AdminEmpresasHistoryQuery) => {
    await ensureEmpresaExiste(prisma, empresaId);

    const skip = (page - 1) * pageSize;

    const [total, bloqueios] = await prisma.$transaction([
      prisma.usuariosEmBloqueios.count({ where: { usuarioId: empresaId } }),
      prisma.usuariosEmBloqueios.findMany({
        where: { usuarioId: empresaId },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        select: bloqueioSelect,
      }),
    ]);

    return {
      data: bloqueios
        .map(mapBloqueioResumo)
        .filter((item): item is AdminUsuariosEmBloqueiosResumo => Boolean(item)),
      pagination: buildPagination(page, pageSize, total),
    };
  },
};

export type AdminEmpresasDashboardListResult = Awaited<
  ReturnType<typeof adminEmpresasService.listDashboard>
>;
export type AdminEmpresasListResult = Awaited<ReturnType<typeof adminEmpresasService.list>>;
export type AdminEmpresaDetailResult = Awaited<ReturnType<typeof adminEmpresasService.get>>;
export type AdminEmpresasPagamentosResult = Awaited<
  ReturnType<typeof adminEmpresasService.listPagamentos>
>;
export type AdminEmpresasVagasResult = Awaited<ReturnType<typeof adminEmpresasService.listVagas>>;
export type AdminEmpresaAprovacaoVagaResult = Awaited<
  ReturnType<typeof adminEmpresasService.approveVaga>
>;
export type AdminEmpresasBloqueiosResult = Awaited<
  ReturnType<typeof adminEmpresasService.listarBloqueios>
>;
