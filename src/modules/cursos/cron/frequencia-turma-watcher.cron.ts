import cron from 'node-cron';
import crypto from 'crypto';

import { CursoStatus, StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';
import { notificacoesHelper } from '@/modules/cursos/aulas/services/notificacoes-helper.service';
import { resolveInstrutorAttendeeIds } from '@/modules/cursos/aulas/services/meet-attendees.helper';
import { frequenciaTurmaService } from '@/modules/cursos/services/frequencia-turma.service';

const watcherLogger = logger.child({ module: 'FrequenciaTurmaWatcher' });

const DEFAULT_SCHEDULE = process.env.FREQUENCIA_TURMA_WATCHER_CRON || '*/30 * * * *';
const ALERTA_VALIDADE_DIAS = 7;
const CHECKPOINTS = [20, 40, 60, 80, 100];

type TurmaCandidata = {
  id: string;
  nome: string;
  instrutorId: string | null;
  Cursos: { id: string; nome: string };
  CursosTurmasInstrutores: { instrutorId: string }[];
};

const gerarToken = () => crypto.randomBytes(32).toString('hex');

const buildLinkAlerta = (turmaId: string, token: string) =>
  `/dashboard/turma/${turmaId}/alerta/${token}`;

async function processarTurma(turma: TurmaCandidata, agora: Date) {
  const { total, itensOcorridos, aulas, provaIds } =
    await frequenciaTurmaService.contarItensDaTurma(turma.id, agora);

  const checkpointAtual = frequenciaTurmaService.calcularCheckpoint(itensOcorridos, total);
  if (checkpointAtual <= 0) return { processado: false };

  const jaProcessado = await prisma.cursosTurmasFrequenciaCheckpoints.findUnique({
    where: { turmaId_checkpoint: { turmaId: turma.id, checkpoint: checkpointAtual } },
  });
  if (jaProcessado) return { processado: false };

  // Marca todos os checkpoints <= atual como vistos (evita reprocessar se o cron
  // ficou parado e a turma "pulou" marcos), mas só alerta para o mais recente.
  const checkpointsAnteriores = CHECKPOINTS.filter((c) => c <= checkpointAtual);
  await prisma.cursosTurmasFrequenciaCheckpoints.createMany({
    data: checkpointsAnteriores.map((checkpoint) => ({ turmaId: turma.id, checkpoint })),
    skipDuplicates: true,
  });

  const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
    where: { turmaId: turma.id, status: StatusInscricao.INSCRITO },
    select: { id: true, alunoId: true, Usuarios: { select: { nomeCompleto: true, email: true } } },
  });

  const alunosAbaixo: {
    alunoId: string;
    nomeCompleto: string;
    email: string;
    frequenciaPercentual: number;
  }[] = [];

  for (const inscricao of inscricoes) {
    const frequencia = await frequenciaTurmaService.calcularFrequenciaAluno({
      turmaId: turma.id,
      inscricaoId: inscricao.id,
      total,
      aulas,
      provaIds,
    });

    if (frequencia < checkpointAtual) {
      alunosAbaixo.push({
        alunoId: inscricao.alunoId,
        nomeCompleto: inscricao.Usuarios.nomeCompleto,
        email: inscricao.Usuarios.email,
        frequenciaPercentual: Math.round(frequencia),
      });
    }
  }

  if (alunosAbaixo.length === 0) {
    return { processado: true, checkpoint: checkpointAtual, alunosAbaixo: 0 };
  }

  const token = gerarToken();
  const expiraEm = new Date(agora.getTime() + ALERTA_VALIDADE_DIAS * 24 * 60 * 60 * 1000);

  await prisma.cursosTurmasAlertas.create({
    data: {
      turmaId: turma.id,
      checkpoint: checkpointAtual,
      token,
      expiraEm,
      alunosAfetados: alunosAbaixo.map((a) => ({
        alunoId: a.alunoId,
        nomeCompleto: a.nomeCompleto,
        frequenciaPercentual: a.frequenciaPercentual,
      })),
    },
  });

  const linkAcao = buildLinkAlerta(turma.id, token);
  const nomes = alunosAbaixo.map((a) => a.nomeCompleto).join(', ');

  await notificacoesHelper.notificarEquipeDaTurma({
    turmaId: turma.id,
    instrutorIds: resolveInstrutorAttendeeIds(turma.instrutorId, turma),
    tipo: 'TURMA_FREQUENCIA_ALERTA',
    titulo: `Atenção: frequência baixa na turma "${turma.nome}"`,
    mensagem: `A turma "${turma.nome}" do curso "${turma.Cursos.nome}" atingiu ${checkpointAtual}% do cronograma e ${alunosAbaixo.length} aluno(s) está(ão) abaixo do esperado: ${nomes}. Confira os detalhes e avalie os próximos passos.`,
    prioridade: 'ALTA',
    linkAcao,
    eventoId: `turma-frequencia-${turma.id}-${checkpointAtual}`,
  });

  for (const aluno of alunosAbaixo) {
    const mensagem = `Notamos que sua participação na turma "${turma.nome}" está em ${aluno.frequenciaPercentual}%, abaixo do esperado neste momento do curso (${checkpointAtual}%). Dá uma olhada nas aulas, provas e atividades pendentes — ainda dá tempo de recuperar o ritmo!`;

    const notificacaoCriada = await notificacoesHelper.criar({
      usuarioId: aluno.alunoId,
      tipo: 'ALUNO_FREQUENCIA_BAIXA',
      titulo: `Sentimos sua falta na turma "${turma.nome}"`,
      mensagem,
      prioridade: 'ALTA',
      linkAcao: `/turmas/${turma.id}`,
      eventoId: `aluno-frequencia-${turma.id}-${aluno.alunoId}-${checkpointAtual}`,
    });

    if (notificacaoCriada) {
      await notificacoesHelper.enviarEmailCritico({
        para: aluno.email,
        nomeDestinatario: aluno.nomeCompleto,
        assunto: `Como você está indo na turma ${turma.nome}?`,
        mensagem:
          `Sabemos que imprevistos acontecem — por isso viemos aqui: notamos que sua participação na turma "${turma.nome}" está em ${aluno.frequenciaPercentual}%, um pouco abaixo do esperado neste momento do curso (${checkpointAtual}%).\n\n` +
          `Ainda dá tempo de recuperar o ritmo! Acesse a plataforma, veja o que ficou pendente entre aulas, provas e atividades, e organize um tempinho para colocar tudo em dia.\n\n` +
          `Se alguma coisa estiver te atrapalhando — técnica, pessoal ou sobre o conteúdo — fale com a gente. Estamos aqui para te ajudar a chegar até o final.`,
        linkAcao: `${process.env.FRONTEND_URL ?? ''}/turmas/${turma.id}`,
      });
    }
  }

  return { processado: true, checkpoint: checkpointAtual, alunosAbaixo: alunosAbaixo.length };
}

export const processFrequenciaTurmaWatcherTick = async (agora: Date = new Date()) => {
  const turmas = await prisma.cursosTurmas.findMany({
    where: { status: CursoStatus.EM_ANDAMENTO, deletedAt: null },
    select: {
      id: true,
      nome: true,
      instrutorId: true,
      Cursos: { select: { id: true, nome: true } },
      CursosTurmasInstrutores: { select: { instrutorId: true } },
    },
    take: 2000,
  });

  let turmasComAlerta = 0;
  let turmasProcessadas = 0;

  for (const turma of turmas) {
    try {
      const resultado = await processarTurma(turma, agora);
      if (resultado.processado) {
        turmasProcessadas++;
        if (resultado.alunosAbaixo) turmasComAlerta++;
      }
    } catch (error) {
      watcherLogger.error(
        { err: error, turmaId: turma.id },
        'Falha ao processar frequência da turma',
      );
    }
  }

  const alertasExpirados = await prisma.cursosTurmasAlertas.deleteMany({
    where: { expiraEm: { lte: agora } },
  });

  return {
    totalTurmas: turmas.length,
    turmasProcessadas,
    turmasComAlerta,
    alertasExpiradosRemovidos: alertasExpirados.count,
  };
};

export const startFrequenciaTurmaWatcherJob = () => {
  if (process.env.NODE_ENV === 'test') {
    watcherLogger.debug('Test environment detectado, pulando watcher de frequência de turmas');
    return null;
  }

  const schedule = DEFAULT_SCHEDULE;

  const task = cron.schedule(
    schedule,
    async () => {
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        watcherLogger.debug(
          'Banco de dados não disponível, pulando watcher de frequência de turmas',
        );
        return;
      }

      try {
        const resultado = await processFrequenciaTurmaWatcherTick();

        if (resultado.turmasComAlerta === 0 && resultado.alertasExpiradosRemovidos === 0) {
          watcherLogger.debug('[CRON] Nenhum alerta de frequência novo');
          return;
        }

        watcherLogger.info(
          { ...resultado, schedule },
          '[CRON] Verificação de frequência de turmas concluída',
        );
      } catch (error) {
        if (handlePrismaConnectionError(error, watcherLogger, 'frequencia-turma-watcher')) {
          return;
        }

        watcherLogger.error({ err: error }, '[CRON] Falha ao verificar frequência das turmas');
      }
    },
    { scheduled: false },
  );

  task.start();
  watcherLogger.info({ schedule }, 'Watcher de frequência de turmas iniciado');
  return task;
};
