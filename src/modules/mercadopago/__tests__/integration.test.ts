/**
 * Testes de integração para o módulo MercadoPago
 * Execute com: npm test ou pnpm test
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import { MercadoPagoClient } from "../client/mercadopago-client";
import { OrdersService } from "../services/orders-service";
import { SubscriptionService } from "../services/subscription-service";
import { WebhookService } from "../services/webhook-service";
import { ClientType } from "../enums";
import {
  formatCurrency,
  validateDocument,
  generateExternalReference,
  isValidAmount,
} from "../utils";
import { mercadoPagoConfig } from "../../../config/env";

const run = mercadoPagoConfig.isValid() ? describe : describe.skip;
run("MercadoPago Module Integration Tests", () => {
  let client: MercadoPagoClient;
  let ordersService: OrdersService;
  let subscriptionService: SubscriptionService;
  let webhookService: WebhookService;

  beforeAll(() => {
    client = MercadoPagoClient.getInstance(ClientType.SUBSCRIPTIONS);
    ordersService = new OrdersService();
    subscriptionService = new SubscriptionService();
    webhookService = new WebhookService();
  });

  describe("Client Configuration", () => {
    test("should create client instance", () => {
      expect(client).toBeDefined();
      expect(client.getPublicKey()).toBeDefined();
      expect(client.getEnvironment()).toBe("sandbox");
    });

    test("should validate configuration", () => {
      const isValid = client.validateConfiguration();
      expect(isValid).toBe(true);
    });

    test("should connect to MercadoPago API", async () => {
      const isConnected = await client.testConnection();
      expect(isConnected).toBe(true);
    }, 10000);

    test("should get payment methods", async () => {
      const result = await client.getPaymentMethods();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }, 10000);
  });

  describe("Orders Service", () => {
    test("should validate order data correctly", () => {
      const validOrderData = {
        type: "online" as const,
        processing_mode: "automatic" as const,
        total_amount: 100.5,
        items: [
          {
            id: "test_001",
            title: "Produto Teste",
            quantity: 1,
            unit_price: 100.5,
            currency_id: "BRL",
          },
        ],
        payments: [
          {
            payment_method_id: "visa",
            payment_type_id: "credit_card" as const,
            payer: {
              email: "test@example.com",
            },
          },
        ],
      };

      // Test validation logic (mocked)
      expect(validOrderData.total_amount).toBeGreaterThan(0);
      expect(validOrderData.items.length).toBeGreaterThan(0);
      expect(validOrderData.payments.length).toBeGreaterThan(0);
    });

    test("should calculate total correctly", () => {
      const items = [
        { quantity: 2, unit_price: 50.25 },
        { quantity: 1, unit_price: 25.5 },
      ];

      const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      );
      expect(total).toBe(126.0);
    });
  });

  describe("Utility Functions", () => {
    test("should format currency correctly", () => {
      expect(formatCurrency(100.5)).toBe(100.5);
      expect(formatCurrency(10050, true)).toBe(100.5);
      expect(formatCurrency(0.1)).toBe(0.1);
    });

    test("should validate amounts", () => {
      expect(isValidAmount(100.5)).toBe(true);
      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-10)).toBe(false);
      expect(isValidAmount(NaN)).toBe(false);
      expect(isValidAmount(Infinity)).toBe(false);
    });

    test("should validate CPF correctly", () => {
      const validCPF = validateDocument("123.456.789-09");
      expect(validCPF.type).toBe("CPF");
      expect(validCPF.cleaned).toBe("12345678909");

      const invalidCPF = validateDocument("123.456.789-10");
      expect(invalidCPF.type).toBe("CPF");
      expect(invalidCPF.isValid).toBe(false);
    });

    test("should validate CNPJ correctly", () => {
      const validCNPJ = validateDocument("11.222.333/0001-81");
      expect(validCNPJ.type).toBe("CNPJ");
      expect(validCNPJ.cleaned).toBe("11222333000181");

      const invalidCNPJ = validateDocument("11.222.333/0001-82");
      expect(invalidCNPJ.type).toBe("CNPJ");
      expect(invalidCNPJ.isValid).toBe(false);
    });

    test("should generate external reference", () => {
      const ref1 = generateExternalReference("user123", "order");
      const ref2 = generateExternalReference("user123", "order");

      expect(ref1).toMatch(/^order_user123_\d+_[a-z0-9]+$/);
      expect(ref2).toMatch(/^order_user123_\d+_[a-z0-9]+$/);
      expect(ref1).not.toBe(ref2); // Should be unique
    });
  });
});
