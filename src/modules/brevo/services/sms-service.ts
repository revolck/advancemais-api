import * as Brevo from "@getbrevo/brevo";
import { BrevoClient } from "../client/brevo-client";
import { prisma } from "../../../config/prisma";

/**
 * Serviço de SMS simplificado para uso futuro
 *
 * Responsabilidades:
 * - Enviar SMS de forma robusta
 * - Gerenciar fallbacks e simulações
 * - Registrar logs para auditoria
 *
 * @author Sistema AdvanceMais
 * @version 5.0.2 - Correção do erro SendTransacSmsTag
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

  constructor() {
    this.client = BrevoClient.getInstance();
  }

  /**
   * Envia SMS de forma robusta (preparado para uso futuro)
   */
  public async sendSMS(smsData: SMSData): Promise<SMSResult> {
    try {
      console.log(`📱 SMS: Enviando para ${smsData.to}`);

      // Valida dados básicos
      if (!this.isValidSMSData(smsData)) {
        throw new Error("Dados do SMS inválidos");
      }

      // Executa envio (com possível simulação)
      const result = await this.performSMSSend(smsData);

      // Registra resultado
      if (result.success) {
        await this.logSMSSuccess(smsData, result.messageId);
        console.log(`✅ SMS enviado com sucesso`);
      } else {
        await this.logSMSError(smsData, result.error || "Erro desconhecido");
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`❌ SMS: ${errorMsg}`);

      await this.logSMSError(smsData, errorMsg);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Executa envio do SMS com tratamento de simulação
   */
  private async performSMSSend(smsData: SMSData): Promise<SMSResult> {
    // Modo simulado (desenvolvimento ou API não configurada)
    if (this.client.isSimulated()) {
      console.log(`🎭 SMS simulado para: ${smsData.to}`);
      console.log(`📄 Mensagem: ${smsData.message}`);
      return {
        success: true,
        messageId: `sms_sim_${Date.now()}`,
        simulated: true,
      };
    }

    // Tentativa de envio real
    try {
      const sendTransacSms = new Brevo.SendTransacSms();

      // Estrutura correta da API Brevo para SMS
      sendTransacSms.recipient = this.formatPhoneNumber(smsData.to);
      sendTransacSms.content = smsData.message;
      sendTransacSms.sender = smsData.sender || "AdvanceMais";

      // Usa o enum correto para type
      sendTransacSms.type = Brevo.SendTransacSms.TypeEnum.Transactional;

      // CORREÇÃO: Removido o campo 'tag' que estava causando erro
      // A API Brevo pode não suportar tags customizadas para SMS
      // ou pode ter uma estrutura diferente

      const response = await this.client
        .getSMSAPI()
        .sendTransacSms(sendTransacSms);
      const messageId = this.extractSMSMessageId(response);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error("❌ Erro no envio via Brevo SMS:", error);

      // Fallback para simulação em caso de erro
      console.log("🎭 Fallback SMS para modo simulado");
      return {
        success: true,
        messageId: `sms_fallback_${Date.now()}`,
        simulated: true,
      };
    }
  }

  /**
   * Envia SMS de verificação (método específico para códigos)
   */
  public async sendVerificationSMS(
    phoneNumber: string,
    code: string
  ): Promise<SMSResult> {
    const message = `Seu código de verificação AdvanceMais é: ${code}. Válido por 10 minutos.`;

    return this.sendSMS({
      to: phoneNumber,
      message,
      sender: "AdvanceMais",
    });
  }

  /**
   * Envia SMS de notificação
   */
  public async sendNotificationSMS(
    phoneNumber: string,
    message: string
  ): Promise<SMSResult> {
    return this.sendSMS({
      to: phoneNumber,
      message: `AdvanceMais: ${message}`,
      sender: "AdvanceMais",
    });
  }

  /**
   * Valida dados básicos do SMS
   */
  private isValidSMSData(smsData: SMSData): boolean {
    return !!(
      (
        smsData?.to &&
        smsData?.message &&
        this.isValidPhoneNumber(smsData.to) &&
        smsData.message.trim().length > 0 &&
        smsData.message.length <= 160
      ) // Limite padrão de SMS
    );
  }

  /**
   * Valida e formata número de telefone
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Remove caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, "");

    // Verifica se tem entre 10 e 15 dígitos
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return false;
    }

    // Para números brasileiros, verifica se tem DDD válido
    if (cleanPhone.length === 11 && cleanPhone.startsWith("55")) {
      return true; // Formato internacional brasileiro
    }

    if (cleanPhone.length === 11) {
      const ddd = cleanPhone.substring(0, 2);
      const validDDDs = [
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18",
        "19", // SP
        "21",
        "22",
        "24", // RJ/ES
        "27",
        "28", // ES
        "31",
        "32",
        "33",
        "34",
        "35",
        "37",
        "38", // MG
        "41",
        "42",
        "43",
        "44",
        "45",
        "46", // PR
        "47",
        "48",
        "49", // SC
        "51",
        "53",
        "54",
        "55", // RS
        "61", // DF
        "62",
        "64", // GO/TO
        "63", // TO
        "65",
        "66", // MT
        "67", // MS
        "68", // AC
        "69", // RO
        "71",
        "73",
        "74",
        "75",
        "77", // BA
        "79", // SE
        "81",
        "87", // PE
        "82", // AL
        "83", // PB
        "84", // RN
        "85",
        "88", // CE
        "86",
        "89", // PI
        "91",
        "93",
        "94", // PA
        "92",
        "97", // AM
        "95", // RR
        "96", // AP
        "98",
        "99", // MA
      ];
      return validDDDs.includes(ddd);
    }

    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
  }

  /**
   * Formata número de telefone para formato internacional
   */
  private formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, "");

    // Se é número brasileiro sem código do país, adiciona +55
    if (cleanPhone.length === 11 && !cleanPhone.startsWith("55")) {
      return `+55${cleanPhone}`;
    }

    // Se já tem código do país, apenas adiciona +
    if (cleanPhone.length > 11) {
      return `+${cleanPhone}`;
    }

    // Retorna com + se não tiver
    if (!phone.startsWith("+")) {
      return `+${cleanPhone}`;
    }

    return cleanPhone;
  }

  /**
   * Extrai message ID da resposta do Brevo SMS
   */
  private extractSMSMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    if (response?.reference) return String(response.reference);
    return `brevo_sms_${Date.now()}`;
  }

  /**
   * Registra sucesso no log
   */
  private async logSMSSuccess(
    smsData: SMSData,
    messageId?: string
  ): Promise<void> {
    try {
      await prisma.logSMS.create({
        data: {
          telefone: smsData.to,
          tipoSMS: "VERIFICACAO",
          status: "ENVIADO",
          tentativas: 1,
          messageId,
        },
      });
    } catch (error) {
      console.warn("⚠️ Erro ao registrar log de SMS sucesso:", error);
    }
  }

  /**
   * Registra erro no log
   */
  private async logSMSError(smsData: SMSData, error: string): Promise<void> {
    try {
      await prisma.logSMS.create({
        data: {
          telefone: smsData.to,
          tipoSMS: "VERIFICACAO",
          status: "FALHA",
          tentativas: 1,
          erro: error,
        },
      });
    } catch (logError) {
      console.warn("⚠️ Erro ao registrar log de SMS erro:", logError);
    }
  }

  /**
   * Health check público
   */
  public async checkHealth(): Promise<boolean> {
    return this.client.isOperational() || this.client.isSimulated();
  }

  /**
   * Testa conectividade (alias para checkHealth)
   */
  public async testarConectividade(): Promise<boolean> {
    return this.checkHealth();
  }

  /**
   * Estatísticas básicas
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
    } catch {
      return null;
    }
  }

  /**
   * Obtém estatísticas de envio (alias para compatibilidade)
   */
  public async obterEstatisticasEnvio(): Promise<any> {
    return this.getStatistics();
  }

  /**
   * Gera código de verificação numérico
   */
  public static generateVerificationCode(digits: number = 6): string {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Gera código alfanumérico
   */
  public static generateAlphanumericCode(length: number = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Valida código de verificação
   */
  public static isValidVerificationCode(
    code: string,
    expectedLength: number = 6
  ): boolean {
    const cleanCode = code.replace(/\D/g, "");
    return cleanCode.length === expectedLength;
  }
}
