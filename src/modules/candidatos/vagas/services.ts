import { prisma } from '@/config/prisma';
import {
  Prisma,
  StatusDeVagas,
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Senioridade,
} from '@prisma/client';

type VagasPublicasFilters = {
  page?: number;
  pageSize?: number;
  q?: string;
  modalidade?: ModalidadesDeVagas | ModalidadesDeVagas[];
  regime?: RegimesDeTrabalhos | RegimesDeTrabalhos[];
  senioridade?: Senioridade | Senioridade[];
  areaInteresseId?: number | number[];
  subareaInteresseId?: number | number[];
  cidade?: string;
  estado?: string;
  empresaId?: string;
  codUsuario?: string;
  period?: '24h' | '7d' | '30d';
};

export const vagasPublicasService = {
  list: async (params?: VagasPublicasFilters) => {
    const page = params?.page && params.page > 0 ? params.page : 1;
    const pageSize = params?.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 50) : 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.EmpresasVagasWhereInput = { status: StatusDeVagas.PUBLICADO };
    // Modalidade (1..N)
    if (params?.modalidade) {
      const modalidades = Array.isArray(params.modalidade)
        ? params.modalidade
        : [params.modalidade];
      if (modalidades.length > 0) where.modalidade = { in: modalidades as any };
    }
    // Regime (1..N)
    if (params?.regime) {
      const regimes = Array.isArray(params.regime) ? params.regime : [params.regime];
      if (regimes.length > 0) where.regimeDeTrabalho = { in: regimes as any };
    }
    // Senioridade (1..N)
    if (params?.senioridade) {
      const seniors = Array.isArray(params.senioridade) ? params.senioridade : [params.senioridade];
      if (seniors.length > 0) where.senioridade = { in: seniors as any };
    }
    // Áreas/Subáreas (1..N)
    if (typeof params?.areaInteresseId === 'number') where.areaInteresseId = params.areaInteresseId;
    if (Array.isArray(params?.areaInteresseId) && params.areaInteresseId.length > 0) {
      where.areaInteresseId = { in: params.areaInteresseId };
    }
    if (typeof params?.subareaInteresseId === 'number')
      where.subareaInteresseId = params.subareaInteresseId;
    if (Array.isArray(params?.subareaInteresseId) && params.subareaInteresseId.length > 0) {
      where.subareaInteresseId = { in: params.subareaInteresseId };
    }
    if (params?.q && params.q.trim().length > 1) {
      const q = params.q.trim();
      where.OR = [
        { titulo: { contains: q, mode: 'insensitive' } },
        { Usuarios: { nomeCompleto: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if ((params?.cidade && params.cidade.trim()) || (params?.estado && params.estado.trim())) {
      const cidade = params?.cidade?.trim();
      const estado = params?.estado?.trim();
      // Filtra por endereço da empresa (endereço principal). JSON de localizacao na vaga pode existir,
      // mas usamos o endereço da empresa por compatibilidade com Prisma.
      where.Usuarios = {
        ...(where.Usuarios as any),
        enderecos: {
          some: {
            ...(cidade ? { cidade: { equals: cidade, mode: 'insensitive' as any } } : {}),
            ...(estado ? { estado: { equals: estado, mode: 'insensitive' as any } } : {}),
          },
        },
      };
    }

    if (params?.empresaId && params.empresaId.trim()) {
      where.usuarioId = params.empresaId.trim();
    }
    if (params?.codUsuario && params.codUsuario.trim()) {
      where.Usuarios = {
        ...(where.Usuarios as any),
        codUsuario: { equals: params.codUsuario.trim() },
      };
    }
    if (params?.period) {
      const now = new Date();
      const since = new Date(now);
      if (params.period === '24h') since.setHours(now.getHours() - 24);
      else if (params.period === '7d') since.setDate(now.getDate() - 7);
      else if (params.period === '30d') since.setDate(now.getDate() - 30);
      where.inseridaEm = { gte: since };
    }

    const [total, vagas] = await prisma.$transaction([
      prisma.empresasVagas.count({ where }),
      prisma.empresasVagas.findMany({
        where,
        orderBy: { inseridaEm: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          titulo: true,
          descricao: true,
          inseridaEm: true,
          modalidade: true,
          regimeDeTrabalho: true,
          senioridade: true,
          modoAnonimo: true,
          localizacao: true,
          usuarioId: true,
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              UsuariosInformation: { select: { avatarUrl: true } },
            },
          },
        },
      }),
    ]);

    const data = vagas.map((v) => ({
      id: v.id,
      slug: v.slug,
      titulo: v.titulo,
      descricao: v.descricao,
      inseridaEm: v.inseridaEm,
      modalidade: v.modalidade,
      regimeDeTrabalho: v.regimeDeTrabalho,
      senioridade: v.senioridade,
      cidade: (v.localizacao as any)?.cidade ?? null,
      estado: (v.localizacao as any)?.estado ?? null,
      empresa: v.modoAnonimo
        ? { id: null, nome: 'Oportunidade Confidencial', avatarUrl: null }
        : {
            id: v.Usuarios?.id ?? null,
            nome: v.Usuarios?.nomeCompleto ?? null,
            avatarUrl: v.Usuarios?.UsuariosInformation?.avatarUrl ?? null,
          },
    }));

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
};
