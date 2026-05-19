import cron from 'node-cron';

import { CursoStatus, Prisma, Roles, Status } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';
import { notificacoesHelper } from '@/modules/cursos/aulas/services/notificacoes-helper.service';

const watcherLogger = logger.child({ module: 'CursosTurmasStatusWatcher' });

const DEFAULT_SCHEDULE = process.env.TURMAS_STATUS_WATCHER_CRON || '*/15 * * * *';

type TurmaDates = {
  id?: string;
  nome?: string;
  status: CursoStatus;
  dataInscricaoInicio: Date | null;
  dataInscricaoFim: Date | null;
  dataInicio: Date | null;
  dataFim: Date | null;
};

type TurmaWatcherPayload = TurmaDates & {
  id: string;
  nome: string;
  Cursos: {
    id: string;
    nome: string;
  };
};

/**
 * Regras (datas são tratadas como "viradas" de status, no início do dia):
 * - status do usuário: RASCUNHO ou PUBLICADO
 * - demais status são automáticos e seguem intervalos [inicio, fim):
 *   - PUBLICADO: agora < dataInscricaoInicio
 *   - INSCRICOES_ABERTAS: dataInscricaoInicio <= agora < dataInscricaoFim
 *   - INSCRICOES_ENCERRADAS: dataInscricaoFim <= agora < dataInicio
 *   - EM_ANDAMENTO: dataInicio <= agora < dataFim
 *   - CONCLUIDO: agora >= dataFim
 */
const computeStatusFromDates = (turma: TurmaDates, agora: Date): CursoStatus | null => {
  if (turma.status === CursoStatus.RASCUNHO) {
    return null;
  }

  const { dataInscricaoInicio, dataInscricaoFim, dataInicio, dataFim } = turma;
  if (!dataInscricaoInicio || !dataInscricaoFim || !dataInicio || !dataFim) {
    return null;
  }

  const now = agora.getTime();

  if (now < dataInscricaoInicio.getTime()) return CursoStatus.PUBLICADO;
  if (now < dataInscricaoFim.getTime()) return CursoStatus.INSCRICOES_ABERTAS;
  if (now < dataInicio.getTime()) return CursoStatus.INSCRICOES_ENCERRADAS;
  if (now < dataFim.getTime()) return CursoStatus.EM_ANDAMENTO;
  return CursoStatus.CONCLUIDO;
};

const formatDateTimePtBr = (date?: Date | null) =>
  date
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Maceio',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
    : null;

const countTurmaEstruturaItems = async (turmaId: string) => {
  const [aulasCount, provasCount] = await Promise.all([
    prisma.cursosTurmasAulas.count({
      where: {
        turmaId,
        deletedAt: null,
      },
    }),
    prisma.cursosTurmasProvas.count({
      where: {
        turmaId,
        ativo: true,
      },
    }),
  ]);

  return aulasCount + provasCount;
};

const getUsuariosGestaoTurmas = async () =>
  prisma.usuarios.findMany({
    where: {
      role: { in: [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO] },
      status: Status.ATIVO,
    },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
    },
  });

const buildDashboardTurmaLink = (turma: TurmaWatcherPayload) =>
  `/dashboard/cursos/turmas/${turma.id}?cursoId=${turma.Cursos.id}`;

const notificarGestoresTurma = async (
  turma: TurmaWatcherPayload,
  notificacao: {
    tipo: 'TURMA_ESTRUTURA_PENDENTE_24H' | 'TURMA_INICIO_BLOQUEADO_ESTRUTURA';
    titulo: string;
    mensagem: string;
    prioridade: 'ALTA' | 'URGENTE';
    eventoId: string;
  },
) => {
  const gestores = await getUsuariosGestaoTurmas();
  const linkAcao = buildDashboardTurmaLink(turma);

  for (const gestor of gestores) {
    const notificacaoCriada = await notificacoesHelper.criar({
      usuarioId: gestor.id,
      tipo: notificacao.tipo,
      titulo: notificacao.titulo,
      mensagem: notificacao.mensagem,
      prioridade: notificacao.prioridade,
      linkAcao,
      eventoId: notificacao.eventoId,
      dados: {
        turmaId: turma.id,
        cursoId: turma.Cursos.id,
        dataInicio: turma.dataInicio?.toISOString() ?? null,
      },
    });

    if (notificacaoCriada) {
      await notificacoesHelper.enviarEmailCritico({
        para: gestor.email,
        nomeDestinatario: gestor.nomeCompleto,
        assunto: notificacao.titulo,
        mensagem: notificacao.mensagem,
        linkAcao: `${process.env.FRONTEND_URL ?? ''}${linkAcao}`,
      });
    }
  }

  return gestores.length;
};

const notificarEstruturaPendente24h = async (turma: TurmaWatcherPayload) => {
  const dataInicio = formatDateTimePtBr(turma.dataInicio) ?? 'a data programada';
  const prazo = formatDateTimePtBr(turma.dataInicio) ?? 'o horário de início';

  return notificarGestoresTurma(turma, {
    tipo: 'TURMA_ESTRUTURA_PENDENTE_24H',
    titulo: `Estrutura pendente: ${turma.nome}`,
    mensagem: `A turma "${turma.nome}" do curso "${turma.Cursos.nome}" está prevista para iniciar em ${dataInicio} e ainda não possui estrutura. Cadastre pelo menos 1 item até ${prazo} para que ela possa iniciar. Se não for corrigida, a turma voltará para rascunho e os alunos permanecerão aguardando nova data.`,
    prioridade: 'ALTA',
    eventoId: `turma-estrutura-24h-${turma.id}-${turma.dataInicio?.toISOString() ?? ''}`,
  });
};

const notificarInicioBloqueado = async (turma: TurmaWatcherPayload) => {
  await notificarGestoresTurma(turma, {
    tipo: 'TURMA_INICIO_BLOQUEADO_ESTRUTURA',
    titulo: `Início bloqueado: ${turma.nome}`,
    mensagem: `A turma "${turma.nome}" do curso "${turma.Cursos.nome}" não iniciou porque ainda está sem estrutura. Para publicar novamente, adicione ao menos 1 item e informe uma nova data de início e fim futuras.`,
    prioridade: 'URGENTE',
    eventoId: `turma-inicio-bloqueado-${turma.id}-${turma.dataInicio?.toISOString() ?? ''}`,
  });

  await notificacoesHelper.notificarAlunosDaTurma(turma.id, {
    tipo: 'TURMA_INICIO_REPROGRAMADO',
    titulo: `Turma reprogramada: ${turma.nome}`,
    mensagem: `A turma "${turma.nome}" precisou ser reprogramada por um ajuste operacional. Em breve divulgaremos a nova data de início. Você continua inscrito e será avisado assim que o novo cronograma for confirmado. Atenciosamente, Direção Advance+.`,
    prioridade: 'ALTA',
    linkAcao: `/turmas/${turma.id}`,
    eventoId: `turma-inicio-reprogramado-${turma.id}-${turma.dataInicio?.toISOString() ?? ''}`,
    enviarEmail: true,
    emailAssunto: `Turma ${turma.nome} reprogramada`,
    emailMensagem: `A turma "${turma.nome}" precisou ser reprogramada por um ajuste operacional. Em breve divulgaremos a nova data de início. Você continua inscrito e será avisado assim que o novo cronograma for confirmado. Atenciosamente, Direção Advance+.`,
  });
};

export const processTurmasStatusWatcherTick = async (agora = new Date()) => {
  const turmas = await prisma.cursosTurmas.findMany({
    where: {
      deletedAt: null,
      status: {
        in: [
          CursoStatus.PUBLICADO,
          CursoStatus.INSCRICOES_ABERTAS,
          CursoStatus.INSCRICOES_ENCERRADAS,
          CursoStatus.EM_ANDAMENTO,
        ],
      },
    },
    select: {
      id: true,
      nome: true,
      status: true,
      dataInscricaoInicio: true,
      dataInscricaoFim: true,
      dataInicio: true,
      dataFim: true,
      Cursos: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
    take: 2000,
  });

  if (turmas.length === 0) {
    watcherLogger.debug('[CRON] Nenhuma turma candidata a atualização de status');
    return {
      totalCandidatas: 0,
      totalUpdated: 0,
      totalBloqueadasPorEstrutura: 0,
    };
  }

  const updatesByStatus = new Map<CursoStatus, string[]>();
  let totalBloqueadasPorEstrutura = 0;

  for (const turma of turmas as TurmaWatcherPayload[]) {
    const desired = computeStatusFromDates(turma, agora);
    const msAteInicio = turma.dataInicio ? turma.dataInicio.getTime() - agora.getTime() : null;
    const estaNaJanela24h =
      msAteInicio !== null && msAteInicio > 0 && msAteInicio <= 24 * 60 * 60 * 1000;

    if (
      estaNaJanela24h &&
      turma.status !== CursoStatus.EM_ANDAMENTO &&
      (await countTurmaEstruturaItems(turma.id)) === 0
    ) {
      await notificarEstruturaPendente24h(turma);
    }

    if (!desired || desired === turma.status) {
      continue;
    }

    if (desired === CursoStatus.EM_ANDAMENTO && (await countTurmaEstruturaItems(turma.id)) === 0) {
      await prisma.cursosTurmas.update({
        where: { id: turma.id },
        data: {
          status: CursoStatus.RASCUNHO,
          atualizadoEm: agora,
        },
      });

      await notificarInicioBloqueado(turma);
      totalBloqueadasPorEstrutura++;
      continue;
    }

    const list = updatesByStatus.get(desired) ?? [];
    list.push(turma.id);
    updatesByStatus.set(desired, list);
  }

  let totalUpdated = totalBloqueadasPorEstrutura;

  for (const [newStatus, turmaIds] of updatesByStatus.entries()) {
    if (turmaIds.length === 0) continue;

    const where: Prisma.CursosTurmasWhereInput = {
      id: { in: turmaIds },
      status: { not: CursoStatus.RASCUNHO },
    };

    const result = await prisma.cursosTurmas.updateMany({
      where,
      data: {
        status: newStatus,
        atualizadoEm: agora,
      },
    });

    totalUpdated += result.count;
  }

  return {
    totalCandidatas: turmas.length,
    totalUpdated,
    totalBloqueadasPorEstrutura,
  };
};

export const startTurmasStatusWatcherJob = () => {
  if (process.env.NODE_ENV === 'test') {
    watcherLogger.debug('Test environment detectado, pulando watcher de status de turmas');
    return null;
  }

  const schedule = DEFAULT_SCHEDULE;

  const task = cron.schedule(
    schedule,
    async () => {
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        watcherLogger.debug('Banco de dados não disponível, pulando watcher de status de turmas');
        return;
      }

      const agora = new Date();

      try {
        const result = await processTurmasStatusWatcherTick(agora);

        if (result.totalUpdated === 0) {
          watcherLogger.debug('[CRON] Status das turmas já está atualizado');
          return;
        }

        watcherLogger.info(
          { ...result, schedule },
          '[CRON] Atualização automática de status de turmas concluída',
        );
      } catch (error) {
        if (handlePrismaConnectionError(error, watcherLogger, 'turmas-status-watcher')) {
          return;
        }

        watcherLogger.error(
          { err: error },
          '[CRON] Falha ao atualizar status automático de turmas',
        );
      }
    },
    { scheduled: false },
  );

  task.start();
  watcherLogger.info({ schedule }, 'Watcher de status de turmas iniciado');
  return task;
};
