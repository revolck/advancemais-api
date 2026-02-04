import {
  CursoStatus,
  CursosMetodos,
  CursosTurnos,
  Prisma,
  Roles,
  StatusInscricao,
  Status,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { generateUniqueInscricaoCode, generateUniqueTurmaCode } from '../utils/code-generator';
import { aulaWithMateriaisInclude } from './aulas.mapper';
import { moduloDetailedInclude } from './modulos.mapper';
import { provaDefaultInclude } from './provas.mapper';
import { cursosTurmasMapper, mapTurmaSummaryWithInscricoes } from './cursos.service';

const turmasLogger = logger.child({ module: 'CursosTurmasService' });

type TurmaEstruturaItemInput = {
  type: 'AULA' | 'PROVA' | 'ATIVIDADE';
  title: string;
  templateId: string;
  strategy?: 'CLONE' | 'REFERENCE';
  startDate?: Date;
  endDate?: Date;
  instructorId?: string;
  instructorIds?: string[];
  obrigatoria?: boolean;
  recuperacaoFinal?: boolean;
  ordem?: number;
};

type TurmaEstruturaModuleInput = {
  id?: string;
  title: string;
  ordem?: number;
  items: TurmaEstruturaItemInput[];
  startDate?: Date;
  endDate?: Date;
  instructorId?: string;
  instructorIds?: string[];
};

type TurmaEstruturaInput = {
  modules: TurmaEstruturaModuleInput[];
  standaloneItems: TurmaEstruturaItemInput[];
};

/**
 * Conta inscrições ativas por turma usando agregação SQL eficiente
 * Inscrição ativa = status não é CANCELADO/TRANCADO E aluno está ATIVO e não deletado
 */
async function countInscricoesAtivasPorTurma(turmaIds: string[]): Promise<Record<string, number>> {
  if (turmaIds.length === 0) {
    return {};
  }

  // Usar agregação SQL para melhor performance
  // Construir a query com IN ao invés de ANY para evitar problemas de tipo
  const placeholders = turmaIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await prisma.$queryRawUnsafe<{ turmaId: string; count: bigint }[]>(
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

  // Converter para Record<string, number>
  const countMap: Record<string, number> = {};
  for (const row of result) {
    countMap[row.turmaId] = Number(row.count);
  }

  // Garantir que todas as turmas tenham entrada (mesmo que 0)
  for (const turmaId of turmaIds) {
    if (!(turmaId in countMap)) {
      countMap[turmaId] = 0;
    }
  }

  return countMap;
}

const turmaSummarySelect = {
  id: true,
  codigo: true,
  nome: true,
  estruturaTipo: true,
  turno: true,
  metodo: true,
  status: true,
  vagasIlimitadas: true,
  vagasTotais: true,
  vagasDisponiveis: true,
  dataInicio: true,
  dataFim: true,
  dataInscricaoInicio: true,
  dataInscricaoFim: true,
  instrutorId: true,
  cursoId: true,
  Cursos: {
    select: {
      id: true,
      nome: true,
      codigo: true,
    },
  },
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
    CursosTurmasInstrutores: {
      include: {
        Instrutor: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            codUsuario: true,
            role: true,
          },
        },
      },
      orderBy: [{ criadoEm: 'asc' }],
    },
    CursosTurmasInscricoes: {
      include: {
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            UsuariosInformation: {
              select: { inscricao: true, telefone: true, avatarUrl: true },
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

const ensureCursoExists = async (cursoId: string) => {
  const curso = await prisma.cursos.findUnique({ where: { id: cursoId }, select: { id: true } });
  if (!curso) {
    const error = new Error('Curso não encontrado');
    (error as any).code = 'CURSO_NOT_FOUND';
    throw error;
  }
};

const ensureTurmaBelongsToCurso = async (cursoId: string, turmaId: string) => {
  const turma = await prisma.cursosTurmas.findUnique({
    where: { id: turmaId },
    select: { id: true, cursoId: true },
  });

  if (!turma || turma.cursoId !== cursoId) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const fetchTurmaDetailed = async (client: PrismaClientOrTx, turmaId: string) => {
  const turma = await client.cursosTurmas.findUnique({
    where: { id: turmaId },
    ...turmaDetailedInclude,
  });

  if (!turma) {
    const error = new Error('Turma não encontrada');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }

  return cursosTurmasMapper.detailed(turma);
};

const countTemplatesForCurso = async (client: PrismaClientOrTx, cursoId: string) => {
  const [templatesAulasCount, templatesAvaliacoesCount] = await Promise.all([
    client.cursosTurmasAulas.count({
      where: {
        cursoId,
        turmaId: null,
        deletedAt: null,
      },
    }),
    client.cursosTurmasProvas.count({
      where: {
        cursoId,
        turmaId: null,
      },
    }),
  ]);

  return { templatesAulasCount, templatesAvaliacoesCount };
};

const ensureTemplatesExistForTurmaCreate = async (
  client: PrismaClientOrTx,
  cursoId: string,
  estrutura?: TurmaEstruturaInput,
) => {
  const { moduleItems, standaloneItems } = estrutura
    ? buildItemsFromEstrutura(estrutura)
    : { moduleItems: [], standaloneItems: [] };

  const allItems = [...moduleItems.flatMap((entry) => entry.items ?? []), ...standaloneItems];

  const aulaTemplateIds = Array.from(
    new Set(allItems.filter((item) => item.type === 'AULA').map((item) => item.templateId)),
  ).filter(Boolean);

  const avaliacaoTemplateIds = Array.from(
    new Set(
      allItems
        .filter((item) => item.type === 'PROVA' || item.type === 'ATIVIDADE')
        .map((item) => item.templateId),
    ),
  ).filter(Boolean);

  if (aulaTemplateIds.length > 0 || avaliacaoTemplateIds.length > 0) {
    const [aulasEncontradas, avaliacoesEncontradas] = await Promise.all([
      aulaTemplateIds.length > 0
        ? client.cursosTurmasAulas.findMany({
            where: { id: { in: aulaTemplateIds }, turmaId: null, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve([]),
      avaliacaoTemplateIds.length > 0
        ? client.cursosTurmasProvas.findMany({
            where: { id: { in: avaliacaoTemplateIds }, turmaId: null },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const aulasSet = new Set(aulasEncontradas.map((item) => item.id));
    const avaliacoesSet = new Set(avaliacoesEncontradas.map((item) => item.id));

    const missingAulas = aulaTemplateIds.filter((id) => !aulasSet.has(id));
    const missingAvaliacoes = avaliacaoTemplateIds.filter((id) => !avaliacoesSet.has(id));

    if (missingAulas.length > 0 || missingAvaliacoes.length > 0) {
      const error: any = new Error(
        'Templates informados não encontrados ou não são templates válidos (sem turma).',
      );
      error.code = 'TURMA_PREREQUISITOS_NAO_ATENDIDOS';
      error.details = {
        missingAulaTemplateIds: missingAulas,
        missingAvaliacaoTemplateIds: missingAvaliacoes,
      };
      throw error;
    }

    return;
  }

  const { templatesAulasCount, templatesAvaliacoesCount } = await countTemplatesForCurso(
    client,
    cursoId,
  );

  if (templatesAulasCount < 1 || templatesAvaliacoesCount < 1) {
    const error: any = new Error(
      'Para cadastrar uma turma é necessário ter pelo menos 1 aula e 1 avaliação cadastradas.',
    );
    error.code = 'TURMA_PREREQUISITOS_NAO_ATENDIDOS';
    error.details = {
      templatesAulasCount,
      templatesAvaliacoesCount,
    };
    throw error;
  }
};

const buildItemsFromEstrutura = (estrutura: TurmaEstruturaInput) => {
  const modules = Array.isArray(estrutura?.modules) ? estrutura.modules : [];
  const standaloneItems = Array.isArray(estrutura?.standaloneItems)
    ? estrutura.standaloneItems
    : [];
  return {
    moduleItems: modules.map((module, moduleIndex) => ({
      moduleIndex,
      module,
      items: Array.isArray(module.items) ? module.items : [],
    })),
    standaloneItems,
  };
};

const generateNextAulaCodigo = async (tx: Prisma.TransactionClient) => {
  const ultimaAula = await tx.cursosTurmasAulas.findFirst({
    where: { codigo: { startsWith: 'AUL-' } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });

  let numero = 1;
  if (ultimaAula?.codigo) {
    const match = ultimaAula.codigo.match(/AUL-(\d+)/);
    if (match) {
      numero = parseInt(match[1], 10) + 1;
    }
  }

  return `AUL-${numero.toString().padStart(6, '0')}`;
};

const makeUniqueEtiqueta = async (
  tx: Prisma.TransactionClient,
  turmaId: string,
  baseEtiqueta: string,
) => {
  const normalizedBase = (baseEtiqueta ?? '').trim().slice(0, 30);
  const safeBase = normalizedBase.length > 0 ? normalizedBase : 'AV';

  let candidate = safeBase;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const existing = await tx.cursosTurmasProvas.findFirst({
      where: { turmaId, etiqueta: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }

    const suffix = `-${attempt + 2}`;
    const trimmed = safeBase.slice(0, Math.max(1, 30 - suffix.length));
    candidate = `${trimmed}${suffix}`;
  }

  const randomSuffix = `-${Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0')}`;
  return `${safeBase.slice(0, Math.max(1, 30 - randomSuffix.length))}${randomSuffix}`;
};

const cloneAulaTemplateToTurma = async (
  tx: Prisma.TransactionClient,
  params: {
    cursoId: string;
    turmaId: string;
    moduloId: string | null;
    turmaInicio?: Date | null;
    turmaFim?: Date | null;
    ordem: number;
    templateId: string;
    title?: string;
    dataInicio?: Date;
    dataFim?: Date;
    instrutorId?: string | null;
    obrigatoria?: boolean;
    criadoPorId?: string | null;
  },
) => {
  const template = await tx.cursosTurmasAulas.findFirst({
    where: {
      id: params.templateId,
      cursoId: params.cursoId,
      turmaId: null,
      deletedAt: null,
    },
    include: {
      CursosTurmasAulasMateriais: {
        orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      },
    },
  });

  if (!template) {
    const error: any = new Error('Aula template não encontrada para o curso informado');
    error.code = 'AULA_TEMPLATE_NOT_FOUND';
    error.details = { templateId: params.templateId };
    throw error;
  }

  // Validação: datas da aula devem estar dentro do período da turma
  if (params.turmaInicio && params.turmaFim) {
    const effectiveStart = params.dataInicio ?? template.dataInicio ?? null;
    const effectiveEnd = params.dataFim ?? template.dataFim ?? null;

    if (effectiveStart && effectiveStart.getTime() < params.turmaInicio.getTime()) {
      const error: any = new Error('Data de início da aula deve estar dentro do período da turma');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    if (effectiveEnd && effectiveEnd.getTime() > params.turmaFim.getTime()) {
      const error: any = new Error('Data de fim da aula deve estar dentro do período da turma');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    if (effectiveStart && effectiveEnd && effectiveStart.getTime() > effectiveEnd.getTime()) {
      const error: any = new Error('Data de fim da aula deve ser posterior à data de início');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  // Gerar código único com retry em caso de concorrência
  let aulaCreated: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const codigo = await generateNextAulaCodigo(tx);
    try {
      aulaCreated = await tx.cursosTurmasAulas.create({
        data: {
          codigo,
          cursoId: params.cursoId,
          turmaId: params.turmaId,
          moduloId: params.moduloId,
          instrutorId: params.instrutorId ?? template.instrutorId ?? null,
          nome: params.title?.trim().length ? params.title.trim() : template.nome,
          descricao: template.descricao ?? null,
          ordem: params.ordem,
          urlVideo: template.urlVideo ?? null,
          sala: template.sala ?? null,
          // Não clonar Meet/Event IDs: são específicos da turma/agenda
          urlMeet: null,
          meetEventId: null,
          modalidade: template.modalidade,
          tipoLink: template.tipoLink ?? null,
          obrigatoria: params.obrigatoria ?? template.obrigatoria,
          duracaoMinutos: template.duracaoMinutos ?? null,
          // Instância sempre nasce como rascunho (publicação via fluxo próprio)
          status: 'RASCUNHO' as any,
          gravarAula: template.gravarAula ?? true,
          apenasMateriaisComplementares: template.apenasMateriaisComplementares ?? false,
          adicionadaAposCriacao: false,
          dataInicio: params.dataInicio ?? template.dataInicio ?? null,
          dataFim: params.dataFim ?? template.dataFim ?? null,
          horaInicio: template.horaInicio ?? null,
          horaFim: template.horaFim ?? null,
          criadoPorId: params.criadoPorId ?? null,
        },
        select: { id: true },
      });
      break;
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        // codigo duplicado, tentar novamente
        continue;
      }
      throw error;
    }
  }

  if (!aulaCreated) {
    const error: any = new Error('Falha ao gerar código único para aula');
    error.code = 'AULA_CODIGO_GENERATION_FAILED';
    throw error;
  }

  if (template.CursosTurmasAulasMateriais?.length) {
    await tx.cursosTurmasAulasMateriais.createMany({
      data: template.CursosTurmasAulasMateriais.map((material) => ({
        aulaId: aulaCreated!.id,
        titulo: material.titulo,
        descricao: material.descricao ?? null,
        tipo: material.tipo,
        tipoArquivo: material.tipoArquivo ?? null,
        url: material.url ?? null,
        duracaoEmSegundos: material.duracaoEmSegundos ?? null,
        tamanhoEmBytes: material.tamanhoEmBytes ?? null,
        ordem: material.ordem,
      })),
    });
  }

  return aulaCreated.id;
};

const cloneAvaliacaoTemplateToTurma = async (
  tx: Prisma.TransactionClient,
  params: {
    cursoId: string;
    turmaId: string;
    moduloId: string | null;
    turmaInicio?: Date | null;
    turmaFim?: Date | null;
    ordem: number;
    templateId: string;
    title?: string;
    dataInicio?: Date;
    dataFim?: Date;
    instrutorId?: string | null;
    obrigatoria?: boolean;
    recuperacaoFinal?: boolean;
  },
) => {
  const template = await tx.cursosTurmasProvas.findFirst({
    where: {
      id: params.templateId,
      cursoId: params.cursoId,
      turmaId: null,
    },
    include: {
      CursosTurmasProvasQuestoes: {
        orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
        include: {
          CursosTurmasProvasQuestoesAlternativas: {
            orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
          },
        },
      },
    },
  });

  if (!template) {
    const error: any = new Error('Avaliação template não encontrada para o curso informado');
    error.code = 'AVALIACAO_TEMPLATE_NOT_FOUND';
    error.details = { templateId: params.templateId };
    throw error;
  }

  // Validação: datas da avaliação devem estar dentro do período da turma
  if (params.turmaInicio && params.turmaFim) {
    const effectiveStart = params.dataInicio ?? template.dataInicio ?? null;
    const effectiveEnd = params.dataFim ?? template.dataFim ?? null;

    if (effectiveStart && effectiveStart.getTime() < params.turmaInicio.getTime()) {
      const error: any = new Error(
        'Data de início da avaliação deve estar dentro do período da turma',
      );
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    if (effectiveEnd && effectiveEnd.getTime() > params.turmaFim.getTime()) {
      const error: any = new Error(
        'Data de fim da avaliação deve estar dentro do período da turma',
      );
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    if (effectiveStart && effectiveEnd && effectiveStart.getTime() > effectiveEnd.getTime()) {
      const error: any = new Error('Data de fim da avaliação deve ser posterior à data de início');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  const etiqueta = await makeUniqueEtiqueta(tx, params.turmaId, template.etiqueta);

  const nova = await tx.cursosTurmasProvas.create({
    data: {
      turmaId: params.turmaId,
      cursoId: params.cursoId,
      moduloId: params.moduloId,
      instrutorId:
        params.instrutorId === undefined ? (template.instrutorId ?? null) : params.instrutorId,
      tipo: template.tipo,
      tipoAtividade: template.tipoAtividade ?? null,
      recuperacaoFinal: params.recuperacaoFinal ?? template.recuperacaoFinal ?? false,
      titulo: params.title?.trim().length ? params.title.trim() : template.titulo,
      etiqueta,
      descricao: template.descricao ?? null,
      peso: template.peso,
      valePonto: template.valePonto ?? true,
      ativo: template.ativo ?? true,
      status: 'RASCUNHO' as any,
      modalidade: template.modalidade,
      obrigatoria: params.obrigatoria ?? template.obrigatoria ?? true,
      dataInicio: params.dataInicio ?? template.dataInicio ?? null,
      dataFim: params.dataFim ?? template.dataFim ?? null,
      horaInicio: template.horaInicio ?? null,
      horaTermino: template.horaTermino ?? null,
      ordem: params.ordem,
      localizacao: params.moduloId ? 'MODULO' : 'TURMA',
    },
    select: { id: true },
  });

  for (const questao of template.CursosTurmasProvasQuestoes) {
    const novaQuestao = await tx.cursosTurmasProvasQuestoes.create({
      data: {
        provaId: nova.id,
        enunciado: questao.enunciado,
        tipo: questao.tipo,
        ordem: questao.ordem,
        peso: questao.peso,
        obrigatoria: questao.obrigatoria,
      },
      select: { id: true },
    });

    if (questao.CursosTurmasProvasQuestoesAlternativas?.length) {
      await tx.cursosTurmasProvasQuestoesAlternativas.createMany({
        data: questao.CursosTurmasProvasQuestoesAlternativas.map((alt) => ({
          questaoId: novaQuestao.id,
          texto: alt.texto,
          ordem: alt.ordem,
          correta: alt.correta,
        })),
      });
    }
  }

  return nova.id;
};

type TurmaListParams = {
  cursoId: string; // UUID String
  page: number;
  pageSize: number;
  status?: CursoStatus;
  turno?: CursosTurnos;
  metodo?: CursosMetodos;
  instrutorId?: string;
};

export const turmasService = {
  async list(params: TurmaListParams) {
    const { cursoId, page, pageSize, status, turno, metodo, instrutorId } = params;

    await ensureCursoExists(cursoId);

    const where: Prisma.CursosTurmasWhereInput = {
      cursoId,
    };

    if (status) {
      where.status = status;
    }

    if (turno) {
      where.turno = turno;
    }

    if (metodo) {
      where.metodo = metodo;
    }

    if (instrutorId) {
      where.instrutorId = instrutorId;
    }

    // Contar total de turmas com os filtros aplicados
    const total = await prisma.cursosTurmas.count({ where });

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const turmas = await prisma.cursosTurmas.findMany({
      where,
      select: turmaSummarySelect,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: pageSize,
    });

    // ✅ Otimização: Contar inscrições ativas em batch para todas as turmas
    const turmaIds = turmas.map((t) => t.id);
    const inscricoesCountMap = await countInscricoesAtivasPorTurma(turmaIds);

    const hasNext = totalPages > 0 && safePage < totalPages;
    const hasPrevious = safePage > 1;

    // Mapear turmas com contagem de inscrições e nome do curso
    const data = turmas.map((turma) => {
      const inscricoesCount = inscricoesCountMap[turma.id] || 0;
      const turmaMapped = mapTurmaSummaryWithInscricoes(turma, inscricoesCount);
      return {
        ...turmaMapped,
        curso: turma.Cursos
          ? {
              id: turma.Cursos.id,
              nome: turma.Cursos.nome,
              codigo: turma.Cursos.codigo,
            }
          : null,
      };
    });

    return {
      data,
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
          cursoId,
          status: status ?? null,
          turno: turno ?? null,
          metodo: metodo ?? null,
          instrutorId: instrutorId ?? null,
        },
      },
      meta: {
        empty: turmas.length === 0,
      },
    };
  },

  async get(cursoId: string, turmaId: string) {
    await ensureTurmaBelongsToCurso(cursoId, turmaId);

    try {
      const turma = await fetchTurmaDetailed(prisma, turmaId);

      // ✅ Otimização: Adicionar contagem de inscrições ativas com fallback seguro
      let inscricoesCount = 0;
      try {
        const inscricoesCountMap = await countInscricoesAtivasPorTurma([turmaId]);
        inscricoesCount = inscricoesCountMap[turmaId] || 0;
      } catch (error) {
        turmasLogger.warn(
          { error: error instanceof Error ? error.message : String(error), turmaId },
          '⚠️ Erro ao calcular contagem de inscrições, usando 0 como fallback',
        );
      }

      return {
        ...turma,
        inscricoesCount: inscricoesCount ?? 0,
        vagasOcupadas: inscricoesCount ?? 0,
        vagasDisponiveisCalculadas:
          turma.vagasIlimitadas || turma.vagasTotais === 0
            ? null
            : (turma.vagasTotais ?? 0) - (inscricoesCount ?? 0),
      };
    } catch (error: any) {
      turmasLogger.error(
        { error: error?.message, stack: error?.stack, cursoId, turmaId },
        '🔥 Erro ao buscar detalhes da turma',
      );
      throw error;
    }
  },

  async listInscricoes(cursoId: string, turmaId: string) {
    await ensureTurmaBelongsToCurso(cursoId, turmaId);

    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where: { turmaId },
      include: {
        Usuarios: {
          select: {
            id: true,
            codUsuario: true,
            nomeCompleto: true,
            email: true,
            UsuariosInformation: {
              select: { inscricao: true, telefone: true, avatarUrl: true },
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
      orderBy: { criadoEm: 'desc' },
    });

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      turmasLogger.debug(
        {
          cursoId,
          turmaId,
          totalInscricoes: inscricoes.length,
          comUsuario: inscricoes.filter((i) => i.Usuarios).length,
        },
        '📋 Listando inscrições da turma',
      );
    }

    const mapped = inscricoes
      .filter((inscricao) => inscricao.Usuarios) // Filtrar apenas inscrições com aluno válido
      .map((inscricao) => {
        const aluno = inscricao.Usuarios!; // Já verificamos que não é null acima
        const endereco = aluno?.UsuariosEnderecos?.[0];

        return {
          id: inscricao.id,
          alunoId: inscricao.alunoId,
          turmaId: inscricao.turmaId,
          status: inscricao.status,
          criadoEm: inscricao.criadoEm?.toISOString() ?? null,
          aluno: {
            id: aluno.id,
            nome: aluno.nomeCompleto,
            email: aluno.email,
            codigo: aluno.codUsuario,
            inscricao: aluno.UsuariosInformation?.inscricao ?? aluno.codUsuario ?? null,
            telefone: aluno.UsuariosInformation?.telefone ?? null,
            avatarUrl: aluno.UsuariosInformation?.avatarUrl ?? null,
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
          },
        };
      });

    return mapped;
  },

  async create(
    cursoId: string,
    data: {
      nome: string;
      instrutorId?: string;
      instrutorIds?: string[];
      estruturaTipo: 'MODULAR' | 'DINAMICA' | 'PADRAO';
      turno?: CursosTurnos;
      metodo?: CursosMetodos;
      dataInicio?: Date | null;
      dataFim?: Date | null;
      dataInscricaoInicio?: Date | null;
      dataInscricaoFim?: Date | null;
      vagasIlimitadas: boolean;
      vagasTotais?: number;
      vagasDisponiveis?: number;
      status?: CursoStatus;
      estrutura: TurmaEstruturaInput;
    },
    actor?: { id?: string | null },
  ) {
    return prisma.$transaction(async (tx) => {
      const curso = await tx.cursos.findUnique({ where: { id: cursoId }, select: { id: true } });
      if (!curso) {
        const error = new Error('Curso não encontrado');
        (error as any).code = 'CURSO_NOT_FOUND';
        throw error;
      }

      await ensureTemplatesExistForTurmaCreate(tx, cursoId, data.estrutura);

      const UNLIMITED_VAGAS_TOTAL = 1_000_000;

      if (!data.vagasIlimitadas && (!data.vagasTotais || data.vagasTotais <= 0)) {
        const error: any = new Error('Informe o total de vagas');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const vagasTotaisFinal = data.vagasIlimitadas ? 0 : (data.vagasTotais as number);

      const vagasDisponiveis = data.vagasIlimitadas
        ? 0
        : data.vagasDisponiveis !== undefined
          ? Math.min(data.vagasDisponiveis, vagasTotaisFinal)
          : vagasTotaisFinal;

      const codigo = await generateUniqueTurmaCode(tx, turmasLogger);

      const instrutorIdsFinal = Array.isArray(data.instrutorIds)
        ? data.instrutorIds.filter(Boolean)
        : [];
      const primaryInstrutorId = data.instrutorId ?? instrutorIdsFinal[0] ?? null;

      const created = await tx.cursosTurmas.create({
        data: {
          cursoId,
          instrutorId: primaryInstrutorId,
          estruturaTipo: data.estruturaTipo as any,
          nome: data.nome,
          codigo,
          turno: data.turno ?? CursosTurnos.INTEGRAL,
          metodo: data.metodo ?? CursosMetodos.ONLINE,
          dataInicio: data.dataInicio ?? null,
          dataFim: data.dataFim ?? null,
          dataInscricaoInicio: data.dataInscricaoInicio ?? null,
          dataInscricaoFim: data.dataInscricaoFim ?? null,
          vagasIlimitadas: data.vagasIlimitadas,
          vagasTotais: vagasTotaisFinal,
          vagasDisponiveis,
          // Entrada do usuário: apenas RASCUNHO/PUBLICADO (demais status são automáticos).
          status:
            data.status === CursoStatus.PUBLICADO ? CursoStatus.PUBLICADO : CursoStatus.RASCUNHO,
        },
      });

      // Vincular instrutores (0..N)
      const instrutoresParaVincular = Array.from(
        new Set([primaryInstrutorId, ...instrutorIdsFinal].filter(Boolean)),
      ) as string[];

      if (instrutoresParaVincular.length > 0) {
        await tx.cursosTurmasInstrutores.createMany({
          data: instrutoresParaVincular.map((instrutorId) => ({
            turmaId: created.id,
            instrutorId,
          })),
          skipDuplicates: true,
        });
      }

      const mapping: {
        templateId: string;
        instanceId: string;
        tipo: 'AULA' | 'PROVA' | 'ATIVIDADE';
        moduloId: string | null;
        strategy: 'CLONE';
      }[] = [];

      const { moduleItems, standaloneItems } = buildItemsFromEstrutura(data.estrutura);

      const pickInstructorId = (input: { instructorId?: string; instructorIds?: string[] }) =>
        input.instructorId ?? input.instructorIds?.[0];

      for (const entry of moduleItems) {
        const module = entry.module;
        const modulo = await tx.cursosTurmasModulos.create({
          data: {
            turmaId: created.id,
            nome: module.title,
            descricao: null,
            obrigatorio: true,
            ordem: module.ordem ?? entry.moduleIndex + 1,
          },
          select: { id: true },
        });

        for (const [index, item] of entry.items.entries()) {
          const ordem = item.ordem ?? index + 1;
          const instrutorIdResolved =
            pickInstructorId(item) ?? pickInstructorId(module) ?? data.instrutorId ?? null;
          const dataInicioResolved = item.startDate ?? module.startDate;
          const dataFimResolved = item.endDate ?? module.endDate;

          if (item.type === 'AULA') {
            const instanceId = await cloneAulaTemplateToTurma(tx, {
              cursoId,
              turmaId: created.id,
              moduloId: modulo.id,
              turmaInicio: data.dataInicio ?? null,
              turmaFim: data.dataFim ?? null,
              ordem,
              templateId: item.templateId,
              title: item.title,
              dataInicio: dataInicioResolved,
              dataFim: dataFimResolved,
              instrutorId: instrutorIdResolved,
              obrigatoria: item.obrigatoria,
              criadoPorId: actor?.id ?? null,
            });
            mapping.push({
              templateId: item.templateId,
              instanceId,
              tipo: 'AULA',
              moduloId: modulo.id,
              strategy: 'CLONE',
            });
          } else {
            const instanceId = await cloneAvaliacaoTemplateToTurma(tx, {
              cursoId,
              turmaId: created.id,
              moduloId: modulo.id,
              turmaInicio: data.dataInicio ?? null,
              turmaFim: data.dataFim ?? null,
              ordem,
              templateId: item.templateId,
              title: item.title,
              dataInicio: dataInicioResolved,
              dataFim: dataFimResolved,
              instrutorId: instrutorIdResolved,
              obrigatoria: item.obrigatoria,
              recuperacaoFinal: item.recuperacaoFinal,
            });
            mapping.push({
              templateId: item.templateId,
              instanceId,
              tipo: item.type,
              moduloId: modulo.id,
              strategy: 'CLONE',
            });
          }
        }
      }

      for (const [index, item] of standaloneItems.entries()) {
        const ordem = item.ordem ?? index + 1;
        const instrutorIdResolved = pickInstructorId(item) ?? data.instrutorId ?? null;

        if (item.type === 'AULA') {
          const instanceId = await cloneAulaTemplateToTurma(tx, {
            cursoId,
            turmaId: created.id,
            moduloId: null,
            turmaInicio: data.dataInicio ?? null,
            turmaFim: data.dataFim ?? null,
            ordem,
            templateId: item.templateId,
            title: item.title,
            dataInicio: item.startDate,
            dataFim: item.endDate,
            instrutorId: instrutorIdResolved,
            obrigatoria: item.obrigatoria,
            criadoPorId: actor?.id ?? null,
          });
          mapping.push({
            templateId: item.templateId,
            instanceId,
            tipo: 'AULA',
            moduloId: null,
            strategy: 'CLONE',
          });
        } else {
          const instanceId = await cloneAvaliacaoTemplateToTurma(tx, {
            cursoId,
            turmaId: created.id,
            moduloId: null,
            turmaInicio: data.dataInicio ?? null,
            turmaFim: data.dataFim ?? null,
            ordem,
            templateId: item.templateId,
            title: item.title,
            dataInicio: item.startDate,
            dataFim: item.endDate,
            instrutorId: instrutorIdResolved,
            obrigatoria: item.obrigatoria,
            recuperacaoFinal: item.recuperacaoFinal,
          });
          mapping.push({
            templateId: item.templateId,
            instanceId,
            tipo: item.type,
            moduloId: null,
            strategy: 'CLONE',
          });
        }
      }

      const turmaDetailed = await fetchTurmaDetailed(tx, created.id);
      return {
        ...turmaDetailed,
        mapping,
      };
    });
  },

  async update(
    cursoId: string,
    turmaId: string,
    data: Partial<{
      nome: string;
      instrutorId?: string;
      instrutorIds?: string[];
      estruturaTipo?: 'MODULAR' | 'DINAMICA' | 'PADRAO';
      turno?: CursosTurnos;
      metodo?: CursosMetodos;
      dataInicio?: Date | null;
      dataFim?: Date | null;
      dataInscricaoInicio?: Date | null;
      dataInscricaoFim?: Date | null;
      vagasIlimitadas?: boolean;
      vagasTotais: number;
      vagasDisponiveis?: number;
      status?: CursoStatus;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findUnique({
        where: { id: turmaId },
        select: {
          id: true,
          cursoId: true,
          status: true,
          vagasIlimitadas: true,
          vagasTotais: true,
          vagasDisponiveis: true,
          dataInicio: true,
          dataFim: true,
          dataInscricaoInicio: true,
          dataInscricaoFim: true,
        },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const inscricoesAtivas = await tx.cursosTurmasInscricoes.count({
        where: {
          turmaId,
          status: { notIn: [StatusInscricao.CANCELADO, StatusInscricao.TRANCADO] },
        },
      });
      const vagasIlimitadasFinal = data.vagasIlimitadas ?? turma.vagasIlimitadas;
      const vagasTotais = vagasIlimitadasFinal ? 0 : (data.vagasTotais ?? turma.vagasTotais);

      if (vagasTotais < inscricoesAtivas) {
        const error = new Error('Vagas totais não podem ser menores que inscrições ativas');
        (error as any).code = 'INVALID_VAGAS_TOTAIS';
        throw error;
      }

      const minimoDisponiveis = vagasIlimitadasFinal ? 0 : vagasTotais - inscricoesAtivas;
      let vagasDisponiveis = vagasIlimitadasFinal
        ? 0
        : data.vagasDisponiveis !== undefined
          ? Math.min(data.vagasDisponiveis, vagasTotais)
          : data.vagasTotais !== undefined
            ? minimoDisponiveis
            : turma.vagasDisponiveis;

      if (vagasDisponiveis < minimoDisponiveis) {
        vagasDisponiveis = minimoDisponiveis;
      }

      // Validação de período (considerando valores existentes quando não informados)
      const dataInicioFinal = data.dataInicio !== undefined ? data.dataInicio : turma.dataInicio;
      const dataFimFinal = data.dataFim !== undefined ? data.dataFim : turma.dataFim;
      const dataInscricaoInicioFinal =
        data.dataInscricaoInicio !== undefined
          ? data.dataInscricaoInicio
          : turma.dataInscricaoInicio;
      const dataInscricaoFimFinal =
        data.dataInscricaoFim !== undefined ? data.dataInscricaoFim : turma.dataInscricaoFim;

      if (dataInicioFinal && dataFimFinal && dataInicioFinal > dataFimFinal) {
        const error: any = new Error('Data de fim deve ser posterior à data de início');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      if (
        dataInscricaoInicioFinal &&
        dataInscricaoFimFinal &&
        dataInscricaoInicioFinal > dataInscricaoFimFinal
      ) {
        const error: any = new Error('Data final de inscrição deve ser posterior à data inicial');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      if (dataInicioFinal && dataInscricaoFimFinal && dataInicioFinal < dataInscricaoFimFinal) {
        const error: any = new Error(
          'Data de início da turma não pode ser anterior à data final das inscrições',
        );
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const statusNovo = data.status;
      const statusAnterior = turma.status;

      // Entrada do usuário: apenas RASCUNHO/PUBLICADO (demais status são automáticos).
      if (
        statusNovo !== undefined &&
        statusNovo !== CursoStatus.RASCUNHO &&
        statusNovo !== CursoStatus.PUBLICADO
      ) {
        const error: any = new Error('Status inválido. Use apenas RASCUNHO ou PUBLICADO.');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const estaPublicandoOuAbrindoInscricoes =
        statusNovo !== undefined &&
        statusNovo !== statusAnterior &&
        statusNovo === CursoStatus.PUBLICADO;

      if (estaPublicandoOuAbrindoInscricoes) {
        const [aulasCount, avaliacoesCount] = await Promise.all([
          tx.cursosTurmasAulas.count({
            where: {
              turmaId,
              deletedAt: null,
            },
          }),
          tx.cursosTurmasProvas.count({
            where: {
              turmaId,
              ativo: true,
            },
          }),
        ]);

        if (aulasCount < 1 || avaliacoesCount < 1) {
          const error: any = new Error(
            'Para publicar/abrir inscrições de uma turma é necessário ter pelo menos 1 aula e 1 avaliação cadastradas.',
          );
          error.code = 'TURMA_PREREQUISITOS_NAO_ATENDIDOS';
          error.details = {
            aulasCount,
            avaliacoesCount,
          };
          throw error;
        }
      }

      await tx.cursosTurmas.update({
        where: { id: turmaId },
        data: {
          nome: data.nome,
          instrutorId: data.instrutorId ?? undefined,
          estruturaTipo: data.estruturaTipo as any,
          turno: data.turno,
          metodo: data.metodo,
          dataInicio: data.dataInicio,
          dataFim: data.dataFim,
          dataInscricaoInicio: data.dataInscricaoInicio,
          dataInscricaoFim: data.dataInscricaoFim,
          vagasIlimitadas: data.vagasIlimitadas,
          vagasTotais,
          vagasDisponiveis,
          status: data.status,
        },
      });

      // Atualizar instrutores vinculados (quando instrutorIds é enviado)
      if (Array.isArray(data.instrutorIds)) {
        await tx.cursosTurmasInstrutores.deleteMany({ where: { turmaId } });
        const normalized = Array.from(new Set(data.instrutorIds.filter(Boolean)));
        if (normalized.length > 0) {
          await tx.cursosTurmasInstrutores.createMany({
            data: normalized.map((instrutorId) => ({ turmaId, instrutorId })),
            skipDuplicates: true,
          });
        }
      }

      return fetchTurmaDetailed(tx, turmaId);
    });
  },

  async enroll(
    cursoId: string,
    turmaId: string,
    alunoId: string,
    actor?: { id?: string | null; role?: Roles | null },
  ) {
    return prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findUnique({
        where: { id: turmaId },
        select: {
          id: true,
          cursoId: true,
          vagasDisponiveis: true,
          vagasTotais: true,
          vagasIlimitadas: true,
          dataInscricaoFim: true,
        },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const agora = new Date();
      if (turma.dataInscricaoFim && turma.dataInscricaoFim < agora) {
        const canOverrideDeadline = actor?.role === Roles.ADMIN || actor?.role === Roles.MODERADOR;

        if (canOverrideDeadline) {
          turmasLogger.info(
            {
              turmaId,
              cursoId,
              actorId: actor?.id ?? null,
              actorRole: actor?.role ?? null,
            },
            'Inscrição criada após o encerramento do período por usuário privilegiado',
          );
        }

        if (!canOverrideDeadline) {
          const error = new Error('Período de inscrição encerrado para esta turma');
          (error as any).code = 'INSCRICOES_ENCERRADAS';
          throw error;
        }
      }

      // Verificar vagas disponíveis (vaga fica ocupada enquanto inscrição não está CANCELADO/TRANCADO)
      const inscricoesAtivas = await tx.cursosTurmasInscricoes.count({
        where: {
          turmaId,
          status: { notIn: [StatusInscricao.CANCELADO, StatusInscricao.TRANCADO] },
        },
      });

      if (
        !turma.vagasIlimitadas &&
        turma.vagasTotais > 0 &&
        inscricoesAtivas >= turma.vagasTotais
      ) {
        const canOverrideVagas = actor?.role === Roles.ADMIN || actor?.role === Roles.MODERADOR;

        if (canOverrideVagas) {
          turmasLogger.info(
            {
              turmaId,
              cursoId,
              actorId: actor?.id ?? null,
              actorRole: actor?.role ?? null,
              vagasDisponiveis: turma.vagasDisponiveis,
            },
            'Inscrição criada apesar da turma estar cheia por usuário privilegiado',
          );
        } else {
          const error = new Error('Não há vagas disponíveis nesta turma');
          (error as any).code = 'SEM_VAGAS';
          throw error;
        }
      }

      const aluno = await tx.usuarios.findUnique({
        where: { id: alunoId },
        select: {
          id: true,
          role: true,
          UsuariosInformation: { select: { inscricao: true } },
        },
      });

      if (!aluno) {
        const error = new Error('Aluno não encontrado');
        (error as any).code = 'ALUNO_NOT_FOUND';
        throw error;
      }

      if (aluno.role !== Roles.ALUNO_CANDIDATO) {
        const error = new Error('Usuário informado não possui perfil de aluno candidato');
        (error as any).code = 'ALUNO_INVALID_ROLE';
        throw error;
      }

      const inscricaoExistente = await tx.cursosTurmasInscricoes.findUnique({
        where: { turmaId_alunoId: { turmaId, alunoId } },
        select: { id: true },
      });

      if (inscricaoExistente) {
        const error = new Error('Aluno já está inscrito nesta turma');
        (error as any).code = 'ALUNO_JA_INSCRITO';
        throw error;
      }

      const informacoes = await tx.usuariosInformation.findUnique({
        where: { usuarioId: alunoId },
        select: { inscricao: true },
      });

      if (!informacoes) {
        const error = new Error('Informações do usuário não encontradas para geração de inscrição');
        (error as any).code = 'ALUNO_INFORMATION_NOT_FOUND';
        throw error;
      }

      let inscricaoCodigo = informacoes.inscricao;
      if (!inscricaoCodigo) {
        inscricaoCodigo = await generateUniqueInscricaoCode(tx, turmasLogger);
        await tx.usuariosInformation.update({
          where: { usuarioId: alunoId },
          data: { inscricao: inscricaoCodigo },
        });
      }

      await tx.cursosTurmasInscricoes.create({
        data: {
          turmaId,
          alunoId,
        },
      });

      // Sincronizar agenda do aluno com Google Calendar (em background, não bloqueia)
      setImmediate(async () => {
        try {
          const {
            googleCalendarService,
          } = require('@/modules/cursos/aulas/services/google-calendar.service');
          await googleCalendarService.sincronizarAgendaAluno({ alunoId, turmaId });
        } catch (error: any) {
          turmasLogger.error('[SYNC_AGENDA_ERRO]', {
            alunoId,
            turmaId,
            error: error?.message,
          });
        }
      });

      return fetchTurmaDetailed(tx, turmaId);
    });
  },

  async updateInscricaoStatus(
    cursoId: string,
    turmaId: string,
    inscricaoId: string,
    status: StatusInscricao,
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(cursoId, turmaId);

      const inscricao = await tx.cursosTurmasInscricoes.findFirst({
        where: {
          id: inscricaoId,
          turmaId,
        },
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
      });

      if (!inscricao) {
        const error = new Error('Inscrição não encontrada para a turma informada');
        (error as any).code = 'INSCRICAO_NOT_FOUND';
        throw error;
      }

      const inscricaoAtualizada = await tx.cursosTurmasInscricoes.update({
        where: { id: inscricaoId },
        data: {
          status,
        },
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
      });

      turmasLogger.info(
        { cursoId, turmaId, inscricaoId, statusAntigo: inscricao.status, statusNovo: status },
        '✅ Status da inscrição atualizado',
      );

      const aluno = inscricaoAtualizada.Usuarios;
      const endereco = aluno?.UsuariosEnderecos?.[0];

      return {
        id: inscricaoAtualizada.id,
        alunoId: inscricaoAtualizada.alunoId,
        turmaId: inscricaoAtualizada.turmaId,
        status: inscricaoAtualizada.status,
        criadoEm: inscricaoAtualizada.criadoEm?.toISOString() ?? null,
        aluno: {
          id: aluno.id,
          nome: aluno.nomeCompleto,
          email: aluno.email,
          inscricao: aluno.UsuariosInformation?.inscricao ?? null,
          telefone: aluno.UsuariosInformation?.telefone ?? null,
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
        },
      };
    });
  },

  async unenroll(cursoId: string, turmaId: string, alunoId: string) {
    return prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findUnique({
        where: { id: turmaId },
        select: { id: true, cursoId: true },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const inscricao = await tx.cursosTurmasInscricoes.findUnique({
        where: { turmaId_alunoId: { turmaId, alunoId } },
        select: { id: true },
      });

      if (!inscricao) {
        const error = new Error('Aluno não está inscrito nesta turma');
        (error as any).code = 'ALUNO_NAO_INSCRITO';
        throw error;
      }

      await tx.cursosTurmasInscricoes.delete({
        where: { turmaId_alunoId: { turmaId, alunoId } },
      });

      return fetchTurmaDetailed(tx, turmaId);
    });
  },
};
