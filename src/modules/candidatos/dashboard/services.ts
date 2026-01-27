/**
 * Service de Dashboard para ALUNO_CANDIDATO
 * 
 * Retorna:
 * - Métricas (cursos em progresso, concluídos, total de cursos, total de candidaturas)
 * - Últimos 8 cursos com progresso
 * - Últimas 8 candidaturas enviadas
 */

import { prisma } from '@/config/prisma';
import { StatusInscricao } from '@prisma/client';
import { logger } from '@/utils/logger';

const dashboardLogger = logger.child({ module: 'CandidatoDashboardService' });

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

export const candidatoDashboardService = {
  /**
   * Busca dados completos do dashboard do candidato
   */
  getDashboard: async (usuarioId: string) => {
    try {
      dashboardLogger.info({ usuarioId }, 'Buscando dashboard do candidato');

      // 1. Buscar métricas (cursos e candidaturas)
      const [inscricoes, candidaturas] = await Promise.all([
        prisma.cursosTurmasInscricoes.findMany({
          where: { alunoId: usuarioId },
          select: {
            id: true,
            status: true,
            criadoEm: true,
          },
        }),
        prisma.empresasCandidatos.findMany({
          where: { candidatoId: usuarioId },
          select: {
            id: true,
          },
        }),
      ]);

      // Calcular métricas
      const cursosEmProgresso = inscricoes.filter((i) =>
        ['INSCRITO', 'EM_ANDAMENTO'].includes(i.status),
      ).length;
      const cursosConcluidos = inscricoes.filter((i) => i.status === StatusInscricao.CONCLUIDO)
        .length;
      const totalCursos = inscricoes.length;
      const totalCandidaturas = candidaturas.length;

      // 2. Buscar últimos 8 cursos com detalhes (otimizado com _count)
      const ultimosCursos = await prisma.cursosTurmasInscricoes.findMany({
        where: { alunoId: usuarioId },
        take: 8,
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          status: true,
          criadoEm: true,
          turmaId: true,
          _count: {
            select: {
              CursosFrequenciaAlunos: {
                where: { status: 'PRESENTE' },
              },
            },
          },
          CursosTurmas: {
            select: {
              id: true,
              nome: true,
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
                },
              },
            },
          },
        },
      });

      // Calcular progresso para cada curso (agora sem queries adicionais)
      const cursosComProgresso = ultimosCursos.map((inscricao) => {
        // Calcular progresso usando os dados já carregados
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
              progresso = Math.round(Math.min(100, Math.max(0, ((atual - inicio) / (fim - inicio)) * 100)));
            }
          }
        } else {
          const progressoAulas = totalAulas > 0 ? (aulasPresentes / totalAulas) * 100 : 0;
          // Para o dashboard, só considerar aulas presentes (provas exigem query extra)
          progresso = Math.round(Math.min(100, Math.max(0, progressoAulas)));
        }

        // Determinar status para exibição
        let statusExibicao: string;
        if (inscricao.status === StatusInscricao.CONCLUIDO) {
          statusExibicao = 'Concluído';
        } else if (inscricao.status === StatusInscricao.EM_ANDAMENTO) {
          statusExibicao = 'Em progresso';
        } else if (inscricao.status === StatusInscricao.INSCRITO) {
          statusExibicao = 'Em progresso';
        } else if (inscricao.status === StatusInscricao.CANCELADO || inscricao.status === StatusInscricao.TRANCADO) {
          statusExibicao = 'Cancelado';
        } else {
          statusExibicao = 'Não iniciado';
        }

        return {
          id: inscricao.id,
          cursoId: inscricao.CursosTurmas.Cursos.id,
          turmaId: inscricao.CursosTurmas.id,
          foto: inscricao.CursosTurmas.Cursos.imagemUrl,
          status: statusExibicao,
          nome: inscricao.CursosTurmas.Cursos.nome,
          descricao: inscricao.CursosTurmas.Cursos.descricao,
          progresso,
          iniciadoEm: inscricao.criadoEm,
        };
      });

      // 3. Buscar últimas 8 candidaturas com detalhes da vaga
      const ultimasCandidaturas = await prisma.empresasCandidatos.findMany({
        where: { candidatoId: usuarioId },
        take: 8,
        orderBy: { aplicadaEm: 'desc' },
        select: {
          id: true,
          vagaId: true,
          aplicadaEm: true,
          EmpresasVagas: {
            select: {
              id: true,
              titulo: true,
              slug: true,
              modoAnonimo: true,
              regimeDeTrabalho: true,
              modalidade: true,
              localizacao: true,
              inseridaEm: true,
              Usuarios: {
                select: {
                  id: true,
                  nomeCompleto: true,
                },
              },
            },
          },
        },
      });

      // Formatar candidaturas com validação de modo anônimo
      const candidaturasFormatadas = ultimasCandidaturas.map((candidatura) => {
        const vaga = candidatura.EmpresasVagas;
        const localizacao = vaga.localizacao as { cidade?: string; estado?: string } | null;

        // Determinar nome da empresa (ou "Anônima" se modoAnonimo)
        let nomeEmpresa: string;
        if (vaga.modoAnonimo) {
          nomeEmpresa = 'Anônima';
        } else {
          nomeEmpresa = vaga.Usuarios?.nomeCompleto || 'Empresa não informada';
        }

        // Formatar localização
        let localFormatado: string;
        if (localizacao?.cidade && localizacao?.estado) {
          localFormatado = `${localizacao.cidade}, ${localizacao.estado}`;
        } else if (vaga.modalidade === 'REMOTO') {
          localFormatado = 'Remoto';
        } else if (vaga.modalidade === 'HIBRIDO') {
          localFormatado = localizacao?.cidade
            ? `${localizacao.cidade} (Híbrido)`
            : 'Híbrido';
        } else {
          localFormatado = 'Não informado';
        }

        return {
          id: candidatura.id,
          vagaId: candidatura.vagaId,
          nomeVaga: vaga.titulo,
          empresa: nomeEmpresa,
          local: localFormatado,
          publicadaEm: vaga.inseridaEm,
          regimeTrabalho: vaga.regimeDeTrabalho,
          modalidade: vaga.modalidade,
          aplicadaEm: candidatura.aplicadaEm,
          slug: vaga.slug,
        };
      });

      return {
        metricas: {
          cursosEmProgresso,
          cursosConcluidos,
          totalCursos,
          totalCandidaturas,
        },
        cursos: cursosComProgresso,
        candidaturas: candidaturasFormatadas,
      };
    } catch (error) {
      dashboardLogger.error(
        { usuarioId, error: error instanceof Error ? error.message : 'Erro desconhecido' },
        'Erro ao buscar dashboard do candidato',
      );
      throw error;
    }
  },
};

