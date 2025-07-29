import { Request, Response } from "express";
import { OrdersService } from "../services/orders-service";
import { CreateOrderRequest, RefundRequest } from "../types/order";
import { ProcessingMode } from "../enums";

/**
 * Controller para gerenciar Orders do MercadoPago
 * Endpoints para criar, obter, cancelar e reembolsar orders
 */
export class OrdersController {
  private ordersService: OrdersService;

  constructor() {
    this.ordersService = new OrdersService();
  }

  /**
   * Cria uma nova order
   * POST /mercadopago/orders
   */
  public createOrder = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const orderData: CreateOrderRequest = req.body;

      // Validação básica
      if (!orderData.total_amount || !orderData.items || !orderData.payments) {
        return res.status(400).json({
          message: "Dados obrigatórios: total_amount, items e payments",
        });
      }

      // Define processing_mode padrão se não fornecido
      if (!orderData.processing_mode) {
        orderData.processing_mode = ProcessingMode.AUTOMATIC;
      }

      // Define external_reference como userId se não fornecido
      if (!orderData.external_reference) {
        orderData.external_reference = userId;
      }

      const result = await this.ordersService.createOrder(orderData, userId);

      if (result.success) {
        res.status(201).json({
          message: "Order criada com sucesso",
          order: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao criar order",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro no controller de criação de order:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Obtém informações de uma order
   * GET /mercadopago/orders/:orderId
   */
  public getOrder = async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          message: "ID da order é obrigatório",
        });
      }

      const result = await this.ordersService.getOrder(orderId);

      if (result.success) {
        res.json({
          message: "Order encontrada",
          order: result.data,
        });
      } else {
        res.status(404).json({
          message: result.error?.message || "Order não encontrada",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao obter order:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Cancela uma order
   * PUT /mercadopago/orders/:orderId/cancel
   */
  public cancelOrder = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          message: "ID da order é obrigatório",
        });
      }

      const result = await this.ordersService.cancelOrder(orderId, userId);

      if (result.success) {
        res.json({
          message: "Order cancelada com sucesso",
          order: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao cancelar order",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao cancelar order:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Processa reembolso de uma order
   * POST /mercadopago/orders/:orderId/refund
   */
  public refundOrder = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const { orderId } = req.params;
      const refundData: RefundRequest = req.body;

      if (!orderId) {
        return res.status(400).json({
          message: "ID da order é obrigatório",
        });
      }

      const result = await this.ordersService.refundOrder(
        orderId,
        refundData,
        userId
      );

      if (result.success) {
        res.json({
          message: "Reembolso processado com sucesso",
          refund: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao processar reembolso",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao processar reembolso:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
}
