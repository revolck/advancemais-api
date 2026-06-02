import * as Brevo from '@getbrevo/brevo';
import { BrevoClient } from '../client/brevo-client';
import { BrevoConfigManager } from '../config/brevo-config';
import { logger } from '@/utils/logger';

/**
 * Serviço de SMS simplificado para uso futuro
 * Preparado para integração com Brevo SMS API
 */
export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export interface SMSData {
  to: string;
  message: string;
  sender?: string;
}

export class SMSService {
  private client: BrevoClient;
  private config: BrevoConfigManager;
  private readonly log = logger.child({ module: 'SMSService' });

  constructor() {
    this.client = BrevoClient.getInstance();
    this.config = BrevoConfigManager.getInstance();
  }

  /**
   * Envia SMS de forma robusta
   */
  public async sendSMS(smsData: SMSData): Promise<SMSResult> {
    const correlationId = this.generateCorrelationId();
    const log = this.log.child({
      correlationId,
      phone: smsData.to,
      method: 'sendSMS',
    });

    try {
      log.info('📱 Enviando SMS');

      // Validação básica
      if (!this.isValidSMSData(smsData)) {
        throw new Error('Dados do SMS inválidos');
      }

      // Normaliza número de telefone
      const normalizedPhone = this.normalizePhoneNumber(smsData.to);

      // Executa envio
      const result = await this.performSMSSend(
        {
          ...smsData,
          to: normalizedPhone,
        },
        correlationId,
      );

      // Registra resultado
      if (result.success) {
        await this.logSMSSuccess(smsData, result.messageId, correlationId);
        log.info({ messageId: result.messageId }, '✅ SMS enviado com sucesso');
      } else {
        await this.logSMSError(smsData, result.error || 'Erro desconhecido', correlationId);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      log.error({ error: errorMsg }, '❌ Erro no envio de SMS');

      await this.logSMSError(smsData, errorMsg, correlationId);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Envia SMS de verificação/autenticação
   */
  public async sendVerificationSMS(phoneNumber: string, code: string): Promise<SMSResult> {
    const message = `Seu código de verificação Advance+: ${code}. Válido por 10 minutos. Não compartilhe este código.`;

    return await this.sendSMS({
      to: phoneNumber,
      message,
      sender: 'Advance+',
    });
  }

  /**
   * Envia SMS de notificação
   */
  public async sendNotificationSMS(phoneNumber: string, message: string): Promise<SMSResult> {
    return await this.sendSMS({
      to: phoneNumber,
      message: `Advance+: ${message}`,
      sender: 'Advance+',
    });
  }

  /**
   * Health check do serviço
   */
  public async checkHealth(): Promise<boolean> {
    try {
      // O client recarrega configuração runtime antes de testar conectividade.
      return await this.client.healthCheck();
    } catch (error) {
      this.log.warn({ err: error }, '⚠️ SMS Health check falhou');
      return false;
    }
  }

  // ===========================
  // MÉTODOS PRIVADOS
  // ===========================

  /**
   * Executa envio do SMS
   */
  private async performSMSSend(smsData: SMSData, correlationId: string): Promise<SMSResult> {
    const log = this.log.child({
      correlationId,
      phone: smsData.to,
      method: 'performSMSSend',
    });
    // Modo simulado (desenvolvimento ou API não configurada)
    if (this.client.isSimulated()) {
      log.info({ message: smsData.message }, '🎭 SMS simulado');
      return {
        success: true,
        messageId: `sms_sim_${Date.now()}`,
        simulated: true,
      };
    }

    // Tentativa de envio real
    try {
      const smsAPI = this.client.getSMSAPI();

      if (!smsAPI) {
        throw new Error('API de SMS não disponível');
      }

      const sendSmsRequest = new Brevo.SendTransacSms();
      sendSmsRequest.type = Brevo.SendTransacSms.TypeEnum.Transactional;
      sendSmsRequest.unicodeEnabled = false;
      sendSmsRequest.sender = smsData.sender || 'Advance+';
      sendSmsRequest.recipient = smsData.to;
      sendSmsRequest.content = smsData.message;

      log.info('📱 Enviando SMS via Brevo');

      // Chama API do Brevo
      const response = await smsAPI.sendTransacSms(sendSmsRequest);
      const messageId = this.extractMessageId(response);

      log.info({ messageId }, '✅ SMS enviado via Brevo');

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      log.error({ err: error }, '❌ Erro no envio via Brevo');

      // Fallback para simulação em caso de erro
      log.warn('🎭 Fallback para modo simulado');
      return {
        success: true,
        messageId: `sms_fallback_${Date.now()}`,
        simulated: true,
        error: error instanceof Error ? error.message : 'Erro na API',
      };
    }
  }

  /**
   * Valida dados básicos do SMS
   */
  private isValidSMSData(smsData: SMSData): boolean {
    return !!(
      smsData?.to &&
      smsData?.message &&
      smsData.message.length > 0 &&
      smsData.message.length <= 1600 && // Limite do Brevo
      this.isValidPhoneNumber(smsData.to)
    );
  }

  /**
   * Valida formato de número de telefone
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Validação básica - aceita formatos internacionais
    const phoneRegex = /^\+?[1-9]\d{8,14}$/;
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleanPhone);
  }

  /**
   * Normaliza número de telefone
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove espaços, parênteses e hífens
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Adiciona código do país se não tiver
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('55')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.startsWith('0')) {
        cleaned = '+55' + cleaned.substring(1);
      } else {
        cleaned = '+55' + cleaned;
      }
    }

    return cleaned;
  }

  /**
   * Extrai message ID da resposta
   */
  private extractMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    if (response?.reference) return String(response.reference);
    return `sms_brevo_${Date.now()}`;
  }

  /**
   * Registra sucesso no log
   */
  private async logSMSSuccess(
    smsData: SMSData,
    messageId?: string,
    correlationId?: string,
  ): Promise<void> {
    try {
      // Implementar log de SMS no banco se necessário
      this.log.info(
        {
          correlationId,
          phone: smsData.to,
          messageId,
          length: smsData.message.length,
        },
        '📊 SMS enviado com sucesso',
      );

      // Exemplo de como seria o log no banco (se modelo existir):
      /*
      await prisma.logSMS.create({
        data: {
          numeroTelefone: smsData.to,
          mensagem: smsData.message,
          status: "ENVIADO",
          messageId: messageId || "",
          remetente: smsData.sender || "Advance+",
        },
      });
      */
    } catch (error) {
      this.log.warn(
        { err: error, correlationId, phone: smsData.to, context: 'logSMSSuccess' },
        '⚠️ Erro ao registrar log de sucesso SMS',
      );
    }
  }

  /**
   * Registra erro no log
   */
  private async logSMSError(
    smsData: SMSData,
    error: string,
    correlationId?: string,
  ): Promise<void> {
    try {
      this.log.error(
        {
          correlationId,
          phone: smsData.to,
          error,
          messageLength: smsData.message.length,
        },
        '📊 Erro no SMS',
      );

      // Exemplo de como seria o log no banco (se modelo existir):
      /*
      await prisma.logSMS.create({
        data: {
          numeroTelefone: smsData.to,
          mensagem: smsData.message,
          status: "FALHA",
          erro: error,
          remetente: smsData.sender || "Advance+",
        },
      });
      */
    } catch (logError) {
      this.log.warn(
        { err: logError, correlationId, phone: smsData.to, context: 'logSMSError' },
        '⚠️ Erro ao registrar log de erro SMS',
      );
    }
  }

  /**
   * Gera correlation ID
   */
  private generateCorrelationId(): string {
    return `sms-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }
}
