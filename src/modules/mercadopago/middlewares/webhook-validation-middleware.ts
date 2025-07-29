import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { mercadoPagoConfig } from "../../../config/env";

/**
 * Middleware para validar webhooks do MercadoPago
 * Verifica a assinatura para garantir que a requisição vem do MercadoPago
 */
export class WebhookValidationMiddleware {
  /**
   * Valida a assinatura do webhook usando o secret configurado
   * @param req Request
   * @param res Response
   * @param next NextFunction
   */
  public static validateWebhookSignature = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Se não há secret configurado, pula a validação (não recomendado para produção)
      if (!mercadoPagoConfig.webhookSecret) {
        console.warn(
          "⚠️  Webhook secret não configurado - validação de assinatura desabilitada"
        );
        return next();
      }

      // Obtém a assinatura do header
      const signature = req.headers["x-signature"] as string;
      const requestId = req.headers["x-request-id"] as string;

      if (!signature) {
        console.error("❌ Webhook sem assinatura");
        return res.status(401).json({
          message: "Assinatura do webhook não encontrada",
          code: "MISSING_SIGNATURE",
        });
      }

      // Extrai as partes da assinatura
      const parts = signature.split(",");
      let ts: string | undefined;
      let v1: string | undefined;

      for (const part of parts) {
        const [key, value] = part.split("=");
        if (key === "ts") {
          ts = value;
        } else if (key === "v1") {
          v1 = value;
        }
      }

      if (!ts || !v1) {
        console.error("❌ Formato de assinatura inválido");
        return res.status(401).json({
          message: "Formato de assinatura inválido",
          code: "INVALID_SIGNATURE_FORMAT",
        });
      }

      // Verifica se o timestamp não é muito antigo (tolerância de 5 minutos)
      const currentTime = Math.floor(Date.now() / 1000);
      const webhookTime = parseInt(ts);
      const timeDiff = Math.abs(currentTime - webhookTime);

      if (timeDiff > 300) {
        // 5 minutos
        console.error("❌ Webhook muito antigo:", timeDiff, "segundos");
        return res.status(401).json({
          message: "Webhook expirado",
          code: "EXPIRED_WEBHOOK",
        });
      }

      // Reconstroi o payload para validação
      const dataId = req.body?.data?.id || "";
      const payloadToSign = `id:${requestId};request-id:${requestId};ts:${ts};`;

      // Calcula a assinatura esperada
      const expectedSignature = crypto
        .createHmac("sha256", mercadoPagoConfig.webhookSecret)
        .update(payloadToSign)
        .digest("hex");

      // Compara as assinaturas usando comparação segura
      if (
        !crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expectedSignature))
      ) {
        console.error("❌ Assinatura de webhook inválida");
        console.error("Esperada:", expectedSignature);
        console.error("Recebida:", v1);
        console.error("Payload:", payloadToSign);

        return res.status(401).json({
          message: "Assinatura de webhook inválida",
          code: "INVALID_SIGNATURE",
        });
      }

      console.log("✅ Webhook validado com sucesso");
      next();
    } catch (error) {
      console.error("❌ Erro na validação de webhook:", error);
      res.status(500).json({
        message: "Erro interno na validação de webhook",
        code: "VALIDATION_ERROR",
      });
    }
  };

  /**
   * Middleware para rate limiting específico de webhooks
   * Limita o número de webhooks por IP em um período de tempo
   */
  public static webhookRateLimit = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // Implementação simples de rate limiting em memória
    // Para produção, considere usar Redis ou similar
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const windowMs = 60000; // 1 minuto
    const maxRequests = 100; // Máximo 100 webhooks por minuto por IP

    if (!WebhookValidationMiddleware.rateLimitStore) {
      WebhookValidationMiddleware.rateLimitStore = new Map();
    }

    const now = Date.now();
    const windowStart = now - windowMs;

    // Limpa entradas antigas
    for (const [
      key,
      data,
    ] of WebhookValidationMiddleware.rateLimitStore.entries()) {
      if (data.resetTime < now) {
        WebhookValidationMiddleware.rateLimitStore.delete(key);
      }
    }

    // Verifica rate limit para o IP atual
    const ipData = WebhookValidationMiddleware.rateLimitStore.get(ip) || {
      count: 0,
      resetTime: now + windowMs,
      firstRequest: now,
    };

    // Se a janela expirou, reseta
    if (ipData.resetTime < now) {
      ipData.count = 1;
      ipData.resetTime = now + windowMs;
      ipData.firstRequest = now;
    } else {
      ipData.count++;
    }

    WebhookValidationMiddleware.rateLimitStore.set(ip, ipData);

    // Verifica se excedeu o limite
    if (ipData.count > maxRequests) {
      console.warn(
        `⚠️  Rate limit excedido para IP ${ip}: ${ipData.count} requests`
      );
      return res.status(429).json({
        message: "Muitas requisições de webhook",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil((ipData.resetTime - now) / 1000),
      });
    }

    next();
  };

  // Store em memória para rate limiting (considere usar Redis em produção)
  private static rateLimitStore: Map<
    string,
    {
      count: number;
      resetTime: number;
      firstRequest: number;
    }
  >;
}
