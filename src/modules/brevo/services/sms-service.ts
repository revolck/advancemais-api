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
 * NOTA: Configurado para uso futuro quando SMS for necessário
 */
export class SMSService {
  private transactionalSMSApi: Brevo.TransactionalSMSApi;

  constructor() {
    const brevoClient = BrevoClient.getInstance();
    this.transactionalSMSApi = brevoClient.getTransactionalSMSApi();
  }

  /**
   * Envia SMS transacional
   * @param smsData - Dados do SMS a ser enviado
   * @param usuarioId - ID do usuário (opcional para log)
   * @returns Promise<SMSResponse> Resultado do envio
   */
  public async enviarSMS(
    smsData: SMSData,
    usuarioId?: string
  ): Promise<SMSResponse> {
    try {
      // Prepara os dados do SMS
      const sendTransacSms = new Brevo.SendTransacSms();
      sendTransacSms.recipient = smsData.to;
      sendTransacSms.content = smsData.message;
      sendTransacSms.sender = smsData.sender || "AdvanceMais";

      // Envia o SMS
      const response = await this.transactionalSMSApi.sendTransacSms(
        sendTransacSms
      );

      // Extrai messageId da resposta - estrutura correta do Brevo
      let messageId = "unknown";

      if (response && typeof response === "object") {
        // Tenta extrair o messageId de diferentes possíveis estruturas
        if ((response as any).messageId) {
          messageId = String((response as any).messageId);
        } else if ((response as any).body && (response as any).body.messageId) {
          messageId = String((response as any).body.messageId);
        } else if ((response as any).data && (response as any).data.messageId) {
          messageId = String((response as any).data.messageId);
        }
      }

      // Log de sucesso
      await this.logSMS({
        usuarioId,
        telefone: smsData.to,
        tipoSMS: "NOTIFICACAO",
        status: "ENVIADO",
        tentativas: 1,
        messageId,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error("Erro ao enviar SMS:", error);

      // Log de erro
      await this.logSMS({
        usuarioId,
        telefone: smsData.to,
        tipoSMS: "NOTIFICACAO",
        status: "FALHA",
        tentativas: 1,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia SMS de verificação
   * @param telefone - Número do telefone
   * @param codigo - Código de verificação
   * @param usuarioId - ID do usuário
   * @returns Promise<SMSResponse> Resultado do envio
   */
  public async enviarSMSVerificacao(
    telefone: string,
    codigo: string,
    usuarioId?: string
  ): Promise<SMSResponse> {
    const message = `Seu código de verificação AdvanceMais é: ${codigo}. Válido por 10 minutos.`;

    return await this.enviarSMS(
      {
        to: telefone,
        message,
      },
      usuarioId
    );
  }

  /**
   * Registra log de SMS no banco de dados
   * @param logData - Dados do log
   */
  private async logSMS(logData: {
    usuarioId?: string;
    telefone: string;
    tipoSMS: string;
    status: string;
    tentativas: number;
    erro?: string;
    messageId?: string;
  }): Promise<void> {
    try {
      await prisma.logSMS.create({
        data: {
          usuarioId: logData.usuarioId,
          telefone: logData.telefone,
          tipoSMS: logData.tipoSMS as any,
          status: logData.status as any,
          tentativas: logData.tentativas,
          erro: logData.erro,
          messageId: logData.messageId,
        },
      });
    } catch (error) {
      console.error("Erro ao registrar log de SMS:", error);
      // Não falha o processo principal se não conseguir fazer o log
    }
  }
}
