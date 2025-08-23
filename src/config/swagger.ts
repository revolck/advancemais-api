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
        name: "Usuários",
        description:
          "Gerenciamento de contas e autenticação: registro, login, refresh, logout, perfil e recuperação de senha",
      },
      { name: "MercadoPago", description: "Integração de pagamentos" },
      { name: "Audit", description: "Registros de auditoria" },
      { name: "Brevo", description: "Serviços de e-mail" },
      { name: "Empresa", description: "Gestão de planos de empresa" },
      { name: "Website", description: "Conteúdo público do site" },
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
