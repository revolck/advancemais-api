import { Request, Response, NextFunction } from "express";
import { CreateOrderRequest, SubscriptionData } from "../types/order";
import { ProcessingMode, CurrencyId } from "../enums";

/**
 * Middleware para validar dados de pagamento e orders
 */
export class PaymentValidationMiddleware {
  /**
   * Valida dados de criação de order
   */
  public static validateOrderCreation = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const orderData: CreateOrderRequest = req.body;
      const errors: string[] = [];

      // Validações obrigatórias
      if (!orderData.total_amount || orderData.total_amount <= 0) {
        errors.push("total_amount deve ser maior que 0");
      }

      if (
        !orderData.items ||
        !Array.isArray(orderData.items) ||
        orderData.items.length === 0
      ) {
        errors.push("items deve ser um array não vazio");
      }

      if (
        !orderData.payments ||
        !Array.isArray(orderData.payments) ||
        orderData.payments.length === 0
      ) {
        errors.push("payments deve ser um array não vazio");
      }

      // Valida processing_mode
      if (
        orderData.processing_mode &&
        !Object.values(ProcessingMode).includes(orderData.processing_mode)
      ) {
        errors.push('processing_mode deve ser "automatic" ou "manual"');
      }

      // Valida items
      if (orderData.items) {
        orderData.items.forEach((item, index) => {
          if (!item.id || typeof item.id !== "string") {
            errors.push(
              `Item ${index + 1}: id é obrigatório e deve ser string`
            );
          }
          if (!item.title || typeof item.title !== "string") {
            errors.push(
              `Item ${index + 1}: title é obrigatório e deve ser string`
            );
          }
          if (!item.quantity || item.quantity <= 0) {
            errors.push(`Item ${index + 1}: quantity deve ser maior que 0`);
          }
          if (!item.unit_price || item.unit_price <= 0) {
            errors.push(`Item ${index + 1}: unit_price deve ser maior que 0`);
          }
          if (
            !item.currency_id ||
            !Object.values(CurrencyId).includes(item.currency_id)
          ) {
            errors.push(
              `Item ${
                index + 1
              }: currency_id deve ser uma moeda válida (BRL, USD, etc.)`
            );
          }
        });
      }

      // Valida payments
      if (orderData.payments) {
        orderData.payments.forEach((payment, index) => {
          if (
            !payment.payment_method_id ||
            typeof payment.payment_method_id !== "string"
          ) {
            errors.push(
              `Payment ${index + 1}: payment_method_id é obrigatório`
            );
          }
          if (!payment.payer || !payment.payer.email) {
            errors.push(`Payment ${index + 1}: payer.email é obrigatório`);
          }
          if (
            payment.payer?.email &&
            !PaymentValidationMiddleware.isValidEmail(payment.payer.email)
          ) {
            errors.push(
              `Payment ${index + 1}: payer.email deve ter formato válido`
            );
          }
        });
      }

      // Valida valores totais
      if (orderData.items && orderData.total_amount) {
        const calculatedTotal = orderData.items.reduce(
          (sum, item) => sum + item.quantity * item.unit_price,
          0
        );

        // Tolerância de 1 centavo para diferenças de arredondamento
        if (Math.abs(calculatedTotal - orderData.total_amount) > 0.01) {
          errors.push(
            "total_amount deve ser igual à soma dos valores dos items"
          );
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          message: "Dados de order inválidos",
          errors,
          code: "INVALID_ORDER_DATA",
        });
      }

      next();
    } catch (error) {
      console.error("Erro na validação de order:", error);
      res.status(500).json({
        message: "Erro interno na validação",
        code: "VALIDATION_ERROR",
      });
    }
  };

  /**
   * Valida dados de criação de assinatura
   */
  public static validateSubscriptionCreation = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const subscriptionData: SubscriptionData = req.body;
      const errors: string[] = [];

      // Validações obrigatórias
      if (
        !subscriptionData.reason ||
        typeof subscriptionData.reason !== "string" ||
        subscriptionData.reason.trim() === ""
      ) {
        errors.push("reason é obrigatório e deve ser uma string não vazia");
      }

      if (
        !subscriptionData.payer_email ||
        !PaymentValidationMiddleware.isValidEmail(subscriptionData.payer_email)
      ) {
        errors.push("payer_email é obrigatório e deve ter formato válido");
      }

      if (!subscriptionData.auto_recurring) {
        errors.push("auto_recurring é obrigatório");
      } else {
        const recurring = subscriptionData.auto_recurring;

        if (!recurring.frequency || recurring.frequency <= 0) {
          errors.push("auto_recurring.frequency deve ser maior que 0");
        }

        if (
          !recurring.frequency_type ||
          !["days", "months"].includes(recurring.frequency_type)
        ) {
          errors.push(
            'auto_recurring.frequency_type deve ser "days" ou "months"'
          );
        }

        if (
          !recurring.transaction_amount ||
          recurring.transaction_amount <= 0
        ) {
          errors.push("auto_recurring.transaction_amount deve ser maior que 0");
        }

        if (
          !recurring.currency_id ||
          !Object.values(CurrencyId).includes(recurring.currency_id)
        ) {
          errors.push("auto_recurring.currency_id deve ser uma moeda válida");
        }

        // Validação de repetições
        if (recurring.repetitions !== undefined && recurring.repetitions <= 0) {
          errors.push(
            "auto_recurring.repetitions deve ser maior que 0 se especificado"
          );
        }

        // Validação de free trial
        if (recurring.free_trial) {
          if (
            !recurring.free_trial.frequency ||
            recurring.free_trial.frequency <= 0
          ) {
            errors.push(
              "auto_recurring.free_trial.frequency deve ser maior que 0"
            );
          }
          if (
            !recurring.free_trial.frequency_type ||
            !["days", "months"].includes(recurring.free_trial.frequency_type)
          ) {
            errors.push(
              'auto_recurring.free_trial.frequency_type deve ser "days" ou "months"'
            );
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          message: "Dados de assinatura inválidos",
          errors,
          code: "INVALID_SUBSCRIPTION_DATA",
        });
      }

      next();
    } catch (error) {
      console.error("Erro na validação de assinatura:", error);
      res.status(500).json({
        message: "Erro interno na validação",
        code: "VALIDATION_ERROR",
      });
    }
  };

  /**
   * Middleware para sanitizar dados de entrada
   */
  public static sanitizePaymentData = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Remove propriedades perigosas que não devem vir do cliente
      if (req.body) {
        // Remove propriedades sensíveis que só devem ser definidas pelo servidor
        delete req.body.access_token;
        delete req.body.webhook_secret;
        delete req.body.private_key;

        // Sanitiza strings
        if (typeof req.body.external_reference === "string") {
          req.body.external_reference = req.body.external_reference.trim();
        }

        if (typeof req.body.description === "string") {
          req.body.description = req.body.description.trim();
        }

        // Sanitiza email do payer
        if (req.body.payments && Array.isArray(req.body.payments)) {
          req.body.payments.forEach((payment: any) => {
            if (payment.payer && typeof payment.payer.email === "string") {
              payment.payer.email = payment.payer.email.trim().toLowerCase();
            }
          });
        }

        if (typeof req.body.payer_email === "string") {
          req.body.payer_email = req.body.payer_email.trim().toLowerCase();
        }
      }

      next();
    } catch (error) {
      console.error("Erro na sanitização:", error);
      res.status(500).json({
        message: "Erro interno na sanitização de dados",
        code: "SANITIZATION_ERROR",
      });
    }
  };

  /**
   * Valida formato de email
   * @param email Email para validar
   * @returns true se válido
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
