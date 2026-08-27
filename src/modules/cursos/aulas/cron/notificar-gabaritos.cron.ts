import { CursosNotasTipo, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { pagamentosAlunoService } from '@/modules/cursos/services/pagamentos-aluno.service';
import { logger } from '@/utils/logger';
import { obterLiberacaoGabarito } from '../../utils/gabarito';
import { notificacoesHelper } from '../services/notificacoes-helper.service';

const cronLogger = logger.child({ module: 'CronNotificarGabaritos' });

export async function notificarGabaritosDisponiveis(agora = new Date()) {
  const desde = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const envios = await prisma.cursosTurmasProvasEnvios.findMany({
    where: {
      realizadoEm: { not: null },
      CursosTurmasProvas: {
        ativo: true,
        status: 'PUBLICADA',
        dataFim: { gte: desde },
        horaTermino: { not: null },
        CursosTurmasProvasQuestoes: {
          some: { tipo: 'MULTIPLA_ESCOLHA' },
          every: { tipo: 'MULTIPLA_ESCOLHA' },
        },
      },
    },
    select: {
      id: true,
      nota: true,
      pesoTotal: true,
      realizadoEm: true,
      inscricaoId: true,
      CursosTurmasInscricoes: { select: { alunoId: true } },
      CursosTurmasProvas: {
        select: {
          id: true,
          cursoId: true,
          turmaId: true,
          titulo: true,
          tipo: true,
          dataFim: true,
          horaTermino: true,
        },
      },
    },
    take: 500,
  });

  const enviosLiberados = envios.filter((envio) => {
    const avaliacao = envio.CursosTurmasProvas;
    const liberacao = obterLiberacaoGabarito(avaliacao.dataFim, avaliacao.horaTermino, agora);
    return liberacao.disponivel;
  });

  const notas = enviosLiberados.flatMap((envio) => {
    const avaliacao = envio.CursosTurmasProvas;
    if (envio.nota === null || !avaliacao.turmaId) return [];

    const peso = envio.pesoTotal ?? new Prisma.Decimal(0);
    return [
      {
        turmaId: avaliacao.turmaId,
        inscricaoId: envio.inscricaoId,
        tipo: avaliacao.tipo === 'PROVA' ? CursosNotasTipo.PROVA : CursosNotasTipo.ATIVIDADE,
        provaId: avaliacao.id,
        titulo: avaliacao.titulo,
        nota: envio.nota,
        peso,
        valorMaximo: peso,
        dataReferencia: envio.realizadoEm,
        atualizadoEm: agora,
      },
    ];
  });

  if (notas.length > 0) {
    await prisma.cursosNotas.createMany({ data: notas, skipDuplicates: true });
  }

  let notificadas = 0;
  for (const envio of enviosLiberados) {
    const avaliacao = envio.CursosTurmasProvas;
    const liberacao = obterLiberacaoGabarito(avaliacao.dataFim, avaliacao.horaTermino, agora);

    const criada = await notificacoesHelper.criar({
      usuarioId: envio.CursosTurmasInscricoes.alunoId,
      tipo: 'SISTEMA',
      titulo: 'Gabarito disponível',
      mensagem: `O gabarito de "${avaliacao.titulo}" já está disponível.`,
      prioridade: 'NORMAL',
      linkAcao: `/dashboard/cursos/alunos/cursos/${avaliacao.cursoId}/${avaliacao.turmaId}/${avaliacao.id}`,
      eventoId: `gabarito-${envio.id}`,
      dados: {
        evento: 'GABARITO_DISPONIVEL',
        avaliacaoId: avaliacao.id,
        tipoAvaliacao: avaliacao.tipo,
        cursoId: avaliacao.cursoId,
        turmaId: avaliacao.turmaId,
        disponivelEm: liberacao.disponivelEm?.toISOString(),
      },
    });
    if (criada) {
      notificadas += 1;
      await pagamentosAlunoService.reconciliarRecuperacaoInscricao(envio.inscricaoId);
    }
  }

  cronLogger.info(
    { enviosAnalisados: envios.length, notificadas },
    '[CRON] Gabaritos disponíveis processados',
  );

  return { enviosAnalisados: envios.length, notificadas };
}
