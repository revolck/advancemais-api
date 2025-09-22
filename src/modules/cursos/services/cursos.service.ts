import { CursoStatus, CursosStatusPadrao, Prisma, Roles, type Cursos } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { traduzirModelosPrisma } from '../utils/avaliacao';
import { generateUniqueCourseCode } from '../utils/code-generator';
import { AulaWithMateriais, aulaWithMateriaisInclude, mapAula } from './aulas.mapper';
import { ModuloWithRelations, moduloDetailedInclude, mapModulo } from './modulos.mapper';
import { ProvaWithModulo, mapProva, provaDefaultInclude } from './provas.mapper';

const cursosLogger = logger.child({ module: 'CursosService' });

const publicCursoStatuses: CursosStatusPadrao[] = [
  CursosStatusPadrao.PUBLICADO,
];

const publicTurmaStatuses: CursoStatus[] = [
  CursoStatus.PUBLICADO,
  CursoStatus.INSCRICOES_ABERTAS,
  CursoStatus.INSCRICOES_ENCERRADAS,
  CursoStatus.EM_ANDAMENTO,
];

const instrutorSelect = {
  id: true,
  nomeCompleto: true,
  email: true,
} as const;

const turmaSummarySelect = {
  id: true,
  codigo: true,
  nome: true,
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
    matriculas: {
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            informacoes: {
              select: { matricula: true },
            },
          },
        },
      },
    },
    aulas: {
      orderBy: [
        { ordem: 'asc' },
        { criadoEm: 'asc' },
      ],
      include: aulaWithMateriaisInclude.include,
    },
    modulos: {
      ...moduloDetailedInclude.include,
      orderBy: [
        { ordem: 'asc' },
        { criadoEm: 'asc' },
      ],
    },
    provas: {
      ...provaDefaultInclude.include,
      orderBy: [
        { ordem: 'asc' },
        { criadoEm: 'asc' },
      ],
    },
    regrasAvaliacao: { select: regrasAvaliacaoSelect },
  },
});

const turmaPublicInclude = Prisma.validator<Prisma.CursosTurmasDefaultArgs>()({
  include: {
    curso: {
      select: {
        id: true,
        codigo: true,
        nome: true,
      },
    },
    aulas: {
      orderBy: [
        { ordem: 'asc' },
        { criadoEm: 'asc' },
      ],
      include: aulaWithMateriaisInclude.include,
    },
    modulos: {
      ...moduloDetailedInclude.include,
      orderBy: [
        { ordem: 'asc' },
        { criadoEm: 'asc' },
      ],
    },
    provas: {
      ...provaDefaultInclude.include,
      orderBy: [
        { ordem: 'asc' },
        { criadoEm: 'asc' },
      ],
    },
    regrasAvaliacao: { select: regrasAvaliacaoSelect },
  },
});

type TurmaSummaryPayload = Prisma.CursosTurmasGetPayload<{ select: typeof turmaSummarySelect }>;
type TurmaDetailedPayload = Prisma.CursosTurmasGetPayload<typeof turmaDetailedInclude>;
type TurmaPublicPayload = Prisma.CursosTurmasGetPayload<typeof turmaPublicInclude>;
type RawCourseBase = Prisma.CursosGetPayload<{
  include: {
    instrutor: { select: typeof instrutorSelect };
    turmas: { select: typeof turmaSummarySelect } | typeof turmaDetailedInclude;
    _count: { select: { turmas: true } };
  };
}>;
type RawCourse = Omit<RawCourseBase, 'turmas' | '_count'> & {
  turmas?: (TurmaSummaryPayload | TurmaDetailedPayload)[];
  _count?: { turmas: number };
};

type CourseListParams = {
  page: number;
  pageSize: number;
  search?: string;
  statusPadrao?: CursosStatusPadrao;
  instrutorId?: string;
  includeTurmas?: boolean;
};

const mapTurmaSummary = (turma: Prisma.CursosTurmasGetPayload<{ select: typeof turmaSummarySelect }>) => ({
  id: turma.id,
  codigo: turma.codigo,
  nome: turma.nome,
  status: turma.status,
  vagasTotais: turma.vagasTotais,
  vagasDisponiveis: turma.vagasDisponiveis,
  dataInicio: turma.dataInicio?.toISOString() ?? null,
  dataFim: turma.dataFim?.toISOString() ?? null,
  dataInscricaoInicio: turma.dataInscricaoInicio?.toISOString() ?? null,
  dataInscricaoFim: turma.dataInscricaoFim?.toISOString() ?? null,
});

const mapRegrasAvaliacao = (
  regras?: Prisma.CursosTurmasRegrasAvaliacaoGetPayload<{ select: typeof regrasAvaliacaoSelect }> | null,
) => {
  if (!regras) {
    return null;
  }

  return {
    mediaMinima: Number(regras.mediaMinima),
    politicaRecuperacaoAtiva: regras.politicaRecuperacaoAtiva,
    modelosRecuperacao: traduzirModelosPrisma(regras.modelosRecuperacao),
    ordemAplicacaoRecuperacao: traduzirModelosPrisma(regras.ordemAplicacaoRecuperacao),
    notaMaximaRecuperacao: regras.notaMaximaRecuperacao ? Number(regras.notaMaximaRecuperacao) : null,
    pesoProvaFinal: regras.pesoProvaFinal ? Number(regras.pesoProvaFinal) : null,
    observacoes: regras.observacoes ?? null,
  };
};

const mapTurmaDetailed = (
  turma: TurmaDetailedPayload & { curso?: Pick<Cursos, 'id' | 'codigo' | 'nome'> | null },
) => {
  const modulos = (turma.modulos ?? []) as unknown as ModuloWithRelations[];
  const aulas = (turma.aulas ?? []) as unknown as AulaWithMateriais[];
  const provas = (turma.provas ?? []) as unknown as ProvaWithModulo[];

  return {
    id: turma.id,
    codigo: turma.codigo,
    nome: turma.nome,
    status: turma.status,
    vagasTotais: turma.vagasTotais,
    vagasDisponiveis: turma.vagasDisponiveis,
    dataInicio: turma.dataInicio?.toISOString() ?? null,
    dataFim: turma.dataFim?.toISOString() ?? null,
    dataInscricaoInicio: turma.dataInscricaoInicio?.toISOString() ?? null,
    dataInscricaoFim: turma.dataInscricaoFim?.toISOString() ?? null,
    curso: turma.curso
      ? {
          id: turma.curso.id,
          codigo: turma.curso.codigo,
          nome: turma.curso.nome,
        }
      : undefined,
    alunos: turma.matriculas.map((matricula) => ({
      id: matricula.aluno.id,
      nome: matricula.aluno.nomeCompleto,
      email: matricula.aluno.email,
      matricula: matricula.aluno.informacoes?.matricula ?? null,
    })),
    modulos: modulos.map(mapModulo),
    aulas: aulas.filter((aula) => aula.moduloId === null).map(mapAula),
    provas: provas.filter((prova) => prova.moduloId === null).map(mapProva),
    regrasAvaliacao: mapRegrasAvaliacao(turma.regrasAvaliacao ?? null),
  };
};

const mapTurmaPublic = (turma: TurmaPublicPayload) => {
  const modulos = (turma.modulos ?? []) as unknown as ModuloWithRelations[];
  const aulas = (turma.aulas ?? []) as unknown as AulaWithMateriais[];
  const provas = (turma.provas ?? []) as unknown as ProvaWithModulo[];

  return {
    id: turma.id,
    codigo: turma.codigo,
    nome: turma.nome,
    status: turma.status,
    vagasTotais: turma.vagasTotais,
    vagasDisponiveis: turma.vagasDisponiveis,
    dataInicio: turma.dataInicio?.toISOString() ?? null,
    dataFim: turma.dataFim?.toISOString() ?? null,
    dataInscricaoInicio: turma.dataInscricaoInicio?.toISOString() ?? null,
    dataInscricaoFim: turma.dataInscricaoFim?.toISOString() ?? null,
    curso: turma.curso
      ? {
          id: turma.curso.id,
          codigo: turma.curso.codigo,
          nome: turma.curso.nome,
        }
      : null,
    modulos: modulos.map(mapModulo),
    aulas: aulas.filter((aula) => aula.moduloId === null).map(mapAula),
    provas: provas.filter((prova) => prova.moduloId === null).map(mapProva),
    regrasAvaliacao: mapRegrasAvaliacao(turma.regrasAvaliacao ?? null),
  };
};

const mapCourse = (course: RawCourse) => {
  const turmas = Array.isArray(course.turmas)
    ? (course.turmas as Array<TurmaSummaryPayload | TurmaDetailedPayload>)
    : undefined;

  return {
    id: course.id,
    codigo: course.codigo,
    nome: course.nome,
    descricao: course.descricao,
    cargaHoraria: course.cargaHoraria,
    statusPadrao: course.statusPadrao,
    categoriaId: course.categoriaId,
    subcategoriaId: course.subcategoriaId,
    criadoEm: course.criadoEm.toISOString(),
    atualizadoEm: course.atualizadoEm.toISOString(),
    instrutor: course.instrutor
      ? {
          id: course.instrutor.id,
          nome: course.instrutor.nomeCompleto,
          email: course.instrutor.email,
        }
      : null,
    turmas: turmas
      ? turmas.map((turma) =>
          'matriculas' in turma ? mapTurmaDetailed(turma as any) : mapTurmaSummary(turma as any),
        )
      : undefined,
    turmasCount: course._count?.turmas ?? undefined,
  };
};

const mapPublicCourse = (
  course: Prisma.CursosGetPayload<{
    include: {
      instrutor: { select: { id: true; nomeCompleto: true } };
      turmas: typeof turmaPublicInclude;
    };
  }>,
) => ({
  id: course.id,
  codigo: course.codigo,
  nome: course.nome,
  descricao: course.descricao,
  cargaHoraria: course.cargaHoraria,
  statusPadrao: course.statusPadrao,
  instrutor: course.instrutor
    ? {
        id: course.instrutor.id,
        nome: course.instrutor.nomeCompleto,
      }
    : null,
  turmas: course.turmas.map((turma) => mapTurmaPublic(turma as TurmaPublicPayload)),
});

const ensureInstrutorExists = async (
  tx: Prisma.TransactionClient,
  instrutorId: string,
): Promise<void> => {
  const instrutor = await tx.usuarios.findUnique({
    where: { id: instrutorId },
    select: { id: true, role: true },
  });

  if (!instrutor) {
    const error = new Error('Instrutor não encontrado');
    (error as any).code = 'INSTRUTOR_NOT_FOUND';
    throw error;
  }

  if (instrutor.role !== Roles.PROFESSOR) {
    const error = new Error('Usuário informado não possui perfil de instrutor');
    (error as any).code = 'INSTRUTOR_INVALID_ROLE';
    throw error;
  }
};

export const cursosService = {
  async list(params: CourseListParams) {
    const { page, pageSize, search, statusPadrao, instrutorId, includeTurmas } = params;
    const where: Prisma.CursosWhereInput = {};

    if (statusPadrao) {
      where.statusPadrao = statusPadrao;
    }

    if (instrutorId) {
      where.instrutorId = instrutorId;
    }

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, courses] = await prisma.$transaction([
      prisma.cursos.count({ where }),
      prisma.cursos.findMany({
        where,
        include: {
          instrutor: { select: instrutorSelect },
          turmas: includeTurmas ? { select: turmaSummarySelect } : undefined,
          _count: { select: { turmas: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: courses.map(mapCourse),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  },

  async getById(id: number) {
    const course = await prisma.cursos.findUnique({
      where: { id },
      include: {
        instrutor: { select: instrutorSelect },
        turmas: {
          ...turmaDetailedInclude,
          orderBy: { criadoEm: 'desc' },
        },
        _count: { select: { turmas: true } },
      },
    });

    if (!course) {
      return null;
    }

    return mapCourse(course);
  },

  async listPublic() {
    const cursos = await prisma.cursos.findMany({
      where: {
        statusPadrao: { in: publicCursoStatuses },
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
        descricao: true,
        cargaHoraria: true,
        statusPadrao: true,
        turmas: {
          select: turmaSummarySelect,
          where: { status: { in: publicTurmaStatuses } },
          orderBy: { criadoEm: 'desc' },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return cursos.map((curso) => ({
      id: curso.id,
      codigo: curso.codigo,
      nome: curso.nome,
      descricao: curso.descricao,
      cargaHoraria: curso.cargaHoraria,
      statusPadrao: curso.statusPadrao,
      turmas: curso.turmas.map(mapTurmaSummary),
    }));
  },

  async getPublicById(id: number) {
    const curso = await prisma.cursos.findFirst({
      where: {
        id,
        statusPadrao: { in: publicCursoStatuses },
      },
      include: {
        instrutor: { select: { id: true, nomeCompleto: true } },
        turmas: {
          ...turmaPublicInclude,
          where: { status: { in: publicTurmaStatuses } },
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    if (!curso) {
      return null;
    }

    return mapPublicCourse(curso);
  },

  async getPublicTurma(turmaId: string) {
    const turma = await prisma.cursosTurmas.findFirst({
      where: {
        id: turmaId,
        status: { in: publicTurmaStatuses },
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
    cargaHoraria: number;
    instrutorId: string;
    categoriaId?: number | null;
    subcategoriaId?: number | null;
    statusPadrao?: CursosStatusPadrao;
  }) {
    return prisma.$transaction(async (tx) => {
      await ensureInstrutorExists(tx, data.instrutorId);

      const codigo = await generateUniqueCourseCode(tx, cursosLogger);

      const created = await tx.cursos.create({
        data: {
          nome: data.nome,
          descricao: data.descricao ?? null,
          cargaHoraria: data.cargaHoraria,
          instrutorId: data.instrutorId,
          categoriaId: data.categoriaId ?? null,
          subcategoriaId: data.subcategoriaId ?? null,
          statusPadrao: data.statusPadrao ?? CursosStatusPadrao.RASCUNHO,
          codigo,
        },
        include: {
          instrutor: { select: instrutorSelect },
          _count: { select: { turmas: true } },
        },
      });

      return mapCourse(created);
    });
  },

  async update(
    id: number,
    data: Partial<{
      nome: string;
      descricao?: string | null;
      cargaHoraria: number;
      instrutorId: string;
      categoriaId?: number | null;
      subcategoriaId?: number | null;
      statusPadrao?: CursosStatusPadrao;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      if (data.instrutorId) {
        await ensureInstrutorExists(tx, data.instrutorId);
      }

      const updated = await tx.cursos.update({
        where: { id },
        data: {
          nome: data.nome,
          descricao: data.descricao,
          cargaHoraria: data.cargaHoraria,
          instrutorId: data.instrutorId,
          categoriaId: data.categoriaId,
          subcategoriaId: data.subcategoriaId,
          statusPadrao: data.statusPadrao,
        },
        include: {
          instrutor: { select: instrutorSelect },
          _count: { select: { turmas: true } },
        },
      });

      return mapCourse(updated);
    });
  },

  async archive(id: number) {
    const updated = await prisma.cursos.update({
      where: { id },
      data: {
        statusPadrao: CursosStatusPadrao.DESPUBLICADO,
      },
      include: {
        instrutor: { select: instrutorSelect },
        _count: { select: { turmas: true } },
      },
    });

    return mapCourse(updated);
  },
};

export const cursosTurmasMapper = {
  summary: mapTurmaSummary,
  detailed: mapTurmaDetailed,
  public: mapTurmaPublic,
};
