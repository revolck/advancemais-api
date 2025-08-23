import { Request, Response } from "express";
import { OrdersService, SubscriptionService } from "../../mercadopago";
import { 
  ProcessingMode, 
  CurrencyId, 
  PaymentMethodType, 
  FrequencyType,
  IdentificationType // ← IMPORTAÇÃO ADICIONADA
} from "../../mercadopago/enums";
import { prisma } from "../../../config/prisma";
import { EmailService } from "../../brevo/services/email-service";

/**
 * Controller para pagamentos integrado com MercadoPago
 * Demonstra como usar o módulo MercadoPago dentro do contexto de usuários
 */
export class PaymentController {
  private ordersService: OrdersService;
  private subscriptionService: SubscriptionService;
  private emailService: EmailService;

  constructor() {
    this.ordersService = new OrdersService();
    this.subscriptionService = new SubscriptionService();
    this.emailService = new EmailService();
  }

  /**
   * Processa pagamento de curso individual
   * POST /api/v1/usuarios/pagamentos/curso
   */
  public processarPagamentoCurso = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { 
        cursoId, 
        paymentToken, 
        installments, 
        paymentMethodId,
        issuerId 
      } = req.body;

      // Validação básica
      if (!cursoId || !paymentToken || !paymentMethodId) {
        return res.status(400).json({
          message: "Dados obrigatórios: cursoId, paymentToken, paymentMethodId"
        });
      }

      // Busca informações do curso (simulado - implemente conforme sua estrutura)
      const curso = await this.buscarCurso(cursoId);
      if (!curso) {
        return res.status(404).json({ message: "Curso não encontrado" });
      }

      // Verifica se o usuário já tem acesso ao curso
      const jaTemAcesso = await this.verificarAcessoCurso(userId, cursoId);
      if (jaTemAcesso) {
        return res.status(400).json({
          message: "Você já possui acesso a este curso"
        });
      }

      // Busca dados do usuário
      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          cpf: true,
          cnpj: true,
          tipoUsuario: true
        }
      });

      if (!usuario) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Prepara dados da order
      const orderData = {
        type: "online" as const,
        processing_mode: ProcessingMode.AUTOMATIC,
        total_amount: curso.preco,
        external_reference: `curso_${cursoId}_user_${userId}_${Date.now()}`,
        items: [
          {
            id: curso.id,
            title: curso.titulo,
            description: curso.descricao || `Curso: ${curso.titulo}`,
            quantity: 1,
            unit_price: curso.preco,
            currency_id: CurrencyId.BRL
          }
        ],
        payments: [
          {
            payment_method_id: paymentMethodId,
            payment_type_id: PaymentMethodType.CREDIT_CARD,
            token: paymentToken,
            installments: installments || 1,
            issuer_id: issuerId,
            payer: {
              email: usuario.email,
              first_name: usuario.nomeCompleto.split(' ')[0],
              last_name: usuario.nomeCompleto.split(' ').slice(1).join(' ') || 'Silva',
              identification: {
                // ← CORREÇÃO: usar enum ao invés de string literal
                type: usuario.cpf ? IdentificationType.CPF : IdentificationType.CNPJ,
                number: usuario.cpf || usuario.cnpj || ''
              }
            }
          }
        ]
      };

      // Cria order no MercadoPago
      const result = await this.ordersService.createOrder(orderData, userId);

      if (result.success && result.data) {
        // Salva informações do pagamento do curso
        await this.salvarPagamentoCurso({
          usuarioId: userId,
          cursoId,
          orderId: result.data.id,
          valor: curso.preco,
          status: 'PENDENTE'
        });

        res.status(201).json({
          message: "Pagamento iniciado com sucesso",
          order: result.data,
          curso: {
            id: curso.id,
            titulo: curso.titulo,
            preco: curso.preco
          }
        });
      } else {
        res.status(400).json({
          message: "Erro ao processar pagamento",
          error: result.error
        });
      }
    } catch (error) {
      console.error("Erro no processamento de pagamento de curso:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  /**
   * Cria assinatura premium
   * POST /api/v1/usuarios/pagamentos/assinatura
   */
  public criarAssinaturaPremium = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { 
        plano, 
        cardToken, 
        frequencia,
        periodo 
      } = req.body;

      // Validação básica
      if (!plano || !cardToken) {
        return res.status(400).json({
          message: "Dados obrigatórios: plano, cardToken"
        });
      }

      // Busca informações do plano
      const planoPremium = await this.buscarPlano(plano);
      if (!planoPremium) {
        return res.status(404).json({ message: "Plano não encontrado" });
      }

      // Verifica se já tem assinatura ativa
      const assinaturaExistente = await this.verificarAssinaturaAtiva(userId);
      if (assinaturaExistente) {
        return res.status(400).json({
          message: "Você já possui uma assinatura ativa"
        });
      }

      // Busca dados do usuário
      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true
        }
      });

      if (!usuario) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Prepara dados da assinatura
      const subscriptionData = {
        reason: `Assinatura ${planoPremium.nome} - Advance+`,
        external_reference: `subscription_${plano}_user_${userId}_${Date.now()}`,
        payer_email: usuario.email,
        card_token_id: cardToken,
        auto_recurring: {
          frequency: frequencia || 1,
          frequency_type: periodo || FrequencyType.MONTHS,
          transaction_amount: planoPremium.preco,
          currency_id: CurrencyId.BRL,
          // Free trial de 7 dias para novos usuários
          free_trial: {
            frequency: 7,
            frequency_type: FrequencyType.DAYS
          }
        },
        back_url: `${process.env.FRONTEND_URL}/assinatura/sucesso`
      };

      // Cria assinatura no MercadoPago
      const result = await this.subscriptionService.createSubscription(subscriptionData, userId);

      if (result.success && result.data) {
        // Salva informações da assinatura
        await this.salvarAssinatura({
          usuarioId: userId,
          planoId: plano,
          subscriptionId: result.data.id,
          valor: planoPremium.preco,
          status: 'PENDENTE'
        });

        res.status(201).json({
          message: "Assinatura criada com sucesso",
          subscription: result.data,
          plano: planoPremium
        });
      } else {
        res.status(400).json({
          message: "Erro ao criar assinatura",
          error: result.error
        });
      }
    } catch (error) {
      console.error("Erro na criação de assinatura:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  /**
   * Lista histórico de pagamentos do usuário
   * GET /api/v1/usuarios/pagamentos/historico
   */
  public listarHistoricoPagamentos = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // Busca orders do usuário
      const orders = await prisma.mercadoPagoOrder.findMany({
        where: { usuarioId: userId },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true,
          mercadoPagoOrderId: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          externalReference: true,
          criadoEm: true,
          orderData: true
        }
      });

      // Busca assinaturas do usuário
      const subscriptions = await prisma.mercadoPagoSubscription.findMany({
        where: { usuarioId: userId },
        orderBy: { criadoEm: 'desc' },
        take: 5,
        select: {
          id: true,
          mercadoPagoSubscriptionId: true,
          status: true,
          reason: true,
          transactionAmount: true,
          frequency: true,
          frequencyType: true,
          nextPaymentDate: true,
          criadoEm: true
        }
      });

      // Contar total para paginação
      const totalOrders = await prisma.mercadoPagoOrder.count({
        where: { usuarioId: userId }
      });

      res.json({
        message: "Histórico de pagamentos obtido com sucesso",
        data: {
          orders,
          subscriptions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalOrders,
            pages: Math.ceil(totalOrders / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error("Erro ao listar histórico:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  /**
   * Cancela assinatura do usuário
   * PUT /api/v1/usuarios/pagamentos/assinatura/cancelar
   */
  public cancelarAssinatura = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { subscriptionId, motivo } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({
          message: "ID da assinatura é obrigatório"
        });
      }

      // Verifica se a assinatura pertence ao usuário
      const subscription = await prisma.mercadoPagoSubscription.findFirst({
        where: {
          mercadoPagoSubscriptionId: subscriptionId,
          usuarioId: userId
        }
      });

      if (!subscription) {
        return res.status(404).json({
          message: "Assinatura não encontrada ou não pertence ao usuário"
        });
      }

      // Cancela no MercadoPago
      const result = await this.subscriptionService.cancelSubscription(subscriptionId, userId);

      if (result.success) {
        // Registra motivo do cancelamento
        await this.registrarCancelamentoAssinatura(subscriptionId, motivo);

        // Envia email de confirmação
        await this.enviarEmailCancelamento(userId, subscription.reason);

        res.json({
          message: "Assinatura cancelada com sucesso",
          subscription: result.data
        });
      } else {
        res.status(400).json({
          message: "Erro ao cancelar assinatura",
          error: result.error
        });
      }
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  /**
   * Métodos auxiliares privados
   */

  private async buscarCurso(cursoId: string) {
    // Implementar busca do curso no seu banco de dados
    // Esta é uma simulação - adapte conforme sua estrutura
    return {
      id: cursoId,
      titulo: "Curso de JavaScript Avançado",
      descricao: "Curso completo de JavaScript com projetos práticos",
      preco: 197.90
    };
  }

  private async buscarPlano(planoId: string) {
    // Implementar busca do plano no seu banco de dados
    const planos = {
      'premium': {
        id: 'premium',
        nome: 'Premium',
        preco: 29.90,
        descricao: 'Acesso completo à plataforma'
      },
      'premium-anual': {
        id: 'premium-anual',
        nome: 'Premium Anual',
        preco: 297.90,
        descricao: 'Acesso completo à plataforma por 12 meses'
      }
    };

    return planos[planoId as keyof typeof planos] || null;
  }

  private async verificarAcessoCurso(userId: string, cursoId: string): Promise<boolean> {
    // Implementar verificação se o usuário já tem acesso ao curso
    // Esta é uma simulação - adapte conforme sua estrutura
    return false;
  }

  private async verificarAssinaturaAtiva(userId: string): Promise<boolean> {
    const assinatura = await prisma.mercadoPagoSubscription.findFirst({
      where: {
        usuarioId: userId,
        status: 'authorized'
      }
    });

    return !!assinatura;
  }

  private async salvarPagamentoCurso(dados: {
    usuarioId: string;
    cursoId: string;
    orderId: string;
    valor: number;
    status: string;
  }) {
    // Implementar salvamento no seu banco - pode criar uma tabela específica
    // ou usar os campos JSON do MercadoPagoOrder para armazenar metadados
    console.log("Salvando pagamento de curso:", dados);
  }

  private async salvarAssinatura(dados: {
    usuarioId: string;
    planoId: string;
    subscriptionId: string;
    valor: number;
    status: string;
  }) {
    // Implementar salvamento no seu banco
    console.log("Salvando assinatura:", dados);
  }

  private async registrarCancelamentoAssinatura(subscriptionId: string, motivo?: string) {
    // Implementar registro do motivo de cancelamento
    console.log("Registrando cancelamento:", subscriptionId, motivo);
  }

  private async enviarEmailCancelamento(userId: string, nomeAssinatura: string) {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { email: true, nomeCompleto: true }
      });

      if (usuario) {
        // Implementar envio de email customizado usando o EmailService
        console.log(`Enviando email de cancelamento para ${usuario.email}`);
      }
    } catch (error) {
      console.error("Erro ao enviar email de cancelamento:", error);
    }
  }
}