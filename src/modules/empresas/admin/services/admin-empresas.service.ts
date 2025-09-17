import {
  METODO_PAGAMENTO,
  MODELO_PAGAMENTO,
  STATUS_PAGAMENTO,
  Prisma,
  StatusVaga,
  TipoUsuario,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  getPlanoParceiroDuracao,
  isPlanoParceiroElegivel,
  mapPlanoParceiroToClienteTipo,
} from '@/modules/empresas/shared/plano-parceiro';
import type { AdminEmpresasListQuery } from '@/modules/empresas/admin/validators/admin-empresas.schema';

const planoAtivoSelect = {
  where: { ativo: true },
  orderBy: [{ inicio: 'desc' as const }, { criadoEm: 'desc' as const }],
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
        quantidadeVagas: true,
      },
    },
  },
} as const;

const usuarioListSelect = {
  id: true,
  codUsuario: true,
  nomeCompleto: true,
  avatarUrl: true,
  cidade: true,
  estado: true,
  criadoEm: true,
  planosContratados: planoAtivoSelect,
} as const;

const usuarioDetailSelect = {
  id: true,
  codUsuario: true,
  nomeCompleto: true,
  avatarUrl: true,
  descricao: true,
  instagram: true,
  linkedin: true,
  cidade: true,
  estado: true,
  criadoEm: true,
  tipoUsuario: true,
  planosContratados: planoAtivoSelect,
  _count: {
    select: {
      vagasCriadas: {
        where: {
          status: StatusVaga.PUBLICADO,
        },
      },
    },
  },
} as const;

type UsuarioListResult = Prisma.UsuarioGetPayload<{ select: typeof usuarioListSelect }>;
type PlanoResumoData = UsuarioListResult['planosContratados'][number];

type AdminEmpresaPlanoResumo = {
  id: string;
  nome: string | null;
  tipo: string;
  inicio: Date | null;
  fim: Date | null;
  modeloPagamento: MODELO_PAGAMENTO | null;
  metodoPagamento: METODO_PAGAMENTO | null;
  statusPagamento: STATUS_PAGAMENTO | null;
  quantidadeVagas: number | null;
};

type AdminEmpresaListItem = {
  id: string;
  codUsuario: string;
  nome: string;
  avatarUrl: string | null;
  cidade: string | null;
  estado: string | null;
  criadoEm: Date;
  parceira: boolean;
  diasTesteDisponibilizados: number | null;
  plano: AdminEmpresaPlanoResumo | null;
};

type AdminEmpresaDetail = {
  id: string;
  codUsuario: string;
  nome: string;
  avatarUrl: string | null;
  descricao: string | null;
  instagram: string | null;
  linkedin: string | null;
  cidade: string | null;
  estado: string | null;
  criadoEm: Date;
  parceira: boolean;
  diasTesteDisponibilizados: number | null;
  plano: AdminEmpresaPlanoResumo | null;
  vagas: {
    publicadas: number;
    limitePlano: number | null;
  };
  pagamento: {
    modelo: MODELO_PAGAMENTO | null;
    metodo: METODO_PAGAMENTO | null;
    status: STATUS_PAGAMENTO | null;
    ultimoPagamentoEm: Date | null;
  };
};

const buildSearchFilter = (search?: string): Prisma.UsuarioWhereInput => {
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

const mapPlanoResumo = (plano?: PlanoResumoData): AdminEmpresaPlanoResumo | null => {
  if (!plano) {
    return null;
  }

  return {
    id: plano.id,
    nome: plano.plano?.nome ?? null,
    tipo: mapPlanoParceiroToClienteTipo(plano.tipo),
    inicio: plano.inicio,
    fim: plano.fim,
    modeloPagamento: plano.modeloPagamento ?? null,
    metodoPagamento: plano.metodoPagamento ?? null,
    statusPagamento: plano.statusPagamento ?? null,
    quantidadeVagas: plano.plano?.quantidadeVagas ?? null,
  };
};

export const adminEmpresasService = {
  list: async ({ page, pageSize, search }: AdminEmpresasListQuery) => {
    const where: Prisma.UsuarioWhereInput = {
      tipoUsuario: TipoUsuario.PESSOA_JURIDICA,
      ...buildSearchFilter(search),
    };

    const skip = (page - 1) * pageSize;

    const [total, empresas] = await prisma.$transaction([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        select: usuarioListSelect,
      }),
    ]);

    const data: AdminEmpresaListItem[] = empresas.map((empresa) => {
      const planoAtual = empresa.planosContratados[0];
      const plano = mapPlanoResumo(planoAtual);
      const diasTeste = planoAtual ? getPlanoParceiroDuracao(planoAtual.tipo) : null;

      return {
        id: empresa.id,
        codUsuario: empresa.codUsuario,
        nome: empresa.nomeCompleto,
        avatarUrl: empresa.avatarUrl,
        cidade: empresa.cidade,
        estado: empresa.estado,
        criadoEm: empresa.criadoEm,
        parceira: planoAtual ? isPlanoParceiroElegivel(planoAtual.tipo) : false,
        diasTesteDisponibilizados: diasTeste,
        plano,
      };
    });

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  },

  get: async (id: string): Promise<AdminEmpresaDetail | null> => {
    const empresa = await prisma.usuario.findUnique({
      where: { id },
      select: usuarioDetailSelect,
    });

    if (!empresa || empresa.tipoUsuario !== TipoUsuario.PESSOA_JURIDICA) {
      return null;
    }

    const planoAtual = empresa.planosContratados[0];
    const plano = mapPlanoResumo(planoAtual);
    const diasTeste = planoAtual ? getPlanoParceiroDuracao(planoAtual.tipo) : null;
    const ultimoPagamentoEm =
      planoAtual?.atualizadoEm ?? planoAtual?.inicio ?? planoAtual?.criadoEm ?? null;

    return {
      id: empresa.id,
      codUsuario: empresa.codUsuario,
      nome: empresa.nomeCompleto,
      avatarUrl: empresa.avatarUrl,
      descricao: empresa.descricao,
      instagram: empresa.instagram,
      linkedin: empresa.linkedin,
      cidade: empresa.cidade,
      estado: empresa.estado,
      criadoEm: empresa.criadoEm,
      parceira: planoAtual ? isPlanoParceiroElegivel(planoAtual.tipo) : false,
      diasTesteDisponibilizados: diasTeste,
      plano,
      vagas: {
        publicadas: empresa._count?.vagasCriadas ?? 0,
        limitePlano: plano?.quantidadeVagas ?? null,
      },
      pagamento: {
        modelo: planoAtual?.modeloPagamento ?? null,
        metodo: planoAtual?.metodoPagamento ?? null,
        status: planoAtual?.statusPagamento ?? null,
        ultimoPagamentoEm,
      },
    };
  },
};

export type AdminEmpresasListResult = Awaited<ReturnType<typeof adminEmpresasService.list>>;
export type AdminEmpresaDetailResult = Awaited<ReturnType<typeof adminEmpresasService.get>>;
