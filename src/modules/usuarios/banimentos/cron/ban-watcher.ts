import cron from 'node-cron';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { AcoesDeLogDeBanimento, Status, StatusDeBanimentos } from '@prisma/client';
import { EmailService } from '@/modules/brevo/services/email-service';
import { EmailTemplates } from '@/modules/brevo/templates/email-templates';

const log = logger.child({ module: 'BanimentosWatcher' });

const metrics = {
  totalProcessed: 0,
  processedLastRun: 0,
  lastRunAt: null as Date | null,
};

export async function processExpiredBans() {
  const now = new Date();
  const expirados = await prisma.usuariosEmBanimentos.findMany({
    where: { status: StatusDeBanimentos.ATIVO, fim: { lt: now } },
    select: { id: true, usuarioId: true },
  });

  let processed = 0;
  for (const ban of expirados) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.usuariosEmBanimentos.update({
          where: { id: ban.id },
          data: {
            status: StatusDeBanimentos.REVOGADO,
            logs: {
              create: {
                acao: AcoesDeLogDeBanimento.REVOGACAO,
                criadoPorId: ban.usuarioId, // auto, sem administrador explícito
                descricao: 'Revogação automática por expiração da vigência do banimento.',
              },
            },
          },
        });
        await tx.usuarios.update({ where: { id: ban.usuarioId }, data: { status: Status.ATIVO } });
      });

      // Notificação por e-mail
      const usuario = await prisma.usuarios.findUnique({
        where: { id: ban.usuarioId },
        select: { email: true, nomeCompleto: true },
      });
      if (usuario?.email) {
        const emailService = new EmailService();
        const template = EmailTemplates.generateUserUnbannedEmail({
          nomeCompleto: usuario.nomeCompleto,
        });
        await emailService.sendAssinaturaNotificacao(
          { id: ban.usuarioId, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
          template,
        );
      }

      processed += 1;
    } catch (err) {
      log.warn(
        { err, banId: ban.id, usuarioId: ban.usuarioId },
        'Falha ao revogar banimento expirado',
      );
    }
  }

  metrics.totalProcessed += processed;
  metrics.processedLastRun = processed;
  metrics.lastRunAt = new Date();
  return { processed };
}

export function startBanimentosWatcherJob() {
  // A cada hora, minuto 5
  const schedule = process.env.BANIMENTOS_WATCHER_SCHEDULE || '5 * * * *';
  cron.schedule(schedule, async () => {
    try {
      const result = await processExpiredBans();
      if (result.processed > 0) {
        log.info({ processed: result.processed }, 'Banimentos expirados revogados');
      }
    } catch (err) {
      log.error({ err }, 'Erro ao processar banimentos expirados');
    }
  });
  log.info({ schedule }, '⏱️ Banimentos watcher agendado');
}

export function getBanimentosWatcherMetrics() {
  return {
    totalProcessed: metrics.totalProcessed,
    processedLastRun: metrics.processedLastRun,
    lastRunAt: metrics.lastRunAt ? metrics.lastRunAt.toISOString() : null,
  };
}
