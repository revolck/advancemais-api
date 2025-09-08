import { MercadoPagoClient } from "../client/mercadopago-client";
import { ClientType, FrequencyType } from "../enums";
import { ServiceResponse } from "../types/order";

/**
 * Serviço para operações de planos de assinatura do MercadoPago
 */
export class PlanService {
  private client: MercadoPagoClient;

  constructor() {
    this.client = MercadoPagoClient.getInstance(ClientType.SUBSCRIPTIONS);
  }

  /**
   * Atualiza o período de teste grátis de um plano de assinatura
   */
  public async updateFreeTrial(
    planId: string,
    freeTrial: { frequency: number; frequency_type: FrequencyType }
  ): Promise<ServiceResponse<any>> {
    try {
      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
      };

      const body = {
        auto_recurring: {
          free_trial: freeTrial,
        },
      };

      const response = await fetch(
        `https://api.mercadopago.com/preapproval_plan/${planId}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return { success: true, data };
      }

      return {
        success: false,
        error: {
          message: "Erro ao atualizar plano no MercadoPago",
          details: data,
          code: "MP_UPDATE_PLAN_ERROR",
        },
      };
    } catch (error) {
      console.error("Erro ao atualizar plano:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao atualizar plano",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }
}
