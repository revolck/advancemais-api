import cron from 'node-cron';
import { mercadopagoConfig } from '@/config/env';
import { assertMercadoPagoConfigured, mpClient } from '@/config/mercadopago';
import { prisma } from '@/config/prisma';
import { METODO_PAGAMENTO, STATUS_PAGAMENTO } from '@prisma/client';
import { logger } from '@/utils/logger';
import { Payment } from 'mercadopago';
import { assinaturasService } from '../services/assinaturas.service';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';

const log = logger.child({ module: 'AssinaturasBoletoWatcher' });

async function processPendingBoletos() {
  if (!mpClient) {
    throw new Error('Mercado Pago não configurado para monitorar boletos');
  }

  // Verificar conexão ANTES de tentar executar qualquer query
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    log.debug('Banco de dados não disponível, pulando processamento de boletos');
    return;
  }

  try {
    const maxDays = mercadopagoConfig.settings.boletoWatcherMaxDays || 5;
    const cutoff = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);

    const boletos = await prisma.empresasPlano.findMany({
      where: {
        metodoPagamento: METODO_PAGAMENTO.BOLETO,
        statusPagamento: { in: [STATUS_PAGAMENTO.PENDENTE, STATUS_PAGAMENTO.EM_PROCESSAMENTO] },
        mpPaymentId: { not: null },
        criadoEm: { gte: cutoff },
      },
    });

    if (!boletos.length) {
      log.debug('Nenhum boleto pendente para monitorar');
      return;
    }

    const paymentApi = new Payment(mpClient);
    for (const boleto of boletos) {
      if (!boleto.mpPaymentId) continue;
      try {
        const payment = (await paymentApi.get({ id: boleto.mpPaymentId })) as { body?: any };
        const body = payment.body ?? payment;
        await assinaturasService.updatePaymentStatusFromNotification({
          externalRef: boleto.id,
          status: body?.status,
          mpPaymentId: boleto.mpPaymentId,
          data: body,
        });

        const currentStatus = body?.status ? mapStatus(body.status) : boleto.statusPagamento;
        const stillPending =
          currentStatus === STATUS_PAGAMENTO.PENDENTE ||
          currentStatus === STATUS_PAGAMENTO.EM_PROCESSAMENTO;

        if (stillPending) {
          const createdAt = boleto.criadoEm || new Date();
          const now = new Date();
          const diff = now.getTime() - createdAt.getTime();
          const maxMs = maxDays * 24 * 60 * 60 * 1000;
          if (diff > maxMs) {
            await assinaturasService.updatePaymentStatusFromNotification({
              externalRef: boleto.id,
              status: 'cancelled',
              mpPaymentId: boleto.mpPaymentId,
              data: { timeout: true, monitoredDays: maxDays },
            });
            await assinaturasService.logEvent({
              usuarioId: boleto.usuarioId,
              empresasPlanoId: boleto.id,
              tipo: 'BOLETO_TIMEOUT_CANCEL',
              status: STATUS_PAGAMENTO.CANCELADO,
              externalRef: boleto.id,
              mpResourceId: boleto.mpPaymentId,
              mensagem: 'Boleto expirado após monitoramento de 5 dias',
            });
          }
        }
      } catch (err) {
        log.warn(
          { err, mpPaymentId: boleto.mpPaymentId, planoId: boleto.id },
          '⚠️ Falha ao consultar boleto no Mercado Pago',
        );
      }
    }
  } catch (error) {
    // Tratar erros de conexão
    if (handlePrismaConnectionError(error, log, 'processPendingBoletos')) {
      return; // Retornar silenciosamente em caso de erro de conexão
    }
    // Re-lançar outros erros
    throw error;
  }
}

function mapStatus(status: string): STATUS_PAGAMENTO {
  const normalized = status.toLowerCase();
  if (['approved', 'accredited'].includes(normalized)) return STATUS_PAGAMENTO.APROVADO;
  if (['pending', 'in_process'].includes(normalized)) return STATUS_PAGAMENTO.EM_PROCESSAMENTO;
  if (
    ['cancelled', 'cancelled_by_user', 'cancelled_by_collector', 'expired'].includes(normalized)
  ) {
    return STATUS_PAGAMENTO.CANCELADO;
  }
  if (['rejected', 'charged_back', 'chargeback'].includes(normalized))
    return STATUS_PAGAMENTO.RECUSADO;
  return STATUS_PAGAMENTO.PENDENTE;
}

export function startBoletoWatcherJob() {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    log.debug('Test environment detectado, pulando watcher de boletos');
    return;
  }

  if (!mercadopagoConfig.settings.boletoWatcherEnabled) {
    log.info('⏱️ Monitoramento de boletos desabilitado');
    return;
  }

  try {
    assertMercadoPagoConfigured();
  } catch (err) {
    log.warn({ err }, '⚠️ Mercado Pago não configurado, monitoramento de boletos não iniciado');
    return;
  }

  const schedule = mercadopagoConfig.settings.boletoWatcherSchedule || '0 * * * *';
  cron.schedule(schedule, async () => {
    try {
      await processPendingBoletos();
    } catch (err) {
      // Tratar erros de conexão como warning, outros erros como error
      if (handlePrismaConnectionError(err, log, 'boleto-watcher')) {
        return; // Erro de conexão tratado, não precisa logar como error
      }

      log.error({ err }, '❌ Erro ao processar monitoramento de boletos');
    }
  });
  log.info({ schedule }, '⏱️ Monitoramento de boletos agendado');
}

export { processPendingBoletos };
