import * as Brevo from "@getbrevo/brevo";
import { BrevoClient } from "../client/brevo-client";
import { SMSData, ServiceResponse, IBrevoConfig } from "../types/interfaces";
import { prisma } from "../../../config/prisma";

/**
 * Serviço de SMS simplificado e robusto
 * Implementa envio de SMS com validação e logging
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1
 */
export class SMSService {
  private client: BrevoClient;
  private config: IBrevoConfig;

  constructor() {
    this.client = BrevoClient.getInstance();
    this.config = this.client.getConfig();
  }

  /**
   * Envia SMS com retry automático
   */
  public async sendSMS(
    smsData: SMSData,
    userId?: string
  ): Promise<ServiceResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(
          `📱 SMS tentativa ${attempt}/${this.config.maxRetries} - ${smsData.to}`
        );

        const result = await this.performSMSSend(smsData);

        // Log de sucesso
        await this.logSMSSend({
          usuarioId: userId,
          phone: smsData.to,
          status: "ENVIADO",
          attempts: attempt,
          messageId: result.messageId,
        });

        console.log(`✅ SMS enviado com sucesso (tentativa ${attempt})`);
        return result;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Erro desconhecido");
        console.warn(`⚠️ SMS tentativa ${attempt} falhou:`, lastError.message);

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    // Log de falha final
    await this.logSMSSend({
      usuarioId: userId,
      phone: smsData.to,
      status: "FALHA",
      attempts: this.config.maxRetries,
      error: lastError?.message,
    });

    return {
      success: false,
      error: `SMS falhou após ${this.config.maxRetries} tentativas: ${lastError?.message}`,
    };
  }

  /**
   * Realiza envio único do SMS
   */
  private async performSMSSend(smsData: SMSData): Promise<ServiceResponse> {
    this.validateSMSData(smsData);

    const formattedPhone = this.formatBrazilianPhone(smsData.to);
    if (!formattedPhone) {
      throw new Error("Número de telefone inválido");
    }

    const sendTransacSms = new Brevo.SendTransacSms();
    sendTransacSms.recipient = formattedPhone;
    sendTransacSms.content = smsData.message;
    sendTransacSms.sender = smsData.sender || "AdvanceMais";

    const smsAPI = this.client.getSMSAPI();
    const response = await smsAPI.sendTransacSms(sendTransacSms);
    const messageId = this.extractMessageId(response);

    return {
      success: true,
      messageId,
      data: response,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Envia SMS de verificação com código
   */
  public async sendVerificationSMS(
    phoneNumber: string,
    code: string,
    userId?: string
  ): Promise<ServiceResponse> {
    const message = `Seu código de verificação AdvanceMais é: ${code}\n\nVálido por 10 minutos.\n\nNão compartilhe este código.`;

    return this.sendSMS(
      {
        to: phoneNumber,
        message,
        sender: "AdvanceMais",
        type: "transactional",
      },
      userId
    );
  }

  /**
   * Valida dados do SMS
   */
  private validateSMSData(smsData: SMSData): void {
    if (!smsData.to?.trim()) {
      throw new Error("Número de telefone é obrigatório");
    }

    if (!smsData.message?.trim()) {
      throw new Error("Mensagem do SMS é obrigatória");
    }

    if (smsData.message.length > 160) {
      console.warn(
        `⚠️ SMS com ${smsData.message.length} caracteres (recomendado: 160)`
      );
    }
  }

  /**
   * Formata telefone brasileiro para padrão internacional
   */
  private formatBrazilianPhone(phone: string): string | null {
    const cleanNumber = phone.replace(/\D/g, "");

    // Já internacional
    if (cleanNumber.startsWith("55") && cleanNumber.length === 13) {
      return `+${cleanNumber}`;
    }

    // Formato brasileiro 11 dígitos
    if (cleanNumber.length === 11) {
      return `+55${cleanNumber}`;
    }

    // Formato brasileiro 10 dígitos (adiciona 9)
    if (cleanNumber.length === 10) {
      const areaCode = cleanNumber.substring(0, 2);
      const number = cleanNumber.substring(2);
      return `+55${areaCode}9${number}`;
    }

    return null;
  }

  /**
   * Extrai messageId da resposta
   */
  private extractMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    return `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Registra log de SMS
   */
  private async logSMSSend(logData: {
    usuarioId?: string;
    phone: string;
    status: string;
    attempts: number;
    messageId?: string;
    error?: string;
  }): Promise<void> {
    try {
      await prisma.logSMS.create({
        data: {
          usuarioId: logData.usuarioId,
          telefone: logData.phone,
          tipoSMS: "VERIFICACAO",
          status: logData.status as any,
          tentativas: logData.attempts,
          messageId: logData.messageId,
          erro: logData.error,
        },
      });
    } catch (error) {
      console.warn("⚠️ Erro ao registrar log SMS:", error);
    }
  }

  /**
   * Verifica conectividade
   */
  public async checkConnectivity(): Promise<boolean> {
    return await this.client.checkHealth();
  }

  /**
   * Obtém estatísticas
   */
  public async getStatistics(): Promise<any> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = await prisma.logSMS.groupBy({
        by: ["status"],
        where: { criadoEm: { gte: thirtyDaysAgo } },
        _count: { id: true },
      });

      return {
        period: "últimos 30 dias",
        statistics: stats,
        total: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      };
    } catch (error) {
      console.error("❌ Erro ao obter estatísticas SMS:", error);
      return null;
    }
  }

  /**
   * Gera código de verificação
   */
  public static generateVerificationCode(digits: number = 6): string {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Implementa delay assíncrono
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
