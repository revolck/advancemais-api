import * as Brevo from "@getbrevo/brevo";
import { BrevoClient } from "../client/brevo-client";
import { prisma } from "../../../config/prisma";

/**
 * Interface para dados de SMS
 */
interface SMSData {
  to: string;
  message: string;
  sender?: string;
}

/**
 * Interface para resposta de envio de SMS
 */
interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Serviço para envio de SMS via Brevo
 * Versão simplificada e funcional
 */
export class SMSService {
  private transactionalSMSApi: Brevo.TransactionalSMSApi;
  private defaultSender: string;

  constructor() {
    const brevoClient = BrevoClient.getInstance();
    this.transactionalSMSApi = brevoClient.getTransactionalSMSApi();
    this.defaultSender = "AdvanceMais";
  }

  /**
   * Envia SMS simples
   */
  public async enviarSMS(
    smsData: SMSData,
    usuarioId?: string
  ): Promise<SMSResponse> {
    try {
      console.log(`📤 Enviando SMS para: ${smsData.to}`);

      // Valida dados básicos
      if (!this.validarSMS(smsData)) {
        return {
          success: false,
          error: "Dados de SMS inválidos",
        };
      }

      // Formata telefone brasileiro
      const telefoneFormatado = this.formatarTelefone(smsData.to);
      if (!telefoneFormatado) {
        return {
          success: false,
          error: "Número de telefone inválido",
        };
      }

      // Prepara SMS para Brevo
      const sendTransacSms = new Brevo.SendTransacSms();
      sendTransacSms.recipient = telefoneFormatado;
      sendTransacSms.content = smsData.message;
      sendTransacSms.sender = smsData.sender || this.defaultSender;

      // Envia o SMS
      const response = await this.transactionalSMSApi.sendTransacSms(
        sendTransacSms
      );
      const messageId = this.extrairMessageId(response);

      // Log de sucesso
      await this.logarEnvio(usuarioId, telefoneFormatado, "ENVIADO", messageId);

      console.log(`✅ SMS enviado com sucesso - MessageID: ${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error("❌ Erro ao enviar SMS:", error);

      // Log de erro
      await this.logarEnvio(
        usuarioId,
        smsData.to,
        "FALHA",
        undefined,
        error instanceof Error ? error.message : "Erro desconhecido"
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia SMS de verificação com código
   */
  public async enviarSMSVerificacao(dados: {
    telefone: string;
    codigo: string;
    usuarioId?: string;
  }): Promise<SMSResponse> {
    const mensagem = `Seu código de verificação AdvanceMais é: ${dados.codigo}\n\nVálido por 10 minutos.\n\nNão compartilhe este código.`;

    return this.enviarSMS(
      {
        to: dados.telefone,
        message: mensagem,
        sender: this.defaultSender,
      },
      dados.usuarioId
    );
  }

  /**
   * Valida dados do SMS
   */
  private validarSMS(smsData: SMSData): boolean {
    if (!smsData.to || !smsData.message) {
      return false;
    }

    if (smsData.message.length > 160) {
      console.warn(
        `⚠️ SMS com ${smsData.message.length} caracteres (máximo recomendado: 160)`
      );
    }

    return true;
  }

  /**
   * Formata telefone brasileiro para padrão internacional
   */
  private formatarTelefone(telefone: string): string | null {
    const numeroLimpo = telefone.replace(/\D/g, "");

    // Já internacional
    if (numeroLimpo.startsWith("55") && numeroLimpo.length === 13) {
      return `+${numeroLimpo}`;
    }

    // Formato brasileiro 11 dígitos
    if (numeroLimpo.length === 11) {
      return `+55${numeroLimpo}`;
    }

    // Formato brasileiro 10 dígitos (adiciona 9)
    if (numeroLimpo.length === 10) {
      const ddd = numeroLimpo.substring(0, 2);
      const numero = numeroLimpo.substring(2);
      return `+55${ddd}9${numero}`;
    }

    return null;
  }

  /**
   * Extrai messageId da resposta
   */
  private extrairMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    return `sms_${Date.now()}`;
  }

  /**
   * Registra log de SMS no banco
   */
  private async logarEnvio(
    usuarioId?: string,
    telefone?: string,
    status?: string,
    messageId?: string,
    erro?: string
  ): Promise<void> {
    try {
      await prisma.logSMS.create({
        data: {
          usuarioId,
          telefone: telefone || "unknown",
          tipoSMS: "VERIFICACAO",
          status: status as any,
          tentativas: 1,
          messageId,
          erro,
        },
      });
    } catch (error) {
      console.error("⚠️ Erro ao registrar log SMS:", error);
    }
  }

  /**
   * Testa conectividade
   */
  public async testarConectividade(): Promise<boolean> {
    try {
      const client = BrevoClient.getInstance();
      return await client.isConfigured();
    } catch {
      return false;
    }
  }

  /**
   * Obtém estatísticas simples
   */
  public async obterEstatisticasEnvio() {
    try {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);

      const stats = await prisma.logSMS.groupBy({
        by: ["status"],
        where: { criadoEm: { gte: dataInicio } },
        _count: { id: true },
      });

      return {
        periodo: "últimos 30 dias",
        estatisticas: stats,
        total: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      };
    } catch {
      return null;
    }
  }

  /**
   * Gera código de verificação
   */
  public static gerarCodigoVerificacao(digitos: number = 6): string {
    const min = Math.pow(10, digitos - 1);
    const max = Math.pow(10, digitos) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }
}
