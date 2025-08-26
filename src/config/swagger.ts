import type { Application, RequestHandler } from "express";
import swaggerJsdoc, { Options } from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { supabaseAuthMiddleware } from "../modules/usuarios/auth";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Advance+ API",
      version: "1.0.0",
      description:
        "Documentação detalhada da API Advance+. Todas as rotas protegidas exigem o header `Authorization: Bearer <token>` obtido via login. O acesso ao Swagger é restrito a administradores.",
    },
    tags: [
      {
        name: "Default",
        description: "Endpoints públicos da API",
      },
      {
        name: "Usuários",
        description:
          "Gerenciamento de contas e autenticação: registro, login, refresh, logout, perfil e recuperação de senha",
      },
      {
        name: "Usuários - Admin",
        description: "Gestão administrativa de usuários",
      },
      {
        name: "Usuários - Pagamentos",
        description: "Operações de pagamento do usuário",
      },
      {
        name: "Usuários - Stats",
        description: "Métricas e relatórios de usuários",
      },
      { name: "MercadoPago", description: "Integração de pagamentos" },
      { name: "Audit", description: "Registros de auditoria" },
      { name: "Brevo", description: "Serviços de e-mail" },
      { name: "Empresa", description: "Gestão de planos de empresa" },
      { name: "Website", description: "Conteúdo público do site" },
      { name: "Website - Banner", description: "Gestão de banners" },
      { name: "Website - LogoEnterprises", description: "Logos de empresas" },
      { name: "Website - Slider", description: "Gestão de sliders" },
      { name: "Website - Sobre", description: "Conteúdos \"Sobre\"" },
      {
        name: "Website - Consultoria",
        description: "Conteúdos \"Consultoria\"",
      },
      {
        name: "Website - Recrutamento",
        description: "Conteúdos \"Recrutamento\"",
      },
      {
        name: "Website - SobreEmpresa",
        description: "Conteúdos \"Sobre Empresa\"",
      },
      {
        name: "Website - Team",
        description: "Conteúdos \"Team\"",
      },
      {
        name: "Website - Diferenciais",
        description: "Conteúdos \"Diferenciais\"",
      },
    ],
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Erro de validação" },
            code: { type: "string", example: "VALIDATION_ERROR" },
          },
        },
        UserLoginRequest: {
          type: "object",
          required: ["documento", "senha"],
          properties: {
            documento: {
              type: "string",
              description: "CPF do usuário",
              example: "12345678900",
            },
            senha: {
              type: "string",
              format: "password",
              example: "senha123",
            },
          },
        },
        UserLoginResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            token: {
              type: "string",
              description: "JWT de acesso",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refreshToken: {
              type: "string",
              description: "Token para renovação de sessão",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },
        UserRegisterRequest: {
          type: "object",
          required: [
            "nomeCompleto",
            "documento",
            "telefone",
            "email",
            "senha",
            "confirmarSenha",
            "aceitarTermos",
            "supabaseId",
            "tipoUsuario",
          ],
          properties: {
            nomeCompleto: { type: "string", example: "João da Silva" },
            documento: {
              type: "string",
              description: "CPF ou CNPJ",
              example: "12345678900",
            },
            telefone: {
              type: "string",
              example: "+55 11 99999-9999",
            },
            email: {
              type: "string",
              format: "email",
              example: "joao@example.com",
            },
            senha: { type: "string", format: "password", example: "senha123" },
            confirmarSenha: {
              type: "string",
              format: "password",
              example: "senha123",
            },
            aceitarTermos: { type: "boolean", example: true },
            supabaseId: {
              type: "string",
              description: "Identificador do usuário no Supabase",
              example: "uuid-supabase",
            },
            tipoUsuario: {
              type: "string",
              description: "Tipo do usuário",
              enum: ["PESSOA_FISICA", "PESSOA_JURIDICA"],
              example: "PESSOA_FISICA",
            },
          },
        },
        UserRegisterResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            usuario: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  example: "b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab",
                },
                email: {
                  type: "string",
                  format: "email",
                  example: "joao@example.com",
                },
                nomeCompleto: {
                  type: "string",
                  example: "João da Silva",
                },
              },
            },
          },
        },
        RefreshTokenRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: {
              type: "string",
              description: "Token de renovação válido",
              example: "<refresh-token>",
            },
          },
        },
        UserProfile: {
          type: "object",
          properties: {
            id: { type: "string", example: "b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab" },
            email: { type: "string", example: "joao@example.com" },
            nomeCompleto: { type: "string", example: "João da Silva" },
            role: {
              type: "string",
              description: "Role do usuário",
              example: "ADMIN",
            },
            tipoUsuario: {
              type: "string",
              example: "PESSOA_FISICA",
            },
            supabaseId: { type: "string", example: "uuid-supabase" },
            emailVerificado: { type: "boolean", example: true },
            ultimoLogin: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        RefreshTokenResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Token renovado com sucesso" },
            usuario: { $ref: "#/components/schemas/UserProfile" },
          },
        },
        LogoutResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Logout realizado" },
          },
        },
        BasicMessage: {
          type: "object",
          properties: {
            message: { type: "string", example: "OK" },
          },
        },
        ApiRootInfo: {
          type: "object",
          properties: {
            message: { type: "string", example: "Advance+ API" },
            version: { type: "string", example: "v3.0.3" },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            environment: { type: "string", example: "development" },
            status: { type: "string", example: "operational" },
            express_version: { type: "string", example: "4.x" },
            endpoints: {
              type: "object",
              additionalProperties: { type: "string" },
              example: {
                usuarios: "/api/v1/usuarios",
                mercadopago: "/api/v1/mercadopago",
                brevo: "/api/v1/brevo",
                website: "/api/v1/website",
                empresa: "/api/v1/empresa",
                audit: "/api/v1/audit",
                health: "/health",
              },
            },
          },
        },
        GlobalHealthStatus: {
          type: "object",
          properties: {
            status: { type: "string", example: "OK" },
            uptime: { type: "number", example: 1 },
            version: { type: "string", example: "v3.0.3" },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        AuditModuleInfo: {
          type: "object",
          properties: {
            message: { type: "string", example: "Audit Module API" },
            version: { type: "string", example: "v1" },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            endpoints: {
              type: "object",
              properties: {
                logs: { type: "string", example: "/logs" },
              },
            },
            status: { type: "string", example: "operational" },
          },
        },
        AuditLog: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab",
            },
            usuarioId: {
              type: "string",
              example: "usuario-uuid",
            },
            empresaId: {
              type: "string",
              nullable: true,
              example: "empresa-uuid",
            },
            acao: { type: "string", example: "CREATE_ORDER" },
            detalhes: {
              type: "object",
              nullable: true,
              example: { campo: "valor" },
            },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        AuditLogsResponse: {
          type: "object",
          properties: {
            logs: {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLog" },
            },
          },
        },
        MercadoPagoOrderRequest: {
          type: "object",
          properties: {
            total_amount: { type: "number", example: 100 },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", example: "1" },
                  title: { type: "string", example: "Produto" },
                  quantity: { type: "integer", example: 1 },
                  unit_price: { type: "number", example: 100 },
                  currency_id: { type: "string", example: "BRL" },
                },
              },
            },
            payments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  payment_method_id: { type: "string", example: "pix" },
                  payment_type_id: {
                    type: "string",
                    example: "instant_payment",
                  },
                  payer: {
                    type: "object",
                    properties: {
                      email: { type: "string", example: "user@example.com" },
                    },
                  },
                },
              },
            },
          },
        },
        MercadoPagoOrderResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Order criada com sucesso",
            },
            order: {
              type: "object",
              properties: {
                id: { type: "string", example: "123456" },
                status: { type: "string", example: "approved" },
                total_amount: { type: "number", example: 100 },
              },
            },
          },
        },
        MercadoPagoRefundRequest: {
          type: "object",
          properties: {
            amount: { type: "number", example: 100 },
            reason: { type: "string", example: "Produto defeituoso" },
          },
        },
        MercadoPagoRefundResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Reembolso processado com sucesso",
            },
            refund: {
              type: "object",
              properties: {
                id: { type: "string", example: "r123" },
                amount: { type: "number", example: 100 },
              },
            },
          },
        },
        MercadoPagoSubscriptionRequest: {
          type: "object",
          properties: {
            reason: { type: "string", example: "Plano Mensal" },
            payer_email: {
              type: "string",
              example: "user@example.com",
            },
            auto_recurring: {
              type: "object",
              properties: {
                frequency: { type: "integer", example: 1 },
                frequency_type: { type: "string", example: "months" },
                transaction_amount: { type: "number", example: 50 },
                currency_id: { type: "string", example: "BRL" },
              },
            },
          },
        },
        MercadoPagoSubscription: {
          type: "object",
          properties: {
            id: { type: "string", example: "sub_123" },
            status: { type: "string", example: "authorized" },
            reason: { type: "string", example: "Plano Mensal" },
          },
        },
        MercadoPagoSubscriptionResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Assinatura criada com sucesso",
            },
            subscription: { $ref: "#/components/schemas/MercadoPagoSubscription" },
          },
        },
        MercadoPagoSubscriptionListResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Lista de assinaturas",
            },
            subscriptions: {
              type: "array",
              items: { $ref: "#/components/schemas/MercadoPagoSubscription" },
            },
          },
        },
        MercadoPagoWebhookNotification: {
          type: "object",
          properties: {
            id: { type: "string", example: "123456789" },
            type: { type: "string", example: "payment" },
            action: { type: "string", example: "payment.created" },
            data: {
              type: "object",
              properties: {
                id: { type: "string", example: "999999" },
              },
            },
          },
        },
        BrevoModuleInfo: {
          type: "object",
          properties: {
            module: {
              type: "string",
              example: "Brevo Communication Module",
            },
            version: { type: "string", example: "7.3.0" },
            description: {
              type: "string",
              example: "Sistema completo de comunicação e verificação de email",
            },
            status: { type: "string", example: "active" },
            configured: { type: "boolean", example: true },
            simulated: { type: "boolean", example: false },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        BrevoHealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "healthy" },
            module: { type: "string", example: "brevo" },
            configured: { type: "boolean", example: true },
            simulated: { type: "boolean", example: false },
            operational: { type: "boolean", example: true },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            services: {
              type: "object",
              properties: {
                email: { type: "string", example: "operational" },
                sms: { type: "string", example: "operational" },
                client: { type: "string", example: "operational" },
              },
            },
          },
        },
        BrevoConfigStatus: {
          type: "object",
          properties: {
            module: { type: "string", example: "Brevo Configuration Status" },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            configuration: {
              type: "object",
              properties: {
                isConfigured: { type: "boolean", example: true },
                environment: { type: "string", example: "development" },
                apiKeyProvided: { type: "boolean", example: true },
                fromEmailConfigured: { type: "boolean", example: true },
                fromName: { type: "string", example: "Advance+" },
              },
            },
            emailVerification: {
              type: "object",
              properties: {
                enabled: { type: "boolean", example: true },
                tokenExpirationHours: { type: "integer", example: 24 },
              },
            },
            client: {
              type: "object",
              properties: {
                operational: { type: "boolean", example: true },
                simulated: { type: "boolean", example: false },
              },
            },
          },
        },
        BrevoVerifyEmailResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Email verificado com sucesso",
            },
            redirectUrl: {
              type: "string",
              example: "https://app.advance.com.br",
            },
            userId: {
              type: "string",
              example: "b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab",
            },
          },
        },
        BrevoResendVerificationRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
          },
        },
        BrevoResendVerificationResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Email de verificação reenviado com sucesso",
            },
            simulated: { type: "boolean", example: false },
            messageId: { type: "string", example: "msg_123" },
          },
        },
        BrevoVerificationStatusResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                userId: {
                  type: "string",
                  example: "b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab",
                },
                email: { type: "string", example: "user@example.com" },
                emailVerified: { type: "boolean", example: false },
                accountStatus: { type: "string", example: "ATIVO" },
                hasValidToken: { type: "boolean", example: true },
                tokenExpiration: {
                  type: "string",
                  format: "date-time",
                  example: "2024-01-01T12:00:00Z",
                },
              },
            },
          },
        },
        BrevoTestEmailRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            name: { type: "string", example: "Usuário Teste" },
            type: { type: "string", example: "welcome" },
          },
        },
        BrevoTestEmailResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Teste de email welcome executado",
            },
            data: {
              type: "object",
              properties: {
                type: { type: "string", example: "welcome" },
                recipient: { type: "string", example: "user@example.com" },
                simulated: { type: "boolean", example: false },
                messageId: { type: "string", example: "msg_123" },
              },
            },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        BrevoTestSMSRequest: {
          type: "object",
          required: ["to"],
          properties: {
            to: { type: "string", example: "+55 11 99999-9999" },
            message: {
              type: "string",
              example: "Teste de SMS do Advance+ - Sistema funcionando!",
            },
          },
        },
        BrevoTestSMSResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Teste de SMS executado" },
            data: {
              type: "object",
              properties: {
                recipient: {
                  type: "string",
                  example: "+55 11 99999-9999",
                },
                message: {
                  type: "string",
                  example: "Teste de SMS do Advance+ - Sistema funcionando!",
                },
                simulated: { type: "boolean", example: false },
                messageId: { type: "string", example: "sms_123" },
              },
            },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        EmpresaPlan: {
          type: "object",
          properties: {
            id: { type: "string", example: "plan-uuid" },
            nome: { type: "string", example: "Plano Básico" },
            valor: { type: "number", example: 49.9 },
            descricao: { type: "string", example: "Acesso básico" },
            recursos: {
              type: "array",
              items: { type: "string" },
              example: ["feature1", "feature2"],
            },
            ativo: { type: "boolean", example: true },
            mercadoPagoPlanId: {
              type: "string",
              nullable: true,
              example: "mp-plan-123",
            },
            frequency: { type: "integer", example: 1 },
            frequencyType: {
              type: "string",
              enum: ["DIAS", "MESES"],
              example: "MESES",
            },
            repetitions: { type: "integer", nullable: true, example: null },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        EmpresaPlanCreateRequest: {
          type: "object",
          required: [
            "nome",
            "valor",
            "descricao",
            "recursos",
            "frequency",
            "frequencyType",
          ],
          properties: {
            nome: { type: "string", example: "Plano Básico" },
            valor: { type: "number", example: 49.9 },
            descricao: { type: "string", example: "Acesso básico" },
            recursos: {
              type: "array",
              items: { type: "string" },
              example: ["feature1", "feature2"],
            },
            mercadoPagoPlanId: {
              type: "string",
              nullable: true,
              example: "mp-plan-123",
            },
            frequency: { type: "integer", example: 1 },
            frequencyType: {
              type: "string",
              enum: ["DIAS", "MESES"],
              example: "MESES",
            },
            repetitions: { type: "integer", nullable: true, example: null },
          },
        },
        EmpresaPlanUpdateRequest: {
          type: "object",
          properties: {
            nome: { type: "string", example: "Plano Atualizado" },
            valor: { type: "number", example: 59.9 },
            descricao: { type: "string", example: "Descrição" },
            recursos: {
              type: "array",
              items: { type: "string" },
            },
            ativo: { type: "boolean", example: true },
            mercadoPagoPlanId: {
              type: "string",
              nullable: true,
              example: "mp-plan-123",
            },
            frequency: { type: "integer", example: 1 },
            frequencyType: {
              type: "string",
              enum: ["DIAS", "MESES"],
              example: "MESES",
            },
            repetitions: { type: "integer", nullable: true, example: null },
          },
        },
        EmpresaPlanCreateResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Plano criado" },
            plan: { $ref: "#/components/schemas/EmpresaPlan" },
          },
        },
        EmpresaPlanUpdateResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Plano atualizado" },
            plan: { $ref: "#/components/schemas/EmpresaPlan" },
          },
        },
        EmpresaPlansResponse: {
          type: "object",
          properties: {
            plans: {
              type: "array",
              items: { $ref: "#/components/schemas/EmpresaPlan" },
            },
          },
        },
        EmpresaPlanAssignRequest: {
          type: "object",
          required: ["empresaId", "metodoPagamento"],
          properties: {
            empresaId: { type: "string", example: "empresa-uuid" },
            metodoPagamento: {
              type: "string",
              enum: [
                "PIX",
                "BOLETO",
                "CARTAO_CREDITO",
                "CARTAO_DEBITO",
                "DINHEIRO",
              ],
              example: "PIX",
            },
            tipo: {
              type: "string",
              enum: ["STANDARD", "PARTNER"],
              example: "STANDARD",
            },
            validade: {
              type: "string",
              enum: [
                "DIAS_15",
                "DIAS_30",
                "DIAS_90",
                "DIAS_120",
                "SEM_VALIDADE",
              ],
              nullable: true,
              example: "DIAS_30",
            },
          },
        },
        EmpresaPlanAssignment: {
          type: "object",
          properties: {
            id: { type: "string", example: "assignment-uuid" },
            empresaId: { type: "string", example: "empresa-uuid" },
            planoId: { type: "string", example: "plan-uuid" },
            metodoPagamento: {
              type: "string",
              enum: [
                "PIX",
                "BOLETO",
                "CARTAO_CREDITO",
                "CARTAO_DEBITO",
                "DINHEIRO",
              ],
              example: "PIX",
            },
            tipo: {
              type: "string",
              enum: ["STANDARD", "PARTNER"],
              example: "STANDARD",
            },
            validade: {
              type: "string",
              enum: [
                "DIAS_15",
                "DIAS_30",
                "DIAS_90",
                "DIAS_120",
                "SEM_VALIDADE",
              ],
              nullable: true,
              example: "DIAS_30",
            },
            inicio: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            fim: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: "2024-02-01T12:00:00Z",
            },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        EmpresaPlanAssignResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Plano vinculado à empresa",
            },
            empresaPlano: {
              $ref: "#/components/schemas/EmpresaPlanAssignment",
            },
          },
        },
        EmpresaPlanUnassignResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Plano desvinculado da empresa",
            },
          },
        },
        WebsiteModuleInfo: {
          type: "object",
          properties: {
            message: { type: "string", example: "Website Module API" },
            version: { type: "string", example: "v1" },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            endpoints: {
              type: "object",
              properties: {
                sobre: { type: "string", example: "/sobre" },
                slider: { type: "string", example: "/slider" },
                banner: { type: "string", example: "/banner" },
                logoEnterprises: {
                  type: "string",
                  example: "/logo-enterprises",
                },
                consultoria: { type: "string", example: "/consultoria" },
                recrutamento: { type: "string", example: "/recrutamento" },
                sobreEmpresa: { type: "string", example: "/sobre-empresa" },
                team: { type: "string", example: "/team" },
                diferenciais: { type: "string", example: "/diferenciais" },
              },
            },
            status: { type: "string", example: "operational" },
          },
        },
        WebsiteBanner: {
          type: "object",
          properties: {
            id: { type: "string", example: "banner-uuid" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/banner.jpg",
            },
            imagemTitulo: { type: "string", example: "banner" },
            link: {
              type: "string",
              nullable: true,
              example: "https://example.com",
            },
            ordem: { type: "integer", example: 1 },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteBannerCreateInput: {
          type: "object",
          properties: {
            imagem: {
              type: "string",
              format: "binary",
              description: "Arquivo de imagem do banner",
            },
            imagemUrl: {
              type: "string",
              format: "uri",
              description: "URL alternativa da imagem",
              example: "https://cdn.example.com/banner.jpg",
            },
            link: {
              type: "string",
              description: "Link de redirecionamento",
              example: "https://example.com",
            },
            ordem: {
              type: "integer",
              description: "Ordem de exibição",
              example: 1,
            },
          },
        },
        WebsiteBannerUpdateInput: {
          type: "object",
          properties: {
            imagem: { type: "string", format: "binary" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/banner.jpg",
            },
            link: { type: "string", example: "https://example.com" },
            ordem: { type: "integer", example: 2 },
          },
        },
        WebsiteLogoEnterprise: {
          type: "object",
          properties: {
            id: { type: "string", example: "logo-uuid" },
            nome: { type: "string", example: "Empresa X" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/logo.png",
            },
            imagemAlt: { type: "string", example: "Logo da Empresa X" },
            website: { type: "string", example: "https://empresa.com" },
            categoria: { type: "string", example: "tecnologia" },
            ordem: { type: "integer", example: 1 },
            ativo: { type: "boolean", example: true },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteLogoEnterpriseCreateInput: {
          type: "object",
          required: ["nome", "website", "categoria"],
          properties: {
            nome: { type: "string", example: "Empresa X" },
            website: { type: "string", example: "https://empresa.com" },
            categoria: { type: "string", example: "tecnologia" },
            ordem: { type: "integer", example: 1 },
            ativo: { type: "boolean", example: true },
            imagemAlt: { type: "string", example: "Logo da Empresa X" },
            imagem: {
              type: "string",
              format: "binary",
              description: "Arquivo de imagem do logo",
            },
            imagemUrl: {
              type: "string",
              format: "uri",
              description: "URL alternativa da imagem",
              example: "https://cdn.example.com/logo.png",
            },
          },
        },
        WebsiteLogoEnterpriseUpdateInput: {
          type: "object",
          properties: {
            nome: { type: "string", example: "Empresa X" },
            website: { type: "string", example: "https://empresa.com" },
            categoria: { type: "string", example: "tecnologia" },
            ordem: { type: "integer", example: 2 },
            ativo: { type: "boolean", example: true },
            imagemAlt: { type: "string", example: "Logo da Empresa X" },
            imagem: { type: "string", format: "binary" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/logo.png",
            },
          },
        },
        WebsiteSlider: {
          type: "object",
          properties: {
            id: { type: "string", example: "slider-uuid" },
            sliderName: { type: "string", example: "Banner Principal" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/slide.jpg",
            },
            link: { type: "string", nullable: true, example: "https://example.com" },
            orientacao: {
              type: "string",
              enum: ["DESKTOP", "TABLET_MOBILE"],
              example: "DESKTOP",
            },
            status: {
              type: "string",
              enum: ["PUBLICADO", "RASCUNHO"],
              example: "PUBLICADO",
            },
            ordem: { type: "integer", example: 1 },
            ordemId: { type: "string", example: "ordem-uuid" },
            ordemCriadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteSliderCreateInput: {
          type: "object",
          properties: {
            imagem: {
              type: "string",
              format: "binary",
              description: "Arquivo de imagem do slider",
            },
            imagemUrl: {
              type: "string",
              format: "uri",
              description: "URL alternativa da imagem",
              example: "https://cdn.example.com/slide.jpg",
            },
            sliderName: { type: "string", example: "Banner Principal" },
            link: { type: "string", example: "https://example.com" },
            orientacao: {
              type: "string",
              enum: ["DESKTOP", "TABLET_MOBILE"],
              example: "DESKTOP",
            },
            status: {
              type: "string",
              enum: ["PUBLICADO", "RASCUNHO"],
              example: "PUBLICADO",
            },
          },
        },
        WebsiteSliderUpdateInput: {
          type: "object",
          properties: {
            imagem: { type: "string", format: "binary" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/slide.jpg",
            },
            sliderName: { type: "string", example: "Banner Atualizado" },
            link: { type: "string", example: "https://example.com" },
            orientacao: {
              type: "string",
              enum: ["DESKTOP", "TABLET_MOBILE"],
              example: "TABLET_MOBILE",
            },
            status: {
              type: "string",
              enum: ["PUBLICADO", "RASCUNHO"],
              example: "RASCUNHO",
            },
            ordem: {
              type: "integer",
              example: 2,
              description:
                "Nova posição do slider; ao mudar este valor os demais serão reordenados automaticamente",
            },
          },
        },
        WebsiteSobre: {
          type: "object",
          properties: {
            id: { type: "string", example: "sobre-uuid" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/sobre.jpg",
            },
            imagemTitulo: { type: "string", example: "sobre" },
            titulo: { type: "string", example: "Quem somos" },
            descricao: {
              type: "string",
              example: "Descrição sobre a empresa",
            },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteSobreCreateInput: {
          type: "object",
          required: ["titulo", "descricao"],
          properties: {
            titulo: { type: "string", example: "Quem somos" },
            descricao: {
              type: "string",
              example: "Descrição sobre a empresa",
            },
            imagem: {
              type: "string",
              format: "binary",
              description: "Arquivo de imagem do conteúdo",
            },
            imagemUrl: {
              type: "string",
              format: "uri",
              description: "URL alternativa da imagem",
              example: "https://cdn.example.com/sobre.jpg",
            },
          },
        },
        WebsiteSobreUpdateInput: {
          type: "object",
          properties: {
            titulo: { type: "string", example: "Quem somos" },
            descricao: {
              type: "string",
              example: "Descrição atualizada",
            },
            imagem: { type: "string", format: "binary" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/sobre.jpg",
            },
          },
        },
        WebsiteConsultoria: {
          type: "object",
          properties: {
            id: { type: "string", example: "consultoria-uuid" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/consultoria.jpg",
            },
            imagemTitulo: { type: "string", example: "consultoria" },
            titulo: { type: "string", example: "Serviços de Consultoria" },
            descricao: {
              type: "string",
              example: "Descrição sobre consultoria",
            },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteConsultoriaCreateInput: {
          type: "object",
          required: ["titulo", "descricao"],
          properties: {
            titulo: {
              type: "string",
              example: "Serviços de Consultoria",
            },
            descricao: {
              type: "string",
              example: "Descrição sobre consultoria",
            },
            imagem: {
              type: "string",
              format: "binary",
              description: "Arquivo de imagem do conteúdo",
            },
            imagemUrl: {
              type: "string",
              format: "uri",
              description: "URL alternativa da imagem",
              example: "https://cdn.example.com/consultoria.jpg",
            },
          },
        },
        WebsiteConsultoriaUpdateInput: {
          type: "object",
          properties: {
            titulo: {
              type: "string",
              example: "Serviços de Consultoria",
            },
            descricao: {
              type: "string",
              example: "Descrição atualizada",
            },
            imagem: { type: "string", format: "binary" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/consultoria.jpg",
            },
          },
        },
        WebsiteRecrutamento: {
          type: "object",
          properties: {
            id: { type: "string", example: "recrutamento-uuid" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/recrutamento.jpg",
            },
            imagemTitulo: { type: "string", example: "recrutamento" },
            titulo: { type: "string", example: "Serviços de Recrutamento" },
            descricao: {
              type: "string",
              example: "Descrição sobre recrutamento",
            },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteRecrutamentoCreateInput: {
          type: "object",
          required: ["titulo", "descricao"],
          properties: {
            titulo: {
              type: "string",
              example: "Serviços de Recrutamento",
            },
            descricao: {
              type: "string",
              example: "Descrição sobre recrutamento",
            },
            imagem: {
              type: "string",
              format: "binary",
              description: "Arquivo de imagem do conteúdo",
            },
            imagemUrl: {
              type: "string",
              format: "uri",
              description: "URL alternativa da imagem",
              example: "https://cdn.example.com/recrutamento.jpg",
            },
          },
        },
        WebsiteRecrutamentoUpdateInput: {
          type: "object",
          properties: {
            titulo: {
              type: "string",
              example: "Serviços de Recrutamento",
            },
            descricao: {
              type: "string",
              example: "Descrição atualizada",
            },
            imagem: { type: "string", format: "binary" },
            imagemUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/recrutamento.jpg",
            },
          },
        },
        WebsiteSobreEmpresa: {
          type: "object",
          properties: {
            id: { type: "string", example: "sobreempresa-uuid" },
            titulo: { type: "string", example: "Sobre a Empresa" },
            descricao: {
              type: "string",
              example: "Descrição sobre a empresa",
            },
            descricaoVisao: {
              type: "string",
              example: "Nossa visão",
            },
            descricaoMissao: {
              type: "string",
              example: "Nossa missão",
            },
            descricaoValores: {
              type: "string",
              example: "Nossos valores",
            },
            videoUrl: {
              type: "string",
              format: "uri",
              example: "https://example.com/video",
            },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteSobreEmpresaCreateInput: {
          type: "object",
          required: [
            "titulo",
            "descricao",
            "descricaoVisao",
            "descricaoMissao",
            "descricaoValores",
            "videoUrl",
          ],
          properties: {
            titulo: { type: "string", example: "Sobre a Empresa" },
            descricao: {
              type: "string",
              example: "Descrição sobre a empresa",
            },
            descricaoVisao: {
              type: "string",
              example: "Nossa visão",
            },
            descricaoMissao: {
              type: "string",
              example: "Nossa missão",
            },
            descricaoValores: {
              type: "string",
              example: "Nossos valores",
            },
            videoUrl: {
              type: "string",
              format: "uri",
              example: "https://example.com/video",
            },
          },
        },
        WebsiteSobreEmpresaUpdateInput: {
          type: "object",
          properties: {
            titulo: { type: "string", example: "Sobre a Empresa" },
            descricao: {
              type: "string",
              example: "Descrição sobre a empresa",
            },
            descricaoVisao: {
              type: "string",
              example: "Nossa visão",
            },
            descricaoMissao: {
              type: "string",
              example: "Nossa missão",
            },
            descricaoValores: {
              type: "string",
              example: "Nossos valores",
            },
            videoUrl: {
              type: "string",
              format: "uri",
              example: "https://example.com/video",
            },
          },
        },
        WebsiteTeam: {
          type: "object",
          properties: {
            id: { type: "string", example: "team-uuid" },
            photoUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/team.jpg",
            },
            nome: { type: "string", example: "Fulano" },
            cargo: { type: "string", example: "Desenvolvedor" },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteTeamCreateInput: {
          type: "object",
          required: ["nome", "cargo"],
          properties: {
            nome: { type: "string", example: "Fulano" },
            cargo: { type: "string", example: "Desenvolvedor" },
            photo: {
              type: "string",
              format: "binary",
              description: "Arquivo de imagem do membro",
            },
            photoUrl: {
              type: "string",
              format: "uri",
              description: "URL alternativa da imagem",
              example: "https://cdn.example.com/team.jpg",
            },
          },
        },
        WebsiteTeamUpdateInput: {
          type: "object",
          properties: {
            nome: { type: "string", example: "Fulano" },
            cargo: { type: "string", example: "Desenvolvedor" },
            photo: { type: "string", format: "binary" },
            photoUrl: {
              type: "string",
              format: "uri",
              example: "https://cdn.example.com/team.jpg",
            },
          },
        },
        WebsiteDiferenciais: {
          type: "object",
          properties: {
            id: { type: "string", example: "diferenciais-uuid" },
            icone1: { type: "string", example: "icon1" },
            titulo1: { type: "string", example: "Título 1" },
            descricao1: { type: "string", example: "Descrição 1" },
            icone2: { type: "string", example: "icon2" },
            titulo2: { type: "string", example: "Título 2" },
            descricao2: { type: "string", example: "Descrição 2" },
            icone3: { type: "string", example: "icon3" },
            titulo3: { type: "string", example: "Título 3" },
            descricao3: { type: "string", example: "Descrição 3" },
            icone4: { type: "string", example: "icon4" },
            titulo4: { type: "string", example: "Título 4" },
            descricao4: { type: "string", example: "Descrição 4" },
            titulo: { type: "string", example: "Nossos Diferenciais" },
            descricao: {
              type: "string",
              example: "Texto geral dos diferenciais",
            },
            botaoUrl: {
              type: "string",
              format: "uri",
              example: "https://example.com",
            },
            botaoLabel: { type: "string", example: "Saiba mais" },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            atualizadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        WebsiteDiferenciaisCreateInput: {
          type: "object",
          required: [
            "icone1",
            "titulo1",
            "descricao1",
            "icone2",
            "titulo2",
            "descricao2",
            "icone3",
            "titulo3",
            "descricao3",
            "icone4",
            "titulo4",
            "descricao4",
            "titulo",
            "descricao",
            "botaoUrl",
            "botaoLabel",
          ],
          properties: {
            icone1: { type: "string", example: "icon1" },
            titulo1: { type: "string", example: "Título 1" },
            descricao1: { type: "string", example: "Descrição 1" },
            icone2: { type: "string", example: "icon2" },
            titulo2: { type: "string", example: "Título 2" },
            descricao2: { type: "string", example: "Descrição 2" },
            icone3: { type: "string", example: "icon3" },
            titulo3: { type: "string", example: "Título 3" },
            descricao3: { type: "string", example: "Descrição 3" },
            icone4: { type: "string", example: "icon4" },
            titulo4: { type: "string", example: "Título 4" },
            descricao4: { type: "string", example: "Descrição 4" },
            titulo: { type: "string", example: "Nossos Diferenciais" },
            descricao: { type: "string", example: "Texto geral" },
            botaoUrl: {
              type: "string",
              format: "uri",
              example: "https://example.com",
            },
            botaoLabel: { type: "string", example: "Saiba mais" },
          },
        },
        WebsiteDiferenciaisUpdateInput: {
          type: "object",
          properties: {
            icone1: { type: "string", example: "icon1" },
            titulo1: { type: "string", example: "Título 1" },
            descricao1: { type: "string", example: "Descrição 1" },
            icone2: { type: "string", example: "icon2" },
            titulo2: { type: "string", example: "Título 2" },
            descricao2: { type: "string", example: "Descrição 2" },
            icone3: { type: "string", example: "icon3" },
            titulo3: { type: "string", example: "Título 3" },
            descricao3: { type: "string", example: "Descrição 3" },
            icone4: { type: "string", example: "icon4" },
            titulo4: { type: "string", example: "Título 4" },
            descricao4: { type: "string", example: "Descrição 4" },
            titulo: { type: "string", example: "Nossos Diferenciais" },
            descricao: { type: "string", example: "Texto geral" },
            botaoUrl: {
              type: "string",
              format: "uri",
              example: "https://example.com",
            },
            botaoLabel: { type: "string", example: "Saiba mais" },
          },
        },
        AdminModuleInfo: {
          type: "object",
          properties: {
            message: { type: "string", example: "Área administrativa" },
            usuario: { $ref: "#/components/schemas/UserProfile" },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            permissions: {
              type: "array",
              items: { type: "string" },
              example: ["read", "write"],
            },
          },
        },
        AdminUserSummary: {
          type: "object",
          properties: {
            id: { type: "string", example: "user-uuid" },
            email: { type: "string", example: "user@example.com" },
            nomeCompleto: { type: "string", example: "João da Silva" },
            role: { type: "string", example: "ALUNO" },
            status: { type: "string", example: "ATIVO" },
            tipoUsuario: { type: "string", example: "ALUNO" },
            criadoEm: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
            ultimoLogin: {
              type: "string",
              format: "date-time",
              example: "2024-01-10T12:00:00Z",
            },
            _count: {
              type: "object",
              properties: {
                mercadoPagoOrders: { type: "integer", example: 3 },
                mercadoPagoSubscriptions: { type: "integer", example: 1 },
              },
            },
          },
        },
        AdminUserListResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Lista de usuários" },
            usuarios: {
              type: "array",
              items: { $ref: "#/components/schemas/AdminUserSummary" },
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer", example: 1 },
                limit: { type: "integer", example: 50 },
                total: { type: "integer", example: 100 },
                pages: { type: "integer", example: 2 },
              },
            },
          },
        },
        AdminUserDetail: {
          allOf: [
            { $ref: "#/components/schemas/AdminUserSummary" },
            {
              type: "object",
              properties: {
                cpf: { type: "string", example: "12345678900" },
                cnpj: { type: "string", example: "12345678000199" },
                telefone: { type: "string", example: "+55 11 99999-0000" },
                dataNasc: {
                  type: "string",
                  format: "date",
                  example: "1990-01-01",
                },
                genero: { type: "string", example: "MASCULINO" },
                matricula: { type: "string", example: "MAT123" },
                supabaseId: { type: "string", example: "uuid-supabase" },
                empresa: {
                  type: "object",
                  properties: {
                    id: { type: "string", example: "emp-1" },
                    nome: { type: "string", example: "Empresa XYZ" },
                  },
                },
                enderecos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "end-1" },
                      logradouro: { type: "string", example: "Rua A" },
                      numero: { type: "string", example: "100" },
                      bairro: { type: "string", example: "Centro" },
                      cidade: { type: "string", example: "São Paulo" },
                      estado: { type: "string", example: "SP" },
                      cep: { type: "string", example: "01000-000" },
                    },
                  },
                },
                mercadoPagoOrders: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "order-1" },
                      mercadoPagoOrderId: {
                        type: "string",
                        example: "123456",
                      },
                      status: { type: "string", example: "paid" },
                      totalAmount: { type: "number", example: 100 },
                      paidAmount: { type: "number", example: 100 },
                      criadoEm: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-01T12:00:00Z",
                      },
                    },
                  },
                },
                mercadoPagoSubscriptions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "sub-1" },
                      mercadoPagoSubscriptionId: {
                        type: "string",
                        example: "7890",
                      },
                      status: { type: "string", example: "authorized" },
                      reason: { type: "string", example: "Plano premium" },
                      transactionAmount: { type: "number", example: 99.9 },
                      criadoEm: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-01T12:00:00Z",
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        AdminUserDetailResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Usuário encontrado" },
            usuario: { $ref: "#/components/schemas/AdminUserDetail" },
          },
        },
        AdminPaymentHistoryResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Histórico de pagamentos do usuário",
            },
            data: {
              type: "object",
              properties: {
                orders: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "order-1" },
                      status: { type: "string", example: "paid" },
                      totalAmount: { type: "number", example: 100 },
                      paidAmount: { type: "number", example: 100 },
                      criadoEm: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-01T12:00:00Z",
                      },
                    },
                  },
                },
                subscriptions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "sub-1" },
                      status: { type: "string", example: "authorized" },
                      reason: { type: "string", example: "Plano premium" },
                      transactionAmount: { type: "number", example: 99.9 },
                      criadoEm: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-01T12:00:00Z",
                      },
                    },
                  },
                },
                refunds: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "ref-1" },
                      amount: { type: "number", example: 10 },
                      status: { type: "string", example: "refunded" },
                      reason: { type: "string", example: "Produto" },
                      criadoEm: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-01T12:00:00Z",
                      },
                    },
                  },
                },
                summary: {
                  type: "object",
                  properties: {
                    totalOrders: { type: "integer", example: 5 },
                    totalSubscriptions: { type: "integer", example: 1 },
                    totalRefunds: { type: "integer", example: 0 },
                    totalPaid: { type: "number", example: 500 },
                    totalRefunded: { type: "number", example: 0 },
                  },
                },
                pagination: {
                  type: "object",
                  properties: {
                    page: { type: "integer", example: 1 },
                    limit: { type: "integer", example: 20 },
                    total: { type: "integer", example: 20 },
                    pages: { type: "integer", example: 1 },
                  },
                },
              },
            },
          },
        },
        AdminStatusUpdateRequest: {
          type: "object",
          properties: {
            status: { type: "string", example: "ATIVO" },
            motivo: { type: "string", example: "Regularização" },
          },
          required: ["status"],
        },
        AdminStatusUpdateResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Status do usuário atualizado com sucesso",
            },
            usuario: { $ref: "#/components/schemas/AdminUserSummary" },
            statusAnterior: { type: "string", example: "SUSPENSO" },
          },
        },
        AdminRoleUpdateRequest: {
          type: "object",
          properties: {
            role: { type: "string", example: "MODERADOR" },
            motivo: { type: "string", example: "Promoção" },
          },
          required: ["role"],
        },
        AdminRoleUpdateResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Role do usuário atualizada com sucesso",
            },
            usuario: { $ref: "#/components/schemas/AdminUserSummary" },
          },
        },
        UserCoursePaymentRequest: {
          type: "object",
          properties: {
            cursoId: { type: "string", example: "curso-uuid" },
            paymentToken: { type: "string", example: "tok_123" },
            paymentMethodId: { type: "string", example: "visa" },
            installments: { type: "integer", example: 1 },
            issuerId: { type: "string", example: "issuer" },
          },
          required: ["cursoId", "paymentToken", "paymentMethodId"],
        },
        UserCoursePaymentResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Pagamento iniciado com sucesso",
            },
            order: {
              type: "object",
              properties: {
                id: { type: "string", example: "123" },
                status: { type: "string", example: "pending" },
              },
            },
            curso: {
              type: "object",
              properties: {
                id: { type: "string", example: "curso-uuid" },
                titulo: { type: "string", example: "Curso X" },
                preco: { type: "number", example: 100 },
              },
            },
          },
        },
        UserSubscriptionCreateRequest: {
          type: "object",
          properties: {
            plano: { type: "string", example: "plano-premium" },
            cardToken: { type: "string", example: "tok_123" },
            frequencia: { type: "integer", example: 1 },
            periodo: { type: "string", example: "months" },
          },
          required: ["plano", "cardToken"],
        },
        UserSubscriptionCreateResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Assinatura criada" },
            subscription: {
              type: "object",
              properties: {
                id: { type: "string", example: "sub-123" },
                status: { type: "string", example: "authorized" },
              },
            },
          },
        },
        UserSubscriptionCancelRequest: {
          type: "object",
          properties: {
            subscriptionId: { type: "string", example: "sub-123" },
            motivo: { type: "string", example: "Opção do usuário" },
          },
          required: ["subscriptionId"],
        },
        UserSubscriptionCancelResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Assinatura cancelada" },
          },
        },
        UserPaymentHistoryResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Histórico de pagamentos" },
            orders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", example: "order-1" },
                  status: { type: "string", example: "paid" },
                  totalAmount: { type: "number", example: 100 },
                  criadoEm: {
                    type: "string",
                    format: "date-time",
                    example: "2024-01-01T12:00:00Z",
                  },
                },
              },
            },
            subscriptions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", example: "sub-1" },
                  status: { type: "string", example: "authorized" },
                  transactionAmount: { type: "number", example: 99.9 },
                  criadoEm: {
                    type: "string",
                    format: "date-time",
                    example: "2024-01-01T12:00:00Z",
                  },
                },
              },
            },
          },
        },
        DashboardStatsResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Estatísticas do dashboard" },
            stats: {
              type: "object",
              additionalProperties: true,
              example: { usuariosTotais: 100, receitaTotal: 1000 },
            },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        UserStatsResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Estatísticas de usuários" },
            stats: {
              type: "object",
              additionalProperties: true,
              example: { novosUsuarios: 10 },
            },
            periodo: { type: "string", example: "30d" },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
        PaymentStatsResponse: {
          type: "object",
          properties: {
            message: { type: "string", example: "Estatísticas de pagamentos" },
            stats: {
              type: "object",
              additionalProperties: true,
              example: { totalPagamentos: 100, totalReceita: 5000 },
            },
            periodo: { type: "string", example: "30d" },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T12:00:00Z",
            },
          },
        },
      },
      responses: {},
      parameters: {},
      examples: {},
      requestBodies: {},
      headers: {},
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      links: {},
      callbacks: {},
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Servidor de desenvolvimento",
      },
    ],
  },
  apis: ["./src/routes/**/*.ts", "./src/modules/**/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  const swaggerServeHandlers = swaggerUi.serve as RequestHandler[];

  app.get("/swagger-custom.js", (req, res) => {
    res
      .type("application/javascript")
      .send(
        fs.readFileSync(path.join(__dirname, "swagger-custom.js"), "utf8")
      );
  });

  app.get("/swagger-custom.css", (req, res) => {
    res
      .type("text/css")
      .send(
        fs.readFileSync(path.join(__dirname, "swagger-custom.css"), "utf8")
      );
  });

  app.use(
    "/docs",
    (req, res, next) => {
      if (req.path === "/login") return next();
      return supabaseAuthMiddleware(["ADMIN"])(req, res, next);
    },
    ...swaggerServeHandlers.map(
      (handler): RequestHandler =>
        (req, res, next) => {
          if (req.path === "/login") return next();
          return handler(req, res, next);
        }
    ),
    ((req, res, next) => {
      if (req.path === "/login") return next();
      return swaggerUi.setup(swaggerSpec, {
        customJs: "/swagger-custom.js",
        customCssUrl: "/swagger-custom.css",
        swaggerOptions: {
          layout: "BaseLayout",
        },
      })(req, res, next);
    }) as RequestHandler
  );

  app.get(
    "/docs.json",
    supabaseAuthMiddleware(["ADMIN"]),
    (req, res) => res.json(swaggerSpec)
  );

  app.get(
    "/redoc",
    supabaseAuthMiddleware(["ADMIN"]),
    (req, res) => {
      res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>Advance+ API - ReDoc</title>
    <meta charset="utf-8" />
    <style>body { margin: 0; padding: 0; }</style>
    <link rel="icon" href="data:," />
  </head>
  <body>
    <redoc spec-url="/docs.json"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
  </body>
</html>`);
    }
  );
}
