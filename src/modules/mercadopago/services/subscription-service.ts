import {
  SubscriptionData,
  SubscriptionResponse,
  ServiceResponse,
} from "../types/order";
import { MercadoPagoClient } from "../client/mercadopago-client";
import { SubscriptionStatus, FrequencyType } from "../enums";
import { prisma } from "../../../config/prisma";

/**
 * Serviço para gerenciar Assinaturas/Subscriptions do MercadoPago
 * Implementa pagamentos recorrentes automáticos
 */
export class SubscriptionService {
  private client: MercadoPagoClient;

  constructor() {
    this.client = MercadoPagoClient.getInstance();
  }

  /**
   * Cria uma nova assinatura no MercadoPago
   * @param subscriptionData Dados da assinatura
   * @param usuarioId ID do usuário que está criando a assinatura
   * @returns Promise<ServiceResponse<SubscriptionResponse>>
   */
  public async createSubscription(
    subscriptionData: SubscriptionData,
    usuarioId: string
  ): Promise<ServiceResponse<SubscriptionResponse>> {
    try {
      // Validação dos dados da assinatura
      const validation = this.validateSubscriptionData(subscriptionData);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            message: "Dados da assinatura inválidos",
            details: validation.errors,
            code: "INVALID_SUBSCRIPTION_DATA",
          },
        };
      }

      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": this.client.generateNewIdempotencyKey(),
      };

      // Prepara os dados para a API do MercadoPago
      const apiData = {
        reason: subscriptionData.reason,
        external_reference: subscriptionData.external_reference,
        payer_email: subscriptionData.payer_email,
        card_token_id: subscriptionData.card_token_id,
        auto_recurring: {
          frequency: subscriptionData.auto_recurring.frequency,
          frequency_type: subscriptionData.auto_recurring.frequency_type,
          transaction_amount:
            subscriptionData.auto_recurring.transaction_amount,
          currency_id: subscriptionData.auto_recurring.currency_id,
          repetitions: subscriptionData.auto_recurring.repetitions,
          debit_date: subscriptionData.auto_recurring.debit_date,
          free_trial: subscriptionData.auto_recurring.free_trial,
        },
        back_url: subscriptionData.back_url,
        status: subscriptionData.status || SubscriptionStatus.PENDING,
      };

      // Se há um plano predefinido, inclui o ID
      if (subscriptionData.preapproval_plan_id) {
        (apiData as any).preapproval_plan_id =
          subscriptionData.preapproval_plan_id;
      }

      const response = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers,
        body: JSON.stringify(apiData),
      });

      const responseData = await response.json();

      if (response.ok) {
        // Salva a assinatura no banco de dados local
        await this.saveSubscriptionToDatabase({
          mercadoPagoSubscriptionId: responseData.id,
          usuarioId,
          status: responseData.status,
          reason: responseData.reason,
          payerEmail: responseData.payer_email,
          transactionAmount: responseData.auto_recurring.transaction_amount,
          frequency: responseData.auto_recurring.frequency,
          frequencyType: responseData.auto_recurring.frequency_type,
          externalReference: responseData.external_reference,
          subscriptionData: responseData,
        });

        return {
          success: true,
          data: responseData as SubscriptionResponse,
        };
      } else {
        console.error("Erro ao criar assinatura no MercadoPago:", responseData);
        return {
          success: false,
          error: {
            message: "Erro ao criar assinatura no MercadoPago",
            details: responseData,
            code: "MP_CREATE_SUBSCRIPTION_ERROR",
          },
        };
      }
    } catch (error) {
      console.error("Erro no serviço de criação de assinatura:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao criar assinatura",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Obtém informações de uma assinatura pelo ID
   * @param subscriptionId ID da assinatura no MercadoPago
   * @returns Promise<ServiceResponse<SubscriptionResponse>>
   */
  public async getSubscription(
    subscriptionId: string
  ): Promise<ServiceResponse<SubscriptionResponse>> {
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
        // Atualiza os dados no banco local se necessário
        await this.updateSubscriptionInDatabase(subscriptionId, {
          status: responseData.status,
          subscriptionData: responseData,
        });

        return {
          success: true,
          data: responseData as SubscriptionResponse,
        };
      } else {
        return {
          success: false,
          error: {
            message: "Erro ao obter assinatura do MercadoPago",
            details: responseData,
            code: "MP_GET_SUBSCRIPTION_ERROR",
          },
        };
      }
    } catch (error) {
      console.error("Erro ao obter assinatura:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao obter assinatura",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Atualiza uma assinatura existente
   * @param subscriptionId ID da assinatura
   * @param updateData Dados para atualizar
   * @param usuarioId ID do usuário
   * @returns Promise<ServiceResponse<SubscriptionResponse>>
   */
  public async updateSubscription(
    subscriptionId: string,
    updateData: Partial<SubscriptionData>,
    usuarioId: string
  ): Promise<ServiceResponse<SubscriptionResponse>> {
    try {
      // Verifica se a assinatura existe
      const subscriptionCheck = await this.getSubscription(subscriptionId);
      if (!subscriptionCheck.success || !subscriptionCheck.data) {
        return {
          success: false,
          error: {
            message: "Assinatura não encontrada",
            code: "SUBSCRIPTION_NOT_FOUND",
          },
        };
      }

      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
      };

      // Prepara apenas os campos que podem ser atualizados
      const apiData: any = {};

      if (updateData.reason) apiData.reason = updateData.reason;
      if (updateData.status) apiData.status = updateData.status;
      if (updateData.external_reference)
        apiData.external_reference = updateData.external_reference;
      if (updateData.back_url) apiData.back_url = updateData.back_url;

      // Campos de auto_recurring que podem ser atualizados
      if (updateData.auto_recurring) {
        apiData.auto_recurring = {};
        if (updateData.auto_recurring.transaction_amount) {
          apiData.auto_recurring.transaction_amount =
            updateData.auto_recurring.transaction_amount;
        }
        if (updateData.auto_recurring.frequency) {
          apiData.auto_recurring.frequency =
            updateData.auto_recurring.frequency;
        }
        if (updateData.auto_recurring.frequency_type) {
          apiData.auto_recurring.frequency_type =
            updateData.auto_recurring.frequency_type;
        }
      }

      const response = await fetch(
        `https://api.mercadopago.com/preapproval/${subscriptionId}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(apiData),
        }
      );

      const responseData = await response.json();

      if (response.ok) {
        // Atualiza no banco local
        await this.updateSubscriptionInDatabase(subscriptionId, {
          status: responseData.status,
          subscriptionData: responseData,
        });

        return {
          success: true,
          data: responseData as SubscriptionResponse,
        };
      } else {
        return {
          success: false,
          error: {
            message: "Erro ao atualizar assinatura no MercadoPago",
            details: responseData,
            code: "MP_UPDATE_SUBSCRIPTION_ERROR",
          },
        };
      }
    } catch (error) {
      console.error("Erro ao atualizar assinatura:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao atualizar assinatura",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Pausa uma assinatura ativa
   * @param subscriptionId ID da assinatura
   * @param usuarioId ID do usuário
   * @returns Promise<ServiceResponse<SubscriptionResponse>>
   */
  public async pauseSubscription(
    subscriptionId: string,
    usuarioId: string
  ): Promise<ServiceResponse<SubscriptionResponse>> {
    return this.updateSubscription(
      subscriptionId,
      { status: SubscriptionStatus.PAUSED },
      usuarioId
    );
  }

  /**
   * Cancela uma assinatura
   * @param subscriptionId ID da assinatura
   * @param usuarioId ID do usuário
   * @returns Promise<ServiceResponse<SubscriptionResponse>>
   */
  public async cancelSubscription(
    subscriptionId: string,
    usuarioId: string
  ): Promise<ServiceResponse<SubscriptionResponse>> {
    return this.updateSubscription(
      subscriptionId,
      { status: SubscriptionStatus.CANCELLED },
      usuarioId
    );
  }

  /**
   * Reativa uma assinatura pausada
   * @param subscriptionId ID da assinatura
   * @param usuarioId ID do usuário
   * @returns Promise<ServiceResponse<SubscriptionResponse>>
   */
  public async reactivateSubscription(
    subscriptionId: string,
    usuarioId: string
  ): Promise<ServiceResponse<SubscriptionResponse>> {
    return this.updateSubscription(
      subscriptionId,
      { status: SubscriptionStatus.AUTHORIZED },
      usuarioId
    );
  }

  /**
   * Lista assinaturas de um usuário
   * @param usuarioId ID do usuário
   * @param status Status das assinaturas a buscar (opcional)
   * @returns Promise<ServiceResponse<SubscriptionResponse[]>>
   */
  public async getUserSubscriptions(
    usuarioId: string,
    status?: SubscriptionStatus
  ): Promise<ServiceResponse<SubscriptionResponse[]>> {
    try {
      // Busca as assinaturas no banco local primeiro
      const whereClause: any = { usuarioId };
      if (status) {
        whereClause.status = status;
      }

      const localSubscriptions = await prisma.mercadoPagoSubscription.findMany({
        where: whereClause,
        orderBy: { criadoEm: "desc" },
      });

      // Para cada assinatura local, busca dados atualizados do MercadoPago
      const subscriptions: SubscriptionResponse[] = [];

      for (const localSub of localSubscriptions) {
        const mpSubscription = await this.getSubscription(
          localSub.mercadoPagoSubscriptionId
        );
        if (mpSubscription.success && mpSubscription.data) {
          subscriptions.push(mpSubscription.data);
        }
      }

      return {
        success: true,
        data: subscriptions,
      };
    } catch (error) {
      console.error("Erro ao buscar assinaturas do usuário:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao buscar assinaturas",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Valida os dados de uma assinatura antes de criar
   * @param subscriptionData Dados da assinatura
   * @returns Resultado da validação
   */
  private validateSubscriptionData(subscriptionData: SubscriptionData): {
    valid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];

    // Validações obrigatórias
    if (!subscriptionData.reason || subscriptionData.reason.trim() === "") {
      errors.push("Reason é obrigatório");
    }

    if (
      !subscriptionData.payer_email ||
      !this.isValidEmail(subscriptionData.payer_email)
    ) {
      errors.push("Email do pagador é obrigatório e deve ser válido");
    }

    if (!subscriptionData.auto_recurring) {
      errors.push("Configuração auto_recurring é obrigatória");
    } else {
      const recurring = subscriptionData.auto_recurring;

      if (!recurring.frequency || recurring.frequency <= 0) {
        errors.push("Frequency deve ser maior que 0");
      }

      if (
        !recurring.frequency_type ||
        !Object.values(FrequencyType).includes(recurring.frequency_type)
      ) {
        errors.push('Frequency type deve ser "days" ou "months"');
      }

      if (!recurring.transaction_amount || recurring.transaction_amount <= 0) {
        errors.push("Transaction amount deve ser maior que 0");
      }

      if (!recurring.currency_id) {
        errors.push("Currency ID é obrigatório");
      }

      // Validação de repetições
      if (recurring.repetitions && recurring.repetitions <= 0) {
        errors.push("Repetitions deve ser maior que 0 se especificado");
      }

      // Validação de free trial
      if (recurring.free_trial) {
        if (recurring.free_trial.frequency <= 0) {
          errors.push("Free trial frequency deve ser maior que 0");
        }
        if (
          !Object.values(FrequencyType).includes(
            recurring.free_trial.frequency_type
          )
        ) {
          errors.push('Free trial frequency type deve ser "days" ou "months"');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Valida formato de email
   * @param email Email para validar
   * @returns true se válido
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Salva a assinatura no banco de dados local
   * @param subscriptionData Dados da assinatura
   */
  private async saveSubscriptionToDatabase(subscriptionData: {
    mercadoPagoSubscriptionId: string;
    usuarioId: string;
    status: string;
    reason: string;
    payerEmail: string;
    transactionAmount: number;
    frequency: number;
    frequencyType: string;
    externalReference?: string;
    subscriptionData: any;
  }): Promise<void> {
    try {
      await prisma.mercadoPagoSubscription.create({
        data: {
          mercadoPagoSubscriptionId: subscriptionData.mercadoPagoSubscriptionId,
          usuarioId: subscriptionData.usuarioId,
          status: subscriptionData.status,
          reason: subscriptionData.reason,
          payerEmail: subscriptionData.payerEmail,
          transactionAmount: subscriptionData.transactionAmount,
          frequency: subscriptionData.frequency,
          frequencyType: subscriptionData.frequencyType,
          externalReference: subscriptionData.externalReference,
          subscriptionData: subscriptionData.subscriptionData,
        },
      });
    } catch (error) {
      console.error("Erro ao salvar assinatura no banco:", error);
      // Não falha o processo principal se não conseguir salvar no banco
    }
  }

  /**
   * Atualiza dados da assinatura no banco local
   * @param subscriptionId ID da assinatura no MercadoPago
   * @param updateData Dados para atualizar
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
      // Não falha o processo principal se não conseguir atualizar no banco
    }
  }
}
