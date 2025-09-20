import bcrypt from 'bcrypt';

import {
  METODO_PAGAMENTO,
  MODELO_PAGAMENTO,
  STATUS_PAGAMENTO,
  ModalidadesDeVagas,
  Prisma,
  Role,
  Status,
  StatusDeVagas,
  RegimesDeTrabalhos,
  TipoUsuario,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  getTipoDePlanoDuracao,
  isTipoDePlanoElegivel,
  mapClienteTipoToTipoDePlano,
  mapTipoDePlanoToClienteTipo,
} from '@/modules/empresas/shared/tipos-de-planos';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import type { UsuarioEnderecoDto } from '@/modules/usuarios/utils/address';
import type {
  AdminEmpresasBanInput,
  AdminEmpresasCreateInput,
  AdminEmpresasHistoryQuery,
  AdminEmpresasListQuery,
  AdminEmpresasPlanoInput,
  AdminEmpresasUpdateInput,
  AdminEmpresasVagasQuery,
} from '@/modules/empresas/admin/validators/admin-empresas.schema';

const planoAtivoSelect = {
  where: { ativo: true },
  orderBy: [
    { inicio: 'desc' },
    { criadoEm: 'desc' },
  ],
  take: 1,
  select: {
    id: true,
    tipo: true,
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
} satisfies Prisma.Usuarios$planosContratadosArgs;

const banimentoSelect = {
  id: true,
  motivo: true,
  dias: true,
  inicio: true,
  fim: true,
  criadoEm: true,
} satisfies Prisma.EmpresaBanimentoSelect;

const createUsuarioListSelect = () =>
  ({
    id: true,
    codUsuario: true,
    nomeCompleto: true,
    email: true,
    telefone: true,
    avatarUrl: true,
    cnpj: true,
    criadoEm: true,
    status: true,
    planosContratados: planoAtivoSelect,
    banimentosRecebidos: {
      where: { fim: { gt: new Date() } },
      orderBy: { fim: 'desc' },
      take: 1,
      select: banimentoSelect,
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

const usuarioDetailSelect = {
  id: true,
  codUsuario: true,
  nomeCompleto: true,
  email: true,
  telefone: true,
  avatarUrl: true,
  cnpj: true,
  descricao: true,
  instagram: true,
  linkedin: true,
  criadoEm: true,
  tipoUsuario: true,
  status: true,
  ultimoLogin: true,
  planosContratados: planoAtivoSelect,
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

type UsuarioListSelect = ReturnType<typeof createUsuarioListSelect>;
type UsuarioListResult = Prisma.UsuariosGetPayload<{ select: UsuarioListSelect }>;
type PlanoResumoData = UsuarioListResult['planosContratados'][number];
type BanimentoResumoData = Prisma.EmpresaBanimentoGetPayload<{ select: typeof banimentoSelect }>;

type AdminEmpresasPlanoResumo = {
  id: string;
  nome: string | null;
  tipo: string;
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
  banida: boolean;
  banimentoAtivo: AdminEmpresaBanimentoResumo | null;
};

type AdminEmpresaBanimentoResumo = {
  id: string;
  motivo: string | null;
  dias: number;
  inicio: Date;
  fim: Date;
  criadoEm: Date;
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
  titulo: string;
  status: StatusDeVagas;
  inseridaEm: Date;
  atualizadoEm: Date;
  inscricoesAte: Date | null;
  modoAnonimo: boolean;
  modalidade: ModalidadesDeVagas;
  regimeDeTrabalho: RegimesDeTrabalhos;
  paraPcd: boolean;
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
  instagram: string | null;
  linkedin: string | null;
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
  banida: boolean;
  pagamento: {
    modelo: MODELO_PAGAMENTO | null;
    metodo: METODO_PAGAMENTO | null;
    status: STATUS_PAGAMENTO | null;
    ultimoPagamentoEm: Date | null;
  };
  banimentoAtivo: AdminEmpresaBanimentoResumo | null;
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

const sanitizeObservacao = (value?: string | null) => sanitizeOptionalValue(value);

const calcularPlanoFim = (tipo: ReturnType<typeof mapClienteTipoToTipoDePlano>, inicio: Date | null) => {
  const duracao = getTipoDePlanoDuracao(tipo);

  if (duracao === null) {
    return null;
  }

  const base = inicio ?? new Date();
  const fim = new Date(base.getTime());
  fim.setDate(fim.getDate() + duracao);
  return fim;
};

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
    const existing = await tx.usuarios.findUnique({ where: { codUsuario: candidate }, select: { id: true } });

    if (!existing) {
      return candidate;
    }
  }

  return `${prefix}${Date.now().toString().slice(-6)}`;
};

const assignPlanoToEmpresa = async (
  tx: Prisma.TransactionClient,
  usuarioId: string,
  plano: AdminEmpresasPlanoInput,
) => {
  const tipo = mapClienteTipoToTipoDePlano(plano.tipo);
  const inicio = plano.iniciarEm ?? new Date();
  const fim = calcularPlanoFim(tipo, inicio);
  const observacao = sanitizeObservacao(plano.observacao ?? undefined);

  await tx.empresasPlano.updateMany({
    where: { usuarioId, ativo: true },
    data: { ativo: false, fim: new Date() },
  });

  await tx.empresasPlano.create({
    data: {
      usuarioId,
      planoEmpresarialId: plano.planoEmpresarialId,
      tipo,
      inicio,
      fim,
      ativo: true,
      ...(observacao !== undefined ? { observacao } : {}),
    },
  });
};

const atualizarPlanoSemReset = async (
  tx: Prisma.TransactionClient,
  usuarioId: string,
  plano: AdminEmpresasPlanoInput,
) => {
  const planoAtual = await tx.empresasPlano.findFirst({
    where: { usuarioId, ativo: true },
    orderBy: [
      { inicio: 'desc' },
      { criadoEm: 'desc' },
    ],
  });

  if (!planoAtual) {
    await assignPlanoToEmpresa(tx, usuarioId, plano);
    return;
  }

  const tipo = mapClienteTipoToTipoDePlano(plano.tipo);
  const observacao = sanitizeObservacao(plano.observacao ?? undefined);

  const data: Prisma.EmpresasPlanoUpdateInput = {
    plano: { connect: { id: plano.planoEmpresarialId } },
    tipo,
  };

  if (observacao !== undefined) {
    data.observacao = observacao;
  }

  await tx.empresasPlano.update({
    where: { id: planoAtual.id },
    data,
  });
};

type PrismaUsuarioClient = Pick<Prisma.TransactionClient, 'usuario'>;

const ensureEmpresaExiste = async (db: PrismaUsuarioClient, id: string) => {
  const empresa = await db.usuarios.findUnique({
    where: { id },
    select: { id: true, tipoUsuario: true },
  });

  if (!empresa || empresa.tipoUsuario !== TipoUsuario.PESSOA_JURIDICA) {
    throw Object.assign(new Error('Empresa não encontrada'), { code: 'EMPRESA_NOT_FOUND' });
  }
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
    tipo: mapTipoDePlanoToClienteTipo(plano.tipo),
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

const mapBanimentoResumo = (banimento: BanimentoResumoData | null): AdminEmpresaBanimentoResumo | null => {
  if (!banimento) {
    return null;
  }

  return {
    id: banimento.id,
    motivo: banimento.motivo ?? null,
    dias: banimento.dias,
    inicio: banimento.inicio,
    fim: banimento.fim,
    criadoEm: banimento.criadoEm,
  };
};

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

export const adminEmpresasService = {
  create: async (input: AdminEmpresasCreateInput) => {
    const senhaHash = await sanitizeSenha(input.senha);
    const aceitarTermos = input.aceitarTermos ?? true;
    const status = input.status ?? Status.ATIVO;
    const cidade = sanitizeOptionalValue(input.cidade);
    const estado = sanitizeOptionalValue(input.estado);
    const descricao = sanitizeOptionalValue(input.descricao);
    const instagram = sanitizeOptionalValue(input.instagram);
    const linkedin = sanitizeOptionalValue(input.linkedin);
    const avatarUrl = sanitizeOptionalValue(input.avatarUrl);

    const empresaId = await prisma.$transaction(async (tx) => {
      const codUsuario = await generateUniqueEmpresaCode(tx);
      const usuario = await tx.usuarios.create({
        data: {
          nomeCompleto: sanitizeNome(input.nome),
          email: sanitizeEmail(input.email),
          telefone: sanitizeTelefone(input.telefone),
          senha: senhaHash,
          aceitarTermos,
          supabaseId: sanitizeSupabaseId(input.supabaseId),
          tipoUsuario: TipoUsuario.PESSOA_JURIDICA,
          role: Role.EMPRESA,
          status,
          codUsuario,
          cnpj: normalizeDocumento(input.cnpj),
          ...(descricao !== undefined ? { descricao } : {}),
          ...(instagram !== undefined ? { instagram } : {}),
          ...(linkedin !== undefined ? { linkedin } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        },
        select: { id: true },
      });

      await upsertEnderecoPrincipal(tx, usuario.id, { cidade, estado });

      if (input.plano) {
        await assignPlanoToEmpresa(tx, usuario.id, input.plano);
      }

      return usuario.id;
    });

    return adminEmpresasService.get(empresaId);
  },

  update: async (id: string, data: AdminEmpresasUpdateInput) => {
    await prisma.$transaction(async (tx) => {
      await ensureEmpresaExiste(tx, id);

      const updates: Prisma.UsuariosUpdateInput = {};

      if (data.nome !== undefined) {
        updates.nomeCompleto = sanitizeNome(data.nome);
      }

      if (data.email !== undefined) {
        updates.email = sanitizeEmail(data.email);
      }

      if (data.telefone !== undefined) {
        updates.telefone = sanitizeTelefone(data.telefone);
      }

      if (data.cnpj !== undefined) {
        updates.cnpj = data.cnpj === null ? null : normalizeDocumento(data.cnpj);
      }

      const cidade = sanitizeOptionalValue(data.cidade);

      const estado = sanitizeOptionalValue(data.estado);

      const descricao = sanitizeOptionalValue(data.descricao);
      if (descricao !== undefined) {
        updates.descricao = descricao;
      }

      const instagram = sanitizeOptionalValue(data.instagram);
      if (instagram !== undefined) {
        updates.instagram = instagram;
      }

      const linkedin = sanitizeOptionalValue(data.linkedin);
      if (linkedin !== undefined) {
        updates.linkedin = linkedin;
      }

      const avatarUrl = sanitizeOptionalValue(data.avatarUrl);
      if (avatarUrl !== undefined) {
        updates.avatarUrl = avatarUrl;
      }

      await upsertEnderecoPrincipal(tx, id, { cidade, estado });

      if (data.status !== undefined) {
        updates.status = data.status;
      }

      if (Object.keys(updates).length > 0) {
        await tx.usuarios.update({ where: { id }, data: updates });
      }

      if (data.plano === null) {
        await tx.empresasPlano.updateMany({
          where: { usuarioId: id, ativo: true },
          data: { ativo: false, fim: new Date() },
        });
      } else if (data.plano) {
        const { resetPeriodo, ...planoPayload } = data.plano;
        const planoInput = planoPayload as AdminEmpresasPlanoInput;

        if (resetPeriodo || planoPayload.iniciarEm !== undefined) {
          await assignPlanoToEmpresa(tx, id, planoInput);
        } else {
          await atualizarPlanoSemReset(tx, id, planoInput);
        }
      }
    });

    return adminEmpresasService.get(id);
  },

  list: async ({ page, pageSize, search }: AdminEmpresasListQuery) => {
    const where: Prisma.UsuariosWhereInput = {
      tipoUsuario: TipoUsuario.PESSOA_JURIDICA,
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
      const empresa = attachEnderecoResumo(empresaRaw)!;
      const planoAtual = empresa.planosContratados[0];
      const plano = mapPlanoResumo(planoAtual, referenceDate);
      const diasTeste = planoAtual ? getTipoDePlanoDuracao(planoAtual.tipo) : null;
      const banimento = mapBanimentoResumo(empresa.banimentosRecebidos?.[0] ?? null);

      return {
        id: empresa.id,
        codUsuario: empresa.codUsuario,
        nome: empresa.nomeCompleto,
        email: empresa.email,
        telefone: empresa.telefone,
        avatarUrl: empresa.avatarUrl,
        cnpj: empresa.cnpj ?? null,
        cidade: empresa.cidade,
        estado: empresa.estado,
        enderecos: empresa.enderecos,
        criadoEm: empresa.criadoEm,
        ativa: empresa.status === Status.ATIVO,
        parceira: planoAtual ? isTipoDePlanoElegivel(planoAtual.tipo) : false,
        diasTesteDisponibilizados: diasTeste,
        plano,
        vagasPublicadas: empresa._count?.vagasCriadas ?? 0,
        limiteVagasPlano: plano?.quantidadeVagas ?? null,
        banida: Boolean(banimento),
        banimentoAtivo: banimento,
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

    if (!empresaRecord || empresaRecord.tipoUsuario !== TipoUsuario.PESSOA_JURIDICA) {
      return null;
    }

    const empresa = attachEnderecoResumo(empresaRecord)!;

    const planoAtual = empresa.planosContratados[0];
    const plano = mapPlanoResumo(planoAtual);
    const diasTeste = planoAtual ? getTipoDePlanoDuracao(planoAtual.tipo) : null;
    const ultimoPagamentoEm =
      planoAtual?.atualizadoEm ?? planoAtual?.inicio ?? planoAtual?.criadoEm ?? null;
    const banimentoAtivoRegistro = await prisma.empresaBanimento.findFirst({
      where: {
        usuarioId: id,
        fim: { gt: new Date() },
      },
      orderBy: { fim: 'desc' },
      select: banimentoSelect,
    });
    const banimentoAtivo = mapBanimentoResumo(banimentoAtivoRegistro);

    return {
      id: empresa.id,
      codUsuario: empresa.codUsuario,
      nome: empresa.nomeCompleto,
      email: empresa.email,
      telefone: empresa.telefone,
      avatarUrl: empresa.avatarUrl,
      cnpj: empresa.cnpj ?? null,
      descricao: empresa.descricao,
      instagram: empresa.instagram,
      linkedin: empresa.linkedin,
      cidade: empresa.cidade,
      estado: empresa.estado,
      enderecos: empresa.enderecos,
      criadoEm: empresa.criadoEm,
      status: empresa.status,
      ultimoLogin: empresa.ultimoLogin ?? null,
      ativa: empresa.status === Status.ATIVO,
      parceira: planoAtual ? isTipoDePlanoElegivel(planoAtual.tipo) : false,
      diasTesteDisponibilizados: diasTeste,
      plano,
      vagas: {
        publicadas: empresa._count?.vagasCriadas ?? 0,
        limitePlano: plano?.quantidadeVagas ?? null,
      },
      banida: Boolean(banimentoAtivo),
      pagamento: {
        modelo: planoAtual?.modeloPagamento ?? null,
        metodo: planoAtual?.metodoPagamento ?? null,
        status: planoAtual?.statusPagamento ?? null,
        ultimoPagamentoEm,
      },
      banimentoAtivo,
    };
  },

  listPagamentos: async (id: string, { page, pageSize }: AdminEmpresasHistoryQuery) => {
    await ensureEmpresaExiste(prisma, id);

    const skip = (page - 1) * pageSize;

    const planosIds = await prisma.empresasPlano.findMany({
      where: { usuarioId: id },
      select: { id: true },
    });
    const planoIds = planosIds.map((plano) => plano.id);

    const orFilters: Prisma.LogPagamentoWhereInput['OR'] = [{ usuarioId: id }];
    if (planoIds.length > 0) {
      orFilters.push({ empresasPlanoId: { in: planoIds } });
    }

    const where: Prisma.LogPagamentoWhereInput = { OR: orFilters };

    const [total, logs] = await prisma.$transaction([
      prisma.logPagamento.count({ where }),
      prisma.logPagamento.findMany({
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
      new Set(logs.map((log) => log.empresasPlanoId).filter((value): value is string => Boolean(value))),
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
  },

  listVagas: async (id: string, { page, pageSize, status }: AdminEmpresasVagasQuery) => {
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
        select: {
          id: true,
          codigo: true,
          titulo: true,
          status: true,
          inseridaEm: true,
          atualizadoEm: true,
          inscricoesAte: true,
          modoAnonimo: true,
          modalidade: true,
          regimeDeTrabalho: true,
          paraPcd: true,
        },
      }),
    ]);

    const data: AdminEmpresaJobResumo[] = vagas.map((vaga) => ({
      id: vaga.id,
      codigo: vaga.codigo,
      titulo: vaga.titulo,
      status: vaga.status,
      inseridaEm: vaga.inseridaEm,
      atualizadoEm: vaga.atualizadoEm,
      inscricoesAte: vaga.inscricoesAte ?? null,
      modoAnonimo: vaga.modoAnonimo,
      modalidade: vaga.modalidade,
      regimeDeTrabalho: vaga.regimeDeTrabalho,
      paraPcd: vaga.paraPcd,
    }));

    return {
      data,
      pagination: buildPagination(page, pageSize, total),
    };
  },

  listVagasEmAnalise: async (id: string, query: AdminEmpresasHistoryQuery) =>
    adminEmpresasService.listVagas(id, {
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

      const publishedAt = vagaAtual.inseridaEm ?? new Date();

      return tx.empresasVagas.update({
        where: { id: vagaAtual.id },
        data: {
          status: StatusDeVagas.PUBLICADO,
          inseridaEm: publishedAt,
        },
        select: {
          id: true,
          codigo: true,
          titulo: true,
          status: true,
          inseridaEm: true,
          atualizadoEm: true,
          inscricoesAte: true,
          modoAnonimo: true,
          modalidade: true,
          regimeDeTrabalho: true,
          paraPcd: true,
        },
      });
    });

    return {
      id: vaga.id,
      codigo: vaga.codigo,
      titulo: vaga.titulo,
      status: vaga.status,
      inseridaEm: vaga.inseridaEm,
      atualizadoEm: vaga.atualizadoEm,
      inscricoesAte: vaga.inscricoesAte ?? null,
      modoAnonimo: vaga.modoAnonimo,
      modalidade: vaga.modalidade,
      regimeDeTrabalho: vaga.regimeDeTrabalho,
      paraPcd: vaga.paraPcd,
    } satisfies AdminEmpresaJobResumo;
  },

  aplicarBanimento: async (empresaId: string, adminId: string, input: AdminEmpresasBanInput) => {
    const motivo = sanitizeOptionalValue(input.motivo ?? undefined);
    const inicio = new Date();
    const fim = new Date(inicio.getTime());
    fim.setDate(fim.getDate() + input.dias);

    const banimento = await prisma.$transaction(async (tx) => {
      await ensureEmpresaExiste(tx, empresaId);

      const admin = await tx.usuarios.findUnique({
        where: { id: adminId },
        select: { id: true, role: true },
      });

      if (!admin || !['ADMIN', 'MODERADOR'].includes(admin.role)) {
        throw Object.assign(new Error('Usuário não autorizado a aplicar banimento'), {
          code: 'ADMIN_REQUIRED',
        });
      }

      await tx.usuarios.update({
        where: { id: empresaId },
        data: { status: Status.BANIDO },
      });

      return tx.empresaBanimento.create({
        data: {
          usuarioId: empresaId,
          criadoPorId: adminId,
          dias: input.dias,
          inicio,
          fim,
          ...(motivo !== undefined ? { motivo } : {}),
        },
        select: banimentoSelect,
      });
    });

    return mapBanimentoResumo(banimento);
  },

  listarBanimentos: async (empresaId: string, { page, pageSize }: AdminEmpresasHistoryQuery) => {
    await ensureEmpresaExiste(prisma, empresaId);

    const skip = (page - 1) * pageSize;

    const [total, banimentos] = await prisma.$transaction([
      prisma.empresaBanimento.count({ where: { usuarioId: empresaId } }),
      prisma.empresaBanimento.findMany({
        where: { usuarioId: empresaId },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        select: banimentoSelect,
      }),
    ]);

    return {
      data: banimentos.map(mapBanimentoResumo).filter((item): item is AdminEmpresaBanimentoResumo => Boolean(item)),
      pagination: buildPagination(page, pageSize, total),
    };
  },
};

export type AdminEmpresasListResult = Awaited<ReturnType<typeof adminEmpresasService.list>>;
export type AdminEmpresaDetailResult = Awaited<ReturnType<typeof adminEmpresasService.get>>;
export type AdminEmpresasPagamentosResult = Awaited<
  ReturnType<typeof adminEmpresasService.listPagamentos>
>;
export type AdminEmpresasVagasResult = Awaited<ReturnType<typeof adminEmpresasService.listVagas>>;
export type AdminEmpresaAprovacaoVagaResult = Awaited<
  ReturnType<typeof adminEmpresasService.approveVaga>
>;
export type AdminEmpresasBanimentosResult = Awaited<
  ReturnType<typeof adminEmpresasService.listarBanimentos>
>;
