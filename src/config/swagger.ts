import type { Application, RequestHandler } from 'express';
import swaggerJsdoc, { Options } from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { supabaseAuthMiddleware } from '../modules/usuarios/auth';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Advance+ API',
      version: '1.0.0',
      description:
        'Documentação detalhada da API Advance+. Todas as rotas protegidas exigem o header `Authorization: Bearer <token>` obtido via login. O acesso ao Swagger é restrito a administradores.',
    },
    tags: [
      {
        name: 'Default',
        description: 'Endpoints públicos da API',
      },
      { name: 'Brevo', description: 'Serviços de e-mail' },
      {
        name: 'Usuários',
        description:
          'Gerenciamento de contas e autenticação: registro, login, refresh, logout, perfil e recuperação de senha',
      },
      {
        name: 'Usuários - Admin',
        description: 'Gestão administrativa de usuários',
      },
      {
        name: 'Usuários - Stats',
        description: 'Métricas e relatórios de usuários',
      },
      { name: 'Website', description: 'Conteúdo público do site' },
      { name: 'Website - Banner', description: 'Gestão de banners' },
      { name: 'Website - LogoEnterprises', description: 'Logos de empresas' },
      { name: 'Website - Slider', description: 'Gestão de sliders' },
      { name: 'Website - Sobre', description: 'Conteúdos "Sobre"' },
      {
        name: 'Website - Consultoria',
        description: 'Conteúdos "Consultoria"',
      },
      {
        name: 'Website - Recrutamento',
        description: 'Conteúdos "Recrutamento"',
      },
      {
        name: 'Website - SobreEmpresa',
        description: 'Conteúdos "Sobre Empresa"',
      },
      {
        name: 'Website - Team',
        description: 'Conteúdos "Team"',
      },
      {
        name: 'Website - Depoimentos',
        description: 'Conteúdos "Depoimentos"',
      },
      {
        name: 'Website - Diferenciais',
        description: 'Conteúdos "Diferenciais"',
      },
      {
        name: 'Website - Planinhas',
        description: 'Conteúdos "Planinhas"',
      },
      {
        name: 'Website - Advance Ajuda',
        description: 'Conteúdos "Advance Ajuda"',
      },
      {
        name: 'Website - RecrutamentoSelecao',
        description: 'Conteúdos "RecrutamentoSelecao"',
      },
      {
        name: 'Website - Sistema',
        description: 'Conteúdos "Sistema"',
      },
      {
        name: 'Website - TreinamentoCompany',
        description: 'Conteúdos "TreinamentoCompany"',
      },
      {
        name: 'Website - ConexaoForte',
        description: 'Conteúdos "ConexaoForte"',
      },
      {
        name: 'Website - TreinamentosInCompany',
        description: 'Conteúdos "TreinamentosInCompany"',
      },
      {
        name: 'Website - InformacoesGerais',
        description: 'Informações gerais do site',
      },
      {
        name: 'Website - ImagemLogin',
        description: 'Imagem exibida na página de login',
      },
      {
        name: 'Website - Header Pages',
        description: 'Cabeçalhos de páginas',
      },
      {
        name: 'Empresas - Planos Empresariais',
        description: 'Gestão dos planos empresariais corporativos',
      },
      {
        name: 'Empresas - Clientes',
        description: 'Clientes (empresas) vinculados a planos pagos',
      },
      {
        name: 'Empresas - Vagas',
        description: 'Administração de vagas corporativas vinculadas às empresas',
      },
      {
        name: 'Empresas - Admin',
        description:
          'Gestão administrativa completa das empresas: cadastro, planos, pagamentos, vagas, banimentos e monitoramento operacional',
      },
      { name: 'MercadoPago - Assinaturas', description: 'Assinaturas e cobranças recorrentes (Mercado Pago)' },
    ],
    'x-tagGroups': [
      { name: 'Default', tags: ['Default'] },
      { name: 'Brevo', tags: ['Brevo'] },
      {
        name: 'Usuários',
        tags: ['Usuários', 'Usuários - Admin', 'Usuários - Stats'],
      },
      {
        name: 'Websites',
        tags: [
          'Website',
          'Website - Banner',
          'Website - LogoEnterprises',
          'Website - Slider',
          'Website - Sobre',
          'Website - Consultoria',
          'Website - Recrutamento',
          'Website - SobreEmpresa',
          'Website - Team',
          'Website - Depoimentos',
          'Website - Diferenciais',
          'Website - Planinhas',
          'Website - Advance Ajuda',
          'Website - RecrutamentoSelecao',
          'Website - Sistema',
          'Website - TreinamentoCompany',
          'Website - ConexaoForte',
          'Website - TreinamentosInCompany',
          'Website - InformacoesGerais',
          'Website - ImagemLogin',
          'Website - Header Pages',
        ],
      },
      {
        name: 'Empresas',
        tags: [
          'Empresas - Planos Empresariais',
          'Empresas - Clientes',
          'Empresas - Vagas',
          'Empresas - Admin',
        ],
      },
      { name: 'Pagamentos', tags: ['MercadoPago - Assinaturas'] },
    ],
        components: {
          schemas: {
        // Enums de Pagamento (para uso geral)
        StatusPagamento: {
          type: 'string',
          enum: ['PENDENTE', 'EM_PROCESSAMENTO', 'APROVADO', 'CONCLUIDO', 'RECUSADO', 'ESTORNADO', 'CANCELADO'],
          example: 'PENDENTE',
          description: 'Estados possíveis de um pagamento/processamento de transação',
        },
        ModeloPagamento: {
          type: 'string',
          enum: ['ASSINATURA', 'PAGAMENTO_UNICO', 'PAGAMENTO_PARCELADO'],
          example: 'ASSINATURA',
          description: 'Modelos de cobrança suportados',
        },
        MetodoPagamento: {
          type: 'string',
          enum: ['CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'BOLETO', 'TRANSFERENCIA', 'DINHEIRO'],
          example: 'PIX',
          description: 'Meios de pagamento aceitos',
        },
        CheckoutMetodo: {
          type: 'string',
          enum: ['pagamento', 'assinatura'],
          example: 'pagamento',
          description: 'Fluxo desejado: cobrança única ou assinatura recorrente',
        },
        CheckoutPagamento: {
          type: 'string',
          enum: ['pix', 'card', 'boleto'],
          example: 'pix',
          description: 'Meio de pagamento quando metodo=pagamento',
        },
        CheckoutCardData: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              description: 'Token do cartão retornado pelo Card Payment Brick',
              example: '9f0f9a0f-0acb-4bc8-8f10-1234567890ab',
            },
            installments: {
              type: 'integer',
              minimum: 1,
              maximum: 48,
              example: 1,
              description: 'Quantidade de parcelas desejada',
            },
          },
        },
        CheckoutIntent: {
          type: 'object',
          required: ['usuarioId', 'planoEmpresarialId', 'metodo'],
          properties: {
            usuarioId: { type: 'string', format: 'uuid' },
            planoEmpresarialId: { type: 'string', format: 'uuid' },
            metodo: { $ref: '#/components/schemas/CheckoutMetodo' },
            pagamento: {
              $ref: '#/components/schemas/CheckoutPagamento',
              description: 'Obrigatório quando metodo=pagamento. Para assinatura, utiliza-se card.',
            },
            card: {
              $ref: '#/components/schemas/CheckoutCardData',
              description: 'Obrigatório para pagamento com cartão e para assinatura direta (sem redirect).',
            },
            successUrl: { type: 'string', format: 'uri', nullable: true },
            failureUrl: { type: 'string', format: 'uri', nullable: true },
            pendingUrl: { type: 'string', format: 'uri', nullable: true },
          },
        },
        CheckoutPaymentPixResponse: {
          type: 'object',
          required: ['tipo', 'status'],
          properties: {
            tipo: { type: 'string', enum: ['pix'] },
            status: { type: 'string', example: 'pending' },
            paymentId: { type: 'string', nullable: true },
            qrCode: { type: 'string', nullable: true },
            qrCodeBase64: { type: 'string', nullable: true },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        CheckoutPaymentCardResponse: {
          type: 'object',
          required: ['tipo', 'status'],
          properties: {
            tipo: { type: 'string', enum: ['card'] },
            status: { type: 'string', example: 'approved' },
            paymentId: { type: 'string', nullable: true },
            installments: { type: 'integer', nullable: true, example: 1 },
          },
        },
        CheckoutPaymentBoletoResponse: {
          type: 'object',
          required: ['tipo', 'status'],
          properties: {
            tipo: { type: 'string', enum: ['boleto'] },
            status: { type: 'string', example: 'pending' },
            paymentId: { type: 'string', nullable: true },
            boletoUrl: { type: 'string', format: 'uri', nullable: true },
            barcode: { type: 'string', nullable: true },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        CheckoutAssinaturaResponse: {
          type: 'object',
          required: ['preapprovalId', 'status'],
          properties: {
            preapprovalId: { type: 'string', nullable: true },
            status: { type: 'string', example: 'authorized' },
            initPoint: { type: 'string', format: 'uri', nullable: true },
            requiresRedirect: { type: 'boolean', example: false },
          },
        },
        CheckoutResponse: {
          type: 'object',
          properties: {
            checkoutId: { type: 'string', format: 'uuid' },
            plano: {
              type: 'object',
              description: 'Snapshot do vínculo criado ou atualizado para o checkout',
            },
            pagamento: {
              nullable: true,
              oneOf: [
                { $ref: '#/components/schemas/CheckoutPaymentPixResponse' },
                { $ref: '#/components/schemas/CheckoutPaymentCardResponse' },
                { $ref: '#/components/schemas/CheckoutPaymentBoletoResponse' },
              ],
            },
            assinatura: {
              nullable: true,
              $ref: '#/components/schemas/CheckoutAssinaturaResponse',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Erro de validação' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            error: { type: 'string', example: 'Detalhes adicionais do erro' },
          },
        },
        UnauthorizedResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Token de autorização necessário',
              description:
                'Mensagem informativa indicando ausência ou invalidação do token de acesso',
            },
            error: {
              type: 'string',
              nullable: true,
              example: 'Token inválido ou expirado',
            },
          },
        },
        ForbiddenResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Acesso negado: permissões insuficientes',
              description: 'Motivo pelo qual a requisição foi bloqueada pelo controle de acesso',
            },
            requiredRoles: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
              example: ['ADMIN', 'MODERADOR'],
              description: 'Roles esperadas para acessar o recurso quando disponíveis',
            },
            userRole: {
              type: 'string',
              nullable: true,
              example: 'EMPRESA',
              description: 'Role detectada para o usuário autenticado, se identificada',
            },
          },
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: {
              type: 'string',
              example: 'Dados inválidos para criação do recurso',
            },
            issues: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: { type: 'string' },
              },
              example: {
                campo: ['Este campo é obrigatório'],
              },
            },
          },
        },
        UserLoginRequest: {
          type: 'object',
          required: ['documento', 'senha'],
          properties: {
            documento: {
              type: 'string',
              description: 'CPF do usuário',
              example: '12345678900',
            },
            senha: {
              type: 'string',
              format: 'password',
              example: 'senha123',
            },
          },
        },
        UserLoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            token: {
              type: 'string',
              description: 'JWT de acesso',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refreshToken: {
              type: 'string',
              description: 'Token para renovação de sessão',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
        UserRegisterRequest: {
          type: 'object',
          required: [
            'nomeCompleto',
            'documento',
            'telefone',
            'email',
            'senha',
            'confirmarSenha',
            'aceitarTermos',
            'supabaseId',
            'tipoUsuario',
          ],
          properties: {
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            documento: {
              type: 'string',
              description: 'CPF ou CNPJ',
              example: '12345678900',
            },
            telefone: {
              type: 'string',
              example: '+55 11 99999-9999',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'joao@example.com',
            },
            senha: { type: 'string', format: 'password', example: 'senha123' },
            confirmarSenha: {
              type: 'string',
              format: 'password',
              example: 'senha123',
            },
            aceitarTermos: { type: 'boolean', example: true },
            supabaseId: {
              type: 'string',
              description: 'Identificador do usuário no Supabase',
              example: 'uuid-supabase',
            },
            tipoUsuario: {
              type: 'string',
              description: 'Tipo do usuário',
              enum: ['PESSOA_FISICA', 'PESSOA_JURIDICA'],
              example: 'PESSOA_FISICA',
            },
          },
        },
        UserRegisterResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            usuario: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: 'b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab',
                },
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'joao@example.com',
                },
                nomeCompleto: {
                  type: 'string',
                  example: 'João da Silva',
                },
              },
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              description: 'Token de renovação válido',
              example: '<refresh-token>',
            },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab' },
            email: { type: 'string', example: 'joao@example.com' },
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            role: {
              type: 'string',
              description: 'Role do usuário',
              example: 'ADMIN',
            },
            tipoUsuario: {
              type: 'string',
              example: 'PESSOA_FISICA',
            },
            supabaseId: { type: 'string', example: 'uuid-supabase' },
            emailVerificado: { type: 'boolean', example: true },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        RefreshTokenResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Token renovado com sucesso' },
            usuario: { $ref: '#/components/schemas/UserProfile' },
          },
        },
        LogoutResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Logout realizado' },
          },
        },
        BasicMessage: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'OK' },
          },
        },
        ApiRootInfo: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Advance+ API' },
            version: { type: 'string', example: 'v3.0.3' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            environment: { type: 'string', example: 'development' },
            status: { type: 'string', example: 'operational' },
            express_version: { type: 'string', example: '4.x' },
            endpoints: {
              type: 'object',
              additionalProperties: { type: 'string' },
              example: {
                usuarios: '/api/v1/usuarios',
                brevo: '/api/v1/brevo',
                website: '/api/v1/website',
                empresa: '/api/v1/empresa',
                health: '/health',
              },
            },
          },
        },
        GlobalHealthStatus: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'OK' },
            uptime: { type: 'number', example: 1 },
            version: { type: 'string', example: 'v3.0.3' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        BrevoModuleInfo: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              example: 'Brevo Communication Module',
            },
            version: { type: 'string', example: '7.3.0' },
            description: {
              type: 'string',
              example: 'Sistema completo de comunicação e verificação de email',
            },
            status: { type: 'string', example: 'active' },
            configured: { type: 'boolean', example: true },
            simulated: { type: 'boolean', example: false },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        BrevoHealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            module: { type: 'string', example: 'brevo' },
            configured: { type: 'boolean', example: true },
            simulated: { type: 'boolean', example: false },
            operational: { type: 'boolean', example: true },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            services: {
              type: 'object',
              properties: {
                email: { type: 'string', example: 'operational' },
                sms: { type: 'string', example: 'operational' },
                client: { type: 'string', example: 'operational' },
              },
            },
          },
        },
        BrevoConfigStatus: {
          type: 'object',
          properties: {
            module: { type: 'string', example: 'Brevo Configuration Status' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            configuration: {
              type: 'object',
              properties: {
                isConfigured: { type: 'boolean', example: true },
                environment: { type: 'string', example: 'development' },
                apiKeyProvided: { type: 'boolean', example: true },
                fromEmailConfigured: { type: 'boolean', example: true },
                fromName: { type: 'string', example: 'Advance+' },
              },
            },
            emailVerification: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean', example: true },
                tokenExpirationHours: { type: 'integer', example: 24 },
              },
            },
            client: {
              type: 'object',
              properties: {
                operational: { type: 'boolean', example: true },
                simulated: { type: 'boolean', example: false },
              },
            },
          },
        },
        BrevoVerifyEmailResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example: 'Email verificado com sucesso',
            },
            redirectUrl: {
              type: 'string',
              example: 'https://app.advance.com.br',
            },
            userId: {
              type: 'string',
              example: 'b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab',
            },
          },
        },
        BrevoResendVerificationRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
          },
        },
        BrevoResendVerificationResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example: 'Email de verificação reenviado com sucesso',
            },
            simulated: { type: 'boolean', example: false },
            messageId: { type: 'string', example: 'msg_123' },
          },
        },
        BrevoVerificationStatusResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  example: 'b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab',
                },
                email: { type: 'string', example: 'user@example.com' },
                emailVerified: { type: 'boolean', example: false },
                accountStatus: { type: 'string', example: 'ATIVO' },
                hasValidToken: { type: 'boolean', example: true },
                tokenExpiration: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-01T12:00:00Z',
                },
              },
            },
          },
        },
        BrevoTestEmailRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            name: { type: 'string', example: 'Usuário Teste' },
            type: { type: 'string', example: 'welcome' },
          },
        },
        BrevoTestEmailResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example: 'Teste de email welcome executado',
            },
            data: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'welcome' },
                recipient: { type: 'string', example: 'user@example.com' },
                simulated: { type: 'boolean', example: false },
                messageId: { type: 'string', example: 'msg_123' },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        BrevoTestSMSRequest: {
          type: 'object',
          required: ['to'],
          properties: {
            to: { type: 'string', example: '+55 11 99999-9999' },
            message: {
              type: 'string',
              example: 'Teste de SMS do Advance+ - Sistema funcionando!',
            },
          },
        },
        BrevoTestSMSResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Teste de SMS executado' },
            data: {
              type: 'object',
              properties: {
                recipient: {
                  type: 'string',
                  example: '+55 11 99999-9999',
                },
                message: {
                  type: 'string',
                  example: 'Teste de SMS do Advance+ - Sistema funcionando!',
                },
                simulated: { type: 'boolean', example: false },
                messageId: { type: 'string', example: 'sms_123' },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        EmpresaPlan: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'plan-uuid' },
            nome: { type: 'string', example: 'Plano Básico' },
            icone: { type: 'string', nullable: true, example: 'icone.png' },
            categoria: {
              type: 'string',
              enum: ['INICIAL', 'INTERMEDIARIO', 'AVANCADO', 'DESTAQUE'],
              example: 'INICIAL',
            },
            valor: { type: 'number', example: 49.9 },
            desconto: {
              type: 'number',
              nullable: true,
              example: 10,
              description: 'Desconto percentual aplicado ao plano',
            },
            descricao: { type: 'string', example: 'Acesso básico' },
            recursos: {
              type: 'array',
              items: { type: 'string' },
              example: ['feature1', 'feature2'],
            },
            ativo: { type: 'boolean', example: true },
            frequency: { type: 'integer', example: 1 },
            frequencyType: {
              type: 'string',
              enum: ['DIAS', 'MESES'],
              example: 'MESES',
            },
            repetitions: { type: 'integer', nullable: true, example: null },
            billingDay: {
              type: 'integer',
              nullable: true,
              example: 1,
              description: 'Dia de cobrança mensal (1-28)',
            },
            billingDayProportional: {
              type: 'boolean',
              example: true,
              description: 'Define se a primeira cobrança será proporcional',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        EmpresaPlanCreateRequest: {
          type: 'object',
          required: [
            'nome',
            'categoria',
            'valor',
            'descricao',
            'recursos',
            'frequency',
            'frequencyType',
          ],
          properties: {
            nome: { type: 'string', example: 'Plano Básico' },
            icone: { type: 'string', nullable: true, example: 'icone.png' },
            categoria: {
              type: 'string',
              enum: ['INICIAL', 'INTERMEDIARIO', 'AVANCADO', 'DESTAQUE'],
              example: 'INICIAL',
            },
            valor: { type: 'number', example: 49.9 },
            desconto: {
              type: 'number',
              nullable: true,
              example: 0,
            },
            descricao: { type: 'string', example: 'Acesso básico' },
            recursos: {
              type: 'array',
              items: { type: 'string' },
              example: ['feature1', 'feature2'],
            },
            frequency: { type: 'integer', example: 1 },
            frequencyType: {
              type: 'string',
              enum: ['DIAS', 'MESES'],
              example: 'MESES',
            },
            repetitions: { type: 'integer', nullable: true, example: null },
            billingDay: {
              type: 'integer',
              nullable: true,
              example: 1,
              description: 'Dia de cobrança mensal (1-28)',
            },
            billingDayProportional: {
              type: 'boolean',
              example: true,
              description: 'Define se a primeira cobrança será proporcional',
            },
          },
        },
        EmpresaPlanUpdateRequest: {
          type: 'object',
          properties: {
            nome: { type: 'string', example: 'Plano Atualizado' },
            icone: { type: 'string', nullable: true, example: 'icone.png' },
            categoria: {
              type: 'string',
              enum: ['INICIAL', 'INTERMEDIARIO', 'AVANCADO', 'DESTAQUE'],
              example: 'INICIAL',
            },
            valor: { type: 'number', example: 59.9 },
            desconto: {
              type: 'number',
              nullable: true,
              example: 0,
            },
            descricao: { type: 'string', example: 'Descrição' },
            recursos: {
              type: 'array',
              items: { type: 'string' },
            },
            ativo: { type: 'boolean', example: true },
            frequency: { type: 'integer', example: 1 },
            frequencyType: {
              type: 'string',
              enum: ['DIAS', 'MESES'],
              example: 'MESES',
            },
            repetitions: { type: 'integer', nullable: true, example: null },
            billingDay: {
              type: 'integer',
              nullable: true,
              example: 1,
              description: 'Dia de cobrança mensal (1-28)',
            },
            billingDayProportional: {
              type: 'boolean',
              example: true,
              description: 'Define se a primeira cobrança será proporcional',
            },
          },
        },
        EmpresaPlanCreateResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Plano criado' },
            plan: { $ref: '#/components/schemas/EmpresaPlan' },
          },
        },
        EmpresaPlanUpdateResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Plano atualizado' },
            plan: { $ref: '#/components/schemas/EmpresaPlan' },
          },
        },
        EmpresaPlansResponse: {
          type: 'object',
          properties: {
            plans: {
              type: 'array',
              items: { $ref: '#/components/schemas/EmpresaPlan' },
            },
          },
        },
        EmpresaPlanAssignRequest: {
          type: 'object',
          required: ['usuarioId', 'metodoPagamento'],
          properties: {
            usuarioId: { type: 'string', example: 'usuario-uuid' },
            metodoPagamento: {
              type: 'string',
              enum: ['PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'GRATUITO'],
              example: 'PIX',
            },
            tipo: {
              type: 'string',
              enum: ['STANDARD', 'PARTNER'],
              example: 'STANDARD',
            },
            validade: {
              type: 'string',
              enum: [
                'DIAS_15',
                'DIAS_30',
                'DIAS_60',
                'DIAS_90',
                'DIAS_120',
                'ANO_1',
                'SEM_VALIDADE',
              ],
              nullable: true,
              example: 'DIAS_30',
            },
          },
        },
        EmpresaPlanAssignment: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'assignment-uuid' },
            usuarioId: { type: 'string', example: 'usuario-uuid' },
            planoId: { type: 'string', example: 'plan-uuid' },
            metodoPagamento: {
              type: 'string',
              enum: ['PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'GRATUITO'],
              example: 'PIX',
            },
            tipo: {
              type: 'string',
              enum: ['STANDARD', 'PARTNER'],
              example: 'STANDARD',
            },
            validade: {
              type: 'string',
              enum: [
                'DIAS_15',
                'DIAS_30',
                'DIAS_60',
                'DIAS_90',
                'DIAS_120',
                'ANO_1',
                'SEM_VALIDADE',
              ],
              nullable: true,
              example: 'DIAS_30',
            },
            inicio: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            fim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-02-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        EmpresaPlanAssignResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Plano vinculado à empresa',
            },
            empresaPlano: {
              $ref: '#/components/schemas/EmpresaPlanAssignment',
            },
          },
        },
        EmpresaPlanUnassignResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Plano desvinculado da empresa',
            },
          },
        },
        WebsiteModuleInfo: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Website Module API' },
            version: { type: 'string', example: 'v1' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            endpoints: {
              type: 'object',
              properties: {
                sobre: { type: 'string', example: '/sobre' },
                slider: { type: 'string', example: '/slider' },
                banner: { type: 'string', example: '/banner' },
                logoEnterprises: {
                  type: 'string',
                  example: '/logo-enterprises',
                },
                consultoria: { type: 'string', example: '/consultoria' },
                recrutamento: { type: 'string', example: '/recrutamento' },
                sobreEmpresa: { type: 'string', example: '/sobre-empresa' },
                team: { type: 'string', example: '/team' },
                diferenciais: { type: 'string', example: '/diferenciais' },
                depoimentos: { type: 'string', example: '/depoimentos' },
                informacoesGerais: {
                  type: 'string',
                  example: '/informacoes-gerais',
                },
                imagemLogin: { type: 'string', example: '/imagem-login' },
              },
            },
            status: { type: 'string', example: 'operational' },
          },
        },
        WebsiteStatus: {
          type: 'string',
          enum: ['PUBLICADO', 'RASCUNHO'],
          example: 'PUBLICADO',
        },
        WebsiteBanner: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do banner',
              example: 'ordem-uuid',
            },
            bannerId: {
              type: 'string',
              description: 'ID do banner associado',
              example: 'banner-uuid',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL pública da imagem',
              example: 'https://cdn.example.com/banner.jpg',
            },
            imagemTitulo: {
              type: 'string',
              description: 'Título da imagem gerado a partir do arquivo',
              example: 'banner',
            },
            link: {
              type: 'string',
              description: 'URL opcional de redirecionamento',
              nullable: true,
              example: 'https://example.com',
            },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação',
            },
            ordem: {
              type: 'integer',
              description: 'Posição do banner',
              example: 1,
            },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do banner',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteBannerCreateInput: {
          type: 'object',
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do banner',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/banner.jpg',
            },
            link: {
              type: 'string',
              description: 'Link de redirecionamento',
              example: 'https://example.com',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
          },
        },
        WebsiteBannerUpdateInput: {
          type: 'object',
          properties: {
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/banner.jpg',
            },
            link: { type: 'string', example: 'https://example.com' },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição do banner; ao mudar este valor os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteBannerReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do banner. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteLogoEnterprise: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do logo',
              example: 'ordem-uuid',
            },
            logoId: {
              type: 'string',
              description: 'ID do logo associado',
              example: 'logo-uuid',
            },
            nome: { type: 'string', example: 'Empresa X' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/logo.png',
            },
            imagemAlt: { type: 'string', example: 'Logo da Empresa X' },
            website: { type: 'string', example: 'https://empresa.com' },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação',
            },
            ordem: { type: 'integer', example: 1, description: 'Posição do logo' },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do logo',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteLogoEnterpriseCreateInput: {
          type: 'object',
          required: ['nome'],
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do logo',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/logo.png',
            },
            nome: { type: 'string', example: 'Empresa X' },
            website: {
              type: 'string',
              example: 'https://empresa.com',
              description: 'URL do site da empresa (opcional)',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
            imagemAlt: { type: 'string', example: 'Logo da Empresa X' },
          },
        },
        WebsiteLogoEnterpriseUpdateInput: {
          type: 'object',
          properties: {
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/logo.png',
            },
            nome: { type: 'string', example: 'Empresa X' },
            website: { type: 'string', example: 'https://empresa.com' },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            imagemAlt: { type: 'string', example: 'Logo da Empresa X' },
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição do logo; ao mudar este valor os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteLogoEnterpriseReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do logo. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteImagemLogin: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'login-uuid' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/login.png',
            },
            imagemTitulo: { type: 'string', example: 'login' },
            link: { type: 'string', nullable: true, example: 'https://example.com' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteImagemLoginCreateInput: {
          type: 'object',
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/login.png',
            },
            link: {
              type: 'string',
              nullable: true,
              example: 'https://example.com',
            },
          },
        },
        WebsiteImagemLoginUpdateInput: {
          type: 'object',
          properties: {
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/login.png',
            },
            link: { type: 'string', nullable: true, example: 'https://example.com' },
          },
        },
        WebsiteSlider: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do slider',
              example: 'ordem-uuid',
            },
            sliderId: {
              type: 'string',
              description: 'ID do slider associado',
              example: 'slider-uuid',
            },
            sliderName: {
              type: 'string',
              description: 'Nome identificador do slider',
              example: 'Banner Principal',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL pública da imagem',
              example: 'https://cdn.example.com/slide.jpg',
            },
            link: {
              type: 'string',
              description: 'URL opcional de redirecionamento',
              nullable: true,
              example: 'https://example.com',
            },
            orientacao: {
              type: 'string',
              enum: ['DESKTOP', 'TABLET_MOBILE'],
              description: 'Orientação em que o slider será exibido',
              example: 'DESKTOP',
            },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação',
            },
            ordem: {
              type: 'integer',
              description: 'Posição do slider',
              example: 1,
            },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do slider',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteSliderCreateInput: {
          type: 'object',
          required: ['sliderName', 'orientacao'],
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do slider',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/slide.jpg',
            },
            sliderName: {
              type: 'string',
              description: 'Nome identificador do slider',
              example: 'Banner Principal',
            },
            link: {
              type: 'string',
              description: 'URL opcional de redirecionamento',
              example: 'https://example.com',
            },
            orientacao: {
              type: 'string',
              enum: ['DESKTOP', 'TABLET_MOBILE'],
              description: 'Orientação em que o slider será exibido',
              example: 'DESKTOP',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
          },
        },
        WebsiteSliderUpdateInput: {
          type: 'object',
          description: 'Envie apenas os campos que deseja atualizar.',
          properties: {
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do slider',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/slide.jpg',
            },
            sliderName: {
              type: 'string',
              description: 'Nome identificador do slider',
              example: 'Banner Atualizado',
            },
            link: {
              type: 'string',
              description: 'URL opcional de redirecionamento',
              example: 'https://example.com',
            },
            orientacao: {
              type: 'string',
              enum: ['DESKTOP', 'TABLET_MOBILE'],
              description: 'Orientação em que o slider será exibido',
              example: 'TABLET_MOBILE',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            ordem: {
              type: 'integer',
              description:
                'Nova posição do slider; ao mudar este valor os demais serão reordenados automaticamente',
              example: 2,
            },
          },
        },
        WebsiteSliderReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do slider. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteSobre: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sobre-uuid' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/sobre.jpg',
            },
            imagemTitulo: { type: 'string', example: 'sobre' },
            titulo: { type: 'string', example: 'Quem somos' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteSobreCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao'],
          properties: {
            titulo: { type: 'string', example: 'Quem somos' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL da imagem',
              example: 'https://cdn.example.com/sobre.jpg',
            },
          },
        },
        WebsiteSobreUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Quem somos' },
            descricao: {
              type: 'string',
              example: 'Descrição atualizada',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/sobre.jpg',
            },
          },
        },
        WebsiteConsultoria: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'consultoria-uuid' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/consultoria.jpg',
            },
            imagemTitulo: { type: 'string', example: 'consultoria' },
            titulo: { type: 'string', example: 'Serviços de Consultoria' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre consultoria',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/consultoria',
            },
            buttonLabel: {
              type: 'string',
              example: 'Saiba mais',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteConsultoriaCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao', 'buttonUrl', 'buttonLabel'],
          properties: {
            titulo: {
              type: 'string',
              example: 'Serviços de Consultoria',
            },
            descricao: {
              type: 'string',
              example: 'Descrição sobre consultoria',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/consultoria',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do conteúdo',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/consultoria.jpg',
            },
          },
        },
        WebsiteConsultoriaUpdateInput: {
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              example: 'Serviços de Consultoria',
            },
            descricao: {
              type: 'string',
              example: 'Descrição atualizada',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/consultoria',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/consultoria.jpg',
            },
          },
        },
        WebsiteRecrutamento: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'recrutamento-uuid' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/recrutamento.jpg',
            },
            imagemTitulo: { type: 'string', example: 'recrutamento' },
            titulo: { type: 'string', example: 'Serviços de Recrutamento' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre recrutamento',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/recrutamento',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteRecrutamentoCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao', 'buttonUrl', 'buttonLabel'],
          properties: {
            titulo: {
              type: 'string',
              example: 'Serviços de Recrutamento',
            },
            descricao: {
              type: 'string',
              example: 'Descrição sobre recrutamento',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/recrutamento',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            imagem: {
              type: 'string',
              format: 'binary',
              description: 'Arquivo de imagem do conteúdo',
            },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL alternativa da imagem',
              example: 'https://cdn.example.com/recrutamento.jpg',
            },
          },
        },
        WebsiteRecrutamentoUpdateInput: {
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              example: 'Serviços de Recrutamento',
            },
            descricao: {
              type: 'string',
              example: 'Descrição atualizada',
            },
            buttonUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/recrutamento',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/recrutamento.jpg',
            },
          },
        },
        WebsiteSobreEmpresa: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sobreempresa-uuid' },
            titulo: { type: 'string', example: 'Sobre a Empresa' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            descricaoVisao: {
              type: 'string',
              example: 'Nossa visão',
            },
            descricaoMissao: {
              type: 'string',
              example: 'Nossa missão',
            },
            descricaoValores: {
              type: 'string',
              example: 'Nossos valores',
            },
            videoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/video',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteSobreEmpresaCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'descricao',
            'descricaoVisao',
            'descricaoMissao',
            'descricaoValores',
            'videoUrl',
          ],
          properties: {
            titulo: { type: 'string', example: 'Sobre a Empresa' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            descricaoVisao: {
              type: 'string',
              example: 'Nossa visão',
            },
            descricaoMissao: {
              type: 'string',
              example: 'Nossa missão',
            },
            descricaoValores: {
              type: 'string',
              example: 'Nossos valores',
            },
            videoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/video',
            },
          },
        },
        WebsiteSobreEmpresaUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Sobre a Empresa' },
            descricao: {
              type: 'string',
              example: 'Descrição sobre a empresa',
            },
            descricaoVisao: {
              type: 'string',
              example: 'Nossa visão',
            },
            descricaoMissao: {
              type: 'string',
              example: 'Nossa missão',
            },
            descricaoValores: {
              type: 'string',
              example: 'Nossos valores',
            },
            videoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/video',
            },
          },
        },
        WebsiteTeam: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do membro',
              example: 'ordem-uuid',
            },
            teamId: {
              type: 'string',
              description: 'ID do membro',
              example: 'team-uuid',
            },
            photoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/team.jpg',
            },
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Desenvolvedor' },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação do membro',
            },
            ordem: {
              type: 'integer',
              description: 'Posição do membro',
              example: 1,
            },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do membro',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteTeamCreateInput: {
          type: 'object',
          required: ['nome', 'cargo', 'photoUrl'],
          properties: {
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Desenvolvedor' },
            photoUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL da imagem do membro',
              example: 'https://cdn.example.com/team.jpg',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
          },
        },
        WebsiteTeamUpdateInput: {
          type: 'object',
          description: 'Envie apenas os campos que deseja atualizar.',
          properties: {
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Desenvolvedor' },
            photoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/team.jpg',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição do membro; ao mudar este valor os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteTeamReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do membro. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteDepoimento: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID da ordem do depoimento',
              example: 'ordem-uuid',
            },
            depoimentoId: {
              type: 'string',
              description: 'ID do depoimento',
              example: 'depoimento-uuid',
            },
            depoimento: { type: 'string', example: 'Ótimo serviço' },
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Gerente' },
            fotoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/foto.jpg',
            },
            status: {
              $ref: '#/components/schemas/WebsiteStatus',
              description: 'Estado de publicação do depoimento',
            },
            ordem: {
              type: 'integer',
              description: 'Posição do depoimento',
              example: 1,
            },
            ordemCriadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação da ordem',
              example: '2024-01-01T12:00:00Z',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação do depoimento',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteDepoimentoCreateInput: {
          type: 'object',
          required: ['depoimento', 'nome', 'cargo', 'fotoUrl'],
          properties: {
            depoimento: { type: 'string', example: 'Ótimo serviço' },
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Gerente' },
            fotoUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL da foto do autor',
              example: 'https://cdn.example.com/foto.jpg',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: true,
            },
          },
        },
        WebsiteDepoimentoUpdateInput: {
          type: 'object',
          description: 'Envie apenas os campos que deseja atualizar.',
          properties: {
            depoimento: { type: 'string', example: 'Ótimo serviço' },
            nome: { type: 'string', example: 'Fulano' },
            cargo: { type: 'string', example: 'Gerente' },
            fotoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/foto.jpg',
            },
            status: {
              description:
                'Estado de publicação. Aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.',
              oneOf: [{ $ref: '#/components/schemas/WebsiteStatus' }, { type: 'boolean' }],
              example: false,
            },
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição do depoimento; ao mudar este valor os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteDepoimentoReorderInput: {
          type: 'object',
          required: ['ordem'],
          properties: {
            ordem: {
              type: 'integer',
              example: 2,
              description:
                'Nova posição desejada do depoimento. Se já houver outro na posição, os demais serão reordenados automaticamente',
            },
          },
        },
        WebsiteDiferenciais: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'diferenciais-uuid' },
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            titulo4: { type: 'string', example: 'Título 4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            titulo: { type: 'string', example: 'Nossos Diferenciais' },
            descricao: {
              type: 'string',
              example: 'Texto geral dos diferenciais',
            },
            botaoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            botaoLabel: { type: 'string', example: 'Saiba mais' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteDiferenciaisCreateInput: {
          type: 'object',
          required: [
            'icone1',
            'titulo1',
            'descricao1',
            'icone2',
            'titulo2',
            'descricao2',
            'icone3',
            'titulo3',
            'descricao3',
            'icone4',
            'titulo4',
            'descricao4',
            'titulo',
            'descricao',
            'botaoUrl',
            'botaoLabel',
          ],
          properties: {
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            titulo4: { type: 'string', example: 'Título 4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            titulo: { type: 'string', example: 'Nossos Diferenciais' },
            descricao: { type: 'string', example: 'Texto geral' },
            botaoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            botaoLabel: { type: 'string', example: 'Saiba mais' },
          },
        },
        WebsiteDiferenciaisUpdateInput: {
          type: 'object',
          properties: {
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            titulo4: { type: 'string', example: 'Título 4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            titulo: { type: 'string', example: 'Nossos Diferenciais' },
            descricao: { type: 'string', example: 'Texto geral' },
            botaoUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            botaoLabel: { type: 'string', example: 'Saiba mais' },
          },
        },
        WebsitePlaninhas: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'planinhas-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição geral' },
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsitePlaninhasCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'descricao',
            'icone1',
            'titulo1',
            'descricao1',
            'icone2',
            'titulo2',
            'descricao2',
            'icone3',
            'titulo3',
            'descricao3',
          ],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição geral' },
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsitePlaninhasUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição geral' },
            icone1: { type: 'string', example: 'icon1' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteAdvanceAjuda: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'advanceajuda-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/img.jpg',
            },
            imagemTitulo: { type: 'string', example: 'imagem' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteAdvanceAjudaCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'descricao',
            'titulo1',
            'descricao1',
            'titulo2',
            'descricao2',
            'titulo3',
            'descricao3',
          ],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteAdvanceAjudaUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteRecrutamentoSelecao: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'recrutamento-selecao-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/img.jpg',
            },
            imagemTitulo: { type: 'string', example: 'imagem' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteRecrutamentoSelecaoCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao', 'titulo1', 'titulo2', 'titulo3', 'titulo4'],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
          },
        },
        WebsiteRecrutamentoSelecaoUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
          },
        },
        WebsiteSistema: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sistema-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            subtitulo: { type: 'string', example: 'Subtítulo' },
            etapa1Titulo: { type: 'string', example: 'Etapa 1' },
            etapa1Descricao: { type: 'string', example: 'Descrição 1' },
            etapa2Titulo: { type: 'string', example: 'Etapa 2' },
            etapa2Descricao: { type: 'string', example: 'Descrição 2' },
            etapa3Titulo: { type: 'string', example: 'Etapa 3' },
            etapa3Descricao: { type: 'string', example: 'Descrição 3' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteSistemaCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'descricao',
            'subtitulo',
            'etapa1Titulo',
            'etapa1Descricao',
            'etapa2Titulo',
            'etapa2Descricao',
            'etapa3Titulo',
            'etapa3Descricao',
          ],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            subtitulo: { type: 'string', example: 'Subtítulo' },
            etapa1Titulo: { type: 'string', example: 'Etapa 1' },
            etapa1Descricao: { type: 'string', example: 'Descrição 1' },
            etapa2Titulo: { type: 'string', example: 'Etapa 2' },
            etapa2Descricao: { type: 'string', example: 'Descrição 2' },
            etapa3Titulo: { type: 'string', example: 'Etapa 3' },
            etapa3Descricao: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteSistemaUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            subtitulo: { type: 'string', example: 'Subtítulo' },
            etapa1Titulo: { type: 'string', example: 'Etapa 1' },
            etapa1Descricao: { type: 'string', example: 'Descrição 1' },
            etapa2Titulo: { type: 'string', example: 'Etapa 2' },
            etapa2Descricao: { type: 'string', example: 'Descrição 2' },
            etapa3Titulo: { type: 'string', example: 'Etapa 3' },
            etapa3Descricao: { type: 'string', example: 'Descrição 3' },
          },
        },
        WebsiteTreinamentoCompany: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'treinamento-company-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              example: 'https://cdn.example.com/img.jpg',
            },
            imagemTitulo: { type: 'string', example: 'imagem' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteTreinamentoCompanyCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao', 'titulo1', 'titulo2', 'titulo3', 'titulo4'],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
          },
        },
        WebsiteTreinamentoCompanyUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem: { type: 'string', format: 'binary' },
            imagemUrl: { type: 'string', format: 'uri' },
            titulo1: { type: 'string', example: 'Título 1' },
            titulo2: { type: 'string', example: 'Título 2' },
            titulo3: { type: 'string', example: 'Título 3' },
            titulo4: { type: 'string', example: 'Título 4' },
          },
        },
        WebsiteConexaoForte: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'conexao-forte-uuid' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl1: { type: 'string', format: 'uri', example: 'https://cdn.example.com/1.jpg' },
            imagemTitulo1: { type: 'string', example: 'img1' },
            imagemUrl2: { type: 'string', format: 'uri', example: 'https://cdn.example.com/2.jpg' },
            imagemTitulo2: { type: 'string', example: 'img2' },
            imagemUrl3: { type: 'string', format: 'uri', example: 'https://cdn.example.com/3.jpg' },
            imagemTitulo3: { type: 'string', example: 'img3' },
            imagemUrl4: { type: 'string', format: 'uri', example: 'https://cdn.example.com/4.jpg' },
            imagemTitulo4: { type: 'string', example: 'img4' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteConexaoForteCreateInput: {
          type: 'object',
          required: ['titulo', 'descricao'],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem1: { type: 'string', format: 'binary' },
            imagem2: { type: 'string', format: 'binary' },
            imagem3: { type: 'string', format: 'binary' },
            imagem4: { type: 'string', format: 'binary' },
            imagemUrl1: { type: 'string', format: 'uri' },
            imagemUrl2: { type: 'string', format: 'uri' },
            imagemUrl3: { type: 'string', format: 'uri' },
            imagemUrl4: { type: 'string', format: 'uri' },
          },
        },
        WebsiteConexaoForteUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagem1: { type: 'string', format: 'binary' },
            imagem2: { type: 'string', format: 'binary' },
            imagem3: { type: 'string', format: 'binary' },
            imagem4: { type: 'string', format: 'binary' },
            imagemUrl1: { type: 'string', format: 'uri' },
            imagemUrl2: { type: 'string', format: 'uri' },
            imagemUrl3: { type: 'string', format: 'uri' },
            imagemUrl4: { type: 'string', format: 'uri' },
          },
        },
        WebsiteTreinamentosInCompany: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'treinamentos-in-company-uuid' },
            titulo: { type: 'string', example: 'Título' },
            icone1: { type: 'string', example: 'icon1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            icone5: { type: 'string', example: 'icon5' },
            descricao5: { type: 'string', example: 'Descrição 5' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteTreinamentosInCompanyCreateInput: {
          type: 'object',
          required: [
            'titulo',
            'icone1',
            'descricao1',
            'icone2',
            'descricao2',
            'icone3',
            'descricao3',
            'icone4',
            'descricao4',
            'icone5',
            'descricao5',
          ],
          properties: {
            titulo: { type: 'string', example: 'Título' },
            icone1: { type: 'string', example: 'icon1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            icone5: { type: 'string', example: 'icon5' },
            descricao5: { type: 'string', example: 'Descrição 5' },
          },
        },
        WebsiteTreinamentosInCompanyUpdateInput: {
          type: 'object',
          properties: {
            titulo: { type: 'string', example: 'Título' },
            icone1: { type: 'string', example: 'icon1' },
            descricao1: { type: 'string', example: 'Descrição 1' },
            icone2: { type: 'string', example: 'icon2' },
            descricao2: { type: 'string', example: 'Descrição 2' },
            icone3: { type: 'string', example: 'icon3' },
            descricao3: { type: 'string', example: 'Descrição 3' },
            icone4: { type: 'string', example: 'icon4' },
            descricao4: { type: 'string', example: 'Descrição 4' },
            icone5: { type: 'string', example: 'icon5' },
            descricao5: { type: 'string', example: 'Descrição 5' },
          },
        },
        WebsiteHorarioFuncionamento: {
          type: 'object',
          properties: {
            diaDaSemana: { type: 'string', example: 'segunda' },
            horarioInicio: { type: 'string', example: '08:00' },
            horarioFim: { type: 'string', example: '18:00' },
          },
        },
        WebsiteInformacoes: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'info-uuid' },
            endereco: {
              type: 'string',
              nullable: true,
              example: 'Rua A, 123',
            },
            cep: {
              type: 'string',
              nullable: true,
              example: '12345-678',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: { type: 'string', nullable: true, example: 'SP' },
            telefone1: {
              type: 'string',
              nullable: true,
              example: '(11) 1234-5678',
            },
            telefone2: {
              type: 'string',
              nullable: true,
              example: '(11) 9876-5432',
            },
            whatsapp: {
              type: 'string',
              nullable: true,
              example: '(11) 91234-5678',
            },
            horarios: {
              type: 'array',
              nullable: true,
              items: {
                $ref: '#/components/schemas/WebsiteHorarioFuncionamento',
              },
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/example',
            },
            facebook: {
              type: 'string',
              nullable: true,
              example: 'https://facebook.com/example',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/example',
            },
            youtube: {
              type: 'string',
              nullable: true,
              example: 'https://youtube.com/example',
            },
            email: {
              type: 'string',
              nullable: true,
              example: 'contato@example.com',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteInformacoesCreateInput: {
          type: 'object',
          properties: {
            endereco: {
              type: 'string',
              nullable: true,
              example: 'Rua A, 123',
            },
            cep: {
              type: 'string',
              nullable: true,
              example: '12345-678',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: { type: 'string', nullable: true, example: 'SP' },
            telefone1: {
              type: 'string',
              nullable: true,
              example: '(11) 1234-5678',
            },
            telefone2: {
              type: 'string',
              nullable: true,
              example: '(11) 9876-5432',
            },
            whatsapp: {
              type: 'string',
              nullable: true,
              example: '(11) 91234-5678',
            },
            horarios: {
              type: 'array',
              nullable: true,
              items: {
                $ref: '#/components/schemas/WebsiteHorarioFuncionamento',
              },
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/example',
            },
            facebook: {
              type: 'string',
              nullable: true,
              example: 'https://facebook.com/example',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/example',
            },
            youtube: {
              type: 'string',
              nullable: true,
              example: 'https://youtube.com/example',
            },
            email: {
              type: 'string',
              nullable: true,
              example: 'contato@example.com',
            },
          },
        },
        WebsiteInformacoesUpdateInput: {
          type: 'object',
          properties: {
            endereco: {
              type: 'string',
              nullable: true,
              example: 'Rua A, 123',
            },
            cep: {
              type: 'string',
              nullable: true,
              example: '12345-678',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: { type: 'string', nullable: true, example: 'SP' },
            telefone1: {
              type: 'string',
              nullable: true,
              example: '(11) 1234-5678',
            },
            telefone2: {
              type: 'string',
              nullable: true,
              example: '(11) 9876-5432',
            },
            whatsapp: {
              type: 'string',
              nullable: true,
              example: '(11) 91234-5678',
            },
            horarios: {
              type: 'array',
              nullable: true,
              items: {
                $ref: '#/components/schemas/WebsiteHorarioFuncionamento',
              },
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/example',
            },
            facebook: {
              type: 'string',
              nullable: true,
              example: 'https://facebook.com/example',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/example',
            },
            youtube: {
              type: 'string',
              nullable: true,
              example: 'https://youtube.com/example',
            },
            email: {
              type: 'string',
              nullable: true,
              example: 'contato@example.com',
            },
          },
        },
        WebsiteHeaderPage: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'header-uuid' },
            subtitulo: { type: 'string', example: 'Subtítulo' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/header.jpg',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            buttonLink: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            page: {
              type: 'string',
              enum: [
                'SOBRE',
                'RECRUTAMENTO',
                'TREINAMENTO',
                'CONTATO',
                'BLOG',
                'CURSOS',
                'POLITICA_PRIVACIDADE',
                'OUVIDORIA',
              ],
              example: 'SOBRE',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        WebsiteHeaderPageCreateInput: {
          type: 'object',
          required: [
            'subtitulo',
            'titulo',
            'descricao',
            'imagemUrl',
            'buttonLabel',
            'buttonLink',
            'page',
          ],
          properties: {
            subtitulo: { type: 'string', example: 'Subtítulo' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/header.jpg',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            buttonLink: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            page: {
              type: 'string',
              enum: [
                'SOBRE',
                'RECRUTAMENTO',
                'TREINAMENTO',
                'CONTATO',
                'BLOG',
                'CURSOS',
                'POLITICA_PRIVACIDADE',
                'OUVIDORIA',
              ],
              example: 'SOBRE',
            },
          },
        },
        WebsiteHeaderPageUpdateInput: {
          type: 'object',
          properties: {
            subtitulo: { type: 'string', example: 'Subtítulo' },
            titulo: { type: 'string', example: 'Título' },
            descricao: { type: 'string', example: 'Descrição' },
            imagemUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.example.com/header.jpg',
            },
            buttonLabel: { type: 'string', example: 'Saiba mais' },
            buttonLink: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com',
            },
            page: {
              type: 'string',
              enum: [
                'SOBRE',
                'RECRUTAMENTO',
                'TREINAMENTO',
                'CONTATO',
                'BLOG',
                'CURSOS',
                'POLITICA_PRIVACIDADE',
                'OUVIDORIA',
              ],
              example: 'SOBRE',
            },
          },
        },
        PlanoEmpresarial: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'plano-uuid' },
            icon: { type: 'string', example: 'ph-buildings' },
            nome: { type: 'string', example: 'Plano Corporativo' },
            descricao: {
              type: 'string',
              example: 'Soluções completas de RH e treinamento para empresas.',
            },
            valor: { type: 'string', example: '199.90' },
            desconto: {
              type: 'number',
              nullable: true,
              example: 10,
              description: 'Percentual de desconto aplicado sobre o valor do plano',
            },
            quantidadeVagas: {
              type: 'integer',
              example: 10,
              description: 'Quantidade de vagas que a empresa pode manter entre PUBLICADO e EM_ANALISE',
            },
            vagaEmDestaque: {
              type: 'boolean',
              example: true,
              description: 'Indica se o plano permite vagas em destaque no site',
            },
            quantidadeVagasDestaque: {
              type: 'integer',
              nullable: true,
              example: 2,
              description: 'Limite de vagas simultâneas com destaque quando habilitado',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-02T12:00:00Z',
            },
          },
        },
        PlanoEmpresarialCreateInput: {
          type: 'object',
          required: ['icon', 'nome', 'descricao', 'valor', 'quantidadeVagas', 'vagaEmDestaque'],
          properties: {
            icon: {
              type: 'string',
              example: 'ph-buildings',
              description: 'Identificador do ícone exibido no site',
            },
            nome: {
              type: 'string',
              example: 'Plano Corporativo',
              description: 'Nome comercial do plano',
            },
            descricao: {
              type: 'string',
              example: 'Soluções completas de RH e treinamento para empresas.',
            },
            valor: {
              type: 'string',
              example: '199.90',
              description: 'Valor monetário com até duas casas decimais',
            },
            desconto: {
              type: 'number',
              nullable: true,
              example: 10,
              description: 'Percentual de desconto opcional aplicado sobre o valor do plano',
            },
            quantidadeVagas: {
              type: 'integer',
              example: 10,
              description: 'Quantidade total de vagas permitidas no plano (PUBLICADO + EM_ANALISE)',
            },
            vagaEmDestaque: {
              type: 'boolean',
              example: true,
              description: 'Define se o plano permite cadastrar vagas em destaque',
            },
            quantidadeVagasDestaque: {
              type: 'integer',
              nullable: true,
              example: 2,
              description: 'Quantidade de vagas em destaque permitidas quando habilitado',
            },
          },
        },
        PlanoEmpresarialUpdateInput: {
          type: 'object',
          properties: {
            icon: { type: 'string', example: 'ph-shield-check' },
            nome: { type: 'string', example: 'Plano Enterprise' },
            descricao: {
              type: 'string',
              example: 'Atualização do pacote com suporte dedicado para grandes contas.',
            },
            valor: {
              type: 'string',
              example: '249.90',
              description: 'Novo valor monetário do plano',
            },
            desconto: {
              type: 'number',
              nullable: true,
              example: 15,
              description: 'Percentual de desconto aplicado sobre o valor do plano',
            },
            quantidadeVagas: {
              type: 'integer',
              example: 15,
              description: 'Atualização da quantidade total de vagas permitidas',
            },
            vagaEmDestaque: {
              type: 'boolean',
              example: false,
              description: 'Permite habilitar ou desabilitar vagas em destaque',
            },
            quantidadeVagasDestaque: {
              type: 'integer',
              nullable: true,
              example: 0,
              description: 'Limite de vagas em destaque. Deve ser omitido quando vagaEmDestaque for falso',
            },
          },
        },
        PlanoEmpresarialLimitResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: {
              type: 'string',
              example: 'PLANOS_EMPRESARIAIS_LIMIT_REACHED',
            },
            message: {
              type: 'string',
              example: 'Limite máximo de 4 planos empresariais atingido',
            },
            limite: { type: 'integer', example: 4 },
          },
        },
        ClientePlanoTipo: {
          type: 'string',
          enum: ['7_dias', '15_dias', '30_dias', '60_dias', '90dias', '120_dias', 'parceiro'],
          example: '7_dias',
        },
        ClientePlanoEmpresa: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'empresa-uuid' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            avatarUrl: { type: 'string', nullable: true, example: 'https://cdn.advance.com.br/avatar.png' },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria em RH especializada em recrutamento.',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/advancemais',
              description: 'Retorna null quando a vaga é publicada em modo anônimo',
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/advancemais',
              description: 'Retorna null quando a vaga é publicada em modo anônimo',
            },
            codUsuario: { type: 'string', example: 'ABC1234' },
          },
        },
        EmpresaClientePlano: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'parceria-uuid' },
            usuarioId: { type: 'string', example: 'usuario-uuid' },
            planoEmpresarialId: { type: 'string', example: 'plano-uuid' },
            tipo: { $ref: '#/components/schemas/ClientePlanoTipo' },
            inicio: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00Z' },
            fim: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-08T12:00:00Z',
            },
            ativo: { type: 'boolean', example: true },
            observacao: {
              type: 'string',
              nullable: true,
              example: 'Teste liberado pelo time comercial',
            },
            estaVigente: {
              type: 'boolean',
              example: true,
              description: 'Indica se o plano está válido considerando a data atual',
            },
            diasRestantes: {
              type: 'integer',
              nullable: true,
              example: 6,
              description: 'Quantidade de dias restantes até o encerramento do plano',
            },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-01-02T12:00:00Z' },
            empresa: {
              allOf: [{ $ref: '#/components/schemas/ClientePlanoEmpresa' }],
              nullable: true,
            },
            plano: { $ref: '#/components/schemas/PlanoEmpresarial' },
          },
        },
        EmpresaClientePlanoCreateInput: {
          type: 'object',
          required: ['usuarioId', 'planoEmpresarialId', 'tipo'],
          properties: {
            usuarioId: { type: 'string', format: 'uuid', example: 'usuario-uuid' },
            planoEmpresarialId: { type: 'string', format: 'uuid', example: 'plano-uuid' },
            tipo: { $ref: '#/components/schemas/ClientePlanoTipo' },
            iniciarEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-01T08:00:00Z',
            },
            observacao: {
              type: 'string',
              nullable: true,
              example: 'Plano liberado para demonstração por 7 dias',
            },
          },
        },
        EmpresaClientePlanoUpdateInput: {
          type: 'object',
          properties: {
            planoEmpresarialId: {
              type: 'string',
              format: 'uuid',
              example: 'novo-plano-uuid',
            },
            tipo: { $ref: '#/components/schemas/ClientePlanoTipo' },
            iniciarEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-05T09:00:00Z',
            },
            observacao: {
              type: 'string',
              nullable: true,
              example: 'Parceiro oficial, acesso ilimitado',
            },
          },
        },
        EmpresaSemPlanoAtivoResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'EMPRESA_SEM_PLANO_ATIVO' },
            message: {
              type: 'string',
              example: 'A empresa não possui um plano parceiro ativo no momento.',
            },
          },
        },
        PlanoClienteLimiteVagasResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: {
              type: 'string',
              example: 'PLANO_EMPRESARIAL_LIMIT_VAGAS',
            },
            message: {
              type: 'string',
              example: 'O limite de vagas simultâneas do plano foi atingido.',
            },
            limite: { type: 'integer', example: 10 },
          },
        },
        StatusVaga: {
          type: 'string',
          description: 'Etapas do fluxo de publicação da vaga',
          enum: ['RASCUNHO', 'EM_ANALISE', 'PUBLICADO', 'EXPIRADO'],
          example: 'EM_ANALISE',
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            pageSize: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 120 },
            totalPages: { type: 'integer', example: 6 },
          },
        },
        AdminEmpresaPlanoResumo: {
          type: 'object',
          description: 'Resumo do plano ativo vinculado à empresa',
          required: ['id', 'tipo'],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'plano-uuid' },
            nome: { type: 'string', nullable: true, example: 'Plano Avançado' },
            tipo: {
              type: 'string',
              enum: ['7_dias', '15_dias', '30_dias', '60_dias', '90dias', '120_dias', 'assinatura_mensal', 'parceiro'],
              example: 'parceiro',
            },
            inicio: { type: 'string', format: 'date-time', nullable: true, example: '2024-01-10T12:00:00Z' },
            fim: { type: 'string', format: 'date-time', nullable: true, example: '2024-02-10T12:00:00Z' },
            modeloPagamento: {
              allOf: [{ $ref: '#/components/schemas/ModeloPagamento' }],
              nullable: true,
            },
            metodoPagamento: {
              allOf: [{ $ref: '#/components/schemas/MetodoPagamento' }],
              nullable: true,
            },
            statusPagamento: {
              allOf: [{ $ref: '#/components/schemas/StatusPagamento' }],
              nullable: true,
            },
            valor: {
              type: 'string',
              nullable: true,
              example: '199.90',
              description: 'Valor bruto do plano associado, quando disponível',
            },
            quantidadeVagas: { type: 'integer', nullable: true, example: 3 },
            duracaoEmDias: {
              type: 'integer',
              nullable: true,
              example: 30,
              description: 'Quantidade total de dias entre o início e o fim configurado para o plano',
            },
            diasRestantes: {
              type: 'integer',
              nullable: true,
              example: 12,
              description: 'Dias restantes até o término do plano considerando a data atual',
            },
          },
          example: {
            id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
            nome: 'Plano Avançado',
            tipo: 'assinatura_mensal',
            inicio: '2024-01-10T12:00:00Z',
            fim: null,
            modeloPagamento: 'ASSINATURA',
            metodoPagamento: 'PIX',
            statusPagamento: 'APROVADO',
            valor: '249.90',
            quantidadeVagas: 5,
            duracaoEmDias: null,
            diasRestantes: null,
          },
        },
        AdminEmpresaListItem: {
          type: 'object',
          description: 'Dados resumidos da empresa para listagem administrativa',
          required: [
            'id',
            'codUsuario',
            'nome',
            'email',
            'telefone',
            'criadoEm',
            'ativa',
            'parceira',
            'vagasPublicadas',
            'limiteVagasPlano',
            'banida',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'empresa-uuid' },
            codUsuario: { type: 'string', example: 'EMP-123456' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advance.com.br',
              description: 'E-mail principal cadastrado pela empresa',
            },
            telefone: {
              type: 'string',
              example: '+55 11 99999-0000',
              description: 'Telefone de contato informado no cadastro',
            },
            avatarUrl: { type: 'string', nullable: true, example: 'https://cdn.advance.com.br/logo.png' },
            cnpj: { type: 'string', nullable: true, example: '12345678000190' },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-01-05T12:00:00Z' },
            ativa: { type: 'boolean', example: true },
            parceira: { type: 'boolean', example: true },
            diasTesteDisponibilizados: { type: 'integer', nullable: true, example: 30 },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresaPlanoResumo' }],
              nullable: true,
            },
            vagasPublicadas: {
              type: 'integer',
              example: 8,
              description: 'Quantidade de vagas com status PUBLICADO criadas pela empresa',
            },
            limiteVagasPlano: {
              type: 'integer',
              nullable: true,
              example: 10,
              description: 'Limite de vagas simultâneas definido pelo plano atual',
            },
            banida: {
              type: 'boolean',
              example: false,
              description: 'Indica se a empresa possui um banimento ativo no momento da consulta',
            },
            banimentoAtivo: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresaBanimentoResumo' }],
              nullable: true,
            },
          },
          example: {
            id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
            codUsuario: 'EMP-123456',
            nome: 'Advance Tech Consultoria',
            email: 'contato@advance.com.br',
            telefone: '+55 11 99999-0000',
            avatarUrl: 'https://cdn.advance.com.br/logo.png',
            cnpj: '12345678000190',
            cidade: 'São Paulo',
            estado: 'SP',
            criadoEm: '2024-01-05T12:00:00Z',
            ativa: true,
            parceira: true,
            diasTesteDisponibilizados: 30,
            plano: {
              id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
              nome: 'Plano Avançado',
              tipo: 'assinatura_mensal',
              inicio: '2024-01-10T12:00:00Z',
              fim: null,
              modeloPagamento: 'ASSINATURA',
              metodoPagamento: 'PIX',
              statusPagamento: 'APROVADO',
              valor: '249.90',
              quantidadeVagas: 5,
              duracaoEmDias: null,
              diasRestantes: null,
            },
            vagasPublicadas: 8,
            limiteVagasPlano: 10,
            banida: false,
            banimentoAtivo: null,
          },
        },
        AdminEmpresaPlanoInput: {
          type: 'object',
          required: ['planoEmpresarialId', 'tipo'],
          properties: {
            planoEmpresarialId: {
              type: 'string',
              format: 'uuid',
              example: 'plano-uuid',
              description: 'Identificador do plano empresarial que será vinculado à empresa',
            },
            tipo: {
              allOf: [{ $ref: '#/components/schemas/ClientePlanoTipo' }],
              description: 'Tipo de duração/liberação do plano parceiro',
            },
            iniciarEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-01T12:00:00Z',
              description: 'Data de início do plano. Quando omitido, utiliza a data atual',
            },
            observacao: {
              type: 'string',
              nullable: true,
              example: 'Plano cortesia liberado pelo time comercial',
              description: 'Observação interna sobre a concessão do plano',
            },
          },
          example: {
            planoEmpresarialId: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e',
            tipo: '30_dias',
            iniciarEm: '2024-03-01T12:00:00Z',
            observacao: 'Plano cortesia liberado pelo time comercial',
          },
        },
        AdminEmpresaPlanoUpdateInput: {
          allOf: [
            { $ref: '#/components/schemas/AdminEmpresaPlanoInput' },
            {
              type: 'object',
              properties: {
                resetPeriodo: {
                  type: 'boolean',
                  description:
                    'Quando verdadeiro, reinicia os campos de início e fim do novo plano. Caso não seja enviado, mantém as datas anteriores.',
                  example: true,
                },
              },
            },
          ],
          example: {
            planoEmpresarialId: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e',
            tipo: '60_dias',
            resetPeriodo: true,
            observacao: 'Extensão negociada com o cliente',
          },
        },
        AdminEmpresaCreateInput: {
          type: 'object',
          required: ['nome', 'email', 'telefone', 'senha', 'supabaseId', 'cnpj'],
          properties: {
            nome: {
              type: 'string',
              example: 'Advance Tech Consultoria',
              description: 'Nome fantasia da empresa',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advancetech.com.br',
              description: 'E-mail principal utilizado pela empresa',
            },
            telefone: {
              type: 'string',
              example: '11987654321',
              description: 'Telefone de contato direto com a empresa',
            },
            senha: {
              type: 'string',
              example: 'SenhaForte123!',
              description: 'Senha inicial que será criptografada antes de salvar',
            },
            supabaseId: {
              type: 'string',
              example: 'supabase-user-id',
              description: 'Identificador do usuário correspondente no Supabase',
            },
            cnpj: {
              type: 'string',
              example: '12345678000190',
              description: 'CNPJ da empresa, apenas números',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: {
              type: 'string',
              nullable: true,
              example: 'SP',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria especializada em recrutamento e seleção.',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/advancemais',
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/advancemais',
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/logo.png',
            },
            aceitarTermos: {
              type: 'boolean',
              example: true,
              description: 'Indica se os termos de uso já foram aceitos em nome da empresa',
            },
            status: {
              type: 'string',
              nullable: true,
              enum: ['ATIVO', 'INATIVO', 'BANIDO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
              description: 'Status inicial da conta da empresa. Padrão: ATIVO',
            },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresaPlanoInput' }],
              nullable: true,
              description: 'Dados opcionais para já vincular um plano empresarial ativo',
            },
          },
          example: {
            nome: 'Advance Tech Consultoria',
            email: 'contato@advancetech.com.br',
            telefone: '11987654321',
            senha: 'SenhaForte123!',
            supabaseId: 'supabase-user-id',
            cnpj: '12345678000190',
            cidade: 'São Paulo',
            estado: 'SP',
            descricao: 'Consultoria especializada em recrutamento e seleção.',
            instagram: 'https://instagram.com/advancemais',
            linkedin: 'https://linkedin.com/company/advancemais',
            avatarUrl: 'https://cdn.advance.com.br/logo.png',
            aceitarTermos: true,
            plano: {
              planoEmpresarialId: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e',
              tipo: '30_dias',
            },
          },
        },
        AdminEmpresaUpdateInput: {
          type: 'object',
          description: 'Informe ao menos um campo para atualização',
          properties: {
            nome: {
              type: 'string',
              example: 'Advance Tech Consultoria LTDA',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advancetech.com.br',
            },
            telefone: {
              type: 'string',
              example: '11912345678',
            },
            cnpj: {
              type: 'string',
              nullable: true,
              example: '12345678000190',
            },
            cidade: {
              type: 'string',
              nullable: true,
              example: 'São Paulo',
            },
            estado: {
              type: 'string',
              nullable: true,
              example: 'SP',
            },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria especializada em recrutamento e seleção com foco em tecnologia.',
            },
            instagram: {
              type: 'string',
              nullable: true,
              example: 'https://instagram.com/advancemais',
            },
            linkedin: {
              type: 'string',
              nullable: true,
              example: 'https://linkedin.com/company/advancemais',
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/logo.png',
            },
            status: {
              type: 'string',
              nullable: true,
              enum: ['ATIVO', 'INATIVO', 'BANIDO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
            },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresaPlanoUpdateInput' }],
              nullable: true,
              description: 'Envie null para encerrar o plano atual da empresa',
            },
          },
          example: {
            nome: 'Advance Tech Consultoria LTDA',
            telefone: '11912345678',
            descricao: 'Consultoria especializada em tecnologia e inovação.',
            instagram: 'https://instagram.com/advancetech',
            status: 'ATIVO',
            plano: {
              planoEmpresarialId: 'b8d96a94-8a3d-4b90-8421-6f0a7bc1d42e',
              tipo: '60_dias',
              resetPeriodo: false,
            },
          },
        },
        AdminEmpresasListResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaListItem' },
            },
            pagination: {
              allOf: [{ $ref: '#/components/schemas/PaginationMeta' }],
            },
          },
          example: {
            data: [
              {
                id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
                codUsuario: 'EMP-123456',
                nome: 'Advance Tech Consultoria',
                email: 'contato@advance.com.br',
                telefone: '+55 11 99999-0000',
                avatarUrl: 'https://cdn.advance.com.br/logo.png',
                cnpj: '12345678000190',
                cidade: 'São Paulo',
                estado: 'SP',
                criadoEm: '2024-01-05T12:00:00Z',
                ativa: true,
                parceira: true,
                diasTesteDisponibilizados: 30,
                plano: {
                  id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
                  nome: 'Plano Avançado',
                  tipo: 'assinatura_mensal',
                  inicio: '2024-01-10T12:00:00Z',
                  fim: null,
                  modeloPagamento: 'ASSINATURA',
                  metodoPagamento: 'PIX',
                  statusPagamento: 'APROVADO',
                  valor: '249.90',
                  quantidadeVagas: 5,
                  duracaoEmDias: null,
                  diasRestantes: null,
                },
                vagasPublicadas: 8,
                limiteVagasPlano: 10,
                banida: false,
                banimentoAtivo: null,
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminEmpresaDetail: {
          type: 'object',
          description: 'Informações detalhadas da empresa para o painel administrativo',
          required: [
            'id',
            'codUsuario',
            'nome',
            'email',
            'telefone',
            'criadoEm',
            'status',
            'ativa',
            'parceira',
            'vagas',
            'banida',
            'pagamento',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'empresa-uuid' },
            codUsuario: { type: 'string', example: 'EMP-123456' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            email: {
              type: 'string',
              format: 'email',
              example: 'contato@advance.com.br',
              description: 'E-mail principal cadastrado pela empresa',
            },
            telefone: {
              type: 'string',
              example: '+55 11 99999-0000',
              description: 'Telefone de contato informado no cadastro',
            },
            avatarUrl: { type: 'string', nullable: true, example: 'https://cdn.advance.com.br/logo.png' },
            cnpj: { type: 'string', nullable: true, example: '12345678000190' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria especializada em recrutamento e seleção para empresas de tecnologia.',
            },
            instagram: { type: 'string', nullable: true, example: 'https://instagram.com/advancemais' },
            linkedin: { type: 'string', nullable: true, example: 'https://linkedin.com/company/advancemais' },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            criadoEm: { type: 'string', format: 'date-time', example: '2023-11-01T08:30:00Z' },
            status: {
              type: 'string',
              enum: ['ATIVO', 'INATIVO', 'BANIDO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
            },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-03-15T18:45:00Z',
            },
            ativa: { type: 'boolean', example: true },
            parceira: { type: 'boolean', example: true },
            diasTesteDisponibilizados: { type: 'integer', nullable: true, example: 30 },
            plano: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresaPlanoResumo' }],
              nullable: true,
            },
            banimentoAtivo: {
              allOf: [{ $ref: '#/components/schemas/AdminEmpresaBanimentoResumo' }],
              nullable: true,
            },
            vagas: {
              type: 'object',
              properties: {
                publicadas: { type: 'integer', example: 1 },
                limitePlano: { type: 'integer', nullable: true, example: 3 },
              },
            },
            banida: {
              type: 'boolean',
              example: false,
              description: 'Indica se a empresa possui um banimento ativo',
            },
            pagamento: {
              type: 'object',
              properties: {
                modelo: {
                  allOf: [{ $ref: '#/components/schemas/ModeloPagamento' }],
                  nullable: true,
                },
                metodo: {
                  allOf: [{ $ref: '#/components/schemas/MetodoPagamento' }],
                  nullable: true,
                },
                status: {
                  allOf: [{ $ref: '#/components/schemas/StatusPagamento' }],
                  nullable: true,
                },
                ultimoPagamentoEm: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-01-15T14:20:00Z',
                },
              },
            },
          },
          example: {
            id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
            codUsuario: 'EMP-123456',
            nome: 'Advance Tech Consultoria',
            email: 'contato@advance.com.br',
            telefone: '+55 11 99999-0000',
            avatarUrl: 'https://cdn.advance.com.br/logo.png',
            cnpj: '12345678000190',
            descricao: 'Consultoria especializada em recrutamento e seleção para empresas de tecnologia.',
            instagram: 'https://instagram.com/advancemais',
            linkedin: 'https://linkedin.com/company/advancemais',
            cidade: 'São Paulo',
            estado: 'SP',
            criadoEm: '2023-11-01T08:30:00Z',
            status: 'ATIVO',
            ultimoLogin: '2024-03-15T18:45:00Z',
            ativa: true,
            parceira: true,
            diasTesteDisponibilizados: 30,
            plano: {
              id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
              nome: 'Plano Avançado',
              tipo: 'assinatura_mensal',
              inicio: '2024-01-10T12:00:00Z',
              fim: null,
              modeloPagamento: 'ASSINATURA',
              metodoPagamento: 'PIX',
              statusPagamento: 'APROVADO',
              valor: '249.90',
              quantidadeVagas: 5,
              duracaoEmDias: null,
              diasRestantes: null,
            },
            banimentoAtivo: null,
            vagas: {
              publicadas: 8,
              limitePlano: 10,
            },
            banida: false,
            pagamento: {
              modelo: 'ASSINATURA',
              metodo: 'PIX',
              status: 'APROVADO',
              ultimoPagamentoEm: '2024-02-15T14:20:00Z',
            },
          },
        },
        AdminEmpresaDetailResponse: {
          type: 'object',
          required: ['empresa'],
          properties: {
            empresa: { $ref: '#/components/schemas/AdminEmpresaDetail' },
          },
          example: {
            empresa: {
              id: 'f66fbad9-4d3c-41f7-90df-2f4f0f32af10',
              codUsuario: 'EMP-123456',
              nome: 'Advance Tech Consultoria',
              email: 'contato@advance.com.br',
              telefone: '+55 11 99999-0000',
              avatarUrl: 'https://cdn.advance.com.br/logo.png',
              cnpj: '12345678000190',
              descricao: 'Consultoria especializada em recrutamento e seleção para empresas de tecnologia.',
              instagram: 'https://instagram.com/advancemais',
              linkedin: 'https://linkedin.com/company/advancemais',
              cidade: 'São Paulo',
              estado: 'SP',
              criadoEm: '2023-11-01T08:30:00Z',
              status: 'ATIVO',
              ultimoLogin: '2024-03-15T18:45:00Z',
              ativa: true,
              parceira: true,
              diasTesteDisponibilizados: 30,
              plano: {
                id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
                nome: 'Plano Avançado',
                tipo: 'assinatura_mensal',
                inicio: '2024-01-10T12:00:00Z',
                fim: null,
                modeloPagamento: 'ASSINATURA',
                metodoPagamento: 'PIX',
                statusPagamento: 'APROVADO',
                valor: '249.90',
                quantidadeVagas: 5,
                duracaoEmDias: null,
                diasRestantes: null,
              },
              banimentoAtivo: null,
              vagas: {
                publicadas: 8,
                limitePlano: 10,
              },
              banida: false,
              pagamento: {
                modelo: 'ASSINATURA',
                metodo: 'PIX',
                status: 'APROVADO',
                ultimoPagamentoEm: '2024-02-15T14:20:00Z',
              },
            },
          },
        },
        AdminEmpresaBanimentoResumo: {
          type: 'object',
          description: 'Informações resumidas sobre um banimento aplicado à empresa',
          required: ['id', 'dias', 'inicio', 'fim', 'criadoEm'],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'ban-uuid' },
            motivo: {
              type: 'string',
              nullable: true,
              example: 'Uso indevido da plataforma',
            },
            dias: { type: 'integer', example: 30 },
            inicio: { type: 'string', format: 'date-time', example: '2024-04-01T00:00:00Z' },
            fim: { type: 'string', format: 'date-time', example: '2024-04-30T23:59:59Z' },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-04-01T00:00:00Z' },
          },
          example: {
            id: 'c0b3ad1e-88af-4b94-9e67-71b7dcb845e0',
            motivo: 'Uso indevido da plataforma',
            dias: 30,
            inicio: '2024-04-01T00:00:00Z',
            fim: '2024-04-30T23:59:59Z',
            criadoEm: '2024-04-01T00:00:00Z',
          },
        },
        AdminEmpresaPagamentoLog: {
          type: 'object',
          description: 'Evento de pagamento registrado para a empresa',
          required: ['id', 'tipo', 'status', 'mensagem', 'externalRef', 'mpResourceId', 'criadoEm', 'plano'],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'log-uuid' },
            tipo: { type: 'string', example: 'ASSINATURA' },
            status: { type: 'string', nullable: true, example: 'APROVADO' },
            mensagem: {
              type: 'string',
              nullable: true,
              example: 'Pagamento confirmado pelo provedor',
            },
            externalRef: {
              type: 'string',
              nullable: true,
              example: 'MP-123456789',
            },
            mpResourceId: {
              type: 'string',
              nullable: true,
              example: 'res_ABC123',
            },
            criadoEm: { type: 'string', format: 'date-time', example: '2024-02-10T12:00:00Z' },
            plano: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid', example: 'plano-uuid' },
                nome: { type: 'string', nullable: true, example: 'Plano Premium' },
              },
            },
          },
          example: {
            id: '729480a9-8e05-4b42-b826-f8db7e5a4d2c',
            tipo: 'ASSINATURA',
            status: 'APROVADO',
            mensagem: 'Pagamento confirmado pelo provedor',
            externalRef: 'MP-123456789',
            mpResourceId: 'res_ABC123',
            criadoEm: '2024-02-10T12:00:00Z',
            plano: {
              id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
              nome: 'Plano Avançado',
            },
          },
        },
        AdminEmpresasPagamentosResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaPagamentoLog' },
            },
            pagination: { allOf: [{ $ref: '#/components/schemas/PaginationMeta' }] },
          },
          example: {
            data: [
              {
                id: '729480a9-8e05-4b42-b826-f8db7e5a4d2c',
                tipo: 'ASSINATURA',
                status: 'APROVADO',
                mensagem: 'Pagamento confirmado pelo provedor',
                externalRef: 'MP-123456789',
                mpResourceId: 'res_ABC123',
                criadoEm: '2024-02-10T12:00:00Z',
                plano: {
                  id: '38f73d2d-40fa-47a6-9657-6a4f7f1bb610',
                  nome: 'Plano Avançado',
                },
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminEmpresasBanimentosResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaBanimentoResumo' },
            },
            pagination: { allOf: [{ $ref: '#/components/schemas/PaginationMeta' }] },
          },
          example: {
            data: [
              {
                id: 'c0b3ad1e-88af-4b94-9e67-71b7dcb845e0',
                motivo: 'Uso indevido da plataforma',
                dias: 30,
                inicio: '2024-04-01T00:00:00Z',
                fim: '2024-04-30T23:59:59Z',
                criadoEm: '2024-04-01T00:00:00Z',
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminEmpresaBanimentoCreate: {
          type: 'object',
          required: ['dias'],
          properties: {
            dias: {
              type: 'integer',
              minimum: 1,
              maximum: 3650,
              example: 120,
              description: 'Quantidade de dias que o banimento ficará ativo',
            },
            motivo: {
              type: 'string',
              example: 'Descumprimento do código de conduta',
              description: 'Motivo opcional para o banimento (máximo 500 caracteres)',
            },
          },
        },
        AdminEmpresaBanimentoResponse: {
          type: 'object',
          required: ['banimento'],
          properties: {
            banimento: { $ref: '#/components/schemas/AdminEmpresaBanimentoResumo' },
          },
          example: {
            banimento: {
              id: 'c0b3ad1e-88af-4b94-9e67-71b7dcb845e0',
              motivo: 'Uso indevido da plataforma',
              dias: 30,
              inicio: '2024-04-01T00:00:00Z',
              fim: '2024-04-30T23:59:59Z',
              criadoEm: '2024-04-01T00:00:00Z',
            },
          },
        },
        AdminEmpresaVagaResumo: {
          type: 'object',
          description: 'Resumo de vaga para listagens administrativas',
          required: [
            'id',
            'codigo',
            'titulo',
            'status',
            'inseridaEm',
            'atualizadoEm',
            'modoAnonimo',
            'modalidade',
            'regimeDeTrabalho',
            'paraPcd',
          ],
          properties: {
            id: { type: 'string', format: 'uuid', example: 'vaga-uuid' },
            codigo: {
              type: 'string',
              maxLength: 6,
              example: 'B24N56',
              description: 'Identificador curto utilizado pelos administradores para localizar a vaga com rapidez.',
            },
            titulo: {
              type: 'string',
              maxLength: 255,
              example: 'Analista de Dados Pleno',
              description: 'Nome público da vaga informado pela empresa no momento do cadastro.',
            },
            status: { allOf: [{ $ref: '#/components/schemas/StatusVaga' }] },
            inseridaEm: { type: 'string', format: 'date-time', example: '2024-05-10T09:00:00Z' },
            atualizadoEm: { type: 'string', format: 'date-time', example: '2024-05-12T11:30:00Z' },
            inscricoesAte: { type: 'string', format: 'date-time', nullable: true, example: '2024-06-01T23:59:59Z' },
            modoAnonimo: { type: 'boolean', example: false },
            modalidade: {
              type: 'string',
              enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'],
              example: 'REMOTO',
            },
            regimeDeTrabalho: {
              type: 'string',
              enum: ['CLT', 'TEMPORARIO', 'ESTAGIO', 'PJ', 'HOME_OFFICE', 'JOVEM_APRENDIZ'],
              example: 'CLT',
            },
            paraPcd: { type: 'boolean', example: false },
          },
          example: {
            id: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
            codigo: 'B24N56',
            titulo: 'Analista de Dados Pleno',
            status: 'PUBLICADO',
            inseridaEm: '2024-05-10T09:00:00Z',
            atualizadoEm: '2024-05-12T11:30:00Z',
            inscricoesAte: '2024-06-01T23:59:59Z',
            modoAnonimo: false,
            modalidade: 'REMOTO',
            regimeDeTrabalho: 'CLT',
            paraPcd: false,
          },
        },
        AdminEmpresasVagasResponse: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminEmpresaVagaResumo' },
            },
            pagination: { allOf: [{ $ref: '#/components/schemas/PaginationMeta' }] },
          },
          example: {
            data: [
              {
                id: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
                codigo: 'B24N56',
                titulo: 'Analista de Dados Pleno',
                status: 'PUBLICADO',
                inseridaEm: '2024-05-10T09:00:00Z',
                atualizadoEm: '2024-05-12T11:30:00Z',
                inscricoesAte: '2024-06-01T23:59:59Z',
                modoAnonimo: false,
                modalidade: 'REMOTO',
                regimeDeTrabalho: 'CLT',
                paraPcd: false,
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
        },
        AdminEmpresaVagaAprovacaoResponse: {
          type: 'object',
          required: ['vaga'],
          properties: {
            vaga: { $ref: '#/components/schemas/AdminEmpresaVagaResumo' },
          },
          example: {
            vaga: {
              id: '7a5b9c1d-2f80-44a6-82da-6b8c1f00ec91',
              codigo: 'B24N56',
              titulo: 'Analista de Dados Pleno',
              status: 'PUBLICADO',
              inseridaEm: '2024-05-10T09:00:00Z',
              atualizadoEm: '2024-05-12T11:30:00Z',
              inscricoesAte: '2024-06-01T23:59:59Z',
              modoAnonimo: false,
              modalidade: 'REMOTO',
              regimeDeTrabalho: 'CLT',
              paraPcd: false,
            },
          },
        },
        EmpresaResumo: {
          type: 'object',
          description: 'Informações públicas da empresa vinculada à vaga',
          properties: {
            id: { type: 'string', example: 'empresa-uuid' },
            nome: { type: 'string', example: 'Advance Tech Consultoria' },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.advance.com.br/assets/empresa/avatar.png',
            },
            cidade: { type: 'string', nullable: true, example: 'São Paulo' },
            estado: { type: 'string', nullable: true, example: 'SP' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria em RH e tecnologia especializada em recrutamento.',
            },
            instagram: { type: 'string', nullable: true, example: 'https://instagram.com/advancemais' },
            linkedin: { type: 'string', nullable: true, example: 'https://linkedin.com/company/advancemais' },
            codUsuario: { type: 'string', example: 'ABC1234' },
          },
        },
        Vaga: {
          type: 'object',
          description: 'Representação completa da vaga cadastrada pela empresa',
          properties: {
            id: { type: 'string', example: 'vaga-uuid' },
            codigo: {
              type: 'string',
              maxLength: 6,
              example: 'B24N56',
              description: 'Identificador curto da vaga gerado automaticamente para facilitar buscas internas.',
              readOnly: true,
            },
            usuarioId: { type: 'string', example: 'usuario-uuid' },
            empresa: {
              allOf: [{ $ref: '#/components/schemas/EmpresaResumo' }],
              nullable: true,
            },
            modoAnonimo: { type: 'boolean', example: true },
            regimeDeTrabalho: {
              type: 'string',
              enum: ['CLT', 'TEMPORARIO', 'ESTAGIO', 'PJ', 'HOME_OFFICE', 'JOVEM_APRENDIZ'],
              example: 'CLT',
            },
            modalidade: {
              type: 'string',
              enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'],
              example: 'PRESENCIAL',
            },
            titulo: {
              type: 'string',
              maxLength: 255,
              example: 'Coordenador de Projetos TI',
            },
            paraPcd: { type: 'boolean', example: false },
            requisitos: {
              type: 'string',
              example: 'Experiência com atendimento ao cliente e pacote Office avançado.',
            },
            atividades: {
              type: 'string',
              example: 'Atendimento a clientes, elaboração de relatórios e acompanhamento de indicadores.',
            },
            beneficios: {
              type: 'string',
              example: 'Vale transporte, vale alimentação, plano de saúde e day-off no aniversário.',
            },
            observacoes: {
              type: 'string',
              nullable: true,
              example: 'Processo seletivo confidencial com etapas online.',
            },
            cargaHoraria: {
              type: 'string',
              example: '44 horas semanais (segunda a sexta-feira)',
            },
            inscricoesAte: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-12-20T23:59:59Z',
            },
            inseridaEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-01T09:00:00Z',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-05T09:00:00Z',
            },
            status: {
              allOf: [{ $ref: '#/components/schemas/StatusVaga' }],
              description: 'Status atual da vaga dentro do fluxo de aprovação',
            },
            nomeExibicao: {
              type: 'string',
              nullable: true,
              example: 'Oportunidade Confidencial #A1B2C',
            },
            logoExibicao: {
              type: 'string',
              nullable: true,
              example: null,
            },
            mensagemAnonimato: {
              type: 'string',
              nullable: true,
              example:
                'Esta empresa optou por manter suas informações confidenciais até avançar nas etapas do processo seletivo.',
            },
            descricaoExibicao: {
              type: 'string',
              nullable: true,
              example: 'Consultoria em RH e tecnologia especializada em recrutamento.',
            },
          },
        },
        VagaCreateInput: {
          type: 'object',
          description:
            'Dados necessários para cadastrar uma vaga. O status inicial é definido automaticamente como EM_ANALISE e o código alfanumérico de 6 caracteres é gerado pelo sistema.',
          required: [
            'usuarioId',
            'regimeDeTrabalho',
            'modalidade',
            'titulo',
            'requisitos',
            'atividades',
            'beneficios',
            'cargaHoraria',
          ],
          properties: {
            usuarioId: {
              type: 'string',
              format: 'uuid',
              example: 'f1d7a9c2-4e0b-4f6d-90ad-8c6b84a0f1a1',
            },
            modoAnonimo: {
              type: 'boolean',
              example: true,
              description: 'Quando verdadeiro, oculta o nome e a logo da empresa nas listagens públicas',
            },
            regimeDeTrabalho: {
              type: 'string',
              enum: ['CLT', 'TEMPORARIO', 'ESTAGIO', 'PJ', 'HOME_OFFICE', 'JOVEM_APRENDIZ'],
              example: 'CLT',
            },
            modalidade: {
              type: 'string',
              enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'],
              example: 'PRESENCIAL',
            },
            titulo: {
              type: 'string',
              maxLength: 255,
              example: 'Analista de Marketing Digital',
              description: 'Nome da vaga que será exibido nos portais e dashboards administrativos.',
            },
            paraPcd: { type: 'boolean', example: false },
            requisitos: {
              type: 'string',
              example: 'Experiência com atendimento ao cliente e pacote Office avançado.',
            },
            atividades: {
              type: 'string',
              example: 'Atendimento a clientes, elaboração de relatórios e acompanhamento de indicadores.',
            },
            beneficios: {
              type: 'string',
              example: 'Vale transporte, vale alimentação, plano de saúde e day-off no aniversário.',
            },
            observacoes: {
              type: 'string',
              example: 'Processo seletivo confidencial com etapas online.',
            },
            cargaHoraria: {
              type: 'string',
              example: '44 horas semanais (segunda a sexta-feira)',
            },
            inscricoesAte: {
              type: 'string',
              format: 'date-time',
              example: '2024-12-20T23:59:59Z',
            },
            inseridaEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-01T09:00:00Z',
            },
          },
        },
        VagaUpdateInput: {
          type: 'object',
          description: 'Campos permitidos para atualização da vaga, inclusive o status do fluxo de aprovação.',
          properties: {
            usuarioId: {
              type: 'string',
              format: 'uuid',
              example: 'f1d7a9c2-4e0b-4f6d-90ad-8c6b84a0f1a1',
            },
            modoAnonimo: { type: 'boolean', example: false },
            regimeDeTrabalho: {
              type: 'string',
              enum: ['CLT', 'TEMPORARIO', 'ESTAGIO', 'PJ', 'HOME_OFFICE', 'JOVEM_APRENDIZ'],
              example: 'PJ',
            },
            modalidade: {
              type: 'string',
              enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'],
              example: 'HIBRIDO',
            },
            titulo: {
              type: 'string',
              maxLength: 255,
              example: 'Gerente de Operações',
            },
            paraPcd: { type: 'boolean', example: true },
            requisitos: {
              type: 'string',
              example: 'Vivência em rotinas administrativas e atendimento ao cliente.',
            },
            atividades: {
              type: 'string',
              example: 'Gestão de indicadores, acompanhamento de metas e organização de agendas.',
            },
            beneficios: {
              type: 'string',
              example: 'Vale transporte, auxílio home office e plano odontológico.',
            },
            observacoes: {
              type: 'string',
              example: 'Processo seletivo com etapas online.',
            },
            cargaHoraria: {
              type: 'string',
              example: '30 horas semanais (segunda a sexta-feira)',
            },
            inscricoesAte: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-11-15T23:59:59Z',
            },
            inseridaEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-05T09:00:00Z',
            },
            status: {
              allOf: [{ $ref: '#/components/schemas/StatusVaga' }],
              description: 'Atualização manual do status da vaga',
            },
          },
        },
        AdminModuleInfo: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Área administrativa' },
            usuario: { $ref: '#/components/schemas/UserProfile' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            permissions: {
              type: 'array',
              items: { type: 'string' },
              example: ['read', 'write'],
            },
          },
        },
        AdminUserSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user-uuid' },
            email: { type: 'string', example: 'user@example.com' },
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            role: { type: 'string', example: 'ALUNO' },
            status: { type: 'string', example: 'ATIVO' },
            tipoUsuario: { type: 'string', example: 'ALUNO' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T12:00:00Z',
            },
            _count: {
              type: 'object',
              properties: {},
            },
          },
        },
        AdminCandidateSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'candidate-uuid' },
            email: { type: 'string', example: 'candidato@example.com' },
            nomeCompleto: { type: 'string', example: 'João da Silva' },
            role: {
              type: 'string',
              enum: ['ALUNO_CANDIDATO'],
              example: 'ALUNO_CANDIDATO',
              description: 'Role atribuído automaticamente aos perfis de candidato',
            },
            status: {
              type: 'string',
              enum: ['ATIVO', 'INATIVO', 'BANIDO', 'PENDENTE', 'SUSPENSO'],
              example: 'ATIVO',
            },
            tipoUsuario: {
              type: 'string',
              enum: ['PESSOA_FISICA', 'PESSOA_JURIDICA'],
              example: 'PESSOA_FISICA',
            },
            cidade: { type: 'string', nullable: true, example: 'Maceió' },
            estado: { type: 'string', nullable: true, example: 'AL' },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
            ultimoLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-10T12:00:00Z',
            },
          },
        },
        AdminCandidateListResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Lista de candidatos' },
            candidatos: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminCandidateSummary' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  example: 1,
                  minimum: 1,
                  description: 'Página atual da paginação',
                },
                limit: {
                  type: 'integer',
                  example: 50,
                  minimum: 1,
                  maximum: 100,
                  description: 'Quantidade de registros retornados por página',
                },
                total: {
                  type: 'integer',
                  example: 100,
                  minimum: 0,
                  description: 'Total de candidatos que atendem aos filtros',
                },
                pages: {
                  type: 'integer',
                  example: 2,
                  minimum: 0,
                  description: 'Total de páginas calculado a partir do limite informado',
                },
              },
            },
          },
        },
        AdminUserListResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Lista de usuários' },
            usuarios: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminUserSummary' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 50 },
                total: { type: 'integer', example: 100 },
                pages: { type: 'integer', example: 2 },
              },
            },
          },
        },
        AdminUserDetail: {
          allOf: [
            { $ref: '#/components/schemas/AdminUserSummary' },
            {
              type: 'object',
              properties: {
                cpf: { type: 'string', example: '12345678900' },
                cnpj: { type: 'string', example: '12345678000199' },
                telefone: { type: 'string', example: '+55 11 99999-0000' },
                dataNasc: {
                  type: 'string',
                  format: 'date',
                  example: '1990-01-01',
                },
                genero: { type: 'string', example: 'MASCULINO' },
                matricula: { type: 'string', example: 'MAT123' },
                supabaseId: { type: 'string', example: 'uuid-supabase' },
                cidade: { type: 'string', nullable: true, example: 'Maceió' },
                estado: { type: 'string', nullable: true, example: 'AL' },
                avatarUrl: {
                  type: 'string',
                  nullable: true,
                  example: 'https://cdn.advance.com.br/avatar.png',
                },
                descricao: {
                  type: 'string',
                  nullable: true,
                  example: 'Empresa focada em soluções tecnológicas para RH.',
                },
                instagram: {
                  type: 'string',
                  nullable: true,
                  example: 'https://instagram.com/advancemais',
                },
                linkedin: {
                  type: 'string',
                  nullable: true,
                  example: 'https://linkedin.com/company/advancemais',
                },
                codUsuario: { type: 'string', example: 'ABC1234' },
                enderecos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'end-1' },
                      logradouro: { type: 'string', example: 'Rua A' },
                      numero: { type: 'string', example: '100' },
                      bairro: { type: 'string', example: 'Centro' },
                      cidade: { type: 'string', example: 'São Paulo' },
                      estado: { type: 'string', example: 'SP' },
                      cep: { type: 'string', example: '01000-000' },
                    },
                  },
                },
              },
            },
          ],
        },
        AdminUserDetailResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Usuário encontrado' },
            usuario: { $ref: '#/components/schemas/AdminUserDetail' },
          },
        },
        AdminCandidateDetail: {
          allOf: [
            { $ref: '#/components/schemas/AdminCandidateSummary' },
            {
              type: 'object',
              properties: {
                cpf: { type: 'string', nullable: true, example: '12345678900' },
                telefone: { type: 'string', example: '+55 11 99999-0000' },
                dataNasc: {
                  type: 'string',
                  format: 'date',
                  nullable: true,
                  example: '1990-01-01',
                },
                genero: { type: 'string', nullable: true, example: 'MASCULINO' },
                matricula: { type: 'string', nullable: true, example: 'MAT123' },
                supabaseId: { type: 'string', example: 'uuid-supabase' },
                avatarUrl: {
                  type: 'string',
                  nullable: true,
                  example: 'https://cdn.advance.com.br/avatar.png',
                },
                descricao: {
                  type: 'string',
                  nullable: true,
                  example: 'Profissional com experiência em atendimento.',
                },
                instagram: {
                  type: 'string',
                  nullable: true,
                  example: 'https://instagram.com/candidato',
                },
                linkedin: {
                  type: 'string',
                  nullable: true,
                  example: 'https://linkedin.com/in/candidato',
                },
                codUsuario: { type: 'string', example: 'CAN1234' },
                enderecos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'end-1' },
                      logradouro: { type: 'string', example: 'Rua A' },
                      numero: { type: 'string', example: '100' },
                      bairro: { type: 'string', example: 'Centro' },
                      cidade: { type: 'string', example: 'São Paulo' },
                      estado: { type: 'string', example: 'SP' },
                      cep: { type: 'string', example: '01000-000' },
                    },
                  },
                },
              },
            },
          ],
        },
        AdminCandidateDetailResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Candidato encontrado' },
            candidato: { $ref: '#/components/schemas/AdminCandidateDetail' },
          },
        },
        AdminStatusUpdateRequest: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ATIVO' },
            motivo: { type: 'string', example: 'Regularização' },
          },
          required: ['status'],
        },
        AdminStatusUpdateResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Status do usuário atualizado com sucesso',
            },
            usuario: { $ref: '#/components/schemas/AdminUserSummary' },
            statusAnterior: { type: 'string', example: 'SUSPENSO' },
          },
        },
        AdminRoleUpdateRequest: {
          type: 'object',
          properties: {
            role: { type: 'string', example: 'MODERADOR' },
            motivo: { type: 'string', example: 'Promoção' },
          },
          required: ['role'],
        },
        AdminRoleUpdateResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Role do usuário atualizada com sucesso',
            },
            usuario: { $ref: '#/components/schemas/AdminUserSummary' },
          },
        },
        UserCoursePaymentRequest: {
          type: 'object',
          properties: {
            cursoId: { type: 'string', example: 'curso-uuid' },
            paymentToken: { type: 'string', example: 'tok_123' },
            paymentMethodId: { type: 'string', example: 'visa' },
            installments: { type: 'integer', example: 1 },
            issuerId: { type: 'string', example: 'issuer' },
          },
          required: ['cursoId', 'paymentToken', 'paymentMethodId'],
        },
        UserCoursePaymentResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Pagamento iniciado com sucesso',
            },
            order: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '123' },
                status: { type: 'string', example: 'pending' },
              },
            },
            curso: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'curso-uuid' },
                titulo: { type: 'string', example: 'Curso X' },
                preco: { type: 'number', example: 100 },
              },
            },
          },
        },
        UserSubscriptionCreateRequest: {
          type: 'object',
          properties: {
            plano: { type: 'string', example: 'plano-premium' },
            cardToken: { type: 'string', example: 'tok_123' },
            frequencia: { type: 'integer', example: 1 },
            periodo: { type: 'string', example: 'months' },
          },
          required: ['plano', 'cardToken'],
        },
        UserSubscriptionCreateResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Assinatura criada' },
            subscription: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'sub-123' },
                status: { type: 'string', example: 'authorized' },
              },
            },
          },
        },
        UserSubscriptionCancelRequest: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', example: 'sub-123' },
            motivo: { type: 'string', example: 'Opção do usuário' },
          },
          required: ['subscriptionId'],
        },
        UserSubscriptionCancelResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Assinatura cancelada' },
          },
        },
        UserPaymentHistoryResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Histórico de pagamentos' },
            orders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'order-1' },
                  status: { type: 'string', example: 'paid' },
                  totalAmount: { type: 'number', example: 100 },
                  criadoEm: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-01T12:00:00Z',
                  },
                },
              },
            },
            subscriptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'sub-1' },
                  status: { type: 'string', example: 'authorized' },
                  transactionAmount: { type: 'number', example: 99.9 },
                  criadoEm: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-01T12:00:00Z',
                  },
                },
              },
            },
          },
        },
        DashboardStatsResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Estatísticas do dashboard' },
            stats: {
              type: 'object',
              additionalProperties: true,
              example: { usuariosTotais: 100, receitaTotal: 1000 },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        UserStatsResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Estatísticas de usuários' },
            stats: {
              type: 'object',
              additionalProperties: true,
              example: { novosUsuarios: 10 },
            },
            periodo: { type: 'string', example: '30d' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
            },
          },
        },
        PaymentStatsResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Estatísticas de pagamentos' },
            stats: {
              type: 'object',
              additionalProperties: true,
              example: { totalPagamentos: 100, totalReceita: 5000 },
            },
            periodo: { type: 'string', example: '30d' },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00Z',
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
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      links: {},
      callbacks: {},
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desenvolvimento',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/modules/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  const swaggerServeHandlers = swaggerUi.serve as RequestHandler[];

  const resolveSwaggerAsset = (file: string): string => {
    const distPath = path.join(__dirname, file);
    if (fs.existsSync(distPath)) return distPath;
    return path.join(process.cwd(), 'src', 'config', file);
  };

  const swaggerCustomJs = fs.readFileSync(resolveSwaggerAsset('swagger-custom.js'), 'utf8');
  const swaggerCustomCss = fs.readFileSync(resolveSwaggerAsset('swagger-custom.css'), 'utf8');

  app.get('/swagger-custom.js', (_req, res) => {
    res.type('application/javascript').send(swaggerCustomJs);
  });

  app.get('/swagger-custom.css', (_req, res) => {
    res.type('text/css').send(swaggerCustomCss);
  });

  app.use(
    '/docs',
    (req, res, next) => {
      if (req.path === '/login') return next();
      return supabaseAuthMiddleware(['ADMIN'])(req, res, next);
    },
    ...swaggerServeHandlers.map(
      (handler): RequestHandler =>
        (req, res, next) => {
          if (req.path === '/login') return next();
          return handler(req, res, next);
        },
    ),
    ((req, res, next) => {
      if (req.path === '/login') return next();
      return swaggerUi.setup(swaggerSpec, {
        customJs: '/swagger-custom.js',
        customCssUrl: '/swagger-custom.css',
        swaggerOptions: {
          layout: 'BaseLayout',
          tagsSorter: (a: string, b: string) => {
            const order = [
              'Default',
              'Brevo',
              'Usuários',
              'Usuários - Admin',
              'Usuários - Stats',
              'Website',
              'Website - Banner',
              'Website - LogoEnterprises',
              'Website - Slider',
              'Website - Sobre',
              'Website - Consultoria',
              'Website - Recrutamento',
              'Website - SobreEmpresa',
              'Website - Team',
              'Website - Depoimentos',
              'Website - Diferenciais',
              'Website - Planinhas',
              'Website - Advance Ajuda',
              'Website - RecrutamentoSelecao',
              'Website - Sistema',
              'Website - TreinamentoCompany',
              'Website - ConexaoForte',
              'Website - TreinamentosInCompany',
              'Website - InformacoesGerais',
              'Website - ImagemLogin',
              'Website - Header Pages',
              'MercadoPago - Assinaturas',
              // Empresas - após Website - Header Pages
              'Empresas - Planos Empresariais',
              'Empresas - Clientes',
              'Empresas - Vagas',
            ];
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            // Tags não listadas vão para o final mantendo ordem alfabética entre elas
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          },
        },
      })(req, res, next);
    }) as RequestHandler,
  );

  app.get('/docs.json', supabaseAuthMiddleware(['ADMIN']), (req, res) => res.json(swaggerSpec));

  app.get('/redoc', supabaseAuthMiddleware(['ADMIN']), (req, res) => {
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
  });
}
