import { WebhookNotification, ServiceResponse } from "../types/order";
import { MercadoPagoClient } from "../client/mercadopago-client";
import {
  WebhookType,
  WebhookAction,
  PaymentStatus,
  OrderStatus,
  ClientType,
} from "../enums";
import { prisma } from "../../../config/prisma";
import { EmailService } from "../../brevo/services/email-service";

/**
 * Serviço para gerenciar Webhooks/Notificações do MercadoPago
 * Processa notificações de mudanças de status de pagamentos, orders e assinaturas
 */
export class WebhookService {
  private client: MercadoPagoClient;
  private emailService: EmailService;

  constructor() {
    this.client = MercadoPagoClient.getInstance(ClientType.SUBSCRIPTIONS);
    this.emailService = new EmailService();
  }

  /**
   * Processa uma notificação webhook do MercadoPago
   * @param webhookData Dados da notificação recebida
   * @returns Promise<ServiceResponse<any>>
   */
  public async processWebhook(
    webhookData: WebhookNotification
  ): Promise<ServiceResponse<any>> {
    try {
      // Valida a estrutura básica do webhook
      if (!this.isValidWebhook(webhookData)) {
        return {
          success: false,
          error: {
            message: "Estrutura de webhook inválida",
            code: "INVALID_WEBHOOK_STRUCTURE",
          },
        };
      }

      // Registra o webhook recebido
      await this.logWebhook(webhookData);

      // Processa baseado no tipo de notificação
      let result: ServiceResponse<any>;

      switch (webhookData.type) {
        case WebhookType.PAYMENT:
          result = await this.processPaymentWebhook(webhookData);
          break;

        case WebhookType.SUBSCRIPTION:
          result = await this.processSubscriptionWebhook(webhookData);
          break;

        default:
          console.log(`Tipo de webhook não processado: ${webhookData.type}`);
          result = {
            success: true,
            data: { message: "Webhook recebido mas não processado" },
          };
      }

      // Atualiza o log com o resultado do processamento
      await this.updateWebhookLog(
        webhookData.id,
        result.success,
        result.error?.message
      );

      return result;
    } catch (error) {
      console.error("Erro ao processar webhook:", error);

      // Atualiza o log com erro
      await this.updateWebhookLog(
        webhookData.id,
        false,
        error instanceof Error ? error.message : "Erro desconhecido"
      );

      return {
        success: false,
        error: {
          message: "Erro interno ao processar webhook",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Processa webhook de pagamento
   * @param webhookData Dados da notificação
   * @returns Promise<ServiceResponse<any>>
   */
  private async processPaymentWebhook(
    webhookData: WebhookNotification
  ): Promise<ServiceResponse<any>> {
    try {
      const paymentId = webhookData.data.id;

      // Busca informações atualizadas do pagamento
      const paymentInfo = await this.getPaymentInfo(paymentId);
      if (!paymentInfo.success || !paymentInfo.data) {
        return {
          success: false,
          error: {
            message: "Não foi possível obter informações do pagamento",
            code: "PAYMENT_INFO_ERROR",
          },
        };
      }

      const payment = paymentInfo.data;

      // Atualiza informações no banco local se existir
      await this.updatePaymentInDatabase(paymentId, {
        status: payment.status,
        statusDetail: payment.status_detail,
        paymentData: payment,
      });

      // Processa ações baseadas no status e ação
      await this.handlePaymentStatusChange(payment, webhookData.action);

      return {
        success: true,
        data: {
          message: "Webhook de pagamento processado com sucesso",
          paymentStatus: payment.status,
        },
      };
    } catch (error) {
      console.error("Erro ao processar webhook de pagamento:", error);
      return {
        success: false,
        error: {
          message: "Erro ao processar webhook de pagamento",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "PAYMENT_WEBHOOK_ERROR",
        },
      };
    }
  }

  /**
   * Processa webhook de assinatura
   * @param webhookData Dados da notificação
   * @returns Promise<ServiceResponse<any>>
   */
  private async processSubscriptionWebhook(
    webhookData: WebhookNotification
  ): Promise<ServiceResponse<any>> {
    try {
      const subscriptionId = webhookData.data.id;

      // Busca informações atualizadas da assinatura
      const subscriptionInfo = await this.getSubscriptionInfo(subscriptionId);
      if (!subscriptionInfo.success || !subscriptionInfo.data) {
        return {
          success: false,
          error: {
            message: "Não foi possível obter informações da assinatura",
            code: "SUBSCRIPTION_INFO_ERROR",
          },
        };
      }

      const subscription = subscriptionInfo.data;

      // Atualiza informações no banco local se existir
      await this.updateSubscriptionInDatabase(subscriptionId, {
        status: subscription.status,
        subscriptionData: subscription,
      });

      // Processa ações baseadas no status e ação
      await this.handleSubscriptionStatusChange(
        subscription,
        webhookData.action
      );

      return {
        success: true,
        data: {
          message: "Webhook de assinatura processado com sucesso",
          subscriptionStatus: subscription.status,
        },
      };
    } catch (error) {
      console.error("Erro ao processar webhook de assinatura:", error);
      return {
        success: false,
        error: {
          message: "Erro ao processar webhook de assinatura",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "SUBSCRIPTION_WEBHOOK_ERROR",
        },
      };
    }
  }

  /**
   * Busca informações de um pagamento no MercadoPago
   * @param paymentId ID do pagamento
   * @returns Promise<ServiceResponse<any>>
   */
  private async getPaymentInfo(
    paymentId: string
  ): Promise<ServiceResponse<any>> {
    try {
      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          method: "GET",
          headers,
        }
      );

      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: responseData,
        };
      } else {
        return {
          success: false,
          error: {
            message: "Erro ao obter informações do pagamento",
            details: responseData,
            code: "MP_GET_PAYMENT_ERROR",
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Erro na requisição de informações do pagamento",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "PAYMENT_REQUEST_ERROR",
        },
      };
    }
  }

  /**
   * Busca informações de uma assinatura no MercadoPago
   * @param subscriptionId ID da assinatura
   * @returns Promise<ServiceResponse<any>>
   */
  private async getSubscriptionInfo(
    subscriptionId: string
  ): Promise<ServiceResponse<any>> {
    try {
      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `https://api.mercadopago.com/preapproval/${subscriptionId}`,
        {
          method: "GET",
          headers,
        }
      );

      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: responseData,
        };
      } else {
        return {
          success: false,
          error: {
            message: "Erro ao obter informações da assinatura",
            details: responseData,
            code: "MP_GET_SUBSCRIPTION_ERROR",
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Erro na requisição de informações da assinatura",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "SUBSCRIPTION_REQUEST_ERROR",
        },
      };
    }
  }

  /**
   * Processa mudanças de status de pagamento
   * @param payment Dados do pagamento
   * @param action Ação do webhook
   */
  private async handlePaymentStatusChange(
    payment: any,
    action: string
  ): Promise<void> {
    try {
      // Busca o usuário associado ao pagamento
      const usuario = await this.findUserByPayment(payment);

      if (!usuario) {
        console.log(`Usuário não encontrado para pagamento ${payment.id}`);
        return;
      }

      // Processa baseado no status do pagamento
      switch (payment.status) {
        case PaymentStatus.APPROVED:
          await this.handleApprovedPayment(payment, usuario);
          break;

        case PaymentStatus.REJECTED:
          await this.handleRejectedPayment(payment, usuario);
          break;

        case PaymentStatus.CANCELLED:
          await this.handleCancelledPayment(payment, usuario);
          break;

        case PaymentStatus.REFUNDED:
          await this.handleRefundedPayment(payment, usuario);
          break;

        case PaymentStatus.CHARGED_BACK:
          await this.handleChargebackPayment(payment, usuario);
          break;

        default:
          console.log(`Status de pagamento não processado: ${payment.status}`);
      }
    } catch (error) {
      console.error("Erro ao processar mudança de status do pagamento:", error);
    }
  }

  /**
   * Processa mudanças de status de assinatura
   * @param subscription Dados da assinatura
   * @param action Ação do webhook
   */
  private async handleSubscriptionStatusChange(
    subscription: any,
    action: string
  ): Promise<void> {
    try {
      // Busca o usuário associado à assinatura
      const usuario = await this.findUserBySubscription(subscription);

      if (!usuario) {
        console.log(
          `Usuário não encontrado para assinatura ${subscription.id}`
        );
        return;
      }

      // Processa baseado no status da assinatura
      switch (subscription.status) {
        case "authorized":
          await this.handleAuthorizedSubscription(subscription, usuario);
          break;

        case "cancelled":
          await this.handleCancelledSubscription(subscription, usuario);
          break;

        case "paused":
          await this.handlePausedSubscription(subscription, usuario);
          break;

        default:
          console.log(
            `Status de assinatura não processado: ${subscription.status}`
          );
      }
    } catch (error) {
      console.error(
        "Erro ao processar mudança de status da assinatura:",
        error
      );
    }
  }

  /**
   * Processa pagamento aprovado
   */
  private async handleApprovedPayment(
    payment: any,
    usuario: any
  ): Promise<void> {
    console.log(
      `Pagamento aprovado: ${payment.id} para usuário ${usuario.email}`
    );

    // Aqui você pode implementar lógicas específicas como:
    // - Ativar recursos premium
    // - Enviar email de confirmação
    // - Atualizar status no sistema
    // - Gerar nota fiscal

    // Exemplo: enviar email de confirmação
    // await this.emailService.enviarEmailConfirmacaoPagamento(usuario, payment);
  }

  /**
   * Processa pagamento rejeitado
   */
  private async handleRejectedPayment(
    payment: any,
    usuario: any
  ): Promise<void> {
    console.log(
      `Pagamento rejeitado: ${payment.id} para usuário ${usuario.email}`
    );

    // Implementar lógicas para pagamento rejeitado:
    // - Notificar usuário
    // - Suspender serviços se necessário
    // - Oferecer alternativas de pagamento
  }

  /**
   * Processa pagamento cancelado
   */
  private async handleCancelledPayment(
    payment: any,
    usuario: any
  ): Promise<void> {
    console.log(
      `Pagamento cancelado: ${payment.id} para usuário ${usuario.email}`
    );

    // Implementar lógicas para pagamento cancelado
  }

  /**
   * Processa pagamento reembolsado
   */
  private async handleRefundedPayment(
    payment: any,
    usuario: any
  ): Promise<void> {
    console.log(
      `Pagamento reembolsado: ${payment.id} para usuário ${usuario.email}`
    );

    // Implementar lógicas para reembolso:
    // - Revogar acesso a serviços
    // - Notificar usuário sobre reembolso
    // - Atualizar registros contábeis
  }

  /**
   * Processa chargeback
   */
  private async handleChargebackPayment(
    payment: any,
    usuario: any
  ): Promise<void> {
    console.log(
      `Chargeback processado: ${payment.id} para usuário ${usuario.email}`
    );

    // Implementar lógicas para chargeback:
    // - Suspender conta se necessário
    // - Notificar equipe de fraude
    // - Documentar para análise
  }

  /**
   * Processa assinatura autorizada
   */
  private async handleAuthorizedSubscription(
    subscription: any,
    usuario: any
  ): Promise<void> {
    console.log(
      `Assinatura autorizada: ${subscription.id} para usuário ${usuario.email}`
    );

    // Implementar lógicas para assinatura ativa:
    // - Ativar recursos de assinatura
    // - Agendar próximos pagamentos
    // - Enviar email de boas-vindas
  }

  /**
   * Processa assinatura cancelada
   */
  private async handleCancelledSubscription(
    subscription: any,
    usuario: any
  ): Promise<void> {
    console.log(
      `Assinatura cancelada: ${subscription.id} para usuário ${usuario.email}`
    );

    // Implementar lógicas para cancelamento:
    // - Desativar recursos premium
    // - Enviar email de cancelamento
    // - Oferecer reativação
  }

  /**
   * Processa assinatura pausada
   */
  private async handlePausedSubscription(
    subscription: any,
    usuario: any
  ): Promise<void> {
    console.log(
      `Assinatura pausada: ${subscription.id} para usuário ${usuario.email}`
    );

    // Implementar lógicas para pausa:
    // - Manter acesso temporário
    // - Notificar sobre pausa
    // - Agendar reativação automática se configurado
  }

  /**
   * Encontra usuário associado a um pagamento
   */
  private async findUserByPayment(payment: any): Promise<any> {
    try {
      // Busca pela external_reference ou email do pagador
      let usuario = null;

      if (payment.external_reference) {
        // Busca por referência externa (pode ser ID do usuário)
        usuario = await prisma.usuario.findFirst({
          where: { id: payment.external_reference },
        });
      }

      if (!usuario && payment.payer?.email) {
        // Busca por email do pagador
        usuario = await prisma.usuario.findUnique({
          where: { email: payment.payer.email },
        });
      }

      return usuario;
    } catch (error) {
      console.error("Erro ao buscar usuário por pagamento:", error);
      return null;
    }
  }

  /**
   * Encontra usuário associado a uma assinatura
   */
  private async findUserBySubscription(subscription: any): Promise<any> {
    try {
      // Busca pela external_reference ou email do pagador
      let usuario = null;

      if (subscription.external_reference) {
        usuario = await prisma.usuario.findFirst({
          where: { id: subscription.external_reference },
        });
      }

      if (!usuario && subscription.payer_email) {
        usuario = await prisma.usuario.findUnique({
          where: { email: subscription.payer_email },
        });
      }

      return usuario;
    } catch (error) {
      console.error("Erro ao buscar usuário por assinatura:", error);
      return null;
    }
  }

  /**
   * Valida se o webhook tem estrutura válida
   */
  private isValidWebhook(webhook: any): boolean {
    return (
      webhook &&
      webhook.id &&
      webhook.type &&
      webhook.action &&
      webhook.data &&
      webhook.data.id
    );
  }

  /**
   * Registra webhook recebido no banco
   */
  private async logWebhook(webhook: WebhookNotification): Promise<void> {
    try {
      await prisma.mercadoPagoWebhook.create({
        data: {
          webhookId: webhook.id,
          type: webhook.type,
          action: webhook.action,
          dataId: webhook.data.id,
          webhookData: webhook as any, // Cast para any para resolver o problema de tipagem JSON
          processed: false,
        },
      });
    } catch (error) {
      console.error("Erro ao registrar webhook:", error);
    }
  }

  /**
   * Atualiza log do webhook com resultado do processamento
   */
  private async updateWebhookLog(
    webhookId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.mercadoPagoWebhook.update({
        where: { webhookId },
        data: {
          processed: true,
          processedAt: new Date(),
          success,
          errorMessage,
        },
      });
    } catch (error) {
      console.error("Erro ao atualizar log do webhook:", error);
    }
  }

  /**
   * Atualiza informações de pagamento no banco
   */
  private async updatePaymentInDatabase(
    paymentId: string,
    updateData: { status?: string; statusDetail?: string; paymentData?: any }
  ): Promise<void> {
    try {
      await prisma.mercadoPagoOrder.updateMany({
        where: {
          orderData: {
            path: ["payments"],
            array_contains: [{ id: paymentId }],
          },
        },
        data: {
          atualizadoEm: new Date(),
        },
      });
    } catch (error) {
      console.error("Erro ao atualizar pagamento no banco:", error);
    }
  }

  /**
   * Atualiza informações de assinatura no banco
   */
  private async updateSubscriptionInDatabase(
    subscriptionId: string,
    updateData: { status?: string; subscriptionData?: any }
  ): Promise<void> {
    try {
      await prisma.mercadoPagoSubscription.update({
        where: { mercadoPagoSubscriptionId: subscriptionId },
        data: {
          ...updateData,
          atualizadoEm: new Date(),
        },
      });
    } catch (error) {
      console.error("Erro ao atualizar assinatura no banco:", error);
    }
  }
}
