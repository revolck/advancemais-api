import {
  CreateOrderRequest,
  OrderResponse,
  RefundRequest,
  RefundResponse,
  ServiceResponse,
} from "../types/order";
import { MercadoPagoClient } from "../client/mercadopago-client";
import { ProcessingMode, OrderStatus } from "../enums";
import { prisma } from "../../../config/prisma";

/**
 * Serviço para gerenciar Orders do MercadoPago
 * Implementa a API de Orders v2 com suporte a modo automático e manual
 */
export class OrdersService {
  private client: MercadoPagoClient;

  constructor() {
    this.client = MercadoPagoClient.getInstance();
  }

  /**
   * Cria uma nova order no MercadoPago
   * @param orderData Dados da order a ser criada
   * @param usuarioId ID do usuário que está criando a order
   * @returns Promise<ServiceResponse<OrderResponse>>
   */
  public async createOrder(
    orderData: CreateOrderRequest,
    usuarioId: string
  ): Promise<ServiceResponse<OrderResponse>> {
    try {
      // Validação básica dos dados
      const validation = this.validateOrderData(orderData);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            message: "Dados da order inválidos",
            details: validation.errors,
            code: "INVALID_ORDER_DATA",
          },
        };
      }

      // Configura headers da requisição
      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": this.client.generateNewIdempotencyKey(),
      };

      // Faz a requisição para criar a order
      const response = await fetch(
        "https://api.mercadopago.com/merchant_orders",
        {
          method: "POST",
          headers,
          body: JSON.stringify(orderData),
        }
      );

      const responseData = await response.json();

      if (response.ok) {
        // Salva a order no banco de dados local
        await this.saveOrderToDatabase({
          mercadoPagoOrderId: responseData.id,
          usuarioId,
          status: responseData.status,
          totalAmount: responseData.total_amount,
          externalReference: responseData.external_reference,
          processingMode: orderData.processing_mode,
          orderData: responseData,
        });

        return {
          success: true,
          data: responseData as OrderResponse,
        };
      } else {
        console.error("Erro ao criar order no MercadoPago:", responseData);
        return {
          success: false,
          error: {
            message: "Erro ao criar order no MercadoPago",
            details: responseData,
            code: "MP_CREATE_ORDER_ERROR",
          },
        };
      }
    } catch (error) {
      console.error("Erro no serviço de criação de order:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao criar order",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Obtém informações de uma order pelo ID
   * @param orderId ID da order no MercadoPago
   * @returns Promise<ServiceResponse<OrderResponse>>
   */
  public async getOrder(
    orderId: string
  ): Promise<ServiceResponse<OrderResponse>> {
    try {
      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `https://api.mercadopago.com/merchant_orders/${orderId}`,
        {
          method: "GET",
          headers,
        }
      );

      const responseData = await response.json();

      if (response.ok) {
        // Atualiza os dados no banco local se necessário
        await this.updateOrderInDatabase(orderId, {
          status: responseData.status,
          orderData: responseData,
        });

        return {
          success: true,
          data: responseData as OrderResponse,
        };
      } else {
        return {
          success: false,
          error: {
            message: "Erro ao obter order do MercadoPago",
            details: responseData,
            code: "MP_GET_ORDER_ERROR",
          },
        };
      }
    } catch (error) {
      console.error("Erro ao obter order:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao obter order",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Cancela uma order que ainda não foi processada
   * @param orderId ID da order a ser cancelada
   * @param usuarioId ID do usuário que está cancelando
   * @returns Promise<ServiceResponse<OrderResponse>>
   */
  public async cancelOrder(
    orderId: string,
    usuarioId: string
  ): Promise<ServiceResponse<OrderResponse>> {
    try {
      // Verifica se a order pode ser cancelada
      const orderCheck = await this.getOrder(orderId);
      if (!orderCheck.success || !orderCheck.data) {
        return {
          success: false,
          error: {
            message: "Order não encontrada",
            code: "ORDER_NOT_FOUND",
          },
        };
      }

      if (orderCheck.data.status === OrderStatus.CLOSED) {
        return {
          success: false,
          error: {
            message: "Não é possível cancelar uma order já processada",
            code: "ORDER_ALREADY_PROCESSED",
          },
        };
      }

      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `https://api.mercadopago.com/merchant_orders/${orderId}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: "cancelled" }),
        }
      );

      const responseData = await response.json();

      if (response.ok) {
        // Atualiza no banco local
        await this.updateOrderInDatabase(orderId, {
          status: OrderStatus.CANCELLED,
          orderData: responseData,
        });

        return {
          success: true,
          data: responseData as OrderResponse,
        };
      } else {
        return {
          success: false,
          error: {
            message: "Erro ao cancelar order no MercadoPago",
            details: responseData,
            code: "MP_CANCEL_ORDER_ERROR",
          },
        };
      }
    } catch (error) {
      console.error("Erro ao cancelar order:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao cancelar order",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Processa reembolso de uma order (total ou parcial)
   * @param orderId ID da order
   * @param refundData Dados do reembolso
   * @param usuarioId ID do usuário solicitando o reembolso
   * @returns Promise<ServiceResponse<RefundResponse>>
   */
  public async refundOrder(
    orderId: string,
    refundData: RefundRequest,
    usuarioId: string
  ): Promise<ServiceResponse<RefundResponse>> {
    try {
      // Obtém informações da order primeiro
      const orderInfo = await this.getOrder(orderId);
      if (!orderInfo.success || !orderInfo.data) {
        return {
          success: false,
          error: {
            message: "Order não encontrada",
            code: "ORDER_NOT_FOUND",
          },
        };
      }

      // Verifica se existem pagamentos aprovados para reembolsar
      const approvedPayments = orderInfo.data.payments?.filter(
        (payment) => payment.status === "approved"
      );

      if (!approvedPayments || approvedPayments.length === 0) {
        return {
          success: false,
          error: {
            message: "Não há pagamentos aprovados para reembolsar",
            code: "NO_APPROVED_PAYMENTS",
          },
        };
      }

      const headers = {
        Authorization: `Bearer ${this.client.getClient().accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": this.client.generateNewIdempotencyKey(),
      };

      // Se é reembolso parcial e foi especificado um payment ID
      if (refundData.transaction_id) {
        const response = await fetch(
          `https://api.mercadopago.com/v1/payments/${refundData.transaction_id}/refunds`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              amount: refundData.amount,
              reason: refundData.reason,
              external_reference: refundData.external_reference,
              metadata: refundData.metadata,
            }),
          }
        );

        const responseData = await response.json();

        if (response.ok) {
          // Registra o reembolso no banco
          await this.saveRefundToDatabase({
            mercadoPagoRefundId: responseData.id,
            orderId,
            paymentId: refundData.transaction_id,
            amount: responseData.amount,
            status: responseData.status,
            usuarioId,
            reason: refundData.reason,
            refundData: responseData,
          });

          return {
            success: true,
            data: responseData as RefundResponse,
          };
        } else {
          return {
            success: false,
            error: {
              message: "Erro ao processar reembolso no MercadoPago",
              details: responseData,
              code: "MP_REFUND_ERROR",
            },
          };
        }
      } else {
        // Reembolso total - reembolsa todos os pagamentos aprovados
        const refunds: RefundResponse[] = [];

        for (const payment of approvedPayments) {
          const response = await fetch(
            `https://api.mercadopago.com/v1/payments/${payment.id}/refunds`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                reason: refundData.reason,
                external_reference: refundData.external_reference,
                metadata: refundData.metadata,
              }),
            }
          );

          const responseData = await response.json();

          if (response.ok) {
            refunds.push(responseData);

            // Registra cada reembolso no banco
            await this.saveRefundToDatabase({
              mercadoPagoRefundId: responseData.id,
              orderId,
              paymentId: payment.id,
              amount: responseData.amount,
              status: responseData.status,
              usuarioId,
              reason: refundData.reason,
              refundData: responseData,
            });
          }
        }

        return {
          success: true,
          data: refunds[0], // Retorna o primeiro reembolso como representativo
        };
      }
    } catch (error) {
      console.error("Erro ao processar reembolso:", error);
      return {
        success: false,
        error: {
          message: "Erro interno ao processar reembolso",
          details: error instanceof Error ? error.message : "Erro desconhecido",
          code: "INTERNAL_ERROR",
        },
      };
    }
  }

  /**
   * Valida os dados de uma order antes de criar
   * @param orderData Dados da order
   * @returns Resultado da validação
   */
  private validateOrderData(orderData: CreateOrderRequest): {
    valid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];

    // Validações obrigatórias
    if (!orderData.total_amount || orderData.total_amount <= 0) {
      errors.push("Total amount deve ser maior que 0");
    }

    if (!orderData.items || orderData.items.length === 0) {
      errors.push("Pelo menos um item é obrigatório");
    }

    if (!orderData.payments || orderData.payments.length === 0) {
      errors.push("Pelo menos um método de pagamento é obrigatório");
    }

    // Valida items
    orderData.items?.forEach((item, index) => {
      if (!item.id || !item.title || !item.quantity || !item.unit_price) {
        errors.push(
          `Item ${index + 1}: id, title, quantity e unit_price são obrigatórios`
        );
      }
      if (item.quantity <= 0) {
        errors.push(`Item ${index + 1}: quantity deve ser maior que 0`);
      }
      if (item.unit_price <= 0) {
        errors.push(`Item ${index + 1}: unit_price deve ser maior que 0`);
      }
    });

    // Valida payments
    orderData.payments?.forEach((payment, index) => {
      if (!payment.payment_method_id || !payment.payer?.email) {
        errors.push(
          `Payment ${
            index + 1
          }: payment_method_id e payer.email são obrigatórios`
        );
      }
    });

    // Valida processing_mode
    if (!Object.values(ProcessingMode).includes(orderData.processing_mode)) {
      errors.push('Processing mode deve ser "automatic" ou "manual"');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Salva a order no banco de dados local
   * @param orderData Dados da order para salvar
   */
  private async saveOrderToDatabase(orderData: {
    mercadoPagoOrderId: string;
    usuarioId: string;
    status: string;
    totalAmount: number;
    externalReference?: string;
    processingMode: string;
    orderData: any;
  }): Promise<void> {
    try {
      await prisma.mercadoPagoOrder.create({
        data: {
          mercadoPagoOrderId: orderData.mercadoPagoOrderId,
          usuarioId: orderData.usuarioId,
          status: orderData.status,
          totalAmount: orderData.totalAmount,
          externalReference: orderData.externalReference,
          processingMode: orderData.processingMode,
          orderData: orderData.orderData,
        },
      });
    } catch (error) {
      console.error("Erro ao salvar order no banco:", error);
      // Não falha o processo principal se não conseguir salvar no banco
    }
  }

  /**
   * Atualiza dados da order no banco local
   * @param orderId ID da order no MercadoPago
   * @param updateData Dados para atualizar
   */
  private async updateOrderInDatabase(
    orderId: string,
    updateData: { status?: string; orderData?: any }
  ): Promise<void> {
    try {
      await prisma.mercadoPagoOrder.update({
        where: { mercadoPagoOrderId: orderId },
        data: {
          ...updateData,
          atualizadoEm: new Date(),
        },
      });
    } catch (error) {
      console.error("Erro ao atualizar order no banco:", error);
      // Não falha o processo principal se não conseguir atualizar no banco
    }
  }

  /**
   * Salva dados de reembolso no banco local
   * @param refundData Dados do reembolso
   */
  private async saveRefundToDatabase(refundData: {
    mercadoPagoRefundId: string;
    orderId: string;
    paymentId: string;
    amount: number;
    status: string;
    usuarioId: string;
    reason?: string;
    refundData: any;
  }): Promise<void> {
    try {
      await prisma.mercadoPagoRefund.create({
        data: {
          mercadoPagoRefundId: refundData.mercadoPagoRefundId,
          orderId: refundData.orderId,
          paymentId: refundData.paymentId,
          amount: refundData.amount,
          status: refundData.status,
          usuarioId: refundData.usuarioId,
          reason: refundData.reason,
          refundData: refundData.refundData,
        },
      });
    } catch (error) {
      console.error("Erro ao salvar reembolso no banco:", error);
      // Não falha o processo principal se não conseguir salvar no banco
    }
  }
}
