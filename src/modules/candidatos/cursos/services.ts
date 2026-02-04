/**
 * Service de Cursos para ALUNO_CANDIDATO
 *
 * Retorna:
 * - Próxima aula (se houver)
 * - Lista de cursos com paginação (8 por página)
 * - Filtros por modalidade (Todos, Online, Ao Vivo, Presencial, Semi-presencial)
 */

import { prisma } from '@/config/prisma';
import { CursosMetodos, StatusInscricao } from '@prisma/client';
import { logger } from '@/utils/logger';

const cursosLogger = logger.child({ module: 'CandidatoCursosService' });

/**
 * Formata o status da inscrição para exibição
 */
const formatarStatusInscricao = (status: StatusInscricao): string => {
  const statusMap: Record<StatusInscricao, string> = {
    [StatusInscricao.INSCRITO]: 'Não iniciado',
    [StatusInscricao.EM_ANDAMENTO]: 'Em Andamento',
    [StatusInscricao.CONCLUIDO]: 'Concluído',
    [StatusInscricao.REPROVADO]: 'Reprovado',
    [StatusInscricao.EM_ESTAGIO]: 'Em Estágio',
    [StatusInscricao.CANCELADO]: 'Cancelado',
    [StatusInscricao.TRANCADO]: 'Trancado',
    [StatusInscricao.AGUARDANDO_PAGAMENTO]: 'Aguardando Pagamento',
  };
  return statusMap[status] || status;
};

/**
 * Busca a próxima aula agendada para o candidato
 */
const buscarProximaAula = async (usuarioId: string) => {
  try {
    const agora = new Date();

    // Buscar a próxima aula ao vivo, online ou presencial
    const proximaAula = await prisma.cursosTurmasAulas.findFirst({
      where: {
        dataInicio: {
          gte: agora,
        },
        status: {
          in: ['PUBLICADA', 'EM_ANDAMENTO'],
        },
        modalidade: {
          in: ['LIVE', 'ONLINE', 'PRESENCIAL', 'SEMIPRESENCIAL'],
        },
        CursosTurmas: {
          CursosTurmasInscricoes: {
            some: {
              alunoId: usuarioId,
              status: {
                in: [
                  StatusInscricao.INSCRITO,
                  StatusInscricao.EM_ANDAMENTO,
                  StatusInscricao.EM_ESTAGIO,
                ],
              },
            },
          },
        },
      },
      include: {
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            Cursos: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
      },
      orderBy: {
        dataInicio: 'asc',
      },
    });

    if (!proximaAula) {
      return null;
    }

    if (!proximaAula.CursosTurmas) {
      return null;
    }

    return {
      id: proximaAula.id,
      titulo: proximaAula.nome,
      descricao: proximaAula.descricao || null,
      dataInicio: proximaAula.dataInicio,
      dataFim: proximaAula.dataFim,
      modalidade: proximaAula.modalidade,
      urlMeet: proximaAula.urlMeet || null,
      urlVideo: proximaAula.urlVideo || null,
      turma: {
        id: proximaAula.CursosTurmas.id,
        nome: proximaAula.CursosTurmas.nome,
        curso: {
          id: proximaAula.CursosTurmas.Cursos.id,
          nome: proximaAula.CursosTurmas.Cursos.nome,
        },
      },
    };
  } catch (error) {
    cursosLogger.error(
      {
        usuarioId,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      'Erro ao buscar próxima aula',
    );
    return null;
  }
};

// Função removida - agora usa _count do Prisma diretamente

export const candidatoCursosService = {
  async listCursos(
    usuarioId: string,
    options: {
      modalidade?: string;
      page?: number;
      limit?: number;
    },
  ) {
    cursosLogger.info({ usuarioId, options }, 'Buscando cursos do candidato');

    const { modalidade = 'TODOS', page = 1, limit = 8 } = options;
    const skip = (page - 1) * limit;

    // Construir filtro de modalidade
    // Mapear valores do frontend para valores do banco
    let modalidadeFilter: CursosMetodos[] | undefined = undefined;

    if (modalidade !== 'TODOS') {
      const modalidadeUpper = modalidade.toUpperCase();
      if (modalidadeUpper === 'AO_VIVO') {
        modalidadeFilter = ['LIVE'];
      } else {
        // Validar se é um valor válido do enum
        const validModalidades: CursosMetodos[] = [
          'ONLINE',
          'PRESENCIAL',
          'LIVE',
          'SEMIPRESENCIAL',
        ];
        if (validModalidades.includes(modalidadeUpper as CursosMetodos)) {
          modalidadeFilter = [modalidadeUpper as CursosMetodos];
        }
      }
    }

    // Buscar inscrições do candidato
    const where: any = {
      alunoId: usuarioId,
      status: {
        in: [
          StatusInscricao.INSCRITO,
          StatusInscricao.EM_ANDAMENTO,
          StatusInscricao.CONCLUIDO,
          StatusInscricao.EM_ESTAGIO,
          StatusInscricao.REPROVADO,
          StatusInscricao.CANCELADO,
          StatusInscricao.TRANCADO,
        ],
      },
      CursosTurmas: {
        ...(modalidadeFilter && {
          metodo: {
            in: modalidadeFilter,
          },
        }),
      },
    };

    // Buscar total de registros
    const total = await prisma.cursosTurmasInscricoes.count({ where });

    // Buscar inscrições com paginação (otimizado com _count)
    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        criadoEm: 'desc',
      },
      select: {
        id: true,
        status: true,
        turmaId: true,
        criadoEm: true,
        _count: {
          select: {
            CursosFrequenciaAlunos: {
              where: { status: 'PRESENTE' },
            },
            CursosNotas: {
              where: { nota: { not: null } },
            },
          },
        },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            metodo: true,
            dataInicio: true,
            dataFim: true,
            _count: {
              select: {
                CursosTurmasAulas: true,
                CursosTurmasProvas: true,
              },
            },
            Cursos: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                imagemUrl: true,
                cargaHoraria: true,
              },
            },
          },
        },
        CursosNotas: {
          where: {
            nota: { not: null },
          },
          select: {
            nota: true,
            peso: true,
          },
        },
      },
    });

    // Processar cada inscrição para adicionar dados calculados (SEM queries adicionais)
    const cursos = inscricoes.map((inscricao) => {
      // Calcular progresso usando dados já carregados
      const totalAulas = inscricao.CursosTurmas._count.CursosTurmasAulas;
      const totalProvas = inscricao.CursosTurmas._count.CursosTurmasProvas;
      const aulasPresentes = inscricao._count.CursosFrequenciaAlunos;

      let progresso = 0;
      if (totalAulas === 0 && totalProvas === 0) {
        // Calcular por tempo se não houver aulas/provas
        if (inscricao.CursosTurmas.dataInicio && inscricao.CursosTurmas.dataFim) {
          const agora = new Date();
          const inicio = new Date(inscricao.CursosTurmas.dataInicio).getTime();
          const fim = new Date(inscricao.CursosTurmas.dataFim).getTime();
          const atual = agora.getTime();
          if (fim > inicio) {
            progresso = Math.round(
              Math.min(100, Math.max(0, ((atual - inicio) / (fim - inicio)) * 100)),
            );
          }
        }
      } else {
        const progressoAulas = totalAulas > 0 ? (aulasPresentes / totalAulas) * 100 : 0;
        progresso = Math.round(Math.min(100, Math.max(0, progressoAulas)));
      }

      // Calcular nota média usando dados já carregados
      let notaMedia: number | null = null;
      if (inscricao.CursosNotas && inscricao.CursosNotas.length > 0) {
        let somaPonderada = 0;
        let somaPesos = 0;
        for (const nota of inscricao.CursosNotas) {
          if (nota.nota && nota.peso) {
            somaPonderada += Number(nota.nota) * Number(nota.peso);
            somaPesos += Number(nota.peso);
          }
        }
        if (somaPesos > 0) {
          notaMedia = Math.round((somaPonderada / somaPesos) * 10) / 10;
        }
      }

      return {
        id: inscricao.id,
        cursoId: inscricao.CursosTurmas.Cursos.id,
        turmaId: inscricao.CursosTurmas.id,
        foto: inscricao.CursosTurmas.Cursos.imagemUrl,
        status: formatarStatusInscricao(inscricao.status),
        nome: inscricao.CursosTurmas.Cursos.nome,
        descricao: inscricao.CursosTurmas.Cursos.descricao,
        progresso,
        iniciadoEm: inscricao.criadoEm,
        quantidadeAulas: totalAulas + totalProvas,
        notaMedia,
      };
    });

    // Buscar próxima aula
    const proximaAula = await buscarProximaAula(usuarioId);

    return {
      proximaAula,
      cursos,
      paginacao: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },
};
