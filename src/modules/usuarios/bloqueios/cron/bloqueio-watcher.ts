import cron from 'node-cron';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { AcoesDeLogDeBloqueio, Status, StatusDeBloqueios } from '@prisma/client';
import { EmailService } from '@/modules/brevo/services/email-service';
import { EmailTemplates } from '@/modules/brevo/templates/email-templates';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';

const log = logger.child({ module: 'BloqueiosWatcher' });

const metrics = {
  totalProcessed: 0,
  processedLastRun: 0,
  lastRunAt: null as Date | null,
};

export async function processExpiredBlocks() {
  // Verificar conexão ANTES de tentar executar qualquer query
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    log.debug('Banco de dados não disponível, pulando processamento de bloqueios expirados');
    return { processed: 0 };
  }

  try {
    const now = new Date();
    const expirados = await prisma.usuariosEmBloqueios.findMany({
      where: { status: StatusDeBloqueios.ATIVO, fim: { lt: now } },
      select: { id: true, usuarioId: true },
    });

    let processed = 0;
    for (const bloqueio of expirados) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.usuariosEmBloqueios.update({
            where: { id: bloqueio.id },
            data: {
              status: StatusDeBloqueios.REVOGADO,
              UsuariosEmBloqueiosLogs: {
                create: {
                  acao: AcoesDeLogDeBloqueio.REVOGACAO,
                  criadoPorId: bloqueio.usuarioId, // auto, sem administrador explícito
                  descricao: 'Revogação automática por expiração da vigência do bloqueio.',
                },
              },
            },
          });
          await tx.usuarios.update({
            where: { id: bloqueio.usuarioId },
            data: { status: Status.ATIVO },
          });
        });

        // Notificação por e-mail
        const usuario = await prisma.usuarios.findUnique({
          where: { id: bloqueio.usuarioId },
          select: { email: true, nomeCompleto: true },
        });
        if (usuario?.email) {
          const emailService = new EmailService();
          const template = EmailTemplates.generateUserUnblockedEmail({
            nomeCompleto: usuario.nomeCompleto,
          });
          await emailService.sendAssinaturaNotificacao(
            { id: bloqueio.usuarioId, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
            template,
          );
        }

        processed += 1;
      } catch (err) {
        log.warn(
          { err, bloqueioId: bloqueio.id, usuarioId: bloqueio.usuarioId },
          'Falha ao revogar bloqueio expirado',
        );
      }
    }

    metrics.totalProcessed += processed;
    metrics.processedLastRun = processed;
    metrics.lastRunAt = new Date();
    return { processed };
  } catch (error) {
    // Tratar erros de conexão como warning
    if (handlePrismaConnectionError(error, log, 'processExpiredBlocks')) {
      return { processed: 0 }; // Retornar 0 processados em caso de erro de conexão
    }
    // Re-lançar outros erros
    throw error;
  }
}

export function startBloqueiosWatcherJob() {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    log.debug('Test environment detectado, pulando watcher de bloqueios');
    return;
  }

  // A cada hora, minuto 5
  const schedule = process.env.BLOQUEIOS_WATCHER_SCHEDULE || '5 * * * *';
  cron.schedule(schedule, async () => {
    try {
      const result = await processExpiredBlocks();
      if (result.processed > 0) {
        log.info({ processed: result.processed }, 'Bloqueios expirados revogados');
      }
    } catch (err) {
      // Tratar erros de conexão como warning, outros erros como error
      if (handlePrismaConnectionError(err, log, 'bloqueios-watcher')) {
        return; // Erro de conexão tratado, não precisa logar como error
      }

      log.error({ err }, 'Erro ao processar bloqueios expirados');
    }
  });
  log.info({ schedule }, '⏱️ Bloqueios watcher agendado');
}

export function getBloqueiosWatcherMetrics() {
  return {
    totalProcessed: metrics.totalProcessed,
    processedLastRun: metrics.processedLastRun,
    lastRunAt: metrics.lastRunAt ? metrics.lastRunAt.toISOString() : null,
  };
}
