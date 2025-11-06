import { CursoStatus, CursosStatusPadrao, Prisma, StatusInscricao, Status } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { traduzirModelosPrisma } from '../utils/avaliacao';
import { generateUniqueCourseCode } from '../utils/code-generator';
import { AulaWithMateriais, aulaWithMateriaisInclude, mapAula } from './aulas.mapper';
import { ModuloWithRelations, moduloDetailedInclude, mapModulo } from './modulos.mapper';
import { ProvaWithRelations, mapProva, provaDefaultInclude } from './provas.mapper';

const cursosLogger = logger.child({ module: 'CursosService' });

const publicCursoStatuses: CursosStatusPadrao[] = [CursosStatusPadrao.PUBLICADO];

const publicTurmaStatuses: CursoStatus[] = [
  CursoStatus.PUBLICADO,
  CursoStatus.INSCRICOES_ABERTAS,
  CursoStatus.INSCRICOES_ENCERRADAS,
  CursoStatus.EM_ANDAMENTO,
];

const categoriaSelect = {
  id: true,
  codCategoria: true,
  nome: true,
  descricao: true,
} as const;

const subcategoriaSelect = {
  id: true,
  codSubcategoria: true,
  nome: true,
  descricao: true,
} as const;

const turmaSummarySelect = {
  id: true,
  codigo: true,
  nome: true,
  turno: true,
  metodo: true,
  status: true,
  vagasTotais: true,
  vagasDisponiveis: true,
  dataInicio: true,
  dataFim: true,
  dataInscricaoInicio: true,
  dataInscricaoFim: true,
} as const;

const regrasAvaliacaoSelect = {
  mediaMinima: true,
  politicaRecuperacaoAtiva: true,
  modelosRecuperacao: true,
  ordemAplicacaoRecuperacao: true,
  notaMaximaRecuperacao: true,
  pesoProvaFinal: true,
  observacoes: true,
} as const;

const turmaDetailedInclude = Prisma.validator<Prisma.CursosTurmasDefaultArgs>()({
  include: {
    CursosTurmasInscricoes: {
      include: {
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            UsuariosInformation: {
              select: { inscricao: true, telefone: true },
            },
            UsuariosEnderecos: {
              select: {
                logradouro: true,
                numero: true,
                bairro: true,
                cidade: true,
                estado: true,
                cep: true,
              },
              take: 1,
            },
          },
        },
      },
    },
    CursosTurmasAulas: {
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      include: aulaWithMateriaisInclude.include,
    },
    CursosTurmasModulos: {
      include: moduloDetailedInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    CursosTurmasProvas: {
      include: provaDefaultInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    CursosTurmasRegrasAvaliacao: { select: regrasAvaliacaoSelect },
  },
});

const buildPublicTurmaWhere = (referenceDate: Date): Prisma.CursosTurmasWhereInput => ({
  status: { in: publicTurmaStatuses },
  OR: [{ dataInscricaoFim: { equals: null } }, { dataInscricaoFim: { gte: referenceDate } }],
});

const turmaPublicInclude = Prisma.validator<Prisma.CursosTurmasDefaultArgs>()({
  include: {
    CursosTurmasAulas: {
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      include: aulaWithMateriaisInclude.include,
    },
    CursosTurmasModulos: {
      include: moduloDetailedInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    CursosTurmasProvas: {
      include: provaDefaultInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    CursosTurmasRegrasAvaliacao: { select: regrasAvaliacaoSelect },
  },
});

type TurmaSummaryPayload = Prisma.CursosTurmasGetPayload<{ select: typeof turmaSummarySelect }>;
type TurmaDetailedPayload = Prisma.CursosTurmasGetPayload<typeof turmaDetailedInclude>;
type TurmaPublicPayload = Prisma.CursosTurmasGetPayload<typeof turmaPublicInclude>;
type RawCourseBase = Prisma.CursosGetPayload<{
  include: {
    CursosCategorias: { select: typeof categoriaSelect };
    CursosSubcategorias: { select: typeof subcategoriaSelect };
    CursosTurmas: { select: typeof turmaSummarySelect } | typeof turmaDetailedInclude;
    _count: { select: { CursosTurmas: true } };
  };
}>;
type RawCourse = Omit<RawCourseBase, 'CursosTurmas' | '_count'> & {
  CursosTurmas?: (TurmaSummaryPayload | TurmaDetailedPayload)[];
  _count?: { CursosTurmas: number };
  CursosCategorias?: RawCourseBase['CursosCategorias'];
  CursosSubcategorias?: RawCourseBase['CursosSubcategorias'];
  categoria?: RawCourseBase['CursosCategorias'];
  subcategoria?: RawCourseBase['CursosSubcategorias'];
};

type CourseListParams = {
  page: number;
  pageSize: number;
  search?: string;
  statusPadrao?: CursosStatusPadrao[];
  categoriaId?: number;
  subcategoriaId?: number;
  instrutorId?: string;
  includeTurmas?: boolean;
};

const mapTurmaSummary = (
  turma: Prisma.CursosTurmasGetPayload<{ select: typeof turmaSummarySelect }>,
) => ({
  id: turma.id,
  codigo: turma.codigo,
  nome: turma.nome,
  turno: turma.turno,
  metodo: turma.metodo,
  status: turma.status,
  vagasTotais: turma.vagasTotais,
  vagasDisponiveis: turma.vagasDisponiveis,
  dataInicio: turma.dataInicio?.toISOString() ?? null,
  dataFim: turma.dataFim?.toISOString() ?? null,
  dataInscricaoInicio: turma.dataInscricaoInicio?.toISOString() ?? null,
  dataInscricaoFim: turma.dataInscricaoFim?.toISOString() ?? null,
});

/**
 * Mapeia turma summary com contagem de inscrições ativas
 * ✅ Otimização: Adiciona campos calculados de inscrições
 */
export const mapTurmaSummaryWithInscricoes = (
  turma: Prisma.CursosTurmasGetPayload<{ select: typeof turmaSummarySelect }>,
  inscricoesCount: number,
) => ({
  ...mapTurmaSummary(turma),
  inscricoesCount,
  vagasOcupadas: inscricoesCount,
  vagasDisponiveisCalculadas: turma.vagasTotais - inscricoesCount,
});

const mapRegrasAvaliacao = (
  regras?: Prisma.CursosTurmasRegrasAvaliacaoGetPayload<{
    select: typeof regrasAvaliacaoSelect;
  }> | null,
) => {
  if (!regras) {
    return null;
  }

  return {
    mediaMinima: Number(regras.mediaMinima),
    politicaRecuperacaoAtiva: regras.politicaRecuperacaoAtiva,
    modelosRecuperacao: traduzirModelosPrisma(regras.modelosRecuperacao),
    ordemAplicacaoRecuperacao: traduzirModelosPrisma(regras.ordemAplicacaoRecuperacao),
    notaMaximaRecuperacao: regras.notaMaximaRecuperacao
      ? Number(regras.notaMaximaRecuperacao)
      : null,
    pesoProvaFinal: regras.pesoProvaFinal ? Number(regras.pesoProvaFinal) : null,
    observacoes: regras.observacoes ?? null,
  };
};

const mapTurmaDetailed = (turma: TurmaDetailedPayload) => {
  const modulos = (turma.CursosTurmasModulos || (turma as any).modulos || []) as unknown as ModuloWithRelations[];
  const aulas = (turma.CursosTurmasAulas || (turma as any).aulas || []) as unknown as AulaWithMateriais[];
  const provas = (turma.CursosTurmasProvas || (turma as any).provas || []) as unknown as ProvaWithRelations[];

  return {
    id: turma.id,
    codigo: turma.codigo,
    nome: turma.nome,
    turno: turma.turno,
    metodo: turma.metodo,
    status: turma.status,
    vagasTotais: turma.vagasTotais,
    vagasDisponiveis: turma.vagasDisponiveis,
    dataInicio: turma.dataInicio?.toISOString() ?? null,
    dataFim: turma.dataFim?.toISOString() ?? null,
    dataInscricaoInicio: turma.dataInscricaoInicio?.toISOString() ?? null,
    dataInscricaoFim: turma.dataInscricaoFim?.toISOString() ?? null,
    alunos: (turma.CursosTurmasInscricoes || (turma as any).inscricoes || []).map((inscricao: any) => {
      const aluno = inscricao.Usuarios || inscricao.aluno;
      const endereco = aluno?.UsuariosEnderecos?.[0];

      return {
        id: aluno?.id,
        nome: aluno?.nomeCompleto,
        email: aluno?.email,
        inscricao: aluno?.UsuariosInformation?.inscricao ?? null,
        telefone: aluno?.UsuariosInformation?.telefone ?? null,
        endereco: endereco
          ? {
              logradouro: endereco.logradouro ?? null,
              numero: endereco.numero ?? null,
              bairro: endereco.bairro ?? null,
              cidade: endereco.cidade ?? null,
              estado: endereco.estado ?? null,
              cep: endereco.cep ?? null,
            }
          : null,
      };
    }),
    modulos: modulos.map(mapModulo),
    aulas: aulas.filter((aula) => aula.moduloId === null).map(mapAula),
    provas: provas.filter((prova) => prova.moduloId === null).map(mapProva),
    regrasAvaliacao: mapRegrasAvaliacao((turma as any).CursosTurmasRegrasAvaliacao || (turma as any).regrasAvaliacao || null),
  };
};

const mapTurmaPublic = (turma: TurmaPublicPayload) => {
  const modulos = (turma.CursosTurmasModulos || (turma as any).modulos || []) as unknown as ModuloWithRelations[];
  const aulas = (turma.CursosTurmasAulas || (turma as any).aulas || []) as unknown as AulaWithMateriais[];
  const provas = (turma.CursosTurmasProvas || (turma as any).provas || []) as unknown as ProvaWithRelations[];

  return {
    id: turma.id,
    codigo: turma.codigo,
    nome: turma.nome,
    turno: turma.turno,
    metodo: turma.metodo,
    status: turma.status,
    vagasTotais: turma.vagasTotais,
    vagasDisponiveis: turma.vagasDisponiveis,
    dataInicio: turma.dataInicio?.toISOString() ?? null,
    dataFim: turma.dataFim?.toISOString() ?? null,
    dataInscricaoInicio: turma.dataInscricaoInicio?.toISOString() ?? null,
    dataInscricaoFim: turma.dataInscricaoFim?.toISOString() ?? null,
    modulos: modulos.map(mapModulo),
    aulas: aulas.filter((aula) => aula.moduloId === null).map(mapAula),
    provas: provas.filter((prova) => prova.moduloId === null).map(mapProva),
    regrasAvaliacao: mapRegrasAvaliacao((turma as any).CursosTurmasRegrasAvaliacao || (turma as any).regrasAvaliacao || null),
  };
};

const mapCourse = async (course: RawCourse) => {
  const turmas = Array.isArray(course.CursosTurmas)
    ? (course.CursosTurmas as (TurmaSummaryPayload | TurmaDetailedPayload)[])
    : undefined;

  const categoria = (course as any).CursosCategorias || course.categoria;
  const subcategoria = (course as any).CursosSubcategorias || course.subcategoria;

  // ✅ Otimização: Se há turmas, calcular contagem de inscrições em batch
  let turmasWithInscricoes = undefined;
  if (turmas && turmas.length > 0) {
    try {
      const turmaIds = turmas.map((t) => t.id);
      const inscricoesCountMap = await countInscricoesAtivasPorTurma(turmaIds);

      turmasWithInscricoes = turmas.map((turma) => {
        const hasDetailedData = 'inscricoes' in turma || 'CursosTurmasInscricoes' in turma;
        if (hasDetailedData) {
          // Turma detalhada já tem inscrições, mas adicionamos contagem calculada
          const detailed = mapTurmaDetailed(turma as any);
          const inscricoesCount = inscricoesCountMap[turma.id] || 0;
          return {
            ...detailed,
            inscricoesCount: inscricoesCount ?? 0,
            vagasOcupadas: inscricoesCount ?? 0,
            vagasDisponiveisCalculadas: (turma.vagasTotais ?? 0) - (inscricoesCount ?? 0),
          };
        } else {
          // Turma summary: usar mapper com inscrições
          const inscricoesCount = inscricoesCountMap[turma.id] || 0;
          return mapTurmaSummaryWithInscricoes(turma, inscricoesCount);
        }
      });
    } catch (error) {
      // Se falhar ao calcular inscrições, retornar turmas sem contagem
      cursosLogger.warn(
        { error: error instanceof Error ? error.message : String(error), turmasCount: turmas.length },
        '⚠️ Erro ao calcular contagem de inscrições, retornando turmas sem contagem',
      );
      turmasWithInscricoes = turmas.map((turma) => {
        const hasDetailedData = 'inscricoes' in turma || 'CursosTurmasInscricoes' in turma;
        return hasDetailedData ? mapTurmaDetailed(turma as any) : mapTurmaSummary(turma);
      });
    }
  }

  return {
    id: course.id,
    codigo: course.codigo,
    nome: course.nome,
    descricao: course.descricao ?? null,
    imagemUrl: course.imagemUrl ?? null,
    cargaHoraria: course.cargaHoraria,
    estagioObrigatorio: course.estagioObrigatorio,
    statusPadrao: course.statusPadrao,
    categoriaId: course.categoriaId ?? null,
    subcategoriaId: course.subcategoriaId ?? null,
    categoria: categoria
      ? {
          id: categoria.id,
          codCategoria: categoria.codCategoria,
          nome: categoria.nome,
          descricao: categoria.descricao ?? null,
        }
      : null,
    subcategoria: subcategoria
      ? {
          id: subcategoria.id,
          codSubcategoria: subcategoria.codSubcategoria,
          nome: subcategoria.nome,
          descricao: subcategoria.descricao ?? null,
        }
      : null,
    criadoEm: course.criadoEm.toISOString(),
    atualizadoEm: course.atualizadoEm.toISOString(),
    turmas: turmasWithInscricoes,
    turmasCount: course._count?.CursosTurmas ?? undefined,
  };
};

/**
 * Conta inscrições ativas por turma usando agregação SQL eficiente
 * Reutiliza a mesma lógica do turmas.service.ts
 */
async function countInscricoesAtivasPorTurma(
  turmaIds: string[],
): Promise<Record<string, number>> {
  if (turmaIds.length === 0) {
    return {};
  }

  // Construir a query com IN ao invés de ANY para evitar problemas de tipo
  const placeholders = turmaIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await prisma.$queryRawUnsafe<Array<{ turmaId: string; count: bigint }>>(
    `SELECT 
      ti."turmaId"::text as "turmaId",
      COUNT(*)::int as count
    FROM "CursosTurmasInscricoes" ti
    INNER JOIN "Usuarios" u ON ti."alunoId" = u.id
    WHERE 
      ti."turmaId"::text IN (${placeholders})
      AND ti.status NOT IN ('CANCELADO', 'TRANCADO')
      AND u.status = 'ATIVO'
    GROUP BY ti."turmaId"`,
    ...turmaIds,
  );

  const countMap: Record<string, number> = {};
  for (const row of result) {
    countMap[row.turmaId] = Number(row.count);
  }

  for (const turmaId of turmaIds) {
    if (!(turmaId in countMap)) {
      countMap[turmaId] = 0;
    }
  }

  return countMap;
}

const mapPublicCourse = (
  course: Prisma.CursosGetPayload<{
    include?: {
      CursosCategorias?: { select: typeof categoriaSelect };
      CursosSubcategorias?: { select: typeof subcategoriaSelect };
      CursosTurmas?: typeof turmaPublicInclude;
    };
    select?: {
      CursosCategorias?: { select: typeof categoriaSelect };
      CursosSubcategorias?: { select: typeof subcategoriaSelect };
      CursosTurmas?: any;
    };
  }>,
) => {
  const categoria = (course as any).CursosCategorias || (course as any).categoria;
  const subcategoria = (course as any).CursosSubcategorias || (course as any).subcategoria;
  const turmas = (course as any).CursosTurmas || [];

  // ✅ Se as turmas já têm inscricoesCount (calculado antes), preservar
  const turmasMapeadas = turmas.map((turma: any) => {
    const turmaPublica = mapTurmaPublic(turma as TurmaPublicPayload);
    // Se já tem inscricoesCount calculado, adicionar aos campos
    if ('inscricoesCount' in turma) {
      return {
        ...turmaPublica,
        inscricoesCount: turma.inscricoesCount,
        vagasOcupadas: turma.vagasOcupadas,
        vagasDisponiveisCalculadas: turma.vagasDisponiveisCalculadas,
      };
    }
    return turmaPublica;
  });

  return {
    id: course.id,
    codigo: course.codigo,
    nome: course.nome,
    descricao: course.descricao ?? null,
    imagemUrl: course.imagemUrl ?? null,
    cargaHoraria: course.cargaHoraria,
    estagioObrigatorio: course.estagioObrigatorio,
    statusPadrao: course.statusPadrao,
    categoria: categoria
      ? {
          id: categoria.id,
          codCategoria: categoria.codCategoria,
          nome: categoria.nome,
          descricao: categoria.descricao ?? null,
        }
      : null,
    subcategoria: subcategoria
      ? {
          id: subcategoria.id,
          codSubcategoria: subcategoria.codSubcategoria,
          nome: subcategoria.nome,
          descricao: subcategoria.descricao ?? null,
        }
      : null,
    turmas: turmasMapeadas,
  };
};

// Removido: validação de instrutor para criação de cursos

const statusLabels: Record<CursosStatusPadrao, string> = {
  PUBLICADO: 'Publicado',
  RASCUNHO: 'Rascunho',
};

export const cursosService = {
  async list(params: CourseListParams) {
    const {
      page,
      pageSize,
      search,
      statusPadrao,
      categoriaId,
      subcategoriaId,
      instrutorId,
      includeTurmas,
    } = params;

    const where: Prisma.CursosWhereInput = {};

    if (statusPadrao?.length) {
      where.statusPadrao = { in: statusPadrao };
    }

    if (categoriaId) {
      where.categoriaId = categoriaId;
    }

    if (subcategoriaId) {
      where.subcategoriaId = subcategoriaId;
    }

    if (instrutorId) {
      where.CursosTurmas = { some: { instrutorId } };
    }

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const statusAggregationWhere: Prisma.CursosWhereInput = {
      ...where,
    };
    delete (statusAggregationWhere as any).statusPadrao;

    const [total, statusAggregation] = await Promise.all([
      prisma.cursos.count({ where }),
      prisma.cursos.groupBy({
        by: ['statusPadrao'],
        _count: { _all: true },
        where: statusAggregationWhere,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const courses = await prisma.cursos.findMany({
      where,
      include: {
        CursosCategorias: { select: categoriaSelect },
        CursosSubcategorias: { select: subcategoriaSelect },
        CursosTurmas: includeTurmas ? { select: turmaSummarySelect } : undefined,
        _count: { select: { CursosTurmas: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: pageSize,
    });

    const hasNext = totalPages > 0 && safePage < totalPages;
    const hasPrevious = safePage > 1;

    const statusSummary = statusAggregation
      .map((item) => ({
        value: item.statusPadrao,
        label: statusLabels[item.statusPadrao] ?? item.statusPadrao,
        total: item._count._all,
        selected: statusPadrao?.includes(item.statusPadrao) ?? false,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // ✅ Corrigido: mapCourse é assíncrono, precisa usar Promise.all
    // Se includeTurmas, calcular contagem de inscrições em batch
    let mappedCourses;
    if (includeTurmas && courses.length > 0) {
      // Se há turmas, calcular contagem em batch e mapear
      const todasTurmas = courses.flatMap((curso) => (curso as any).CursosTurmas || []);
      const turmaIds = todasTurmas.map((t) => t.id);
      const inscricoesCountMap =
        turmaIds.length > 0 ? await countInscricoesAtivasPorTurma(turmaIds) : {};

      mappedCourses = courses.map((course) => {
        const turmas = (course as any).CursosTurmas || [];
        const turmasComInscricoes = turmas.map((turma: any) => {
          const inscricoesCount = inscricoesCountMap[turma.id] || 0;
          return mapTurmaSummaryWithInscricoes(turma, inscricoesCount);
        });

        const categoria = course.CursosCategorias;
        const subcategoria = course.CursosSubcategorias;

        return {
          id: course.id,
          codigo: course.codigo,
          nome: course.nome,
          descricao: course.descricao ?? null,
          imagemUrl: course.imagemUrl ?? null,
          cargaHoraria: course.cargaHoraria,
          estagioObrigatorio: course.estagioObrigatorio,
          statusPadrao: course.statusPadrao,
          categoriaId: course.categoriaId ?? null,
          subcategoriaId: course.subcategoriaId ?? null,
          categoria: categoria
            ? {
                id: categoria.id,
                codCategoria: categoria.codCategoria,
                nome: categoria.nome,
                descricao: categoria.descricao ?? null,
              }
            : null,
          subcategoria: subcategoria
            ? {
                id: subcategoria.id,
                codSubcategoria: subcategoria.codSubcategoria,
                nome: subcategoria.nome,
                descricao: subcategoria.descricao ?? null,
              }
            : null,
          criadoEm: course.criadoEm.toISOString(),
          atualizadoEm: course.atualizadoEm.toISOString(),
          turmas: turmasComInscricoes,
          turmasCount: course._count?.CursosTurmas ?? undefined,
        };
      });
    } else {
      // Sem turmas, mapear normalmente (síncrono)
      mappedCourses = courses.map((course) => {
        const categoria = course.CursosCategorias;
        const subcategoria = course.CursosSubcategorias;

        return {
          id: course.id,
          codigo: course.codigo,
          nome: course.nome,
          descricao: course.descricao ?? null,
          imagemUrl: course.imagemUrl ?? null,
          cargaHoraria: course.cargaHoraria,
          estagioObrigatorio: course.estagioObrigatorio,
          statusPadrao: course.statusPadrao,
          categoriaId: course.categoriaId ?? null,
          subcategoriaId: course.subcategoriaId ?? null,
          categoria: categoria
            ? {
                id: categoria.id,
                codCategoria: categoria.codCategoria,
                nome: categoria.nome,
                descricao: categoria.descricao ?? null,
              }
            : null,
          subcategoria: subcategoria
            ? {
                id: subcategoria.id,
                codSubcategoria: subcategoria.codSubcategoria,
                nome: subcategoria.nome,
                descricao: subcategoria.descricao ?? null,
              }
            : null,
          criadoEm: course.criadoEm.toISOString(),
          atualizadoEm: course.atualizadoEm.toISOString(),
          turmas: undefined,
          turmasCount: course._count?.CursosTurmas ?? undefined,
        };
      });
    }

    return {
      data: mappedCourses,
      pagination: {
        page: safePage,
        requestedPage: page,
        pageSize,
        total,
        totalItems: total,
        totalPages: totalPages || 1,
        hasNext,
        hasPrevious,
        isPageAdjusted: safePage !== page,
      },
      filters: {
        applied: {
          search: search ?? null,
          statusPadrao: statusPadrao ?? [],
          categoriaId: categoriaId ?? null,
          subcategoriaId: subcategoriaId ?? null,
          instrutorId: instrutorId ?? null,
        },
        summary: {
          statusPadrao: statusSummary,
        },
      },
      meta: {
        empty: courses.length === 0,
      },
    };
  },

  async getById(id: string) {
    const course = await prisma.cursos.findUnique({
      where: { id },
      include: {
        CursosCategorias: { select: categoriaSelect },
        CursosSubcategorias: { select: subcategoriaSelect },
        CursosTurmas: {
          include: {
            CursosTurmasInscricoes: {
              include: {
                Usuarios: {
                  select: {
                    id: true,
                    nomeCompleto: true,
                    email: true,
                    UsuariosInformation: {
                      select: { inscricao: true, telefone: true },
                    },
                    UsuariosEnderecos: {
                      select: {
                        logradouro: true,
                        numero: true,
                        bairro: true,
                        cidade: true,
                        estado: true,
                        cep: true,
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
            CursosTurmasAulas: {
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
              include: aulaWithMateriaisInclude.include,
            },
            CursosTurmasModulos: {
              include: moduloDetailedInclude.include,
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
            },
            CursosTurmasProvas: {
              include: provaDefaultInclude.include,
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
            },
            CursosTurmasRegrasAvaliacao: { select: regrasAvaliacaoSelect },
          },
          orderBy: { criadoEm: 'desc' },
        },
        _count: { select: { CursosTurmas: true } },
      },
    });

    if (!course) {
      return null;
    }

    return await mapCourse(course);
  },

  async listPublic() {
    const referenceDate = new Date();

    const cursos = await prisma.cursos.findMany({
      where: {
        statusPadrao: { in: publicCursoStatuses },
        CursosTurmas: { some: buildPublicTurmaWhere(referenceDate) },
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
        descricao: true,
        imagemUrl: true,
        cargaHoraria: true,
        estagioObrigatorio: true,
        statusPadrao: true,
        CursosCategorias: { select: categoriaSelect },
        CursosSubcategorias: { select: subcategoriaSelect },
        CursosTurmas: {
          select: turmaSummarySelect,
          where: buildPublicTurmaWhere(referenceDate),
          orderBy: { criadoEm: 'desc' },
        },
      },
      orderBy: { nome: 'asc' },
    });

    // ✅ Otimização: Calcular contagem de inscrições em batch para todas as turmas
    const todasTurmas = cursos.flatMap((curso) => (curso as any).CursosTurmas || []);
    const turmaIds = todasTurmas.map((t) => t.id);
    const inscricoesCountMap =
      turmaIds.length > 0 ? await countInscricoesAtivasPorTurma(turmaIds) : {};

    return cursos.map((curso) => {
      const categoria = (curso as any).CursosCategorias;
      const subcategoria = (curso as any).CursosSubcategorias;

      return {
        id: curso.id,
        codigo: curso.codigo,
        nome: curso.nome,
        descricao: curso.descricao,
        imagemUrl: curso.imagemUrl ?? null,
        cargaHoraria: curso.cargaHoraria,
        estagioObrigatorio: curso.estagioObrigatorio,
        statusPadrao: curso.statusPadrao,
        categoria: categoria
          ? {
              id: categoria.id,
              codCategoria: categoria.codCategoria,
              nome: categoria.nome,
              descricao: categoria.descricao ?? null,
            }
          : null,
        subcategoria: subcategoria
          ? {
              id: subcategoria.id,
              codSubcategoria: subcategoria.codSubcategoria,
              nome: subcategoria.nome,
              descricao: subcategoria.descricao ?? null,
            }
          : null,
        turmas: ((curso as any).CursosTurmas || []).map((turma: any) => {
          const inscricoesCount = inscricoesCountMap[turma.id] || 0;
          return mapTurmaSummaryWithInscricoes(turma, inscricoesCount);
        }),
      };
    });
  },

  async getPublicById(id: string) {
    const referenceDate = new Date();

    const curso = await prisma.cursos.findFirst({
      where: {
        id,
        statusPadrao: { in: publicCursoStatuses },
        CursosTurmas: { some: buildPublicTurmaWhere(referenceDate) },
      },
      include: {
        CursosCategorias: { select: categoriaSelect },
        CursosSubcategorias: { select: subcategoriaSelect },
        CursosTurmas: {
          include: {
            CursosTurmasAulas: {
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
              include: aulaWithMateriaisInclude.include,
            },
            CursosTurmasModulos: {
              include: moduloDetailedInclude.include,
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
            },
            CursosTurmasProvas: {
              include: provaDefaultInclude.include,
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
            },
            CursosTurmasRegrasAvaliacao: { select: regrasAvaliacaoSelect },
          },
          where: buildPublicTurmaWhere(referenceDate),
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    if (!curso) {
      return null;
    }

    // ✅ Otimização: Adicionar contagem de inscrições nas turmas públicas
    const cursoComInscricoes = await (async () => {
      const turmas = (curso as any).CursosTurmas as any[];
      if (turmas && turmas.length > 0) {
        const turmaIds = turmas.map((t) => t.id);
        const inscricoesCountMap = await countInscricoesAtivasPorTurma(turmaIds);
        return {
          ...curso,
          CursosTurmas: turmas.map((turma) => ({
            ...turma,
            inscricoesCount: inscricoesCountMap[turma.id] || 0,
            vagasOcupadas: inscricoesCountMap[turma.id] || 0,
            vagasDisponiveisCalculadas: turma.vagasTotais - (inscricoesCountMap[turma.id] || 0),
          })),
        };
      }
      return curso;
    })();

    return mapPublicCourse(cursoComInscricoes);
  },

  async getPublicTurma(turmaId: string) {
    const referenceDate = new Date();

    const turma = await prisma.cursosTurmas.findFirst({
      where: {
        id: turmaId,
        ...buildPublicTurmaWhere(referenceDate),
      },
      ...turmaPublicInclude,
    });

    if (!turma) {
      return null;
    }

    return mapTurmaPublic(turma);
  },

  async create(data: {
    nome: string;
    descricao?: string | null;
    imagemUrl?: string | null;
    cargaHoraria: number;
    categoriaId?: number | null;
    subcategoriaId?: number | null;
    statusPadrao?: CursosStatusPadrao;
    estagioObrigatorio?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const codigo = await generateUniqueCourseCode(tx, cursosLogger);

      const created = await tx.cursos.create({
        data: {
          nome: data.nome,
          descricao: data.descricao ?? null,
          imagemUrl: data.imagemUrl ?? null,
          cargaHoraria: data.cargaHoraria,
          categoriaId: data.categoriaId ?? null,
          subcategoriaId: data.subcategoriaId ?? null,
          statusPadrao: data.statusPadrao ?? CursosStatusPadrao.RASCUNHO,
          estagioObrigatorio: data.estagioObrigatorio ?? false,
          codigo,
          atualizadoEm: new Date(),
        },
        include: {
          CursosCategorias: { select: categoriaSelect },
          CursosSubcategorias: { select: subcategoriaSelect },
          CursosTurmas: { select: turmaSummarySelect },
          _count: { select: { CursosTurmas: true } },
        },
      });

      return mapCourse(created);
    });
  },

  async update(
    id: string,
    data: Partial<{
      nome: string;
      descricao?: string | null;
      imagemUrl?: string | null;
      cargaHoraria: number;
      categoriaId?: number | null;
      subcategoriaId?: number | null;
      statusPadrao?: CursosStatusPadrao;
      estagioObrigatorio?: boolean;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.cursos.update({
        where: { id },
        data: {
          nome: data.nome,
          descricao: data.descricao,
          imagemUrl: data.imagemUrl,
          cargaHoraria: data.cargaHoraria,
          categoriaId: data.categoriaId,
          subcategoriaId: data.subcategoriaId,
          statusPadrao: data.statusPadrao,
          estagioObrigatorio: data.estagioObrigatorio,
          atualizadoEm: new Date(),
        },
        include: {
          CursosCategorias: { select: categoriaSelect },
          CursosSubcategorias: { select: subcategoriaSelect },
          CursosTurmas: { select: turmaSummarySelect },
          _count: { select: { CursosTurmas: true } },
        },
      });

      return mapCourse(updated);
    });
  },

  async archive(id: string) {
    // Verificar se o curso existe primeiro
    const existing = await prisma.cursos.findUnique({
      where: { id },
    });

    if (!existing) {
      const error = new Error('Curso não encontrado');
      (error as any).code = 'P2025';
      throw error;
    }

    await prisma.cursos.update({
      where: { id },
      data: {
        statusPadrao: CursosStatusPadrao.RASCUNHO, // ARQUIVADO não existe no enum, usando RASCUNHO como arquivado
        atualizadoEm: new Date(),
      },
    });

    // Buscar o curso atualizado com todos os relacionamentos
    const updated = await prisma.cursos.findUnique({
      where: { id },
      include: {
        CursosCategorias: { select: categoriaSelect },
        CursosSubcategorias: { select: subcategoriaSelect },
        CursosTurmas: { select: turmaSummarySelect },
        _count: { select: { CursosTurmas: true } },
      },
    });

    if (!updated) {
      const error = new Error('Curso não encontrado após atualização');
      (error as any).code = 'P2025';
      throw error;
    }

    return mapCourse(updated);
  },
};

export const cursosTurmasMapper = {
  summary: mapTurmaSummary,
  detailed: mapTurmaDetailed,
  public: mapTurmaPublic,
};
