import cron from 'node-cron';
import { mercadopagoConfig } from '@/config/env';
import { assertMercadoPagoConfigured, mpClient } from '@/config/mercadopago';
import { prisma } from '@/config/prisma';
import { METODO_PAGAMENTO, STATUS_PAGAMENTO } from '@prisma/client';
import { logger } from '@/utils/logger';
import { Payment } from 'mercadopago';
import { assinaturasService } from '../services/assinaturas.service';

const log = logger.child({ module: 'AssinaturasBoletoWatcher' });

async function processPendingBoletos() {
  if (!mpClient) {
    throw new Error('Mercado Pago não configurado para monitorar boletos');
  }

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
      log.error({ err }, '❌ Erro ao processar monitoramento de boletos');
    }
  });
  log.info({ schedule }, '⏱️ Monitoramento de boletos agendado');
}

export { processPendingBoletos };
